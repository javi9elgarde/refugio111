/* ============================================================
   REFUGIO 111 — Conexión, guardado sin red y conflictos de edición
   · Aviso arriba: «🔴 Sin conexión · Cambios locales activos» / «🟢 Sincronizado» (se va a los 3 s).
   · safeSaveDoc(): guarda con control de versiones. Cada documento lleva `version` (entero que sube
     en cada guardado) y `actualizadoEn`. Si el servidor tiene una versión mayor que la que se editó,
     no se pisa nada: sale una hoja para elegir qué hacer.
   · Las transacciones de Firestore no funcionan sin red, así que sin conexión los cambios esperan en
     una bandeja local (localStorage, sobrevive a cerrar la app), se ven ya en pantalla y se suben
     con la misma comprobación al volver la conexión.
   ============================================================ */
(function () {
  'use strict';
  window.GT = window.GT || {};

  var OUTBOX_KEY = 'GT_outbox';
  var META = { version: 1, actualizadoEn: 1, id: 1, notaRepetida: 1 };
  var LABELS = {
    titulo: 'Título', portadaUrl: 'Portada', descripcion: 'Descripción', duracion: 'Duración', fechaLanzamiento: 'Lanzamiento',
    desarrollador: 'Desarrollador', generos: 'Géneros', plataformas: 'Plataformas', pendiente: 'Pendiente', pendientePor: 'Pendiente de',
    tipoLanzamiento: 'Tipo', earlyAccess: 'Early Access', saga: 'Saga', hype: 'Hype', trailer: 'Tráiler',
    jugador: 'Jugador', estado: 'Estado', nota: 'Nota', horas: 'Horas', mes: 'Mes', 'año': 'Año',
    plataformaJugada: 'Plataforma', comentario: 'Comentario', juegoId: 'Juego'
  };

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function same(a, b) { return JSON.stringify(a == null ? null : a) === JSON.stringify(b == null ? null : b); }
  function toast(msg, type) { if (window.GT.Toast) window.GT.Toast.show(msg, type); }
  function db() { return window.GT.db; }

  /* ── Aviso de conexión ────────────────────────────────────── */
  var bar, barTimer;
  function netbar(online) {
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'm-netbar';
      bar.setAttribute('role', 'status');
      bar.setAttribute('aria-live', 'polite');
      document.body.appendChild(bar);
    }
    clearTimeout(barTimer);
    bar.className = 'm-netbar is-shown ' + (online ? 'is-online' : 'is-offline');
    bar.textContent = online ? '🟢 Sincronizado' : '🔴 Sin conexión · Cambios locales activos';
    if (online) barTimer = setTimeout(function () { bar.classList.remove('is-shown'); }, 3000);
  }
  function startNetbar() {
    if (!navigator.onLine) netbar(false);
    window.addEventListener('offline', function () { netbar(false); });
    window.addEventListener('online', function () {
      // fuera el aviso rojo; el verde sale cuando lo pendiente ya ha subido (o se ha resuelto el conflicto)
      if (bar) bar.classList.remove('is-shown');
      flush().then(function () { netbar(true); });
    });
  }
  if (document.body) startNetbar(); else document.addEventListener('DOMContentLoaded', startNetbar);

  /* ── Bandeja local de cambios pendientes ──────────────────── */
  function readOutbox() { try { return JSON.parse(localStorage.getItem(OUTBOX_KEY)) || []; } catch (e) { return []; } }
  function writeOutbox(list) { try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(list)); } catch (e) { /* sin espacio: queda en memoria de Firestore */ } }

  // valor original de un campo antes de editarlo (en el Registro la caché aparta las notas repetidas a notaRepetida)
  function prevValue(doc, k) {
    if (!doc) return undefined;
    if (k === 'nota' && doc.notaRepetida !== undefined) return doc.notaRepetida;
    return doc[k];
  }
  function pickPrev(prevDoc, data) {
    var p = {};
    Object.keys(data).forEach(function (k) { p[k] = prevValue(prevDoc, k); if (p[k] === undefined) p[k] = null; });
    return p;
  }

  function enqueue(item) {
    var list = readOutbox();
    var old = list.filter(function (o) { return o.col === item.col && o.id === item.id; })[0];
    if (old) {
      // varias ediciones sin red del mismo documento: se juntan y se conserva la versión y los valores de partida
      old.data = Object.assign({}, old.data, item.data);
      old.prev = Object.assign({}, item.prev, old.prev);
      old.t = Date.now();
    } else {
      item.t = Date.now();
      list.push(item);
    }
    writeOutbox(list);
  }
  function dequeue(col, id) {
    writeOutbox(readOutbox().filter(function (o) { return !(o.col === col && o.id === id); }));
  }

  // Firestore manda las instantáneas sin los cambios que siguen en la bandeja: se vuelven a aplicar encima
  function overlay(col, list) {
    var pend = readOutbox().filter(function (o) { return o.col === col; });
    if (!pend.length) return list;
    var byId = {};
    list.forEach(function (d) { byId[d.id] = d; });
    pend.forEach(function (o) { if (byId[o.id]) Object.assign(byId[o.id], o.data); });
    return list;
  }

  function cacheDoc(col, id) {
    var c = window.GT._cache && window.GT._cache[col];
    if (!c) return null;
    for (var i = 0; i < c.length; i++) if (c[i].id === id) return c[i];
    return null;
  }

  /* ── Guardado con transacción ─────────────────────────────── */
  function isOfflineError(err) {
    return !navigator.onLine || (err && (err.code === 'unavailable' || err.code === 'deadline-exceeded'));
  }

  // escribe si nadie ha guardado una versión más nueva (o siempre, con force); devuelve la versión nueva
  function commit(col, id, data, base, force) {
    var ref = db().collection(col).doc(id);
    return db().runTransaction(function (tx) {
      return tx.get(ref).then(function (snap) {
        if (!snap.exists) throw { missing: true };
        var server = snap.data();
        var sv = server.version || 0;
        if (!force && sv > base) throw { conflict: true, server: server, version: sv };
        tx.update(ref, Object.assign({}, data, {
          version: sv + 1,
          actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
        }));
        return sv + 1;
      });
    }).then(function (v) {
      // la caché sabe ya la versión nueva: un segundo guardado seguido no se toma por conflicto
      var d = cacheDoc(col, id);
      if (d) d.version = v;
      return v;
    });
  }

  /**
   * Guarda `newData` en `collection/docId` sin pisar cambios de otros.
   * @param {string} collection
   * @param {string} docId
   * @param {Object} newData            campos a guardar
   * @param {number} currentLocalVersion versión del documento cuando se empezó a editar (0 si no tenía)
   * @param {Object} [prevDoc]          documento antes de editar (para «Combinar»); por defecto, el de la caché
   * @returns {Promise<{estado: 'guardado'|'pendiente'|'mio'|'servidor'|'combinado'|'borrado'}>}
   */
  function safeSaveDoc(collection, docId, newData, currentLocalVersion, prevDoc) {
    var item = {
      col: collection, id: docId, data: newData,
      base: currentLocalVersion || 0,
      prev: pickPrev(prevDoc || cacheDoc(collection, docId), newData)
    };
    if (!navigator.onLine || !db()) {
      enqueue(item);
      return Promise.resolve({ estado: 'pendiente' });
    }
    return attempt(item).catch(function (err) {
      if (isOfflineError(err)) { enqueue(item); return { estado: 'pendiente' }; }
      console.error('safeSaveDoc:', err);
      toast('No se pudo guardar: ' + (err && err.message || err), 'error');
      throw err;
    });
  }

  function attempt(item) {
    return commit(item.col, item.id, item.data, item.base).then(function () {
      return { estado: 'guardado' };
    }, function (err) {
      if (err && err.missing) {
        toast('Ese elemento se borró en otro dispositivo; tu cambio no se ha guardado', 'error');
        return { estado: 'borrado' };
      }
      if (err && err.conflict) return resolveConflict(item, err.server, err.version);
      throw err;
    });
  }

  /* ── Conflictos ───────────────────────────────────────────── */
  // campos que tocaste tú, que tocó el otro y los que chocan (los dos los cambiasteis distinto)
  function analyse(item, server) {
    var rows = [], mineOnly = {}, collide = false;
    Object.keys(item.data).forEach(function (k) {
      if (META[k]) return;
      var mine = item.data[k], prev = item.prev[k], srv = server[k];
      if (srv === undefined) srv = null;
      var touchedByMe = !same(mine, prev), touchedByThem = !same(srv, prev);
      if (touchedByMe) mineOnly[k] = mine;
      if (same(mine, srv)) return;
      var who = touchedByMe && touchedByThem ? 'both' : touchedByMe ? 'me' : 'them';
      if (who === 'both') collide = true;
      rows.push({ k: k, mine: mine, srv: srv, who: who });
    });
    return { rows: rows, mineOnly: mineOnly, collide: collide };
  }

  function fmt(v) {
    if (v === null || v === undefined || v === '') return '—';
    if (v === true) return 'Sí';
    if (v === false) return 'No';
    if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
    if (typeof v === 'object') return JSON.stringify(v);
    var s = String(v);
    return s.length > 140 ? s.slice(0, 140) + '…' : s;
  }

  // la caché vuelve a lo que hay en el servidor y se repinta
  function restoreFromServer(col, id, server) {
    var c = window.GT._cache && window.GT._cache[col];
    if (c) {
      for (var i = 0; i < c.length; i++) if (c[i].id === id) { c[i] = Object.assign({ id: id }, server); break; }
      if (col === 'registro' && typeof window.firstScoresOnly === 'function') window.firstScoresOnly(c); // una nota por jugador y juego
    }
    if (window.GT._notifyChange) window.GT._notifyChange();
  }

  function resolveConflict(item, server, serverVersion) {
    var a = analyse(item, server);
    // los cambios del otro dispositivo son en campos que no tocaste: se combinan sin preguntar
    if (!a.collide) {
      var merged = Object.keys(a.mineOnly).length ? a.mineOnly : null;
      if (!merged) { restoreFromServer(item.col, item.id, server); return Promise.resolve({ estado: 'servidor' }); }
      return commit(item.col, item.id, merged, serverVersion).then(function () {
        toast('Guardado junto con los cambios de otro dispositivo');
        return { estado: 'combinado' };
      });
    }
    var name = server.titulo || (cacheDoc('biblioteca', server.juegoId) || {}).titulo || '';
    return askUser(a.rows, name).then(function (choice) {
      if (choice === 'servidor') {
        restoreFromServer(item.col, item.id, server);
        toast('Se queda la versión del servidor');
        return { estado: 'servidor' };
      }
      var data = choice === 'mio' ? item.data : a.mineOnly;
      return commit(item.col, item.id, data, 0, true).then(function () {
        toast(choice === 'mio' ? 'Guardada tu versión' : 'Cambios combinados');
        return { estado: choice === 'mio' ? 'mio' : 'combinado' };
      });
    });
  }

  var queue = Promise.resolve(); // una hoja de conflicto cada vez
  function askUser(rows, name) {
    var p = queue.then(function () {
      return new Promise(function (resolve) {
        var ov = document.createElement('div');
        ov.className = 'm-sheet-overlay';
        ov.innerHTML =
          '<div class="m-sheet" role="dialog" aria-modal="true" aria-labelledby="mConflictTitle" data-no-swipe>' +
            '<h3 id="mConflictTitle">⚠️ Conflicto de edición</h3>' +
            '<p>' + (name ? '<b>' + esc(name) + '</b>: ' : '') + 'alguien guardó cambios en otro dispositivo mientras editabas. ' +
              'En rojo, lo que habéis cambiado los dos.</p>' +
            '<table class="m-diff"><thead><tr><th>Campo</th><th>Tu versión</th><th>Servidor</th></tr></thead><tbody>' +
            rows.map(function (r) {
              var tag = r.who === 'both' ? 'cambiado por los dos' : r.who === 'me' ? 'solo lo cambiaste tú' : 'solo cambió en el servidor';
              return '<tr class="' + (r.who === 'both' ? 'm-diff__both' : '') + '"><td>' + esc(LABELS[r.k] || r.k) + '<small>' + tag + '</small></td>' +
                '<td>' + esc(fmt(r.mine)) + '</td><td>' + esc(fmt(r.srv)) + '</td></tr>';
            }).join('') +
            '</tbody></table>' +
            '<div class="m-sheet__actions">' +
              '<button type="button" data-c="mio">Quedarme con el mío</button>' +
              '<button type="button" data-c="servidor">Usar el del servidor</button>' +
              '<button type="button" data-c="combinar" class="is-primary">Combinar</button>' +
            '</div>' +
            '<p style="margin:.7rem 0 0;font-size:.74rem">Combinar: se guardan los campos que cambiaste tú y se respeta el resto de lo del servidor. ' +
              'En los campos en rojo gana tu versión.</p>' +
          '</div>';
        document.body.appendChild(ov);
        if (window.GT.haptic) window.GT.haptic(60);
        ov.querySelector('.is-primary').focus();
        ov.addEventListener('click', function (e) {
          var b = e.target.closest('button[data-c]');
          if (!b) return;
          ov.remove();
          resolve(b.getAttribute('data-c'));
        });
      });
    });
    queue = p.catch(function () {});
    return p;
  }

  /* ── Subir lo pendiente ───────────────────────────────────── */
  var flushing = null;
  function flush() {
    if (flushing) return flushing;
    if (!navigator.onLine || !db() || !readOutbox().length) return Promise.resolve();
    var n = 0;
    flushing = readOutbox().reduce(function (p, item) {
      return p.then(function () {
        return attempt(item).then(function () { dequeue(item.col, item.id); n++; }, function (err) {
          // sin red otra vez: se queda en la bandeja para el siguiente intento
          if (!isOfflineError(err)) { console.error('Sync:', err); dequeue(item.col, item.id); }
        });
      });
    }, Promise.resolve()).then(function () {
      flushing = null;
      if (n) toast(n === 1 ? '1 cambio sincronizado' : n + ' cambios sincronizados');
    });
    return flushing;
  }

  // al abrir la app con cambios de una sesión sin red anterior
  function flushWhenReady() {
    if (window.GT.onDataReady) window.GT.onDataReady(function () { setTimeout(flush, 1500); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', flushWhenReady);
  else flushWhenReady();

  window.GT.Sync = {
    safeSaveDoc: safeSaveDoc,
    overlay: overlay,
    flush: flush,
    pending: function () { return readOutbox().length; }
  };
  window.safeSaveDoc = safeSaveDoc;
})();
