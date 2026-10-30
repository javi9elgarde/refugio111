/* ============================================================
   REFUGIO 111 — Comportamiento de app en móvil
   · Las ventanas emergentes (fichas, editores, logros, filtros) ya salen desde abajo por CSS en ≤ 768 px;
     aquí se les añade el gesto de arrastrar hacia abajo para cerrarlas.
   · Vibración ligera al guardar (los avisos verdes) y window.GT.haptic() para quien lo necesite.
   ============================================================ */
(function () {
  'use strict';
  window.GT = window.GT || {};

  var SHEETS  = '.modal-overlay > .modal, .mt-modal-overlay > .mt-modal, #logrosPickerOverlay > div, .m-sheet-overlay > .m-sheet';
  var CLOSERS = '[data-sheet-close], .modal__close, .mt-modal__close';
  var NO_DRAG = 'input, textarea, select, [contenteditable="true"], canvas, .no-swipe';
  var mq = window.matchMedia('(max-width: 768px)');

  /* ── Haptics ──────────────────────────────────────────────── */
  window.GT.haptic = function (ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms || 30); } catch (e) { /* sin vibración */ }
  };
  // cada aviso de éxito («Juego actualizado ✓», «Logros guardados»…) vibra un poco
  if (window.GT.Toast && window.GT.Toast.show && !window.GT.Toast._haptic) {
    var show = window.GT.Toast.show;
    window.GT.Toast.show = function (msg, type) {
      if (type !== 'error') window.GT.haptic(30);
      return show.apply(this, arguments);
    };
    window.GT.Toast._haptic = true;
  }

  /* ── Deslizar hacia abajo para cerrar ─────────────────────── */
  var drag = null;

  // ¿hay algo con scroll entre el dedo y la hoja que no esté arriba del todo?
  function scrolledInside(target, sheet) {
    for (var el = target; el && el !== sheet.parentNode; el = el.parentNode) {
      if (el.scrollTop > 0) return true;
    }
    return false;
  }

  function closeSheet(sheet) {
    var overlay = sheet.parentNode;
    var btn = sheet.querySelector(CLOSERS);
    if (btn) btn.click();
    else overlay.click(); // los fondos de las capas cierran al pulsarlos (e.target === overlay)
    // devolver la hoja a su sitio para la próxima vez que se abra (tras el fundido de las capas que lo tienen)
    setTimeout(function () {
      sheet.classList.remove('m-dragging');
      sheet.style.transform = sheet.style.transition = '';
    }, 260);
  }

  document.addEventListener('touchstart', function (e) {
    drag = null;
    if (!mq.matches || e.touches.length !== 1) return;
    var sheet = e.target.closest && e.target.closest(SHEETS);
    if (!sheet || sheet.hasAttribute('data-no-swipe') || e.target.closest(NO_DRAG)) return;
    if (scrolledInside(e.target, sheet)) return;
    drag = { sheet: sheet, y0: e.touches[0].clientY, x0: e.touches[0].clientX, t0: Date.now(), dy: 0, active: false };
  }, { passive: true });

  document.addEventListener('touchmove', function (e) {
    if (!drag) return;
    var dy = e.touches[0].clientY - drag.y0;
    var dx = e.touches[0].clientX - drag.x0;
    if (!drag.active) {
      // hacia arriba o de lado: es scroll o un carrusel, no el gesto
      if (dy < 0 || Math.abs(dx) > Math.abs(dy)) { drag = null; return; }
      if (dy < 8) return;
      drag.active = true;
      drag.sheet.classList.add('m-dragging');
    }
    if (e.cancelable) e.preventDefault();
    drag.dy = Math.max(0, dy);
    drag.sheet.style.transform = 'translateY(' + drag.dy + 'px)';
  }, { passive: false });

  function endDrag() {
    if (!drag || !drag.active) { drag = null; return; }
    var d = drag; drag = null;
    var h = d.sheet.offsetHeight || 1;
    var speed = d.dy / Math.max(1, Date.now() - d.t0); // px/ms
    d.sheet.classList.remove('m-dragging');
    d.sheet.style.transition = 'transform 0.22s ease';
    if (d.dy > Math.min(140, h * 0.3) || (speed > 0.6 && d.dy > 30)) {
      d.sheet.style.transform = 'translateY(100%)';
      setTimeout(function () { closeSheet(d.sheet); }, 200);
    } else {
      d.sheet.style.transform = '';
      setTimeout(function () { d.sheet.style.transition = ''; }, 240);
    }
  }
  document.addEventListener('touchend', endDrag, { passive: true });
  document.addEventListener('touchcancel', endDrag, { passive: true });

  /* ── Modo app instalada: una clase para los estilos que lo necesiten ── */
  function standalone() {
    return window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  }
  if (standalone()) document.documentElement.classList.add('is-standalone');
  window.GT.isStandalone = standalone;
})();
