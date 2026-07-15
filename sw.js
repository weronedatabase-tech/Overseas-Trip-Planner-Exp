const CACHE_NAME = 'myg-trip-v49';
const urlsToCache =[
'./',
'./index.html',
'./manifest.json',
'./frontend/css/styles.css',
'./frontend/js/tailwind.config.js',
'./backend/config.js',
'./frontend/js/app.js',
'./frontend/js/auth.js',
'./frontend/js/ui.js',
'./frontend/js/rolodex.js',
'./frontend/js/registration.js',
'./frontend/js/profile.js',
'./frontend/js/participants.js',
'./frontend/js/Pairing_Grouping.js',
'./frontend/js/attendance.js',
'./frontend/js/finance.js',
'./frontend/js/minutes.js',
'./frontend/js/files.js',
'./frontend/js/settings.js'
];

self.addEventListener('install', event => {
// Force the waiting service worker to become the active service worker immediately
self.skipWaiting();
event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
});

self.addEventListener('activate', event => {
// Delete old caches (like v1, v2, v3) so the new folder structure and config takes over
event.waitUntil(
caches.keys().then(cacheNames => {
return Promise.all(
cacheNames.map(cacheName => {
if (cacheName !== CACHE_NAME) {
return caches.delete(cacheName);
}
})
);
}).then(() => self.clients.claim()) // Instantly take control of uncontrolled clients
);
});

self.addEventListener('fetch', event => {
event.respondWith(
caches.match(event.request).then(response => {
return response || fetch(event.request).catch(() => caches.match('./index.html'));
})
);
});