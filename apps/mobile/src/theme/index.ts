import { createTheme } from '@shopify/restyle';

/**
 * lore design tokens — see the redesign brief.
 *
 * One accent (coral). Pink / emerald / gold are category markers only.
 * The single gradient (coral → gold) appears on the Wrapped screen.
 * Italic-serif is the human voice; never used for UI labels or buttons.
 *
 * Legacy aliases below the new palette are kept *only* so the slice-1/2/3
 * screens still compile during Phase 0; they will be removed once Batch A
 * lands and every screen consumes the new tokens directly.
 */
const palette = {
  // Core surfaces
  bg: '#FFFFFF',
  paper: '#FFFFFF',
  tint: '#FAF6F0',
  ink: '#1A1410',
  mute: '#7A716A',
  hair: '#EFEAE2',

  // The one accent
  coral: '#FF4D2E',
  coralSoft: 'rgba(255, 77, 46, 0.10)',

  // Category markers — appear next to a category pill or live-dot, never as buttons
  pink: '#FF3D87',
  pinkSoft: 'rgba(255, 61, 135, 0.10)',
  emerald: '#00A67E',
  emeraldSoft: 'rgba(0, 166, 126, 0.10)',
  gold: '#FFB300',
  goldSoft: 'rgba(255, 179, 0, 0.10)',
  // Added with the Do + Nightlife categories. Teal for active/outdoor
  // (hiking, scuba, surf, tours), plum for late-night venues.
  teal: '#2F8F8C',
  tealSoft: 'rgba(47, 143, 140, 0.10)',
  plum: '#6B2F5C',
  plumSoft: 'rgba(107, 47, 92, 0.10)',

  // Status / toast
  errorBg: 'rgba(255, 77, 46, 0.95)',
  successBg: 'rgba(0, 166, 126, 0.95)',

  // Misc
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
} as const;

