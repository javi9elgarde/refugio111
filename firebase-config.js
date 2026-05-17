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
