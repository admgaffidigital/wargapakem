// ============================================================
// SERVICE WORKER — Portal Warga RT PAKEM
// Strategi:
//   - index.html      → Network First (selalu coba jaringan, fallback cache)
//   - Aset JS/CSS     → Cache First (sudah ada hash di nama file dari Vite)
//   - CDN fonts/icons → Cache First (jarang berubah)
//   - Firebase/API    → Bypass (tidak di-cache)
//
// Auto-update: SW baru langsung aktif (skipWaiting) → client reload otomatis
// ============================================================

// Bump ini otomatis saat deploy melalui script inject-cache-version
// atau biarkan apa adanya — logika di bawah sudah handle via timestamp hash
const CACHE_VERSION = '__CACHE_VERSION__'; // diganti saat build (atau fallback ke 'v1')
const CACHE_PREFIX = 'warga-pakem-';
const CACHE_STATIC = CACHE_PREFIX + (CACHE_VERSION.startsWith('__') ? 'v1' : CACHE_VERSION);
const CACHE_CDN    = CACHE_PREFIX + 'cdn-v1';

// CDN yang di-cache secara permanen
const CDN_HOSTS = [
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'cdn.jsdelivr.net',
    'unpkg.com',
];

// Host Firebase — jangan pernah di-cache oleh SW
const FIREBASE_HOSTS = [
    'firebasedatabase.app',
    'firebaseapp.com',
    'firestore.googleapis.com',
    'identitytoolkit.googleapis.com',
    'securetoken.googleapis.com',
];

// ===== INSTALL — Ambil alih langsung (skipWaiting) =====
self.addEventListener('install', (event) => {
    // Pre-cache halaman utama saja; aset JS/CSS sudah punya hash → tidak perlu di-list manual
    event.waitUntil(
        caches.open(CACHE_STATIC).then((cache) => {
            return cache.addAll([
                '/manifest.json',
                '/National_emblem_of_Indonesia_Garuda_Pancasila.svg',
            ]).catch(() => {/* silent fail jika offline saat install */});
        }).then(() => self.skipWaiting()) // <-- langsung aktif, tidak tunggu tab lama ditutup
    );
});

// ===== ACTIVATE — Bersihkan SEMUA cache versi lama =====
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys
                    .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_STATIC && key !== CACHE_CDN)
                    .map((key) => {
                        console.log('[SW] Menghapus cache lama:', key);
                        return caches.delete(key);
                    })
            );
        }).then(() => self.clients.claim()) // <-- ambil alih semua tab yang terbuka sekarang
    );
});

// ===== FETCH — Strategi per jenis request =====
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Abaikan request non-GET
    if (request.method !== 'GET') return;

    // Bypass Firebase & googleapis — biarkan berjalan langsung ke jaringan
    const isFirebase = FIREBASE_HOSTS.some((h) => url.hostname.includes(h));
    if (isFirebase) return;

    // CDN (fonts, icons) → Cache First, fallback jaringan
    const isCDN = CDN_HOSTS.some((h) => url.hostname.includes(h));
    if (isCDN) {
        event.respondWith(
            caches.open(CACHE_CDN).then((cache) =>
                cache.match(request).then((cached) => {
                    if (cached) return cached;
                    return fetch(request).then((res) => {
                        if (res && res.status === 200) cache.put(request, res.clone());
                        return res;
                    }).catch(() => cached);
                })
            )
        );
        return;
    }

    // === index.html → Network First (SELALU coba jaringan) ===
    // Ini yang memastikan warga selalu dapat versi terbaru!
    const isHTML = url.pathname === '/' ||
                   url.pathname.endsWith('.html') ||
                   url.pathname === '/index.html';
    if (isHTML) {
        event.respondWith(
            fetch(request, { cache: 'no-store' }) // paksa ambil dari server
                .then((res) => {
                    if (res && res.status === 200) {
                        // Update cache dengan versi terbaru
                        caches.open(CACHE_STATIC).then((cache) => cache.put(request, res.clone()));
                    }
                    return res;
                })
                .catch(() =>
                    // Offline fallback: gunakan cache
                    caches.match(request).then((cached) => cached || caches.match('/'))
                )
        );
        return;
    }

    // === Aset JS/CSS dengan hash (Vite output) → Cache First ===
    // File sudah punya hash di nama (misal: index-D14wl2mW.js) → aman di-cache selamanya
    const isHashedAsset = url.pathname.startsWith('/assets/') &&
        (url.pathname.includes('-') || url.pathname.match(/\.[a-f0-9]{8}\./));
    if (isHashedAsset) {
        event.respondWith(
            caches.open(CACHE_STATIC).then((cache) =>
                cache.match(request).then((cached) => {
                    if (cached) return cached;
                    return fetch(request).then((res) => {
                        if (res && res.status === 200) cache.put(request, res.clone());
                        return res;
                    });
                })
            )
        );
        return;
    }

    // === Aset lain (SVG, manifest, dll) → Stale-While-Revalidate ===
    event.respondWith(
        caches.open(CACHE_STATIC).then((cache) =>
            cache.match(request).then((cached) => {
                const networkFetch = fetch(request).then((res) => {
                    if (res && res.status === 200) cache.put(request, res.clone());
                    return res;
                }).catch(() => cached);
                return cached || networkFetch;
            })
        )
    );
});

// ===== MESSAGE — Terima pesan dari halaman =====
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
