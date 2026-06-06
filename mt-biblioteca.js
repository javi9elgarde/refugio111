/* ============================================================
   MEDIA TRACKER — Biblioteca
   Version: 20260606a
   ============================================================ */
(function () {
  'use strict';

  var _items      = [];
  var _unsub      = null;
  var _editingId  = null;
  var _selGeneros = [];
  var _selPlats   = [];
  var _filterGenre  = '';
  var _filterYear   = '';
  var _searchQuery  = '';

  /* ── ESPERAR MT.init ────────────────────────────────────── */
  function waitForMT(cb) {
    if (window.MT && window.MT.getDb && window.MT.getDb()) return cb();
    setTimeout(function () { waitForMT(cb); }, 60);
  }

  /* ── INIT ───────────────────────────────────────────────── */
  function init() {
    waitForMT(function () {
      loadItems();
      updatePageMeta();
    });

    /* Modales */
    document.getElementById('btnAdd').addEventListener('click', openAddModal);
    document.getElementById('fabAdd').addEventListener('click', openAddModal);
    document.getElementById('editModalClose').addEventListener('click', closeEditModal);
    document.getElementById('btnCancel').addEventListener('click', closeEditModal);
    document.getElementById('btnSave').addEventListener('click', saveItem);
    document.getElementById('btnDelete').addEventListener('click', deleteItem);
    document.getElementById('detailClose').addEventListener('click', closeDetailModal);
    document.getElementById('detailEdit').addEventListener('click', function () {
      closeDetailModal();
      openEditModal(_editingId);
    });
    document.getElementById('editModal').addEventListener('click', function (e) {
      if (e.target === this) closeEditModal();
    });
    document.getElementById('detailModal').addEventListener('click', function (e) {
      if (e.target === this) closeDetailModal();
    });

    /* Filtros */
    document.getElementById('searchInput').addEventListener('input', function () {
      _searchQuery = this.value.toLowerCase();
      renderGrid();
    });
    document.getElementById('genreFilter').addEventListener('change', function () {
      _filterGenre = this.value; renderGrid();
    });
    document.getElementById('yearFilter').addEventListener('change', function () {
      _filterYear = this.value; renderGrid();
    });
    document.getElementById('clearFilters').addEventListener('click', clearFilters);

    /* Escuchar cambios de categoría */
    window.addEventListener('mt:catChange', function () {
      if (_unsub) _unsub();
      _filterGenre = ''; _filterYear = ''; _searchQuery = '';
      loadItems();
      updatePageMeta();
      closeEditModal();
      closeDetailModal();
    });
  }

  /* ── CARGAR ITEMS ───────────────────────────────────────── */
  function loadItems() {
    var db  = window.MT.getDb();
    var cat = window.MT.getCat();
    if (_unsub) _unsub();
    _unsub = db.collection('mt_items')
      .where('tipo', '==', cat)
      .onSnapshot(function (snap) {
        _items = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
        _items.sort(function (a, b) { return (a.titulo || '').localeCompare(b.titulo || '', 'es', { sensitivity: 'base' }); });
        buildFilters();
        renderGrid();
        buildYearFilter();
        window.MT.hideLoading();
      }, function (err) {
        console.error('MT items error:', err);
        window.MT.hideLoading();
      });
  }

  /* ── METADATA DE PÁGINA ─────────────────────────────────── */
  function updatePageMeta() {
    var cat    = window.MT.getCat();
    var titles = { peliculas: '🎬 Películas', series: '📺 Series', anime: '🌸 Anime' };
    document.getElementById('pageTitle').textContent      = titles[cat] || '🎬';
    document.getElementById('editModalTitle').textContent = 'Añadir ' + (cat === 'peliculas' ? 'Película' : cat === 'series' ? 'Serie' : 'Anime');
    document.title = 'Refugio 111 — ' + (titles[cat] || 'Media');

    var isFilm = cat === 'peliculas';
    document.getElementById('labelDirector').textContent              = isFilm ? 'Director' : 'Estudio';
    document.getElementById('groupDuracion').style.display            = isFilm ? '' : 'none';
    document.getElementById('groupNumTemporadas').style.display       = isFilm ? 'none' : '';
    document.getElementById('groupEpisodios').style.display           = isFilm ? 'none' : '';
    document.getElementById('groupPlataforma').style.display          = isFilm ? 'none' : '';
    document.getElementById('fDirector').placeholder = isFilm ? 'Ej: Denis Villeneuve' : 'Ej: MAPPA, Toei';
  }

  /* ── RENDER GRID ────────────────────────────────────────── */
  function renderGrid() {
    var grid  = document.getElementById('mtGrid');
    var items = filterItems();
    var count = document.getElementById('pageCount');

    count.textContent = items.length + ' título' + (items.length !== 1 ? 's' : '');

    if (items.length === 0) {
      grid.innerHTML =
        '<div class="mt-empty">' +
          '<div class="mt-empty__icon">' + window.MT.Utils.catEmoji(window.MT.getCat()) + '</div>' +
          '<div class="mt-empty__title">No se encontraron títulos</div>' +
          '<p>Prueba a cambiar los filtros o añade el primero.</p>' +
        '</div>';
      return;
    }

    grid.innerHTML = items.map(renderCard).join('');
  }

  /* ── FILTROS ─────────────────────────────────────────────── */
  function filterItems() {
    return _items.filter(function (item) {
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

  /* ── RENDER CARD ─────────────────────────────────────────── */
  function renderCard(item) {
    var U    = window.MT.Utils;
    var nota = item.temporadas && item.temporadas.length
      ? U.calcNotaTemporadasGlobal(item.temporadas)
      : U.calcNotaMedia(item.jugadores);
    var color = nota !== null ? U.notaColor(nota) : null;
    var id    = item.id;

    var scoreBadge = nota !== null
      ? '<div class="mt-card__score" style="color:' + color + '">' + U.formatNota(nota) + '</div>'
      : '';

    var cover = item.portadaUrl
      ? '<img src="' + U.escHtml(item.portadaUrl) + '" loading="lazy" onerror="this.style.display=\'none\'">'
      : '<div class="mt-card__cover-ph">' + U.catEmoji(item.tipo) + '</div>';

    /* Player status dots */
    var dots = ['David', 'Javi', 'Mery'].map(function (p) {
      var est = item.temporadas && item.temporadas.length
        ? U.calcEstadoTemporadasPlayer(item.temporadas, p)
        : (item.jugadores && item.jugadores[p] && item.jugadores[p].estado);
      return '<div class="mt-card__dot ' + U.playerDotClass(est) + '" title="' + p + ': ' + U.escHtml(est || 'sin estado') + '"></div>';
    }).join('');

    var genre = item.generos && item.generos[0] ? '<span class="mt-card__genre">' + U.escHtml(item.generos[0]) + '</span>' : '';

    return '<div class="mt-card" onclick="window.MT_Bib.openDetail(\'' + id.replace(/'/g, "\\'") + '\')">' +
      '<div class="mt-card__cover">' +
        cover + scoreBadge +
        '<div class="mt-card__players">' + dots + '</div>' +
      '</div>' +
      '<div class="mt-card__body">' +
        '<div class="mt-card__title">' + U.escHtml(item.titulo) + '</div>' +
        '<div class="mt-card__meta">' +
          (item.anio || item.año ? '<span class="mt-card__year">' + (item.anio || item.año) + '</span>' : '') +
          genre +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ── BUILD FILTERS ───────────────────────────────────────── */
  function buildFilters() {
    var cat    = window.MT.getCat();
    var genres;
    if (cat === 'peliculas') {
      genres = (window.MT.GENEROS[cat] || []).slice();
    } else {
      /* Para series/anime: géneros dinámicos desde los items (TMDB puede traer cualquiera) */
      genres = [];
      _items.forEach(function (item) {
        (item.generos || []).forEach(function (g) {
          if (g && genres.indexOf(g) < 0) genres.push(g);
        });
      });
      genres.sort();
    }
    var sel = document.getElementById('genreFilter');
    var cur = sel.value;
    sel.innerHTML = '<option value="">🏷 Géneros</option>' +
      genres.map(function (g) {
        return '<option value="' + g + '"' + (g === cur ? ' selected' : '') + '>' + g + '</option>';
      }).join('');
    if (cur && !genres.includes(cur)) _filterGenre = '';
  }

  function buildYearFilter() {
    var years = [...new Set(_items.map(function (i) { return i.anio || i.año; }).filter(Boolean))].sort().reverse();
    var sel   = document.getElementById('yearFilter');
    var cur   = sel.value;
    sel.innerHTML = '<option value="">📅 Año</option>' +
      years.map(function (y) { return '<option value="' + y + '"' + (String(y) === cur ? ' selected' : '') + '>' + y + '</option>'; }).join('');
  }

  /* ── DETALLE ─────────────────────────────────────────────── */
  function openDetail(id) {
    var item = _items.find(function (i) { return i.id === id; });
    if (!item) return;
    _editingId = id;

    var U    = window.MT.Utils;
    var nota = item.temporadas && item.temporadas.length
      ? U.calcNotaTemporadasGlobal(item.temporadas)
      : U.calcNotaMedia(item.jugadores);
    var color = nota !== null ? U.notaColor(nota) : null;

    document.getElementById('detailTitle').textContent = item.titulo;

    var coverHtml = item.portadaUrl
      ? '<img src="' + U.escHtml(item.portadaUrl) + '" onerror="this.style.display=\'none\'">'
      : '<div class="mt-detail-cover__ph">' + U.catEmoji(item.tipo) + '</div>';

    var scoreBadge = nota !== null
      ? '<div class="mt-detail-score" style="--sc:' + color + '">' +
          '<div class="mt-detail-score__val" style="color:' + color + '">' + U.formatNota(nota) + '</div>' +
          '<div class="mt-detail-score__lbl">NOTA MEDIA</div>' +
        '</div>'
      : '';

    var badges = (item.generos || []).map(function (g) {
      return '<span class="mt-badge mt-badge--genre">' + U.escHtml(g) + '</span>';
    }).join('');
    if (item.anio || item.año) badges += '<span class="mt-badge mt-badge--year">📅 ' + (item.anio || item.año) + '</span>';

    var stats = '';
    if (item.director)     stats += '<div class="mt-detail-stat"><div class="mt-detail-stat__lbl">DIRECTOR</div><div class="mt-detail-stat__val">' + U.escHtml(item.director) + '</div></div>';
    if (item.estudio)      stats += '<div class="mt-detail-stat"><div class="mt-detail-stat__lbl">ESTUDIO</div><div class="mt-detail-stat__val">' + U.escHtml(item.estudio) + '</div></div>';
    var numTemp = item.numTemporadas || (item.temporadas ? item.temporadas.length : null) || item.duracion;
    if (numTemp && item.tipo !== 'peliculas') {
      stats += '<div class="mt-detail-stat"><div class="mt-detail-stat__lbl">TEMPORADAS</div><div class="mt-detail-stat__val">' + numTemp + '</div></div>';
    } else if (item.duracion && item.tipo === 'peliculas') {
      stats += '<div class="mt-detail-stat"><div class="mt-detail-stat__lbl">DURACIÓN</div><div class="mt-detail-stat__val">' + item.duracion + ' min</div></div>';
    }
    if (item.episodios)    stats += '<div class="mt-detail-stat"><div class="mt-detail-stat__lbl">EPISODIOS</div><div class="mt-detail-stat__val">' + item.episodios + '</div></div>';
    if (item.plataforma)   stats += '<div class="mt-detail-stat"><div class="mt-detail-stat__lbl">PLATAFORMA</div><div class="mt-detail-stat__val">' + U.escHtml(item.plataforma) + '</div></div>';

    /* Player rows: temporadas o jugadores clásico */
    var playersHtml;
    if (item.temporadas && item.temporadas.length) {
      playersHtml = ['David', 'Javi', 'Mery'].map(function (p) {
        var estadoP = U.calcEstadoTemporadasPlayer(item.temporadas, p) || 'Sin estado';
        var sc      = U.statusClass(estadoP);
        var notaP   = U.calcNotaTemporadasPlayer(item.temporadas, p);
        var nc      = notaP !== null ? U.notaColor(notaP) : 'var(--txt3)';
        var nVistas = item.temporadas.filter(function (t) {
          var e = (t.jugadores && t.jugadores[p] && t.jugadores[p].estado) || '';
          var en = e.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
          return en === 'terminado' || en === 'terminada';
        }).length;
        var tempInfo = nVistas > 0 ? ' · ' + nVistas + '/' + item.temporadas.length + ' T' : '';
        return '<div class="mt-detail-player">' +
          '<div class="mt-detail-player__avatar mt-detail-player__avatar--' + p.toLowerCase() + '">' + p.charAt(0) + '</div>' +
          '<div class="mt-detail-player__name">' + p + '</div>' +
          '<span class="mt-detail-player__status mt-status--' + sc + '">' + U.escHtml(estadoP) + tempInfo + '</span>' +
          (notaP !== null ? '<div class="mt-detail-player__nota" style="color:' + nc + '">' + U.formatNota(notaP) + '</div>' : '') +
        '</div>';
      }).join('');
    } else {
      playersHtml = ['David', 'Javi', 'Mery'].map(function (p) {
        var jInfo  = item.jugadores && item.jugadores[p];
        var estadoP = jInfo && jInfo.estado ? jInfo.estado : 'Sin estado';
        var sc      = U.statusClass(estadoP);
        var notaP   = jInfo && jInfo.nota !== null && jInfo.nota !== undefined && jInfo.nota !== '' ? jInfo.nota : null;
        var nc      = notaP !== null ? U.notaColor(notaP) : 'var(--txt3)';
        var ep      = jInfo && jInfo.episodio ? ' · Ep. ' + jInfo.episodio : '';
        return '<div class="mt-detail-player">' +
          '<div class="mt-detail-player__avatar mt-detail-player__avatar--' + p.toLowerCase() + '">' + p.charAt(0) + '</div>' +
          '<div class="mt-detail-player__name">' + p + '</div>' +
          '<span class="mt-detail-player__status mt-status--' + sc + '">' + U.escHtml(estadoP) + ep + '</span>' +
          (notaP !== null ? '<div class="mt-detail-player__nota" style="color:' + nc + '">' + U.formatNota(notaP) + '</div>' : '') +
        '</div>';
      }).join('');
    }

    document.getElementById('detailBody').innerHTML =
      '<div class="mt-detail-cover">' + coverHtml + scoreBadge + '</div>' +
      (badges ? '<div class="mt-detail-badges">' + badges + '</div>' : '') +
      (stats  ? '<div class="mt-detail-stats">'  + stats  + '</div>' : '') +
      '<div class="mt-detail-players">' + playersHtml + '</div>';

    document.getElementById('detailModal').classList.add('open');
  }

  function closeDetailModal() {
    document.getElementById('detailModal').classList.remove('open');
  }

  /* ── MODAL ADD / EDIT ────────────────────────────────────── */
  function openAddModal() {
    _editingId = null;
    var cat = window.MT.getCat();
    document.getElementById('editModalTitle').textContent =
      'Añadir ' + (cat === 'peliculas' ? 'Película' : cat === 'series' ? 'Serie' : 'Anime');
    document.getElementById('fId').value           = '';
    document.getElementById('fTitulo').value       = '';
    document.getElementById('fPortada').value      = '';
    document.getElementById('fDirector').value     = '';
    document.getElementById('fAnio').value         = '';
    document.getElementById('fDuracion').value     = '';
    document.getElementById('fNumTemporadas').value= '';
    document.getElementById('fEpisodios').value    = '';
    _selGeneros = []; _selPlats = [];
    document.getElementById('btnDelete').style.display = 'none';
    buildChips();
    document.getElementById('editModal').classList.add('open');
    document.getElementById('fTitulo').focus();
  }

  function openEditModal(id) {
    var item = _items.find(function (i) { return i.id === id; });
    if (!item) { openAddModal(); return; }
    _editingId = id;
    var cat = window.MT.getCat();
    document.getElementById('editModalTitle').textContent =
      'Editar ' + (cat === 'peliculas' ? 'Película' : cat === 'series' ? 'Serie' : 'Anime');
    document.getElementById('fId').value           = id;
    document.getElementById('fTitulo').value       = item.titulo  || '';
    document.getElementById('fPortada').value      = item.portadaUrl || '';
    document.getElementById('fDirector').value     = item.director || item.estudio || '';
    document.getElementById('fAnio').value         = item.anio || item.año || '';
    document.getElementById('fDuracion').value     = item.duracion || '';
    document.getElementById('fNumTemporadas').value= item.numTemporadas || (item.temporadas ? item.temporadas.length : '') || '';
    document.getElementById('fEpisodios').value    = item.episodios || '';
    _selGeneros = (item.generos   || []).slice();
    _selPlats   = item.plataforma ? [item.plataforma] : [];
    document.getElementById('btnDelete').style.display = 'inline-flex';
    buildChips();
    document.getElementById('editModal').classList.add('open');
  }

  function closeEditModal() {
    document.getElementById('editModal').classList.remove('open');
    _editingId = null;
  }

  /* ── CHIPS GÉNEROS/PLATAFORMAS ───────────────────────────── */
  function buildChips() {
    var cat   = window.MT.getCat();
    var plats = window.MT.PLATAFORMAS[cat] || [];
    var genres;

    if (cat === 'peliculas') {
      genres = (window.MT.GENEROS[cat] || []).slice();
    } else {
      /* Series/anime: dinámico desde items + selección actual */
      genres = [];
      _items.forEach(function (item) {
        (item.generos || []).forEach(function (g) {
          if (g && genres.indexOf(g) < 0) genres.push(g);
        });
      });
      _selGeneros.forEach(function (g) {
        if (g && genres.indexOf(g) < 0) genres.push(g);
      });
      genres.sort();
      /* Si no hay géneros aún, usar lista de respaldo */
      if (!genres.length) genres = (window.MT.GENEROS[cat] || []).slice();
    }

    var gEl = document.getElementById('generoChips');
    gEl.innerHTML = genres.map(function (g) {
      var active = _selGeneros.indexOf(g) >= 0 ? ' active' : '';
      return '<div class="mt-chip' + active + '" onclick="window.MT_Bib._toggleChip(\'g\',this,\'' + escHtml(g) + '\')">' + escHtml(g) + '</div>';
    }).join('');

    var pEl = document.getElementById('plataformaChips');
    pEl.innerHTML = plats.map(function (p) {
      var active = _selPlats.indexOf(p) >= 0 ? ' active' : '';
      return '<div class="mt-chip' + active + '" onclick="window.MT_Bib._toggleChip(\'p\',this,\'' + escHtml(p) + '\')">' + escHtml(p) + '</div>';
    }).join('');
  }

  function _toggleChip(type, el, val) {
    el.classList.toggle('active');
    var arr = type === 'g' ? _selGeneros : _selPlats;
    var idx = arr.indexOf(val);
    if (idx >= 0) arr.splice(idx, 1); else arr.push(val);
    if (type === 'p' && _selPlats.length > 1) {
      _selPlats = [val];
      document.querySelectorAll('#plataformaChips .mt-chip').forEach(function (c) {
        c.classList.toggle('active', c.textContent === val);
      });
    }
  }

  /* ── GUARDAR ITEM ────────────────────────────────────────── */
  function saveItem() {
    var titulo = document.getElementById('fTitulo').value.trim();
    if (!titulo) { document.getElementById('fTitulo').focus(); return; }

    var cat    = window.MT.getCat();
    var isFilm = cat === 'peliculas';
    var dirKey = isFilm ? 'director' : 'estudio';

    var data = {
      tipo      : cat,
      titulo    : titulo,
      portadaUrl: document.getElementById('fPortada').value.trim() || null,
      anio      : parseInt(document.getElementById('fAnio').value) || null,
      generos   : _selGeneros.slice()
    };
    data[dirKey] = document.getElementById('fDirector').value.trim() || null;

    if (isFilm) {
      data.duracion = parseFloat(document.getElementById('fDuracion').value) || null;
    } else {
      data.plataforma = _selPlats[0] || null;
      data.episodios  = parseInt(document.getElementById('fEpisodios').value) || null;
      var numTemp = parseInt(document.getElementById('fNumTemporadas').value) || 0;
      data.numTemporadas = numTemp || null;

      if (!_editingId) {
        /* Item nuevo: crear array de temporadas vacías */
        data.temporadas = [];
        for (var t = 1; t <= numTemp; t++) {
          data.temporadas.push({
            num: t, episodios: null,
            jugadores: {
              David: { estado: '', nota: null },
              Javi:  { estado: '', nota: null },
              Mery:  { estado: '', nota: null }
            }
          });
        }
      } else if (numTemp > 0) {
        /* Editando: ampliar temporadas si hace falta, nunca borrar */
        var existingItem = _items.find(function (i) { return i.id === _editingId; });
        var existingTemps = (existingItem && existingItem.temporadas) ? existingItem.temporadas.slice() : [];
        while (existingTemps.length < numTemp) {
          var nextNum = existingTemps.length + 1;
          existingTemps.push({
            num: nextNum, episodios: null,
            jugadores: {
              David: { estado: '', nota: null },
              Javi:  { estado: '', nota: null },
              Mery:  { estado: '', nota: null }
            }
          });
        }
        data.temporadas = existingTemps;
      }
    }

    var db = window.MT.getDb();
    if (_editingId) {
      db.collection('mt_items').doc(_editingId).update(data).then(closeEditModal);
    } else {
      data.createdAt = window.firebase.firestore.FieldValue.serverTimestamp();
      db.collection('mt_items').add(data).then(closeEditModal);
    }
  }

  /* ── ELIMINAR ITEM ───────────────────────────────────────── */
  function deleteItem() {
    if (!_editingId) return;
    if (!confirm('¿Eliminar este título?')) return;
    window.MT.getDb().collection('mt_items').doc(_editingId).delete().then(closeEditModal);
  }

  function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  /* ── EXPOSE ──────────────────────────────────────────────── */
  window.MT_Bib = {
    openDetail   : openDetail,
    openEditModal: openEditModal,
    _toggleChip  : _toggleChip
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
