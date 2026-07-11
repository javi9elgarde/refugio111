/* ============================================================
   MEDIA TRACKER — General (Calendario de estrenos + TOP 10)
   Version: 20260711a
   - Calendario de estrenos (Películas/Series/Anime) vía TMDB.
   - TOP 10 por categoría (nota media entre quienes puntúan).
   ============================================================ */
(function () {
  'use strict';

  var TMDB_KEY  = '2a0181b8eb1bb888042a00f91e10681c';
  var IMG_SMALL = 'https://image.tmdb.org/t/p/w92';
  var IMG_FULL  = 'https://image.tmdb.org/t/p/w500';

  var MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  var DIAS  = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

  var _items        = [];   // mt_items (todos)
  var _releases     = [];   // mt_estrenos
  var _unsubItems   = null;
  var _unsubRel     = null;
  var _view         = new Date();   // mes mostrado
  var _addCat       = 'peliculas';
  var _tmdbResults  = [];
  var _addPick      = null;

  function U() { return window.MT.Utils; }

  function waitForMT(cb) {
    if (window.MT && window.MT.getDb && window.MT.getDb()) return cb();
    setTimeout(function () { waitForMT(cb); }, 60);
  }

  /* ── INIT ────────────────────────────────────────────────── */
  function init() {
    _view = new Date();
    _view.setDate(1);

    waitForMT(function () {
      loadItems();
      loadReleases();
    });

    document.getElementById('calPrev').addEventListener('click', function () { changeMonth(-1); });
    document.getElementById('calNext').addEventListener('click', function () { changeMonth(1); });
    document.getElementById('calToday').addEventListener('click', function () {
      _view = new Date(); _view.setDate(1); renderCalendar();
    });

    /* Modal añadir estreno */
    document.getElementById('btnAddEstreno').addEventListener('click', openAddModal);
    document.getElementById('estrenoModalClose').addEventListener('click', closeAddModal);
    document.getElementById('estrenoCancel').addEventListener('click', closeAddModal);
    document.getElementById('estrenoModal').addEventListener('click', function (e) {
      if (e.target === this) closeAddModal();
    });
    document.querySelectorAll('.estreno-cat-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        _addCat = this.dataset.cat;
        document.querySelectorAll('.estreno-cat-tab').forEach(function (t) {
          t.classList.toggle('estreno-cat-tab--active', t === tab);
        });
        var q = document.getElementById('estrenoSearchInput').value.trim();
        if (q) doTMDBSearch();
      });
    });
    document.getElementById('estrenoSearchInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') doTMDBSearch();
    });
    document.getElementById('estrenoSearchBtn').addEventListener('click', doTMDBSearch);
    document.getElementById('estrenoSave').addEventListener('click', saveEstreno);
    document.getElementById('estrenoBack').addEventListener('click', function () {
      showEstrenoStep(1);
      _addPick = null;
    });

    /* Cat tabs del nav: en General no cambian de contenido, solo tema */
    window.addEventListener('mt:catChange', function () { /* no-op en General */ });
  }

  /* ── CARGA DATOS ─────────────────────────────────────────── */
  function loadItems() {
    var db = window.MT.getDb();
    if (_unsubItems) _unsubItems();
    _unsubItems = db.collection('mt_items').onSnapshot(function (snap) {
      _items = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      renderTops();
      window.MT.hideLoading();
    }, function (err) {
      console.error('MT general items error:', err);
      window.MT.hideLoading();
    });
  }

  function loadReleases() {
    var db = window.MT.getDb();
    if (_unsubRel) _unsubRel();
    _unsubRel = db.collection('mt_estrenos').onSnapshot(function (snap) {
      _releases = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      renderCalendar();
      renderUpcoming();
    }, function (err) {
      console.error('MT general releases error:', err);
      renderCalendar();
      renderUpcoming();
    });
  }

  /* ── CALENDARIO ──────────────────────────────────────────── */
  function changeMonth(delta) {
    _view.setMonth(_view.getMonth() + delta);
    renderCalendar();
  }

  function releasesOn(y, m, d) {
    return _releases.filter(function (r) {
      if (!r.fecha) return false;
      var parts = r.fecha.split('-');
      return parseInt(parts[0]) === y && (parseInt(parts[1]) - 1) === m && parseInt(parts[2]) === d;
    });
  }

  function renderCalendar() {
    var y = _view.getFullYear();
    var m = _view.getMonth();
    document.getElementById('calMonthLabel').textContent = MESES[m] + ' ' + y;

    /* Primer día (lunes = 0) */
    var firstDow = (new Date(y, m, 1).getDay() + 6) % 7;
    var daysInMonth = new Date(y, m + 1, 0).getDate();

    var today = new Date();
    var isToday = function (d) {
      return today.getFullYear() === y && today.getMonth() === m && today.getDate() === d;
    };

    var head = DIAS.map(function (d) { return '<div class="mt-cal__dow">' + d + '</div>'; }).join('');

    var cells = '';
    for (var i = 0; i < firstDow; i++) cells += '<div class="mt-cal__cell mt-cal__cell--empty"></div>';

    for (var d = 1; d <= daysInMonth; d++) {
      var rels = releasesOn(y, m, d);
      var relHtml = rels.map(function (r) {
        var cls = 'mt-cal__rel mt-cal__rel--' + (r.tipo || 'peliculas');
        return '<div class="' + cls + '" title="' + U().escHtml(r.titulo) + '" ' +
          'onclick="event.stopPropagation();window.MTGen._openRel(\'' + r.id.replace(/'/g, "\\'") + '\')">' +
          U().escHtml(r.titulo) + '</div>';
      }).join('');
      cells += '<div class="mt-cal__cell' + (isToday(d) ? ' mt-cal__cell--today' : '') + (rels.length ? ' mt-cal__cell--has' : '') + '">' +
        '<div class="mt-cal__daynum">' + d + '</div>' +
        '<div class="mt-cal__rels">' + relHtml + '</div>' +
      '</div>';
    }

    document.getElementById('mtCalendar').innerHTML =
      '<div class="mt-cal__grid mt-cal__grid--head">' + head + '</div>' +
      '<div class="mt-cal__grid">' + cells + '</div>';
  }

  /* ── PRÓXIMOS ESTRENOS (lista) ───────────────────────────── */
  function renderUpcoming() {
    var el = document.getElementById('mtUpcoming');
    var todayStr = new Date().toISOString().slice(0, 10);
    var list = _releases.filter(function (r) { return r.fecha && r.fecha >= todayStr; })
      .sort(function (a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0; })
      .slice(0, 12);

    if (!list.length) {
      el.innerHTML = '<div class="mt-upcoming__empty">No hay estrenos próximos. Pulsa <strong>+ Añadir estreno</strong>.</div>';
      return;
    }

    el.innerHTML = list.map(function (r) {
      var u = U();
      var fecha = fmtDate(r.fecha);
      var poster = r.portadaUrl
        ? '<img src="' + u.escHtml(r.portadaUrl) + '" onerror="this.style.display=\'none\'">'
        : '<div class="mt-upcoming__ph">' + u.catEmoji(r.tipo) + '</div>';
      return '<div class="mt-upcoming__item mt-upcoming__item--' + (r.tipo || 'peliculas') + '">' +
        '<div class="mt-upcoming__poster">' + poster + '</div>' +
        '<div class="mt-upcoming__info">' +
          '<div class="mt-upcoming__title">' + u.escHtml(r.titulo) + '</div>' +
          '<div class="mt-upcoming__meta">' + u.catEmoji(r.tipo) + ' ' + fecha + '</div>' +
        '</div>' +
        '<button class="mt-upcoming__del" title="Eliminar" onclick="window.MTGen._delRel(\'' + r.id.replace(/'/g, "\\'") + '\')">✕</button>' +
      '</div>';
    }).join('');
  }

  function fmtDate(iso) {
    var p = iso.split('-');
    return parseInt(p[2]) + ' ' + MESES[parseInt(p[1]) - 1] + ' ' + p[0];
  }

  /* ── TOP 10 ──────────────────────────────────────────────── */
  function globalNota(item) {
    var u = U();
    var vals = ['David', 'Javi', 'Mery']
      .map(function (p) { return u.resolvePlayerNota(item, p); })
      .filter(function (v) { return v !== null && v !== undefined && !isNaN(v); });
    if (!vals.length) return null;
    return vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
  }

  function topFor(cat) {
    return _items.filter(function (i) { return i.tipo === cat; })
      .map(function (i) { return { item: i, nota: globalNota(i) }; })
      .filter(function (x) { return x.nota !== null; })
      .sort(function (a, b) { return b.nota - a.nota; })
      .slice(0, 10);
  }

  function renderTops() {
    ['peliculas', 'series', 'anime'].forEach(function (cat) {
      var el = document.getElementById('top-' + cat);
      if (!el) return;
      var list = topFor(cat);
      if (!list.length) {
        el.innerHTML = '<div class="mt-top__empty">Aún no hay títulos puntuados.</div>';
        return;
      }
      el.innerHTML = list.map(function (x, idx) {
        var u = U();
        var it = x.item;
        var color = u.notaColor(x.nota);
        var poster = it.portadaUrl
          ? '<img src="' + u.escHtml(it.portadaUrl) + '" loading="lazy" onerror="this.style.display=\'none\'">'
          : '<div class="mt-top-row__ph">' + u.catEmoji(cat) + '</div>';
        var rankCls = idx === 0 ? ' mt-top-row--gold' : idx === 1 ? ' mt-top-row--silver' : idx === 2 ? ' mt-top-row--bronze' : '';
        return '<div class="mt-top-row' + rankCls + '">' +
          '<div class="mt-top-row__rank">' + (idx + 1) + '</div>' +
          '<div class="mt-top-row__poster">' + poster + '</div>' +
          '<div class="mt-top-row__info">' +
            '<div class="mt-top-row__title">' + u.escHtml(it.titulo) + '</div>' +
            '<div class="mt-top-row__meta">' + (it.anio || it['año'] || '') + '</div>' +
          '</div>' +
          '<div class="mt-top-row__nota" style="color:' + color + '">' + u.formatNota(x.nota) + '</div>' +
        '</div>';
      }).join('');
    });
  }

  /* ══════════════════════════════════════════════════════════
     MODAL AÑADIR ESTRENO (TMDB)
  ══════════════════════════════════════════════════════════ */
  function openAddModal() {
    _addPick = null;
    _tmdbResults = [];
    _addCat = 'peliculas';
    document.querySelectorAll('.estreno-cat-tab').forEach(function (t) {
      t.classList.toggle('estreno-cat-tab--active', t.dataset.cat === 'peliculas');
    });
    document.getElementById('estrenoSearchInput').value = '';
    document.getElementById('estrenoResults').innerHTML = '';
    showEstrenoStep(1);
    document.getElementById('estrenoModal').classList.add('open');
    setTimeout(function () { document.getElementById('estrenoSearchInput').focus(); }, 120);
  }

  function closeAddModal() {
    document.getElementById('estrenoModal').classList.remove('open');
    _addPick = null;
  }

  function showEstrenoStep(n) {
    document.getElementById('estrenoStep1').style.display = n === 1 ? '' : 'none';
    document.getElementById('estrenoStep2').style.display = n === 2 ? '' : 'none';
    document.getElementById('estrenoSave').style.display  = n === 2 ? '' : 'none';
    document.getElementById('estrenoBack').style.display  = n === 2 ? '' : 'none';
  }

  function doTMDBSearch() {
    var query = document.getElementById('estrenoSearchInput').value.trim();
    if (!query) return;
    var isFilm = _addCat === 'peliculas';
    var endpoint = isFilm ? '/search/movie' : '/search/tv';
    var url = 'https://api.themoviedb.org/3' + endpoint +
      '?api_key=' + TMDB_KEY + '&language=es-ES&query=' + encodeURIComponent(query);

    var el = document.getElementById('estrenoResults');
    el.innerHTML = '<div class="mt-tmdb-msg">Buscando...</div>';

    fetch(url).then(function (r) { return r.json(); }).then(function (data) {
      _tmdbResults = (data.results || []).slice(0, 8);
      if (!_tmdbResults.length) {
        el.innerHTML = '<div class="mt-tmdb-msg">Sin resultados.</div>';
        return;
      }
      el.innerHTML = _tmdbResults.map(function (r, idx) {
        var title = r.title || r.name || '—';
        var date  = r.release_date || r.first_air_date || '';
        var year  = date ? date.slice(0, 4) : '—';
        var poster = r.poster_path
          ? '<img src="' + IMG_SMALL + r.poster_path + '" class="mt-add-result__poster" onerror="this.style.display=\'none\'">'
          : '<div class="mt-add-result__poster"></div>';
        return '<div class="mt-add-result" onclick="window.MTGen._pickTMDB(' + idx + ')">' +
          poster +
          '<div style="flex:1;min-width:0">' +
            '<div class="mt-add-result__title">' + U().escHtml(title) + '</div>' +
            '<div class="mt-add-result__meta">' + (date ? fmtDate(date) : 'Sin fecha') + '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    }).catch(function () {
      el.innerHTML = '<div class="mt-tmdb-msg">❌ Error al buscar en TMDB.</div>';
    });
  }

  function pickTMDB(idx) {
    var r = _tmdbResults[idx];
    if (!r) return;
    var date = r.release_date || r.first_air_date || '';
    _addPick = {
      titulo    : r.title || r.name || '',
      tipo      : _addCat,
      fecha     : date || '',
      portadaUrl: r.poster_path ? IMG_FULL + r.poster_path : null,
      tmdbId    : r.id
    };

    var u = U();
    document.getElementById('estrenoPreview').innerHTML =
      (_addPick.portadaUrl
        ? '<img src="' + u.escHtml(_addPick.portadaUrl) + '" class="mt-add-preview__poster" onerror="this.style.display=\'none\'">'
        : '<div class="mt-add-preview__poster"></div>') +
      '<div>' +
        '<div class="mt-add-preview__title">' + u.escHtml(_addPick.titulo) + '</div>' +
        '<div class="mt-add-preview__meta">' + u.catEmoji(_addPick.tipo) + ' ' +
          (_addPick.tipo === 'peliculas' ? 'Película' : _addPick.tipo === 'series' ? 'Serie' : 'Anime') + '</div>' +
      '</div>';

    document.getElementById('estrenoFecha').value = _addPick.fecha || '';
    showEstrenoStep(2);
  }

  function saveEstreno() {
    if (!_addPick) return;
    var fecha = document.getElementById('estrenoFecha').value;
    if (!fecha) {
      var fi = document.getElementById('estrenoFecha');
      fi.style.borderColor = 'var(--accent)'; fi.focus();
      return;
    }
    _addPick.fecha = fecha;
    _addPick.creadoEn = new Date();

    window.MT.getDb().collection('mt_estrenos').add(_addPick)
      .then(function () { closeAddModal(); })
      .catch(function (err) {
        console.error('saveEstreno error:', err);
        alert('Error al guardar el estreno.');
      });
  }

  function delRel(id) {
    if (!confirm('¿Eliminar este estreno del calendario?')) return;
    window.MT.getDb().collection('mt_estrenos').doc(id).delete()
      .catch(function (e) { console.error('delRel:', e); });
  }

  function openRel(id) {
    var r = _releases.find(function (x) { return x.id === id; });
    if (!r) return;
    if (confirm('"' + r.titulo + '"\n' + fmtDate(r.fecha) + '\n\n¿Eliminar este estreno?')) {
      window.MT.getDb().collection('mt_estrenos').doc(id).delete()
        .catch(function (e) { console.error('openRel del:', e); });
    }
  }

  window.MTGen = {
    _pickTMDB: pickTMDB,
    _delRel  : delRel,
    _openRel : openRel
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
