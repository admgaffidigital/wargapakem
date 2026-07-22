// ============================================================
// SERVICE WORKER â€” Portal Warga RT PAKEM
// Strategi: Cache First untuk aset statis, Network First untuk data
// ============================================================

const CACHE_NAME = 'warga-pakem-v1.5';
const CACHE_STATIC = 'warga-pakem-static-v1.5';

// Aset lokal yang selalu di-cache saat install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/National_emblem_of_Indonesia_Garuda_Pancasila.svg',
];

// CDN library yang di-cache setelah pertama kali diakses
const CDN_CACHEABLE = [
    'cdn.jsdelivr.net',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'cdn.tailwindcss.com',
    'unpkg.com',
];

// ===== INSTALL â€” Pre-cache aset lokal =====
self.addEventListener('install', (event) => {
    console.log('[SW] Install - Pre-caching aset lokal...');
    event.waitUntil(
        caches.open(CACHE_STATIC).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch((err) => {
                console.warn('[SW] Sebagian aset gagal di-cache:', err);
            });
        }).then(() => self.skipWaiting())
    );
});

// ===== ACTIVATE â€” Hapus cache lama =====
self.addEventListener('activate', (event) => {
    console.log('[SW] Activate - Membersihkan cache lama...');
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME && key !== CACHE_STATIC)
                    .map((key) => {
                        console.log('[SW] Menghapus cache lama:', key);
                        return caches.delete(key);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// ===== FETCH â€” Strategi caching =====
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Abaikan request non-GET dan Firebase (data real-time)
    if (event.request.method !== 'GET') return;
    if (url.hostname.includes('firebasedatabase') ||
        url.hostname.includes('firebaseapp') ||
        url.hostname.includes('firestore') ||
        url.hostname.includes('googleapis.com') && url.pathname.includes('firestore')) {
        return; // Biarkan Firebase berjalan normal tanpa cache SW
    }

    // CDN Library â†’ Cache First (setelah pertama kali didownload, pakai cache)
    const isCDN = CDN_CACHEABLE.some((host) => url.hostname.includes(host));
    if (isCDN) {
        event.respondWith(
            caches.match(event.request).then((cached) => {
                if (cached) return cached;
                return fetch(event.request).then((response) => {
                    if (!response || response.status !== 200 || response.type === 'opaque') {
                        return response;
                    }
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                    return response;
                }).catch(() => cached); // fallback ke cache jika offline
            })
        );
        return;
    }

    // HTML dan Data -> Network First
    if (url.pathname === '/' || url.pathname.endsWith('.html') || url.pathname.endsWith('.json')) {
        event.respondWith(
            fetch(event.request).then((response) => {
                if (response && response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_STATIC).then((cache) => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => caches.match(event.request))
        );
        return;
    }

    // Aset Lokal (JS, CSS, SVG) yang memiliki hash unik -> Cache First
    if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.svg')) {
        event.respondWith(
            caches.match(event.request).then((cached) => {
                if (cached) return cached;
                return fetch(event.request).then((response) => {
                    if (response && response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_STATIC).then((cache) => cache.put(event.request, clone));
                    }
                    return response;
                });
            })
        );
        return;
    }
});

// ===== MESSAGE â€” Force update dari halaman =====
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

