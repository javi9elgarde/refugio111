/* ============================================================
   GAMETRACKER — Importar varios juegos desde IGDB o RAWG
   ============================================================ */
(function () {
  'use strict';

  var Utils = window.GT.Utils;
  var _results = [];

  function $(id) { return document.getElementById(id); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function normTitle(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  }

  var _fuente = 'IGDB';

  // Nombre exacto → el más popular (evita ports/homónimos viejos). Sin exacto, el primero muy parecido;
  // si ninguno se parece, null: la fuente devolvió otra cosa y es mejor "no encontrado" que un juego equivocado
  function pickBest(hits, titulo) {
    var t = normTitle(titulo);
    var best = function (list) { return list.reduce(function (a, b) { return b.popularity > a.popularity ? b : a; }); };
    var exact = hits.filter(function (h) { return normTitle(h.name) === t; });
    if (exact.length) return best(exact);
    return hits.filter(function (h) {
      var n = normTitle(h.name);
      // contiene (o está contenido) y se parece en longitud: "murals" no debe casar con "Leeroy's House of Floor Murals"
      return (n.indexOf(t) !== -1 || t.indexOf(n) !== -1) && Math.min(n.length, t.length) / Math.max(n.length, t.length) >= 0.5;
    })[0] || null;
  }

  async function buscarJuego(titulo) {
    var src = _fuente === 'IGDB' ? window.GT.Igdb : window.GT.Rawg;
    var hits = await src.lookup(titulo, 8);
    var hit = pickBest(hits, titulo);
    if (!hit) return { titulo: titulo, found: false };
    return Object.assign({ found: true }, await hit.load());
  }

  async function onBuscar() {
    _fuente = document.querySelector('input[name=fuente]:checked').value === 'rawg' ? 'RAWG' : 'IGDB';
    var titles = $('titleInput').value.split('\n').map(function (t) { return t.trim(); }).filter(Boolean);
    if (!titles.length) return;

    $('step1').style.display = 'none';
    $('stepProgress').style.display = '';
    $('progressTotal').textContent = titles.length;
    _results = [];

    for (var i = 0; i < titles.length; i++) {
      $('progressCurrent').textContent = i + 1;
      $('progressTitle').textContent = '🔍 ' + titles[i];
      $('progressBar').style.width = Math.round((i + 1) / titles.length * 100) + '%';
      try { _results.push(await buscarJuego(titles[i])); }
      catch (e) { console.warn('Error buscando:', titles[i], e); _results.push({ titulo: titles[i], found: false }); }
      await sleep(200);
    }

    await new Promise(function (r) { window.GT.onDataReady(r); });
    var existing = new Set(window.GT.Biblioteca.getAll().map(function (g) { return normTitle(g.titulo); }));
    _results.forEach(function (r) { if (r.found) r.duplicate = existing.has(normTitle(r.titulo)); });

    $('stepProgress').style.display = 'none';
    showResults();
  }

  function showResults() {
    var found = _results.filter(function (r) { return r.found; }).length;
    var lost  = _results.length - found;
    $('stepResults').style.display = '';
    $('resTitle').textContent = found + ' encontrados' + (lost ? ' · ' + lost + ' no encontrados' : '');

    $('resultList').innerHTML = _results.map(function (r, idx) {
      if (!r.found) return '<div class="imp-row imp-row--notfound">❌ No encontrado en ' + _fuente + ': <em>' + Utils.escapeHtml(r.titulo) + '</em></div>';
      var tags = (r.fechaLanzamiento ? '<span class="imp-tag">' + Utils.escapeHtml(r.fechaLanzamiento.slice(0, 4)) + '</span>' : '') +
        (r.duracion ? '<span class="imp-tag">~' + r.duracion + ' h</span>' : '') +
        (r.desarrollador ? '<span style="font-size:.72rem;color:var(--txt3)">· ' + Utils.escapeHtml(r.desarrollador) + '</span>' : '');
      var chips = r.generos.map(function (g) { return '<span class="imp-tag imp-tag--genre">' + Utils.escapeHtml(g) + '</span>'; }).join('') +
        r.plataformas.map(function (p) { return '<span class="imp-tag">' + Utils.escapeHtml(p) + '</span>'; }).join('');
      return '<div class="imp-row' + (r.duplicate ? ' imp-row--dup' : '') + '">' +
        '<label><input type="checkbox" class="imp-cb" data-idx="' + idx + '"' + (r.duplicate ? '' : ' checked') + '></label>' +
        '<div class="imp-row__cover">' + (r.portadaUrl ? '<img src="' + Utils.escapeHtml(r.portadaUrl) + '" loading="lazy" alt="">' : '') + '</div>' +
        '<div><div class="imp-row__title">' + Utils.escapeHtml(r.titulo) +
          (r.duplicate ? '<span class="imp-dup-badge">⚠️ Ya en biblioteca</span>' : '') + '</div>' +
          '<div class="imp-row__meta">' + tags + '</div>' +
          '<div class="imp-row__meta">' + chips + '</div></div>' +
      '</div>';
    }).join('');

    document.querySelectorAll('.imp-cb').forEach(function (cb) { cb.addEventListener('change', updateImportBtn); });
    updateImportBtn();
  }

  function updateImportBtn() {
    var n = document.querySelectorAll('.imp-cb:checked').length;
    $('importBtn').textContent = 'Importar ' + n + ' juego' + (n !== 1 ? 's' : '');
    $('importBtn').disabled = n === 0;
  }

  function onImport() {
    var idxs = Array.from(document.querySelectorAll('.imp-cb:checked')).map(function (cb) { return parseInt(cb.dataset.idx); });
    idxs.forEach(function (idx) {
      var r = _results[idx];
      window.GT.Biblioteca.add({
        titulo: r.titulo, portadaUrl: r.portadaUrl, desarrollador: r.desarrollador,
        fechaLanzamiento: r.fechaLanzamiento, duracion: r.duracion, saga: r.saga || '', generos: r.generos, plataformas: r.plataformas,
        pendientePor: [], pendiente: false, tipoLanzamiento: '', earlyAccess: false, hype: 0
      });
    });
    $('stepResults').style.display = 'none';
    $('stepDone').style.display = '';
    $('doneCount').textContent = idxs.length;
  }

  function init() {
    $('btnBuscar').addEventListener('click', onBuscar);
    $('titleInput').addEventListener('input', function () {
      var n = this.value.split('\n').filter(function (l) { return l.trim(); }).length;
      $('btnHint').textContent = n ? n + ' título' + (n !== 1 ? 's' : '') + ' detectado' + (n !== 1 ? 's' : '') : '';
    });
    $('importBtn').addEventListener('click', onImport);
    $('btnVolver').addEventListener('click', function () { $('stepResults').style.display = 'none'; $('step1').style.display = ''; });
    $('btnSelAll').addEventListener('click', function () { document.querySelectorAll('.imp-cb').forEach(function (cb) { cb.checked = true; }); updateImportBtn(); });
    $('btnSelNone').addEventListener('click', function () { document.querySelectorAll('.imp-cb').forEach(function (cb) { cb.checked = false; }); updateImportBtn(); });
    $('btnReset').addEventListener('click', function () { location.reload(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
