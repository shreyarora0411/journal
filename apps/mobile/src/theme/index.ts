import { createTheme } from '@shopify/restyle';

const palette = {
  paper: '#FAF8F5',
  ink: '#2C2C2A',
  inkSecondary: '#5F5E5A',
  inkTertiary: '#888780',
  divider: '#E8E5DD',
  surface: '#FFFFFF',
  accent: '#A8482F',
  accentSoft: 'rgba(168, 72, 47, 0.08)',
  errorBg: 'rgba(168, 72, 47, 0.95)',
  successBg: 'rgba(60, 90, 60, 0.95)',
  white: '#FFFFFF',
  transparent: 'transparent',
} as const;

export const theme = createTheme({
  colors: {
    paper: palette.paper,
    ink: palette.ink,
    inkSecondary: palette.inkSecondary,
    inkTertiary: palette.inkTertiary,
    divider: palette.divider,
    surface: palette.surface,
    accent: palette.accent,
    accentSoft: palette.accentSoft,
    errorBg: palette.errorBg,
    successBg: palette.successBg,
    white: palette.white,
    transparent: palette.transparent,

    // semantic aliases
    background: palette.paper,
    text: palette.ink,
    textMuted: palette.inkSecondary,
    textHint: palette.inkTertiary,
    border: palette.divider,
    cardBg: palette.surface,
    primaryBg: palette.ink,
    primaryFg: palette.paper,
    accentBg: palette.accent,
    accentFg: palette.paper,
  },
  spacing: {
    none: 0,
    xs: 4,
    s: 8,
    m: 16,
    l: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadii: {
    none: 0,
    s: 4,
    m: 8,
    l: 12,
    xl: 20,
    pill: 999,
  },
  breakpoints: {
    phone: 0,
    tablet: 768,
  },
  textVariants: {
    defaults: {
      fontFamily: 'Inter_400Regular',
      fontSize: 16,
      lineHeight: 24,
      color: 'text',
    },
    title: {
      fontFamily: 'Newsreader_500Medium',
      fontSize: 24,
      lineHeight: 30,
      color: 'text',
    },
    body: {
      fontFamily: 'Inter_400Regular',
      fontSize: 16,
      lineHeight: 24,
      color: 'text',
    },
    caption: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      lineHeight: 18,
      color: 'textMuted',
    },
    quote: {
      fontFamily: 'Newsreader_400Regular_Italic',
      fontSize: 17,
      lineHeight: 26,
      color: 'text',
    },
    label: {
      fontFamily: 'Inter_500Medium',
      fontSize: 12,
      lineHeight: 16,
      color: 'textMuted',
      letterSpacing: 0.6,
    },
  },
  cardVariants: {
    defaults: {
      backgroundColor: 'cardBg',
      borderColor: 'border',
      borderWidth: 1,
      borderRadius: 'm',
      padding: 'm',
    },
  },
  buttonVariants: {
    defaults: {
      borderRadius: 'pill',
      paddingHorizontal: 'l',
      paddingVertical: 's',
    },
    primary: {
      backgroundColor: 'primaryBg',
    },
    ghost: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: 'border',
    },
    accent: {
      backgroundColor: 'accentBg',
    },
  },
  pillVariants: {
    defaults: {
      borderRadius: 'pill',
      paddingHorizontal: 'm',
      paddingVertical: 'xs',
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: 'border',
    },
    on: {
      backgroundColor: 'primaryBg',
      borderColor: 'primaryBg',
    },
    accent: {
      backgroundColor: 'accentSoft',
      borderColor: 'accent',
    },
  },
});

export type Theme = typeof theme;
