
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-geist-sans)'],
        mono: ['var(--font-geist-mono)'],
      },
      colors: {
        // Semantic Tokens linked to CSS Variables
        background: 'var(--background)',
        foreground: 'var(--foreground)',

        'background-weak': 'var(--background-weak)',
        'background-weaker': 'var(--background-weaker)',

        'text-strong': 'var(--text-strong)',
        'text-main': 'var(--text-main)',
        'text-weak': 'var(--text-weak)',
        'text-inverted': 'var(--text-inverted)',

        border: 'var(--border-main)',
        'border-weak': 'var(--border-weak)',

        accent: 'var(--accent)',

        // Raw Neutral Tokens
        neutral: {
          light: {
            1: 'var(--neutral-light-1)',
            2: 'var(--neutral-light-2)',
            3: 'var(--neutral-light-3)',
            4: 'var(--neutral-light-4)',
            5: 'var(--neutral-light-5)',
            6: 'var(--neutral-light-6)',
            7: 'var(--neutral-light-7)',
            8: 'var(--neutral-light-8)',
            9: 'var(--neutral-light-9)',
            10: 'var(--neutral-light-10)',
            11: 'var(--neutral-light-11)',
            12: 'var(--neutral-light-12)',
          },
          dark: {
            1: 'var(--neutral-dark-1)',
            2: 'var(--neutral-dark-2)',
            3: 'var(--neutral-dark-3)',
            4: 'var(--neutral-dark-4)',
            5: 'var(--neutral-dark-5)',
            6: 'var(--neutral-dark-6)',
            7: 'var(--neutral-dark-7)',
            8: 'var(--neutral-dark-8)',
            9: 'var(--neutral-dark-9)',
            10: 'var(--neutral-dark-10)',
            11: 'var(--neutral-dark-11)',
            12: 'var(--neutral-dark-12)',
          }
        }
      },
    },
  },
  plugins: [],
}
