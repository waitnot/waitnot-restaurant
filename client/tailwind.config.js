/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#FF6266',
        'primary-dark': '#E0484C',
        'primary-light': '#FFF0F0',
        secondary: '#4ECDC4',
        accent: '#FFE66D',
        surface: '#FFFFFF',
        canvas: '#F7F8FA',
        border: '#E5E7EB',
        'text-primary': '#1F2937',
        'text-secondary': '#6B7280',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)',
        'card-md': '0 4px 6px -1px rgba(0,0,0,0.06), 0 2px 4px -2px rgba(0,0,0,0.04)',
        'drawer': '4px 0 24px rgba(0,0,0,0.10)',
      },
      borderRadius: {
        'btn': '10px',
        'card': '14px',
        'input': '10px',
        'nav': '10px',
      },
    },
  },
  plugins: [],
}
