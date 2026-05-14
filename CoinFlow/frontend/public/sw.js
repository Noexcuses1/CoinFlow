const CACHE_NAME = 'coinflow-v2';   // ★ bump version each deployment

// Install – cache nothing (we want network-first)
self.addEventListener('install', (event) => {
  self.skipWaiting();          // activate immediately
});

// Activate – wipe old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();       // take control of all pages
});

// Fetch – network-first, fallback to cache only if offline
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache fresh responses for offline
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))   // offline fallback
  );
});