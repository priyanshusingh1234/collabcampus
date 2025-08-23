import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'], // Ensures dark mode works via 'dark' class
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  './src/content/**/*.mdx', // 👈 Add your blog MDX path here if it's under /content
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      fontFamily: {
        body: ['Inter', 'sans-serif'],
        headline: ['Space Grotesk', 'sans-serif'],
  article: ['Georgia', 'Cambria', 'Times New Roman', 'Times', 'serif'],
        code: ['monospace'],
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
  typography: (theme: any) => ({
        DEFAULT: {
          css: {
            color: theme('colors.foreground'),
            a: { color: theme('colors.primary.DEFAULT'), textDecoration: 'underline' },
            h1: {
              fontFamily: theme('fontFamily.headline').join(', '),
              letterSpacing: '-0.02em',
            },
            h2: {
              fontFamily: theme('fontFamily.headline').join(', '),
              letterSpacing: '-0.02em',
            },
            h3: {
              fontFamily: theme('fontFamily.headline').join(', '),
              letterSpacing: '-0.01em',
            },
            p: {
              fontFamily: theme('fontFamily.article').join(', '),
              lineHeight: '1.9',
              fontSize: '1.125rem',
            },
            li: {
              fontFamily: theme('fontFamily.article').join(', '),
              lineHeight: '1.9',
              fontSize: '1.125rem',
            },
            code: { backgroundColor: theme('colors.muted.DEFAULT'), padding: '0.2em', borderRadius: '0.25rem' },
            blockquote: {
              borderLeftColor: theme('colors.primary.DEFAULT'),
              color: theme('colors.muted.foreground'),
              fontStyle: 'italic',
              backgroundColor: 'transparent',
              paddingLeft: '1rem',
            },
            'blockquote p:first-of-type::before': { content: 'none' },
            'blockquote p:last-of-type::after': { content: 'none' },
            hr: { marginTop: '3rem', marginBottom: '3rem' },
            img: { borderRadius: '0.75rem' },
            figcaption: { textAlign: 'center', color: theme('colors.muted.foreground') },
          },
        },
        dark: {
          css: {
            color: theme('colors.foreground'),
            a: { color: theme('colors.primary.foreground') },
            blockquote: { color: theme('colors.muted.foreground') },
          },
        },
      }),
    },
  },
  plugins: [require('tailwindcss-animate'), require('@tailwindcss/typography')],
} satisfies Config;
