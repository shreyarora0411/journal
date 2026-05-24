import { Pressable, Text, View } from 'react-native';

export type Verdict = 'love' | 'mid' | 'skip';

type Props = {
  value?: Verdict;
  onChange: (v: Verdict) => void;
};

const VERDICTS: ReadonlyArray<{
  key: Verdict;
  label: string;
  glyph: string;
  color: string;
}> = [
  { key: 'love', label: 'Love', glyph: '♥', color: '#FF4D2E' },
  { key: 'mid', label: 'Mid', glyph: '—', color: '#7A716A' },
  { key: 'skip', label: 'Skip', glyph: '✕', color: '#1A1410' },
];

/**
 * Three-state sentiment picker — love / mid / skip. The brief is explicit:
 * no stars, no scales, three buckets only. Surfaced on the logger's own
 * profile, not on the recommendation card the friend sees. Default
 * selection is `love`.
 */
export function VerdictPicker({ value = 'love', onChange }: Props) {
  return (
    <View
      accessibilityRole="radiogroup"
      style={{ flexDirection: 'row', gap: 12 }}
      testID="verdict-picker"
    >
      {VERDICTS.map((v) => {
        const selected = v.key === value;
        return (
          <Pressable
            key={v.key}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={v.label}
            onPress={() => onChange(v.key)}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 14,
              borderRadius: 14,
              backgroundColor: selected ? v.color : 'transparent',
              borderWidth: 1,
              borderColor: v.color,
            }}
            testID={`verdict-${v.key}`}
          >
            <Text
              style={{
                fontFamily: 'Geist_500Medium',
                fontSize: 18,
                color: selected ? '#FFFFFF' : v.color,
              }}
            >
              {v.glyph}
            </Text>
            <Text
              style={{
                fontFamily: 'Geist_500Medium',
                fontSize: 12,
                color: selected ? '#FFFFFF' : '#7A716A',
                marginTop: 4,
              }}
            >
              {v.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
