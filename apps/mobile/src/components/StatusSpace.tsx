import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  /** Minimum spacer height (rendered when the safe-area inset is smaller). */
  min?: number;
};

/**
 * Vertical spacer that respects the top safe-area inset. iOS notch + Android
 * status bar render at different heights; this normalises both to "enough
 * room above content". The brief calls for a 56pt anchor; this primitive
 * grows to whichever is larger.
 */
export function StatusSpace({ min = Platform.OS === 'ios' ? 56 : 24 }: Props = {}) {
  const insets = useSafeAreaInsets();
  return <View style={{ height: Math.max(insets.top, min) }} />;
}
