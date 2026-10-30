/* ============================================================
   GAMETRACKER — Firebase Configuration & Real-time Sync
   Version: 20260517b
   ============================================================ */
(function () {
  'use strict';
  window.GT = window.GT || {};

  var firebaseConfig = {
    apiKey:            "AIzaSyDMytLn2U7MN-YPiW6X9Jdq5SsT6lIfvWo",
    authDomain:        "proyectodmj-f3707.firebaseapp.com",
    projectId:         "proyectodmj-f3707",
    storageBucket:     "proyectodmj-f3707.firebasestorage.app",
    messagingSenderId: "717604978468",
    appId:             "1:717604978468:web:3f52353e384a59d670bdb1"
  };

  firebase.initializeApp(firebaseConfig);
  var db = firebase.firestore();

  // Offline persistence: app works without internet and syncs when back online
  db.enablePersistence({ synchronizeTabs: true }).catch(function (err) {
    if (err.code === 'failed-precondition') {
      console.warn('Firestore offline: múltiples pestañas abiertas.');
    } else if (err.code === 'unimplemented') {
      console.warn('Firestore offline: navegador no compatible.');
    }
  });

  window.GT.db = db;

  /* ── ACCESO CON GOOGLE ──────────────────────────────────────
     Solo entran las cuentas que permiten las reglas de Firestore (los correos viven allí,
     no en este código público). */
  var auth = firebase.auth();
  window.GT.auth = auth;
  var gateShown = false;
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }

  function gate(html) {
    gateShown = true;
    var el = document.getElementById('gtGate');
    if (!el) {
      document.head.insertAdjacentHTML('beforeend', '<style>' +
        '#gtGate{position:fixed;inset:0;z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.2rem;padding:1.5rem;text-align:center;' +
        'background:radial-gradient(ellipse at 50% 30%,#141a2e,#07070f 70%);color:#e8e8f8;font-family:Inter,system-ui,sans-serif}' +
        '#gtGate img.gt-gate__logo{width:110px;filter:drop-shadow(0 0 24px rgba(245,200,66,.45))}' +
        '#gtGate h1{margin:0;font-family:Orbitron,sans-serif;font-size:1.6rem;letter-spacing:.12em;color:#f5c842}' +
        '#gtGate p{margin:0;max-width:340px;font-size:.88rem;color:rgba(232,232,248,.6)}' +
        '#gtGate .gt-gate__btn{display:inline-flex;align-items:center;gap:.6rem;padding:.75rem 1.3rem;border:0;border-radius:999px;background:#fff;color:#1f1f1f;font:600 .95rem Inter,system-ui,sans-serif;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.4)}' +
        '#gtGate .gt-gate__btn:focus-visible{outline:3px solid #f5c842;outline-offset:3px}' +
        '#gtGate .gt-gate__err{color:#f87171}</style>');
      el = document.createElement('div');
      el.id = 'gtGate';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-label', 'Entrar en Refugio 111');
      document.body.appendChild(el);
    }
    el.innerHTML = '<img class="gt-gate__logo" src="logonuevo.png" alt=""><h1>REFUGIO 111</h1>' + html;
  }

  function loginScreen(msg) {
    gate('<p>Solo para David, Javi y Mery. Entra con tu cuenta de Google.</p>' +
      (msg ? '<p class="gt-gate__err">' + esc(msg) + '</p>' : '') +
      '<button type="button" class="gt-gate__btn" id="gtGateLogin">' +
      '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>' +
      'Entrar con Google</button>');
    document.getElementById('gtGateLogin').addEventListener('click', function () {
      var provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      auth.signInWithPopup(provider).catch(function (err) {
        if (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment') return auth.signInWithRedirect(provider);
        if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') loginScreen('No se pudo entrar: ' + err.message);
      });
    });
  }

  auth.onAuthStateChanged(function (user) {
    if (!user) return loginScreen();
    // una lectura cualquiera: si las reglas no dejan, la cuenta no está permitida
    db.collection('settings').doc('accesos').get().then(function () {
      // recién entrado: a elegir quién juega, con las animaciones del Hub
      if (gateShown) location.href = 'hub.html#jugar';
    }).catch(function (err) {
      if (err.code === 'permission-denied') {
        var mail = user.email;
        auth.signOut().then(function () { loginScreen('La cuenta ' + mail + ' no tiene acceso al Refugio.'); });
      }
      // sin conexión u otro fallo: se sigue con lo guardado
    });
  });
  window.GT.signOut = function () {
    auth.signOut();
  };

  // ── In-memory cache (kept in sync via onSnapshot) ────────────
  window.GT._cache = { biblioteca: [], registro: [] };
  window.GT._dataReady  = false;
  window.GT._readyCbs   = [];
  window.GT._changeCbs  = [];

  // Called once both collections have loaded their first snapshot
  window.GT._markReady = function () {
    if (window.GT._dataReady) return;
    window.GT._dataReady = true;
    var cbs = window.GT._readyCbs.slice();
    window.GT._readyCbs = [];
    cbs.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
    // Hide loading overlay
    var el = document.getElementById('gtLoading');
    if (el) {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.35s';
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 380);
    }
  };

  // Called every time Firestore pushes an update after the initial load
  window.GT._notifyChange = function () {
    window.GT._changeCbs.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
  };

  // Register a callback to run once data is ready
  window.GT.onDataReady = function (fn) {
    if (window.GT._dataReady) { setTimeout(fn, 0); return; }
    window.GT._readyCbs.push(fn);
  };

  // Register a callback to run on every remote data change
  window.GT.onDataChange = function (fn) {
    window.GT._changeCbs.push(fn);
  };
})();
