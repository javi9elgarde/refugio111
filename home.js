/* ============================================================
   REFUGIO 111 — Menú principal de videojuegos
   Carrusel de estrenos, tops por jugador, estrenos, eventos, noticia y cifras.
   ============================================================ */
(function () {
  'use strict';

  var GT         = window.GT;
  var Utils      = GT.Utils;
  var Biblioteca = GT.Biblioteca;
  var Registro   = GT.Registro;

  var MONTHS  = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var PLAYERS = ['David', 'Javi', 'Mery'];
  var COLORS  = { David: '#3b82f6', Javi: '#9b1742', Mery: '#9b59ff' };
  var DONE    = ['Terminado', 'Platinado', 'Rejugado', 'Jugado'];

  var slides = [];
  var slideIdx = 0;
  var slideTimer = null;
  var topAll = false; // false = del año, true = histórico

  function $(id) { return document.getElementById(id); }
  function esc(s) { return Utils.escapeHtml(s == null ? '' : String(s)); }
  function activePlayer() {
    var p = null;
    try { p = localStorage.getItem('GT_player'); } catch (e) {}
    return PLAYERS.indexOf(p) !== -1 ? p : 'Javi';
  }
  function fullDate(g) { return g.fechaLanzamiento && /^\d{4}-\d{2}-\d{2}$/.test(g.fechaLanzamiento) ? g.fechaLanzamiento : null; }
  function fmtDate(iso) { var p = iso.split('-'); return parseInt(p[2], 10) + ' ' + MONTHS[parseInt(p[1], 10) - 1] + ' ' + p[0]; }
  function daysTo(iso) { return Math.round((new Date(iso + 'T00:00:00') - new Date().setHours(0, 0, 0, 0)) / 86400000); }
  function when(iso) { var d = daysTo(iso); return d <= 0 ? 'hoy' : d === 1 ? 'mañana' : 'en ' + d + ' días'; }
  function cssUrl(u) { return String(u).replace(/"/g, '%22'); }

  function upcoming() {
    return Biblioteca.getAll().filter(function (g) { var d = fullDate(g); return d && daysTo(d) >= 0; })
      .sort(function (a, b) { return a.fechaLanzamiento.localeCompare(b.fechaLanzamiento); });
  }

  function thumb(g) {
    return '<div class="gen-thumb">' + (g.portadaUrl ? '<img src="' + esc(g.portadaUrl) + '" alt="" loading="lazy" style="object-position:' + esc(g.portadaPos || 'center top') + '">' : '') + '</div>';
  }

  /* ── USUARIO ─────────────────────────────────────────────── */
  function renderUser() {
    var p = activePlayer();
    $('genUserName').textContent = p;
    $('genUserAv').textContent = p.charAt(0);
    $('genUserAv').style.background = COLORS[p];
    $('statsPlayer').value = p;
  }

  /* ── BUSCADOR ────────────────────────────────────────────── */
  function norm(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  function initSearch() {
    var input = $('genSearch'), box = $('genSearchResults');
    input.addEventListener('input', function () {
      var q = norm(input.value.trim());
      if (q.length < 2) { box.style.display = 'none'; return; }
      var hits = Biblioteca.getAll().filter(function (g) { return norm(g.titulo).indexOf(q) !== -1 || norm(g.desarrollador).indexOf(q) !== -1; }).slice(0, 8);
      box.innerHTML = hits.length
        ? hits.map(function (g) {
            var year = fullDate(g) ? ' · ' + g.fechaLanzamiento.slice(0, 4) : '';
            return '<a class="gen-search__item" href="biblioteca.html?open=' + esc(g.id) + '"><div class="gen-search__poster">' +
              (g.portadaUrl ? '<img src="' + esc(g.portadaUrl) + '" alt="" loading="lazy">' : '') + '</div><div><div class="gen-search__title">' + esc(g.titulo) +
              '</div><div class="gen-search__meta">' + esc(g.desarrollador || 'Sin desarrolladora') + year + '</div></div></a>';
          }).join('')
        : '<div class="gen-search__empty">Sin resultados en tu biblioteca</div>';
      box.style.display = 'block';
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('.gen-search')) box.style.display = 'none'; });
    input.addEventListener('keydown', function (e) { if (e.key === 'Escape') { box.style.display = 'none'; input.blur(); } });
  }

  /* ── CARRUSEL ────────────────────────────────────────────── */
  function buildSlides(featured) {
    var ups = upcoming();
    var list = [];
    if (featured) list.push({ g: featured, badge: '⭐ JUEGO MÁS ESPERADO', feat: true });
    ups.forEach(function (g) {
      if (list.length < 6 && (!featured || g.id !== featured.id)) list.push({ g: g, badge: '🔜 PRÓXIMO ESTRENO' });
    });
    return list;
  }

  function renderHero(featured) {
    slides = buildSlides(featured);
    var hero = $('genHero');
    if (!slides.length) {
      hero.innerHTML = '<div class="gen-hero__empty"><div style="font-size:2rem">🎮</div>No hay estrenos próximos.<br>Añade juegos con fecha de lanzamiento futura en la biblioteca.</div>';
      $('heroPrev').style.display = $('heroNext').style.display = 'none';
      return;
    }
    $('heroPrev').style.display = $('heroNext').style.display = slides.length > 1 ? '' : 'none';
    hero.innerHTML = slides.map(function (s, i) {
      var g = s.g, d = fullDate(g);
      var meta = [g.desarrollador, (g.generos || []).slice(0, 3).join(' · '), (g.plataformas || []).slice(0, 4).join(' · ')].filter(Boolean).join(' — ');
      return '<div class="gen-hero__slide' + (i === 0 ? ' gen-hero__slide--active' : '') + '">' +
        (g.portadaUrl ? '<img class="gen-hero__img" src="' + esc(g.portadaUrl) + '" alt="" style="object-position:' + esc(g.portadaPos || 'center top') + '"' + (i > 0 ? ' loading="lazy"' : '') + '>' : '') +
        '<div class="gen-hero__shade"></div>' +
        '<div class="gen-hero__content">' +
          '<span class="gen-hero__badge' + (s.feat ? ' gen-hero__badge--feat' : '') + '">' + s.badge + '</span>' +
          '<h2 class="gen-hero__title">' + esc(g.titulo) + '</h2>' +
          '<div class="gen-hero__date">📅 ' + (d ? fmtDate(d) + ' · ' + when(d) : 'Sin fecha confirmada') + '</div>' +
          (meta ? '<p class="gen-hero__desc">' + esc(meta) + '</p>' : '') +
          '<div class="gen-hero__actions">' +
            '<a class="gen-hero__btn gen-hero__btn--main" href="biblioteca.html?open=' + esc(g.id) + '">Ver ficha</a>' +
            (s.feat ? '<button type="button" class="gen-hero__btn gen-hero__btn--info" data-pick>✏️ Cambiar</button>' : '') +
          '</div>' +
        '</div></div>';
    }).join('') + '<div class="gen-hero__dots">' + slides.map(function (_, i) {
      return '<button type="button" class="gen-hero__dot' + (i === 0 ? ' gen-hero__dot--active' : '') + '" data-dot="' + i + '" aria-label="Ir al estreno ' + (i + 1) + '"></button>';
    }).join('') + '</div>';
    slideIdx = 0;
    restartTimer();
  }

  function showSlide(i) {
    slideIdx = (i + slides.length) % slides.length;
    document.querySelectorAll('.gen-hero__slide').forEach(function (el, n) { el.classList.toggle('gen-hero__slide--active', n === slideIdx); });
    document.querySelectorAll('.gen-hero__dot').forEach(function (el, n) { el.classList.toggle('gen-hero__dot--active', n === slideIdx); });
  }

  function restartTimer() {
    clearInterval(slideTimer);
    if (slides.length > 1 && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      slideTimer = setInterval(function () { showSlide(slideIdx + 1); }, 7000);
    }
  }

  function initHero() {
    $('heroPrev').addEventListener('click', function () { showSlide(slideIdx - 1); restartTimer(); });
    $('heroNext').addEventListener('click', function () { showSlide(slideIdx + 1); restartTimer(); });
    $('genHero').addEventListener('click', function (e) {
      var dot = e.target.closest('[data-dot]');
      if (dot) { showSlide(parseInt(dot.dataset.dot, 10)); restartTimer(); }
      if (e.target.closest('[data-pick]')) openPick();
    });
  }

  /* ── JUEGO MÁS ESPERADO (se elige a mano; se guarda en settings/featuredGame) ── */
  function loadFeatured() {
    return GT.db.collection('settings').doc('featuredGame').get().then(function (doc) {
      return doc.exists && doc.data().juegoId ? Biblioteca.getById(doc.data().juegoId) : null;
    }).catch(function () { return null; });
  }

  function openPick() {
    var list = $('pickGameList');
    var games = Biblioteca.getAll().filter(function (g) { var d = fullDate(g); return !d || daysTo(d) >= 0; })
      .sort(function (a, b) { return (a.fechaLanzamiento || '9999').localeCompare(b.fechaLanzamiento || '9999') || (a.titulo || '').localeCompare(b.titulo || '', 'es'); });
    list.innerHTML = games.map(function (g) {
      var d = fullDate(g);
      return '<div class="pg-item" data-pick-id="' + esc(g.id) + '">' + thumb(g) +
        '<div style="flex:1;min-width:0"><div style="font-weight:700;font-size:0.82rem">' + esc(g.titulo) + '</div>' +
        '<div style="font-size:0.7rem;color:rgba(251,146,60,0.9)">' + (d ? fmtDate(d) : 'Sin fecha') + (g.desarrollador ? ' · ' + esc(g.desarrollador) : '') + '</div></div></div>';
    }).join('');
    $('pickGameOverlay').style.display = 'flex';
  }

  function initPick() {
    var overlay = $('pickGameOverlay');
    $('btnClosePickGame').addEventListener('click', function () { overlay.style.display = 'none'; });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) { overlay.style.display = 'none'; return; }
      var it = e.target.closest('[data-pick-id]');
      if (!it) return;
      var g = Biblioteca.getById(it.dataset.pickId);
      if (!g) return;
      GT.db.collection('settings').doc('featuredGame').set({
        juegoId: g.id, titulo: g.titulo || '', portadaUrl: g.portadaUrl || '', fechaLanzamiento: g.fechaLanzamiento || '', desarrollador: g.desarrollador || ''
      }).then(function () {
        overlay.style.display = 'none';
        renderHero(g);
        if (GT.Toast) GT.Toast.show('¡Juego más esperado actualizado! ✓');
      }).catch(function (err) { console.error('featuredGame:', err); });
    });
  }

  /* ── TOPS POR JUGADOR ────────────────────────────────────── */
  function renderTops() {
    var year = new Date().getFullYear();
    $('topScopeLabel').textContent = topAll ? 'de siempre' : year;
    $('topScopeBtn').textContent = topAll ? '📅 Ver TOP ' + year : '🏆 Ver TOP Histórico';
    var all = Registro.getAll();
    $('genTopsGrid').innerHTML = PLAYERS.map(function (p) {
      var best = {};
      all.forEach(function (r) {
        var n = parseFloat(r.nota);
        if (r.jugador !== p || isNaN(n) || (!topAll && parseInt(r.año, 10) !== year)) return;
        if (!best[r.juegoId] || n > best[r.juegoId]) best[r.juegoId] = n;
      });
      var rows = Object.keys(best).map(function (id) { return { g: Biblioteca.getById(id), n: best[id] }; })
        .filter(function (x) { return x.g; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 5);
      return '<div class="gen-top gen-top--' + p + '"><div class="gen-top__title">🎮 TOP ' + p.toUpperCase() + '</div>' +
        (rows.length ? rows.map(function (x, i) {
          var c = Utils.scoreColor(x.n);
          return '<a class="gen-toprow gen-toprow--' + (i + 1) + '" href="biblioteca.html?open=' + esc(x.g.id) + '"><div class="gen-toprow__rank">' + (i + 1) + '</div>' + thumb(x.g) +
            '<div style="min-width:0"><div class="gen-toprow__title">' + esc(x.g.titulo) + '</div><div class="gen-toprow__meta">' + esc((x.g.fechaLanzamiento || '').slice(0, 4) || '—') + '</div></div>' +
            '<div class="gen-toprow__nota" style="color:' + c + '">' + Utils.formatScore(x.n) + '</div></a>';
        }).join('') : '<div class="gen-top__empty">' + (topAll ? 'Sin juegos puntuados.' : 'Sin juegos puntuados en ' + year + '.') + '</div>') + '</div>';
    }).join('');
  }

  /* ── PANELES DE LA DERECHA ───────────────────────────────── */
  function renderUpcoming() {
    var list = upcoming().slice(0, 6);
    $('genUpcoming').innerHTML = list.length ? list.map(function (g) {
      var d = fullDate(g);
      return '<a class="gen-item" href="biblioteca.html?open=' + esc(g.id) + '">' + thumb(g) + '<div class="gen-item__info"><div class="gen-item__title">' + esc(g.titulo) +
        '</div><div class="gen-item__meta">' + fmtDate(d) + ' · ' + when(d) + '</div></div></a>';
    }).join('') : '<div class="gen-empty">No hay estrenos próximos</div>';
  }

  function renderEvents() {
    GT.db.collection('events').get().then(function (snap) {
      var now = Date.now();
      var evs = snap.docs.map(function (d) { return d.data(); }).filter(function (ev) { return new Date(ev.isoDate).getTime() > now; })
        .sort(function (a, b) { return new Date(a.isoDate) - new Date(b.isoDate); }).slice(0, 5);
      $('genEvents').innerHTML = evs.length ? evs.map(function (ev) {
        var d = new Date(ev.isoDate), days = Math.ceil((d.getTime() - now) / 86400000);
        var accent = /^#[0-9a-f]{3,8}$/i.test(ev.accentColor || '') ? ev.accentColor : '#f5c842';
        return '<a class="gen-item" href="eventos.html" style="--item-accent:' + accent + '"><div class="gen-item__date"><b>' + d.getDate() + '</b><span>' + MONTHS[d.getMonth()].toUpperCase() +
          '</span></div><div class="gen-item__info"><div class="gen-item__title">' + esc(ev.nombre) + '</div><div class="gen-item__meta">' +
          (days <= 0 ? 'hoy' : days === 1 ? 'mañana' : 'en ' + days + ' días') + (ev.fechaLabel ? ' · ' + esc(ev.fechaLabel) : '') + '</div></div></a>';
      }).join('') : '<div class="gen-empty">No hay eventos próximamente</div>';
    }).catch(function () { $('genEvents').innerHTML = '<div class="gen-empty">No se pudieron cargar los eventos</div>'; });
  }

  function renderNews() {
    GT.db.collection('settings').doc('featuredNews').get().then(function (doc) {
      var n = doc.exists ? doc.data() : null;
      if (!n || !n.title) { $('genNews').innerHTML = '<a href="noticias.html" class="gen-empty" style="display:block">Ver las últimas noticias</a>'; return; }
      var ta = document.createElement('textarea'); ta.innerHTML = n.title; // el título viene con entidades HTML
      var date = '';
      try { date = n.pubDate ? new Date(n.pubDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : ''; } catch (e) {}
      var safeUrl = /^https?:\/\//i.test(n.url || '') ? n.url : 'noticias.html';
      $('genNews').innerHTML = '<a class="gen-news" href="' + esc(safeUrl) + '" target="_blank" rel="noopener noreferrer">' +
        (n.img && /^https?:\/\//i.test(n.img) ? '<div class="gen-news__img"><img src="' + esc(n.img) + '" alt="" loading="lazy"></div>' : '') +
        '<div class="gen-news__title">' + esc(ta.value) + '</div><div class="gen-news__meta">' + esc(n.source || '') + (date ? ' · ' + date : '') + '</div></a>';
    }).catch(function () { $('genNews').innerHTML = '<a href="noticias.html" class="gen-empty" style="display:block">Ver las últimas noticias</a>'; });
  }

  function renderStats() {
    var p = $('statsPlayer').value;
    var mine = Registro.getAll().filter(function (r) { return r.jugador === p; });
    var uniq = function (pred) { var s = {}; mine.forEach(function (r) { if (pred(r)) s[r.juegoId] = 1; }); return Object.keys(s).length; };
    var horas = mine.reduce(function (a, r) { return a + (parseFloat(r.horas) || 0); }, 0);
    var pend = Biblioteca.getAll().filter(function (g) { return (g.pendientePor || []).indexOf(p) !== -1; }).length;
    var stat = function (ico, rgb, num, lbl) {
      return '<div class="gen-stat"><div class="gen-stat__ico" style="--sc:' + rgb + '">' + ico + '</div><div><div class="gen-stat__num">' + num + '</div><div class="gen-stat__lbl">' + lbl + '</div></div></div>';
    };
    $('genStats').innerHTML =
      stat('🎮', '79,172,254', uniq(function (r) { return DONE.indexOf(r.estado) !== -1; }), 'Juegos terminados') +
      stat('🏆', '245,200,66', uniq(function (r) { return r.estado === 'Platinado'; }), 'Platinos') +
      stat('🕒', '67,233,123', Math.round(horas).toLocaleString('es-ES'), 'Horas jugadas') +
      stat('⏳', '168,85,247', pend, 'Juegos pendientes');
  }

  /* ── ARRANQUE ────────────────────────────────────────────── */
  function init() {
    renderUser();
    initSearch();
    initHero();
    initPick();
    $('topScopeBtn').addEventListener('click', function () { topAll = !topAll; renderTops(); });
    $('statsPlayer').addEventListener('change', renderStats);
    $('openCalendar').addEventListener('click', function () { $('calSection').scrollIntoView({ behavior: 'smooth' }); });

    renderTops(); renderUpcoming(); renderStats(); renderEvents(); renderNews();
    // sin juego elegido a mano, el primero del carrusel es el estreno más cercano
    loadFeatured().then(function (g) { renderHero(g); });

    GT.onDataChange(function () { renderTops(); renderUpcoming(); renderStats(); });
  }

  document.addEventListener('DOMContentLoaded', function () { GT.onDataReady(init); });
})();
