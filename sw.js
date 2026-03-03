const CACHE = 'fmm-v2';
const FILES = ['/fmm-app.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('fmm-app.html')) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then(resp => {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return resp;
        })
        .catch(() => caches.match(e.request))
    );
  }
});

self.addEventListener('message', e => {
  if (e.data === 'CHECK_UPDATE') {
    fetch('/fmm-app.html', { cache: 'no-store' })
      .then(r => r.text())
      .then(html => {
        const match = html.match(/<!-- v(\d+) -->/);
        const serverV = match ? parseInt(match[1]) : 0;
        const currentV = parseInt(CACHE.replace('fmm-v',''));
        if (serverV > currentV) {
          self.clients.matchAll().then(clients => {
            clients.forEach(c => c.postMessage('RELOAD'));
          });
        }
      });
  }
});
