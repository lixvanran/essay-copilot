import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"PingFang SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
        serif: ['"Source Han Serif SC"', '"Songti SC"', 'serif']
      },
      colors: {
        ink: {
          50: '#f7f7f5',
          100: '#ebebe7',
          200: '#d6d6ce',
          300: '#a9a99e',
          400: '#7a7a6e',
          500: '#4d4d44',
          600: '#36362f',
          700: '#25251f',
          800: '#171712',
          900: '#0a0a07'
        }
      }
    }
  },
  plugins: []
};

export default config;
