/* ============================================================
   GAMETRACKER — Tómbola: juegos en un bombo y un sorteo por jugador
   Firestore: tombola/{juegoId} (bombo), tombola_asignaciones/{auto} (juego de cada jugador) y tombola_historial/{auto}
   ============================================================ */
(function () {
  'use strict';

  var Utils      = window.GT.Utils;
  var Biblioteca = window.GT.Biblioteca;
  var Toast      = window.GT.Toast;

  var pool = [];        // [{id, titulo, portadaUrl, ...}] del bombo
  var mode = 'anual';   // pestaña: 'anual' (evento del año que viene) | 'rapida' (sorteo de una noche)
  var quick = [];       // bombo de esta noche: solo en este dispositivo (localStorage)
  var quickLast = null; // último juego que salió en la pestaña rápida
  var assigns = [];     // juego asignado a cada jugador: {id, jugador, juegoId, titulo, anioJuego, estado: 'pendiente'|'jugado', ...}
  var busy = false;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return Utils.escapeHtml(s || ''); }
  function player() { var r = document.querySelector('input[name=tmbPlayer]:checked'); return r ? r.value : 'Javi'; }
  // con ?tmbtest las colecciones llevan sufijo: sirve para probar sin tocar los datos reales
  var SUF = /[?&]tmbtest\b/.test(location.search) ? '_test' : '';
  function coll(name) { return window.GT.db.collection(name + SUF); }

  /* El título/portada salen de la biblioteca (siempre al día); lo guardado en la tómbola es solo respaldo */
  function gameOf(entry) {
    var g = entry.libre ? null : Biblioteca.getById(entry.id);
    return g || { id: entry.id, titulo: entry.titulo || '(juego eliminado)', portadaUrl: entry.portadaUrl || '', libre: !!entry.libre };
  }

  /* ── BOMBO ──────────────────────────────────────────────── */
  function pendingOf(p) { var c = current(p); return c && c.estado === 'pendiente' ? c : null; }
  function assignedTo() { var m = {}; assigns.forEach(function (a) { if (a.estado === 'pendiente') m[a.juegoId] = a.jugador; }); return m; }
  function available() { var m = assignedTo(); return pool.filter(function (e) { return !m[e.id]; }); }

  function renderPool() {
    var m = assignedTo(), free = available().length;
    $('tmbPoolCount').textContent = pool.length ? '(' + pool.length + ')' : '';
    if (mode === 'anual') $('tmbCount').textContent = !pool.length ? 'El bombo está vacío: añade juegos abajo'
      : free + ' juego' + (free !== 1 ? 's' : '') + ' disponible' + (free !== 1 ? 's' : '') + ' para sortear' + (free !== pool.length ? ' (' + (pool.length - free) + ' ya asignado' + (pool.length - free !== 1 ? 's' : '') + ')' : '');
    $('tmbList').innerHTML = pool.length
      ? pool.map(function (e) {
          var g = gameOf(e), who = m[e.id];
          return '<span class="tmb-item' + (who ? ' tmb-item--assigned' : '') + '">' + (g.portadaUrl ? '<img src="' + esc(g.portadaUrl) + '" alt="" loading="lazy">' : '') +
            esc(g.titulo) + (who ? ' <small style="color:var(--txt3)">🔒 ' + esc(who) + '</small>' : '') +
            '<button type="button" data-rm="' + esc(e.id) + '" title="Quitar" aria-label="Quitar ' + esc(g.titulo) + '">✕</button></span>';
        }).join('')
      : '<span class="tmb-empty">Nada todavía</span>';
  }

  function addToPool(g) {
    return coll('tombola').doc(g.id).set({
      titulo: g.titulo, portadaUrl: g.portadaUrl || '', agregadoPor: player(), creadoEn: new Date().toISOString()
    });
  }

  function removeFromPool(id) { return coll('tombola').doc(id).delete(); }

  function addFree(nombre) {
    return coll('tombola').doc().set({ titulo: nombre, portadaUrl: '', libre: true, agregadoPor: player(), creadoEn: new Date().toISOString() });
  }

  /* borra todos los documentos de una colección (por tandas: un lote de Firestore admite 500) */
  function wipe(name) {
    return coll(name).get().then(function (snap) {
      var chunks = [];
      for (var i = 0; i < snap.docs.length; i += 450) chunks.push(snap.docs.slice(i, i + 450));
      return Promise.all(chunks.map(function (docs) {
        var batch = window.GT.db.batch();
        docs.forEach(function (d) { batch.delete(d.ref); });
        return batch.commit();
      }));
    });
  }

  function clearPool() {
    if (!pool.length) { Toast.show('El bombo ya está vacío'); return; }
    if (!confirm('¿Vaciar el bombo? Se quitan los ' + pool.length + ' juegos (no se borran de la biblioteca).')) return;
    wipe('tombola').then(function () { Toast.show('Bombo vaciado ✓'); })
      .catch(function () { Toast.show('No se pudo vaciar el bombo', 'error'); });
  }

  /* ── BUSCADOR PARA AÑADIR ───────────────────────────────── */
  function norm(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  function suggestInto(inputId, boxId, taken) {
    var raw = $(inputId).value.trim(), q = norm(raw), box = $(boxId);
    if (!q) { box.style.display = 'none'; return; }
    var inList = {};
    taken.forEach(function (e) { inList[e.id] = true; });
    var hits = Biblioteca.getAll().filter(function (g) { return !inList[g.id] && norm(g.titulo).indexOf(q) !== -1; }).slice(0, 8);
    box.innerHTML = hits.map(function (g) {
        return '<button type="button" data-add="' + esc(g.id) + '">' + (g.portadaUrl ? '<img src="' + esc(g.portadaUrl) + '" alt="" loading="lazy">' : '') + esc(g.titulo) + '</button>';
      }).join('') +
      '<button type="button" data-free="1">➕ Añadir «' + esc(raw) + '» como juego nuevo (no está en la biblioteca)</button>';
    box.style.display = 'block';
  }

  function renderSuggest() { suggestInto('tmbSearch', 'tmbSuggest', pool); }

  /* ── SORTEO ─────────────────────────────────────────────── */
  /* ── SONIDO Y CONFETI ───────────────────────────────────── */
  var audio = null;
  var muted = false;
  try { muted = localStorage.getItem('GT_tmb_mute') === '1'; } catch (e) {}

  function ac() {
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
    } catch (e) { audio = null; }
    return audio;
  }

  function blip(freq, dur, type, vol) {
    if (muted) return;
    var a = ac();
    if (!a) return;
    var o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
    o.type = type || 'square';
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.05, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + dur);
  }

  function fanfare() { [523, 659, 784, 1047, 1319].forEach(function (f, i) { setTimeout(function () { blip(f, 0.22, 'triangle', 0.09); }, i * 90); }); }

  var CONFETTI = ['#e03a4e', '#f5b830', '#2f55d4', '#3fb55e', '#8b3fd0', '#1fa0d8', '#f08a30'];
  function confetti() {
    if (!Element.prototype.animate || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    var wrap = $('tmbDrumWrap');
    for (var i = 0; i < 30; i++) {
      var el = document.createElement('i');
      el.style.cssText = 'position:absolute;left:50%;top:44%;width:8px;height:12px;border-radius:2px;pointer-events:none;background:' + CONFETTI[i % CONFETTI.length];
      wrap.appendChild(el);
      var ang = Math.random() * Math.PI * 2, d = 110 + Math.random() * 140;
      var anim = el.animate([
        { transform: 'translate(-50%,-50%) rotate(0deg)', opacity: 1 },
        { transform: 'translate(calc(-50% + ' + Math.cos(ang) * d + 'px), calc(-50% + ' + (Math.sin(ang) * d + 90) + 'px)) rotate(' + Math.round(Math.random() * 720) + 'deg)', opacity: 0 }
      ], { duration: 1100 + Math.random() * 600, easing: 'cubic-bezier(.2,.7,.3,1)' });
      (function (node, an) { an.onfinish = function () { node.remove(); }; })(el, anim);
    }
  }

  function rand(n) { var a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }

  function showSlot(g, win) {
    $('tmbSlotImg').style.backgroundImage = g.portadaUrl ? 'url("' + String(g.portadaUrl).replace(/"/g, '%22') + '")' : 'none';
    $('tmbSlotName').textContent = g.titulo;
    $('tmbSlot').classList.toggle('tmb-slot--win', !!win);
  }

  /* ── JUEGO ASIGNADO A CADA JUGADOR ──────────────────────── */
  function current(p) {
    return assigns.filter(function (a) { return a.jugador === p; })
      .sort(function (a, b) { return String(b.sorteadoEn).localeCompare(String(a.sorteadoEn)); })[0] || null;
  }

  function fmtDay(iso) { var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }); }

  function setSlotEmpty() {
    $('tmbSlotImg').style.backgroundImage = 'none';
    $('tmbSlotName').textContent = '¿Qué te tocará?';
    $('tmbSlot').classList.remove('tmb-slot--win');
  }

  /* Lo que ve el jugador elegido: su juego (pendiente o jugado) o el bombo listo para girar. Cada jugador es independiente. */
  function renderPlayerView() {
    if (busy || mode !== 'anual') return;
    var p = player(), cur = current(p);
    $('tmbPlayerName').textContent = p;
    if (!cur) {
      setSlotEmpty();
      $('tmbResult').style.display = 'none';
      $('tmbGo').textContent = '🎰 ¡GIRAR!';
      $('tmbGo').disabled = !available().length;
      $('tmbLock').textContent = '';
      return;
    }
    var g = gameOf({ id: cur.juegoId, titulo: cur.titulo, portadaUrl: cur.portadaUrl, libre: cur.libre });
    var pending = cur.estado === 'pendiente';
    showSlot(g, pending);
    $('tmbWin').textContent = pending ? '🎯 Tu juego: a jugarlo en ' + cur.anioJuego : '✅ ¡Pasado, ' + p + '!';
    $('tmbResultMeta').textContent = pending
      ? [g.desarrollador, (g.plataformas || []).join(' · '), g.duracion ? '~' + g.duracion + ' h' : ''].filter(Boolean).join(' — ') + ' · márcalo aquí cuando te lo pases'
      : 'Jugado el ' + fmtDay(cur.jugadoEn);
    $('tmbDone').style.display = $('tmbCancel').style.display = pending ? '' : 'none';
    $('tmbResult').style.display = 'block';
    $('tmbGo').textContent = pending ? '🔒 YA TIENES JUEGO' : '🎰 SORTEAR OTRO';
    $('tmbGo').disabled = pending || !available().length;
    $('tmbLock').textContent = pending ? 'Hasta que no lo marques como jugado (o anules el sorteo) no puedes sacar otro.' : '';
  }

  function renderBoard() {
    $('tmbYear').textContent = '(sorteo ' + new Date().getFullYear() + ' → a jugar en ' + (new Date().getFullYear() + 1) + ')';
    $('tmbBoard').innerHTML = ['David', 'Javi', 'Mery'].map(function (p) {
      var c = current(p);
      if (!c) return '<div class="tmb-bcard tmb-bcard--' + p + ' tmb-bcard--empty"><div class="tmb-bcard__who">' + p.toUpperCase() + '</div><div class="tmb-bcard__img"></div><div class="tmb-bcard__name">Aún sin sortear</div><div class="tmb-bcard__state">&nbsp;</div></div>';
      var g = gameOf({ id: c.juegoId, titulo: c.titulo, portadaUrl: c.portadaUrl, libre: c.libre });
      var done = c.estado === 'jugado';
      return '<div class="tmb-bcard tmb-bcard--' + p + (done ? ' tmb-bcard--done' : '') + '"><div class="tmb-bcard__who">' + p.toUpperCase() + '</div>' +
        '<div class="tmb-bcard__img" style="background-image:' + (g.portadaUrl ? 'url(&quot;' + esc(String(g.portadaUrl).replace(/"/g, '%22')) + '&quot;)' : 'none') + '"></div>' +
        '<div class="tmb-bcard__name">' + esc(g.titulo) + '</div>' +
        '<div class="tmb-bcard__state">' + (done ? '✅ Jugado el ' + esc(fmtDay(c.jugadoEn)) : '⏳ A jugar en ' + c.anioJuego) + '</div></div>';
    }).join('');
  }

  function markDone() {
    var cur = pendingOf(player());
    if (!cur) return;
    if (!confirm('¿Marcar «' + cur.titulo + '» como jugado y pasado?')) return;
    coll('tombola_asignaciones').doc(cur.id).update({ estado: 'jugado', jugadoEn: new Date().toISOString() })
      .then(function () { Toast.show('¡Enhorabuena! «' + cur.titulo + '» pasado ✓'); confetti(); fanfare(); })
      .catch(function () { Toast.show('No se pudo marcar como jugado', 'error'); });
  }

  function cancelAssign() {
    var cur = pendingOf(player());
    if (!cur) return;
    if (!confirm('¿Anular tu sorteo? «' + cur.titulo + '» vuelve al bombo y podrás volver a girar.')) return;
    coll('tombola_asignaciones').doc(cur.id).delete()
      .then(function () { Toast.show('Sorteo anulado'); })
      .catch(function () { Toast.show('No se pudo anular', 'error'); });
  }

  /* Gira el bombo y enseña juegos al azar cada vez más despacio hasta parar en el elegido */
  function runSpin(free, picked, finish) {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var drum = $('tmbDrum');
    ac(); // el audio solo arranca con un gesto del usuario: este clic

    function end() {
      drum.classList.remove('tmb-drum--spin');
      showSlot(picked, true);
      fanfare();
      confetti();
      finish();
    }

    if (reduce) { end(); return; }
    drum.classList.add('tmb-drum--spin');
    var delay = 70, elapsed = 0;
    (function tick() {
      if (elapsed >= 2400) { end(); return; }
      showSlot(gameOf(free[rand(free.length)]), false);
      blip(260 + Math.random() * 520, 0.05, 'square', 0.035);
      elapsed += delay;
      delay = Math.round(delay * 1.12);
      setTimeout(tick, delay);
    })();
  }

  function draw() {
    if (mode === 'rapida') { drawQuick(); return; }
    var p = player();
    var free = available();
    if (busy || !free.length || pendingOf(p)) return;
    busy = true;
    $('tmbGo').disabled = true;
    $('tmbResult').style.display = 'none';
    var picked = gameOf(free[rand(free.length)]);

    runSpin(free, picked, function () {
      var year = new Date().getFullYear() + 1;
      $('tmbWin').textContent = '🎉 ¡' + p + ', te ha tocado!';
      $('tmbResultMeta').textContent = 'A jugarlo en ' + year + ' y pasártelo';
      $('tmbDone').style.display = $('tmbCancel').style.display = 'none';
      $('tmbResult').style.display = 'block';
      // se guarda su juego; cuando llega, la vista pasa al estado "tienes juego" (con los botones de marcar/anular)
      coll('tombola_asignaciones').add({
        jugador: p, juegoId: picked.id, titulo: picked.titulo, portadaUrl: picked.portadaUrl || '', libre: !!picked.libre,
        sorteadoEn: new Date().toISOString(), anioJuego: year, estado: 'pendiente'
      }).catch(function (e) { console.error('tombola_asignaciones:', e); Toast.show('No se pudo guardar tu sorteo', 'error'); })
        .then(function () { busy = false; renderPlayerView(); });
      coll('tombola_historial').add({ jugador: p, juegoId: picked.id, titulo: picked.titulo, fecha: new Date().toISOString() })
        .catch(function (e) { console.error('tombola_historial:', e); });
    });
  }

  /* ── PARA ESTA NOCHE: bombo propio, sin base de datos ──────── */
  function qLoad() {
    try {
      var a = JSON.parse(localStorage.getItem('GT_tmb_quick') || '[]');
      return Array.isArray(a) ? a.filter(function (x) { return x && x.id && x.titulo; }) : [];
    } catch (e) { return []; }
  }
  function qSave() { try { localStorage.setItem('GT_tmb_quick', JSON.stringify(quick)); } catch (e) {} }

  function quickAdd(g) {
    if (quick.some(function (e) { return e.id === g.id; })) return;
    quick.push({ id: g.id, titulo: g.titulo, portadaUrl: g.portadaUrl || '', libre: !!g.libre });
    qSave(); renderQuickView();
  }
  function quickAddFree(nombre) {
    quick.push({ id: 'libre-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), titulo: nombre, portadaUrl: '', libre: true });
    qSave(); renderQuickView();
  }

  function renderQuickList() {
    $('qCount').textContent = quick.length ? '(' + quick.length + ')' : '';
    $('qList').innerHTML = quick.length
      ? quick.map(function (e) {
          var g = gameOf(e);
          return '<span class="tmb-item">' + (g.portadaUrl ? '<img src="' + esc(g.portadaUrl) + '" alt="" loading="lazy">' : '') + esc(g.titulo) +
            '<button type="button" data-qrm="' + esc(e.id) + '" title="Quitar" aria-label="Quitar ' + esc(g.titulo) + '">✕</button></span>';
        }).join('')
      : '<span class="tmb-empty">Nada todavía</span>';
  }

  function renderQuickView() {
    if (busy || mode !== 'rapida') return;
    var n = quick.length;
    $('tmbCount').textContent = n ? n + ' juego' + (n !== 1 ? 's' : '') + ' en el bombo de esta noche' : 'Añade los juegos que os apetecen ahora (mínimo 2)';
    $('tmbLock').textContent = n === 1 ? 'Falta al menos otro juego para poder sortear.' : '';
    if (quickLast && quick.some(function (e) { return e.id === quickLast.id; })) {
      var g = gameOf(quickLast);
      showSlot(g, true);
      $('tmbWin').textContent = '🎲 ¡Esta noche toca!';
      $('tmbResultMeta').textContent = [g.desarrollador, (g.plataformas || []).join(' · '), g.duracion ? '~' + g.duracion + ' h' : ''].filter(Boolean).join(' — ');
      $('tmbResult').style.display = 'block';
      $('tmbGo').textContent = '🎰 ¡OTRA VEZ!';
    } else {
      quickLast = null;
      setSlotEmpty();
      $('tmbResult').style.display = 'none';
      $('tmbGo').textContent = '🎰 ¡GIRAR!';
    }
    $('tmbGo').disabled = n < 2;
    renderQuickList();
  }

  function drawQuick() {
    if (busy || quick.length < 2) return;
    busy = true;
    $('tmbGo').disabled = true;
    $('tmbResult').style.display = 'none';
    var picked = gameOf(quick[rand(quick.length)]);
    runSpin(quick, picked, function () { quickLast = picked; busy = false; renderQuickView(); });
  }

  /* ── PESTAÑAS ───────────────────────────────────────────── */
  function setTab(m) {
    if (busy) return;
    mode = m === 'rapida' ? 'rapida' : 'anual';
    try { localStorage.setItem('GT_tmb_tab', mode); } catch (e) {}
    document.querySelectorAll('[data-tab]').forEach(function (el) { el.hidden = el.dataset.tab !== mode; });
    document.querySelectorAll('[data-tabbtn]').forEach(function (b) { b.classList.toggle('tmb-tab--on', b.dataset.tabbtn === mode); });
    if (mode === 'anual') { renderPool(); renderPlayerView(); } else { renderQuickView(); }
  }

  /* ── HISTORIAL ──────────────────────────────────────────── */
  function ago(iso) {
    var d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    return d <= 0 ? 'hoy' : d === 1 ? 'ayer' : 'hace ' + d + ' días';
  }

  function renderHistory(docs) {
    $('tmbHist').innerHTML = docs.length
      ? docs.map(function (h) { return '<li><span><b>' + esc(h.jugador) + '</b> → ' + esc(h.titulo) + '</span><span>' + ago(h.fecha) + '</span></li>'; }).join('')
      : '<li class="tmb-empty">Aún no hay sorteos</li>';
  }

  /* ── INIT ───────────────────────────────────────────────── */
  function init() {
    var saved = null;
    try { saved = localStorage.getItem('GT_player'); } catch (e) {}
    var r = saved && document.querySelector('input[name=tmbPlayer][value="' + saved + '"]');
    if (r) r.checked = true;
    $('tmbPlayerName').textContent = player();
    document.querySelectorAll('input[name=tmbPlayer]').forEach(function (i) {
      i.addEventListener('change', renderPlayerView);
    });

    coll('tombola').onSnapshot(function (snap) {
      pool = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      renderPool();
      renderSuggest();
      renderPlayerView();
    }, function (e) { console.error('tombola:', e); $('tmbError').style.display = 'block'; });

    coll('tombola_asignaciones').onSnapshot(function (snap) {
      assigns = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      renderPool();
      renderBoard();
      renderPlayerView();
    }, function (e) { console.error('tombola_asignaciones:', e); $('tmbError').style.display = 'block'; });

    coll('tombola_historial').orderBy('fecha', 'desc').limit(8).onSnapshot(function (snap) {
      renderHistory(snap.docs.map(function (d) { return d.data(); }));
    }, function (e) { console.error('tombola_historial:', e); });

    $('tmbMute').textContent = muted ? '🔇' : '🔊';
    $('tmbMute').addEventListener('click', function () {
      muted = !muted;
      try { localStorage.setItem('GT_tmb_mute', muted ? '1' : '0'); } catch (e) {}
      this.textContent = muted ? '🔇' : '🔊';
    });
    $('tmbGo').addEventListener('click', draw);
    $('tmbSearch').addEventListener('input', renderSuggest);
    document.addEventListener('click', function (e) { if (!e.target.closest('.tmb-search')) { $('tmbSuggest').style.display = 'none'; $('qSuggest').style.display = 'none'; } });

    $('tmbSuggest').addEventListener('click', function (e) {
      var f = e.target.closest('[data-free]');
      if (f) {
        var nombre = $('tmbSearch').value.trim();
        if (nombre) addFree(nombre).then(function () { Toast.show('“' + nombre + '” añadido al bombo ✓'); }).catch(function () { Toast.show('No se pudo añadir', 'error'); });
        $('tmbSearch').value = '';
        $('tmbSuggest').style.display = 'none';
        return;
      }
      var b = e.target.closest('[data-add]');
      if (!b) return;
      var g = Biblioteca.getById(b.dataset.add);
      if (!g) return;
      addToPool(g).then(function () { Toast.show('“' + g.titulo + '” añadido al bombo ✓'); }).catch(function () { Toast.show('No se pudo añadir', 'error'); });
      $('tmbSearch').value = '';
      $('tmbSuggest').style.display = 'none';
    });

    $('tmbList').addEventListener('click', function (e) {
      var b = e.target.closest('[data-rm]');
      if (b) removeFromPool(b.dataset.rm).catch(function () { Toast.show('No se pudo quitar', 'error'); });
    });

    $('tmbAddPend').addEventListener('click', function () {
      var p = player();
      var inPool = {};
      pool.forEach(function (e) { inPool[e.id] = true; });
      var games = Biblioteca.getAll().filter(function (g) { return !inPool[g.id] && (g.pendientePor || []).indexOf(p) !== -1; });
      if (!games.length) { Toast.show('No hay pendientes de ' + p + ' fuera del bombo'); return; }
      var batch = window.GT.db.batch();
      games.forEach(function (g) {
        batch.set(coll('tombola').doc(g.id), { titulo: g.titulo, portadaUrl: g.portadaUrl || '', agregadoPor: p, creadoEn: new Date().toISOString() });
      });
      batch.commit().then(function () { Toast.show(games.length + ' pendientes de ' + p + ' añadidos ✓'); })
        .catch(function () { Toast.show('No se pudieron añadir', 'error'); });
    });

    $('tmbClearAll').addEventListener('click', clearPool);
    $('tmbClearHist').addEventListener('click', function () {
      if (!confirm('¿Borrar el historial de sorteos?')) return;
      wipe('tombola_historial').then(function () { Toast.show('Historial borrado ✓'); })
        .catch(function () { Toast.show('No se pudo borrar el historial', 'error'); });
    });

    quick = qLoad();
    document.querySelectorAll('[data-tabbtn]').forEach(function (b) { b.addEventListener('click', function () { setTab(b.dataset.tabbtn); }); });
    $('qSearch').addEventListener('input', function () { suggestInto('qSearch', 'qSuggest', quick); });
    $('qSuggest').addEventListener('click', function (e) {
      var f = e.target.closest('[data-free]');
      if (f) { var nombre = $('qSearch').value.trim(); if (nombre) quickAddFree(nombre); }
      else {
        var b = e.target.closest('[data-add]'), g = b && Biblioteca.getById(b.dataset.add);
        if (!g) return;
        quickAdd(g);
      }
      $('qSearch').value = '';
      $('qSuggest').style.display = 'none';
    });
    $('qList').addEventListener('click', function (e) {
      var b = e.target.closest('[data-qrm]');
      if (!b) return;
      quick = quick.filter(function (x) { return x.id !== b.dataset.qrm; });
      qSave(); renderQuickView();
    });
    $('qClear').addEventListener('click', function () {
      if (!quick.length || !confirm('¿Vaciar el bombo de esta noche?')) return;
      quick = []; quickLast = null; qSave(); renderQuickView();
    });
    $('tmbQDrop').addEventListener('click', function () {
      if (!quickLast) return;
      quick = quick.filter(function (x) { return x.id !== quickLast.id; });
      quickLast = null; qSave(); renderQuickView();
    });

    $('tmbDone').addEventListener('click', markDone);
    $('tmbCancel').addEventListener('click', cancelAssign);

    renderBoard();
    var tab = null;
    try { tab = localStorage.getItem('GT_tmb_tab'); } catch (e) {}
    setTab(tab);
  }

  document.addEventListener('DOMContentLoaded', function () {
    window.GT.onDataReady(init);
  });
})();
