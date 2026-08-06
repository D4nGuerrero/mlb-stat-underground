/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  safelist: [
    // Runtime accent utilities (Settings → accent color)
    {
      pattern:
        /^(text|bg|border|ring|from|to|via|shadow|decoration)-accent-(200|300|400|500|600|950)$/,
      variants: ['hover', 'focus', 'group-hover'],
    },
    {
      pattern:
        /^(bg|border|text|ring|from|shadow|decoration)-accent-(200|300|400|500|600|950)\/(5|10|15|20|25|30|35|40|50|60|80)$/,
      variants: ['hover', 'group-hover'],
    },
    'bg-accent-500/[0.04]',
    'bg-accent-500/[0.06]',
    'from-accent-500/[0.10]',
    'from-accent-500/[0.12]',
    // Settings swatches + misc palette classes
    {
      pattern:
        /^(text|bg|border|ring|from|to|via)-(emerald|blue|sky|violet|rose|amber|cyan)-(200|300|400|500|600)$/,
      variants: ['hover', 'focus'],
    },
    {
      pattern:
        /^(bg|border|text|ring|from)-(emerald|blue|sky|violet|rose|amber|cyan)-(200|300|400|500|600)\/(5|10|15|20|25|30|35|40|50|60|80)$/,
      variants: ['hover'],
    },
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
      },
      screens: {
        xs: '400px',
      },
      colors: {
        // Channel RGB vars set by applyAccentToDocument() / index.css
        accent: {
          200: 'rgb(var(--accent-200) / <alpha-value>)',
          300: 'rgb(var(--accent-300) / <alpha-value>)',
          400: 'rgb(var(--accent-400) / <alpha-value>)',
          500: 'rgb(var(--accent-500) / <alpha-value>)',
          600: 'rgb(var(--accent-600) / <alpha-value>)',
          950: 'rgb(var(--accent-950) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
};
