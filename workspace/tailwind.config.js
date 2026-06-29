/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brandTeal: { 400: '#2DD4BF', 500: '#14B8A6', 600: '#0D9488' },
      },
    },
  },
  plugins: [],
};
