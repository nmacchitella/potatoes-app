import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'primary': '#F59E0B',        // Amber/golden - main accent
        'primary-hover': '#D97706',
        'dark': 'hsl(30, 10%, 12%)',
        'dark-lighter': 'hsl(30, 10%, 16%)',
        'dark-hover': 'hsl(30, 10%, 20%)',
        'accent': '#F59E0B',
        'text-primary': '#faf9f5',
        'dark-bg': 'hsl(30, 10%, 12%)',
        'dark-card': 'hsl(30, 10%, 16%)',
        'dark-text': '#faf9f5',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
