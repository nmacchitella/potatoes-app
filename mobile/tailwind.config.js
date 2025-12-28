/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Garnish-inspired palette (matching web app)
        'cream': '#F5F1E8',
        'cream-light': '#FAF8F3',
        'cream-dark': '#EBE6DB',
        'charcoal': '#1A1A1A',
        'charcoal-light': '#2D2D2D',
        'gold': '#C6A664',
        'gold-dark': '#B8954D',
        'gold-light': '#D4BA82',
        'warm-gray': '#6B6560',
        'warm-gray-light': '#9A948D',
        // Semantic aliases
        'primary': '#C6A664',
        'primary-hover': '#B8954D',
        'background': '#F5F1E8',
        'surface': '#FFFFFF',
        'text-primary': '#1A1A1A',
        'text-secondary': '#6B6560',
        'border': '#E5E0D5',
      },
    },
  },
  plugins: [],
};
