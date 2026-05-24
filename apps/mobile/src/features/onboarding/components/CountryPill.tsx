import { Pressable, Text } from 'react-native';

/**
 * India-only country pill for the phone-number row. Visually matches the
 * design (flag + dial code + chevron) but the tap is disabled — picker is
 * out of scope for the India-only pilot.
 */
export function CountryPill() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Country: India"
      accessibilityState={{ disabled: true }}
      disabled
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#F3F3F0',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
      }}
    >
      <Text style={{ fontSize: 16 }}>🇮🇳</Text>
      <Text style={{ fontFamily: 'Inter_500Medium', color: '#1A1A1A', fontSize: 14 }}>+91</Text>
      <Text style={{ fontSize: 12, color: '#5A5A5A' }}>▾</Text>
    </Pressable>
  );
}
