import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Garnish-inspired palette
        'cream': '#F5F1E8',
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
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'serif'],
        body: ['Lora', 'Georgia', 'serif'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      fontSize: {
        'display': ['4rem', { lineHeight: '1.1', fontWeight: '400' }],
        'display-sm': ['2.5rem', { lineHeight: '1.2', fontWeight: '400' }],
      },
    },
  },
  plugins: [],
}
export default config
