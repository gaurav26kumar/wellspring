/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Fraunces', 'serif'],
        label: ['Manrope', 'sans-serif'],
        ui: ['Manrope', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
