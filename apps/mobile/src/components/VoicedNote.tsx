import { Text, type TextStyle } from 'react-native';

type Props = {
  note: string;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  numberOfLines?: number;
  style?: TextStyle;
};

const SIZE_MAP: Record<NonNullable<Props['size']>, { fontSize: number; lineHeight: number }> = {
  sm: { fontSize: 13, lineHeight: 18 },
  md: { fontSize: 14.5, lineHeight: 21 },
  lg: { fontSize: 15.5, lineHeight: 23 },
};

const INK = '#1B1714';

/**
 * A friend's (or your own) voiced note on a place — this product's signature
 * element, so it must always read as an actual human quote: curly quotes,
 * Fraunces italic, never a UI label. Route every rendered `.note` through
 * here rather than hand-rolling quote marks + a local italic style.
 */
export function VoicedNote({ note, size = 'md', color = INK, numberOfLines, style }: Props) {
  const { fontSize, lineHeight } = SIZE_MAP[size];
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[{ fontFamily: 'Fraunces_400Italic', fontSize, lineHeight, color }, style]}
    >
      {'“'}
      {note}
      {'”'}
    </Text>
  );
}
