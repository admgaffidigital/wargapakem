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
          blue: '#e11d48', blueDark: '#be123c', blueLight: '#ffe4e6', // Solid Red
          red: '#e11d48', redDark: '#be123c', redLight: '#ffe4e6', // Solid Red
          yellow: '#f59e0b', yellowDark: '#d97706', yellowLight: '#fef3c7',
          green: '#e11d48', greenDark: '#be123c', greenLight: '#ffe4e6', // Jadikan hijau menjadi Solid Red juga
          surface: '#ffffff', text: '#0f172a', textVariant: '#475569',
        },
        // Custom slate shades digunakan di dark mode — tidak ada di Tailwind v3 default
        slate: {
          750: '#293548',
          850: '#172033',
          950: '#0b1120',
        },
      },

      animation: {
        'pop-in': 'toastPopIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }
    }
  },
  plugins: [],
}
