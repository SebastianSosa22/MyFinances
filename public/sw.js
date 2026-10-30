// Service worker: guarda el código de la app para que abra al instante, recibe las notificaciones push y abre la app al tocarlas
const CACHE = 'finanzas-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(
  caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('finanzas-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim())
));

const BUNDLE = /^\/_expo\/static\/js\/web\/index-[a-f0-9]+\.js$/; // el paquete principal de cada versión
const put = (req, res) => {
  if (!res || !res.ok) return res;
  const copy = res.clone();
  const path = new URL(typeof req === 'string' ? req : req.url, self.location.origin).pathname;
  caches.open(CACHE).then(async (c) => {
    // Al guardar el código de una versión nueva se borra el de las anteriores (no se acumulan megas en el teléfono)
    if (BUNDLE.test(path)) {
      const old = (await c.keys()).filter((k) => { const p = new URL(k.url).pathname; return BUNDLE.test(p) && p !== path; });
      await Promise.all(old.map((k) => c.delete(k)));
    }
    return c.put(req, copy);
  });
  return res;
};

// El código de la app lleva una huella en el nombre (index-<hash>.js) y nunca cambia: se sirve del dispositivo.
// También los íconos y las tipografías. La página (index.html) se pide a la red para traer siempre la versión
// nueva; solo si no hay red o tarda más de 4 s se usa la copia guardada.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const immutable = (sameOrigin && (url.pathname.startsWith('/_expo/static/') || /\.(png|ico|ttf|woff2?)$/.test(url.pathname)))
    || url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com';
  if (immutable) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => put(req, res))));
    return;
  }
  if (sameOrigin && req.mode === 'navigate') {
    event.respondWith(new Promise((resolve) => {
      let done = false;
      const fallback = () => caches.match('/').then((hit) => { if (!done && hit) { done = true; resolve(hit); } });
      const timer = setTimeout(fallback, 4000);
      fetch(req).then((res) => { clearTimeout(timer); put('/', res); if (!done) { done = true; resolve(res); } })
        .catch(() => { clearTimeout(timer); caches.match('/').then((hit) => { if (!done) { done = true; resolve(hit || Response.error()); } }); });
    }));
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { /* sin datos */ }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Finanzas', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) if ('focus' in client) return client.focus();
      return self.clients.openWindow(url);
    })
  );
});
