/* ============================================================
   REFUGIO 111 — Avisos push (Firebase Cloud Messaging)
   · El permiso solo se pide al pulsar el botón «🔔 Avisos» (hoja «Más» o cualquier [data-push-btn]).
   · iPhone/iPad: los avisos web solo funcionan con la app añadida a la pantalla de inicio (iOS 16.4+);
     si no lo está, se explica cómo hacerlo en vez de pedir el permiso.
   · Al conceder el permiso, el token se guarda en Firestore: pushTokens/{token}.
   · Las notificaciones las pinta sw.js (eventos push y notificationclick) y las manda
     .github/scripts/send-release-push.js cada día.
   ============================================================ */
(function () {
  'use strict';
  window.GT = window.GT || {};

  // Firebase Console → Configuración del proyecto → Cloud Messaging → Certificados push web → «Par de claves»
  var VAPID_KEY = 'BJfxjA-tdC3KsQwWoyKiaa1f2NdHzWGQF_fL207c7XSZUA2ASYPXB2hCSRCCyq8g-smqukOt0-sYC37charwrhU';
  var SDK = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js';
  var LS_TOKEN = 'GT_pushToken';
  var LS_SYNC  = 'GT_pushSync';   // «jugador|día» del último guardado del token
  var TIPOS = { lanzamiento: true, chollo: true };

  function ls(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    } catch (e) { return null; }
  }
  function toast(msg, type) { if (window.GT.Toast) window.GT.Toast.show(msg, type); else if (type === 'error') alert(msg); }

  /* ── Plataforma ───────────────────────────────────────────── */
  var ua = navigator.userAgent || '';
  var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/i.test(ua);
  function standalone() {
    return window.navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  }
  function plataforma() { return isIOS ? 'ios' : isAndroid ? 'android' : 'escritorio'; }
  function supported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && window.firebase && window.GT.db;
  }

  /* ── Hoja informativa ─────────────────────────────────────── */
  function info(title, html) {
    var ov = document.createElement('div');
    ov.className = 'm-sheet-overlay';
    ov.innerHTML = '<div class="m-sheet" role="dialog" aria-modal="true" aria-label="' + title + '">' +
      '<h3>' + title + '</h3>' + html +
      '<div class="m-sheet__actions"><button type="button" class="is-primary" data-sheet-close>Entendido</button></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) {
      if (e.target === ov || e.target.closest('[data-sheet-close]')) ov.remove();
    });
    ov.querySelector('[data-sheet-close]').focus();
  }

  /* ── Firebase Messaging bajo demanda (no pesa en páginas donde no se usa) ── */
  var sdkLoading = null;
  function messaging() {
    if (!sdkLoading) {
      sdkLoading = new Promise(function (resolve, reject) {
        if (firebase.messaging) return resolve();
        var s = document.createElement('script');
        s.src = SDK;
        s.onload = resolve;
        s.onerror = function () { sdkLoading = null; reject(new Error('No se pudo cargar Firebase Messaging')); };
        document.head.appendChild(s);
      });
    }
    return sdkLoading.then(function () { return firebase.messaging(); });
  }

  function getToken() {
    return Promise.all([messaging(), navigator.serviceWorker.ready]).then(function (r) {
      return r[0].getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: r[1] });
    });
  }

  function saveToken(token) {
    var jugador = (window.GT.getActivePlayer && window.GT.getActivePlayer()) || null;
    var ref = window.GT.db.collection('pushTokens').doc(token);
    return ref.get().then(function (snap) {
      var prev = snap.exists ? snap.data() : {};
      return ref.set({
        token: token,
        jugador: jugador,
        plataforma: plataforma(),
        // se respetan los tipos que alguien haya apagado; los tipos nuevos llegan encendidos
        tiposSubscripcion: Object.assign({}, TIPOS, prev.tiposSubscripcion || {}),
        actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }).then(function () {
      ls(LS_TOKEN, token);
      ls(LS_SYNC, jugador + '|' + new Date().toISOString().slice(0, 10));
    });
  }

  /* ── Activar / desactivar ─────────────────────────────────── */
  function enable() {
    if (isIOS && !standalone()) {
      info('📲 Añade la app a Inicio',
        '<p>En iPhone y iPad los avisos solo llegan con Refugio 111 instalada (iOS 16.4 o superior).</p>' +
        '<p>1. Abre esta página en <b>Safari</b>.<br>2. Pulsa <b>Compartir</b> (el cuadrado con la flecha).<br>' +
        '3. Elige <b>Añadir a pantalla de inicio</b>.<br>4. Abre la app desde el icono y vuelve a pulsar «🔔 Avisos».</p>');
      return Promise.resolve(false);
    }
    if (!supported()) {
      info('🔕 Sin avisos aquí', '<p>Este navegador no admite notificaciones push. Prueba con Chrome, Edge, Firefox o la app instalada.</p>');
      return Promise.resolve(false);
    }
    if (/^PEGA_AQUI/.test(VAPID_KEY)) {
      toast('Falta la clave VAPID en js/push-manager.js', 'error');
      return Promise.resolve(false);
    }
    if (Notification.permission === 'denied') {
      info('🔕 Avisos bloqueados', '<p>Los bloqueaste antes. Actívalos en los ajustes del sitio (el candado junto a la dirección) ' +
        'o, en la app instalada, en Ajustes → Notificaciones → Refugio 111.</p>');
      return Promise.resolve(false);
    }
    // la petición sale directamente del toque en el botón (iOS y Chrome lo exigen)
    return Notification.requestPermission().then(function (perm) {
      if (perm !== 'granted') { toast('Sin permiso no hay avisos', 'error'); return false; }
      return getToken().then(saveToken).then(function () {
        toast('Avisos activados 🔔');
        render();
        return true;
      });
    }).catch(function (err) {
      console.error('Push:', err);
      toast('No se pudieron activar los avisos: ' + (err && err.message || err), 'error');
      return false;
    });
  }

  function disable() {
    var token = ls(LS_TOKEN);
    var jobs = [];
    if (token && window.GT.db) jobs.push(window.GT.db.collection('pushTokens').doc(token).delete());
    jobs.push(messaging().then(function (m) { return m.deleteToken(); }));
    return Promise.all(jobs).catch(function (e) { console.warn('Push off:', e); }).then(function () {
      ls(LS_TOKEN, null); ls(LS_SYNC, null);
      toast('Avisos desactivados');
      render();
    });
  }

  function isOn() { return !!ls(LS_TOKEN) && 'Notification' in window && Notification.permission === 'granted'; }

  /* ── Botones ──────────────────────────────────────────────── */
  var buttons = [];
  function render() {
    var on = isOn();
    buttons.forEach(function (b) {
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.innerHTML = on ? '🔔 Avisos activados <small style="margin-left:auto;opacity:.6">quitar</small>' : '🔕 Activar avisos de lanzamientos';
    });
  }
  function bind(b) {
    buttons.push(b);
    b.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (isOn()) disable(); else enable();
    });
  }
  function mountButtons() {
    document.querySelectorAll('[data-push-btn]').forEach(bind);
    var sheet = document.getElementById('navMobile');
    if (sheet && !sheet.querySelector('.m-push-btn')) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'nav__link m-push-btn';
      sheet.appendChild(b);
      bind(b);
    }
    render();
  }

  // con el permiso ya dado, se renueva el token en silencio (FCM lo rota) y se apunta el jugador activo, una vez al día
  function refresh() {
    if (!isOn() || !supported() || /^PEGA_AQUI/.test(VAPID_KEY) || !navigator.onLine) return;
    var jugador = (window.GT.getActivePlayer && window.GT.getActivePlayer()) || null;
    if (ls(LS_SYNC) === jugador + '|' + new Date().toISOString().slice(0, 10)) return;
    getToken().then(function (token) {
      var old = ls(LS_TOKEN);
      if (old && old !== token) window.GT.db.collection('pushTokens').doc(old).delete().catch(function () {});
      return saveToken(token);
    }).catch(function (e) { console.warn('Push refresh:', e); });
  }

  function start() {
    mountButtons();
    // tras el acceso con Google (las reglas piden usuario)
    if (window.GT.auth) {
      var off = window.GT.auth.onAuthStateChanged(function (u) { if (u) { off(); setTimeout(refresh, 2500); } });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.GT.Push = { enable: enable, disable: disable, isOn: isOn, platform: plataforma };
})();
