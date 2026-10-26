import colors from 'tailwindcss/colors';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        // Neutral (zinc) grays instead of the default bluish gray.
        gray: colors.zinc,
        // Emerald-based brand green. 600 is dark enough for white text (AA contrast).
        primary: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#059669',
          600: '#047857',
          700: '#065f46',
          800: '#064e3b',
          900: '#022c22',
        },
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgb(24 24 27 / 0.04), 0 1px 3px 0 rgb(24 24 27 / 0.04)',
        DEFAULT: '0 1px 3px 0 rgb(24 24 27 / 0.06), 0 1px 2px -1px rgb(24 24 27 / 0.06)',
        md: '0 4px 12px -2px rgb(24 24 27 / 0.08), 0 2px 4px -2px rgb(24 24 27 / 0.04)',
        lg: '0 12px 28px -6px rgb(24 24 27 / 0.12), 0 4px 8px -4px rgb(24 24 27 / 0.05)',
        xl: '0 20px 40px -10px rgb(24 24 27 / 0.15), 0 8px 16px -8px rgb(24 24 27 / 0.06)',
        '2xl': '0 28px 60px -12px rgb(24 24 27 / 0.22)',
      },
      keyframes: {
        'modal-in': {
          '0%': { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'modal-in': 'modal-in 0.18s ease-out',
        'fade-in': 'fade-in 0.15s ease-out',
      },
    },
  },
  plugins: [],
}
