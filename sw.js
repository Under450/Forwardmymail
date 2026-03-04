const CACHE = 'fmm-v1772641614';
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(['/fmm-app.html']))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => { if (e.request.mode === 'navigate') { e.respondWith(fetch(e.request).catch(() => caches.match('/fmm-app.html'))); return; } e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))); });
