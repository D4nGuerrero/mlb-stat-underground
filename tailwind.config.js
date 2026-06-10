/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  safelist: [
    {
      pattern:
        /^(text|bg|border|ring|from|to|via)-(emerald|blue)-(200|300|400|500|600)$/,
      variants: ['hover', 'focus'],
    },
    {
      pattern:
        /^(bg|border|text|ring|from)-(emerald|blue)-(200|300|400|500|600)\/(5|10|15|20|25|30|35|40|50|60|80)$/,
      variants: ['hover'],
    },
    ...['emerald', 'blue'].flatMap((c) => [
      `bg-${c}-500/[0.04]`,
      `bg-${c}-500/[0.06]`,
      `from-${c}-500/[0.10]`,
      `from-${c}-500/[0.12]`,
    ]),
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
      },
      screens: {
        xs: '400px',
      },
    },
  },
  plugins: [],
};