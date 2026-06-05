/* ============================================================
   MEDIA TRACKER — Pendientes (por jugador)
   Version: 20260605c
   ============================================================ */
(function () {
  'use strict';

  var _items      = [];
  var _unsub      = null;
  var _filterGenre = '';
  var _filterYear  = '';
  var _searchQuery = '';
  var _editingId   = null;

  function waitForMT(cb) {
    if (window.MT && window.MT.getDb && window.MT.getDb()) return cb();
    setTimeout(function () { waitForMT(cb); }, 60);
  }

  function init() {
    waitForMT(function () {
      loadItems();
      buildGenreFilter();
      updatePageMeta();
    });

    document.getElementById('searchInput').addEventListener('input', function () {
      _searchQuery = this.value.toLowerCase(); renderGrid();
    });
    document.getElementById('genreFilter').addEventListener('change', function () {
      _filterGenre = this.value; renderGrid();
    });
    document.getElementById('yearFilter').addEventListener('change', function () {
      _filterYear = this.value; renderGrid();
    });
    document.getElementById('clearFilters').addEventListener('click', clearFilters);

    /* Modal */
    document.getElementById('regModalClose').addEventListener('click', closeRegModal);
    document.getElementById('regCancel').addEventListener('click', closeRegModal);
    document.getElementById('regSave').addEventListener('click', saveReg);
    document.getElementById('regModal').addEventListener('click', function (e) {
      if (e.target === this) closeRegModal();
    });

    window.addEventListener('mt:catChange', function () {
      if (_unsub) _unsub();
      loadItems();
      buildGenreFilter();
      updatePageMeta();
    });
  }

  function loadItems() {
    var db  = window.MT.getDb();
    var cat = window.MT.getCat();
    if (_unsub) _unsub();
    _unsub = db.collection('mt_items')
      .where('tipo', '==', cat)
      .onSnapshot(function (snap) {
        _items = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
        _items.sort(function (a, b) {
          return (a.titulo || '').localeCompare(b.titulo || '', 'es', { sensitivity: 'base' });
        });
        renderGrid();
        buildYearFilter();
        window.MT.hideLoading();
      }, function (err) {
        console.error('MT pendientes error:', err);
        window.MT.hideLoading();
      });
  }

  function updatePageMeta() {
    var cat    = window.MT.getCat();
    var titles = { peliculas: 'Pendientes · Películas', series: 'Pendientes · Series', anime: 'Pendientes · Anime' };
    document.getElementById('pageTitle').textContent = titles[cat] || 'Pendientes';
    document.title = 'Refugio 111 — ' + (titles[cat] || 'Pendientes');
  }

  function getPlayer() { return window.MT.getPlayer(); }

  /* Muestra solo ítems donde el jugador tiene estado 'Pendiente'
     o no tiene estado registrado aún */
  function filterItems() {
    var player = getPlayer();
    return _items.filter(function (item) {
      var jInfo  = item.jugadores && item.jugadores[player];
      var estado = jInfo && jInfo.estado ? jInfo.estado.toLowerCase() : '';
      if (estado && estado !== 'pendiente') return false;

      if (_filterGenre && !(item.generos || []).includes(_filterGenre)) return false;
      if (_filterYear && String(item.anio || item.año || '') !== _filterYear) return false;
      if (_searchQuery) {
        var hay = [item.titulo, item.director, item.estudio].join(' ').toLowerCase();
        if ((item.generos || []).length) hay += ' ' + item.generos.join(' ').toLowerCase();
        if (hay.indexOf(_searchQuery) < 0) return false;
      }
      return true;
    });
  }

  function clearFilters() {
    _filterGenre = ''; _filterYear = ''; _searchQuery = '';
    document.getElementById('searchInput').value = '';
    document.getElementById('genreFilter').value = '';
    document.getElementById('yearFilter').value  = '';
    renderGrid();
  }

  function buildGenreFilter() {
    var cat    = window.MT.getCat();
    var genres = window.MT.GENEROS[cat] || [];
    var sel    = document.getElementById('genreFilter');
    sel.innerHTML = '<option value="">🏷 Géneros</option>' +
      genres.map(function (g) { return '<option value="' + g + '">' + g + '</option>'; }).join('');
  }

  function buildYearFilter() {
    var years = [...new Set(_items.map(function (i) { return i.anio || i.año; }).filter(Boolean))].sort().reverse();
    var sel   = document.getElementById('yearFilter');
    var cur   = sel.value;
    sel.innerHTML = '<option value="">📅 Año</option>' +
      years.map(function (y) { return '<option value="' + y + '"' + (String(y) === cur ? ' selected' : '') + '>' + y + '</option>'; }).join('');
  }

  /* ── RENDER ─────────────────────────────────────────────── */
  function renderGrid() {
    var grid   = document.getElementById('mtGrid');
    var items  = filterItems();
    var count  = document.getElementById('pageCount');
    var player = getPlayer();

    count.textContent = items.length + ' título' + (items.length !== 1 ? 's' : '') + ' · ' + player;

    if (items.length === 0) {
      grid.innerHTML =
        '<div class="mt-empty">' +
          '<div class="mt-empty__icon">✅</div>' +
          '<div class="mt-empty__title">¡Todo al día!</div>' +
          '<p>' + player + ' no tiene títulos pendientes en esta categoría.</p>' +
        '</div>';
      return;
    }

    grid.innerHTML = items.map(renderCard).join('');
  }

  function renderCard(item) {
    var U      = window.MT.Utils;
    var player = getPlayer();
    var jInfo  = item.jugadores && item.jugadores[player];
    var estado = jInfo && jInfo.estado ? jInfo.estado : null;
    var id     = item.id;

    var cover = item.portadaUrl
      ? '<img src="' + U.escHtml(item.portadaUrl) + '" loading="lazy" onerror="this.style.display=\'none\'">'
      : '<div class="mt-card__cover-ph">' + U.catEmoji(item.tipo) + '</div>';

    var genre = item.generos && item.generos[0]
      ? '<span class="mt-card__genre">' + U.escHtml(item.generos[0]) + '</span>'
      : '';

    var statusLabel = estado || 'Sin registrar';
    var sc = estado ? U.statusClass(estado) : 'sinregistrar';

    return '<div class="mt-card" onclick="window.MTPend.openReg(\'' + id.replace(/'/g, "\\'") + '\')">' +
      '<div class="mt-card__cover">' + cover + '</div>' +
      '<div class="mt-card__body">' +
        '<div class="mt-card__title">' + U.escHtml(item.titulo) + '</div>' +
        '<div class="mt-card__meta">' +
          (item.anio || item.año ? '<span class="mt-card__year">' + (item.anio || item.año) + '</span>' : '') +
          genre +
        '</div>' +
        '<div class="mt-card__reg-status mt-status--' + sc + '">' + U.escHtml(statusLabel) + '</div>' +
      '</div>' +
    '</div>';
  }

  /* ── MODAL REGISTRAR ─────────────────────────────────────── */
  function openReg(id) {
    var item = _items.find(function (i) { return i.id === id; });
    if (!item) return;
    _editingId = id;
    var player  = getPlayer();
    var cat     = window.MT.getCat();
    var estados = window.MT.ESTADOS[cat] || ['Visto', 'Viendo', 'Pendiente', 'Abandonado'];
    var isFilm  = cat === 'peliculas';

    document.getElementById('regModalTitle').textContent = item.titulo;
    document.getElementById('regPlayerRows').innerHTML = ['David', 'Javi', 'Mery'].map(function (p) {
      var info   = item.jugadores && item.jugadores[p] ? item.jugadores[p] : {};
      var estado = info.estado || '';
      var nota   = info.nota !== undefined && info.nota !== null ? info.nota : '';
      var ep     = info.episodio || '';
      var opts   = '<option value="">— Sin estado</option>' +
        estados.map(function (e) {
          return '<option value="' + e + '"' + (e === estado ? ' selected' : '') + '>' + e + '</option>';
        }).join('');
      var activeClass = p === player ? ' mt-player-row--active' : '';
      return '<div class="mt-player-row' + activeClass + '">' +
        '<div class="mt-player-row__avatar mt-player-row__avatar--' + p.toLowerCase() + '">' + p.charAt(0) + '</div>' +
        '<select class="mt-form-select" id="rEstado' + p + '">' + opts + '</select>' +
        '<input type="number" class="mt-form-input" id="rNota' + p + '" value="' + nota + '" placeholder="Nota" min="0" max="10" step="0.5">' +
        (!isFilm ? '<input type="number" class="mt-form-input" id="rEp' + p + '" value="' + ep + '" placeholder="Ep." min="0">' : '') +
      '</div>';
    }).join('');

    document.getElementById('regModal').classList.add('open');
  }

  function closeRegModal() {
    document.getElementById('regModal').classList.remove('open');
    _editingId = null;
  }

  function saveReg() {
    if (!_editingId) return;
    var cat    = window.MT.getCat();
    var isFilm = cat === 'peliculas';
    var jugadores = {};
    ['David', 'Javi', 'Mery'].forEach(function (p) {
      var estado = document.getElementById('rEstado' + p).value;
      var notaEl = document.getElementById('rNota' + p);
      var nota   = notaEl && notaEl.value !== '' ? parseFloat(notaEl.value) : null;
      var epEl   = document.getElementById('rEp' + p);
      var ep     = epEl && epEl.value !== '' ? parseInt(epEl.value) : null;
      jugadores[p] = { estado: estado, nota: nota };
      if (!isFilm) jugadores[p].episodio = ep;
    });
    window.MT.getDb().collection('mt_items').doc(_editingId)
      .update({ jugadores: jugadores })
      .then(closeRegModal);
  }

  window.MTPend = { openReg: openReg };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
