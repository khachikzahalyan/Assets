import type { Config } from 'tailwindcss'
import { fontFamily } from 'tailwindcss/defaultTheme'

const config: Config = {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Colors use rgb(var(--rgb-*) / <alpha-value>) so Tailwind opacity
        // modifiers (border-border/60, ring-accent/15, …) resolve to a translucent
        // TOKEN colour. A bare `var(--color-*)` hex cannot carry an alpha channel in
        // Tailwind v3 → the utility becomes invalid CSS and the browser falls back to
        // the default blue ring / gray-200 border. The hex --color-* vars remain for
        // direct use inside index.css.
        // ── Surfaces ──
        bg: 'rgb(var(--rgb-bg) / <alpha-value>)',
        surface: 'rgb(var(--rgb-surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--rgb-surface-2) / <alpha-value>)',
        'surface-raised': 'rgb(var(--rgb-surface-raised) / <alpha-value>)',
        'surface-sunken': 'rgb(var(--rgb-surface-sunken) / <alpha-value>)',
        // ── Borders ──
        border: 'rgb(var(--rgb-border) / <alpha-value>)',
        'border-strong': 'rgb(var(--rgb-border-strong) / <alpha-value>)',
        // ── Text ──
        text: 'rgb(var(--rgb-text) / <alpha-value>)',
        'text-primary': 'rgb(var(--rgb-text-primary) / <alpha-value>)',
        'text-secondary': 'rgb(var(--rgb-text-secondary) / <alpha-value>)',
        'text-tertiary': 'rgb(var(--rgb-text-tertiary) / <alpha-value>)',
        'text-muted': 'rgb(var(--rgb-text-muted) / <alpha-value>)',
        'text-subtle': 'rgb(var(--rgb-text-subtle) / <alpha-value>)',
        'text-mono': 'rgb(var(--rgb-text-mono) / <alpha-value>)',
        // ── Accent (orange) ──
        accent: 'rgb(var(--rgb-accent) / <alpha-value>)',
        'accent-hover': 'rgb(var(--rgb-accent-hover) / <alpha-value>)',
        'accent-light': 'rgb(var(--rgb-accent-light) / <alpha-value>)',
        'accent-dark': 'rgb(var(--rgb-accent-dark) / <alpha-value>)',
        'accent-soft': 'var(--color-accent-soft)',
        // ── Status ──
        success: 'rgb(var(--rgb-success) / <alpha-value>)',
        warning: 'rgb(var(--rgb-warning) / <alpha-value>)',
        error: 'rgb(var(--rgb-error) / <alpha-value>)',
        info: 'rgb(var(--rgb-info) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', ...fontFamily.sans],
        mono: ['JetBrains Mono', ...fontFamily.mono],
      },
      borderRadius: {
        card: 'var(--radius-card)',
        btn: 'var(--radius-btn)',
        input: 'var(--radius-input)',
        chip: 'var(--radius-chip)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        elevated: 'var(--shadow-elevated)',
        popover: 'var(--shadow-popover)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        '2xl': 'var(--shadow-2xl)',
      },
      keyframes: {
        fadeSlideIn: {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        popIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        modalPop: {
          from: { opacity: '0', transform: 'scale(0.96) translateY(4px)' },
          to: { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        backdropFade: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        drawerSlideIn: {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
        dropdownIn: {
          from: { opacity: '0', transform: 'translateY(-6px) scale(0.97)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        skeletonShimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
        contentEnter: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-slide-in': 'fadeSlideIn 220ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'pop-in': 'popIn 180ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'modal-pop': 'modalPop 180ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'backdrop-fade': 'backdropFade 140ms ease-out both',
        'drawer-slide': 'drawerSlideIn 220ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'dropdown-in': 'dropdownIn 160ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'skeleton-shimmer': 'skeletonShimmer 1.4s ease-in-out infinite',
        'content-enter': 'contentEnter 240ms cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
}

export default config
