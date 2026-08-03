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
    // Pre-cache halaman utama dan aset dasar agar PWA dapat bekerja offline
    event.waitUntil(
        caches.open(CACHE_STATIC).then((cache) => {
            return cache.addAll([
                '/',
                '/index.html',
                '/manifest.json',
                '/National_emblem_of_Indonesia_Garuda_Pancasila.svg',
            ]).catch((err) => {
                console.warn('[SW] Gagal pre-cache aset dasar:', err);
            });
        }).then(() => self.skipWaiting())
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
        }).then(() => self.clients.claim())
    );
});

// ===== FETCH — Strategi per jenis request =====
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Abaikan request non-GET
    if (request.method !== 'GET') return;

    // Bypass Firebase & Google APIs — pastikan TIDAK DIINTERSEPSI oleh Service Worker
    // long-polling dan gRPC Firebase harus langsung ke jaringan agar sinkronisasi real-time tidak rusak/eror
    const isFirebaseOrGoogle = 
        url.hostname.includes('firebase') || 
        url.hostname.includes('firestore') || 
        url.hostname.includes('googleapis.com') ||
        url.hostname.includes('google-analytics.com');

    if (isFirebaseOrGoogle) return;

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
                        // Clone DULU sebelum masuk ke cache, agar body original tetap utuh untuk dikembalikan
                        const resToCache = res.clone();
                        caches.open(CACHE_STATIC).then((cache) => cache.put(request, resToCache));
                    }
                    return res; // kembalikan response original (body masih utuh)
                })
                .catch(() =>
                    // Offline fallback: gunakan cache
                    caches.match(request).then((cached) => cached || caches.match('/'))
                )
        );
        return;
    }

    // === Aset JS/CSS dengan hash (Vite output) → Cache First ===
    // Semua file di /assets/ sudah dipastikan memiliki hash unik dari bundler Vite
    const isHashedAsset = url.pathname.startsWith('/assets/');
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
