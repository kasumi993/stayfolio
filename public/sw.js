/*
 * Service worker of the web version. It makes the app installable and lets it
 * open without a connection. It never caches data: figures always come from
 * the server, so nobody sees stale amounts.
 *
 * - Pages: network first; the last copy of the app shell if offline.
 * - Built files under /_expo/static/ (their names change with each version):
 *   kept once fetched.
 * - Everything else, Supabase included: straight to the network.
 */
const SHELL = 'stayfolio-shell-v1';
const STATIC = 'stayfolio-static-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.add('/')).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== STATIC).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL).then((c) => c.put('/', copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match('/').then((r) => r || Response.error())),
    );
    return;
  }

  if (url.pathname.startsWith('/_expo/static/') || url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC).then((c) => c.put(request, copy)).catch(() => {});
            }
            return response;
          }),
      ),
    );
  }
});
