/* ============================================================
   MEDIA TRACKER — Importador TMDB
   Version: 20260606a
   ============================================================ */
(function () {
  'use strict';

  var TMDB_KEY  = '2a0181b8eb1bb888042a00f91e10681c';
  var IMG_SMALL = 'https://image.tmdb.org/t/p/w200';
  var IMG_FULL  = 'https://image.tmdb.org/t/p/w500';

  var _results = [];

  /* ── UTILIDADES ──────────────────────────────────────────── */
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function tmdb(path) {
    var sep = path.indexOf('?') >= 0 ? '&' : '?';
    var url = 'https://api.themoviedb.org/3' + path + sep + 'api_key=' + TMDB_KEY + '&language=es-ES';
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('TMDB ' + r.status);
      return r.json();
    });
  }

  function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── BÚSQUEDA: PELÍCULA ──────────────────────────────────── */
  async function buscarPelicula(titulo) {
    var search = await tmdb('/search/movie?query=' + encodeURIComponent(titulo));
    if (!search.results || !search.results.length) return { titulo: titulo, found: false };

    var movie = search.results[0];
    await sleep(260);

    var details = await tmdb('/movie/' + movie.id + '?append_to_response=credits');

    /* Director */
    var crew     = (details.credits && details.credits.crew) || [];
    var dirEntry = null;
    for (var i = 0; i < crew.length; i++) {
      if (crew[i].job === 'Director') { dirEntry = crew[i]; break; }
    }

    /* Géneros directos de TMDB en español */
    var generos = (details.genres || []).map(function (g) { return g.name; });

    return {
      found       : true,
      titulo      : details.title || movie.title,
      portadaUrl  : movie.poster_path ? IMG_FULL  + movie.poster_path : null,
      portadaThumb: movie.poster_path ? IMG_SMALL + movie.poster_path : null,
      anio        : movie.release_date ? parseInt(movie.release_date.split('-')[0]) : null,
      director    : dirEntry ? dirEntry.name : null,
      duracion    : details.runtime || null,
      generos     : generos
    };
  }

  /* ── BÚSQUEDA: SERIE / ANIME ─────────────────────────────── */
  async function buscarTV(titulo) {
    var search = await tmdb('/search/tv?query=' + encodeURIComponent(titulo));
    if (!search.results || !search.results.length) return { titulo: titulo, found: false };

    var show = search.results[0];
    await sleep(260);

    var details = await tmdb('/tv/' + show.id);

    /* Creador / red */
    var createdBy = details.created_by && details.created_by.length ? details.created_by[0].name : null;
    var studio    = details.networks   && details.networks.length   ? details.networks[0].name   : null;

    /* Géneros directos de TMDB en español */
    var generos = (details.genres || []).map(function (g) { return g.name; });

    /* Temporadas — sin season 0 (especiales) */
    var seasons    = (details.seasons || []).filter(function (s) { return s.season_number > 0; });
    var temporadas = seasons.map(function (s) {
      return {
        num      : s.season_number,
        episodios: s.episode_count || null,
        jugadores: {
          David: { estado: '', nota: null },
          Javi:  { estado: '', nota: null },
          Mery:  { estado: '', nota: null }
        }
      };
    });

    return {
      found        : true,
      titulo       : details.name || show.name,
      portadaUrl   : show.poster_path ? IMG_FULL  + show.poster_path : null,
      portadaThumb : show.poster_path ? IMG_SMALL + show.poster_path : null,
      anio         : details.first_air_date ? parseInt(details.first_air_date.split('-')[0]) : null,
      estudio      : createdBy || studio || null,
      generos      : generos,
      numTemporadas: details.number_of_seasons || temporadas.length,
      temporadas   : temporadas
    };
  }

  /* ── FASE 1 → FASE 2: BUSCAR ─────────────────────────────── */
  async function onBuscar() {
    var raw = document.getElementById('titleInput').value.trim();
    if (!raw) return;

    var titles = raw.split('\n').map(function (t) { return t.trim(); }).filter(Boolean);
    if (!titles.length) return;

    var cat    = (window.MT && window.MT.getCat()) || 'peliculas';
    var isFilm = cat === 'peliculas';

    document.getElementById('step1').style.display        = 'none';
    document.getElementById('stepProgress').style.display = '';
    document.getElementById('progressTotal').textContent  = titles.length;

    _results = [];

    for (var i = 0; i < titles.length; i++) {
      document.getElementById('progressCurrent').textContent = i + 1;
      document.getElementById('progressTitle').textContent   = '🔍 ' + titles[i];
      document.getElementById('progressBar').style.width     =
        Math.round((i + 1) / titles.length * 100) + '%';

      try {
        var result = await (isFilm ? buscarPelicula(titles[i]) : buscarTV(titles[i]));
        _results.push(result);
      } catch (e) {
        console.warn('Error buscando:', titles[i], e);
        _results.push({ titulo: titles[i], found: false });
      }
    }

    document.getElementById('stepProgress').style.display = 'none';
    showResults();
  }

  /* ── FASE 3: MOSTRAR RESULTADOS ──────────────────────────── */
  function showResults() {
    var cat    = (window.MT && window.MT.getCat()) || 'peliculas';
    var isFilm = cat === 'peliculas';
    var catEmoji = isFilm ? '🎬' : cat === 'series' ? '📺' : '🌸';
    var found   = _results.filter(function (r) { return r.found; });
    var noFound = _results.filter(function (r) { return !r.found; });

    document.getElementById('stepResults').style.display = '';
    document.getElementById('resFound').textContent      = found.length + ' encontrados';

    var errBadge = document.getElementById('resNoFound');
    if (noFound.length) {
      errBadge.textContent   = noFound.length + ' no encontrados';
      errBadge.style.display = '';
    } else {
      errBadge.style.display = 'none';
    }

    var list = document.getElementById('resultList');
    list.innerHTML = _results.map(function (r, idx) {
      if (!r.found) {
        return '<div class="imp-row imp-row--notfound">' +
          '<div class="imp-row__notfound">❌ No encontrado en TMDB: <em>' + escHtml(r.titulo) + '</em></div>' +
        '</div>';
      }

      var thumb = r.portadaThumb
        ? '<img src="' + escHtml(r.portadaThumb) + '" loading="lazy" onerror="this.style.display=\'none\'">'
        : '<div class="imp-cover-ph">' + catEmoji + '</div>';

      /* Meta line */
      var metaLine = '';
      if (r.anio)          metaLine += '<span class="imp-tag">' + r.anio + '</span>';
      if (r.duracion)      metaLine += '<span class="imp-tag">' + r.duracion + ' min</span>';
      if (r.numTemporadas) metaLine += '<span class="imp-tag">' + r.numTemporadas + ' temp.</span>';
      if (r.director)      metaLine += '<span class="imp-dir">· ' + escHtml(r.director) + '</span>';
      if (r.estudio)       metaLine += '<span class="imp-dir">· ' + escHtml(r.estudio) + '</span>';

      /* Géneros como chips */
      var genTags = (r.generos || []).map(function (g) {
        return '<span class="imp-tag imp-tag--genre">' + escHtml(g) + '</span>';
      }).join('');

      return '<div class="imp-row">' +
        '<label class="imp-row__check"><input type="checkbox" class="imp-cb" data-idx="' + idx + '" checked></label>' +
        '<div class="imp-row__cover">' + thumb + '</div>' +
        '<div class="imp-row__info">' +
          '<div class="imp-row__title">' + escHtml(r.titulo) + '</div>' +
          (metaLine ? '<div class="imp-row__meta">' + metaLine + '</div>' : '') +
          (genTags  ? '<div class="imp-row__meta imp-row__genres">' + genTags + '</div>' : '') +
        '</div>' +
      '</div>';
    }).join('');

    /* Actualizar contador al marcar/desmarcar */
    list.querySelectorAll('.imp-cb').forEach(function (cb) {
      cb.addEventListener('change', updateImportBtn);
    });

    updateImportBtn();
  }

  function updateImportBtn() {
    var cat    = (window.MT && window.MT.getCat()) || 'peliculas';
    var labels = { peliculas: 'película', series: 'serie', anime: 'anime' };
    var label  = labels[cat] || 'título';
    var n = document.querySelectorAll('.imp-cb:checked').length;
    document.getElementById('importBtn').textContent =
      'Importar ' + n + ' ' + label + (n !== 1 ? 's' : '');
    document.getElementById('importBtn').disabled = n === 0;
  }

  /* ── FASE 4: IMPORTAR ────────────────────────────────────── */
  function onImport() {
    var db = window.firebase && window.firebase.firestore ? window.firebase.firestore() : null;
    if (!db) { alert('Firebase no disponible. Recarga la página.'); return; }

    var cat    = (window.MT && window.MT.getCat()) || 'peliculas';
    var isFilm = cat === 'peliculas';

    var idxs = Array.from(document.querySelectorAll('.imp-cb:checked')).map(function (cb) {
      return parseInt(cb.dataset.idx);
    });
    if (!idxs.length) return;

    var btn = document.getElementById('importBtn');
    btn.disabled    = true;
    btn.textContent = 'Importando...';

    var promises = idxs.map(function (idx) {
      var r    = _results[idx];
      var data = {
        tipo      : cat,
        titulo    : r.titulo,
        portadaUrl: r.portadaUrl || null,
        anio      : r.anio       || null,
        generos   : (r.generos   || []).filter(Boolean),
        createdAt : window.firebase.firestore.FieldValue.serverTimestamp()
      };
      if (isFilm) {
        data.director = r.director || null;
        data.duracion = r.duracion || null;
      } else {
        data.estudio       = r.estudio       || null;
        data.numTemporadas = r.numTemporadas  || null;
        data.temporadas    = r.temporadas     || [];
      }
      return db.collection('mt_items').add(data);
    });

    Promise.all(promises)
      .then(function () {
        var labels = { peliculas: 'películas', series: 'series', anime: 'animes' };
        document.getElementById('stepResults').style.display = 'none';
        document.getElementById('stepDone').style.display    = '';
        document.getElementById('doneCount').textContent     = idxs.length;
        var lbl = document.getElementById('doneLabel');
        if (lbl) lbl.textContent = labels[cat] || 'títulos';
      })
      .catch(function (err) {
        console.error('Error importando:', err);
        btn.disabled    = false;
        btn.textContent = '⚠️ Error — reintentar';
      });
  }

  /* ── INIT ─────────────────────────────────────────────────── */
  function init() {
    /* Ocultar loading cuando Firebase esté listo */
    var checkFb = setInterval(function () {
      if (window.firebase && window.firebase.apps && window.firebase.apps.length) {
        clearInterval(checkFb);
        var el = document.getElementById('mtLoading');
        if (el) { el.style.opacity = '0'; setTimeout(function () { el.style.display = 'none'; }, 400); }
      }
    }, 80);

    /* Actualizar header/botón al cambiar categoría */
    window.addEventListener('mt:catChange', function () {
      updateImportHeader();
      /* Volver al step1 si estamos en resultados */
      var stepRes = document.getElementById('stepResults');
      if (stepRes && stepRes.style.display !== 'none') {
        stepRes.style.display = 'none';
        document.getElementById('step1').style.display = '';
      }
    });

    document.getElementById('btnBuscar').addEventListener('click', function () {
      var n = document.getElementById('titleInput').value.split('\n').filter(function (l) { return l.trim(); }).length;
      if (!n) return;
      document.getElementById('btnHint').textContent = '';
      onBuscar();
    });

    document.getElementById('titleInput').addEventListener('input', function () {
      var n = this.value.split('\n').filter(function (l) { return l.trim(); }).length;
      document.getElementById('btnHint').textContent = n ? n + ' título' + (n !== 1 ? 's' : '') + ' detectado' + (n !== 1 ? 's' : '') : '';
    });

    document.getElementById('importBtn').addEventListener('click', onImport);

    document.getElementById('btnVolver').addEventListener('click', function () {
      document.getElementById('stepResults').style.display = 'none';
      document.getElementById('step1').style.display       = '';
    });

    document.getElementById('btnSelAll').addEventListener('click', function () {
      document.querySelectorAll('.imp-cb').forEach(function (cb) { cb.checked = true; });
      updateImportBtn();
    });

    document.getElementById('btnSelNone').addEventListener('click', function () {
      document.querySelectorAll('.imp-cb').forEach(function (cb) { cb.checked = false; });
      updateImportBtn();
    });

    document.getElementById('btnReset').addEventListener('click', function () {
      location.reload();
    });

    updateImportHeader();
  }

  function updateImportHeader() {
    var cat  = (window.MT && window.MT.getCat()) || 'peliculas';
    var catLabels = { peliculas: '🎬 Películas', series: '📺 Series', anime: '🌸 Anime' };
    var subs = {
      peliculas: 'Pega la lista de películas (una por línea). Buscaremos póster, año, director y géneros en TMDB.',
      series   : 'Pega la lista de series (una por línea). Buscaremos póster, año, estudio, géneros y todas las temporadas en TMDB.',
      anime    : 'Pega la lista de animes (una por línea). Buscaremos póster, año, estudio, géneros y todas las temporadas en TMDB.'
    };
    var titleEl = document.getElementById('impHeaderTitle');
    var subEl   = document.getElementById('impHeaderSub');
    if (titleEl) titleEl.textContent = '📥 Importar ' + (catLabels[cat] || '');
    if (subEl)   subEl.textContent   = subs[cat] || subs.peliculas;
    updateImportBtn();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
