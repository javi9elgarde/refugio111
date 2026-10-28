/* ============================================================
   GAMETRACKER — Dashboard / Index Page
   ============================================================ */
(function () {
  'use strict';

  var Utils = window.GT.Utils;
  var Biblioteca = window.GT.Biblioteca;
  var Registro = window.GT.Registro;

  var calState     = { year: 0, month: 0 };
  var _calIntervals = []; /* intervalos del slideshow — se limpian al cambiar mes */

  function safe(fn, name) {
    try { fn(); } catch (e) { console.warn('index.js ' + name + ':', e); }
  }

  /* ── HERO CANVAS — pixel-art particles ──────────────────── */
  function initHeroCanvas() {
    var canvas = document.getElementById('heroCanvas');
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    var W, H, netPts, floatPts;

    function resize() {
      W = canvas.width  = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    // Red de partículas (cuadrados pixel-art)
    netPts = Array.from({ length: 55 }, function() {
      return {
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        sz: Math.random() < 0.5 ? 2 : 3,
        cyan: Math.random() > 0.4
      };
    });

    // Partículas flotantes (ascienden y desaparecen)
    function makeFloat(random) {
      return {
        x:       Math.random() * (W || 1200),
        y:       random ? Math.random() * (H || 800) : (H || 800) + 8,
        vy:      -(Math.random() * 0.45 + 0.15),
        sz:      Math.random() < 0.55 ? 2 : 4,
        alpha:   0,
        maxA:    Math.random() * 0.55 + 0.2,
        fadeIn:  true,
        pink:    Math.random() > 0.7
      };
    }
    floatPts = Array.from({ length: 38 }, function() { return makeFloat(true); });

    function frame() {
      ctx.clearRect(0, 0, W, H);

      // Líneas de red
      for (var i = 0; i < netPts.length; i++) {
        for (var j = i + 1; j < netPts.length; j++) {
          var dx = netPts[i].x - netPts[j].x, dy = netPts[i].y - netPts[j].y;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d < 130) {
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(79,172,254,' + (1 - d / 130) * 0.14 + ')';
            ctx.lineWidth = 1;
            ctx.moveTo(netPts[i].x, netPts[i].y);
            ctx.lineTo(netPts[j].x, netPts[j].y);
            ctx.stroke();
          }
        }
      }

      // Píxeles de red (cuadrados)
      netPts.forEach(function(p) {
        ctx.fillStyle = p.cyan ? 'rgba(79,172,254,0.8)' : 'rgba(168,85,247,0.8)';
        ctx.fillRect(Math.round(p.x - p.sz / 2), Math.round(p.y - p.sz / 2), p.sz, p.sz);
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      });

      // Partículas flotantes tipo brasa
      floatPts.forEach(function(p, idx) {
        if (p.fadeIn) {
          p.alpha += 0.012;
          if (p.alpha >= p.maxA) { p.alpha = p.maxA; p.fadeIn = false; }
        } else {
          p.alpha -= 0.007;
          if (p.alpha <= 0) { floatPts[idx] = makeFloat(false); return; }
        }
        ctx.fillStyle = p.pink
          ? 'rgba(236,72,153,' + p.alpha.toFixed(3) + ')'
          : 'rgba(79,172,254,' + p.alpha.toFixed(3) + ')';
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.sz, p.sz);
        p.y += p.vy;
      });

      requestAnimationFrame(frame);
    }
    frame();
  }

  /* ── HERO PARALLAX + KEN BURNS (JS) ─────────────────────── */
  function initHeroParallax() {
    var hero = document.querySelector('.hero');
    var bg   = document.querySelector('.hero__bg');
    if (!hero || !bg) return;

    // JS toma el control — desactiva animación CSS residual
    bg.style.animation = 'none';

    var mouseX = 0.5, mouseY = 0.5;
    var curX   = 0.5, curY   = 0.5;
    var kbTime = 0;

    hero.addEventListener('mousemove', function(e) {
      var r = hero.getBoundingClientRect();
      mouseX = (e.clientX - r.left) / r.width;
      mouseY = (e.clientY - r.top)  / r.height;
    });
    hero.addEventListener('mouseleave', function() { mouseX = 0.5; mouseY = 0.5; });

    function tick() {
      // Suavizado
      curX += (mouseX - curX) * 0.04;
      curY += (mouseY - curY) * 0.04;

      // Ken Burns: escala oscila entre 1.04 y 1.10
      kbTime += 0.00025;
      var scale = 1.07 + Math.sin(kbTime) * 0.03;

      // Parallax: ±3% según posición del ratón (invertido = imagen sigue suavemente)
      var px = 50 + (curX - 0.5) * (-6);
      var py = 50 + (curY - 0.5) * (-4);

      bg.style.backgroundSize     = (scale * 100).toFixed(2) + '%';
      bg.style.backgroundPosition = px.toFixed(2) + '% ' + py.toFixed(2) + '%';

      requestAnimationFrame(tick);
    }
    tick();
  }

  /* ── HERO PLAYER CARDS ───────────────────────────────────── */
  function initHeroPlayerStats() {
    var year = new Date().getFullYear();
    ['David', 'Javi', 'Mery'].forEach(function(player) {
      var entries = Registro.filter({ jugador: player, año: year });
      var games = new Set(entries.map(function(r) { return r.juegoId; })).size;
      var hours = Math.round(entries.reduce(function(acc, r) { return acc + (parseFloat(r.horas) || 0); }, 0));
      var scored = entries.filter(function(r) { return r.nota !== null && r.nota !== undefined && r.nota !== ''; });
      var avg = scored.length ? (scored.reduce(function(a, r) { return a + parseFloat(r.nota); }, 0) / scored.length) : null;
      var el = document.getElementById('heroStats' + player);
      if (el) el.textContent = games + ' juegos · ' + hours + 'h' + (avg ? ' · ★ ' + avg.toFixed(1).replace('.', ',') : '');
    });
  }

  /* ── QUICK STATS ─────────────────────────────────────────── */
  function initStats() {
    var year = new Date().getFullYear();
    var stats = Registro.getStats(year);
    var libCount = Biblioteca.getAll().length;

    document.getElementById('statGames').textContent = stats.totalJuegos;
    document.getElementById('statHours').textContent = stats.totalHoras + 'h';
    document.getElementById('statScore').textContent = stats.avgScore ? stats.avgScore.toFixed(2).replace('.',',') : '—';
    document.getElementById('statLibrary').textContent = libCount;
    var navY = document.getElementById('navYear'); if (navY) navY.textContent = year;
    var footY = document.getElementById('footerYear'); if (footY) footY.textContent = year;
  }

  /* ── CALENDAR ────────────────────────────────────────────── */
  var DAY_NAMES = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  var MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                     'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  function renderCalendar() {
    /* Limpiar slideshows del mes anterior */
    _calIntervals.forEach(clearInterval);
    _calIntervals = [];

    var y = calState.year, m = calState.month;
    document.getElementById('calTitle').textContent = MONTH_NAMES[m] + ' ' + y;

    var headers = document.getElementById('calHeaders');
    headers.innerHTML = DAY_NAMES.map(function(d){
      return '<div class="cal-day-header">' + d + '</div>';
    }).join('');

    // Get ALL games with a release date in this month (historical calendar)
    var byDay = {};
    Biblioteca.getAll().forEach(function(g) {
      var d = g.fechaLanzamiento;
      if (!d || d.includes('xx')) return;
      var parts = d.split('-');
      if (parseInt(parts[0]) !== y || parseInt(parts[1]) !== (m+1)) return;
      var day = parseInt(parts[2]);
      if (isNaN(day)) return;
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(g);
    });

    var today = new Date();
    var firstDay = new Date(y, m, 1);
    var lastDay  = new Date(y, m+1, 0);
    // Monday-based: 0=Mon … 6=Sun
    var startDow = (firstDay.getDay() + 6) % 7;

    var grid = document.getElementById('calGrid');
    grid.innerHTML = '';

    // Blank cells
    for (var i = 0; i < startDow; i++) {
      var blank = document.createElement('div');
      blank.className = 'cal-day other-month';
      grid.appendChild(blank);
    }

    for (var d = 1; d <= lastDay.getDate(); d++) {
      var cell = document.createElement('div');
      var games = byDay[d] || [];
      var isToday = today.getFullYear()===y && today.getMonth()===m && today.getDate()===d;
      var todayCls = isToday ? ' today' : '';
      var numCls   = isToday ? ' cal-cover__num--today' : '';

      if (!games.length) {
        /* ── Empty day ── */
        cell.className = 'cal-day' + todayCls;
        cell.innerHTML = '<div class="cal-day__num' + numCls + '">' + d + '</div>';

      } else if (games.length === 1) {
        /* ── Single game: full 16:9 cover ── */
        var g = games[0];
        var sid = g.id.replace(/'/g, "\\'");
        cell.className = 'cal-day cal-day--cover' + todayCls;
        cell.innerHTML =
          '<div class="cal-cover cal-cover--full" onclick="window.GT.GameDetailModal.open(\'' + sid + '\')">' +
            (g.portadaUrl
              ? '<img src="' + Utils.escapeHtml(Utils.thumb(g.portadaUrl)) + '" class="cal-cover__img" loading="lazy" onerror="this.style.display=\'none\'">'
              : '<div class="cal-cover__ph">' + Utils.escapeHtml(g.titulo.charAt(0)) + '</div>') +
            '<div class="cal-cover__overlay">' +
              '<span class="cal-cover__num' + numCls + '">' + d + '</span>' +
              '<span class="cal-cover__title">' + Utils.escapeHtml(g.titulo) + '</span>' +
            '</div>' +
          '</div>';

      } else {
        /* ── 2+ games: slideshow automático ── */
        var slidesHtml = games.map(function (g, i) {
          var sid = g.id.replace(/'/g, "\\'");
          var activeCls = i === 0 ? ' cal-slide--active' : '';
          return '<div class="cal-slide' + activeCls + '" onclick="window.GT.GameDetailModal.open(\'' + sid + '\')" title="' + Utils.escapeHtml(g.titulo) + '">' +
            (g.portadaUrl
              ? '<img src="' + Utils.escapeHtml(Utils.thumb(g.portadaUrl)) + '" class="cal-cover__img" loading="lazy" onerror="this.style.display=\'none\'">'
              : '<div class="cal-cover__ph">' + Utils.escapeHtml(g.titulo.charAt(0)) + '</div>') +
            '<div class="cal-cover__overlay">' +
              '<span class="cal-cover__num' + numCls + '">' + d + '</span>' +
              '<span class="cal-cover__title">' + Utils.escapeHtml(g.titulo) + '</span>' +
            '</div>' +
          '</div>';
        }).join('');
        var dotsHtml = '<div class="cal-slide-dots">' +
          games.map(function (_, i) {
            return '<span class="cal-slide-dot' + (i === 0 ? ' cal-slide-dot--active' : '') + '"></span>';
          }).join('') +
          '</div>';
        cell.className = 'cal-day cal-day--cover cal-day--slideshow' + todayCls;
        cell.innerHTML = '<div class="cal-slideshow">' + slidesHtml + dotsHtml + '</div>';

        /* Arrancar el carrusel (captura cell+games con IIFE) */
        (function (el, n) {
          var cur = 0;
          var iv = setInterval(function () {
            var slides = el.querySelectorAll('.cal-slide');
            var dots   = el.querySelectorAll('.cal-slide-dot');
            slides[cur].classList.remove('cal-slide--active');
            if (dots[cur]) dots[cur].classList.remove('cal-slide-dot--active');
            cur = (cur + 1) % n;
            slides[cur].classList.add('cal-slide--active');
            if (dots[cur]) dots[cur].classList.add('cal-slide-dot--active');
          }, 3000);
          _calIntervals.push(iv);
        })(cell, games.length);
      }
      grid.appendChild(cell);
    }

    renderUpcomingList();
  }

  function renderUpcomingList() { /* replaced by renderUpcomingCards */ }

  /* ── TODAY LAUNCH PANEL HTML ─────────────────────────────── */
  function renderTodayPanel(games) {
    if (games.length === 1) {
      var g = games[0];
      var sid    = g.id.replace(/'/g, "\\'");
      var objPos = Utils.escapeHtml(g.portadaPos || 'center top');
      return '<div class="today-launch">' +
        '<div class="today-launch__header">' +
          '<span class="today-launch__badge">🎮 YA A LA VENTA</span>' +
        '</div>' +
        '<div class="today-launch__cover" onclick="window.GT.GameDetailModal.open(\'' + sid + '\')" style="cursor:pointer" title="' + Utils.escapeHtml(g.titulo) + '">' +
          (g.portadaUrl
            ? '<img src="' + Utils.escapeHtml(Utils.thumb(g.portadaUrl)) + '" alt="' + Utils.escapeHtml(g.titulo) + '" loading="lazy" style="object-position:' + objPos + '" onerror="this.style.display=\'none\'">'
            : '<div class="today-launch__ph">' + Utils.escapeHtml(g.titulo.charAt(0)) + '</div>') +
          '<div class="today-launch__overlay">' +
            '<div class="today-launch__title">' + Utils.escapeHtml(g.titulo) + '</div>' +
            '<div style="margin-top:0.25rem">' + Utils.platformBadgesHtml(g.plataformas) + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    /* 2+ games: split side-by-side */
    var extra = games.length > 2 ? games.length - 2 : 0;
    var cards = games.slice(0, 2).map(function(g) {
      var sid    = g.id.replace(/'/g, "\\'");
      var objPos = Utils.escapeHtml(g.portadaPos || 'center top');
      return '<div class="today-launch__multi-card" onclick="window.GT.GameDetailModal.open(\'' + sid + '\')" style="cursor:pointer" title="' + Utils.escapeHtml(g.titulo) + '">' +
        (g.portadaUrl
          ? '<img src="' + Utils.escapeHtml(Utils.thumb(g.portadaUrl)) + '" alt="' + Utils.escapeHtml(g.titulo) + '" loading="lazy" style="object-position:' + objPos + '" onerror="this.style.display=\'none\'">'
          : '<div class="today-launch__ph">' + Utils.escapeHtml(g.titulo.charAt(0)) + '</div>') +
        '<div class="today-launch__multi-overlay">' +
          '<div class="today-launch__multi-title">' + Utils.escapeHtml(g.titulo) + '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    return '<div class="today-launch">' +
      '<div class="today-launch__header">' +
        '<span class="today-launch__badge">🎮 YA A LA VENTA</span>' +
        (extra ? '<span class="today-launch__extra">+' + extra + ' más</span>' : '') +
      '</div>' +
      '<div class="today-launch__multi">' + cards + '</div>' +
    '</div>';
  }

  function renderUpcomingCards() {
    var el         = document.getElementById('upcomingCardsGrid');
    var todayPanel = document.getElementById('todayLaunchPanel');
    if (!el) return;

    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var limit = new Date(today);
    limit.setDate(limit.getDate() + 30);

    var allGames = Biblioteca.getUpcoming().filter(function(g) {
      if (!g.fechaLanzamiento) return false;
      var parts = g.fechaLanzamiento.split('-');
      if (!parts[2] || parts[2] === 'xx') return false;
      var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return d >= today && d <= limit;
    });

    /* Split: hoy vs futuro */
    var todayTs    = today.getTime();
    var todayGames  = allGames.filter(function(g) {
      var p = g.fechaLanzamiento.split('-');
      return new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2])).getTime() === todayTs;
    });
    var futureGames = allGames.filter(function(g) {
      var p = g.fechaLanzamiento.split('-');
      return new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2])).getTime() > todayTs;
    });

    /* Today panel */
    if (todayPanel) {
      if (todayGames.length) {
        todayPanel.style.display = '';
        todayPanel.innerHTML = renderTodayPanel(todayGames);
      } else {
        todayPanel.style.display = 'none';
      }
    }

    /* Future cards */
    if (!futureGames.length) {
      el.innerHTML = '<p class="text-muted" style="grid-column:1/-1;text-align:center;padding:2rem">No hay estrenos en los próximos 30 días</p>';
      return;
    }

    el.innerHTML = futureGames.map(function(g) {
      var parts  = g.fechaLanzamiento.split('-');
      var day    = parseInt(parts[2]);
      var month  = MONTH_NAMES[parseInt(parts[1]) - 1];
      var dateStr = day + ' ' + month;
      var objPos  = Utils.escapeHtml(g.portadaPos || 'center top');

      return '<div class="upcoming-card" onclick="window.GT.GameDetailModal.open(\'' + g.id + '\')" style="cursor:pointer">' +
        '<div class="upcoming-card__cover">' +
          (g.portadaUrl
            ? '<img src="' + Utils.escapeHtml(Utils.thumb(g.portadaUrl)) + '" alt="' + Utils.escapeHtml(g.titulo) + '" loading="lazy" style="object-position:' + objPos + '" onerror="this.style.display=\'none\'">'
            : '<div class="upcoming-card__ph">' + Utils.escapeHtml(g.titulo.charAt(0)) + '</div>') +
          '<div class="upcoming-card__date">' + Utils.escapeHtml(dateStr) + '</div>' +
        '</div>' +
        '<div class="upcoming-card__body">' +
          '<div class="upcoming-card__title">' + Utils.escapeHtml(g.titulo) + '</div>' +
          '<div>' + Utils.platformBadgesHtml(g.plataformas) + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function initCalendar() {
    var now = new Date();
    calState.year  = now.getFullYear();
    calState.month = now.getMonth();
    renderCalendar();

    document.getElementById('calPrev').addEventListener('click', function(){
      calState.month--;
      if (calState.month < 0) { calState.month = 11; calState.year--; }
      renderCalendar();
    });
    document.getElementById('calNext').addEventListener('click', function(){
      calState.month++;
      if (calState.month > 11) { calState.month = 0; calState.year++; }
      renderCalendar();
    });
  }

  /* ── HOF GOLD PARTICLES ─────────────────────────────────── */
  function initHofParticles() {
    var canvas = document.getElementById('hofParticles');
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    var W, H;

    function resize() {
      W = canvas.width  = canvas.offsetWidth  || canvas.parentElement.offsetWidth  || 900;
      H = canvas.height = canvas.offsetHeight || canvas.parentElement.offsetHeight || 260;
    }
    resize();
    window.addEventListener('resize', resize);

    var GOLDS = [
      [245, 200,  66],   // bright gold
      [255, 215,   0],   // gold
      [255, 238,  88],   // light gold
      [184, 134,  11],   // dark gold
      [255, 255, 255],   // white sparkle
      [255, 248, 140],   // pale gold
    ];

    function makePt(randomY) {
      var c = GOLDS[Math.floor(Math.random() * GOLDS.length)];
      return {
        x:     Math.random() * (W || 900),
        y:     randomY ? Math.random() * (H || 260) : (H || 260) + 6,
        vx:    (Math.random() - 0.5) * 0.45,
        vy:    -(Math.random() * 0.55 + 0.15),
        sz:    Math.random() < 0.35 ? 1 : Math.random() < 0.7 ? 2 : 3,
        alpha: 0,
        maxA:  Math.random() * 0.65 + 0.2,
        fadeIn: true,
        r: c[0], g: c[1], b: c[2],
        twinkle: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.028 + Math.random() * 0.05
      };
    }

    var pts = Array.from({ length: 65 }, function() { return makePt(true); });

    function frame() {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        p.twinkle += p.twinkleSpeed;
        var tw = 0.7 + Math.sin(p.twinkle) * 0.3;

        if (p.fadeIn) {
          p.alpha += 0.013;
          if (p.alpha >= p.maxA) { p.alpha = p.maxA; p.fadeIn = false; }
        } else {
          p.alpha -= 0.005;
          if (p.alpha <= 0) { pts[i] = makePt(false); continue; }
        }

        p.x += p.vx;
        p.y += p.vy;
        p.vx += (Math.random() - 0.5) * 0.012;
        if (p.vx >  0.6) p.vx =  0.6;
        if (p.vx < -0.6) p.vx = -0.6;

        var a = (p.alpha * tw).toFixed(3);
        ctx.fillStyle = 'rgba(' + p.r + ',' + p.g + ',' + p.b + ',' + a + ')';

        if (p.sz <= 1) {
          ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
        } else if (p.sz === 2) {
          ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
        } else {
          // diamond / sparkle shape
          var px = Math.round(p.x), py = Math.round(p.y);
          ctx.beginPath();
          ctx.moveTo(px,     py - 2);
          ctx.lineTo(px + 2, py    );
          ctx.lineTo(px,     py + 2);
          ctx.lineTo(px - 2, py    );
          ctx.closePath();
          ctx.fill();
        }
      }
      requestAnimationFrame(frame);
    }
    frame();
  }

  /* ── RANKING ─────────────────────────────────────────────── */
  function buildYearOptions() {
    var sel = document.getElementById('rankingYear');
    if (!sel) return;
    // Use only years with actual registro entries
    var yearSet = {};
    Registro.getAll().forEach(function(r) { if (r.año) yearSet[r.año] = true; });
    var years = Object.keys(yearSet).map(Number).sort(function(a, b) { return b - a; });
    if (!years.length) years = [new Date().getFullYear()];
    var currentYear = new Date().getFullYear();
    var defaultYear = years.indexOf(currentYear) !== -1 ? currentYear : years[0];
    sel.innerHTML = years.map(function(y) {
      return '<option value="' + y + '"' + (y === defaultYear ? ' selected' : '') + '>' + y + '</option>';
    }).join('');
    sel.addEventListener('change', function() { renderRanking(parseInt(this.value)); });
  }

  var HOF_MEDALS = [
    { emoji: '🥇', label: '1º · GOTY', cls: 'hof-gold'   },
    { emoji: '🥈', label: '2º',         cls: 'hof-silver' },
    { emoji: '🥉', label: '3º',         cls: 'hof-bronze' }
  ];

  function hofCardHtml(item, rankIdx, year) {
    var game = Biblioteca.getById(item.juegoId);
    if (!game) return '';
    var med    = HOF_MEDALS[rankIdx];
    var sc     = Utils.scoreColor(item.notaMedia);
    var objPos = Utils.escapeHtml(game.portadaPos || 'center top');
    // tarjeta encima de su escalón del podio
    return '<div class="hof-place hof-place--' + (rankIdx + 1) + '">' +
      '<div class="hof-card ' + med.cls + '" onclick="window.GT.GameDetailModal.open(\'' + game.id + '\')" title="Ver ficha">' +
      '<div class="hof-card__cover">' +
        (game.portadaUrl
          ? '<img src="' + Utils.escapeHtml(Utils.thumb(game.portadaUrl, 640)) + '" alt="" loading="lazy" style="object-position:' + objPos + '" onerror="this.style.display=\'none\'">'
          : '<div class="hof-card__ph">' + Utils.escapeHtml(game.titulo.charAt(0)) + '</div>') +
        (rankIdx === 0 ? '<div class="hof-champion-badge">🏆 CAMPEÓN ' + year + '</div>' : '') +
      '</div>' +
      '<div class="hof-card__body">' +
        '<div class="hof-card__body-inner">' +
          '<div class="hof-card__title">' + Utils.escapeHtml(game.titulo) + '</div>' +
          '<span class="hof-card__score" style="color:' + sc + '">' + Utils.formatScore(item.notaMedia) + '</span>' +
        '</div>' +
        '<div class="hof-medal" aria-label="Puesto ' + (rankIdx + 1) + '"><span class="hof-medal__n">' + (rankIdx + 1) + 'º</span>' +
          (rankIdx === 0 ? '<span class="hof-medal__l">GOTY</span>' : '') + '</div>' +
      '</div>' +
      '</div>' +
      '<div class="hof-plinth"></div>' +
    '</div>';
  }

  function renderRanking(year) {
    document.getElementById('gotyYear').textContent = year;
    var ranking  = Registro.getRanking(year).filter(function(item) { return Biblioteca.getById(item.juegoId); });
    var podiumEl = document.getElementById('hofPodium');
    var bodyEl   = document.getElementById('rankingBody');

    if (!ranking.length) {
      podiumEl.innerHTML = '<p class="text-muted" style="grid-column:1/-1;text-align:center;padding:2rem">Sin datos para ' + year + '. Añade entradas en el Registro.</p>';
      bodyEl.innerHTML   = '<p class="text-muted" style="text-align:center;padding:2rem">Sin datos</p>';
      safe(function() { renderVideosSection(year); }, 'renderVideosSection');
      return;
    }

    // Podium visual order: 2nd | 1st | 3rd (gold en el centro, el más grande)
    var podiumIdxs = [1, 0, 2].filter(function(i) { return i < ranking.length; });
    podiumEl.innerHTML = podiumIdxs.map(function(i) {
      return hofCardHtml(ranking[i], i, year);
    }).join('');

    // Videos section (only on halloffame page)
    safe(function() { renderVideosSection(year); }, 'renderVideosSection');

    // Top 20 compacto: 1-10 a la izquierda, 11-20 a la derecha
    var top = ranking.slice(0, 20);
    bodyEl.style.gridTemplateRows = 'repeat(' + Math.ceil(top.length / 2) + ', auto)';
    var RANK_MEDALS  = ['🥇', '🥈', '🥉'];
    var RANK_CLASSES = ['rank-list-gold', 'rank-list-silver', 'rank-list-bronze'];
    bodyEl.innerHTML = top.map(function(item, i) {
      var game = Biblioteca.getById(item.juegoId);
      if (!game) return '';
      var sc     = Utils.scoreColor(item.notaMedia);
      var rowCls = i < 3 ? RANK_CLASSES[i] : '';
      /* Top 3: solo medalla emoji (ya indica posición). Resto: número en círculo */
      var posHtml = i < 3
        ? '<span class="rank-medal">' + RANK_MEDALS[i] + '</span>'
        : '<span class="rank-num">' + (i + 1) + '</span>';
      return '<div class="rank-list-row ' + rowCls + '" onclick="window.GT.GameDetailModal.open(\'' + game.id + '\')" title="Ver ficha">' +
          '<div class="rank-list-pos">' + posHtml + '</div>' +
          (game.portadaUrl ? '<img class="rank-thumb" src="' + Utils.escapeHtml(Utils.thumb(game.portadaUrl, 200)) + '" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">' : '<span class="rank-thumb"></span>') +
          '<div class="rank-list-info">' +
            '<div class="rank-list-title">' + Utils.escapeHtml(game.titulo) + '</div>' +
          '</div>' +
          '<div class="rank-list-score-wrap">' +
            '<div class="score-bar"><div class="score-bar__fill" style="width:' + Utils.scoreWidth(item.notaMedia) + ';background:' + sc + '"></div></div>' +
            '<span class="score-num" style="color:' + sc + '">' + Utils.formatScore(item.notaMedia) + '</span>' +
          '</div>' +
        '</div>';
    }).join('');
  }

  /* ── HOF VIDEOS FIN DE AÑO ──────────────────────────────── */
  var HOF_PLAYERS = [
    { key: 'david', name: 'David', color: '#3b82f6', rgb: '59,130,246' },
    { key: 'javi',  name: 'Javi',  color: '#ec4899', rgb: '236,72,153' },
    { key: 'mery',  name: 'Mery',  color: '#a855f7', rgb: '168,85,247' }
  ];

  function ytEmbedUrl(url) {
    if (!url) return '';
    var m;
    m = url.match(/youtu\.be\/([^?&#/]+)/);
    if (m) return 'https://www.youtube.com/embed/' + m[1];
    m = url.match(/[?&]v=([^?&#]+)/);
    if (m) return 'https://www.youtube.com/embed/' + m[1];
    m = url.match(/youtube\.com\/embed\/([^?&#/]+)/);
    if (m) return 'https://www.youtube.com/embed/' + m[1];
    return '';
  }

  function renderVideoCard(player, embedUrl, year) {
    var bc = 'rgba(' + player.rgb + ',0.22)';
    var header =
      '<div class="hof-video-card__header">' +
        '<div class="hof-video-av" style="background:' + player.color + '">' + player.name.charAt(0) + '</div>' +
        '<span class="hof-video-card__name">' + player.name + '</span>' +
        '<button class="hof-video-edit-btn" id="hofVEdit_' + player.key + '_' + year + '" title="Cambiar vídeo">✏️</button>' +
      '</div>';
    var body = embedUrl
      ? '<div class="hof-video-embed"><iframe src="' + embedUrl +
          '?rel=0" frameborder="0" allowfullscreen loading="lazy"' +
          ' allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe></div>'
      : '<div class="hof-video-empty" id="hofVEmpty_' + player.key + '_' + year + '">' +
          '<span class="hof-video-empty__icon">🎬</span>' +
          '<span class="hof-video-empty__text">Sin vídeo para ' + year + '</span>' +
          '<span class="hof-video-empty__add">+ Añadir enlace</span>' +
        '</div>';
    return '<div class="hof-video-card" style="border-color:' + bc + '">' + header + body + '</div>';
  }

  function renderVideosSection(year) {
    var gridEl  = document.getElementById('hofVideosGrid');
    var yearEl  = document.getElementById('hofVideosYear');
    if (!gridEl) return;
    if (yearEl) yearEl.textContent = year;

    // Show loading spinners
    gridEl.innerHTML = HOF_PLAYERS.map(function(p) {
      var bc = 'rgba(' + p.rgb + ',0.22)';
      return '<div class="hof-video-card" style="border-color:' + bc + '">' +
        '<div class="hof-video-card__header">' +
          '<div class="hof-video-av" style="background:' + p.color + '">' + p.name.charAt(0) + '</div>' +
          '<span class="hof-video-card__name">' + p.name + '</span>' +
        '</div>' +
        '<div class="hof-video-placeholder"><div class="hof-video-spin"></div></div>' +
      '</div>';
    }).join('');

    window.GT.db.collection('resumenVideos').doc(String(year)).get().then(function(doc) {
      var data = doc.exists ? doc.data() : {};
      gridEl.innerHTML = HOF_PLAYERS.map(function(p) {
        return renderVideoCard(p, ytEmbedUrl(data[p.key] || ''), year);
      }).join('');
      // Wire up edit buttons and empty-area clicks
      HOF_PLAYERS.forEach(function(p) {
        var editBtn  = document.getElementById('hofVEdit_'  + p.key + '_' + year);
        var emptyDiv = document.getElementById('hofVEmpty_' + p.key + '_' + year);
        var currentUrl = data[p.key] || '';
        if (editBtn)  editBtn .addEventListener('click', function(e) { e.stopPropagation(); openVideoModal(p, year, currentUrl); });
        if (emptyDiv) emptyDiv.addEventListener('click', function()  { openVideoModal(p, year, ''); });
      });
    }).catch(function(err) {
      console.warn('renderVideosSection:', err);
      gridEl.innerHTML = HOF_PLAYERS.map(function(p) {
        return renderVideoCard(p, '', year);
      }).join('');
      HOF_PLAYERS.forEach(function(p) {
        var editBtn  = document.getElementById('hofVEdit_'  + p.key + '_' + year);
        var emptyDiv = document.getElementById('hofVEmpty_' + p.key + '_' + year);
        if (editBtn)  editBtn .addEventListener('click', function(e) { e.stopPropagation(); openVideoModal(p, year, ''); });
        if (emptyDiv) emptyDiv.addEventListener('click', function()  { openVideoModal(p, year, ''); });
      });
    });
  }

  function openVideoModal(player, year, currentUrl) {
    var existing = document.getElementById('hofVideoModal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'hofVideoModal';
    modal.className = 'modal-overlay open';
    modal.innerHTML =
      '<div class="modal" style="max-width:480px">' +
        '<div class="modal__header">' +
          '<h2 class="modal__title">🎬 Vídeo de ' + player.name + ' — ' + year + '</h2>' +
          '<button class="modal__close" id="hofVMClose">✕</button>' +
        '</div>' +
        '<div class="modal__body">' +
          '<div class="form-group">' +
            '<label class="form-label">URL de YouTube</label>' +
            '<input type="text" class="form-input" id="hofVMUrl"' +
              ' placeholder="https://www.youtube.com/watch?v=..."' +
              ' value="' + (currentUrl || '') + '">' +
            '<p style="font-size:0.75rem;color:var(--txt3);margin-top:0.4rem">Acepta youtube.com/watch?v=..., youtu.be/... y enlaces de YouTube Shorts.</p>' +
          '</div>' +
        '</div>' +
        '<div class="modal__footer">' +
          (currentUrl
            ? '<button class="btn btn-danger btn-sm" id="hofVMDelete" style="margin-right:auto">Eliminar</button>'
            : '') +
          '<button class="btn btn-secondary" id="hofVMCancel">Cancelar</button>' +
          '<button class="btn btn-primary" id="hofVMSave">Guardar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);

    function closeVModal() { modal.remove(); }
    document.getElementById('hofVMClose') .addEventListener('click', closeVModal);
    document.getElementById('hofVMCancel').addEventListener('click', closeVModal);
    modal.addEventListener('click', function(e) { if (e.target === modal) closeVModal(); });

    var delBtn = document.getElementById('hofVMDelete');
    if (delBtn) delBtn.addEventListener('click', function() {
      var update = {}; update[player.key] = '';
      window.GT.db.collection('resumenVideos').doc(String(year))
        .set(update, { merge: true })
        .then(function() { closeVModal(); renderVideosSection(year); })
        .catch(function(e) { console.warn('delete video:', e); });
    });

    document.getElementById('hofVMSave').addEventListener('click', function() {
      var url = document.getElementById('hofVMUrl').value.trim();
      var update = {}; update[player.key] = url;
      window.GT.db.collection('resumenVideos').doc(String(year))
        .set(update, { merge: true })
        .then(function() { closeVModal(); renderVideosSection(year); })
        .catch(function(e) { console.warn('save video:', e); });
    });
  }

  function initRanking() {
    buildYearOptions();
    var sel = document.getElementById('rankingYear');
    var defaultYear = sel ? parseInt(sel.value) : new Date().getFullYear();
    renderRanking(defaultYear);
  }

  /* ── CUENTAS ATRÁS ───────────────────────────────────────── */
  var EVENTOS_COUNTDOWN = [
    { nombre: 'State of Play',    emoji: '🎮', fecha: '2026-06-02T00:00:00', color: '#0070f3', fechaLabel: '2 Jun 2026' },
    { nombre: 'Summer Game Fest', emoji: '🎪', fecha: '2026-06-05T00:00:00', color: '#f5c842', fechaLabel: '5 Jun 2026' }
  ];

  function initCountdowns() {
    var wrap = document.getElementById('heroCountdowns');
    if (!wrap) return;
    wrap.innerHTML = '';

    EVENTOS_COUNTDOWN.forEach(function (ev) {
      var card = document.createElement('div');
      card.className = 'cd-card';
      card.style.setProperty('--cd-color', ev.color);
      card.innerHTML =
        '<div class="cd-card__header">' +
          '<span class="cd-card__emoji">' + ev.emoji + '</span>' +
          '<div>' +
            '<div class="cd-card__name">' + ev.nombre + '</div>' +
            '<div class="cd-card__date">📅 ' + ev.fechaLabel + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="cd-card__timer" id="cd-' + ev.nombre.replace(/\s/g,'') + '">' +
          '<div class="cd-unit"><span class="cd-val cd-days">--</span><span class="cd-lbl">días</span></div>' +
          '<div class="cd-sep">:</div>' +
          '<div class="cd-unit"><span class="cd-val cd-hours">--</span><span class="cd-lbl">h</span></div>' +
          '<div class="cd-sep">:</div>' +
          '<div class="cd-unit"><span class="cd-val cd-mins">--</span><span class="cd-lbl">min</span></div>' +
          '<div class="cd-sep">:</div>' +
          '<div class="cd-unit"><span class="cd-val cd-secs">--</span><span class="cd-lbl">seg</span></div>' +
        '</div>';
      wrap.appendChild(card);
    });

    function tick() {
      var now = new Date().getTime();
      EVENTOS_COUNTDOWN.forEach(function (ev) {
        var id  = 'cd-' + ev.nombre.replace(/\s/g,'');
        var box = document.getElementById(id);
        if (!box) return;
        var diff = new Date(ev.fecha).getTime() - now;
        if (diff <= 0) {
          box.innerHTML = '<span style="color:var(--cd-color);font-size:.9rem;font-weight:700">¡YA EMPIEZA!</span>';
          return;
        }
        var d  = Math.floor(diff / 86400000);
        var h  = Math.floor((diff % 86400000) / 3600000);
        var m  = Math.floor((diff % 3600000)  / 60000);
        var s  = Math.floor((diff % 60000)    / 1000);
        box.querySelector('.cd-days').textContent = d;
        box.querySelector('.cd-hours').textContent = String(h).padStart(2,'0');
        box.querySelector('.cd-mins').textContent  = String(m).padStart(2,'0');
        box.querySelector('.cd-secs').textContent  = String(s).padStart(2,'0');
      });
    }
    tick();
    setInterval(tick, 1000);
  }

  /* ── SALA NUKA TOP ──────────────────────────────────────── */
  function renderSalaNukaTop() {
    var el = document.getElementById('salaNukaGrid');
    if (!el) return;

    var all = Registro.getAll().filter(function(r) {
      return r.nota !== null && r.nota !== undefined && r.nota !== '';
    });

    // Group notas by game, track unique players
    var byGame = {};
    all.forEach(function(r) {
      if (!byGame[r.juegoId]) byGame[r.juegoId] = { notas: [], players: {} };
      byGame[r.juegoId].notas.push(parseFloat(r.nota));
      byGame[r.juegoId].players[r.jugador] = true;
    });

    // Require min 2 players rated; calculate avg; sort desc
    var ranked = Object.keys(byGame).filter(function(id) {
      return Object.keys(byGame[id].players).length >= 2;
    }).map(function(id) {
      var notas = byGame[id].notas;
      var avg = notas.reduce(function(a, b) { return a + b; }, 0) / notas.length;
      return { juegoId: id, avg: Math.round(avg * 100) / 100, players: byGame[id].players };
    }).sort(function(a, b) {
      if (b.avg !== a.avg) return b.avg - a.avg;
      return Object.keys(b.players).length - Object.keys(a.players).length;
    }).slice(0, 10);

    if (!ranked.length) {
      el.innerHTML = '<div class="nuka-empty"><span class="nuka-empty__icon">⚛</span>SIN DATOS · AÑADE NOTAS EN EL REGISTRO</div>';
      return;
    }

    el.innerHTML = ranked.map(function(item, idx) {
      var game = Biblioteca.getById(item.juegoId);
      if (!game) return '';
      var sc     = Utils.scoreColor(item.avg);
      var sid    = game.id.replace(/'/g, "\\'");
      var objPos = Utils.escapeHtml(game.portadaPos || 'center top');
      var r1cls  = idx === 0 ? ' nuka-card--rank1' : '';
      var avgStr = parseFloat(item.avg).toFixed(1).replace('.', ',');

      return '<div class="nuka-card' + r1cls + '" onclick="window.GT.GameDetailModal.open(\'' + sid + '\')" title="' + Utils.escapeHtml(game.titulo) + '">' +
        '<div class="nuka-card__rank">#' + (idx + 1) + '</div>' +
        '<div class="nuka-card__cover">' +
          (game.portadaUrl
            ? '<img src="' + Utils.escapeHtml(Utils.thumb(game.portadaUrl)) + '" alt="" loading="lazy" style="object-position:' + objPos + '" onerror="this.style.display=\'none\'">'
            : '<div class="nuka-card__cover-ph">' + Utils.escapeHtml(game.titulo.charAt(0)) + '</div>') +
          '<div class="nuka-card__glass"></div>' +
          '<div class="nuka-card__score-overlay">' +
            '<span class="nuka-card__score-num" style="color:' + sc + '">' + avgStr + '</span>' +
            '<span class="nuka-card__score-star">★</span>' +
          '</div>' +
        '</div>' +
        '<div class="nuka-card__info">' +
          '<div class="nuka-card__title">' + Utils.escapeHtml(game.titulo) + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  /* ── SALA DE HONOR (G.O.T.Y): lo mejor valorado de la casa, sin notas ni orden ──
     settings/salaHonor = { juegos: [ids] elegidos a mano (o null), fotos: { id: { url, pos } } } */
  var HONOR_MAX = 20, HONOR_PICK_MIN = 9.6;
  var honor = { juegos: null, fotos: {} }, honorDraft = null, honorAvgs = {};

  // nota media de cada juego valorado por al menos 2 jugadores
  function honorAverages() {
    var byGame = {}, out = {};
    Registro.getAll().forEach(function(r) {
      var n = parseFloat(r.nota);
      if (isNaN(n)) return;
      var b = byGame[r.juegoId] = byGame[r.juegoId] || { sum: 0, n: 0, players: {} };
      b.sum += n; b.n++; b.players[r.jugador] = true;
    });
    Object.keys(byGame).forEach(function(id) {
      var b = byGame[id];
      if (Object.keys(b.players).length >= 2 && Biblioteca.getById(id)) out[id] = b.sum / b.n;
    });
    return out;
  }
  function honorByAvg(ids) { return ids.slice().sort(function(a, b) { return honorAvgs[b] - honorAvgs[a]; }); }

  function honorIds(st) {
    if (st.juegos) return st.juegos.filter(function(id) { return Biblioteca.getById(id); }).slice(0, HONOR_MAX);
    return honorByAvg(Object.keys(honorAvgs)).slice(0, HONOR_MAX); // por defecto, los 20 de mejor media
  }

  function honorPos(pos) { // "30% 0%" → [30, 0]; cualquier otra cosa → centrado arriba
    var m = /^(\d+(?:\.\d+)?)% (\d+(?:\.\d+)?)%$/.exec(pos || '');
    return m ? [+m[1], +m[2]] : [50, 0];
  }

  function renderSalaHonor() {
    var el = document.getElementById('salaHonorGrid');
    if (!el) return;
    honorAvgs = honorAverages();
    var editing = !!honorDraft, st = honorDraft || honor;
    var ids = honorIds(st); // en el orden guardado
    document.getElementById('salaHonor').classList.toggle('is-editing', editing);
    document.getElementById('salaHonorEdit').hidden = editing;
    document.getElementById('salaHonorEditor').hidden = !editing;
    if (editing) renderHonorEditor(ids);
    if (!ids.length) {
      el.innerHTML = '<div class="nuka-empty"><span class="nuka-empty__icon">🔥</span>AÚN NO HAY JUEGOS EN LA SALA DE HONOR</div>';
      return;
    }
    el.innerHTML = ids.map(function(id, n) {
      var game = Biblioteca.getById(id), foto = st.fotos[id] || {};
      var url = foto.url || game.portadaUrl, pos = foto.pos || game.portadaPos || 'center top', xy = honorPos(foto.pos);
      var sid = id.replace(/'/g, "\\'");
      return '<div class="nuka-card" data-id="' + Utils.escapeHtml(id) + '"' + (editing ? ' draggable="true"' : ' onclick="window.GT.GameDetailModal.open(\'' + sid + '\')"') + ' title="' + Utils.escapeHtml(game.titulo) + '">' +
        (editing ? '<div class="nuka-card__rank">' + (n + 1) + 'º</div><span class="honor-drag" title="Arrastrar para mover">✥</span>' : '') +
        '<div class="nuka-card__cover">' +
          (url
            ? '<img src="' + Utils.escapeHtml(Utils.thumb(url, 640)) + '" alt="" loading="lazy" style="object-position:' + Utils.escapeHtml(pos) + '" onerror="this.style.display=\'none\'">'
            : '<div class="nuka-card__cover-ph">' + Utils.escapeHtml(game.titulo.charAt(0)) + '</div>') +
          '<div class="nuka-card__glass"></div>' +
          (editing ? '<div class="honor-edit">' +
            '<label>↔<input type="range" min="0" max="100" value="' + xy[0] + '" data-axis="0" aria-label="Mover imagen en horizontal"></label>' +
            '<label>↕<input type="range" min="0" max="100" value="' + xy[1] + '" data-axis="1" aria-label="Mover imagen en vertical"></label>' +
            '<div class="honor-mv">' +
              '<button type="button" data-honor-mv="-1" aria-label="Mover antes"' + (n === 0 ? ' disabled' : '') + '>◀</button>' +
              '<button type="button" data-honor-img>🖼️ Cambiar imagen</button>' +
              '<button type="button" data-honor-mv="1" aria-label="Mover después"' + (n === ids.length - 1 ? ' disabled' : '') + '>▶</button>' +
            '</div>' +
          '</div>' : '') +
        '</div>' +
        '<div class="nuka-card__info"><div class="nuka-card__title">' + Utils.escapeHtml(game.titulo) + '</div></div>' +
      '</div>';
    }).join('');
  }

  function renderHonorEditor(ids) {
    var cands = honorByAvg(Object.keys(honorAvgs).filter(function(id) { return honorAvgs[id] >= HONOR_PICK_MIN; }));
    ids.forEach(function(id) { if (cands.indexOf(id) === -1) cands.push(id); }); // los ya elegidos siempre salen
    var full = ids.length >= HONOR_MAX;
    document.getElementById('salaHonorCount').textContent = ids.length + ' / ' + HONOR_MAX;
    document.getElementById('salaHonorPicks').innerHTML = cands.map(function(id) {
      var on = ids.indexOf(id) !== -1;
      return '<label class="honor-pick' + (on ? ' is-on' : '') + '"><input type="checkbox" data-pick="' + Utils.escapeHtml(id) + '"' + (on ? ' checked' : '') + (!on && full ? ' disabled' : '') + '>' +
        Utils.escapeHtml(Biblioteca.getById(id).titulo) + ' <small>' + honorAvgs[id].toFixed(2).replace('.', ',') + '</small></label>';
    }).join('');
  }

  function initSalaHonor() {
    var sec = document.getElementById('salaHonor');
    if (!sec) return;
    window.GT.db.collection('settings').doc('salaHonor').get().then(function(doc) {
      var d = doc.exists ? doc.data() : {};
      honor = { juegos: Array.isArray(d.juegos) ? d.juegos : null, fotos: d.fotos || {} };
      renderSalaHonor();
    }).catch(function(err) { console.error('salaHonor:', err); });

    // la sala se abre en una ventana aparte
    var modal = document.getElementById('honorModal'), opener = document.getElementById('salaHonorOpen');
    function closeHonor() {
      if (modal.hidden) return;
      if (honorDraft && !confirm('¿Salir sin guardar los cambios de la Sala de Honor?')) return;
      honorDraft = null; renderSalaHonor();
      modal.hidden = true; document.body.classList.remove('honor-open'); opener.focus();
    }
    opener.addEventListener('click', function() {
      modal.hidden = false; document.body.classList.add('honor-open');
      document.getElementById('salaHonorClose').focus();
    });
    document.getElementById('salaHonorClose').addEventListener('click', closeHonor);
    modal.addEventListener('click', function(e) { if (e.target === modal) closeHonor(); });
    document.addEventListener('keydown', function(e) {
      var gd = document.getElementById('gdModal'); // con la ficha abierta, Escape solo cierra la ficha
      if (e.key === 'Escape' && !(gd && getComputedStyle(gd).display !== 'none')) closeHonor();
    });

    document.getElementById('salaHonorEdit').addEventListener('click', function() {
      honorDraft = { juegos: honorIds(honor), fotos: JSON.parse(JSON.stringify(honor.fotos)) };
      renderSalaHonor();
    });
    document.getElementById('salaHonorCancel').addEventListener('click', function() { honorDraft = null; renderSalaHonor(); });
    document.getElementById('salaHonorSave').addEventListener('click', function() {
      var btn = this, next = honorDraft;
      btn.disabled = true;
      window.GT.db.collection('settings').doc('salaHonor').set(next).then(function() {
        honor = next; honorDraft = null; renderSalaHonor();
        if (window.GT.Toast) window.GT.Toast.show('🔥 Sala de Honor guardada');
      }).catch(function(err) { console.error('salaHonor:', err); alert('No se pudo guardar la Sala de Honor'); })
        .then(function() { btn.disabled = false; });
    });
    document.getElementById('salaHonorPicks').addEventListener('change', function(e) {
      var id = e.target.dataset.pick;
      if (!id) return;
      var list = honorDraft.juegos.filter(function(x) { return x !== id; });
      if (e.target.checked && list.length < HONOR_MAX) list.push(id);
      honorDraft.juegos = list;
      renderSalaHonor();
    });
    var grid = document.getElementById('salaHonorGrid');
    grid.addEventListener('input', function(e) { // mover la imagen dentro de la tarjeta, en vivo
      var card = e.target.closest('.nuka-card');
      if (!honorDraft || !card || !e.target.dataset.axis) return;
      var r = card.querySelectorAll('input[type=range]'), pos = r[0].value + '% ' + r[1].value + '%';
      var img = card.querySelector('.nuka-card__cover img');
      if (img) img.style.objectPosition = pos;
      var f = honorDraft.fotos[card.dataset.id] = honorDraft.fotos[card.dataset.id] || {};
      f.pos = pos;
    });
    // ordenar: arrastrar por ✥ (escritorio) o con ◀ ▶ (también en móvil)
    function honorMove(id, to) {
      var l = honorDraft.juegos, from = l.indexOf(id);
      if (from < 0 || to < 0 || to >= l.length || from === to) return;
      l.splice(from, 1); l.splice(to, 0, id);
      renderSalaHonor();
    }
    var dragId = null;
    grid.addEventListener('pointerdown', function(e) { // las barras y botones no arrastran la tarjeta
      var card = e.target.closest('.nuka-card');
      if (honorDraft && card) card.draggable = !e.target.closest('input, button');
    });
    grid.addEventListener('dragstart', function(e) {
      var card = e.target.closest('.nuka-card');
      if (!honorDraft || !card) return;
      dragId = card.dataset.id;
      card.classList.add('is-drag');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragId);
    });
    grid.addEventListener('dragover', function(e) { if (dragId && e.target.closest('.nuka-card')) e.preventDefault(); });
    grid.addEventListener('drop', function(e) {
      var card = e.target.closest('.nuka-card');
      if (!dragId || !card) return;
      e.preventDefault();
      honorMove(dragId, honorDraft.juegos.indexOf(card.dataset.id));
    });
    grid.addEventListener('dragend', function() {
      dragId = null;
      var c = grid.querySelector('.is-drag');
      if (c) c.classList.remove('is-drag');
    });

    grid.addEventListener('click', function(e) {
      var card = e.target.closest('.nuka-card');
      if (!honorDraft || !card) return;
      var mv = e.target.closest('[data-honor-mv]');
      if (mv) { honorMove(card.dataset.id, honorDraft.juegos.indexOf(card.dataset.id) + parseInt(mv.dataset.honorMv, 10)); return; }
      if (!e.target.closest('[data-honor-img]')) return;
      var f = honorDraft.fotos[card.dataset.id] || {};
      var url = prompt('Enlace de la imagen para la Sala de Honor (vacío = la portada del juego):', f.url || '');
      if (url === null) return;
      url = url.trim();
      if (url && !/^https?:\/\//i.test(url)) { alert('El enlace tiene que empezar por http:// o https://'); return; }
      f.url = url;
      honorDraft.fotos[card.dataset.id] = f;
      renderSalaHonor();
    });
  }

  /* ── BOOT ────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    safe(initCountdowns, 'initCountdowns');
    window.GT.onDataReady(function () {
      safe(initHeroCanvas,        'initHeroCanvas');
      safe(initHofParticles,      'initHofParticles');
      safe(initHeroParallax,      'initHeroParallax');
      safe(initHeroPlayerStats,   'initHeroPlayerStats');
      safe(initStats,             'initStats');
      safe(initCalendar,          'initCalendar');
      safe(initRanking,           'initRanking');
      safe(renderUpcomingCards,   'renderUpcomingCards');
      safe(renderSalaNukaTop,     'renderSalaNukaTop');
      safe(initSalaHonor,         'initSalaHonor');
      safe(renderSalaHonor,       'renderSalaHonor');
      // Re-render when another user changes data in real time
      window.GT.onDataChange(function () {
        safe(initStats,             'initStats');
        safe(initHeroPlayerStats,   'initHeroPlayerStats');
        safe(renderUpcomingCards,   'renderUpcomingCards');
        safe(renderSalaNukaTop,     'renderSalaNukaTop');
        var sel = document.getElementById('rankingYear');
        if (sel) safe(function(){ renderRanking(parseInt(sel.value)); }, 'renderRanking');
      });
    });
  });
})();
