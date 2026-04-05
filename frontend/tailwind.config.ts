import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-dm-sans)', 'DM Sans', 'sans-serif'],
        sans: ['var(--font-dm-sans)', 'DM Sans', 'sans-serif'],
        mono: ['var(--font-ibm-plex-mono)', 'IBM Plex Mono', 'monospace'],
        body: ['var(--font-inter)', 'Inter', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#C2552D',
          light: '#D4724E',
          dark: '#A3461F',
          subtle: 'rgba(194, 85, 45, 0.08)',
          ring: 'rgba(194, 85, 45, 0.25)',
        },
        surface: {
          base: '#F5F0EB',
          card: '#FFFFFF',
          elevated: '#F9F6F2',
          hover: '#F0EAE3',
          active: '#E8E0D8',
        },
        border: {
          DEFAULT: '#D4C9BC',
          strong: '#B5A99D',
          subtle: '#E8E0D8',
        },
        text: {
          primary: '#2D2520',
          secondary: '#8A7E72',
          muted: '#B5A99D',
          inverse: '#FFFFFF',
        },
        grade: {
          excellence: '#C4962D',
          merit: '#4A7A8C',
          achieved: '#5B8A3C',
          notAchieved: '#B33A3A',
        },
        success: {
          50: '#f6faf3',
          100: '#e8f3e0',
          200: '#cde6bc',
          500: '#5B8A3C',
          600: '#4a7030',
          700: '#3d5c28',
        },
        warning: {
          50: '#fdf8ed',
          100: '#f8ecd0',
          200: '#f1d89f',
          500: '#C4962D',
          600: '#a07b24',
          700: '#7d601c',
        },
        error: {
          50: '#fdf3f3',
          100: '#fbe1e1',
          200: '#f5c0c0',
          500: '#B33A3A',
          600: '#922f2f',
          700: '#742525',
        },
      },
      borderRadius: {
        none: '0',
        DEFAULT: '0',
        sm: '0',
        md: '0',
        lg: '0',
        xl: '0',
        '2xl': '0',
        '3xl': '0',
        full: '0',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)',
        'card-active': '0 0 0 2px rgba(194, 85, 45, 0.25)',
        modal: '0 8px 30px rgba(0, 0, 0, 0.12)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeDown: {
          '0%': { opacity: '0', transform: 'translateY(-12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        widthGrow: {
          '0%': { width: '0%' },
          '100%': { width: 'var(--target-width)' },
        },
        staggerIn: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'reveal-in': 'fadeIn 500ms ease-out forwards',
        'reveal-up': 'fadeUp 600ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'fade-down': 'fadeDown 300ms ease-out forwards',
        'scale-in': 'scaleIn 250ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'slide-up': 'slideUp 500ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'width-grow': 'widthGrow 800ms ease-out forwards',
        'stagger-in': 'staggerIn 400ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
      },
    },
  },
  plugins: [],
  safelist: ['animate-reveal-in', 'animate-reveal-up', 'animate-stagger-in', 'animate-slide-up'],
} satisfies Config;