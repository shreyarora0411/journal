import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

type FeatherName = ComponentProps<typeof Feather>['name'];

type Props = {
  name: FeatherName;
  size?: number;
  color?: string;
};

/**
 * The app's ONE icon escape hatch.
 *
 * Brand-voice marks stay as TEXT so they inherit the type system and keep the
 * editorial, typographic feel: the wordmark dot, the ‹ › chevrons, ▸ ▾ collapse
 * triangles, ↗ (open in Maps / external), ✓ (confirmed), and the ◇ ○ □ ● tab
 * markers. Feather — hairline, monochrome, ships with Expo (zero new dep) — is
 * reserved for true UI affordances that have no clean, reliable text glyph.
 * Today that's just `bookmark` (save). Keep this list short: text first, an icon
 * only when text genuinely can't carry the meaning. Never an emoji.
 */
export function Icon({ name, size = 18, color = '#1A1410' }: Props) {
  return <Feather name={name} size={size} color={color} />;
}