export const theme = createTheme({
  colors: {
    // New tokens
    bg: palette.bg,
    paper: palette.paper,
    tint: palette.tint,
    ink: palette.ink,
    mute: palette.mute,
    hair: palette.hair,
    coral: palette.coral,
    coralSoft: palette.coralSoft,
    pink: palette.pink,
    pinkSoft: palette.pinkSoft,
    emerald: palette.emerald,
    emeraldSoft: palette.emeraldSoft,
    gold: palette.gold,
    goldSoft: palette.goldSoft,
    errorBg: palette.errorBg,
    successBg: palette.successBg,
    white: palette.white,
    black: palette.black,
    transparent: palette.transparent,

    // Semantic aliases used by primitives
    background: palette.bg,
    text: palette.ink,
    textMuted: palette.mute,
    textHint: palette.mute,
    border: palette.hair,
    borderStrong: palette.hair,
    cardBg: palette.paper,
    primaryBg: palette.ink,
    primaryFg: palette.white,
    accentBg: palette.coral,
    accentFg: palette.white,
    accentSoft: palette.coralSoft,

    // Legacy aliases — to be removed in Batch A as each screen migrates.
    // Anything reading these gets the new look automatically.
    inkSecondary: palette.mute,
    inkTertiary: palette.mute,
    divider: palette.hair,
    dividerStrong: palette.hair,
    surface: palette.paper,
    surfaceTinted: palette.tint,
    brand: palette.coral,
    brandSoft: palette.coralSoft,
    accent: palette.coral,
    amber: palette.gold,
    teal: palette.emerald,
    tealLight: palette.emerald,
    blue: palette.ink,
    gray: palette.mute,
    bubbleIn: palette.tint,
    bubbleInText: palette.ink,
    bubbleOut: palette.coralSoft,
    bubbleOutText: palette.coral,
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
    xs: 6,
    s: 8,
    m: 12,
    l: 14,
    xl: 18,
    pill: 999,
  },
  breakpoints: {
    phone: 0,
    tablet: 768,
  },
  textVariants: {
    defaults: {
      fontFamily: 'DMSans_400Regular',
      fontSize: 14,
      lineHeight: 22,
      color: 'text',
    },
    // Display — Instrument Serif italic. Editorial titles, pull quotes,
    // the wordmark. Letter-spacing tightens at larger sizes (-0.5 → -1.6).
    display: {
      fontFamily: 'PlayfairDisplay_500Medium',
      fontSize: 44,
      lineHeight: 48,
      color: 'text',
      letterSpacing: -1.2,
    },
    // Title — Instrument Serif italic, screen titles
    title: {
      fontFamily: 'PlayfairDisplay_500Medium',
      fontSize: 32,
      lineHeight: 36,
      color: 'text',
      letterSpacing: -0.8,
    },
    // Heading — for mid-size moments
    heading: {
      fontFamily: 'PlayfairDisplay_500Medium',
      fontSize: 26,
      lineHeight: 30,
      color: 'text',
      letterSpacing: -0.6,
    },
    // Headline — sans 500, section headers (rare; prefer eyebrow)
    headline: {
      fontFamily: 'DMSans_600SemiBold',
      fontSize: 15,
      lineHeight: 22,
      color: 'text',
    },
    // Body — Geist 400, the default for UI
    body: {
      fontFamily: 'DMSans_400Regular',
      fontSize: 14,
      lineHeight: 22,
      color: 'text',
    },
    bodyMute: {
      fontFamily: 'DMSans_400Regular',
      fontSize: 14,
      lineHeight: 22,
      color: 'textMuted',
    },
    // Voice quote — Instrument Serif italic, for friend-quote pull quotes
    quote: {
      fontFamily: 'PlayfairDisplay_500Medium',
      fontSize: 22,
      lineHeight: 28,
      color: 'text',
    },
    // Place name — Geist 500, where the brief shows a sans place name
    placeName: {
      fontFamily: 'DMSans_600SemiBold',
      fontSize: 15,
      lineHeight: 20,
      color: 'text',
    },
    caption: {
      fontFamily: 'DMSans_400Regular',
      fontSize: 13,
      lineHeight: 20,
      color: 'textMuted',
    },
    // Eyebrow — JetBrains Mono 9–10px, uppercase, letter-spacing 1.4,
    // always paired with a 6×6 colored dot via the Eyebrow primitive.
    eyebrow: {
      fontFamily: 'DMSans_700Bold',
      fontSize: 10,
      lineHeight: 14,
      color: 'text',
      letterSpacing: 1.4,
    },
    // Label — mono small caps for inline labels
    label: {
      fontFamily: 'DMSans_700Bold',
      fontSize: 9,
      lineHeight: 14,
      color: 'textMuted',
      letterSpacing: 1.4,
    },
    meta: {
      fontFamily: 'DMSans_400Regular',
      fontSize: 12,
      lineHeight: 18,
      color: 'textMuted',
    },
  },
  cardVariants: {
    defaults: {
      backgroundColor: 'cardBg',
      borderColor: 'hair',
      borderWidth: 1,
      borderRadius: 'l',
      padding: 'm',
    },
    tint: {
      backgroundColor: 'tint',
      borderRadius: 'l',
      padding: 'm',
    },
  },
  buttonVariants: {
    defaults: {
      borderRadius: 'pill',
      paddingHorizontal: 'l',
      paddingVertical: 'm',
    },
    primary: {
      backgroundColor: 'ink',
    },
    accent: {
      backgroundColor: 'coral',
    },
    ghost: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: 'hair',
    },
    link: {
      backgroundColor: 'transparent',
      paddingHorizontal: 'none',
      paddingVertical: 'xs',
    },
  },
  pillVariants: {
    defaults: {
      borderRadius: 'pill',
      paddingHorizontal: 'm',
      paddingVertical: 'xs',
      backgroundColor: 'paper',
      borderWidth: 1,
      borderColor: 'hair',
    },
    on: {
      backgroundColor: 'ink',
      borderColor: 'ink',
    },
    accent: {
      backgroundColor: 'coralSoft',
      borderColor: 'coral',
    },
    filled: {
      backgroundColor: 'coral',
      borderColor: 'coral',
    },
  },
});

export type Theme = typeof theme;

/**
 * Category metadata — each category has a primary color + a 10% soft tint.
 * Used by `CategoryPill` and by recommendation cards in Batch B.
 */
export const CATEGORIES = {
  stay: { label: 'Stay', color: palette.coral, soft: palette.coralSoft },
  food: { label: 'Food', color: palette.pink, soft: palette.pinkSoft },
  drinks: { label: 'Drinks', color: palette.emerald, soft: palette.emeraldSoft },
  wander: { label: 'Wander', color: palette.gold, soft: palette.goldSoft },
  buy: { label: 'Buy', color: palette.mute, soft: 'rgba(122, 113, 106, 0.10)' },
  // Do — active/outdoor experiences (hiking, scuba, surf, tours).
  // Distinct from Wander, which stays for passive sightseeing.
  do: { label: 'Do', color: palette.teal, soft: palette.tealSoft },
  // Nightlife — strip clubs, dance floors, late-night venues that aren't
  // really "the negroni is the move" drinks recommendations.
  nightlife: { label: 'Nightlife', color: palette.plum, soft: palette.plumSoft },
} as const;

export type Category = keyof typeof CATEGORIES;

/**
 * Photo palette — kept for backward compat with slice-1/2/3 screens that
 * use `photoColor()` to assign deterministic fills to image-less cards.
 * Will be removed once those screens are rebuilt in Batch B with real
 * Unsplash/Supabase photos as the brief requires.
 */
export const PHOTO_PALETTE = [
  palette.coral,
  palette.gold,
  palette.emerald,
  palette.pink,
  palette.mute,
  palette.ink,
] as const;

export const photoColor = (seed: string): string => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const idx = Math.abs(hash) % PHOTO_PALETTE.length;
  return PHOTO_PALETTE[idx] ?? palette.coral;
};
