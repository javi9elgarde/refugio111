/* ============================================================
   REFUGIO 111 — Menú principal de videojuegos
   Carrusel de estrenos (los 5 más cercanos) con cuenta atrás, fiesta el día
   del estreno, laterales decorativos, calendario con ventanitas y el
   próximo evento.
   Prueba la fiesta con ?simular=AAAA-MM-DD (hace como si hoy fuera ese día).
   ============================================================ */
(function () {
  'use strict';

  var GT = window.GT, U = GT.Utils, B = GT.Biblioteca;
  var MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

  var featuredId = null;   // "Juego Más Esperado" elegido a mano (settings/featuredGame): también tiene fiesta
  var events = [], curEv = null;
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
  function fmtLong(iso) { var p = iso.split('-'); return parseInt(p[2], 10) + ' ' + MESES[parseInt(p[1], 10) - 1] + ' ' + p[0]; }
  function isEsperado(g) { return g.id === featuredId || (parseInt(g.hype, 10) || 0) >= 3; }
  function trailerUrl(g) { return U.trailerUrl(g); }
  function upcoming() {
    var t = todayIso();
    return B.getAll().filter(function (g) { var d = fullDate(g); return d && d >= t; })
      .sort(function (a, b) { return a.fechaLanzamiento.localeCompare(b.fechaLanzamiento); });
  }
  /* ── CARRUSEL ────────────────────────────────────────────── */
  function buildSlides() { return upcoming().slice(0, 5); } // ya van por fecha: lo que sale hoy, primero

  function slideHtml(g, i) {
    var d = fullDate(g);
    return '<div class="r1-slide' + (i === slideIdx ? ' is-on' : '') + '" data-id="' + esc(g.id) + '">' +
      (g.portadaUrl ? '<img class="r1-slide__bg" data-src="' + esc(U.thumb(g.portadaUrl, 1280)) + '" alt="" style="object-position:' + esc(g.portadaPos || 'center top') + '">' : '') +
      '<div class="r1-slide__shade"></div>' +
      // cartel colgado arriba a la izquierda: deja ver el fondo
      '<div class="r1-sign"><div class="r1-sign__board">' +
        '<div class="r1-meta"><span>' + (d === todayIso() ? '🎉 SALE HOY' : '📅 ' + fmtLong(d)) + '</span></div>' +
        '<h2 class="r1-title">' + esc(g.titulo) + '</h2>' +
        ((g.plataformas || []).length ? '<div class="r1-sign__pl">' + g.plataformas.slice(0, 4).map(function (p) { return '<span class="r1-pl">' + esc(p) + '</span>'; }).join('') + '</div>' : '') +
      '</div></div>' +
      '<div class="r1-slide__body">' +
        '<div class="r1-foot">' +
          '<div class="r1-actions">' +
            '<a class="r1-btn r1-btn--y" href="' + esc(trailerUrl(g)) + '" target="_blank" rel="noopener noreferrer">▶ Ver tráiler</a>' +
            '<a class="r1-btn" href="biblioteca.html?open=' + esc(g.id) + '">ⓘ Más info</a>' +
          '</div>' +
          '<div class="r1-cd" data-cd="' + d + '"></div><div class="r1-nav-slot"></div>' +
        '</div>' +
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
    hero.innerHTML = slides.map(slideHtml).join('');
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
    document.querySelectorAll('.r1-slide.is-on .r1-cd, #r1Evt .r1-cd').forEach(tickOne);
  }
  function tickOne(s) {
    var diff = new Date(s.dataset.cd + 'T00:00:00').getTime() - nowMs();
    if (diff <= 0) { s.innerHTML = '<div class="r1-live">🎉 ¡YA A LA VENTA!</div>'; return; }
    var dd = Math.floor(diff / 864e5), hh = Math.floor(diff % 864e5 / 36e5), mm = Math.floor(diff % 36e5 / 6e4), ss = Math.floor(diff % 6e4 / 1e3);
    var u = function (v, l) { return '<div class="r1-count__u"><b>' + pad(v) + '</b><small>' + l + '</small></div>'; };
    s.innerHTML = '<div class="r1-count"><span class="r1-count__lbl">FALTAN PARA EL ESTRENO</span>' +
      u(dd, 'DÍAS') + '<span class="r1-count__sep">:</span>' + u(hh, 'HORAS') + '<span class="r1-count__sep">:</span>' + u(mm, 'MIN') + '<span class="r1-count__sep">:</span>' + u(ss, 'SEG') + '</div>';
  }

  function initHero() {
    $('r1Hero').addEventListener('click', function (e) {
      var go = e.target.closest('[data-go]'), dot = e.target.closest('[data-dot]');
      if (go) { showSlide(slideIdx + parseInt(go.dataset.go, 10)); restartAuto(); }
      if (dot) { showSlide(parseInt(dot.dataset.dot, 10)); restartAuto(); }
    });
    tickTimer = setInterval(function () { if (!document.hidden) tick(); }, 1000);
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
      s.style.setProperty('--side-img', star && star.portadaUrl ? 'url("' + String(U.thumb(star.portadaUrl, 1280)).replace(/"/g, '%22') + '")' : 'none');
      s.querySelector('.r1-side__txt').textContent = star ? star.titulo : '';
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
      var evs = evByDay[day] || [], shown = games.slice(0, 5);
      var isToday = prefix + pad(day) === t;
      var cls = 'r1-day' + (isToday ? ' r1-day--today' : '') + (games.length ? ' r1-day--has' : '') + (games.length > 1 ? ' r1-day--multi' : '') + (evs.length ? ' r1-day--evt' : '');
      // con varios juegos, las portadas y nombres van pasando dentro de la casilla (data-k)
      html += '<div class="' + cls + '" data-day="' + day + '"' + (games.length === 1 ? ' title="' + esc(games[0].titulo) + '"' : '') + '>' +
        shown.map(function (g, i) {
          return g.portadaUrl ? '<img class="r1-day__bg' + (i ? '' : ' is-on') + '" data-k="' + i + '" src="' + esc(U.thumb(g.portadaUrl)) + '" alt="" loading="lazy" style="object-position:' + esc(g.portadaPos || 'center top') + '">' : '';
        }).join('') +
        (games.length ? '<div class="r1-day__fade"></div>' : '') +
        '<div class="r1-day__n"><span>' + day + '</span>' + (isToday ? '<span class="r1-day__hoy">HOY</span>' : '') + '</div>' +
        (games.length > 1 ? '<span class="r1-day__more">+' + (games.length - 1) + '</span>' : '') +
        '<div class="r1-day__info">' +
          evs.map(function (ev) { return '<div class="r1-day__evt" title="' + esc(ev.nombre) + '">🎮 ' + esc(ev.nombre) + '</div>'; }).join('') +
          (shown.length ? '<div class="r1-day__ts">' + shown.map(function (g, i) {
            return '<div class="r1-day__g' + (i ? '' : ' is-on') + '" data-k="' + i + '"><div class="r1-day__t">' + esc(g.titulo) + '</div><div class="r1-day__pl">' +
              (g.plataformas || []).slice(0, 2).map(function (p) { return '<span class="r1-pl">' + esc(p) + '</span>'; }).join('') + '</div></div>';
          }).join('') + '</div>' : '') +
        '</div></div>';
    }
    $('r1Cal').innerHTML = html;
    $('r1Cal')._byDay = byDay;
  }

  /* ventanitas flotantes: al pasar el ratón por un día con varios juegos (o al tocarlo en el móvil) */
  var popCell = null;
  function showPop(cell) {
    var games = ($('r1Cal')._byDay || {})[cell.dataset.day] || [];
    var pop = $('r1Pop');
    clearTimeout(popTimer);
    if (games.length < 2) { pop.hidden = true; return; }
    if (popCell === cell && !pop.hidden) return; // ya abiertas para este día: no redibujar (si no, parpadean)
    popCell = cell;
    pop.innerHTML = games.map(function (g, i) {
      return '<a class="r1-pc" style="--i:' + i + '" href="biblioteca.html?open=' + esc(g.id) + '">' +
        (g.portadaUrl ? '<img src="' + esc(U.thumb(g.portadaUrl)) + '" alt="" style="object-position:' + esc(g.portadaPos || 'center top') + '">' : '<div class="r1-pc__ph"></div>') +
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
      grid.addEventListener('mouseout', function (e) {
        var c = e.target.closest('.r1-day--multi');
        if (c && !c.contains(e.relatedTarget)) hidePopSoon(); // moverse entre partes de la misma casilla no cuenta como salir
      });
      pop.addEventListener('mouseenter', function () { clearTimeout(popTimer); });
      pop.addEventListener('mouseleave', hidePopSoon);
    }
    grid.addEventListener('click', function (e) {
      var c = e.target.closest('.r1-day--has');
      if (!c) return;
      var games = grid._byDay[c.dataset.day] || [];
      if (games.length === 1) { GT.GameDetailModal.open(games[0].id); return; }
      showPop(c); // en táctil el toque abre las ventanitas
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('#r1Pop, .r1-day--multi')) pop.hidden = true; });
    addEventListener('scroll', function () { if (!pop.classList.contains('r1-pop--sheet')) pop.hidden = true; }, { passive: true });
    // días con varios juegos: van pasando sus portadas y nombres
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) setInterval(function () {
      if (document.hidden) return;
      grid.querySelectorAll('.r1-day--multi').forEach(function (c) {
        var n = c.querySelectorAll('.r1-day__g').length, on = c.querySelector('.r1-day__g.is-on');
        var next = ((on ? +on.dataset.k : -1) + 1) % n;
        c.querySelectorAll('[data-k]').forEach(function (el) { el.classList.toggle('is-on', +el.dataset.k === next); });
      });
    }, 2800);
  }

  /* ── PRÓXIMO EVENTO (en vertical, a la altura del calendario) ── */
  function renderEvents() {
    var now = nowMs();
    var ev = events.filter(function (e) { return new Date(e.isoDate).getTime() > now - 864e5; })
      .sort(function (a, b) { return new Date(a.isoDate) - new Date(b.isoDate); })[0];
    curEv = ev || null;
    $('r1EvtEdit').hidden = !ev;
    if (!ev) { $('r1Evt').innerHTML = '<div class="r1-none">No hay eventos próximamente</div>'; return; }
    var d = new Date(ev.isoDate), img = ev.homeImg || ev.img || ''; // homeImg: imagen solo para este panel
    $('r1Evt').innerHTML = '<a class="r1-ev" href="eventos.html">' + (/^https?:\/\//i.test(img) ? '<img src="' + esc(img) + '" alt="">' : '') +
      '<div class="r1-ev__shade"></div>' +
      '<div class="r1-ev__i"><div class="r1-ev__t">' + esc(ev.nombre) + '</div><div class="r1-ev__d">📅 ' + esc(ev.fechaLabel || fmtLong(isoOf(d))) + '</div>' +
      '<div class="r1-cd" data-cd="' + isoOf(d) + '"></div></div></a>';
    tick();
  }

  function initEvtEdit() {
    $('r1EvtEdit').addEventListener('click', function () {
      if (!curEv) return;
      var ev = curEv, url = prompt('Imagen para el panel de «' + ev.nombre + '» (vacío = la de la pestaña Eventos):', ev.homeImg || '');
      if (url === null) return;
      url = url.trim();
      if (url && !/^https?:\/\//i.test(url)) { alert('El enlace tiene que empezar por http:// o https://'); return; }
      GT.db.collection('events').doc(ev.id).update({ homeImg: url })
        .then(function () { ev.homeImg = url; renderEvents(); })
        .catch(function (err) { console.error('homeImg:', err); alert('No se pudo guardar la imagen'); });
    });
  }

  /* ── ARRANQUE ────────────────────────────────────────────── */
  function renderAll() { renderParty(); renderHero(); renderCal(); renderEvents(); }

  function init() {
    initHero(); initCal(); initEvtEdit();
    // «Más info» y los juegos del calendario abren la ficha aquí mismo (Ctrl/clic central siguen yendo a la Biblioteca)
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="biblioteca.html?open="]');
      if (!a || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
      e.preventDefault();
      $('r1Pop').hidden = true;
      GT.GameDetailModal.open(decodeURIComponent(a.getAttribute('href').split('open=')[1]));
    });
    renderAll();
    GT.db.collection('settings').doc('featuredGame').get()
      .then(function (doc) { featuredId = doc.exists ? doc.data().juegoId || null : null; renderAll(); })
      .catch(function () {});
    GT.db.collection('events').get()
      .then(function (snap) { events = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }).filter(function (ev) { return ev.isoDate; }); renderCal(); renderEvents(); })
      .catch(function () { $('r1Evt').innerHTML = '<div class="r1-none">No se pudieron cargar los eventos</div>'; });
    GT.onDataChange(function () { renderParty(); renderHero(); renderCal(); });
  }

  document.addEventListener('DOMContentLoaded', function () { GT.onDataReady(init); });
})();
