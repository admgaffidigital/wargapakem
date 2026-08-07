/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['Outfit', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'] },
      colors: {
        google: {
          blue: '#2563eb', blueDark: '#1d4ed8', blueLight: '#dbeafe',
          red: '#e11d48', redDark: '#be123c', redLight: '#ffe4e6',
          yellow: '#f59e0b', yellowDark: '#d97706', yellowLight: '#fef3c7',
          green: '#10b981', greenDark: '#047857', greenLight: '#d1fae5',
          surface: '#ffffff', text: '#0f172a', textVariant: '#475569',
        }
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
        'glass-hover': '0 12px 40px 0 rgba(31, 38, 135, 0.12)',
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
      },
      animation: {
        'pop-in': 'toastPopIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }
    }
  },
  plugins: [],
}
