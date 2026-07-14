import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    // Chunk lebih besar diizinkan karena app ini memang besar
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        // Pisahkan vendor libraries ke chunk terpisah untuk caching lebih baik
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'firebase-vendor': ['firebase/app', 'firebase/firestore', 'firebase/auth'],
          'chart-vendor': ['chart.js'],
          'map-vendor': ['leaflet'],
          'qr-vendor': ['jsbarcode', 'html5-qrcode'],
        }
      }
    }
  },
  // Optimasi dependency pre-bundling
  optimizeDeps: {
    include: ['react', 'react-dom', 'firebase/app', 'firebase/firestore', 'firebase/auth', 'chart.js', 'leaflet', 'jsbarcode']
  }
})
