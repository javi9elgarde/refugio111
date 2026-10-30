/* Service worker de Refugio 111: la web se abre rápido, funciona sin conexión y muestra los avisos push.
   Los datos (Firestore, RAWG, IGDB) no pasan por aquí: Firestore guarda los suyos con su propia persistencia.
   Al cambiar este archivo, sube VERSION: se vuelven a descargar las páginas y se borra la caché vieja. */
const VERSION = '20261030b';
const CACHE = 'refugio111-' + VERSION;

// las 28 páginas; los JS y CSS de cada una se sacan de su propio HTML (con su ?v=), así no hay que mantener otra lista
const PAGES = [
  'hub.html', 'index.html', 'biblioteca.html', 'registro.html', 'backlog.html', 'pendientes.html', 'eventos.html',
  'halloffame.html', 'jugadores.html', 'estadisticas.html', 'noticias.html', 'tombola.html', 'importar.html',
  'mt-hub.html', 'mt-general.html', 'mt-biblioteca.html', 'mt-registro.html', 'mt-pendientes.html',
  'mt-favoritos.html', 'mt-perfil.html', 'mt-importar.html',
  'import-david.html', 'import-javi.html', 'import-mery.html', 'limpiar-duplicados.html', 'reparar-registro.html',
  'medir-sprite.html', 'quitar-fondo.html'
];
// imágenes pequeñas que salen en todas partes (los fondos de varios MB se guardan solo al verlos)
const EXTRA = [
  'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'logonuevo.png', 'logonavegador.png',
  'logonuevorotar.png', 'logonuevosinrotar.png', 'cara_david.png', 'cara_javi.png', 'cara_mery.png'
];
// librerías externas con versión fija: sin ellas la app no arranca sin conexión
const CDN = [
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];
const CDN_HOSTS = /^https:\/\/(www\.gstatic\.com\/firebasejs\/|cdn\.jsdelivr\.net\/npm\/|fonts\.googleapis\.com\/|fonts\.gstatic\.com\/)/;

const ASSET_RE = /(?:src|href)\s*=\s*["']([^"'#]+?\.(?:js|css)(?:\?[^"'#]*)?)["']/gi;

// un fallo suelto (una página que no existe, sin red a medias) no tumba la instalación
function put(cache, url, opts) {
  return fetch(new Request(url, opts || { cache: 'reload' }))
    .then((res) => (res.ok || res.type === 'opaque') ? cache.put(url, res.clone()).then(() => res) : null)
    .catch(() => null);
}

async function precache() {
  const cache = await caches.open(CACHE);
  const assets = new Set(EXTRA);
  await Promise.all(PAGES.map(async (page) => {
    const res = await put(cache, page);
    if (!res || res.type === 'opaque') return;
    const html = await res.text();
    let m;
    ASSET_RE.lastIndex = 0;
    while ((m = ASSET_RE.exec(html))) {
      if (!/^(https?:)?\/\//i.test(m[1])) assets.add(m[1]);
    }
  }));
  await Promise.all([...assets].map((u) => put(cache, u)));
  // en modo cors (gstatic y jsDelivr lo permiten): las respuestas opacas ocupan mucho más cupo de almacenamiento
  await Promise.all(CDN.map((u) => put(cache, u, { mode: 'cors', credentials: 'omit' })));
}

self.addEventListener('install', (e) => {
  e.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('refugio111-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// al guardar una versión nueva (?v=) de un archivo se borran las anteriores del mismo archivo
function save(req, res) {
  if (res.ok || res.type === 'opaque') {
    const copy = res.clone();
    const url = new URL(req.url);
    caches.open(CACHE).then(async (c) => {
      await c.put(req, copy);
      if (url.origin !== location.origin || !url.search) return;
      const keys = await c.keys();
      keys.forEach((k) => {
        const u = new URL(k.url);
        if (u.origin === url.origin && u.pathname === url.pathname && u.search !== url.search && u.search) c.delete(k);
      });
    });
  }
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  // solo lo nuestro y las librerías de CDN; los vídeos (peticiones por rangos) no se cachean
  if (!sameOrigin && !CDN_HOSTS.test(req.url)) return;
  if (req.headers.has('range') || /\.(mp4|webm)$/i.test(url.pathname)) return;

  if (req.mode === 'navigate') {
    // páginas: primero la red (siempre la versión nueva); sin conexión, la guardada aunque la URL lleve ?open=…
    e.respondWith(
      fetch(req).then((res) => save(req, res)).catch(() =>
        caches.match(req, { ignoreSearch: true }).then((m) => m || caches.match('hub.html')))
    );
    return;
  }
  if (!sameOrigin) {
    // librerías de CDN con versión en la URL: nunca cambian, así que lo guardado vale para siempre
    e.respondWith(caches.match(req).then((m) => m ||
      fetch(new Request(req.url, { mode: 'cors', credentials: 'omit' }))
        .catch(() => fetch(req))
        .then((res) => save(req, res))));
    return;
  }
  // imágenes, CSS y JS: lo guardado al instante y se refresca en segundo plano (las URLs llevan ?v=)
  e.respondWith(caches.match(req).then((m) => {
    const net = fetch(req).then((res) => save(req, res)).catch(() => m);
    return m || net;
  }));
});

/* ── AVISOS PUSH (FCM, mensajes de solo datos) ──────────────────────────
   Carga: { data: { tipo, titulo, cuerpo, icono, imagen, url, juegoId, tag } }
   tipo: 'lanzamiento' | 'chollo' | … (cada tipo nuevo solo necesita su texto en el envío) */
self.addEventListener('push', (e) => {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch (err) { p = { data: { cuerpo: e.data && e.data.text() } }; }
  const d = p.data || {};
  const n = p.notification || {};
  const scope = self.registration.scope;
  const title = d.titulo || n.title || 'Refugio 111';
  const options = {
    body: d.cuerpo || n.body || '',
    icon: new URL(d.icono || 'icon-192.png', scope).href,
    badge: new URL('icon-192.png', scope).href,
    tag: d.tag || (d.tipo && d.juegoId ? d.tipo + '-' + d.juegoId : undefined),
    renotify: !!d.tag,
    data: { url: new URL(d.url || 'index.html', scope).href, tipo: d.tipo || '' },
    lang: 'es',
    vibrate: [30, 60, 30]
  };
  if (d.imagen || n.image) options.image = d.imagen || n.image;
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // ya abierta en esa misma ficha: al frente
    const exact = wins.find((w) => w.url === target);
    if (exact) return exact.focus();
    // otra pestaña de la app: se lleva a la ficha
    const ours = wins.find((w) => w.url.startsWith(self.registration.scope));
    if (ours) {
      try { const w = await ours.navigate(target); if (w) return w.focus(); } catch (err) { /* sin control del SW: se abre otra */ }
    }
    return self.clients.openWindow(target);
  })());
});
