/* ============================================================
   REFUGIO 111 — Menú principal de videojuegos
   Carrusel de estrenos con cuenta atrás, fiesta el día del estreno,
   laterales decorativos, calendario con ventanitas y paneles laterales.
   Prueba la fiesta con ?simular=AAAA-MM-DD (hace como si hoy fuera ese día).
   ============================================================ */
(function () {
  'use strict';

  var GT = window.GT, U = GT.Utils, B = GT.Biblioteca, R = GT.Registro;
  var MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  var MES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var PLAYERS = ['David', 'Javi', 'Mery'];
  var DONE = ['Terminado', 'Platinado', 'Rejugado', 'Jugado'];

  var featuredId = null;   // "Juego Más Esperado" elegido a mano (settings/featuredGame)
  var events = [];
  var slides = [], slideIdx = 0, slideTimer = null, tickTimer = null;
  var cal = null;          // { y, m }
  var popTimer = null;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return U.escapeHtml(s == null ? '' : String(s)); }
  function pad(n) { return String(n).padStart(2, '0'); }

  /* ── "HOY" (se puede simular para ver la fiesta) ───────────── */
  var SIM = (location.search.match(/[?&]simular=(\d{4}-\d{2}-\d{2})/) || [])[1];
  var OFFSET = 0;
  if (SIM) { var real = new Date(); real.setHours(0, 0, 0, 0); OFFSET = new Date(SIM + 'T00:00:00').getTime() - real.getTime(); }
  function nowMs() { return Date.now() + OFFSET; }
  function isoOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function todayIso() { return isoOf(new Date(nowMs())); }

  /* ── DATOS ───────────────────────────────────────────────── */
  function fullDate(g) { return g && /^\d{4}-\d{2}-\d{2}$/.test(g.fechaLanzamiento || '') ? g.fechaLanzamiento : null; }
  function daysLeft(iso) { return Math.round((new Date(iso + 'T00:00:00') - new Date(todayIso() + 'T00:00:00')) / 864e5); }
  function fmtLong(iso) { var p = iso.split('-'); return parseInt(p[2], 10) + ' ' + MESES[parseInt(p[1], 10) - 1] + ' ' + p[0]; }
  function fmtShort(iso) { var p = iso.split('-'); return parseInt(p[2], 10) + ' ' + MES3[parseInt(p[1], 10) - 1] + ' ' + p[0]; }
  function isEsperado(g) { return g.id === featuredId || (parseInt(g.hype, 10) || 0) >= 3; }
  function trailerUrl(g) { return U.trailerUrl(g); }
  function upcoming() {
    var t = todayIso();
    return B.getAll().filter(function (g) { var d = fullDate(g); return d && d >= t; })
      .sort(function (a, b) { return a.fechaLanzamiento.localeCompare(b.fechaLanzamiento); });
  }
  function player() {
    var p = null;
    try { p = localStorage.getItem('GT_player'); } catch (e) {}
    return PLAYERS.indexOf(p) !== -1 ? p : 'Javi';
  }
  function cover(g, cls) {
    return g.portadaUrl ? '<img class="' + cls + '" src="' + esc(g.portadaUrl) + '" alt="" loading="lazy" style="object-position:' + esc(g.portadaPos || 'center top') + '">'
      : '<div class="' + cls + ' r1-up__ph"></div>';
  }

  /* ── CARRUSEL ────────────────────────────────────────────── */
  function buildSlides() {
    var t = todayIso(), ups = upcoming(), list = [], seen = {};
    function add(g) { if (g && !seen[g.id] && list.length < 7) { seen[g.id] = 1; list.push(g); } }
    ups.filter(function (g) { return g.fechaLanzamiento === t; }).forEach(add);   // lo que sale hoy, primero
    add(featuredId && B.getById(featuredId) && fullDate(B.getById(featuredId)) >= t ? B.getById(featuredId) : null);
    ups.filter(isEsperado).forEach(add);
    ups.forEach(add);
    return list;
  }

  function slideHtml(g, i) {
    var d = fullDate(g), today = d === todayIso();
    var badges = '<span class="r1-badge' + (today ? ' r1-badge--hot' : '') + '">' + (today ? '🎉 SALE HOY' : g.id === featuredId ? '⭐ JUEGO MÁS ESPERADO' : '⚡ ESTRENO DESTACADO') + '</span>' +
      ((g.generos || []).length ? '<span class="r1-badge r1-badge--ghost">' + esc(g.generos.slice(0, 2).join(' / ').toUpperCase()) + '</span>' : '') +
      ((parseInt(g.hype, 10) || 0) > 0 ? '<span class="r1-badge r1-badge--ghost">' + '🔥'.repeat(Math.min(5, parseInt(g.hype, 10))) + '</span>' : '');
    var mine = (g.pendientePor || []).indexOf(player()) !== -1;
    return '<div class="r1-slide' + (i === slideIdx ? ' is-on' : '') + '" data-id="' + esc(g.id) + '">' +
      (g.portadaUrl ? '<img class="r1-slide__bg" data-src="' + esc(g.portadaUrl) + '" alt="" style="object-position:' + esc(g.portadaPos || 'center top') + '">' : '') +
      '<div class="r1-slide__shade"></div>' +
      '<div class="r1-slide__body">' +
        '<div class="r1-badges">' + badges + '</div>' +
        '<div class="r1-info">' +
          '<div class="r1-meta"><span>📅 ' + fmtLong(d) + '</span>' + (g.desarrollador ? '<span>' + esc(g.desarrollador.toUpperCase()) + '</span>' : '') + '</div>' +
          '<h2 class="r1-title">' + esc(g.titulo) + '</h2>' +
          (g.descripcion ? '<p class="r1-desc">' + esc(g.descripcion) + '</p>' : '') +
          ((g.plataformas || []).length ? '<div class="r1-chips">' + g.plataformas.map(function (p) { return '<span class="r1-chip">' + esc(p) + '</span>'; }).join('') + '</div>' : '') +
          '<div class="r1-actions">' +
            '<a class="r1-btn r1-btn--y" href="' + esc(trailerUrl(g)) + '" target="_blank" rel="noopener noreferrer">▶ Ver tráiler</a>' +
            '<button type="button" class="r1-btn" data-pend="' + esc(g.id) + '"' + (mine ? ' disabled' : '') + '>' + (mine ? '✓ En tus pendientes' : '🔖 A mis pendientes') + '</button>' +
            '<a class="r1-btn" href="biblioteca.html?open=' + esc(g.id) + '">ⓘ Más info</a>' +
          '</div>' +
        '</div>' +
        '<div class="r1-foot"><div class="r1-cd" data-cd="' + d + '"></div><div class="r1-nav-slot"></div></div>' +
      '</div></div>';
  }

  function renderHero() {
    var prev = slides[slideIdx] && slides[slideIdx].id;
    slides = buildSlides();
    var hero = $('r1Hero');
    clearInterval(slideTimer);
    if (!slides.length) {
      hero.innerHTML = '<div class="r1-empty"><div style="font-size:2.4rem">🎮</div><b>No hay estrenos próximos</b>Añade juegos con fecha de lanzamiento en la Biblioteca.<a class="r1-btn r1-btn--y" href="biblioteca.html">Ir a la Biblioteca</a></div>';
      return;
    }
    var keep = slides.findIndex(function (g) { return g.id === prev; });
    slideIdx = keep >= 0 ? keep : 0;
    hero.innerHTML = slides.map(slideHtml).join('') +
      '<button type="button" class="r1-pick" id="r1Pick">⭐ Elegir el más esperado</button>';
    // flechas y puntos dentro del pie de cada diapositiva
    hero.querySelectorAll('.r1-nav-slot').forEach(function (slot) {
      slot.outerHTML = slides.length < 2 ? '' : '<div class="r1-nav"><button type="button" class="r1-arrow" data-go="-1" aria-label="Anterior">‹</button><div class="r1-dots">' +
        slides.map(function (_, i) { return '<button type="button" class="r1-dot' + (i === slideIdx ? ' is-on' : '') + '" data-dot="' + i + '" aria-label="Estreno ' + (i + 1) + '"></button>'; }).join('') +
        '</div><button type="button" class="r1-arrow" data-go="1" aria-label="Siguiente">›</button></div>';
    });
    showSlide(slideIdx);
    restartAuto();
  }

  function loadImg(i) {
    var s = $('r1Hero').querySelectorAll('.r1-slide')[i];
    var img = s && s.querySelector('img[data-src]');
    if (img) { img.src = img.dataset.src; img.removeAttribute('data-src'); }
  }

  function showSlide(i) {
    var all = $('r1Hero').querySelectorAll('.r1-slide');
    if (!all.length) return;
    slideIdx = (i + all.length) % all.length;
    all.forEach(function (s, n) { s.classList.toggle('is-on', n === slideIdx); });
    $('r1Hero').querySelectorAll('.r1-dot').forEach(function (d) { d.classList.toggle('is-on', +d.dataset.dot === slideIdx); });
    loadImg(slideIdx); loadImg(slideIdx + 1 < all.length ? slideIdx + 1 : 0); // la actual y la siguiente, el resto al llegar
    tick();
  }

  function restartAuto() {
    clearInterval(slideTimer);
    if (slides.length > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      slideTimer = setInterval(function () { if (!document.hidden) showSlide(slideIdx + 1); }, 9000);
    }
  }

  /* cuenta atrás de la diapositiva visible; al llegar a cero, "¡YA A LA VENTA!" */
  function tick() {
    var s = $('r1Hero').querySelector('.r1-slide.is-on .r1-cd');
    if (!s) return;
    var diff = new Date(s.dataset.cd + 'T00:00:00').getTime() - nowMs();
    if (diff <= 0) { s.innerHTML = '<div class="r1-live">🎉 ¡YA A LA VENTA!</div>'; return; }
    var dd = Math.floor(diff / 864e5), hh = Math.floor(diff % 864e5 / 36e5), mm = Math.floor(diff % 36e5 / 6e4), ss = Math.floor(diff % 6e4 / 1e3);
    var u = function (v, l) { return '<div class="r1-count__u"><b>' + pad(v) + '</b><small>' + l + '</small></div>'; };
    s.innerHTML = '<div class="r1-count"><span class="r1-count__lbl">FALTAN PARA EL ESTRENO</span>' +
      u(dd, 'DÍAS') + '<span class="r1-count__sep">:</span>' + u(hh, 'HORAS') + '<span class="r1-count__sep">:</span>' + u(mm, 'MIN') + '<span class="r1-count__sep">:</span>' + u(ss, 'SEG') + '</div>';
  }

  function initHero() {
    $('r1Hero').addEventListener('click', function (e) {
      var go = e.target.closest('[data-go]'), dot = e.target.closest('[data-dot]'), pend = e.target.closest('[data-pend]');
      if (go) { showSlide(slideIdx + parseInt(go.dataset.go, 10)); restartAuto(); }
      if (dot) { showSlide(parseInt(dot.dataset.dot, 10)); restartAuto(); }
      if (pend) addPending(pend.dataset.pend, pend);
      if (e.target.closest('#r1Pick')) openPick();
    });
    tickTimer = setInterval(function () { if (!document.hidden) tick(); }, 1000);
  }

  function addPending(id, btn) {
    var g = B.getById(id), p = player();
    if (!g) return;
    var list = (g.pendientePor || []).slice();
    if (list.indexOf(p) === -1) list.push(p);
    B.update(id, { pendientePor: list, pendiente: true });
    btn.disabled = true; btn.textContent = '✓ En tus pendientes';
    if (GT.Toast) GT.Toast.show('«' + g.titulo + '» en los pendientes de ' + p + ' ✓');
  }

  /* ── FIESTA EL DÍA DEL ESTRENO + LATERALES ─────────────────── */
  function renderParty() {
    var t = todayIso();
    var hoy = B.getAll().filter(function (g) { return g.fechaLanzamiento === t; });
    var star = hoy.filter(isEsperado).sort(function (a, b) { return (b.id === featuredId) - (a.id === featuredId) || (parseInt(b.hype, 10) || 0) - (parseInt(a.hype, 10) || 0); })[0];
    var party = $('r1Party'), note = $('r1Today');
    var sides = document.querySelectorAll('.r1-side');

    sides.forEach(function (s) {
      s.classList.toggle('is-party', !!star);
      s.style.setProperty('--side-img', star && star.portadaUrl ? 'url("' + String(star.portadaUrl).replace(/"/g, '%22') + '")' : 'none');
      s.querySelector('.r1-side__txt').textContent = star ? star.titulo : 'REFUGIO 111';
    });

    if (star) {
      party.hidden = false;
      party.innerHTML = '🎉 ¡HOY SALE <a href="biblioteca.html?open=' + esc(star.id) + '">' + esc(star.titulo.toUpperCase()) + '</a>! 🎉';
      var key = 'GT_fiesta_' + star.id + '_' + t;
      var seen = false;
      try { seen = sessionStorage.getItem(key) === '1'; sessionStorage.setItem(key, '1'); } catch (e) {}
      if (!seen) setTimeout(confetti, 600); // una vez por sesión, no en cada recarga
    } else { party.hidden = true; }

    var otros = hoy.filter(function (g) { return g !== star; });
    note.hidden = !otros.length;
    note.innerHTML = otros.length ? '📅 Hoy también sale: ' + otros.map(function (g) { return '<a href="biblioteca.html?open=' + esc(g.id) + '" style="color:inherit">' + esc(g.titulo) + '</a>'; }).join(' · ') : '';
  }

  var CONF = ['#ffc800', '#ff5a3c', '#4facfe', '#3fb55e', '#a855f7', '#ff9d00', '#ffffff'];
  function confetti() {
    if (!Element.prototype.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var box = document.createElement('div');
    box.className = 'r1-confetti';
    document.body.appendChild(box);
    for (var i = 0; i < 90; i++) {
      var el = document.createElement('i');
      var w = 6 + Math.random() * 6;
      el.style.cssText = 'position:absolute;top:-20px;left:' + (Math.random() * 100) + '%;width:' + w + 'px;height:' + (w * 1.5) + 'px;border-radius:2px;background:' + CONF[i % CONF.length];
      box.appendChild(el);
      el.animate([
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
        { transform: 'translate(' + (Math.random() * 200 - 100) + 'px,' + (innerHeight + 60) + 'px) rotate(' + Math.round(Math.random() * 900) + 'deg)', opacity: 0.9 }
      ], { duration: 2200 + Math.random() * 1800, delay: Math.random() * 600, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'forwards' });
    }
    setTimeout(function () { box.remove(); }, 4800);
  }

  /* ── CALENDARIO ──────────────────────────────────────────── */
  function renderCal() {
    var y = cal.y, m = cal.m, t = todayIso();
    $('r1CalMonth').textContent = MESES[m] + ' ' + y;
    var prefix = y + '-' + pad(m + 1) + '-';
    var byDay = {}, evByDay = {};
    B.getAll().forEach(function (g) {
      var d = fullDate(g);
      if (d && d.indexOf(prefix) === 0) (byDay[+d.slice(8)] = byDay[+d.slice(8)] || []).push(g);
    });
    events.forEach(function (ev) {
      var d = new Date(ev.isoDate);
      if (!isNaN(d) && d.getFullYear() === y && d.getMonth() === m) (evByDay[d.getDate()] = evByDay[d.getDate()] || []).push(ev);
    });
    var first = (new Date(y, m, 1).getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate(), html = '';
    for (var i = 0; i < first; i++) html += '<div class="r1-day r1-day--pad"></div>';
    for (var day = 1; day <= days; day++) {
      var games = (byDay[day] || []).sort(function (a, b) { return isEsperado(b) - isEsperado(a); });
      var evs = evByDay[day] || [], g = games[0];
      var isToday = prefix + pad(day) === t;
      var cls = 'r1-day' + (isToday ? ' r1-day--today' : '') + (games.length ? ' r1-day--has' : '') + (games.length > 1 ? ' r1-day--multi' : '') + (evs.length ? ' r1-day--evt' : '');
      html += '<div class="' + cls + '" data-day="' + day + '"' + (games.length ? ' title="' + esc(games.map(function (x) { return x.titulo; }).join(' · ')) + '"' : '') + '>' +
        (g && g.portadaUrl ? '<img class="r1-day__bg" src="' + esc(g.portadaUrl) + '" alt="" loading="lazy" style="object-position:' + esc(g.portadaPos || 'center top') + '"><div class="r1-day__fade"></div>' : '') +
        '<div class="r1-day__n"><span>' + day + '</span>' + (isToday ? '<span class="r1-day__hoy">HOY</span>' : '') + '</div>' +
        (games.length > 1 ? '<span class="r1-day__more">+' + (games.length - 1) + '</span>' : '') +
        '<div class="r1-day__info">' +
          evs.map(function (ev) { return '<div class="r1-day__evt" title="' + esc(ev.nombre) + '">🎮 ' + esc(ev.nombre) + '</div>'; }).join('') +
          (g ? '<div class="r1-day__t">' + esc(g.titulo) + '</div><div class="r1-day__pl">' + (g.plataformas || []).slice(0, 2).map(function (p) { return '<span class="r1-pl">' + esc(p) + '</span>'; }).join('') + '</div>' : '') +
        '</div></div>';
    }
    $('r1Cal').innerHTML = html;
    $('r1Cal')._byDay = byDay;
  }

  /* ventanitas flotantes: al pasar el ratón por un día con varios juegos (o al tocarlo en el móvil) */
  function showPop(cell) {
    var games = ($('r1Cal')._byDay || {})[cell.dataset.day] || [];
    var pop = $('r1Pop');
    if (games.length < 2) { pop.hidden = true; return; }
    clearTimeout(popTimer);
    pop.innerHTML = games.map(function (g, i) {
      return '<a class="r1-pc" style="--i:' + i + '" href="biblioteca.html?open=' + esc(g.id) + '">' +
        (g.portadaUrl ? '<img src="' + esc(g.portadaUrl) + '" alt="" style="object-position:' + esc(g.portadaPos || 'center top') + '">' : '<div class="r1-pc__ph"></div>') +
        '<div class="r1-pc__t">' + esc(g.titulo) + '</div>' +
        '<div class="r1-pc__p">' + (g.plataformas || []).slice(0, 3).map(function (p) { return '<span class="r1-pl">' + esc(p) + '</span>'; }).join('') + '</div></a>';
    }).join('');
    pop.hidden = false;
    var sheet = innerWidth < 640;
    pop.classList.toggle('r1-pop--sheet', sheet);
    if (sheet) { pop.style.left = ''; pop.style.top = ''; return; }
    var r = cell.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    var left = Math.max(12, Math.min(innerWidth - w - 12, r.left + r.width / 2 - w / 2));
    var top = r.top - h - 14 >= 70 ? r.top - h - 14 : r.bottom + 14; // arriba si cabe; si no, debajo
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
  }
  function hidePopSoon() { clearTimeout(popTimer); popTimer = setTimeout(function () { $('r1Pop').hidden = true; }, 180); }

  function initCal() {
    var d = new Date(nowMs());
    cal = { y: d.getFullYear(), m: d.getMonth() };
    $('r1CalPrev').addEventListener('click', function () { cal.m--; if (cal.m < 0) { cal.m = 11; cal.y--; } renderCal(); });
    $('r1CalNext').addEventListener('click', function () { cal.m++; if (cal.m > 11) { cal.m = 0; cal.y++; } renderCal(); });
    var grid = $('r1Cal'), pop = $('r1Pop');
    var canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (canHover) {
      grid.addEventListener('mouseover', function (e) { var c = e.target.closest('.r1-day--multi'); if (c) showPop(c); });
      grid.addEventListener('mouseout', function (e) { if (e.target.closest('.r1-day--multi')) hidePopSoon(); });
      pop.addEventListener('mouseenter', function () { clearTimeout(popTimer); });
      pop.addEventListener('mouseleave', hidePopSoon);
    }
    grid.addEventListener('click', function (e) {
      var c = e.target.closest('.r1-day--has');
      if (!c) return;
      var games = grid._byDay[c.dataset.day] || [];
      if (games.length === 1) { location.href = 'biblioteca.html?open=' + encodeURIComponent(games[0].id); return; }
      showPop(c); // en táctil el toque abre las ventanitas
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('#r1Pop, .r1-day--multi')) pop.hidden = true; });
    addEventListener('scroll', function () { if (!pop.classList.contains('r1-pop--sheet')) pop.hidden = true; }, { passive: true });
  }

  /* ── PANELES LATERALES ───────────────────────────────────── */
  function renderUpcoming() {
    var list = upcoming().slice(0, 6);
    $('r1Up').innerHTML = list.length ? list.map(function (g) {
      var dl = daysLeft(g.fechaLanzamiento);
      return '<a class="r1-up" href="biblioteca.html?open=' + esc(g.id) + '">' + cover(g, '') +
        '<div class="r1-up__i"><div class="r1-up__t">' + (isEsperado(g) ? '🔥 ' : '') + esc(g.titulo) + '</div><div class="r1-up__d">' + fmtShort(g.fechaLanzamiento) + '</div></div>' +
        '<span class="r1-up__left' + (dl === 0 ? ' r1-up__left--hoy' : '') + '">' + (dl === 0 ? 'HOY' : dl + 'd') + '</span></a>';
    }).join('') : '<div class="r1-none">No hay estrenos con fecha</div>';
  }

  function renderEvents() {
    var now = nowMs();
    var list = events.filter(function (ev) { return new Date(ev.isoDate).getTime() > now - 864e5; })
      .sort(function (a, b) { return new Date(a.isoDate) - new Date(b.isoDate); }).slice(0, 4);
    $('r1Evt').innerHTML = list.length ? list.map(function (ev) {
      var d = new Date(ev.isoDate), dl = Math.max(0, Math.ceil((d.getTime() - now) / 864e5));
      return '<a class="r1-up r1-up--evt" href="eventos.html">' + (/^https?:\/\//i.test(ev.img || '') ? '<img src="' + esc(ev.img) + '" alt="" loading="lazy">' : '<div class="r1-up__ph"></div>') +
        '<div class="r1-up__i"><div class="r1-up__t">' + esc(ev.nombre) + '</div><div class="r1-up__d">' + esc(ev.fechaLabel || fmtShort(isoOf(d))) + '</div></div>' +
        '<span class="r1-up__left">' + (dl === 0 ? 'HOY' : dl + 'd') + '</span></a>';
    }).join('') : '<div class="r1-none">No hay eventos próximamente</div>';
  }

  function renderStats() {
    var p = $('r1StatsP').value;
    var mine = R.getAll().filter(function (r) { return r.jugador === p; });
    var uniq = function (pred) { var s = {}; mine.forEach(function (r) { if (pred(r)) s[r.juegoId] = 1; }); return Object.keys(s).length; };
    var horas = mine.reduce(function (a, r) { return a + (parseFloat(r.horas) || 0); }, 0);
    var pend = B.getAll().filter(function (g) { return (g.pendientePor || []).indexOf(p) !== -1; }).length;
    var st = function (ico, rgb, n, l) { return '<div class="r1-stat"><div class="r1-stat__i" style="--c:' + rgb + '">' + ico + '</div><div><div class="r1-stat__n">' + n + '</div><div class="r1-stat__l">' + l + '</div></div></div>'; };
    var h = horas >= 1000 ? (horas / 1000).toFixed(1).replace('.', ',') + 'k' : Math.round(horas);
    $('r1Stats').innerHTML =
      st('🎮', '59,130,246', uniq(function (r) { return DONE.indexOf(r.estado) !== -1; }), 'Juegos jugados') +
      st('🏆', '255,200,0', uniq(function (r) { return r.estado === 'Platinado'; }), 'Platinos') +
      st('🕒', '168,85,247', h, 'Horas jugadas') +
      st('🔖', '52,211,153', pend, 'En pendientes');
  }

  /* ── ELEGIR EL JUEGO MÁS ESPERADO (settings/featuredGame) ──── */
  function openPick() {
    var games = B.getAll().filter(function (g) { var d = fullDate(g); return !d || daysLeft(d) >= 0; })
      .sort(function (a, b) { return (a.fechaLanzamiento || '9999').localeCompare(b.fechaLanzamiento || '9999') || (a.titulo || '').localeCompare(b.titulo || '', 'es'); });
    $('pickGameList').innerHTML = games.map(function (g) {
      var d = fullDate(g);
      return '<div class="pg-item" data-pick-id="' + esc(g.id) + '">' + cover(g, '') +
        '<div style="flex:1;min-width:0"><div style="font-weight:700;font-size:0.82rem">' + (g.id === featuredId ? '⭐ ' : '') + esc(g.titulo) + '</div>' +
        '<div style="font-size:0.7rem;color:rgba(255,200,0,0.85)">' + (d ? fmtShort(d) : 'Sin fecha') + (g.desarrollador ? ' · ' + esc(g.desarrollador) : '') + '</div></div></div>';
    }).join('');
    $('pickGameOverlay').style.display = 'flex';
  }

  function initPick() {
    var ov = $('pickGameOverlay');
    $('btnClosePickGame').addEventListener('click', function () { ov.style.display = 'none'; });
    ov.addEventListener('click', function (e) {
      if (e.target === ov) { ov.style.display = 'none'; return; }
      var it = e.target.closest('[data-pick-id]'), g = it && B.getById(it.dataset.pickId);
      if (!g) return;
      GT.db.collection('settings').doc('featuredGame').set({
        juegoId: g.id, titulo: g.titulo || '', portadaUrl: g.portadaUrl || '', fechaLanzamiento: g.fechaLanzamiento || '', desarrollador: g.desarrollador || ''
      }).then(function () {
        featuredId = g.id; ov.style.display = 'none';
        slideIdx = 0; renderAll();
        if (GT.Toast) GT.Toast.show('⭐ «' + g.titulo + '» es ahora el juego más esperado');
      }).catch(function (err) { console.error('featuredGame:', err); });
    });
  }

  /* ── ARRANQUE ────────────────────────────────────────────── */
  function renderAll() { renderParty(); renderHero(); renderCal(); renderUpcoming(); renderEvents(); renderStats(); }

  function init() {
    var sel = $('r1StatsP');
    sel.value = player();
    sel.addEventListener('change', renderStats);
    initHero(); initCal(); initPick();
    renderAll();
    GT.db.collection('settings').doc('featuredGame').get()
      .then(function (doc) { featuredId = doc.exists ? doc.data().juegoId || null : null; renderAll(); })
      .catch(function () {});
    GT.db.collection('events').get()
      .then(function (snap) { events = snap.docs.map(function (d) { return d.data(); }).filter(function (ev) { return ev.isoDate; }); renderCal(); renderEvents(); })
      .catch(function () { $('r1Evt').innerHTML = '<div class="r1-none">No se pudieron cargar los eventos</div>'; });
    GT.onDataChange(function () { renderParty(); renderHero(); renderCal(); renderUpcoming(); renderStats(); });
  }

  document.addEventListener('DOMContentLoaded', function () { GT.onDataReady(init); });
})();
