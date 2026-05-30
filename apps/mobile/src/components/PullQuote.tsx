import { Text, type TextStyle } from 'react-native';

type Props = {
  /** The quote body. Curly quotes wrap automatically. */
  children: string;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  style?: TextStyle;
};

const SIZE_MAP: Record<NonNullable<Props['size']>, { fontSize: number; lineHeight: number }> = {
  sm: { fontSize: 16, lineHeight: 22 },
  md: { fontSize: 22, lineHeight: 28 },
  lg: { fontSize: 26, lineHeight: 32 },
};

/**
 * Italic-serif quote wrapped in curly quotation marks. The brief calls
 * this out as a rule — italic serif is "the human voice", never a UI
 * label or button. Always use this for friend-quote pull quotes; do not
 * style raw `Text` with `quote` variant if you can route through here.
 */
export function PullQuote({ children, size = 'md', color = '#1A1410', style }: Props) {
  const { fontSize, lineHeight } = SIZE_MAP[size];
  return (
    <Text
      style={[
        {
          fontFamily: 'PlayfairDisplay_500Medium',
          fontSize,
          lineHeight,
          color,
        },
        style,
      ]}
    >
      {'“'}
      {children}
      {'”'}
    </Text>
  );
}
