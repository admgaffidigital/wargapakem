import React from 'react';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Render React app, lalu sembunyikan loading screen bawaan HTML
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Sembunyikan loading screen setelah React selesai mount
// Menggunakan requestAnimationFrame untuk memastikan paint sudah selesai
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    if (typeof window.__hideLs === 'function') {
      window.__hideLs();
    }
  });
});
