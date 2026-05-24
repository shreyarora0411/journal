import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type NavSlot = 'feed' | 'search' | 'add' | 'inbox' | 'you';

type Props = {
  active: NavSlot;
  onPress: (slot: NavSlot) => void;
};

const SLOTS: ReadonlyArray<{ key: NavSlot; label: string; glyph: string }> = [
  { key: 'feed', label: 'Feed', glyph: '◇' },
  { key: 'search', label: 'Search', glyph: '○' },
  { key: 'add', label: 'Add', glyph: '＋' },
  { key: 'inbox', label: 'Inbox', glyph: '◐' },
  { key: 'you', label: 'You', glyph: '●' },
];

const CORAL = '#FF4D2E';
const TINT = '#FAF6F0';
const INK = '#1A1410';
const MUTE = '#7A716A';

/**
 * Floating-pill bottom navigation. Sits 16px above the safe-area inset
 * (not flush to the screen edge). Five slots: Feed · Search · `+` (coral,
 * larger) · Inbox · You.
 *
 * Active label swaps to italic serif and shows a 4px coral dot underneath.
 * Inactive labels are JetBrains Mono 9px uppercase.
 */
export function Nav({ active, onPress }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: insets.bottom + 16,
        alignItems: 'center',
      }}
    >
      <View
        testID="nav-pill"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: 14,
          paddingVertical: 10,
          backgroundColor: TINT,
          borderRadius: 999,
          shadowColor: INK,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 3,
        }}
      >
        {SLOTS.map((s) => {
          const isActive = s.key === active;
          const isAdd = s.key === 'add';
          return (
            <Pressable
              key={s.key}
              accessibilityRole="button"
              accessibilityLabel={s.label}
              accessibilityState={{ selected: isActive }}
              onPress={() => onPress(s.key)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              testID={`nav-${s.key}`}
              style={{
                width: isAdd ? 56 : 56,
                paddingVertical: 6,
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: isAdd ? 34 : 28,
                  height: isAdd ? 34 : 28,
                  borderRadius: isAdd ? 999 : 14,
                  backgroundColor: isAdd ? CORAL : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: isAdd ? 22 : 18,
                    color: isAdd ? '#FFFFFF' : isActive ? INK : MUTE,
                    fontFamily: 'Geist_500Medium',
                  }}
                >
                  {s.glyph}
                </Text>
              </View>
              {isAdd ? null : (
                <Text
                  style={{
                    marginTop: 4,
                    fontFamily: isActive ? 'InstrumentSerif_400Italic' : 'JetBrainsMono_400Regular',
                    fontSize: isActive ? 12 : 9,
                    letterSpacing: isActive ? 0 : 1.4,
                    color: isActive ? INK : MUTE,
                  }}
                >
                  {isActive ? s.label : s.label.toUpperCase()}
                </Text>
              )}
              {isActive && !isAdd ? (
                <View
                  testID={`nav-${s.key}-dot`}
                  style={{
                    marginTop: 2,
                    width: 4,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: CORAL,
                  }}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
