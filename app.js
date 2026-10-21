/* ============================================================
   REFUGIO 111 — comportamiento de app: hoja "Más", desplegable del menú y service worker
   ============================================================ */
(function () {
  'use strict';

  var more  = document.getElementById('tabMore');
  var sheet = document.getElementById('navMobile');

  if (more && sheet) {
    more.addEventListener('click', function () {
      more.setAttribute('aria-expanded', sheet.classList.toggle('open') ? 'true' : 'false');
    });
  }

  document.querySelectorAll('.nav__dropdown').forEach(function (dd) {
    var btn = dd.querySelector('.nav__dropbtn');
    btn.addEventListener('click', function () {
      btn.setAttribute('aria-expanded', dd.classList.toggle('open') ? 'true' : 'false');
    });
  });

  // un toque fuera cierra la hoja y el desplegable (el botón Más y la hamburguesa gestionan lo suyo)
  document.addEventListener('click', function (e) {
    if (e.target.closest('#tabMore, #navHamburger, .nav__dropdown')) return;
    if (sheet && !sheet.contains(e.target)) sheet.classList.remove('open');
    document.querySelectorAll('.nav__dropdown.open').forEach(function (d) { d.classList.remove('open'); });
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* sin SW la web funciona igual */ });
    });
  }
})();
