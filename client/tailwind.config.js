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
        // Bright brand green (original palette).
        primary: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
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
