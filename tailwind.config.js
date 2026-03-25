/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Map CSS variables to Tailwind colors
        background: 'var(--bg)',
        surface: 'var(--surface)',
        muted: 'var(--muted)',
        text: 'var(--text)',
        accent: 'var(--accent)',
        danger: 'var(--danger)',
        'guardian-red': 'var(--guardian-red)',
        'guardian-orange': 'var(--guardian-orange)',
        'guardian-red-bg': 'var(--guardian-red-bg)',
        'guardian-orange-bg': 'var(--guardian-orange-bg)',
      },
      spacing: {
        // Map CSS spacing variables
        '1': 'var(--space-1)',
        '2': 'var(--space-2)',
        '3': 'var(--space-3)',
        '4': 'var(--space-4)',
        '5': 'var(--space-5)',
        '6': 'var(--space-6)',
        '8': 'var(--space-8)',
        '10': 'var(--space-10)',
        '12': 'var(--space-12)',
      },
      fontSize: {
        // Map CSS typography variables
        'xs': 'var(--scale-0)',
        'sm': 'var(--scale-1)',
        'base': 'var(--scale-2)',
        'lg': 'var(--scale-3)',
        'xl': 'var(--scale-4)',
        '2xl': 'var(--scale-5)',
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
      },
      boxShadow: {
        DEFAULT: 'var(--shadow-1)',
        'lg': 'var(--shadow-2)',
      },
      transitionDuration: {
        DEFAULT: 'var(--transition-base)',
        'fast': 'var(--transition-fast)',
        'slow': 'var(--transition-slow)',
      },
      fontFamily: {
        sans: 'var(--font-sans)',
      },
      maxWidth: {
        container: 'var(--container-max)',
      },
      keyframes: {
        spotlight: {
          "0%": { opacity: "0", transform: "translate(-72%, -62%) scale(0.5)" },
          "100%": { opacity: "1", transform: "translate(-50%, -40%) scale(1)" },
        },
      },
      animation: {
        spotlight: "spotlight 2s ease .75s 1 forwards",
      },
    },
  },
  plugins: [],
}
