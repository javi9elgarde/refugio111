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
  var events = [], curEv = null, partyId = null;
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
      // fondo a máxima calidad: el 4K puesto a mano o la portada original sin reducir
      (g.fondoHD || g.portadaUrl ? '<img class="r1-slide__bg" data-src="' + esc(g.fondoHD || g.portadaUrl) + '" alt="" style="object-position:' + esc(g.fondoHD ? 'center' : g.portadaPos || 'center top') + '">' : '') +
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
    // cualquier juego que salga hoy tiene fiesta; si hay varios, el elegido a mano o el de más hype
    var star = hoy.slice().sort(function (a, b) { return (b.id === featuredId) - (a.id === featuredId) || (parseInt(b.hype, 10) || 0) - (parseInt(a.hype, 10) || 0); })[0];
    var party = $('r1Party'), note = $('r1Today'), root = document.documentElement;
    var sides = document.querySelectorAll('.r1-side');

    root.classList.toggle('r1-fiesta', !!star);
    $('r1Flags').hidden = !star;
    if (!star) {
      partyId = null;
      ['--r1-y', '--r1-y2', '--party-c', '--party-c2'].forEach(function (p) { root.style.removeProperty(p); });
      sides.forEach(function (s) { s.classList.remove('is-party'); s.querySelector('.r1-side__in').innerHTML = ''; });
      party.hidden = true;
    } else {
      party.hidden = false;
      party.innerHTML = (star.fiestaLogo ? '<img class="r1-party__logo" src="' + esc(star.fiestaLogo) + '" alt="">' : '') +
        '<span>🎉 ¡HOY SALE <a href="biblioteca.html?open=' + esc(star.id) + '">' + esc(star.titulo.toUpperCase()) + '</a>! 🎉</span>';
      if (partyId !== star.id) { partyId = star.id; decorate(star, t); }
    }

    var otros = hoy.filter(function (g) { return g !== star; });
    note.hidden = !otros.length;
    note.innerHTML = otros.length ? '📅 Hoy también sale: ' + otros.map(function (g) { return '<a href="biblioteca.html?open=' + esc(g.id) + '" style="color:inherit">' + esc(g.titulo) + '</a>'; }).join(' · ') : '';
  }

  // decorado del día: colores, banderines, pancartas laterales y confeti (una vez por juego)
  function decorate(star, t) {
    var id = star.id, sides = document.querySelectorAll('.r1-side');
    flags(['#ffc800', '#ff9d00']);
    var paint = function (cols) {
      if (partyId !== id || !cols) return false;
      var r = document.documentElement.style;
      r.setProperty('--party-c', cols[0]); r.setProperty('--party-c2', cols[1]);
      r.setProperty('--r1-y', cols[0]); r.setProperty('--r1-y2', cols[2]);
      flags(cols);
      return true;
    };
    // color puesto a mano en la ficha; si no, el de la portada; si su web no deja leerla, el de RAWG
    var m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(star.fiestaColor || '');
    if (m) {
      var hm = hsl(parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16))[0].toFixed(0);
      paint([star.fiestaColor, 'hsl(' + ((+hm + 35) % 360) + ',80%,55%)', 'hsl(' + hm + ',90%,78%)']);
    } else palette(star.portadaUrl, function (cols) {
      if (!paint(cols)) shots(star, function (list) { palette(list[0], function (c) { if (!paint(c)) palette(list[1], paint); }); });
    });
    var banner = function (side) {
      return '<div class="r1-banner">' +
        (star.fiestaLogo ? '<img class="r1-banner__logo" src="' + esc(star.fiestaLogo) + '" alt="">' : '<div class="r1-banner__t">' + esc(star.titulo) + '</div>') +
        '<div class="r1-banner__s">' + (side ? '¡YA A LA VENTA!' : '🎉 HOY SALE 🎉') + '</div></div>';
    };
    sides.forEach(function (s, i) {
      s.classList.add('is-party');
      s.querySelector('.r1-side__in').innerHTML = banner(i);
      s.style.setProperty('--side-img', cssUrl(star.fiestaFondo || U.thumb(star.portadaUrl, 1280)));
    });
    if (!star.fiestaFondo) shots(star, function (list) { // capturas distintas para cada lateral
      if (partyId !== id) return;
      sides.forEach(function (s, i) { if (list[i + 1]) s.style.setProperty('--side-img', cssUrl(U.thumb(list[i + 1], 1280))); });
    });
    var key = 'GT_fiesta_' + id + '_' + t, seen = false;
    try { seen = sessionStorage.getItem(key) === '1'; sessionStorage.setItem(key, '1'); } catch (e) {}
    if (!seen) setTimeout(confetti, 600); // una vez por sesión, no en cada recarga
  }
  function cssUrl(u) { return u ? 'url("' + String(u).replace(/"/g, '%22') + '")' : 'none'; }

  // banderines: una guirnalda con los colores del juego que cuelga en curva
  function flags(cols) {
    var n = 26, html = '';
    for (var i = 0; i < n; i++) {
      var x = (i + 0.5) / n, y = 4 + 104 * x * (1 - x); // misma parábola que el cordel (bezier 4→56→4)
      html += '<i style="left:' + (x * 100) + '%;--y:' + y.toFixed(1) + 'px;--d:' + (i % 5) * -0.4 + 's;background:' + (i % 3 === 2 ? '#fff' : cols[i % 2]) + '"></i>';
    }
    $('r1Flags').innerHTML = '<svg viewBox="0 0 100 70" preserveAspectRatio="none"><path d="M0,4 Q50,56 100,4" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>' + html;
  }

  // dos colores vivos de la portada (RAWG permite leerla en un canvas); si no se puede, null
  function palette(url, cb) {
    if (!url) return cb(null);
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      try {
        var c = document.createElement('canvas'), x = c.getContext('2d');
        c.width = 64; c.height = 36;
        x.drawImage(img, 0, 0, 64, 36);
        var d = x.getImageData(0, 0, 64, 36).data, bins;
        var count = function (minS) { // agrupa por tono los píxeles con color (fuera grises, negros y blancos)
          bins = {};
          for (var i = 0; i < d.length; i += 4) {
            var h = hsl(d[i], d[i + 1], d[i + 2]);
            if (h[1] < minS || h[2] < 0.15 || h[2] > 0.85) continue;
            var k = Math.round(h[0] / 24) % 15, b = bins[k] = bins[k] || { n: 0, h: 0 };
            b.n += h[1]; b.h += h[0] * h[1];
          }
          return Object.keys(bins).sort(function (a, b) { return bins[b].n - bins[a].n; });
        };
        var top = count(0.3);
        if (!top.length) top = count(0.12); // juegos de colores apagados
        if (!top.length) return cb(null);
        var h1 = bins[top[0]].h / bins[top[0]].n;
        var other = top.filter(function (k) { return Math.min(Math.abs(k - top[0]), 15 - Math.abs(k - top[0])) >= 3; })[0];
        var h2 = other != null ? bins[other].h / bins[other].n : (h1 + 40) % 360;
        cb(['hsl(' + h1.toFixed(0) + ',85%,58%)', 'hsl(' + h2.toFixed(0) + ',80%,55%)', 'hsl(' + h1.toFixed(0) + ',90%,78%)']);
      } catch (e) { cb(null); } // imagen sin permiso de lectura (otro dominio)
    };
    img.onerror = function () { cb(null); };
    img.src = U.thumb(url, 200);
  }
  function hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, dd = mx - mn, h = 0, s = 0;
    if (dd) {
      s = dd / (1 - Math.abs(2 * l - 1));
      h = mx === r ? ((g - b) / dd) % 6 : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4;
      h = (h * 60 + 360) % 360;
    }
    return [h, s, l];
  }

  // capturas del juego en RAWG (buscando por título), guardadas para la sesión
  function shots(g, cb) {
    var key = 'GT_shots2_' + g.id; // [portada de RAWG, capturas...]
    try { var c = JSON.parse(sessionStorage.getItem(key)); if (c) return cb(c); } catch (e) {}
    if (!GT.Rawg) return;
    GT.Rawg.search(g.titulo, 5).then(function (res) {
      var hit = res.filter(function (r) { return r.released === g.fechaLanzamiento; })[0] || res[0];
      var bg = hit && hit.background_image;
      var list = [bg].concat(((hit && hit.short_screenshots) || []).map(function (s) { return s.image; }).filter(function (u) { return u !== bg; })).filter(Boolean);
      try { sessionStorage.setItem(key, JSON.stringify(list)); } catch (e) {}
      cb(list);
    }).catch(function () {});
  }

  function confetti() {
    if (!Element.prototype.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var cs = getComputedStyle(document.documentElement);
    var CONF = [cs.getPropertyValue('--party-c').trim() || '#ffc800', cs.getPropertyValue('--party-c2').trim() || '#ff5a3c', '#ffffff', '#ffc800', '#4facfe'];
    var box = document.createElement('div');
    box.className = 'r1-confetti';
    document.body.appendChild(box);
    for (var i = 0; i < 120; i++) {
      var el = document.createElement('i');
      var w = 6 + Math.random() * 6;
      el.style.cssText = 'position:absolute;top:-20px;left:' + (Math.random() * 100) + '%;width:' + w + 'px;height:' + (w * 1.5) + 'px;border-radius:2px;background:' + CONF[i % CONF.length];
      box.appendChild(el);
      el.animate([
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
        { transform: 'translate(' + (Math.random() * 200 - 100) + 'px,' + (innerHeight + 60) + 'px) rotate(' + Math.round(Math.random() * 900) + 'deg)', opacity: 0.9 }
      ], { duration: 2400 + Math.random() * 2000, delay: Math.random() * 900, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'forwards' });
    }
    setTimeout(function () { box.remove(); }, 5600);
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

  /* ── PRÓXIMO EVENTO: franja entre la portada y el calendario, con letrero animado ── */
  function renderEvents() {
    var now = nowMs();
    var ev = events.filter(function (e) { return new Date(e.isoDate).getTime() > now - 864e5; })
      .sort(function (a, b) { return new Date(a.isoDate) - new Date(b.isoDate); })[0];
    curEv = ev || null;
    $('r1EvtEdit').hidden = !ev;
    if (!ev) { $('r1Evt').innerHTML = '<div class="r1-none">No hay eventos próximamente</div>'; return; }
    var d = new Date(ev.isoDate), img = ev.homeImg || ev.img || ''; // homeImg: imagen solo para este panel
    var accent = /^#[0-9a-f]{3,8}$/i.test(ev.accentColor || '') ? ev.accentColor : '#4facfe';
    // cada letra en su span para la ola de luz del letrero
    var letters = Array.from(ev.nombre || '').map(function (ch, i) { return ch === ' ' ? ' ' : '<span style="--i:' + i + '">' + esc(ch) + '</span>'; }).join('');
    $('r1Evt').innerHTML = '<a class="r1-eb" href="eventos.html" style="--ec:' + accent + '">' +
      (/^https?:\/\//i.test(img) ? '<img class="r1-eb__img" src="' + esc(img) + '" alt="">' : '') +
      '<div class="r1-eb__shade"></div><div class="r1-eb__scan"></div>' +
      '<div class="r1-eb__i">' +
        '<div class="r1-eb__tag">🎮 PRÓXIMO EVENTO</div>' +
        '<div class="r1-eb__t" aria-label="' + esc(ev.nombre) + '">' + letters + '</div>' +
        '<div class="r1-eb__d">📅 ' + esc(ev.fechaLabel || fmtLong(isoOf(d))) + '</div>' +
      '</div>' +
      '<div class="r1-cd" data-cd="' + isoOf(d) + '"></div></a>';
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
