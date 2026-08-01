/* ============================================================
   MEDIA TRACKER — Capa de datos y utilidades compartidas
   Version: 20260522a
   ============================================================ */
window.MT = window.MT || {};

(function () {
  'use strict';

  /* ── COLECCIÓN FIREBASE ─────────────────────────────────── */
  var COLLECTION = 'mt_items';

  /* ── GÉNEROS POR CATEGORÍA ──────────────────────────────── */
  var GENEROS = {
    peliculas: [
      'Acción', 'Terror', 'Animación', 'Comedia', 'Drama',
      'Blockbuster', 'Fantasía', 'Musical', 'Suspense', 'Romántica'
    ],
    series: [
      'Acción', 'Aventura', 'Comedia', 'Crimen', 'Ciencia ficción',
      'Drama', 'Fantasía', 'Horror', 'Misterio', 'Romance',
      'Suspense', 'Thriller', 'Documental', 'Reality', 'Superhéroes',
      'Histórico', 'Procedural', 'Mini-serie', 'Telenovela', 'Animación'
    ],
    anime: [
      'Shonen', 'Shojo', 'Seinen', 'Josei', 'Kodomomuke',
      'Isekai', 'Mecha', 'Slice of Life', 'Deportes', 'Comedia',
      'Romance', 'Drama', 'Acción', 'Aventura', 'Fantasía',
      'Ciencia ficción', 'Horror', 'Misterio', 'Sobrenatural', 'Psicológico'
    ]
  };

  /* ── PLATAFORMAS ─────────────────────────────────────────── */
  var PLATAFORMAS = {
    peliculas: ['Netflix', 'HBO Max', 'Disney+', 'Prime Video', 'Movistar+', 'Apple TV+', 'Filmin', 'Mubi', 'Cine', 'Blu-ray / DVD'],
    series:    ['Netflix', 'HBO Max', 'Disney+', 'Prime Video', 'Movistar+', 'Apple TV+', 'Filmin', 'Atresplayer', 'RTVE Play', 'Peacock'],
    anime:     ['Crunchyroll', 'Netflix', 'Funimation', 'Prime Video', 'Disney+', 'HBO Max', 'HIDIVE', 'ADN']
  };

  /* ── ESTADOS ─────────────────────────────────────────────── */
  var ESTADOS = {
    peliculas: ['Vista', 'Pendiente'],
    series:    ['Viendo', 'Visto', 'Pendiente'],
    anime:     ['Viendo', 'Visto', 'Pendiente']
  };

  /* ── ESTADO ACTUAL ───────────────────────────────────────── */
  var _player = 'Javi';
  var _cat    = 'peliculas';
  var _db     = null;

  function getPlayer() { return _player; }
  function getCat()    { return _cat; }
  function getDb()     { return _db; }

  /* ── INICIALIZAR DESDE LOCALSTORAGE + URL ─────────────────── */
  function init() {
    try {
      _player = localStorage.getItem('MT_player') || 'Javi';
      var urlCat = new URLSearchParams(window.location.search).get('cat');
      _cat = urlCat || localStorage.getItem('MT_cat') || 'peliculas';
    } catch (e) {}

    /* Aplicar tema visual */
    applyTheme(_cat);

    /* Esperar Firebase y configurar db */
    waitForFirebase(function (db) {
      _db = db;
      window.MT.db = db;
    });
  }

  function waitForFirebase(cb) {
    if (window.firebase && window.firebase.firestore) {
      cb(window.firebase.firestore());
      return;
    }
    setTimeout(function () { waitForFirebase(cb); }, 60);
  }

  /* ── TEMA VISUAL ─────────────────────────────────────────── */
  function applyTheme(cat) {
    document.documentElement.setAttribute('data-mt-cat', cat || 'peliculas');
    /* Actualizar color de meta theme-color */
    var accent = cat === 'series' ? '#4361ee' : cat === 'anime' ? '#b5179e' : '#e63946';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = accent;
    /* Actualizar title tag según categoría */
    updateCatUI(cat);
  }

  function updateCatUI(cat) {
    /* Tabs */
    document.querySelectorAll('.mt-cat-tab').forEach(function (tab) {
      tab.classList.toggle('mt-cat-tab--active', tab.dataset.cat === cat);
    });
    /* Player pill */
    updatePlayerPill();
  }

  function updatePlayerPill() {
    var pill = document.getElementById('mtPlayerPill');
    if (!pill) return;
    pill.querySelector('.mt-nav__player-avatar').className =
      'mt-nav__player-avatar mt-nav__player-avatar--' + _player.toLowerCase();
    pill.querySelector('.mt-nav__player-avatar').textContent = _player.charAt(0);
    var nameEl = pill.querySelector('.mt-player-pill-name');
    if (nameEl) nameEl.textContent = _player;
  }

  /* ── UTILS ───────────────────────────────────────────────── */
  function escHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function formatNota(nota) {
    if (nota === null || nota === undefined || nota === '') return '—';
    return parseFloat(nota).toFixed(1).replace('.', ',');
  }

  function notaColor(nota) {
    if (!nota && nota !== 0) return '#6b7280';
    var n = Math.max(0, Math.min(10, parseFloat(nota)));
    var hue = Math.round(n * 12);
    return 'hsl(' + hue + ',80%,52%)';
  }

  function statusClass(estado) {
    if (!estado) return 'sinregistrar';
    var e = estado.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')  /* quitar tildes */
      .replace(/[^a-z]/g, '');
    /* Canonicalizar a las clases CSS existentes */
    if (e === 'visto' || e === 'vista' || e === 'terminado' || e === 'terminada') return 'visto';
    if (e === 'viendo') return 'viendo';
    if (e === 'pendiente') return 'pendiente';
    if (e === 'abandonado' || e === 'abandonada') return 'abandonado';
    if (e === 'pausado' || e === 'pausada') return 'pausado';
    return e;
  }

  /* ── RESOLUCIÓN DE ESTADO/NOTA POR JUGADOR (nivel título) ──
     Prioridad al estado/nota de título (jugadores.{p}); si no existe,
     se cae al cálculo por temporadas (compatibilidad datos antiguos). */
  function resolvePlayerEstado(item, player) {
    if (!item) return '';
    var j = item.jugadores && item.jugadores[player];
    if (j && j.estado) return j.estado;
    if (item.temporadas && item.temporadas.length) {
      return calcEstadoTemporadasPlayer(item.temporadas, player) || '';
    }
    return '';
  }

  function resolvePlayerNota(item, player) {
    if (!item) return null;
    var j = item.jugadores && item.jugadores[player];
    if (j && j.nota !== null && j.nota !== undefined && j.nota !== '') {
      var n = parseFloat(j.nota);
      if (!isNaN(n)) return n;
    }
    if (item.temporadas && item.temporadas.length) {
      return calcNotaTemporadasPlayer(item.temporadas, player);
    }
    return null;
  }

  /* Estado "canónico" normalizado (visto/viendo/pendiente/…) para comparaciones */
  function normEstado(estado) {
    return (estado || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
  }

  function calcNotaMedia(jugadores) {
    if (!jugadores) return null;
    var vals = Object.values(jugadores)
      .map(function (j) { return j && j.nota !== null && j.nota !== undefined && j.nota !== '' ? parseFloat(j.nota) : null; })
      .filter(function (v) { return v !== null && !isNaN(v); });
    if (vals.length === 0) return null;
    return vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
  }

  /* ── UTILIDADES TEMPORADAS (series/anime) ─────────────────── */
  function calcNotaTemporadasPlayer(temporadas, player) {
    if (!temporadas || !temporadas.length) return null;
    var notas = [];
    for (var i = 0; i < temporadas.length; i++) {
      var jd = temporadas[i].jugadores && temporadas[i].jugadores[player];
      if (jd && jd.nota !== null && jd.nota !== undefined && jd.nota !== '') {
        var n = parseFloat(jd.nota);
        if (!isNaN(n)) notas.push(n);
      }
    }
    if (!notas.length) return null;
    return notas.reduce(function (a, b) { return a + b; }, 0) / notas.length;
  }

  function calcNotaTemporadasGlobal(temporadas) {
    if (!temporadas || !temporadas.length) return null;
    var all = [];
    ['David', 'Javi', 'Mery'].forEach(function (p) {
      var n = calcNotaTemporadasPlayer(temporadas, p);
      if (n !== null) all.push(n);
    });
    if (!all.length) return null;
    return all.reduce(function (a, b) { return a + b; }, 0) / all.length;
  }

  function calcEstadoTemporadasPlayer(temporadas, player) {
    if (!temporadas || !temporadas.length) return '';
    var estados = temporadas.map(function (t) {
      return t.jugadores && t.jugadores[player] ? (t.jugadores[player].estado || '') : '';
    }).filter(Boolean);
    if (!estados.length) return '';
    function n(e) { return (e || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, ''); }
    if (estados.some(function (e) { return n(e) === 'viendo'; })) return 'Viendo';
    if (estados.every(function (e) { return n(e) === 'terminado' || n(e) === 'terminada'; })) return estados[0];
    if (estados.some(function (e) { return n(e) === 'terminado' || n(e) === 'terminada'; })) return 'Viendo';
    var paus = estados.find(function (e) { return n(e) === 'pausado' || n(e) === 'pausada'; });
    if (paus) return paus;
    var aband = estados.find(function (e) { return n(e) === 'abandonado' || n(e) === 'abandonada'; });
    if (aband) return aband;
    return estados[0];
  }

  function playerDotClass(estado) {
    if (!estado) return 'mt-card__dot--none';
    var e = estado.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
    if (e === 'visto' || e === 'vista' || e === 'terminado' || e === 'terminada') return 'mt-card__dot--visto';
    if (e === 'viendo') return 'mt-card__dot--viendo';
    if (e === 'abandonado' || e === 'abandonada') return 'mt-card__dot--abandonado';
    if (e === 'pausado' || e === 'pausada') return 'mt-card__dot--abandonado';
    return 'mt-card__dot--pendiente';
  }

  function catLabel(cat) {
    return { peliculas: '🎬 Películas', series: '📺 Series', anime: '🌸 Anime' }[cat] || cat;
  }

  function catEmoji(cat) {
    return { peliculas: '🎬', series: '📺', anime: '🌸' }[cat] || '🎬';
  }

  /* ══════════════════════════════════════════════════════════
     NOTA VISUAL — picker con degradado (rojo 0 → verde 10)
     Compartido por Registro, Pendientes y Biblioteca.
  ══════════════════════════════════════════════════════════ */
  var Nota = {
    html: function (base, value) {
      var has  = value !== null && value !== undefined && value !== '';
      var v    = has ? parseFloat(value) : 5;
      var col  = has ? notaColor(v) : 'var(--txt3)';
      var disp = has ? formatNota(v) : '';
      return '<div class="mt-nota-picker" id="' + base + 'Wrap" data-set="' + (has ? '1' : '0') + '">' +
        '<input type="range" min="0" max="10" step="0.1" value="' + v + '" class="mt-nota-picker__range" id="' + base + 'Range" ' +
          'oninput="window.MT.Nota.input(\'' + base + '\')">' +
        '<input type="text" inputmode="decimal" class="mt-nota-picker__val" id="' + base + 'Val" ' +
          'placeholder="—" value="' + disp + '" style="color:' + col + '" ' +
          'oninput="window.MT.Nota.type(\'' + base + '\')">' +
        '<button type="button" class="mt-nota-picker__clear" title="Quitar nota" onclick="window.MT.Nota.clear(\'' + base + '\')">✕</button>' +
      '</div>';
    },
    /* Al arrastrar el slider → actualiza el número editable */
    input: function (base) {
      var wrap = document.getElementById(base + 'Wrap');
      var r    = document.getElementById(base + 'Range');
      var val  = document.getElementById(base + 'Val');
      if (!wrap || !r || !val) return;
      wrap.dataset.set = '1';
      var v = parseFloat(r.value);
      val.value = formatNota(v);
      val.style.color = notaColor(v);
    },
    /* Al teclear el número (admite coma o punto, un decimal libre) */
    type: function (base) {
      var wrap = document.getElementById(base + 'Wrap');
      var r    = document.getElementById(base + 'Range');
      var val  = document.getElementById(base + 'Val');
      if (!wrap || !r || !val) return;
      var raw = (val.value || '').trim().replace(',', '.');
      if (raw === '') { wrap.dataset.set = '0'; val.style.color = 'var(--txt3)'; return; }
      var n = parseFloat(raw);
      if (isNaN(n)) return;
      n = Math.max(0, Math.min(10, n));
      wrap.dataset.set = '1';
      r.value = n;
      val.style.color = notaColor(n);
    },
    clear: function (base) {
      var wrap = document.getElementById(base + 'Wrap');
      var val  = document.getElementById(base + 'Val');
      if (!wrap || !val) return;
      wrap.dataset.set = '0';
      val.value = '';
      val.style.color = 'var(--txt3)';
    },
    read: function (base) {
      var wrap = document.getElementById(base + 'Wrap');
      if (!wrap || wrap.dataset.set !== '1') return null;
      var val = document.getElementById(base + 'Val');
      if (!val) return null;
      var raw = (val.value || '').trim().replace(',', '.');
      if (raw === '') return null;
      var n = parseFloat(raw);
      if (isNaN(n)) return null;
      n = Math.max(0, Math.min(10, n));
      return Math.round(n * 10) / 10;   /* un decimal */
    }
  };

  /* ── HIDE LOADING ────────────────────────────────────────── */
  function hideLoading() {
    var el = document.getElementById('mtLoading');
    if (!el) return;
    el.style.opacity = '0';
    setTimeout(function () { el.style.display = 'none'; }, 420);
  }

  /* ── CAMBIO DE CATEGORÍA (desde tabs nav) ─────────────────── */
  function switchCat(newCat) {
    if (newCat === _cat) return;
    _cat = newCat;
    try { localStorage.setItem('MT_cat', newCat); } catch (e) {}
    applyTheme(newCat);
    /* Re-cargar la página con nuevo param */
    var url = new URL(window.location.href);
    url.searchParams.set('cat', newCat);
    window.history.pushState({}, '', url.toString());
    /* Notificar a la página que recargue datos */
    window.dispatchEvent(new CustomEvent('mt:catChange', { detail: { cat: newCat } }));
  }

  /* ── NAV: click en tabs ──────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.mt-cat-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        switchCat(this.dataset.cat);
      });
    });
    updatePlayerPill();
  });

  /* ── EXPOSE ──────────────────────────────────────────────── */
  window.MT = {
    init        : init,
    getPlayer   : getPlayer,
    getCat      : getCat,
    getDb       : function () { return _db; },
    applyTheme  : applyTheme,
    switchCat   : switchCat,
    hideLoading : hideLoading,
    GENEROS     : GENEROS,
    PLATAFORMAS : PLATAFORMAS,
    ESTADOS     : ESTADOS,
    Nota        : Nota,
    Utils: {
      escHtml                  : escHtml,
      formatNota               : formatNota,
      notaColor                : notaColor,
      statusClass              : statusClass,
      normEstado               : normEstado,
      calcNotaMedia            : calcNotaMedia,
      calcNotaTemporadasPlayer : calcNotaTemporadasPlayer,
      calcNotaTemporadasGlobal : calcNotaTemporadasGlobal,
      calcEstadoTemporadasPlayer: calcEstadoTemporadasPlayer,
      resolvePlayerEstado      : resolvePlayerEstado,
      resolvePlayerNota        : resolvePlayerNota,
      playerDotClass           : playerDotClass,
      catLabel                 : catLabel,
      catEmoji                 : catEmoji
    }
  };

  /* Auto-init cuando el DOM esté listo */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
