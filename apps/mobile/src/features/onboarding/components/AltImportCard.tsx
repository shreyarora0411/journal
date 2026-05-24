import { Pressable, Text, View } from 'react-native';

type Props = {
  onPress: () => void;
};

const INK = '#1A1410';
const MUTE = '#7A716A';
const TINT = '#FAF6F0';
const HAIR = '#EFEAE2';

/**
 * Secondary entry-point on the Sign-up screen — `Continue with your camera
 * roll`. Replaces the design's `Continue with Instagram` row because the
 * pilot defers Meta OAuth (ADR 0005). Same card silhouette, honest label.
 *
 * Per redesign brief: container background = tint (not coral — coral is
 * reserved for primary CTAs). The icon is two stacked rounded rectangles
 * suggesting a pile of photos; no aperture/moon glyph.
 */
export function AltImportCard({ onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Continue with your camera roll"
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        backgroundColor: TINT,
        borderRadius: 16,
        padding: 16,
      }}
    >
      <PhotoStackGlyph />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'Geist_500Medium', fontSize: 16, color: INK }}>
          Continue with your camera roll
        </Text>
        <Text
          style={{
            fontFamily: 'Geist_400Regular',
            fontSize: 13,
            color: MUTE,
            marginTop: 4,
          }}
        >
          We'll group your last 6 months of photos into trip drafts.
        </Text>
      </View>
      <Text style={{ fontSize: 18, color: MUTE }}>→</Text>
    </Pressable>
  );
}

/**
 * Photo-stack glyph: two small rounded rectangles, the back one rotated
 * slightly so it reads as a pile of photos rather than a single icon.
 * Built from Views — no SVG, no emoji.
 */
function PhotoStackGlyph() {
  return (
    <View
      style={{
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Back photo — slightly rotated */}
      <View
        style={{
          position: 'absolute',
          width: 26,
          height: 30,
          borderRadius: 4,
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: HAIR,
          transform: [{ rotate: '-10deg' }, { translateX: -4 }],
        }}
      />
      {/* Front photo — straight, with a small ink dot suggesting a thumbnail */}
      <View
        style={{
          width: 26,
          height: 30,
          borderRadius: 4,
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: INK,
          transform: [{ rotate: '6deg' }, { translateX: 3 }],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: INK,
          }}
        />
      </View>
    </View>
  );
}
