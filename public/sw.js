self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
  caches.open('cc-static-v4').then((cache) => cache.addAll(['/','/favicon.ico','/manifest.webmanifest']))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
  // Keep only current static cache; drop everything else (including pages/assets and old versions)
  const keep = ['cc-static-v4'];
  await Promise.all(keys.filter(k => !keep.includes(k)).map(k => caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  // Network-first for HTML pages
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(event.request);
  const cache = await caches.open('cc-pages-v3');
        cache.put(event.request, fresh.clone());
        return fresh;
      } catch (e) {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        return caches.match('/');
      }
    })());
    return;
  }
  // Cache-first for other GET assets
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    const res = await fetch(event.request);
  const cache = await caches.open('cc-assets-v3');
    cache.put(event.request, res.clone());
    return res;
  })());
});

// Support triggering skipWaiting from the page when a new SW is installed
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data.type === 'CACHE_URLS') {
    const urls = Array.isArray(event.data.payload) ? event.data.payload : [];
    event.waitUntil((async () => {
      try {
        const cache = await caches.open('cc-pages-v3');
        for (const u of urls) {
          try {
            const res = await fetch(u, { credentials: 'include' });
            await cache.put(u, res.clone());
          } catch {}
        }
      } catch {}
    })());
  }
  if (event.data.type === 'UNCACHE_URLS') {
    const urls = Array.isArray(event.data.payload) ? event.data.payload : [];
    event.waitUntil((async () => {
      try {
        const cache = await caches.open('cc-pages-v3');
        for (const u of urls) {
          try { await cache.delete(u); } catch {}
        }
      } catch {}
    })());
  }
});

// Web Push: display notifications when push messages arrive
self.addEventListener('push', (event) => {
  try {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'Notification';
    const options = {
      body: data.body || '',
      icon: data.icon || '/logo.svg',
      badge: data.badge || '/logo.svg',
      data: { url: data.url || '/', ...data },
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    // if not JSON, show a generic notification
    event.waitUntil(self.registration.showNotification('Notification'));
  }
});

self.addEventListener('notificationclick', (event) => {
  const url = event.notification?.data?.url || '/';
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
