/* ============================================================
   MEDIA TRACKER — Registro (vista personal por jugador)
   Version: 20260711a
   - El botón "Añadir" busca en la BIBLIOTECA (no en TMDB).
   - Estados a nivel de título: Películas → Vista/Pendiente ·
     Series y Anime → Viendo/Visto/Pendiente.
   - Nota visual con degradado (rojo 0 → verde 10).
   - Grid organizado en secciones (VISTAS · VIENDO/VISTO).
   ============================================================ */
(function () {
  'use strict';

  var _items       = [];
  var _unsub       = null;
  var _filterYear  = '';
  var _searchQuery = '';
  var _sortBy      = 'alpha';   // 'alpha' | 'nota'
  var _editingId   = null;
  var _addPickId   = null;   // id del ítem de biblioteca elegido para añadir

  function U() { return window.MT.Utils; }

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
    var yf = document.getElementById('yearFilter');
    if (yf) yf.addEventListener('change', function () { _filterYear = this.value; renderGrid(); });
    var so = document.getElementById('sortSelect');
    if (so) so.addEventListener('change', function () { _sortBy = this.value; renderGrid(); });
    var cf = document.getElementById('clearFilters');
    if (cf) cf.addEventListener('click', clearFilters);

    /* Modal editar */
    document.getElementById('regModalClose').addEventListener('click', closeRegModal);
    document.getElementById('regCancel').addEventListener('click', closeRegModal);
    document.getElementById('regSave').addEventListener('click', saveReg);
    document.getElementById('regModal').addEventListener('click', function (e) {
      if (e.target === this) closeRegModal();
    });

    /* Modal añadir (busca en biblioteca) */
    document.getElementById('btnAddTitle').addEventListener('click', openAddModal);
    document.getElementById('addModalClose').addEventListener('click', closeAddModal);
    document.getElementById('addCancel').addEventListener('click', closeAddModal);
    document.getElementById('addModal').addEventListener('click', function (e) {
      if (e.target === this) closeAddModal();
    });
    document.getElementById('addSearchInput').addEventListener('input', function () {
      renderAddResults(this.value);
    });
    document.getElementById('addSave').addEventListener('click', saveAdd);
    document.getElementById('addBackBtn').addEventListener('click', function () {
      showAddStep(1);
      _addPickId = null;
      document.getElementById('addSave').style.display = 'none';
      renderAddResults(document.getElementById('addSearchInput').value);
    });

    window.addEventListener('mt:catChange', function () {
      if (_unsub) _unsub();
      _filterYear = ''; _searchQuery = '';
      var si = document.getElementById('searchInput'); if (si) si.value = '';
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
          var ya = a.anio || a['año'] || 9999, yb = b.anio || b['año'] || 9999;
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

  function itemYear(item) { return item.anio || item['año'] || ''; }

  function clearFilters() {
    _filterYear = ''; _searchQuery = ''; _sortBy = 'alpha';
    document.getElementById('searchInput').value = '';
    var yf = document.getElementById('yearFilter'); if (yf) yf.value = '';
    var so = document.getElementById('sortSelect'); if (so) so.value = 'alpha';
    renderGrid();
  }

  function buildYearFilter() {
    var player = getPlayer();
    var registered = _items.filter(function (item) {
      return !!U().resolvePlayerEstado(item, player);
    });
    var years = Array.from(new Set(registered.map(itemYear).filter(Boolean))).sort().reverse();
    var sel   = document.getElementById('yearFilter');
    if (!sel) return;
    var cur   = sel.value;
    sel.innerHTML = '<option value="">📅 Año</option>' +
      years.map(function (y) { return '<option value="' + y + '"' + (String(y) === cur ? ' selected' : '') + '>' + y + '</option>'; }).join('');
  }

  /* ── FAVORITA para un jugador ────────────────────────────── */
  function isFav(item, player) {
    return !!(item.jugadores && item.jugadores[player] && item.jugadores[player].fav);
  }

  function passesFilters(item) {
    if (_filterYear && String(itemYear(item)) !== _filterYear) return false;
    if (_searchQuery) {
      var hay = [item.titulo, item.director, item.estudio].join(' ').toLowerCase();
      if ((item.generos || []).length) hay += ' ' + item.generos.join(' ').toLowerCase();
      if (hay.indexOf(_searchQuery) < 0) return false;
    }
    return true;
  }

  /* ── ÍTEMS POR SECCIÓN (fav / viendo / visto) ────────────── */
  function itemsForSection(key) {
    var player = getPlayer();
    var u      = U();
    var list = _items.filter(function (item) {
      if (!passesFilters(item)) return false;
      if (key === 'fav') return isFav(item, player);
      /* Los favoritos se muestran solo en su sección, no duplicados */
      if (isFav(item, player)) return false;
      var est = u.resolvePlayerEstado(item, player);
      return est && u.statusClass(est) === key;
    });

    if (_sortBy === 'nota') {
      list = list.slice().sort(function (a, b) {
        var na = u.resolvePlayerNota(a, player);
        var nb = u.resolvePlayerNota(b, player);
        if (na === null && nb === null) return 0;
        if (na === null) return 1;
        if (nb === null) return -1;
        return nb - na;
      });
    }
    return list;
  }

  /* ── RENDER GRID (por secciones) ─────────────────────────── */
  function renderGrid() {
    var grid   = document.getElementById('mtGrid');
    var cat    = window.MT.getCat();
    var player = getPlayer();
    var count  = document.getElementById('pageCount');

    var sections = cat === 'peliculas'
      ? [{ key: 'fav', label: '⭐ Favoritas' }, { key: 'visto', label: '🎬 Vistas' }]
      : [{ key: 'fav', label: '⭐ Favoritas' }, { key: 'viendo', label: '👁️ Viendo' }, { key: 'visto', label: '✅ Visto' }];

    var total = 0;
    var html  = sections.map(function (sec) {
      var items = itemsForSection(sec.key);
      total += items.length;
      var header = '<div class="mt-section-header' + (sec.key === 'fav' ? ' mt-section-header--fav' : '') + '">' +
        '<span class="mt-section-header__label">' + sec.label + '</span>' +
        '<span class="mt-section-header__count">' + items.length + '</span></div>';
      if (!items.length) {
        var msg = sec.key === 'fav'
          ? 'Pulsa la ⭐ de un título para añadirlo a favoritas.'
          : 'Nada por aquí todavía.';
        return header + '<div class="mt-section-empty">' + msg + '</div>';
      }
      return header + '<div class="mt-grid">' + items.map(renderCard).join('') + '</div>';
    }).join('');

    count.textContent = total + ' título' + (total !== 1 ? 's' : '') + ' · ' + player;

    if (total === 0) {
      var emoji = U().catEmoji(cat);
      grid.innerHTML =
        '<div class="mt-empty">' +
          '<div class="mt-empty__icon">' + emoji + '</div>' +
          '<div class="mt-empty__title">Tu registro está vacío</div>' +
          '<p>Pulsa <strong>+ Añadir</strong> para registrar un título de tu biblioteca.</p>' +
        '</div>';
      return;
    }
    grid.innerHTML = html;
  }

  function renderCard(item) {
    var u      = U();
    var player = getPlayer();
    var estado = u.resolvePlayerEstado(item, player);
    var nota   = u.resolvePlayerNota(item, player);
    var sc     = estado ? u.statusClass(estado) : 'sinregistrar';
    var color  = nota !== null ? u.notaColor(nota) : null;
    var id     = item.id;

    var scoreBadge = nota !== null
      ? '<div class="mt-card__score" style="color:' + color + '">' + u.formatNota(nota) + '</div>'
      : '';

    var cover = item.portadaUrl
      ? '<img src="' + u.escHtml(item.portadaUrl) + '" loading="lazy" onerror="this.style.display=\'none\'">'
      : '<div class="mt-card__cover-ph">' + u.catEmoji(item.tipo) + '</div>';

    var genre = item.generos && item.generos[0]
      ? '<span class="mt-card__genre">' + u.escHtml(item.generos[0]) + '</span>'
      : '';

    var fav = isFav(item, player);
    var starBtn = '<button class="mt-card__fav' + (fav ? ' mt-card__fav--on' : '') + '" ' +
      'title="' + (fav ? 'Quitar de favoritas' : 'Añadir a favoritas') + '" ' +
      'onclick="event.stopPropagation();window.MTReg._toggleFav(\'' + id.replace(/'/g, "\\'") + '\')">' +
      (fav ? '★' : '☆') + '</button>';

    return '<div class="mt-card" onclick="window.MTReg.openReg(\'' + id.replace(/'/g, "\\'") + '\')">' +
      '<div class="mt-card__cover">' + cover + starBtn + scoreBadge + '</div>' +
      '<div class="mt-card__body">' +
        '<div class="mt-card__title">' + u.escHtml(item.titulo) + '</div>' +
        '<div class="mt-card__meta">' +
          (itemYear(item) ? '<span class="mt-card__year">' + itemYear(item) + '</span>' : '') +
          genre +
        '</div>' +
        '<div class="mt-card__reg-status mt-status--' + sc + '">' + u.escHtml(estado || 'Sin registrar') + '</div>' +
      '</div>' +
    '</div>';
  }

  /* ══════════════════════════════════════════════════════════
     MODAL EDITAR REGISTRO (nivel título, 3 jugadores)
  ══════════════════════════════════════════════════════════ */
  function openReg(id) {
    var item = _items.find(function (i) { return i.id === id; });
    if (!item) return;
    _editingId = id;

    var u       = U();
    var player  = getPlayer();
    var cat     = window.MT.getCat();
    var estados = window.MT.ESTADOS[cat] || ['Vista', 'Pendiente'];

    document.getElementById('regModalTitle').textContent = item.titulo;

    var html = ['David', 'Javi', 'Mery'].map(function (p) {
      var estado = u.resolvePlayerEstado(item, p);
      var nota   = u.resolvePlayerNota(item, p);
      /* Si el estado heredado no está entre las opciones nuevas, lo dejamos vacío en el select */
      var estSel = estados.indexOf(estado) >= 0 ? estado : '';
      var opts   = '<option value="">— Sin estado</option>' +
        estados.map(function (e) {
          return '<option value="' + e + '"' + (e === estSel ? ' selected' : '') + '>' + e + '</option>';
        }).join('');
      var active = p === player ? ' mt-player-row--active' : '';
      return '<div class="mt-player-row mt-player-row--nota' + active + '">' +
        '<div class="mt-player-row__avatar mt-player-row__avatar--' + p.toLowerCase() + '">' + p.charAt(0) + '</div>' +
        '<select class="mt-form-select" id="rEstado' + p + '">' + opts + '</select>' +
        window.MT.Nota.html('rNota' + p, nota) +
      '</div>';
    }).join('');

    document.getElementById('regPlayerRows').innerHTML = html;
    document.getElementById('regModal').classList.add('open');
  }

  function closeRegModal() {
    document.getElementById('regModal').classList.remove('open');
    _editingId = null;
  }

  function saveReg() {
    if (!_editingId) return;
    var jugadores = {};
    ['David', 'Javi', 'Mery'].forEach(function (p) {
      var estado = document.getElementById('rEstado' + p).value;
      var nota   = window.MT.Nota.read('rNota' + p);
      jugadores[p] = { estado: estado, nota: nota };
    });
    window.MT.getDb().collection('mt_items').doc(_editingId)
      .update({ jugadores: jugadores })
      .then(closeRegModal);
  }

  /* ══════════════════════════════════════════════════════════
     MODAL AÑADIR (buscar en biblioteca)
  ══════════════════════════════════════════════════════════ */
  function openAddModal() {
    _addPickId = null;
    document.getElementById('addSearchInput').value = '';
    document.getElementById('addSave').style.display = 'none';
    showAddStep(1);
    renderAddResults('');
    document.getElementById('addModal').classList.add('open');
    setTimeout(function () { document.getElementById('addSearchInput').focus(); }, 120);
  }

  function closeAddModal() {
    document.getElementById('addModal').classList.remove('open');
    document.getElementById('addCancel').style.display = '';
    _addPickId = null;
  }

  function showAddStep(n) {
    [1, 2, 3, 4].forEach(function (i) {
      var el = document.getElementById('addStep' + i);
      if (el) el.style.display = (i === n) ? '' : 'none';
    });
    var backBtn = document.getElementById('addBackBtn');
    if (backBtn) backBtn.style.display = (n === 2) ? 'block' : 'none';
  }

  function renderAddResults(query) {
    var u      = U();
    var player = getPlayer();
    var q      = (query || '').toLowerCase().trim();
    var el     = document.getElementById('addSearchResults');

    if (!_items.length) {
      el.innerHTML = '<div class="mt-add-empty">No hay títulos en la biblioteca de esta categoría todavía. Añádelos primero en <strong>Biblioteca</strong>.</div>';
      return;
    }

    var list = _items.slice();
    if (q) list = list.filter(function (i) { return (i.titulo || '').toLowerCase().indexOf(q) >= 0; });
    list = list.slice(0, 40);

    if (!list.length) {
      el.innerHTML = '<div class="mt-add-empty">Ningún título coincide. Si no está, añádelo en la <strong>Biblioteca</strong>.</div>';
      return;
    }

    el.innerHTML = list.map(function (it) {
      var est   = u.resolvePlayerEstado(it, player);
      var badge = est
        ? '<span class="mt-add-result__badge mt-status--' + u.statusClass(est) + '">' + u.escHtml(est) + '</span>'
        : '';
      var poster = it.portadaUrl
        ? '<img src="' + u.escHtml(it.portadaUrl) + '" class="mt-add-result__poster" onerror="this.style.display=\'none\'">'
        : '<div class="mt-add-result__poster"></div>';
      return '<div class="mt-add-result" onclick="window.MTReg._pickAdd(\'' + it.id.replace(/'/g, "\\'") + '\')">' +
        poster +
        '<div style="flex:1;min-width:0">' +
          '<div class="mt-add-result__title">' + u.escHtml(it.titulo) + '</div>' +
          '<div class="mt-add-result__meta">' + (itemYear(it) || '—') + '</div>' +
        '</div>' +
        badge +
      '</div>';
    }).join('');
  }

  function pickAdd(id) {
    var item = _items.find(function (i) { return i.id === id; });
    if (!item) return;
    _addPickId = id;

    var u       = U();
    var player  = getPlayer();
    var cat     = window.MT.getCat();
    var estados = window.MT.ESTADOS[cat] || ['Vista', 'Pendiente'];
    var jinfo   = (item.jugadores && item.jugadores[player]) || {};
    var curEst  = jinfo.estado || '';
    var curNota = jinfo.nota;

    document.getElementById('addItemPreview').innerHTML =
      (item.portadaUrl
        ? '<img src="' + u.escHtml(item.portadaUrl) + '" class="mt-add-preview__poster" onerror="this.style.display=\'none\'">'
        : '<div class="mt-add-preview__poster"></div>') +
      '<div>' +
        '<div class="mt-add-preview__title">' + u.escHtml(item.titulo) + '</div>' +
        '<div class="mt-add-preview__meta">' +
          (itemYear(item) || '') +
          (item.director ? ' · Dir. ' + u.escHtml(item.director) : (item.estudio ? ' · ' + u.escHtml(item.estudio) : '')) +
        '</div>' +
        (item.generos && item.generos.length
          ? '<div class="mt-add-preview__meta" style="margin-top:0.25rem">' + u.escHtml(item.generos.slice(0, 3).join(' · ')) + '</div>'
          : '') +
      '</div>';

    var estSel = estados.indexOf(curEst) >= 0 ? curEst : '';
    var opts   = '<option value="">— Elige estado</option>' +
      estados.map(function (e) {
        return '<option value="' + e + '"' + (e === estSel ? ' selected' : '') + '>' + e + '</option>';
      }).join('');

    document.getElementById('addPlayerRow').innerHTML =
      '<div class="mt-player-row mt-player-row--nota mt-player-row--active">' +
        '<div class="mt-player-row__avatar mt-player-row__avatar--' + player.toLowerCase() + '">' + player.charAt(0) + '</div>' +
        '<select class="mt-form-select" id="addEstado">' + opts + '</select>' +
        window.MT.Nota.html('addNota', curNota) +
      '</div>';

    showAddStep(2);
    document.getElementById('addSave').style.display = '';
  }

  function saveAdd() {
    if (!_addPickId) return;
    var item     = _items.find(function (i) { return i.id === _addPickId; });
    if (!item) return;
    var estadoEl = document.getElementById('addEstado');
    var estado   = estadoEl ? estadoEl.value : '';
    if (!estado) {
      if (estadoEl) { estadoEl.style.borderColor = 'var(--accent)'; estadoEl.focus(); }
      return;
    }
    var nota   = window.MT.Nota.read('addNota');
    var player = getPlayer();

    showAddStep(3);
    document.getElementById('addSave').style.display   = 'none';
    document.getElementById('addCancel').style.display = 'none';

    var upd = {};
    upd['jugadores.' + player] = { estado: estado, nota: nota };

    window.MT.getDb().collection('mt_items').doc(_addPickId).update(upd)
      .then(function () {
        showAddStep(4);
        document.getElementById('addDoneText').textContent =
          '"' + item.titulo + '" añadido al registro de ' + player + ' · ' + estado + '.';
        setTimeout(function () {
          closeAddModal();
        }, 2000);
      })
      .catch(function (err) {
        console.error('saveAdd error:', err);
        showAddStep(2);
        document.getElementById('addSave').style.display   = '';
        document.getElementById('addCancel').style.display = '';
        alert('Error al guardar. Inténtalo de nuevo.');
      });
  }

  /* ── TOGGLE FAVORITA (jugador actual) ────────────────────── */
  function toggleFav(id) {
    var item = _items.find(function (i) { return i.id === id; });
    if (!item) return;
    var player   = getPlayer();
    var existing = (item.jugadores && item.jugadores[player]) || {};
    var payload  = {
      estado: existing.estado || '',
      nota  : (existing.nota !== undefined ? existing.nota : null),
      fav   : !isFav(item, player)
    };
    if (!item.jugadores) item.jugadores = {};
    item.jugadores[player] = payload;   /* optimista */
    renderGrid();

    var upd = {};
    upd['jugadores.' + player] = payload;
    window.MT.getDb().collection('mt_items').doc(id).update(upd)
      .catch(function (e) { console.error('toggleFav:', e); });
  }

  window.MTReg = {
    openReg   : openReg,
    _pickAdd  : pickAdd,
    _toggleFav: toggleFav
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
