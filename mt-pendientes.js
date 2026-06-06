/* ============================================================
   MEDIA TRACKER — Pendientes (con selector de jugador)
   Version: 20260606e
   ============================================================ */
(function () {
  'use strict';

  var _items       = [];
  var _allItems    = [];
  var _unsub       = null;
  var _filterGenre = '';
  var _filterYear  = '';
  var _searchQuery = '';
  var _editingId   = null;
  var _player      = 'Javi';

  function waitForMT(cb) {
    if (window.MT && window.MT.getDb && window.MT.getDb()) return cb();
    setTimeout(function () { waitForMT(cb); }, 60);
  }

  function init() {
    _player = window.MT ? (window.MT.getPlayer() || 'Javi') : 'Javi';

    waitForMT(function () {
      loadItems();
      updatePageMeta();
    });

    /* Selector de jugador */
    document.querySelectorAll('.mt-psel__card').forEach(function (card) {
      card.addEventListener('click', function () {
        _player = this.dataset.player;
        updatePlayerSelector();
        updatePageMeta();
        renderGrid();
      });
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

    document.getElementById('regModalClose').addEventListener('click', closeRegModal);
    document.getElementById('regCancel').addEventListener('click', closeRegModal);
    document.getElementById('regSave').addEventListener('click', saveReg);
    document.getElementById('regModal').addEventListener('click', function (e) {
      if (e.target === this) closeRegModal();
    });

    window.addEventListener('mt:catChange', function () {
      if (_unsub) _unsub();
      _filterGenre = ''; _filterYear = ''; _searchQuery = '';
      loadItems();
      updatePageMeta();
    });

    updatePlayerSelector();
  }

  function updatePlayerSelector() {
    document.querySelectorAll('.mt-psel__card').forEach(function (card) {
      card.classList.toggle('mt-psel__card--active', card.dataset.player === _player);
    });
  }

  function loadItems() {
    var db  = window.MT.getDb();
    var cat = window.MT.getCat();
    if (_unsub) _unsub();
    _unsub = db.collection('mt_items')
      .where('tipo', '==', cat)
      .onSnapshot(function (snap) {
        _allItems = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
        _allItems.sort(function (a, b) {
          var ya = a.anio || a.año || 9999;
          var yb = b.anio || b.año || 9999;
          if (ya !== yb) return ya - yb;
          return (a.titulo || '').localeCompare(b.titulo || '', 'es', { sensitivity: 'base' });
        });
        buildGenreFilter();
        updateCounts();
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

  /* ── ESTADO PENDIENTE para un jugador ─────────────────────── */
  function isPendiente(item, player) {
    var U = window.MT.Utils;
    var estado;
    if (item.temporadas && item.temporadas.length) {
      estado = U.calcEstadoTemporadasPlayer(item.temporadas, player) || '';
    } else {
      var jInfo = item.jugadores && item.jugadores[player];
      estado = jInfo && jInfo.estado ? jInfo.estado : '';
    }
    var norm = (estado || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
    return !norm || norm === 'pendiente';
  }

  /* Cuenta pendientes por jugador para los badges */
  function updateCounts() {
    ['David', 'Javi', 'Mery'].forEach(function (p) {
      var n  = _allItems.filter(function (item) { return isPendiente(item, p); }).length;
      var el = document.getElementById('pselCount-' + p);
      if (el) el.textContent = n + ' pendiente' + (n !== 1 ? 's' : '');
    });
  }

  function filterItems() {
    return _allItems.filter(function (item) {
      if (!isPendiente(item, _player)) return false;
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
    var cat = window.MT.getCat();
    var genres;
    if (cat === 'peliculas') {
      genres = (window.MT.GENEROS[cat] || []).slice();
    } else {
      genres = [];
      _allItems.forEach(function (item) {
        (item.generos || []).forEach(function (g) {
          if (g && genres.indexOf(g) < 0) genres.push(g);
        });
      });
      genres.sort();
      if (!genres.length) genres = (window.MT.GENEROS[cat] || []).slice();
    }
    var sel = document.getElementById('genreFilter');
    var cur = sel.value;
    sel.innerHTML = '<option value="">🏷 Géneros</option>' +
      genres.map(function (g) {
        return '<option value="' + g + '"' + (g === cur ? ' selected' : '') + '>' + g + '</option>';
      }).join('');
  }

  function buildYearFilter() {
    var years = [...new Set(_allItems.map(function (i) { return i.anio || i.año; }).filter(Boolean))].sort().reverse();
    var sel   = document.getElementById('yearFilter');
    var cur   = sel.value;
    sel.innerHTML = '<option value="">📅 Año</option>' +
      years.map(function (y) { return '<option value="' + y + '"' + (String(y) === cur ? ' selected' : '') + '>' + y + '</option>'; }).join('');
  }

  function renderGrid() {
    var grid  = document.getElementById('mtGrid');
    var items = filterItems();
    var count = document.getElementById('pageCount');

    count.textContent = items.length + ' título' + (items.length !== 1 ? 's' : '') + ' pendiente' + (items.length !== 1 ? 's' : '') + ' · ' + _player;
    updateCounts();

    if (items.length === 0) {
      grid.innerHTML =
        '<div class="mt-empty">' +
          '<div class="mt-empty__icon">✅</div>' +
          '<div class="mt-empty__title">¡Todo al día!</div>' +
          '<p>' + _player + ' no tiene títulos pendientes aquí.</p>' +
        '</div>';
      return;
    }

    grid.innerHTML = items.map(renderCard).join('');
  }

  function renderCard(item) {
    var U  = window.MT.Utils;
    var id = item.id;

    var cover = item.portadaUrl
      ? '<img src="' + U.escHtml(item.portadaUrl) + '" loading="lazy" onerror="this.style.display=\'none\'">'
      : '<div class="mt-card__cover-ph">' + U.catEmoji(item.tipo) + '</div>';

    var genre = item.generos && item.generos[0]
      ? '<span class="mt-card__genre">' + U.escHtml(item.generos[0]) + '</span>'
      : '';

    return '<div class="mt-card" onclick="window.MTPend.openReg(\'' + id.replace(/'/g, "\\'") + '\')">' +
      '<div class="mt-card__cover">' + cover + '</div>' +
      '<div class="mt-card__body">' +
        '<div class="mt-card__title">' + U.escHtml(item.titulo) + '</div>' +
        '<div class="mt-card__meta">' +
          (item.anio || item.año ? '<span class="mt-card__year">' + (item.anio || item.año) + '</span>' : '') +
          genre +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ── MODAL ───────────────────────────────────────────────── */
  function openReg(id) {
    var item = _allItems.find(function (i) { return i.id === id; });
    if (!item) return;
    _editingId = id;

    var cat     = window.MT.getCat();
    var estados = window.MT.ESTADOS[cat] || ['Visto', 'Viendo', 'Pendiente', 'Abandonado'];
    var isFilm  = cat === 'peliculas';
    var hasTemps = !isFilm && item.temporadas && item.temporadas.length;

    document.getElementById('regModalTitle').textContent = item.titulo;

    var html = '';
    if (hasTemps) {
      html = item.temporadas.map(function (temp) {
        var sep  = '<div class="mt-season-sep">Temporada ' + temp.num + '</div>';
        var rows = ['David', 'Javi', 'Mery'].map(function (p) {
          var info   = temp.jugadores && temp.jugadores[p] ? temp.jugadores[p] : {};
          var estado = info.estado || '';
          var nota   = info.nota !== null && info.nota !== undefined && info.nota !== '' ? info.nota : '';
          var opts   = '<option value="">— Sin estado</option>' +
            estados.map(function (e) {
              return '<option value="' + e + '"' + (e === estado ? ' selected' : '') + '>' + e + '</option>';
            }).join('');
          var activeClass = p === _player ? ' mt-player-row--active' : '';
          return '<div class="mt-player-row' + activeClass + '">' +
            '<div class="mt-player-row__avatar mt-player-row__avatar--' + p.toLowerCase() + '">' + p.charAt(0) + '</div>' +
            '<select class="mt-form-select" id="rT' + temp.num + 'Estado' + p + '">' + opts + '</select>' +
            '<input type="number" class="mt-form-input" id="rT' + temp.num + 'Nota' + p + '" value="' + nota + '" placeholder="Nota" min="0" max="10" step="0.5">' +
          '</div>';
        }).join('');
        return sep + rows;
      }).join('');
    } else {
      html = ['David', 'Javi', 'Mery'].map(function (p) {
        var info   = item.jugadores && item.jugadores[p] ? item.jugadores[p] : {};
        var estado = info.estado || '';
        var nota   = info.nota !== null && info.nota !== undefined && info.nota !== '' ? info.nota : '';
        var ep     = info.episodio || '';
        var opts   = '<option value="">— Sin estado</option>' +
          estados.map(function (e) {
            return '<option value="' + e + '"' + (e === estado ? ' selected' : '') + '>' + e + '</option>';
          }).join('');
        var activeClass = p === _player ? ' mt-player-row--active' : '';
        return '<div class="mt-player-row' + activeClass + '">' +
          '<div class="mt-player-row__avatar mt-player-row__avatar--' + p.toLowerCase() + '">' + p.charAt(0) + '</div>' +
          '<select class="mt-form-select" id="rEstado' + p + '">' + opts + '</select>' +
          '<input type="number" class="mt-form-input" id="rNota' + p + '" value="' + nota + '" placeholder="Nota" min="0" max="10" step="0.5">' +
          (!isFilm ? '<input type="number" class="mt-form-input" id="rEp' + p + '" value="' + ep + '" placeholder="Ep." min="0">' : '') +
        '</div>';
      }).join('');
    }

    document.getElementById('regPlayerRows').innerHTML = html;
    document.getElementById('regModal').classList.add('open');
  }

  function closeRegModal() {
    document.getElementById('regModal').classList.remove('open');
    _editingId = null;
  }

  function saveReg() {
    if (!_editingId) return;
    var item = _allItems.find(function (i) { return i.id === _editingId; });
    if (!item) return;

    var cat    = window.MT.getCat();
    var isFilm = cat === 'peliculas';
    var hasTemps = !isFilm && item.temporadas && item.temporadas.length;

    if (hasTemps) {
      var temporadas = item.temporadas.map(function (temp) {
        var newJug = {};
        ['David', 'Javi', 'Mery'].forEach(function (p) {
          var estEl  = document.getElementById('rT' + temp.num + 'Estado' + p);
          var notaEl = document.getElementById('rT' + temp.num + 'Nota' + p);
          newJug[p]  = {
            estado: estEl  ? estEl.value : (temp.jugadores && temp.jugadores[p] ? temp.jugadores[p].estado : ''),
            nota  : notaEl && notaEl.value !== '' ? parseFloat(notaEl.value) : null
          };
        });
        return Object.assign({}, temp, { jugadores: newJug });
      });
      window.MT.getDb().collection('mt_items').doc(_editingId)
        .update({ temporadas: temporadas })
        .then(closeRegModal);
    } else {
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
  }

  window.MTPend = { openReg: openReg };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
