import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        orbitron: ['Orbitron', 'sans-serif'],
        rajdhani: ['Rajdhani', 'sans-serif'],
      },
      colors: {
        'bg-primary': '#0a0f1e',
        'bg-secondary': '#0f1729',
        'bg-panel': '#131d35',
        'accent-cyan': '#00f5ff',
        'accent-green': '#00ff88',
        'accent-amber': '#ffcc00',
        'accent-red': '#ff3366',
      },
    },
  },
  plugins: [],
} satisfies Config;
