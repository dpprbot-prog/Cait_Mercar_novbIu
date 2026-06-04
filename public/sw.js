// Minimal service worker for Mercare PWA to satisfy browser installation criteria without aggressively caching assets, ensuring instant live updates.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass-through to network, allows normal browser fetching while enabling "Add to Home Screen" installation
  event.respondWith(fetch(event.request));
});
