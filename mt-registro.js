/* ============================================================
   MEDIA TRACKER — Registro (vista personal por jugador)
   Version: 20260607a
   ============================================================ */
(function () {
  'use strict';

  var TMDB_KEY  = '2a0181b8eb1bb888042a00f91e10681c';
  var IMG_SMALL = 'https://image.tmdb.org/t/p/w92';
  var IMG_FULL  = 'https://image.tmdb.org/t/p/w500';

  var _items        = [];
  var _unsub        = null;
  var _filterStatus = '';
  var _filterYear   = '';
  var _searchQuery  = '';
  var _editingId    = null;
  var _addData      = null;   // resultado TMDB seleccionado para añadir
  var _tmdbResults  = [];

  function waitForMT(cb) {
    if (window.MT && window.MT.getDb && window.MT.getDb()) return cb();
    setTimeout(function () { waitForMT(cb); }, 60);
  }

  function init() {
    waitForMT(function () {
      loadItems();
      updatePageMeta();
    });

    /* Filtros de lista */
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

    /* Modal editar */
    document.getElementById('regModalClose').addEventListener('click', closeRegModal);
    document.getElementById('regCancel').addEventListener('click', closeRegModal);
    document.getElementById('regSave').addEventListener('click', saveReg);
    document.getElementById('regModal').addEventListener('click', function (e) {
      if (e.target === this) closeRegModal();
    });

    /* Modal añadir */
    document.getElementById('btnAddTitle').addEventListener('click', openAddModal);
    document.getElementById('addModalClose').addEventListener('click', closeAddModal);
    document.getElementById('addCancel').addEventListener('click', closeAddModal);
    document.getElementById('addModal').addEventListener('click', function (e) {
      if (e.target === this) closeAddModal();
    });
    document.getElementById('addSearchBtn').addEventListener('click', doSearchTMDB);
    document.getElementById('addSearchInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') doSearchTMDB();
    });
    document.getElementById('addSave').addEventListener('click', saveAdd);
    document.getElementById('addBackBtn').addEventListener('click', function () {
      showAddStep(1);
      _addData = null;
      document.getElementById('addSave').style.display = 'none';
    });

    window.addEventListener('mt:catChange', function () {
      if (_unsub) _unsub();
      _filterStatus = ''; _filterYear = ''; _searchQuery = '';
      loadItems();
      updatePageMeta();
    });
  }

  /* ── CARGA DATOS ─────────────────────────────────────────── */
  function loadItems() {
    var db  = window.MT.getDb();
    var cat = window.MT.getCat();
    if (_unsub) _unsub();
    _unsub = db.collection('mt_items')
      .where('tipo', '==', cat)
      .onSnapshot(function (snap) {
        _items = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
        _items.sort(function (a, b) {
          function n(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
          var cmp = n(a.saga || a.titulo).localeCompare(n(b.saga || b.titulo), 'es', { sensitivity: 'base' });
          if (cmp !== 0) return cmp;
          var ya = a.anio || a.año || 9999, yb = b.anio || b.año || 9999;
          if (ya !== yb) return ya - yb;
          return n(a.titulo).localeCompare(n(b.titulo), 'es', { sensitivity: 'base' });
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

  /* ── FILTRADO — solo ítems con estado registrado por el jugador ── */
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

      /* Solo mostrar si el jugador tiene un estado explícito */
      if (!estado) return false;

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
    var player = getPlayer();
    var registered = _items.filter(function (item) {
      var jInfo = item.jugadores && item.jugadores[player];
      return jInfo && jInfo.estado;
    });
    var years = Array.from(new Set(registered.map(function (i) { return i.anio || i.año; }).filter(Boolean))).sort().reverse();
    var sel   = document.getElementById('yearFilter');
    var cur   = sel.value;
    sel.innerHTML = '<option value="">📅 Año</option>' +
      years.map(function (y) { return '<option value="' + y + '"' + (String(y) === cur ? ' selected' : '') + '>' + y + '</option>'; }).join('');
  }

  /* ── RENDER GRID ─────────────────────────────────────────── */
  function renderGrid() {
    var grid   = document.getElementById('mtGrid');
    var items  = filterItems();
    var count  = document.getElementById('pageCount');
    var player = getPlayer();

    count.textContent = items.length + ' título' + (items.length !== 1 ? 's' : '') + ' · ' + player;

    if (items.length === 0) {
      var emoji = window.MT.Utils.catEmoji(window.MT.getCat());
      grid.innerHTML =
        '<div class="mt-empty">' +
          '<div class="mt-empty__icon">' + emoji + '</div>' +
          '<div class="mt-empty__title">Tu registro está vacío</div>' +
          '<p>Pulsa <strong>+ Añadir</strong> para registrar tu primera entrada.</p>' +
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

    return '<div class="mt-card" onclick="window.MTReg.openReg(\'' + id.replace(/'/g, "\\'") + '\')">' +
      '<div class="mt-card__cover">' + cover + scoreBadge + '</div>' +
      '<div class="mt-card__body">' +
        '<div class="mt-card__title">' + U.escHtml(item.titulo) + '</div>' +
        '<div class="mt-card__meta">' +
          (item.anio || item.año ? '<span class="mt-card__year">' + (item.anio || item.año) + '</span>' : '') +
          genre +
        '</div>' +
        '<div class="mt-card__reg-status mt-status--' + sc + '">' + U.escHtml(estado || 'Sin registrar') + '</div>' +
      '</div>' +
    '</div>';
  }

  /* ── MODAL EDITAR REGISTRO ───────────────────────────────── */
  function openReg(id) {
    var item = _items.find(function (i) { return i.id === id; });
    if (!item) return;
    _editingId = id;

    var player   = getPlayer();
    var cat      = window.MT.getCat();
    var estados  = window.MT.ESTADOS[cat] || ['Visto', 'Viendo', 'Pendiente', 'Abandonado'];
    var isFilm   = cat === 'peliculas';
    var hasTemps = !isFilm && item.temporadas && item.temporadas.length;

    document.getElementById('regModalTitle').textContent = item.titulo;

    var html = '';
    if (hasTemps) {
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

    var cat      = window.MT.getCat();
    var isFilm   = cat === 'peliculas';
    var hasTemps = !isFilm && item.temporadas && item.temporadas.length;

    if (hasTemps) {
      var temporadas = item.temporadas.map(function (temp) {
        var newJug = {};
        ['David', 'Javi', 'Mery'].forEach(function (p) {
          var estEl  = document.getElementById('rT' + temp.num + 'Estado' + p);
          var notaEl = document.getElementById('rT' + temp.num + 'Nota' + p);
          newJug[p] = {
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

  /* ── MODAL AÑADIR AL REGISTRO ────────────────────────────── */
  function openAddModal() {
    _addData = null;
    _tmdbResults = [];
    document.getElementById('addSearchInput').value = '';
    document.getElementById('addSearchResults').innerHTML = '';
    document.getElementById('addSave').style.display = 'none';
    showAddStep(1);
    document.getElementById('addModal').classList.add('open');
    setTimeout(function () { document.getElementById('addSearchInput').focus(); }, 120);
  }

  function closeAddModal() {
    document.getElementById('addModal').classList.remove('open');
    _addData = null;
  }

  function showAddStep(n) {
    [1, 2, 3, 4].forEach(function (i) {
      var el = document.getElementById('addStep' + i);
      if (el) el.style.display = (i === n) ? '' : 'none';
    });
    var backBtn = document.getElementById('addBackBtn');
    if (backBtn) backBtn.style.display = (n === 2) ? 'block' : 'none';
  }

  function doSearchTMDB() {
    var query = document.getElementById('addSearchInput').value.trim();
    if (!query) return;

    var cat      = window.MT.getCat();
    var endpoint = cat === 'peliculas' ? '/search/movie' : '/search/tv';
    var url      = 'https://api.themoviedb.org/3' + endpoint +
      '?api_key=' + TMDB_KEY + '&language=es-ES&query=' + encodeURIComponent(query);

    var resultsEl = document.getElementById('addSearchResults');
    resultsEl.innerHTML = '<div style="color:var(--txt3);font-size:0.82rem;padding:0.5rem 0">Buscando...</div>';

    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        _tmdbResults = (data.results || []).slice(0, 7);
        if (!_tmdbResults.length) {
          resultsEl.innerHTML = '<div style="color:var(--txt3);font-size:0.82rem;padding:0.5rem 0">No se encontraron resultados.</div>';
          return;
        }
        resultsEl.innerHTML = _tmdbResults.map(function (r, idx) {
          var title  = r.title || r.name || '—';
          var year   = (r.release_date || r.first_air_date || '').slice(0, 4);
          var poster = r.poster_path ? IMG_SMALL + r.poster_path : null;
          var ph     = poster
            ? '<img src="' + escHtml(poster) + '" class="mt-add-result__poster" onerror="this.style.display=\'none\'">'
            : '<div class="mt-add-result__poster"></div>';
          return '<div class="mt-add-result" onclick="window.MTReg._pickResult(' + idx + ')">' +
            ph +
            '<div>' +
              '<div class="mt-add-result__title">' + escHtml(title) + '</div>' +
              '<div class="mt-add-result__meta">' + (year || '—') + '</div>' +
            '</div>' +
          '</div>';
        }).join('');
      })
      .catch(function () {
        resultsEl.innerHTML = '<div style="color:#f87171;font-size:0.82rem;padding:0.5rem 0">Error al buscar. Comprueba la conexión.</div>';
      });
  }

  function pickResult(idx) {
    var r = _tmdbResults[idx];
    if (!r) return;

    var cat      = window.MT.getCat();
    var isFilm   = cat === 'peliculas';
    var detailUrl = 'https://api.themoviedb.org/3' +
      (isFilm ? '/movie/' + r.id + '?append_to_response=credits' : '/tv/' + r.id) +
      '&api_key=' + TMDB_KEY + '&language=es-ES';

    document.getElementById('addSearchResults').innerHTML =
      '<div style="color:var(--txt3);font-size:0.82rem;padding:0.5rem 0">Cargando detalles...</div>';

    fetch(detailUrl)
      .then(function (res) { return res.json(); })
      .then(function (details) {
        if (isFilm) {
          var crew = (details.credits && details.credits.crew) || [];
          var dir  = null;
          for (var i = 0; i < crew.length; i++) {
            if (crew[i].job === 'Director') { dir = crew[i].name; break; }
          }
          _addData = {
            tipo      : cat,
            titulo    : details.title || r.title,
            anio      : r.release_date ? parseInt(r.release_date.slice(0, 4)) : null,
            portadaUrl: r.poster_path ? IMG_FULL + r.poster_path : null,
            director  : dir,
            duracion  : details.runtime || null,
            generos   : (details.genres || []).map(function (g) { return g.name; })
          };
        } else {
          var created = details.created_by && details.created_by.length ? details.created_by[0].name : null;
          var network = details.networks && details.networks.length ? details.networks[0].name : null;
          var seasons = (details.seasons || []).filter(function (s) { return s.season_number > 0; });
          _addData = {
            tipo      : cat,
            titulo    : details.name || r.name,
            anio      : details.first_air_date ? parseInt(details.first_air_date.slice(0, 4)) : null,
            portadaUrl: r.poster_path ? IMG_FULL + r.poster_path : null,
            estudio   : created || network || null,
            generos   : (details.genres || []).map(function (g) { return g.name; }),
            temporadas: seasons.map(function (s) {
              return {
                num      : s.season_number,
                episodios: s.episode_count || null,
                jugadores: {
                  David: { estado: '', nota: null },
                  Javi : { estado: '', nota: null },
                  Mery : { estado: '', nota: null }
                }
              };
            })
          };
        }
        showStep2Form();
      })
      .catch(function () {
        document.getElementById('addSearchResults').innerHTML =
          '<div style="color:#f87171;font-size:0.82rem;padding:0.5rem 0">Error al cargar los detalles.</div>';
      });
  }

  function showStep2Form() {
    if (!_addData) return;
    var player  = getPlayer();
    var cat     = window.MT.getCat();
    var estados = window.MT.ESTADOS[cat] || ['Visto', 'Viendo', 'Pendiente', 'Abandonado'];

    /* Preview del título seleccionado */
    var previewEl = document.getElementById('addItemPreview');
    previewEl.innerHTML =
      (_addData.portadaUrl
        ? '<img src="' + escHtml(_addData.portadaUrl) + '" class="mt-add-preview__poster" onerror="this.style.display=\'none\'">'
        : '<div class="mt-add-preview__poster"></div>') +
      '<div>' +
        '<div class="mt-add-preview__title">' + escHtml(_addData.titulo) + '</div>' +
        '<div class="mt-add-preview__meta">' +
          (_addData.anio || '') +
          (_addData.director ? ' · Dir. ' + escHtml(_addData.director) : (_addData.estudio ? ' · ' + escHtml(_addData.estudio) : '')) +
        '</div>' +
        (_addData.generos && _addData.generos.length
          ? '<div class="mt-add-preview__meta" style="margin-top:0.25rem">' + escHtml(_addData.generos.slice(0, 3).join(' · ')) + '</div>'
          : '') +
      '</div>';

    /* Formulario solo para el jugador actual */
    var opts = '<option value="">— Elige estado</option>' +
      estados.map(function (e) {
        return '<option value="' + e + '"' + (e === 'Pendiente' ? ' selected' : '') + '>' + e + '</option>';
      }).join('');

    document.getElementById('addPlayerRow').innerHTML =
      '<div class="mt-player-row mt-player-row--active">' +
        '<div class="mt-player-row__avatar mt-player-row__avatar--' + player.toLowerCase() + '">' + player.charAt(0) + '</div>' +
        '<select class="mt-form-select" id="addEstado">' + opts + '</select>' +
        '<input type="number" class="mt-form-input" id="addNota" placeholder="Nota (0-10)" min="0" max="10" step="0.5">' +
      '</div>';

    showAddStep(2);
    document.getElementById('addSave').style.display = '';
  }

  function saveAdd() {
    if (!_addData) return;
    var estadoEl = document.getElementById('addEstado');
    var notaEl   = document.getElementById('addNota');
    var estado   = estadoEl ? estadoEl.value : '';
    var nota     = notaEl && notaEl.value !== '' ? parseFloat(notaEl.value) : null;

    if (!estado) {
      if (estadoEl) { estadoEl.style.borderColor = 'var(--accent)'; estadoEl.focus(); }
      return;
    }

    showAddStep(3);
    document.getElementById('addSave').style.display = 'none';
    document.getElementById('addCancel').style.display = 'none';

    var db      = window.MT.getDb();
    var cat     = window.MT.getCat();
    var player  = getPlayer();
    var normNew = normTitle(_addData.titulo);

    /* Comprobar si ya existe en Firestore (por título normalizado) */
    db.collection('mt_items').where('tipo', '==', cat).get()
      .then(function (snap) {
        var existingDoc = null;
        snap.docs.forEach(function (d) {
          if (normTitle(d.data().titulo) === normNew) existingDoc = d;
        });

        if (existingDoc) {
          /* Actualizar solo el campo jugadores[player] del doc existente */
          var update = {};
          update['jugadores.' + player] = { estado: estado, nota: nota };
          return existingDoc.ref.update(update);
        } else {
          /* Crear doc nuevo con todos los metadatos */
          var jugadores = {
            David: { estado: '', nota: null },
            Javi : { estado: '', nota: null },
            Mery : { estado: '', nota: null }
          };
          jugadores[player] = { estado: estado, nota: nota };
          var newDoc = Object.assign({}, _addData, { jugadores: jugadores, creadoEn: new Date() });
          return db.collection('mt_items').add(newDoc);
        }
      })
      .then(function () {
        showAddStep(4);
        document.getElementById('addDoneText').textContent =
          '"' + _addData.titulo + '" añadido al registro de ' + player + ' · ' + estado + '.';
        setTimeout(function () {
          closeAddModal();
          document.getElementById('addCancel').style.display = '';
        }, 2400);
      })
      .catch(function (err) {
        console.error('saveAdd error:', err);
        showAddStep(2);
        document.getElementById('addSave').style.display = '';
        document.getElementById('addCancel').style.display = '';
        alert('Error al guardar. Inténtalo de nuevo.');
      });
  }

  /* ── UTILIDADES ──────────────────────────────────────────── */
  function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function normTitle(s) {
    return (s || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  window.MTReg = {
    openReg    : openReg,
    _pickResult: pickResult
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
