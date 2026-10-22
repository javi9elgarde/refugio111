/* ============================================================
   GAMETRACKER — Tómbola: juegos en un bombo y un sorteo por jugador
   Firestore: tombola/{juegoId}  y  tombola_historial/{auto}
   ============================================================ */
(function () {
  'use strict';

  var Utils      = window.GT.Utils;
  var Biblioteca = window.GT.Biblioteca;
  var Toast      = window.GT.Toast;

  var pool = [];        // [{id, titulo, portadaUrl, ...}] del bombo
  var busy = false;
  var winner = null;    // juego sorteado, para los botones del resultado

  function $(id) { return document.getElementById(id); }
  function esc(s) { return Utils.escapeHtml(s || ''); }
  function player() { var r = document.querySelector('input[name=tmbPlayer]:checked'); return r ? r.value : 'Javi'; }
  function coll(name) { return window.GT.db.collection(name); }

  /* El título/portada salen de la biblioteca (siempre al día); lo guardado en la tómbola es solo respaldo */
  function gameOf(entry) {
    var g = entry.libre ? null : Biblioteca.getById(entry.id);
    return g || { id: entry.id, titulo: entry.titulo || '(juego eliminado)', portadaUrl: entry.portadaUrl || '', libre: !!entry.libre };
  }

  /* ── BOMBO ──────────────────────────────────────────────── */
  function renderPool() {
    $('tmbPoolCount').textContent = pool.length ? '(' + pool.length + ')' : '';
    $('tmbCount').textContent = pool.length ? pool.length + ' juego' + (pool.length !== 1 ? 's' : '') + ' en el bombo' : 'El bombo está vacío: añade juegos abajo';
    $('tmbGo').disabled = busy || !pool.length;
    $('tmbList').innerHTML = pool.length
      ? pool.map(function (e) {
          var g = gameOf(e);
          return '<span class="tmb-item">' + (g.portadaUrl ? '<img src="' + esc(g.portadaUrl) + '" alt="" loading="lazy">' : '') +
            esc(g.titulo) + '<button type="button" data-rm="' + esc(e.id) + '" title="Quitar" aria-label="Quitar ' + esc(g.titulo) + '">✕</button></span>';
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
    wipe('tombola').then(function () { Toast.show('Bombo vaciado ✓'); $('tmbResult').style.display = 'none'; winner = null; })
      .catch(function () { Toast.show('No se pudo vaciar el bombo', 'error'); });
  }

  /* ── BUSCADOR PARA AÑADIR ───────────────────────────────── */
  function norm(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  function renderSuggest() {
    var q = norm($('tmbSearch').value.trim());
    var box = $('tmbSuggest');
    if (!q) { box.style.display = 'none'; return; }
    var inPool = {};
    pool.forEach(function (e) { inPool[e.id] = true; });
    var hits = Biblioteca.getAll().filter(function (g) { return !inPool[g.id] && norm(g.titulo).indexOf(q) !== -1; }).slice(0, 8);
    var raw = $('tmbSearch').value.trim();
    box.innerHTML = hits.map(function (g) {
        return '<button type="button" data-add="' + esc(g.id) + '">' + (g.portadaUrl ? '<img src="' + esc(g.portadaUrl) + '" alt="" loading="lazy">' : '') + esc(g.titulo) + '</button>';
      }).join('') +
      '<button type="button" data-free="1">➕ Añadir «' + esc(raw) + '» como juego nuevo (no está en la biblioteca)</button>';
    box.style.display = 'block';
  }

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

  function draw() {
    if (busy || !pool.length) return;
    busy = true;
    winner = null;
    $('tmbGo').disabled = true;
    $('tmbResult').style.display = 'none';
    var picked = gameOf(pool[rand(pool.length)]);
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var drum = $('tmbDrum');
    ac(); // el audio solo arranca con un gesto del usuario: este clic

    function finish() {
      drum.classList.remove('tmb-drum--spin');
      showSlot(picked, true);
      winner = picked;
      busy = false;
      renderPool();
      $('tmbResultMeta').textContent = [picked.desarrollador, (picked.plataformas || []).join(' · '), picked.duracion ? '~' + picked.duracion + ' h' : ''].filter(Boolean).join(' — ');
      $('tmbWin').textContent = '🎉 ¡' + player() + ', te ha tocado!';
      fanfare();
      confetti();
      $('tmbPend').style.display = picked.libre ? 'none' : '';
      $('tmbResult').style.display = 'block';
      $('tmbGo').textContent = '🎰 ¡OTRA VEZ!';
      coll('tombola_historial').add({ jugador: player(), juegoId: picked.id, titulo: picked.titulo, fecha: new Date().toISOString() })
        .catch(function (e) { console.error('tombola_historial:', e); });
    }

    if (reduce) { finish(); return; }
    drum.classList.add('tmb-drum--spin');
    // se enseñan juegos al azar cada vez más despacio, hasta parar en el elegido
    var delay = 70, elapsed = 0;
    (function tick() {
      if (elapsed >= 2400) { finish(); return; }
      showSlot(gameOf(pool[rand(pool.length)]), false);
      blip(260 + Math.random() * 520, 0.05, 'square', 0.035);
      elapsed += delay;
      delay = Math.round(delay * 1.12);
      setTimeout(tick, delay);
    })();
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
      i.addEventListener('change', function () { $('tmbPlayerName').textContent = player(); });
    });

    coll('tombola').onSnapshot(function (snap) {
      pool = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      renderPool();
      renderSuggest();
    }, function (e) { console.error('tombola:', e); $('tmbError').style.display = 'block'; });

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
    document.addEventListener('click', function (e) { if (!e.target.closest('.tmb-search')) $('tmbSuggest').style.display = 'none'; });

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
    $('tmbClearAfter').addEventListener('click', clearPool);
    $('tmbClearHist').addEventListener('click', function () {
      if (!confirm('¿Borrar el historial de sorteos?')) return;
      wipe('tombola_historial').then(function () { Toast.show('Historial borrado ✓'); })
        .catch(function () { Toast.show('No se pudo borrar el historial', 'error'); });
    });

    $('tmbRemove').addEventListener('click', function () {
      if (!winner) return;
      var t = winner.titulo;
      removeFromPool(winner.id).then(function () { Toast.show('“' + t + '” fuera del bombo'); $('tmbResult').style.display = 'none'; winner = null; });
    });

    $('tmbPend').addEventListener('click', function () {
      if (!winner) return;
      var g = Biblioteca.getById(winner.id);
      if (!g) return;
      var p = player();
      var list = (g.pendientePor || []).slice();
      if (list.indexOf(p) === -1) list.push(p);
      Biblioteca.update(g.id, { pendientePor: list, pendiente: true });
      Toast.show('“' + g.titulo + '” en los pendientes de ' + p + ' ✓');
    });

    renderPool();
  }

  document.addEventListener('DOMContentLoaded', function () {
    window.GT.onDataReady(init);
  });
})();
