(function () {
  'use strict';

  /* ── ELEMENTOS ─────────────────────────────────────────── */
  var hub       = document.getElementById('hub');
  var zoneLeft  = document.getElementById('zoneLeft');
  var zoneRight = document.getElementById('zoneRight');
  var flash     = document.getElementById('hubFlash');

  /* ── HOVER — cambio de estado ──────────────────────────── */
  zoneLeft.addEventListener('mouseenter', function () {
    hub.classList.add('hover-left');
    hub.classList.remove('hover-right');
  });

  zoneRight.addEventListener('mouseenter', function () {
    hub.classList.add('hover-right');
    hub.classList.remove('hover-left');
  });

  /* Al salir del hub completo → estado neutro */
  hub.addEventListener('mouseleave', function () {
    hub.classList.remove('hover-left', 'hover-right');
  });

  /* ── SONIDOS (Web Audio API sintetizados) ──────────────── */
  function playGameSound() {
    try {
      var ac  = new (window.AudioContext || window.webkitAudioContext)();
      var now = ac.currentTime;
      /* 8-bit coin jingle: C5-E5-G5-C6 */
      [523, 659, 784, 1047].forEach(function (freq, i) {
        var osc = ac.createOscillator();
        var g   = ac.createGain();
        osc.connect(g); g.connect(ac.destination);
        osc.type = 'square';
        osc.frequency.value = freq;
        var t = now + i * 0.08;
        g.gain.setValueAtTime(0.12, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.start(t); osc.stop(t + 0.2);
      });
    } catch (e) {}
  }

  function playCinemaSound() {
    try {
      var ac  = new (window.AudioContext || window.webkitAudioContext)();
      var now = ac.currentTime;

      /* Low dramatic boom */
      var o1 = ac.createOscillator(), g1 = ac.createGain();
      o1.connect(g1); g1.connect(ac.destination);
      o1.type = 'sine';
      o1.frequency.setValueAtTime(110, now);
      o1.frequency.exponentialRampToValueAtTime(50, now + 0.45);
      g1.gain.setValueAtTime(0.28, now);
      g1.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      o1.start(now); o1.stop(now + 0.65);

      /* High shimmer */
      var o2 = ac.createOscillator(), g2 = ac.createGain();
      o2.connect(g2); g2.connect(ac.destination);
      o2.type = 'triangle';
      o2.frequency.setValueAtTime(880, now + 0.04);
      o2.frequency.exponentialRampToValueAtTime(1760, now + 0.22);
      g2.gain.setValueAtTime(0.07, now + 0.04);
      g2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      o2.start(now + 0.04); o2.stop(now + 0.55);
    } catch (e) {}
  }

  /* ── FLASH DE PANTALLA ─────────────────────────────────── */
  function doFlash(side) {
    flash.className = 'hub__flash hub__flash--' + side + ' active';
    setTimeout(function () { flash.className = 'hub__flash'; }, 600);
  }

  /* ── OVERLAY PRÓXIMAMENTE ──────────────────────────────── */
  function showComingSoon() {
    var overlay = document.createElement('div');
    overlay.className = 'hub__soon';
    overlay.innerHTML =
      '<div class="hub__soon-title">🎬 PRÓXIMAMENTE</div>' +
      '<div class="hub__soon-sub">CineTracker · Películas · Series · Anime</div>' +
      '<div class="hub__soon-sub" style="font-size:0.75rem;margin-top:0.25rem">En construcción...</div>' +
      '<button class="hub__soon-back" id="soonBack">← VOLVER AL HUB</button>';
    document.body.appendChild(overlay);

    /* Forzar reflow para la transición */
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        overlay.classList.add('visible');
      });
    });

    document.getElementById('soonBack').addEventListener('click', function () {
      overlay.classList.remove('visible');
      setTimeout(function () { overlay.remove(); }, 400);
    });
  }

  /* ── CHARACTER SELECTION ────────────────────────────────── */
  var pselOverlay = document.getElementById('pselOverlay');
  var pselFlash   = document.getElementById('pselFlash');
  var pselVideos  = document.querySelectorAll('.psel__img');

  var PLAYER_COLORS = { David: '#3b82f6', Javi: '#9b1742', Mery: '#9b59ff' };

  function openPlayerSelect() {
    pselOverlay.classList.add('open');
    pselVideos.forEach(function(v) { v.play().catch(function() {}); });
    document.querySelectorAll('.psel__card').forEach(function(c) { c.classList.remove('choosing'); });
    pselFlash.style.background = '';
    pselFlash.classList.remove('active');
  }

  function closePlayerSelect() {
    pselOverlay.classList.remove('open');
    pselVideos.forEach(function(v) { v.pause(); });
  }

  document.getElementById('pselBack').addEventListener('click', closePlayerSelect);

  document.querySelectorAll('.psel__card').forEach(function(card) {
    card.addEventListener('click', function() {
      var player = this.dataset.player;
      var color  = PLAYER_COLORS[player] || '#4facfe';

      document.querySelectorAll('.psel__card').forEach(function(c) { c.classList.remove('choosing'); });
      this.classList.add('choosing');

      try { localStorage.setItem('GT_player', player); } catch(e) {}

      pselFlash.style.background = color;
      pselFlash.classList.add('active');
      playGameSound();

      setTimeout(function() { window.location.href = 'index.html'; }, 420);
    });
  });

  /* ── CLICKS ────────────────────────────────────────────── */
  zoneLeft.addEventListener('click', function () {
    openPlayerSelect();
  });

  zoneRight.addEventListener('click', function () {
    playCinemaSound();
    doFlash('right');
    setTimeout(function () { window.location.href = 'mt-hub.html'; }, 300);
  });

  /* ── TOUCH (móvil) ─────────────────────────────────────── */
  var touchSide = null;

  document.addEventListener('touchstart', function (e) {
    var t  = e.touches[0];
    var el = document.elementFromPoint(t.clientX, t.clientY);
    if (el === zoneLeft) touchSide = 'left';
    else if (el === zoneRight) touchSide = 'right';
    else return;
    hub.classList.toggle('hover-left',  touchSide === 'left');
    hub.classList.toggle('hover-right', touchSide === 'right');
  }, { passive: true });

  document.addEventListener('touchend', function () {
    hub.classList.remove('hover-left', 'hover-right');
  });

})();
