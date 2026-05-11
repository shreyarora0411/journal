import { createTheme } from '@shopify/restyle';

// Postmark brand — see CLAUDE.md §5 (Design system).
// Cream paper base, terracotta brand, 7-stop photo palette.
const palette = {
  paper: '#FAF8F3',
  ink: '#1A1A1A',
  inkSecondary: '#5A5A5A',
  inkTertiary: '#9A9A9A',
  divider: 'rgba(0,0,0,0.08)',
  dividerStrong: 'rgba(0,0,0,0.15)',
  surface: '#FFFFFF',
  surfaceTinted: '#F3F3F0',
  // Brand
  brand: '#993C1D',
  brandSoft: '#FAECE7',
  // 7-stop photo palette (used as colored fills when real photos absent)
  coral: '#D85A30',
  amber: '#854F0B',
  teal: '#0F6E56',
  tealLight: '#1D9E75',
  pink: '#D4537E',
  blue: '#185FA5',
  gray: '#5F5E5A',
  // Bubble palette (onboarding chat illustration)
  bubbleIn: '#F5C4B3',
  bubbleInText: '#712B13',
  bubbleOut: '#B5D4F4',
  bubbleOutText: '#0C447C',
  // Misc
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
    dividerStrong: palette.dividerStrong,
    surface: palette.surface,
    surfaceTinted: palette.surfaceTinted,
    brand: palette.brand,
    brandSoft: palette.brandSoft,
    // Back-compat alias used by older components.
    accent: palette.brand,
    coral: palette.coral,
    amber: palette.amber,
    teal: palette.teal,
    tealLight: palette.tealLight,
    pink: palette.pink,
    blue: palette.blue,
    gray: palette.gray,
    bubbleIn: palette.bubbleIn,
    bubbleInText: palette.bubbleInText,
    bubbleOut: palette.bubbleOut,
    bubbleOutText: palette.bubbleOutText,
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
    borderStrong: palette.dividerStrong,
    cardBg: palette.surface,
    primaryBg: palette.ink,
    primaryFg: palette.paper,
    accentBg: palette.brand,
    accentFg: palette.white,
    accentSoft: palette.brandSoft,
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
      fontSize: 14,
      lineHeight: 22,
      color: 'text',
    },
    // Display — Fraunces 500, big editorial moments (cover, year-in-travel)
    display: {
      fontFamily: 'Fraunces_500',
      fontSize: 44,
      lineHeight: 48,
      color: 'text',
      letterSpacing: -0.8,
    },
    // Title — Fraunces 500, screen titles + trip titles
    title: {
      fontFamily: 'Fraunces_500',
      fontSize: 24,
      lineHeight: 30,
      color: 'text',
      letterSpacing: -0.4,
    },
    // Headline — Inter 500, section headers
    headline: {
      fontFamily: 'Inter_500Medium',
      fontSize: 18,
      lineHeight: 24,
      color: 'text',
    },
    // Body — Inter 400
    body: {
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      lineHeight: 22,
      color: 'text',
    },
    // Place name in flow — Fraunces 400, smaller
    placeName: {
      fontFamily: 'Fraunces_400',
      fontSize: 14,
      lineHeight: 20,
      color: 'text',
    },
    // Voice quote — Fraunces italic
    quote: {
      fontFamily: 'Fraunces_400Italic',
      fontSize: 13,
      lineHeight: 20,
      color: 'text',
    },
    caption: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      lineHeight: 18,
      color: 'textMuted',
    },
    label: {
      fontFamily: 'Inter_500Medium',
      fontSize: 11,
      lineHeight: 16,
      color: 'textHint',
      letterSpacing: 0.5,
    },
    meta: {
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      lineHeight: 16,
      color: 'textHint',
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
      borderRadius: 'm',
      paddingHorizontal: 'l',
      paddingVertical: 's',
    },
    primary: {
      backgroundColor: 'primaryBg',
    },
    ghost: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: 'borderStrong',
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
      backgroundColor: 'surface',
      borderWidth: 1,
      borderColor: 'border',
    },
    on: {
      backgroundColor: 'primaryBg',
      borderColor: 'primaryBg',
    },
    accent: {
      backgroundColor: 'accentSoft',
      borderColor: 'accentBg',
    },
  },
});

export type Theme = typeof theme;

/** Photo accent palette — used as colored fills when no real photo exists. */
export const PHOTO_PALETTE = [
  palette.coral,
  palette.amber,
  palette.teal,
  palette.tealLight,
  palette.pink,
  palette.blue,
  palette.gray,
  palette.brand,
] as const;

/** Deterministic pick from PHOTO_PALETTE for a given seed string. */
export const photoColor = (seed: string): string => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const idx = Math.abs(hash) % PHOTO_PALETTE.length;
  return PHOTO_PALETTE[idx] ?? palette.coral;
};
