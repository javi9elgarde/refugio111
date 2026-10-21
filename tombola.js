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
    var g = Biblioteca.getById(entry.id);
    return g || { id: entry.id, titulo: entry.titulo || '(juego eliminado)', portadaUrl: entry.portadaUrl || '' };
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

  /* ── BUSCADOR PARA AÑADIR ───────────────────────────────── */
  function norm(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  function renderSuggest() {
    var q = norm($('tmbSearch').value.trim());
    var box = $('tmbSuggest');
    if (!q) { box.style.display = 'none'; return; }
    var inPool = {};
    pool.forEach(function (e) { inPool[e.id] = true; });
    var hits = Biblioteca.getAll().filter(function (g) { return !inPool[g.id] && norm(g.titulo).indexOf(q) !== -1; }).slice(0, 8);
    box.innerHTML = hits.length
      ? hits.map(function (g) {
          return '<button type="button" data-add="' + esc(g.id) + '">' + (g.portadaUrl ? '<img src="' + esc(g.portadaUrl) + '" alt="" loading="lazy">' : '') + esc(g.titulo) + '</button>';
        }).join('')
      : '<div class="tmb-empty" style="padding:0.6rem 0.8rem">Sin resultados (o ya está en el bombo)</div>';
    box.style.display = 'block';
  }

  /* ── SORTEO ─────────────────────────────────────────────── */
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

    function finish() {
      drum.classList.remove('tmb-drum--spin');
      showSlot(picked, true);
      winner = picked;
      busy = false;
      renderPool();
      $('tmbResultMeta').textContent = [picked.desarrollador, (picked.plataformas || []).join(' · '), picked.duracion ? '~' + picked.duracion + ' h' : ''].filter(Boolean).join(' — ');
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

    $('tmbGo').addEventListener('click', draw);
    $('tmbSearch').addEventListener('input', renderSuggest);
    document.addEventListener('click', function (e) { if (!e.target.closest('.tmb-search')) $('tmbSuggest').style.display = 'none'; });

    $('tmbSuggest').addEventListener('click', function (e) {
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
