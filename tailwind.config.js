/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          gold: '#A37A3F',
        },
        secondary: {
          gray: '#B8B5B0',
        },
        dark: {
          charcoal: '#3A3A3A',
        },
        light: {
          background: '#F6F5F3',
        },
        accent: {
          sand: '#D8C39B',
        },
        alert: {
          red: '#C85C5C',
        },
        success: {
          green: '#7BA882',
        },
        border: {
          DEFAULT: '#B8B5B0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        arabic: ['Cairo', 'Tajawal', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
