import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
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
        },
        // 暗色主题色板
        dark: {
          bg: '#0f0f10',
          surface: '#1a1a1d',
          surfaceHover: '#23232a',
          border: '#2a2a32',
          borderLight: '#3a3a44',
          text: '#e8e8ec',
          textMuted: '#a0a0a8',
          textSubtle: '#7a7a82'
        }
      }
    }
  },
  plugins: []
};

export default config;