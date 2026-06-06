/* ============================================================
   MEDIA TRACKER — Registro (vista personal por jugador)
   Version: 20260606e
   ============================================================ */
(function () {
  'use strict';

  var _items        = [];
  var _unsub        = null;
  var _filterStatus = '';
  var _filterYear   = '';
  var _searchQuery  = '';
  var _editingId    = null;

  function waitForMT(cb) {
    if (window.MT && window.MT.getDb && window.MT.getDb()) return cb();
    setTimeout(function () { waitForMT(cb); }, 60);
  }

  function init() {
    waitForMT(function () {
      loadItems();
      updatePageMeta();
    });

    document.getElementById('searchInput').addEventListener('input', function () {
      _searchQuery = this.value.toLowerCase(); renderGrid();
    });
    document.getElementById('statusFilter').addEventListener('change', function () {
      _filterStatus = this.value; renderGrid();
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
      _filterStatus = ''; _filterYear = ''; _searchQuery = '';
      loadItems();
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
          var ya = a.anio || a.año || 9999;
          var yb = b.anio || b.año || 9999;
          if (ya !== yb) return ya - yb;
          return (a.titulo || '').localeCompare(b.titulo || '', 'es', { sensitivity: 'base' });
        });
        renderGrid();
        buildYearFilter();
        window.MT.hideLoading();
      }, function (err) {
        console.error('MT registro error:', err);
        window.MT.hideLoading();
      });
  }

  function updatePageMeta() {
    var cat    = window.MT.getCat();
    var titles = { peliculas: 'Registro · Películas', series: 'Registro · Series', anime: 'Registro · Anime' };
    document.getElementById('pageTitle').textContent = titles[cat] || 'Registro';
    document.title = 'Refugio 111 — ' + (titles[cat] || 'Registro');
  }

  function getPlayer() { return window.MT.getPlayer(); }

  function filterItems() {
    var player = getPlayer();
    var U      = window.MT.Utils;
    return _items.filter(function (item) {
      var estado;
      if (item.temporadas && item.temporadas.length) {
        estado = U.calcEstadoTemporadasPlayer(item.temporadas, player) || '';
      } else {
        var jInfo = item.jugadores && item.jugadores[player];
        estado = jInfo && jInfo.estado ? jInfo.estado : '';
      }

      if (_filterStatus) {
        var sc = U.statusClass(estado);
        if (sc.indexOf(_filterStatus) < 0 && _filterStatus.indexOf(sc) < 0) return false;
      }
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
    _filterStatus = ''; _filterYear = ''; _searchQuery = '';
    document.getElementById('searchInput').value  = '';
    document.getElementById('statusFilter').value = '';
    document.getElementById('yearFilter').value   = '';
    renderGrid();
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
          '<div class="mt-empty__icon">' + window.MT.Utils.catEmoji(window.MT.getCat()) + '</div>' +
          '<div class="mt-empty__title">No se encontraron títulos</div>' +
          '<p>Prueba a cambiar los filtros.</p>' +
        '</div>';
      return;
    }

    grid.innerHTML = items.map(renderCard).join('');
  }

  function renderCard(item) {
    var U      = window.MT.Utils;
    var player = getPlayer();
    var nota, estado, sc;

    if (item.temporadas && item.temporadas.length) {
      nota   = U.calcNotaTemporadasPlayer(item.temporadas, player);
      estado = U.calcEstadoTemporadasPlayer(item.temporadas, player) || null;
    } else {
      var jInfo = item.jugadores && item.jugadores[player];
      estado = jInfo && jInfo.estado ? jInfo.estado : null;
      nota   = jInfo && jInfo.nota !== null && jInfo.nota !== undefined && jInfo.nota !== '' ? parseFloat(jInfo.nota) : null;
    }

    sc = estado ? U.statusClass(estado) : 'sinregistrar';
    var color = nota !== null ? U.notaColor(nota) : null;
    var id    = item.id;

    var scoreBadge = nota !== null
      ? '<div class="mt-card__score" style="color:' + color + '">' + U.formatNota(nota) + '</div>'
      : '';

    var cover = item.portadaUrl
      ? '<img src="' + U.escHtml(item.portadaUrl) + '" loading="lazy" onerror="this.style.display=\'none\'">'
      : '<div class="mt-card__cover-ph">' + U.catEmoji(item.tipo) + '</div>';

    var genre = item.generos && item.generos[0]
      ? '<span class="mt-card__genre">' + U.escHtml(item.generos[0]) + '</span>'
      : '';

    var statusLabel = estado || 'Sin registrar';

    return '<div class="mt-card" onclick="window.MTReg.openReg(\'' + id.replace(/'/g, "\\'") + '\')">' +
      '<div class="mt-card__cover">' + cover + scoreBadge + '</div>' +
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
    var hasTemps = !isFilm && item.temporadas && item.temporadas.length;

    document.getElementById('regModalTitle').textContent = item.titulo;

    var html = '';
    if (hasTemps) {
      /* Modal por temporadas */
      html = item.temporadas.map(function (temp) {
        var sep = '<div class="mt-season-sep">Temporada ' + temp.num + '</div>';
        var rows = ['David', 'Javi', 'Mery'].map(function (p) {
          var info   = temp.jugadores && temp.jugadores[p] ? temp.jugadores[p] : {};
          var estado = info.estado || '';
          var nota   = info.nota !== null && info.nota !== undefined && info.nota !== '' ? info.nota : '';
          var opts   = '<option value="">— Sin estado</option>' +
            estados.map(function (e) {
              return '<option value="' + e + '"' + (e === estado ? ' selected' : '') + '>' + e + '</option>';
            }).join('');
          var activeClass = p === player ? ' mt-player-row--active' : '';
          return '<div class="mt-player-row' + activeClass + '">' +
            '<div class="mt-player-row__avatar mt-player-row__avatar--' + p.toLowerCase() + '">' + p.charAt(0) + '</div>' +
            '<select class="mt-form-select" id="rT' + temp.num + 'Estado' + p + '">' + opts + '</select>' +
            '<input type="number" class="mt-form-input" id="rT' + temp.num + 'Nota' + p + '" value="' + nota + '" placeholder="Nota" min="0" max="10" step="0.5">' +
          '</div>';
        }).join('');
        return sep + rows;
      }).join('');
    } else {
      /* Modal clásico (películas o series legacy sin temporadas) */
      html = ['David', 'Javi', 'Mery'].map(function (p) {
        var info   = item.jugadores && item.jugadores[p] ? item.jugadores[p] : {};
        var estado = info.estado || '';
        var nota   = info.nota !== null && info.nota !== undefined && info.nota !== '' ? info.nota : '';
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
    var item = _items.find(function (i) { return i.id === _editingId; });
    if (!item) return;

    var cat    = window.MT.getCat();
    var isFilm = cat === 'peliculas';
    var hasTemps = !isFilm && item.temporadas && item.temporadas.length;

    if (hasTemps) {
      /* Guardar temporadas */
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
      /* Guardar jugadores clásico */
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

  window.MTReg = { openReg: openReg };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
