/**
 * Legacy alias for the redesigned {@link Eyebrow} primitive.
 *
 * Pre-redesign slice-1/2/3 screens still import `EyebrowLabel`; they get
 * the new JetBrains Mono + coral treatment for free via this re-export.
 * Remove this file once every screen has been rebuilt against the new
 * primitives (Batch A onwards).
 */
export { Eyebrow as EyebrowLabel } from './Eyebrow';
