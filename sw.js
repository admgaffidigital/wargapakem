// ============================================================
// SERVICE WORKER v3.0 — Portal Warga RT PAKEM
// Strategi:
//   - Static Assets (JS/CSS dengan hash) → Cache First
//   - Fonts/CDN                          → Stale-While-Revalidate
//   - HTML & JSON                        → Network First
//   - Firebase                           → Bypass (real-time data)
// ============================================================

const CACHE_VERSION = 'v3.3';
const CACHE_STATIC  = `warga-pakem-static-${CACHE_VERSION}`;
const CACHE_FONTS   = `warga-pakem-fonts-${CACHE_VERSION}`;
const CACHE_DYNAMIC = `warga-pakem-dynamic-${CACHE_VERSION}`;

// Aset lokal yang langsung di-cache saat install
const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/National_emblem_of_Indonesia_Garuda_Pancasila.svg',
];

// Domain CDN yang menggunakan Stale-While-Revalidate
const SWR_HOSTS = [
    'fonts.googleapis.com',
    'fonts.gstatic.com',
];

// ===== INSTALL — Pre-cache aset kritis =====
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_STATIC)
            .then((cache) => cache.addAll(PRECACHE_ASSETS).catch(() => {}))
            .then(() => self.skipWaiting()) // Aktifkan SW baru langsung
    );
});

// ===== ACTIVATE — Hapus semua cache versi lama =====
self.addEventListener('activate', (event) => {
    const validCaches = [CACHE_STATIC, CACHE_FONTS, CACHE_DYNAMIC];
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys
                    .filter((key) => !validCaches.includes(key))
                    .map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim()) // Ambil alih semua tab yang terbuka
    );
});

// ===== FETCH — Strategi berdasarkan tipe resource =====
self.addEventListener('fetch', (event) => {
    const req = event.request;
    const url = new URL(req.url);

    // Hanya handle GET request
    if (req.method !== 'GET') return;

    // === Bypass Firebase & googleapis data — biarkan Network berjalan normal ===
    if (
        url.hostname.includes('firestore.googleapis.com') ||
        url.hostname.includes('firebasedatabase.app') ||
        url.hostname.includes('firebaseapp.com') ||
        url.hostname.includes('identitytoolkit.googleapis.com') ||
        (url.hostname.includes('googleapis.com') && url.pathname.includes('/v1/'))
    ) {
        return; // Tidak intercept — biarkan Firebase WebSocket/HTTP berjalan
    }

    // === STRATEGI 1: Fonts & CDN — Stale-While-Revalidate ===
    // Sajikan dari cache langsung, update cache di background
    const isFont = SWR_HOSTS.some((host) => url.hostname.includes(host));
    if (isFont) {
        event.respondWith(staleWhileRevalidate(req, CACHE_FONTS));
        return;
    }

    // === STRATEGI 2: JS/CSS assets dengan hash — Cache First ===
    // File dengan hash di nama tidak berubah — aman cache selamanya
    const hasHash = /\/assets\/[^/]+-[a-zA-Z0-9]{8}\.(js|css)$/.test(url.pathname);
    if (hasHash) {
        event.respondWith(cacheFirst(req, CACHE_STATIC));
        return;
    }

    // === STRATEGI 3: Gambar & SVG — Cache First dengan fallback ===
    if (url.pathname.match(/\.(svg|png|jpg|jpeg|webp|ico|gif)$/)) {
        event.respondWith(cacheFirst(req, CACHE_DYNAMIC));
        return;
    }

    // === STRATEGI 4: HTML & JSON — Network First ===
    // Selalu coba network, fallback ke cache saat offline
    if (
        url.pathname === '/' ||
        url.pathname.endsWith('.html') ||
        url.pathname.endsWith('.json')
    ) {
        event.respondWith(networkFirst(req, CACHE_STATIC));
        return;
    }

    // === DEFAULT: Network First untuk request lain ===
    event.respondWith(networkFirst(req, CACHE_DYNAMIC));
});

// ===== HELPER: Cache First =====
async function cacheFirst(req, cacheName) {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
        const response = await fetch(req);
        if (response && response.status === 200) {
            const cache = await caches.open(cacheName);
            cache.put(req, response.clone());
        }
        return response;
    } catch {
        return new Response('Offline', { status: 503 });
    }
}

// ===== HELPER: Network First =====
async function networkFirst(req, cacheName) {
    try {
        const response = await fetch(req);
        if (response && response.status === 200) {
            const cache = await caches.open(cacheName);
            cache.put(req, response.clone());
        }
        return response;
    } catch {
        const cached = await caches.match(req);
        return cached || new Response('Offline', { status: 503 });
    }
}

// ===== HELPER: Stale While Revalidate =====
async function staleWhileRevalidate(req, cacheName) {
    const cache    = await caches.open(cacheName);
    const cached   = await cache.match(req);

    // Fetch terbaru di background (update cache untuk request berikutnya)
    const networkPromise = fetch(req).then((response) => {
        if (response && response.status === 200) {
            cache.put(req, response.clone());
        }
        return response;
    }).catch(() => null);

    // Jika ada cache → kembalikan langsung (cepat)
    // Jika tidak ada → tunggu network
    return cached || networkPromise;
}

// ===== MESSAGE — Force refresh dari halaman =====
self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    if (event.data?.type === 'CLEAR_CACHE') {
        caches.keys().then((keys) =>
            Promise.all(keys.map((key) => caches.delete(key)))
        );
    }
});
