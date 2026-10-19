const CACHE_NAME = 'energyplanning-v3';
const APP_SHELL = [
    './',
    './style.css?v=2026-09-29',
    './scripts/performance.js?v=2026-09-29',
    './scripts/calculation-core.js?v=2026-09-29',
    './scripts/chart-ui.js?v=2026-09-29',
    './scripts/pdf-export.js?v=2026-09-29',
    './scripts/subsidy-ui.js?v=2026-09-29',
    './scripts/script.js?v=2026-09-29',
    './data/subsidies.json',
    './data/data.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE_NAME)
        .then((cache) => cache.addAll(APP_SHELL))
        .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.filter((key) => key.startsWith('energyplanning-') && key !== CACHE_NAME)
                .map((key) => caches.delete(key))
        ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);
    // Let the browser load CDN/extension resources directly. Worker fetches
    // use connect-src, even when the original request was a script load.
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== self.location.origin) return;
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (response.ok && response.type === 'basic' && !response.redirected) {
                    const copy = response.clone();
                    // Cache failures must not reject a successful network response.
                    event.waitUntil(caches.open(CACHE_NAME)
                        .then((cache) => cache.put(event.request, copy))
                        .catch(() => {}));
                }
                return response;
            })
            .catch(async (error) => {
                const cache = await caches.open(CACHE_NAME);
                const cached = await cache.match(event.request);
                if (cached) return cached;
                // A script or JSON request must never receive an HTML fallback.
                if (event.request.mode === 'navigate') {
                    const shell = await cache.match('./');
                    if (shell) return shell;
                }
                throw error;
            })
    );
});
