import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: '#08090d',
        panel: '#12141b',
        muted: '#9294a1',
        accent: '#fa4b78',
      },
      fontFamily: { sans: ['Arial', 'Helvetica Neue', 'sans-serif'] },
    },
  },
  plugins: [],
};

export default config;
