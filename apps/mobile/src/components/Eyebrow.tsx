import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

type Props = {
  children: ReactNode;
  /** Dot + text color. Defaults to coral, the primary accent. */
  color?: string;
};

const CORAL = '#FF4D2E';

/**
 * Eyebrow: 6×6 colored dot + uppercase JetBrains Mono label.
 * Always lives above a screen title or section. Replaces the older
 * `EyebrowLabel` (Inter-based); the legacy export is kept aliased for
 * slice-1/2/3 callers until Batch A rebuilds those screens.
 */
export function Eyebrow({ children, color = CORAL }: Props) {
  const text = typeof children === 'string' ? children.toUpperCase() : children;
  return (
    <View accessibilityRole="text" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View
        testID="eyebrow-dot"
        style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }}
      />
      <Text
        style={{
          fontFamily: 'DMSans_700Bold',
          fontSize: 10,
          letterSpacing: 1.4,
          color,
        }}
      >
        {text}
      </Text>
    </View>
  );
}
