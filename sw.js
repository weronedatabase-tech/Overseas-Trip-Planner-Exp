const CACHE_NAME = 'minds-myg-cache-v150';
const urlsToCache = [
'./',
'./index.html',
'./admin.html',
'./tracker.html',
'./pairing.html',
'./grouping.html',
'./volunteer.html',
'./settings.html',
'./manifest.json',
'./frontend/css/style.css',
'./backend/config.js',
'./frontend/js/state.js',
'./frontend/js/api.js',
'./frontend/js/dnd.js',
'./frontend/js/ui.js',
'./frontend/js/auth.js',
'./frontend/js/pairing.js',
'./frontend/js/grouping.js',
'./frontend/js/comm.js',
'./frontend/js/volunteer.js',
'./frontend/js/settings.js',
'./frontend/js/main.js'
];

self.addEventListener('install', event => {
self.skipWaiting();
event.waitUntil(
caches.open(CACHE_NAME)
.then(cache => {
return cache.addAll(urlsToCache);
})
);
});

self.addEventListener('activate', event => {
const cacheWhitelist = [CACHE_NAME];
event.waitUntil(
caches.keys().then(cacheNames => {
return Promise.all(
cacheNames.map(cacheName => {
if (cacheWhitelist.indexOf(cacheName) === -1) {
return caches.delete(cacheName);
}
})
);
}).then(() => {
return self.clients.claim();
})
);
});

self.addEventListener('fetch', event => {
if (event.request.method !== 'GET') return;

event.respondWith(
fetch(event.request)
.then(networkResponse => {
const responseClone = networkResponse.clone();
caches.open(CACHE_NAME).then(cache => {
cache.put(event.request, responseClone);
});
return networkResponse;
})
.catch(() => {
return caches.match(event.request);
})
);
});