/* ============================================================
   MEDIA TRACKER — Importador TMDB
   Version: 20260605e
   ============================================================ */
(function () {
  'use strict';

  var TMDB_KEY  = '2a0181b8eb1bb888042a00f91e10681c';
  var IMG_SMALL = 'https://image.tmdb.org/t/p/w200';
  var IMG_FULL  = 'https://image.tmdb.org/t/p/w500';

  /* Mapa de géneros TMDB → nuestros géneros */
  var GENRE_MAP = {
    28: 'Acción',    12: 'Blockbuster', 16: 'Animación',  35: 'Comedia',
    80: 'Suspense',  99: 'Drama',       18: 'Drama',    10751: 'Animación',
    14: 'Fantasía',  36: 'Drama',       27: 'Terror',   10402: 'Musical',
  9648: 'Suspense',10749: 'Romántica',  878: 'Blockbuster', 53: 'Suspense',
 10752: 'Drama',    37: 'Drama',      10770: 'Drama'
  };

  var NUESTROS_GENEROS = ['Acción','Terror','Animación','Comedia','Drama','Blockbuster','Fantasía','Musical','Suspense','Romántica'];

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

  /* ── BÚSQUEDA ─────────────────────────────────────────────── */
  async function buscarPelicula(titulo) {
    var search = await tmdb('/search/movie?query=' + encodeURIComponent(titulo));
    if (!search.results || !search.results.length) {
      return { titulo: titulo, found: false };
    }

    var movie = search.results[0];
    await sleep(260); /* evitar rate-limit: ~230ms entre llamadas */

    var details = await tmdb('/movie/' + movie.id + '?append_to_response=credits');

    /* Director */
    var crew     = (details.credits && details.credits.crew) || [];
    var dirEntry = null;
    for (var i = 0; i < crew.length; i++) {
      if (crew[i].job === 'Director') { dirEntry = crew[i]; break; }
    }

    /* Géneros → nuestros géneros (hasta 2) */
    var tmdbGenres = details.genres || [];
    var generos    = [];
    for (var j = 0; j < tmdbGenres.length; j++) {
      var mapped = GENRE_MAP[tmdbGenres[j].id];
      if (mapped && generos.indexOf(mapped) < 0) generos.push(mapped);
      if (generos.length >= 2) break;
    }

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

  /* ── FASE 1 → FASE 2: BUSCAR ─────────────────────────────── */
  async function onBuscar() {
    var raw    = document.getElementById('titleInput').value.trim();
    if (!raw) return;

    var titles = raw.split('\n').map(function (t) { return t.trim(); }).filter(Boolean);
    if (!titles.length) return;

    document.getElementById('step1').style.display         = 'none';
    document.getElementById('stepProgress').style.display  = '';
    document.getElementById('progressTotal').textContent   = titles.length;

    _results = [];

    for (var i = 0; i < titles.length; i++) {
      document.getElementById('progressCurrent').textContent = i + 1;
      document.getElementById('progressTitle').textContent   = '🔍 ' + titles[i];
      document.getElementById('progressBar').style.width     =
        Math.round((i + 1) / titles.length * 100) + '%';

      try {
        var result = await buscarPelicula(titles[i]);
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
    var found   = _results.filter(function (r) { return r.found; });
    var noFound = _results.filter(function (r) { return !r.found; });

    document.getElementById('stepResults').style.display = '';
    document.getElementById('resFound').textContent      = found.length + ' encontradas';

    var errBadge = document.getElementById('resNoFound');
    if (noFound.length) {
      errBadge.textContent    = noFound.length + ' no encontradas';
      errBadge.style.display  = '';
    } else {
      errBadge.style.display  = 'none';
    }

    var list = document.getElementById('resultList');
    list.innerHTML = _results.map(function (r, idx) {
      if (!r.found) {
        return '<div class="imp-row imp-row--notfound">' +
          '<div class="imp-row__notfound">❌ No encontrada en TMDB: <em>' + escHtml(r.titulo) + '</em></div>' +
        '</div>';
      }

      var thumb = r.portadaThumb
        ? '<img src="' + escHtml(r.portadaThumb) + '" loading="lazy" onerror="this.style.display=\'none\'">'
        : '<div class="imp-cover-ph">🎬</div>';

      var genOpts = '<option value="">Sin género</option>' +
        NUESTROS_GENEROS.map(function (g) {
          return '<option value="' + g + '"' + (r.generos[0] === g ? ' selected' : '') + '>' + g + '</option>';
        }).join('');

      return '<div class="imp-row">' +
        '<label class="imp-row__check"><input type="checkbox" class="imp-cb" data-idx="' + idx + '" checked></label>' +
        '<div class="imp-row__cover">' + thumb + '</div>' +
        '<div class="imp-row__info">' +
          '<div class="imp-row__title">' + escHtml(r.titulo) + '</div>' +
          '<div class="imp-row__meta">' +
            (r.anio     ? '<span class="imp-tag">' + r.anio + '</span>' : '') +
            (r.duracion ? '<span class="imp-tag">' + r.duracion + ' min</span>' : '') +
            (r.director ? '<span class="imp-dir">· ' + escHtml(r.director) + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="imp-row__genre">' +
          '<select class="mt-select imp-sel" data-idx="' + idx + '">' + genOpts + '</select>' +
          (r.generos[1] ? '<div class="imp-g2">+ ' + escHtml(r.generos[1]) + '</div>' : '') +
        '</div>' +
      '</div>';
    }).join('');

    /* Sync cambios de género */
    list.querySelectorAll('.imp-sel').forEach(function (sel) {
      sel.addEventListener('change', function () {
        _results[parseInt(this.dataset.idx)].generos[0] = this.value;
      });
    });

    /* Actualizar contador al marcar/desmarcar */
    list.querySelectorAll('.imp-cb').forEach(function (cb) {
      cb.addEventListener('change', updateImportBtn);
    });

    updateImportBtn();
  }

  function updateImportBtn() {
    var n = document.querySelectorAll('.imp-cb:checked').length;
    document.getElementById('importBtn').textContent =
      'Importar ' + n + ' película' + (n !== 1 ? 's' : '');
    document.getElementById('importBtn').disabled = n === 0;
  }

  /* ── FASE 4: IMPORTAR ────────────────────────────────────── */
  function onImport() {
    var db = window.firebase && window.firebase.firestore ? window.firebase.firestore() : null;
    if (!db) { alert('Firebase no disponible. Recarga la página.'); return; }

    var idxs = Array.from(document.querySelectorAll('.imp-cb:checked')).map(function (cb) {
      return parseInt(cb.dataset.idx);
    });
    if (!idxs.length) return;

    var btn = document.getElementById('importBtn');
    btn.disabled     = true;
    btn.textContent  = 'Importando...';

    var promises = idxs.map(function (idx) {
      var r    = _results[idx];
      var cat  = (window.MT && window.MT.getCat()) || 'peliculas';
      var data = {
        tipo      : cat,
        titulo    : r.titulo,
        portadaUrl: r.portadaUrl  || null,
        anio      : r.anio        || null,
        director  : r.director    || null,
        duracion  : r.duracion    || null,
        generos   : r.generos.filter(Boolean),
        createdAt : window.firebase.firestore.FieldValue.serverTimestamp()
      };
      return db.collection('mt_items').add(data);
    });

    Promise.all(promises)
      .then(function () {
        document.getElementById('stepResults').style.display = 'none';
        document.getElementById('stepDone').style.display    = '';
        document.getElementById('doneCount').textContent      = idxs.length;
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
