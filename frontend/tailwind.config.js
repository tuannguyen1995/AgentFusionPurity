/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        fusion: {
          bg: '#04030A',
          card: '#0D081B',
          cardHover: '#130C28',
          border: '#2A1B4E',
          borderLight: '#3D2870',
          cyan: '#06B6D4',
          magenta: '#D946EF',
          violet: '#8B5CF6',
          emerald: '#10B981',
          amber: '#F59E0B',
          red: '#EF4444',
        },
      },
      fontFamily: {
        space: ['"Space Grotesk"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        sans: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'glow-cyan': '0 0 20px -3px rgba(6, 182, 212, 0.45)',
        'glow-magenta': '0 0 20px -3px rgba(217, 70, 239, 0.45)',
        'glow-violet': '0 0 25px -4px rgba(139, 92, 246, 0.5)',
        'glow-emerald': '0 0 20px -3px rgba(16, 185, 129, 0.45)',
      },
      keyframes: {
        pulsePlasma: {
          '0%, 100%': { opacity: '0.85', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.03)' },
        },
        rotateToroid: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'plasma-pulse': 'pulsePlasma 3s ease-in-out infinite',
        'toroid-spin': 'rotateToroid 24s linear infinite',
      },
    },
  },
  plugins: [],
};
