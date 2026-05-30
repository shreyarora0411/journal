import { Text, type TextStyle } from 'react-native';

type Size = 'sm' | 'md' | 'lg' | 'xl';

type Props = {
  size?: Size;
  /** Color of the `lore` text. The dot is always coral. */
  color?: string;
};

const SIZE_MAP: Record<Size, number> = {
  sm: 18,
  md: 26,
  lg: 36,
  xl: 56,
};

const CORAL = '#FF4D2E';

/**
 * The `lore.` wordmark — Instrument Serif italic. The dot is always coral
 * regardless of the `color` prop so it reads as a deliberate mark, not
 * punctuation. The dot is its own Text node so it can sit slightly
 * offset (the brief calls it "the brand dot", not punctuation).
 */
export function Wordmark({ size = 'md', color = '#1A1410' }: Props) {
  const fontSize = SIZE_MAP[size];
  const baseStyle: TextStyle = {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize,
    color,
    // Italic serif looks best with slight negative tracking at large sizes.
    letterSpacing: size === 'xl' ? -1.6 : size === 'lg' ? -1 : -0.5,
  };
  return (
    <Text accessibilityLabel="lore." style={baseStyle}>
      lore
      <Text testID="wordmark-dot" style={{ color: CORAL, fontSize }}>
        .
      </Text>
    </Text>
  );
}
