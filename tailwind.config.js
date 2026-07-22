/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['Outfit', 'Roboto', 'sans-serif'] },
      colors: {
        google: {
          blue: '#ef4444', blueDark: '#b91c1c', blueLight: '#fee2e2',
          red: '#ef4444', redDark: '#b91c1c', redLight: '#fee2e2',
          yellow: '#fbbc04', yellowDark: '#b45309', yellowLight: '#fef7e0',
          green: '#22c55e', greenDark: '#15803d', greenLight: '#dcfce7',
          surface: '#f8fafc', text: '#0f172a', textVariant: '#334155',
        }
      }
    }
  },
  plugins: [],
}
