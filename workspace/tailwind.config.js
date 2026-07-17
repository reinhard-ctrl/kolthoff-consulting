/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brandNavy: {
          955: '#02050e',
          950: '#020613',
          900: '#09111F',
          800: '#0F1A2C',
          700: '#1B2C46',
        },
        brandTeal: {
          400: '#2DD4BF',
          500: '#14B8A6',
          600: '#0D9488',
        },
      },
      fontFamily: {
        sans: ['Montserrat', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
