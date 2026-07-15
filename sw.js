const CACHE_NAME = 'myg-trip-v50';
// [CONSIDERATION - SPA to MPA Migration]: Cache list updated to include all new HTML files
// and core.js engine for offline availability and fast routing.
const urlsToCache =[
    './',
    './index.html',
    './dashboard.html',
    './profile.html',
    './roster.html',
    './logistics.html',
    './attendance.html',
    './finance.html',
    './minutes.html',
    './files.html',
    './settings.html',
    './manifest.json',
    './frontend/css/styles.css',
    './frontend/js/tailwind.config.js',
    './backend/config.js',
    './frontend/js/core.js',
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
    self.skipWaiting();
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request).catch(() => caches.match('./index.html'));
        })
    );
});