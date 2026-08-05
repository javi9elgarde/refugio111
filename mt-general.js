/* ============================================================
   MEDIA TRACKER — General (Dashboard)
   Version: 20260712a
   - Hero de estrenos destacados (Más info = ficha · Ver tráiler = YouTube)
   - Buscador rápido de biblioteca
   - TOP 3 (Películas/Series/Anime) · 2026 o Histórico
   - Próximos estrenos + calendario
   - Estadísticas por jugador (selector)
   ============================================================ */
(function () {
  'use strict';

  var TMDB_KEY  = '2a0181b8eb1bb888042a00f91e10681c';
  var IMG_SMALL = 'https://image.tmdb.org/t/p/w92';
  var IMG_FULL  = 'https://image.tmdb.org/t/p/w500';
  var IMG_BACK  = 'https://image.tmdb.org/t/p/w1280';

  var MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  var DIAS  = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
  var PLAYERS = ['David', 'Javi', 'Mery'];

  var _items       = [];
  var _releases    = [];
  var _unsubItems  = null;
  var _unsubRel    = null;

  var _hero        = [];
  var _heroIdx     = 0;
  var _heroDetails = {};   // tmdbId → {overview, backdrop, poster, genres, trailerKey}
  var _heroTimer   = null;

  var _topScope    = '2026';   // '2026' | 'hist'
  var _topExpanded = { peliculas: false, series: false, anime: false };

  var _statsPlayer = 'Javi';

  var _view        = new Date();
  var _addCat        = 'peliculas';
  var _tmdbResults   = [];
  var _addPick       = null;
  var _editingRelId  = null;   // id de estreno en edición (o null = nuevo)

  function U() { return window.MT.Utils; }
  function esc(s) { return U().escHtml(s); }

  function waitForMT(cb) {
    if (window.MT && window.MT.getDb && window.MT.getDb()) return cb();
    setTimeout(function () { waitForMT(cb); }, 60);
  }

  /* ══ INIT ═══════════════════════════════════════════════════ */
  function init() {
    _view = new Date(); _view.setDate(1);
    _statsPlayer = (window.MT && window.MT.getPlayer && window.MT.getPlayer()) || 'Javi';

    waitForMT(function () {
      loadItems();
      loadReleases();
    });

    /* Buscador */
    var si = document.getElementById('genSearch');
    si.addEventListener('input', function () { renderSearch(this.value); });
    si.addEventListener('focus', function () { renderSearch(this.value); });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.gen-search')) hideSearch();
    });

    /* Hero nav */
    document.getElementById('heroPrev').addEventListener('click', function () { gotoHero(_heroIdx - 1); });
    document.getElementById('heroNext').addEventListener('click', function () { gotoHero(_heroIdx + 1); });

    /* Tops: toggle 2026 / histórico */
    document.getElementById('topScopeBtn').addEventListener('click', function () {
      _topScope = (_topScope === '2026') ? 'hist' : '2026';
      _topExpanded = { peliculas: false, series: false, anime: false };
      renderTops();
    });

    /* Stats: selector de jugador */
    var sp = document.getElementById('statsPlayer');
    sp.value = _statsPlayer;
    sp.addEventListener('change', function () { _statsPlayer = this.value; renderStats(); });

    /* Calendario (modal) */
    document.getElementById('openCalendar').addEventListener('click', openCalendar);
    document.getElementById('calModalClose').addEventListener('click', closeCalendar);
    document.getElementById('calendarModal').addEventListener('click', function (e) { if (e.target === this) closeCalendar(); });
    document.getElementById('calPrev').addEventListener('click', function () { _view.setMonth(_view.getMonth() - 1); renderCalendar(); });
    document.getElementById('calNext').addEventListener('click', function () { _view.setMonth(_view.getMonth() + 1); renderCalendar(); });
    document.getElementById('calToday').addEventListener('click', function () { _view = new Date(); _view.setDate(1); renderCalendar(); });

    /* Auto-abrir calendario si se llega con ?cal=1 (desde "Estrenos" del menú) */
    if (new URLSearchParams(window.location.search).get('cal') === '1') {
      setTimeout(openCalendar, 300);
    }

    /* Ficha (modal) */
    document.getElementById('fichaClose').addEventListener('click', closeFicha);
    document.getElementById('fichaModal').addEventListener('click', function (e) { if (e.target === this) closeFicha(); });

    /* Añadir estreno (modal) */
    document.getElementById('btnAddEstreno').addEventListener('click', openAddModal);
    document.getElementById('estrenoModalClose').addEventListener('click', closeAddModal);
    document.getElementById('estrenoCancel').addEventListener('click', closeAddModal);
    document.getElementById('estrenoModal').addEventListener('click', function (e) { if (e.target === this) closeAddModal(); });
    document.querySelectorAll('.estreno-cat-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        _addCat = this.dataset.cat;
        document.querySelectorAll('.estreno-cat-tab').forEach(function (t) { t.classList.toggle('estreno-cat-tab--active', t === tab); });
        var q = document.getElementById('estrenoSearchInput').value.trim();
        if (q) doTMDBSearch();
      });
    });
    document.getElementById('estrenoSearchInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') doTMDBSearch(); });
    document.getElementById('estrenoSearchBtn').addEventListener('click', doTMDBSearch);
    document.getElementById('estrenoSave').addEventListener('click', saveEstreno);
    document.getElementById('estrenoDelete').addEventListener('click', deleteEditingRel);
    document.getElementById('estrenoBack').addEventListener('click', function () { showEstrenoStep(1); _addPick = null; });
  }

  /* ══ CARGA DATOS ════════════════════════════════════════════ */
  function loadItems() {
    var db = window.MT.getDb();
    if (_unsubItems) _unsubItems();
    _unsubItems = db.collection('mt_items').onSnapshot(function (snap) {
      _items = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      renderTops();
      renderStats();
      window.MT.hideLoading();
    }, function (err) { console.error('items:', err); window.MT.hideLoading(); });
  }

  function loadReleases() {
    var db = window.MT.getDb();
    if (_unsubRel) _unsubRel();
    _unsubRel = db.collection('mt_estrenos').onSnapshot(function (snap) {
      _releases = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      buildHero();
      renderUpcoming();
      renderCalendar();
    }, function () { buildHero(); renderUpcoming(); renderCalendar(); });
  }

  /* ══ HERO (estrenos destacados) ═════════════════════════════ */
  function buildHero() {
    /* Incluye estrenos recientes (hasta 1 mes atrás, aún en cines) y próximos */
    var c = new Date(); c.setMonth(c.getMonth() - 1);
    var cutoff = c.toISOString().slice(0, 10);
    _hero = _releases.filter(function (r) { return r.fecha && r.fecha >= cutoff; })
      .sort(function (a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0; })
      .slice(0, 8);
    if (_heroIdx >= _hero.length) _heroIdx = 0;
    renderHero();
    /* Enriquecer con TMDB (backdrop, sinopsis, tráiler) */
    _hero.forEach(function (r) { if (r.tmdbId && !_heroDetails[r.tmdbId]) fetchDetail(r).then(function () { renderHero(); }); });
    restartHeroTimer();
  }

  function fetchDetail(r) {
    if (!r.tmdbId) return Promise.resolve(null);
    if (_heroDetails[r.tmdbId]) return Promise.resolve(_heroDetails[r.tmdbId]);
    var base = r.tipo === 'peliculas' ? '/movie/' : '/tv/';
    var url  = 'https://api.themoviedb.org/3' + base + r.tmdbId +
      '?api_key=' + TMDB_KEY + '&language=es-ES&append_to_response=videos';
    return fetch(url).then(function (res) { return res.json(); }).then(function (d) {
      var vids = (d.videos && d.videos.results) || [];
      var tr = vids.find(function (v) { return v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'); });
      var det = {
        overview  : d.overview || '',
        backdrop  : d.backdrop_path ? IMG_BACK + d.backdrop_path : null,
        poster    : d.poster_path ? IMG_FULL + d.poster_path : r.portadaUrl,
        genres    : (d.genres || []).map(function (g) { return g.name; }),
        trailerKey: tr ? tr.key : null
      };
      _heroDetails[r.tmdbId] = det;
      return det;
    }).catch(function () { return null; });
  }

  function renderHero() {
    var host = document.getElementById('genHero');
    if (!_hero.length) {
      host.innerHTML = '<div class="gen-hero__empty"><span style="font-size:2.5rem">🎬</span><div>Aún no hay estrenos destacados.<br>Pulsa <strong>+ Añadir estreno</strong> en Próximos estrenos.</div></div>';
      return;
    }
    var slides = _hero.map(function (r, i) {
      var det = _heroDetails[r.tmdbId] || {};
      var bg  = det.backdrop || r.portadaUrl || '';
      var over = det.overview ? '<p class="gen-hero__desc">' + esc(det.overview) + '</p>' : '';
      var catLabel = r.tipo === 'peliculas' ? 'Película' : r.tipo === 'series' ? 'Serie' : 'Anime';
      return '<div class="gen-hero__slide' + (i === _heroIdx ? ' gen-hero__slide--active' : '') + '"' +
        (bg ? ' style="background-image:linear-gradient(90deg,rgba(7,7,15,0.95) 0%,rgba(7,7,15,0.75) 42%,rgba(7,7,15,0.3) 100%),url(' + bg + ')"' : '') + '>' +
        '<div class="gen-hero__content">' +
          '<div class="gen-hero__badge">⭐ ESTRENO DESTACADO · ' + catLabel + '</div>' +
          '<h2 class="gen-hero__title">' + esc(r.titulo) + '</h2>' +
          '<div class="gen-hero__date">📅 ' + fmtDate(r.fecha) + '</div>' +
          over +
          '<div class="gen-hero__actions">' +
            '<button class="gen-hero__btn gen-hero__btn--play" onclick="window.MTGen._trailer(' + i + ')">▶ Ver tráiler</button>' +
            '<button class="gen-hero__btn gen-hero__btn--info" onclick="window.MTGen._ficha(' + i + ')">ⓘ Más info</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
    var dots = '<div class="gen-hero__dots">' + _hero.map(function (r, i) {
      return '<button class="gen-hero__dot' + (i === _heroIdx ? ' gen-hero__dot--active' : '') + '" onclick="window.MTGen._goHero(' + i + ')"></button>';
    }).join('') + '</div>';
    host.innerHTML = slides + dots;
  }

  function gotoHero(idx) {
    if (!_hero.length) return;
    _heroIdx = (idx + _hero.length) % _hero.length;
    renderHero();
    restartHeroTimer();
  }
  function restartHeroTimer() {
    if (_heroTimer) clearInterval(_heroTimer);
    if (_hero.length > 1) _heroTimer = setInterval(function () { gotoHero(_heroIdx + 1); }, 7000);
  }

  function heroTrailer(i) {
    var r = _hero[i]; if (!r) return;
    var det = _heroDetails[r.tmdbId];
    if (det && det.trailerKey) window.open('https://www.youtube.com/watch?v=' + det.trailerKey, '_blank');
    else window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent(r.titulo + ' tráiler español'), '_blank');
  }

  function heroFicha(i) { var r = _hero[i]; if (r) openFicha(r); }

  /* ══ FICHA (modal) ══════════════════════════════════════════ */
  function openFicha(r) {
    var body = document.getElementById('fichaBody');
    document.getElementById('fichaTitle').textContent = r.titulo;
    var render = function (det) {
      det = det || {};
      var poster = det.poster || r.portadaUrl;
      var catLabel = r.tipo === 'peliculas' ? '🎬 Película' : r.tipo === 'series' ? '📺 Serie' : '🌸 Anime';
      var safeTitle = (r.titulo || '').replace(/'/g, '');
      body.innerHTML =
        '<div class="ficha-top">' +
          '<div class="ficha-poster">' + (poster ? '<img src="' + esc(poster) + '" onerror="this.style.display=\'none\'">' : '') + '</div>' +
          '<div class="ficha-info">' +
            '<div class="ficha-meta">' + catLabel + ' · 📅 ' + fmtDate(r.fecha) + '</div>' +
            (det.genres && det.genres.length ? '<div class="ficha-genres">' + det.genres.map(function (g) { return '<span class="mt-badge mt-badge--genre">' + esc(g) + '</span>'; }).join('') + '</div>' : '') +
            (det.overview ? '<p class="ficha-overview">' + esc(det.overview) + '</p>' : '<p class="ficha-overview" style="color:var(--txt3)">Sin sinopsis disponible.</p>') +
            '<button class="gen-hero__btn gen-hero__btn--play" style="margin-top:0.6rem" onclick="window.MTGen._trailerR(\'' + r.tmdbId + '\',\'' + safeTitle + '\')">▶ Ver tráiler en YouTube</button>' +
          '</div>' +
        '</div>';
    };
    var det = _heroDetails[r.tmdbId];
    if (det) render(det);
    else { body.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--txt3)">Cargando ficha…</div>'; fetchDetail(r).then(render); }
    document.getElementById('fichaModal').classList.add('open');
  }
  function closeFicha() { document.getElementById('fichaModal').classList.remove('open'); }
  function trailerByTmdb(tmdbId, title) {
    var det = _heroDetails[tmdbId];
    if (det && det.trailerKey) window.open('https://www.youtube.com/watch?v=' + det.trailerKey, '_blank');
    else window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent(title + ' tráiler español'), '_blank');
  }

  /* ══ BUSCADOR (biblioteca) ══════════════════════════════════ */
  function renderSearch(query) {
    var box = document.getElementById('genSearchResults');
    var q = (query || '').toLowerCase().trim();
    if (!q) { hideSearch(); return; }
    var list = _items.filter(function (i) { return (i.titulo || '').toLowerCase().indexOf(q) >= 0; })
      .sort(function (a, b) { return (a.titulo || '').localeCompare(b.titulo || '', 'es'); })
      .slice(0, 8);
    if (!list.length) { box.innerHTML = '<div class="gen-search__empty">Nada en la biblioteca para "' + esc(query) + '"</div>'; box.style.display = 'block'; return; }
    box.innerHTML = list.map(function (it) {
      var poster = it.portadaUrl ? '<img src="' + esc(it.portadaUrl) + '" onerror="this.style.display=\'none\'">' : '<div class="gen-search__ph">' + U().catEmoji(it.tipo) + '</div>';
      return '<a class="gen-search__item" href="mt-biblioteca.html?cat=' + it.tipo + '&open=' + encodeURIComponent(it.id) + '">' +
        '<div class="gen-search__poster">' + poster + '</div>' +
        '<div class="gen-search__info"><div class="gen-search__title">' + esc(it.titulo) + '</div>' +
          '<div class="gen-search__meta">' + U().catEmoji(it.tipo) + ' ' + (it.anio || it['año'] || '') + '</div></div>' +
      '</a>';
    }).join('');
    box.style.display = 'block';
  }
  function hideSearch() { var b = document.getElementById('genSearchResults'); if (b) b.style.display = 'none'; }

  /* ══ TOP 3 (2026 / histórico) ═══════════════════════════════ */
  function globalNota(item) {
    var u = U();
    var vals = PLAYERS.map(function (p) { return u.resolvePlayerNota(item, p); })
      .filter(function (v) { return v !== null && v !== undefined && !isNaN(v); });
    if (!vals.length) return null;
    return vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
  }

  function topFor(cat) {
    var list = _items.filter(function (i) { return i.tipo === cat; });
    if (_topScope === '2026') list = list.filter(function (i) { return String(i.anio || i['año'] || '') === '2026'; });
    return list.map(function (i) { return { item: i, nota: globalNota(i) }; })
      .filter(function (x) { return x.nota !== null; })
      .sort(function (a, b) { return b.nota - a.nota; })
      .slice(0, 10);
  }

  function renderTops() {
    document.getElementById('topScopeLabel').textContent = _topScope === '2026' ? '2026' : 'Histórico';
    document.getElementById('topScopeBtn').textContent = _topScope === '2026' ? '🏆 Ver TOP Histórico' : '📅 Ver TOP 2026';

    [['peliculas', 'top-peliculas'], ['series', 'top-series'], ['anime', 'top-anime']].forEach(function (pair) {
      var cat = pair[0], el = document.getElementById(pair[1]);
      if (!el) return;
      var full = topFor(cat);
      var expanded = _topExpanded[cat];
      var list = expanded ? full : full.slice(0, 5);
      if (!full.length) {
        el.innerHTML = '<div class="mt-top__empty">Sin títulos puntuados' + (_topScope === '2026' ? ' de 2026' : '') + '.</div>';
        return;
      }
      var rows = list.map(function (x, idx) {
        var u = U(), it = x.item, color = u.notaColor(x.nota);
        var poster = it.portadaUrl ? '<img src="' + esc(it.portadaUrl) + '" loading="lazy" onerror="this.style.display=\'none\'">' : '<div class="mt-top-row__ph">' + u.catEmoji(cat) + '</div>';
        var rankCls = idx === 0 ? ' mt-top-row--gold' : idx === 1 ? ' mt-top-row--silver' : idx === 2 ? ' mt-top-row--bronze' : '';
        return '<a class="mt-top-row' + rankCls + '" href="mt-biblioteca.html?cat=' + cat + '&open=' + encodeURIComponent(it.id) + '">' +
          '<div class="mt-top-row__rank">' + (idx + 1) + '</div>' +
          '<div class="mt-top-row__poster">' + poster + '</div>' +
          '<div class="mt-top-row__info"><div class="mt-top-row__title">' + esc(it.titulo) + '</div>' +
            '<div class="mt-top-row__meta">' + (it.anio || it['año'] || '') + '</div></div>' +
          '<div class="mt-top-row__nota" style="color:' + color + '">' + u.formatNota(x.nota) + '</div>' +
        '</a>';
      }).join('');
      var more = full.length > 5
        ? '<button class="mt-top__more" onclick="window.MTGen._toggleTop(\'' + cat + '\')">' + (expanded ? 'Ver menos ▲' : 'Ver top completo ▼') + '</button>'
        : '';
      el.innerHTML = rows + more;
    });
  }

  function toggleTop(cat) { _topExpanded[cat] = !_topExpanded[cat]; renderTops(); }

  /* ══ PRÓXIMOS ESTRENOS (columna derecha) ════════════════════ */
  function renderUpcoming() {
    var el = document.getElementById('genUpcoming');
    var todayStr = new Date().toISOString().slice(0, 10);
    var list = _releases.filter(function (r) { return r.fecha && r.fecha >= todayStr; })
      .sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; }).slice(0, 8);
    if (!list.length) { el.innerHTML = '<div class="mt-upcoming__empty">No hay estrenos próximos.</div>'; return; }
    el.innerHTML = list.map(function (r) {
      var poster = r.portadaUrl ? '<img src="' + esc(r.portadaUrl) + '" onerror="this.style.display=\'none\'">' : '<div class="mt-upcoming__ph">' + U().catEmoji(r.tipo) + '</div>';
      var sid = r.id.replace(/'/g, "\\'");
      return '<div class="mt-upcoming__item mt-upcoming__item--' + (r.tipo || 'peliculas') + '" title="Editar fecha" onclick="window.MTGen._editRel(\'' + sid + '\')">' +
        '<div class="mt-upcoming__poster">' + poster + '</div>' +
        '<div class="mt-upcoming__info"><div class="mt-upcoming__title">' + esc(r.titulo) + '</div>' +
          '<div class="mt-upcoming__meta">' + fmtDateShort(r.fecha) + '</div></div>' +
        '<button class="mt-upcoming__del" title="Eliminar" onclick="event.stopPropagation();window.MTGen._delRel(\'' + sid + '\')">✕</button>' +
      '</div>';
    }).join('');
  }

  /* ══ ESTADÍSTICAS ═══════════════════════════════════════════ */
  function renderStats() {
    var u = U(), p = _statsPlayer;
    var pel = 0, ser = 0, ani = 0, mins = 0;
    _items.forEach(function (it) {
      var n = u.normEstado(u.resolvePlayerEstado(it, p));
      if (!(n === 'visto' || n === 'vista')) return;
      if (it.tipo === 'peliculas') { pel++; mins += parseFloat(it.duracion) || 0; }
      else if (it.tipo === 'series') { ser++; mins += (parseInt(it.episodios) || 0) * 45; }
      else if (it.tipo === 'anime') { ani++; mins += (parseInt(it.episodios) || 0) * 24; }
    });
    var horas = Math.round(mins / 60);
    document.getElementById('statPel').textContent   = pel;
    document.getElementById('statSer').textContent   = ser;
    document.getElementById('statAni').textContent   = ani;
    document.getElementById('statHoras').textContent = horas > 999 ? (Math.round(horas / 100) / 10) + 'k' : horas;
  }

  /* ══ CALENDARIO (modal) ═════════════════════════════════════ */
  function openCalendar() { renderCalendar(); document.getElementById('calendarModal').classList.add('open'); }
  function closeCalendar() { document.getElementById('calendarModal').classList.remove('open'); }

  function releasesOn(y, m, d) {
    return _releases.filter(function (r) {
      if (!r.fecha) return false;
      var p = r.fecha.split('-');
      return parseInt(p[0]) === y && (parseInt(p[1]) - 1) === m && parseInt(p[2]) === d;
    });
  }
  function renderCalendar() {
    var host = document.getElementById('mtCalendar');
    if (!host) return;
    var y = _view.getFullYear(), m = _view.getMonth();
    var lbl = document.getElementById('calMonthLabel');
    if (lbl) lbl.textContent = MESES[m] + ' ' + y;
    var firstDow = (new Date(y, m, 1).getDay() + 6) % 7;
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var today = new Date();
    var isToday = function (d) { return today.getFullYear() === y && today.getMonth() === m && today.getDate() === d; };
    var head = DIAS.map(function (d) { return '<div class="mt-cal__dow">' + d + '</div>'; }).join('');
    var cells = '';
    for (var i = 0; i < firstDow; i++) cells += '<div class="mt-cal__cell mt-cal__cell--empty"></div>';
    for (var d = 1; d <= daysInMonth; d++) {
      var rels = releasesOn(y, m, d);
      var relHtml = rels.map(function (r) {
        return '<div class="mt-cal__rel mt-cal__rel--' + (r.tipo || 'peliculas') + '" title="' + esc(r.titulo) + ' — editar" ' +
          'onclick="window.MTGen._editRel(\'' + r.id.replace(/'/g, "\\'") + '\')">' + esc(r.titulo) + '</div>';
      }).join('');
      cells += '<div class="mt-cal__cell' + (isToday(d) ? ' mt-cal__cell--today' : '') + (rels.length ? ' mt-cal__cell--has' : '') + '">' +
        '<div class="mt-cal__daynum">' + d + '</div><div class="mt-cal__rels">' + relHtml + '</div></div>';
    }
    host.innerHTML = '<div class="mt-cal__grid mt-cal__grid--head">' + head + '</div><div class="mt-cal__grid">' + cells + '</div>';
  }

  function fmtDate(iso) { var p = iso.split('-'); return parseInt(p[2]) + ' ' + MESES[parseInt(p[1]) - 1] + ' ' + p[0]; }
  function fmtDateShort(iso) { var p = iso.split('-'); return parseInt(p[2]) + ' ' + MESES[parseInt(p[1]) - 1].slice(0, 3) + ' ' + p[0]; }

  /* ══ AÑADIR / EDITAR ESTRENO (TMDB) ═════════════════════════ */
  function openAddModal() {
    _addPick = null; _tmdbResults = []; _addCat = 'peliculas'; _editingRelId = null;
    document.getElementById('estrenoModalTitle').textContent = 'Añadir estreno';
    document.getElementById('estrenoDelete').style.display = 'none';
    document.querySelectorAll('.estreno-cat-tab').forEach(function (t) { t.classList.toggle('estreno-cat-tab--active', t.dataset.cat === 'peliculas'); });
    document.getElementById('estrenoSearchInput').value = '';
    document.getElementById('estrenoResults').innerHTML = '';
    showEstrenoStep(1);
    document.getElementById('estrenoModal').classList.add('open');
    setTimeout(function () { document.getElementById('estrenoSearchInput').focus(); }, 120);
  }
  function closeAddModal() { document.getElementById('estrenoModal').classList.remove('open'); _addPick = null; _editingRelId = null; }
  function showEstrenoStep(n) {
    document.getElementById('estrenoStep1').style.display = n === 1 ? '' : 'none';
    document.getElementById('estrenoStep2').style.display = n === 2 ? '' : 'none';
    document.getElementById('estrenoSave').style.display  = n === 2 ? '' : 'none';
    document.getElementById('estrenoBack').style.display  = (n === 2 && !_editingRelId) ? '' : 'none';
  }

  function previewHTML(pick) {
    return (pick.portadaUrl ? '<img src="' + esc(pick.portadaUrl) + '" class="mt-add-preview__poster" onerror="this.style.display=\'none\'">' : '<div class="mt-add-preview__poster"></div>') +
      '<div><div class="mt-add-preview__title">' + esc(pick.titulo) + '</div>' +
      '<div class="mt-add-preview__meta">' + U().catEmoji(pick.tipo) + ' ' + (pick.tipo === 'peliculas' ? 'Película' : pick.tipo === 'series' ? 'Serie' : 'Anime') + '</div></div>';
  }

  /* Fecha de estreno en España (TMDB release_dates); null si no la tiene */
  function fetchESDate(tmdbId) {
    return fetch('https://api.themoviedb.org/3/movie/' + tmdbId + '/release_dates?api_key=' + TMDB_KEY)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var es = (data.results || []).find(function (x) { return x.iso_3166_1 === 'ES'; });
        if (!es || !es.release_dates || !es.release_dates.length) return null;
        var chosen = null;
        [3, 2, 1, 4, 5].forEach(function (t) { if (!chosen) chosen = es.release_dates.find(function (d) { return d.type === t; }); });
        if (!chosen) chosen = es.release_dates[0];
        return (chosen.release_date || '').slice(0, 10) || null;
      }).catch(function () { return null; });
  }

  function doTMDBSearch() {
    var query = document.getElementById('estrenoSearchInput').value.trim();
    if (!query) return;
    var isFilm = _addCat === 'peliculas';
    var url = 'https://api.themoviedb.org/3' + (isFilm ? '/search/movie' : '/search/tv') +
      '?api_key=' + TMDB_KEY + '&language=es-ES&query=' + encodeURIComponent(query);
    var el = document.getElementById('estrenoResults');
    el.innerHTML = '<div class="mt-tmdb-msg">Buscando...</div>';
    fetch(url).then(function (r) { return r.json(); }).then(function (data) {
      _tmdbResults = (data.results || []).slice(0, 8);
      if (!_tmdbResults.length) { el.innerHTML = '<div class="mt-tmdb-msg">Sin resultados.</div>'; return; }
      el.innerHTML = _tmdbResults.map(function (r, idx) {
        var title = r.title || r.name || '—';
        var date  = r.release_date || r.first_air_date || '';
        var poster = r.poster_path ? '<img src="' + IMG_SMALL + r.poster_path + '" class="mt-add-result__poster" onerror="this.style.display=\'none\'">' : '<div class="mt-add-result__poster"></div>';
        return '<div class="mt-add-result" onclick="window.MTGen._pickTMDB(' + idx + ')">' + poster +
          '<div style="flex:1;min-width:0"><div class="mt-add-result__title">' + esc(title) + '</div>' +
          '<div class="mt-add-result__meta">' + (date ? fmtDate(date) : 'Sin fecha') + '</div></div></div>';
      }).join('');
    }).catch(function () { el.innerHTML = '<div class="mt-tmdb-msg">❌ Error al buscar en TMDB.</div>'; });
  }

  function pickTMDB(idx) {
    var r = _tmdbResults[idx]; if (!r) return;
    var date = r.release_date || r.first_air_date || '';
    _addPick = { titulo: r.title || r.name || '', tipo: _addCat, fecha: date || '', portadaUrl: r.poster_path ? IMG_FULL + r.poster_path : null, tmdbId: r.id };
    document.getElementById('estrenoPreview').innerHTML = previewHTML(_addPick);
    document.getElementById('estrenoFecha').value = _addPick.fecha || '';
    document.getElementById('estrenoDateHint').textContent = 'Fecha de TMDB — ajústala a la de España si hace falta.';
    showEstrenoStep(2);
    /* Para películas: intentar la fecha de estreno en España */
    if (_addCat === 'peliculas') {
      fetchESDate(r.id).then(function (d) {
        if (d && _addPick && _addPick.tmdbId === r.id) {
          _addPick.fecha = d;
          var fi = document.getElementById('estrenoFecha'); if (fi) fi.value = d;
          document.getElementById('estrenoDateHint').textContent = '📍 Fecha de estreno en España (según TMDB).';
        }
      });
    }
  }

  function editRel(id) {
    var r = _releases.find(function (x) { return x.id === id; }); if (!r) return;
    _editingRelId = id;
    _addPick = { titulo: r.titulo, tipo: r.tipo, fecha: r.fecha, portadaUrl: r.portadaUrl, tmdbId: r.tmdbId };
    document.getElementById('estrenoModalTitle').textContent = 'Editar estreno';
    document.getElementById('estrenoPreview').innerHTML = previewHTML(_addPick);
    document.getElementById('estrenoFecha').value = r.fecha || '';
    document.getElementById('estrenoDateHint').textContent = 'Cambia la fecha (usa la de estreno en España).';
    document.getElementById('estrenoDelete').style.display = '';
    showEstrenoStep(2);
    document.getElementById('estrenoModal').classList.add('open');
  }

  function saveEstreno() {
    if (!_addPick) return;
    var fecha = document.getElementById('estrenoFecha').value;
    if (!fecha) { var fi = document.getElementById('estrenoFecha'); fi.style.borderColor = 'var(--accent)'; fi.focus(); return; }
    if (_editingRelId) {
      window.MT.getDb().collection('mt_estrenos').doc(_editingRelId).update({ fecha: fecha, tipo: _addPick.tipo })
        .then(closeAddModal).catch(function (e) { console.error(e); alert('Error al guardar.'); });
    } else {
      _addPick.fecha = fecha; _addPick.creadoEn = new Date();
      window.MT.getDb().collection('mt_estrenos').add(_addPick)
        .then(closeAddModal).catch(function (e) { console.error(e); alert('Error al guardar.'); });
    }
  }

  function deleteEditingRel() {
    if (!_editingRelId) return;
    var r = _releases.find(function (x) { return x.id === _editingRelId; });
    if (!confirm('¿Eliminar "' + (r ? r.titulo : 'este estreno') + '" del calendario?')) return;
    window.MT.getDb().collection('mt_estrenos').doc(_editingRelId).delete()
      .then(closeAddModal).catch(function (e) { console.error(e); });
  }

  function delRel(id) {
    var r = _releases.find(function (x) { return x.id === id; });
    if (!confirm('¿Eliminar "' + (r ? r.titulo : 'este estreno') + '" del calendario?')) return;
    window.MT.getDb().collection('mt_estrenos').doc(id).delete().catch(function (e) { console.error(e); });
  }

  window.MTGen = {
    _goHero   : gotoHero,
    _trailer  : heroTrailer,
    _trailerR : trailerByTmdb,
    _ficha    : heroFicha,
    _toggleTop: toggleTop,
    _delRel   : delRel,
    _editRel  : editRel,
    _pickTMDB : pickTMDB
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
