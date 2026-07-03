/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './features/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}'
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#82d8ff',
        'primary-container': '#e5f7ff',
        'on-primary': '#0b1c30',
        secondary: '#705d00',
        'secondary-container': '#ffde5c',
        background: '#f8f9ff',
        surface: '#f8f9ff',
        'surface-container-low': '#eff4ff',
        'surface-container': '#e5eeff',
        'on-surface': '#0b1c30',
        'on-surface-variant': '#3f484d',
        outline: '#6f787e',
        'outline-variant': '#bec8ce',
        error: '#ba1a1a',
        'error-container': '#ffdad6',
      },
      fontFamily: {
        manrope: ['Manrope'],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        full: '9999px',
      },
    },
  },
  plugins: [],
}
