/**
 * Design tokens for features/taste — screens/ and components/ only.
 *
 * Every screen and component in this feature used to re-declare its own
 * copies of these color and font-family constants at the top of the file.
 * This consolidates them to one place. Values are unchanged — this is a
 * value-preserving refactor, not a redesign.
 *
 * Deliberately scoped to features/taste. features/onboarding and the shared
 * components/theme/ system (PlacePicker, Eyebrow, Nav, FloatingTabBar,
 * CityHero, EntityCard) use a different, older type system (Playfair
 * Display + DM Sans, not Fraunces + HankenGrotesk). Folding them onto these
 * tokens would silently change that surface's design — a separate call, not
 * this one.
 */

export const INK = '#1B1714';
export const MUTE = '#7A716A';
export const HAIR = '#E7E1D7';
export const CORAL = '#FF4D2E';
export const CARD = '#FFFFFF';
export const TINT = '#FAF6F0';

/**
 * Second accent, deliberately distinct from CORAL (match/action): reserved
 * for "this moment is about YOUR identity" — the taste-readout eyebrow
 * only. Used in you-screen.tsx and your-map-screen.tsx; keep in sync.
 */
export const GOLD = '#C8A24A';

export const SERIF = 'Fraunces_500';
export const SERIF_IT = 'Fraunces_400Italic';
export const SANS = 'HankenGrotesk_400Regular';
export const SANS_SEMI = 'HankenGrotesk_600SemiBold';
export const SANS_BOLD = 'HankenGrotesk_700Bold';

/**
 * Type scale — audited from every fontSize in features/taste/{screens,components}
 * (excluding *.test.tsx). Raw values found, with occurrence counts:
 *
 *   9.5×1  10×4  10.5×6  11×4  11.5×2  12×5  12.5×10  13×39  13.5×6  14×20
 *   14.5×2  15×9  16×1  17×1  18×5  20×2  21×1  22×6  26×2  28×3  30×2  32×1
 *
 * The steps below are the values that recur ≥3× with a consistent role
 * across screens (strong evidence of a shared intent, not per-spot tuning).
 * Only exact matches to these were mechanically swapped to the scale.
 *
 * Deliberately NOT on the scale, left as inline numbers:
 *  - The half-point values (9.5, 10.5, 11.5, 12.5, 13.5, 14.5) — these sit
 *    right next to a step but recur too often on their own to be rounding
 *    artifacts; they read as intentional micro-tuning of specific rows/chips.
 *  - The single- or double-use larger sizes (16, 17, 20, 21, 26, 30, 32) —
 *    each is a serif headline/name tuned for one specific screen's hero
 *    copy. They cluster near `headline`/`headlineLg`/`display` but forcing
 *    them onto those steps risks a visible size change with no upside.
 * A future pass could fold these in deliberately, screen by screen.
 */
export const TASTE_TYPE_SCALE = {
  /** Smallest uppercase eyebrow/badge labels. */
  micro: 10,
  /** Small counters, chip glyphs, loved-tag labels. */
  caption: 11,
  /** Compact meta/action/hint labels. */
  label: 12,
  /** Default paragraph and row body copy — the most common size by far. */
  body: 13,
  /** Emphasis copy, section prompts. */
  subhead: 14,
  /** Row names, primary CTA button labels. */
  emphasis: 15,
  /** Small serif section headline (e.g. empty/gate-state titles). */
  headline: 18,
  /** Larger serif section headline. */
  headlineLg: 22,
  /** Largest serif display name/headline. */
  display: 28,
} as const;
