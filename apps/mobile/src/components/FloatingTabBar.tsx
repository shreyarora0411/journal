import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const INK = '#1A1410';
const MUTE = '#7A716A';
const PAPER = '#FFFFFF';
const CORAL = '#FF4D2E';

type IconKey = 'book' | 'search' | 'add' | 'friends' | 'you';

const LABELS: Record<IconKey, string> = {
  book: 'Book',
  search: 'Search',
  add: 'Add',
  friends: 'Friends',
  you: 'You',
};

const Glyph = ({ kind, active }: { kind: IconKey; active: boolean }) => {
  const color = active ? INK : MUTE;
  if (kind === 'book') return <Text style={[styles.icon, { color }]}>□</Text>;
  if (kind === 'search') return <Text style={[styles.icon, { color }]}>⌕</Text>;
  if (kind === 'friends') return <Text style={[styles.icon, { color }]}>◇</Text>;
  if (kind === 'you') return <Text style={[styles.icon, { color }]}>○</Text>;
  return <Text style={[styles.icon, { color }]}>＋</Text>;
};

/**
 * Floating pill tab bar. Five surfaces — Book / Search / Add / Friends /
 * You — with the Add disc raised 8px above the pill and filled coral.
 *
 * Honors the Tabs `state.routes` order; visible routes are the five
 * named here. Hidden routes (trip detail, list detail, etc) are
 * filtered out via the layout's `href: null` config.
 */
export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  // Only render the five canonical tabs in this order. Other routes
  // present in state.routes (deep-link surfaces) are ignored.
  const visible: { key: string; route: (typeof state.routes)[number]; icon: IconKey }[] = [];
  const wanted: { name: string; icon: IconKey }[] = [
    { name: 'book', icon: 'book' },
    { name: 'search', icon: 'search' },
    { name: 'add', icon: 'add' },
    { name: 'friends', icon: 'friends' },
    { name: 'you', icon: 'you' },
  ];
  for (const w of wanted) {
    const route = state.routes.find((r) => r.name === w.name);
    if (route) visible.push({ key: route.key, route, icon: w.icon });
  }

  const focusedKey = state.routes[state.index]?.key;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}
    >
      <View style={styles.pill}>
        {visible.map(({ key, route, icon }) => {
          const isFocused = key === focusedKey;
          const isCenter = icon === 'add';
          const descriptor = descriptors[key];
          const accessibilityLabel = descriptor?.options.tabBarAccessibilityLabel ?? LABELS[icon];

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          if (isCenter) {
            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityLabel={accessibilityLabel}
                onPress={onPress}
                style={styles.addWrap}
              >
                <View style={styles.addDisc}>
                  <Text style={styles.addPlus}>＋</Text>
                </View>
              </Pressable>
            );
          }

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityLabel={accessibilityLabel}
              accessibilityState={{ selected: isFocused }}
              onPress={onPress}
              style={styles.tab}
            >
              <Glyph kind={icon} active={isFocused} />
              <Text style={[styles.label, { color: isFocused ? INK : MUTE }]}>{LABELS[icon]}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PAPER,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 14,
    // Soft drop shadow — confident without shouting.
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOpacity: 0.08,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 8 },
    }),
  },
  tab: {
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  icon: { fontSize: 22 },
  label: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 12,
  },
  addWrap: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    // Raise 8px above the pill (matches the spec note in the screenshot).
    marginTop: -16,
  },
  addDisc: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: CORAL,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: CORAL,
        shadowOpacity: 0.3,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 6 },
    }),
  },
  addPlus: {
    color: PAPER,
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 26,
    lineHeight: 28,
  },
});
