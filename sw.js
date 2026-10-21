/* Service worker de Refugio 111: la web se abre rápido y sigue mostrándose sin conexión.
   Los datos (Firestore, RAWG, IGDB) son de otros dominios y no pasan por aquí. */
const CACHE = 'refugio111-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // solo GET del mismo origen; los vídeos (peticiones por rangos) no se cachean
  if (req.method !== 'GET' || url.origin !== location.origin || req.headers.has('range') || /\.mp4$/i.test(url.pathname)) return;

  const save = (res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; };

  if (req.mode === 'navigate') {
    // páginas: primero la red (siempre la versión nueva) y, sin conexión, la última guardada
    e.respondWith(fetch(req).then(save).catch(() => caches.match(req).then((m) => m || caches.match('hub.html'))));
    return;
  }
  // imágenes, CSS y JS: lo guardado al instante y se refresca en segundo plano (las URLs llevan ?v=)
  e.respondWith(caches.match(req).then((m) => {
    const net = fetch(req).then(save).catch(() => m);
    return m || net;
  }));
});
