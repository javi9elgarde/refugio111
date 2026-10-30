/* ============================================================
   REFUGIO 111 — Avisos de lanzamientos (se ejecuta en GitHub Actions)
   1. Busca en `biblioteca` los juegos con fechaLanzamiento = hoy (hora de Madrid).
   2. Cada aviso se reclama en `pushLogs/{tipo}_{fecha}_{juegoId}` con create(): si ya existe, ya se mandó
      (aunque el workflow se lance dos veces el mismo día).
   3. Lo envía con firebase-admin (API HTTP v1 de FCM) a los tokens de `pushTokens` con el tipo activado
      y borra los tokens que FCM da por muertos.

   Variables de entorno:
     FIREBASE_SERVICE_ACCOUNT  JSON de la cuenta de servicio (secreto del repositorio)
     FECHA                     opcional, AAAA-MM-DD para probar otro día
     DRY_RUN                   'true' para ver qué se mandaría sin mandar nada
     SITE_URL                  opcional, URL pública (para iconos absolutos)
   ============================================================ */
'use strict';

const admin = require('firebase-admin');

const SITE_URL = (process.env.SITE_URL || 'https://javi9elgarde.github.io/refugio111/').replace(/\/?$/, '/');
const DRY_RUN = String(process.env.DRY_RUN || '').toLowerCase() === 'true';

// Un texto por tipo de aviso: para añadir «chollo» u otros basta con otra entrada y otra consulta
const TIPOS = {
  lanzamiento: (g) => ({
    titulo: '🎮 ¡Hoy sale ' + g.titulo + '!',
    cuerpo: [g.desarrollador, (g.plataformas || []).join(' · ')].filter(Boolean).join(' — ') || 'Ya disponible',
    url: 'biblioteca.html?open=' + encodeURIComponent(g.id)
  })
};

function hoyMadrid() {
  // 'sv-SE' da el formato AAAA-MM-DD
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
}

// Portadas de RAWG a tamaño reducido (como en la web): la imagen de una notificación debe pesar poco
function thumb(url) {
  return String(url || '').replace(/^(https:\/\/media\.rawg\.io\/media\/)(?!resize\/|crop\/)/, '$1resize/640/-/');
}

function init() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('Falta el secreto FIREBASE_SERVICE_ACCOUNT');
  const cred = JSON.parse(raw);
  admin.initializeApp({ credential: admin.credential.cert(cred), projectId: cred.project_id });
  return admin.firestore();
}

async function tokensFor(db, tipo) {
  const snap = await db.collection('pushTokens').where('tiposSubscripcion.' + tipo, '==', true).get();
  return snap.docs.map((d) => d.id);
}

const DEAD = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token', 'messaging/invalid-argument']);

async function send(db, tipo, item, tokens) {
  const texto = TIPOS[tipo](item);
  // solo datos (sin bloque notification): sw.js pinta el aviso y así no sale duplicado
  const data = {
    tipo,
    titulo: texto.titulo,
    cuerpo: texto.cuerpo,
    url: texto.url,
    juegoId: String(item.id),
    tag: tipo + '-' + item.id,
    icono: 'icon-192.png'
  };
  if (item.portadaUrl) data.imagen = thumb(item.portadaUrl);

  const dead = [];
  let ok = 0;
  // sendEach admite hasta 500 mensajes por llamada
  for (let i = 0; i < tokens.length; i += 500) {
    const lote = tokens.slice(i, i + 500);
    const res = await admin.messaging().sendEach(lote.map((token) => ({
      token,
      data,
      webpush: {
        headers: { Urgency: 'high', TTL: String(60 * 60 * 20) }, // si el móvil está apagado, vale hasta 20 h
        fcmOptions: { link: SITE_URL + texto.url }
      }
    })));
    ok += res.successCount;
    res.responses.forEach((r, j) => {
      if (!r.success) {
        const code = r.error && r.error.code;
        console.warn('  ✗', code, lote[j].slice(0, 16) + '…');
        if (DEAD.has(code)) dead.push(lote[j]);
      }
    });
  }
  if (dead.length) {
    const batch = db.batch();
    dead.forEach((t) => batch.delete(db.collection('pushTokens').doc(t)));
    await batch.commit();
    console.log('  🧹 tokens caducados borrados:', dead.length);
  }
  return { ok, fallos: tokens.length - ok, borrados: dead.length };
}

async function main() {
  const fecha = process.env.FECHA && /^\d{4}-\d{2}-\d{2}$/.test(process.env.FECHA) ? process.env.FECHA : hoyMadrid();
  console.log('📅 Lanzamientos del', fecha, DRY_RUN ? '(prueba, no se envía nada)' : '');
  const db = init();

  const juegos = (await db.collection('biblioteca').where('fechaLanzamiento', '==', fecha).get())
    .docs.map((d) => Object.assign({ id: d.id }, d.data()));
  console.log('🎮 Juegos que salen:', juegos.length ? juegos.map((g) => g.titulo).join(', ') : 'ninguno');
  if (!juegos.length) return;

  const tokens = await tokensFor(db, 'lanzamiento');
  console.log('📱 Dispositivos suscritos:', tokens.length);
  if (!tokens.length) return;

  for (const g of juegos) {
    const logRef = db.collection('pushLogs').doc('lanzamiento_' + fecha + '_' + g.id);
    if (DRY_RUN) {
      const ya = (await logRef.get()).exists;
      console.log(ya ? '  ⏭ ya enviado:' : '  → se enviaría:', TIPOS.lanzamiento(g).titulo);
      continue;
    }
    try {
      // reclamar el aviso de forma atómica: si el documento ya existe, otro envío se adelantó
      await logRef.create({ tipo: 'lanzamiento', juegoId: g.id, titulo: g.titulo, fecha, estado: 'enviando', creadoEn: admin.firestore.FieldValue.serverTimestamp() });
    } catch (e) {
      if (e.code === 6 || /already exists/i.test(e.message)) { console.log('  ⏭ ya enviado:', g.titulo); continue; }
      throw e;
    }
    try {
      const r = await send(db, 'lanzamiento', g, tokens);
      console.log('  ✓', g.titulo, '→', r.ok, 'enviados,', r.fallos, 'fallidos');
      if (r.ok === 0) await logRef.delete(); // nada llegó: que el próximo intento lo vuelva a probar
      else await logRef.update({ estado: 'enviado', enviados: r.ok, fallidos: r.fallos, enviadoEn: admin.firestore.FieldValue.serverTimestamp() });
    } catch (e) {
      await logRef.delete().catch(() => {});
      throw e;
    }
  }
}

main().catch((e) => { console.error('❌', e); process.exit(1); });
