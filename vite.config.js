import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  esbuild: {
    // Drop console.log in production build for lighter JS weight and faster speed
    pure: ['console.log']
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
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
  optimizeDeps: {
    include: ['react', 'react-dom', 'firebase/app', 'firebase/firestore', 'firebase/auth', 'chart.js', 'leaflet', 'jsbarcode']
  }
})
