import { CATEGORIES, type Category } from '@/theme';
import { Pressable, Text, View, type ViewStyle } from 'react-native';

type Props = {
  category: Category;
  /** Outlined (default), filled solid, or soft-tint background. */
  variant?: 'soft' | 'filled' | 'outlined';
  onPress?: () => void;
  style?: ViewStyle;
};

/**
 * Uppercase category marker — Stay (coral) · Food (pink) · Drinks
 * (emerald) · Wander (gold) · Buy (mute). Per the brief, the four
 * category colors NEVER appear as button backgrounds — they are markers
 * only, paired with a category pill or live-dot.
 */
export function CategoryPill({ category, variant = 'soft', onPress, style }: Props) {
  const meta = CATEGORIES[category];
  const labelColor = variant === 'filled' ? '#FFFFFF' : meta.color;
  const bg = variant === 'filled' ? meta.color : variant === 'outlined' ? 'transparent' : meta.soft;

  const inner = (
    <View
      style={[
        {
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: bg,
          borderWidth: variant === 'outlined' ? 1 : 0,
          borderColor: meta.color,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <Text
        style={{
          fontFamily: 'Geist_500Medium',
          fontSize: 10,
          letterSpacing: 0.7,
          color: labelColor,
          fontWeight: '700',
        }}
      >
        {meta.label.toUpperCase()}
      </Text>
    </View>
  );

  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button">
      {inner}
    </Pressable>
  ) : (
    inner
  );
}
