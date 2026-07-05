import type { ReactNode } from 'react';
import { ScrollView, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  children: ReactNode;
  /** Page background. Defaults to warm paper (#FAF8F5) — pure white read as
   *  white-boxes-on-white against the also-white cards; the "literary
   *  magazine" feel needs the page a shade darker than its cards. */
  backgroundColor?: string;
  /** Make the page non-scrolling (e.g. for full-bleed hero screens). */
  scroll?: boolean;
  /** Extra bottom padding *on top of* the safe-area inset + floating-nav clearance. */
  bottomPad?: number;
  /** Horizontal padding for the content. Defaults to 22 (screen-level gutter). */
  paddingHorizontal?: number;
  style?: ViewStyle;
};

const FLOATING_NAV_CLEARANCE = 96; // pill height (~64) + 16 float + 16 air

/**
 * Standard scrollable screen container. Warm paper background. Reserves room
 * at the bottom for the floating-pill `Nav` so content never hides under it,
 * even on screens that don't render the nav themselves.
 */
export function Page({
  children,
  backgroundColor = '#FAF8F5',
  scroll = true,
  bottomPad = 0,
  paddingHorizontal = 22,
  style,
}: Props) {
  const insets = useSafeAreaInsets();
  const paddingBottom = insets.bottom + FLOATING_NAV_CLEARANCE + bottomPad;

  if (!scroll) {
    return (
      <View style={[{ flex: 1, backgroundColor, paddingHorizontal, paddingBottom }, style]}>
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      style={[{ flex: 1, backgroundColor }, style]}
      contentContainerStyle={{ paddingHorizontal, paddingBottom, flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}
