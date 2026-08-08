import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import viteCompression from 'vite-plugin-compression'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteCompression({ algorithm: 'gzip', ext: '.gz' }),
    viteCompression({ algorithm: 'brotliCompress', ext: '.br' })
  ],

  esbuild: {
    // Target modern browsers — output lebih ringkas
    target: 'es2020',
    // Drop semua console dan debugger di production
    drop: ['console', 'debugger'],
    // Hilangkan legal comments untuk bundle lebih kecil
    legalComments: 'none',
  },

  build: {
    outDir: 'dist',
    // Target modern browsers untuk output lebih optimal
    target: 'es2020',
    // Aktifkan CSS code splitting — hanya load CSS yang dibutuhkan
    cssCodeSplit: true,
    // Minify CSS lebih agresif
    cssMinify: true,
    // Aktifkan source map hanya saat development
    sourcemap: false,
    // Batas warning chunk
    chunkSizeWarningLimit: 800,
    // Kompresi assets — hapus data tidak perlu
    assetsInlineLimit: 4096,

    rollupOptions: {
      output: {
        // Format chunk file dengan hash pendek untuk caching optimal
        chunkFileNames: 'assets/[name]-[hash:8].js',
        entryFileNames: 'assets/[name]-[hash:8].js',
        assetFileNames: 'assets/[name]-[hash:8][extname]',

        manualChunks: (id) => {
          // React core — selalu dimuat
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor';
          }
          // Firebase — dimuat setelah auth check
          if (id.includes('node_modules/firebase')) {
            return 'firebase-vendor';
          }
          // Chart.js — hanya untuk halaman kas/statistik
          if (id.includes('node_modules/chart.js')) {
            return 'chart-vendor';
          }
          // QR & Barcode — hanya untuk fitur scan
          if (id.includes('node_modules/jsbarcode') || id.includes('node_modules/html5-qrcode')) {
            return 'qr-vendor';
          }
          // Leaflet map — hanya untuk fitur peta
          if (id.includes('node_modules/leaflet')) {
            return 'map-vendor';
          }
        }
      },
      // Tree-shaking: tetap gunakan default Rollup (aman untuk React ecosystem)
      treeshake: true,
    },
  },

  // Pre-bundle dependensi untuk dev server lebih cepat
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'firebase/app',
      'firebase/firestore',
      'firebase/auth',
    ],
    // Exclude library besar yang dimuat conditional
    exclude: ['chart.js', 'leaflet', 'jsbarcode', 'html5-qrcode']
  }
})
