import { Image } from 'expo-image';
import { Text, View } from 'react-native';

type Size = 'xs' | 'sm' | 'md' | 'lg';

type Props = {
  uri?: string | null;
  /** Two-letter initials fallback when `uri` is missing. */
  initials?: string;
  size?: Size;
  /** White ring around the face — use when overlapping other content. */
  ring?: boolean;
  testID?: string;
};

const SIZE_MAP: Record<Size, number> = {
  xs: 20,
  sm: 32,
  md: 44,
  lg: 68,
};

/**
 * Round avatar. The brief calls this "Face" because every recommendation
 * surface leads with one — the friend's face is the unit, before the
 * place name. Falls back to initials on a tinted disc when `uri` is null.
 */
export function Face({ uri, initials, size = 'md', ring = false, testID }: Props) {
  const dim = SIZE_MAP[size];
  return (
    <View
      testID={testID}
      style={{
        width: dim,
        height: dim,
        borderRadius: dim / 2,
        overflow: 'hidden',
        backgroundColor: '#FAF6F0',
        borderWidth: ring ? 2 : 0,
        borderColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Text
          style={{
            fontFamily: 'DMSans_600SemiBold',
            fontSize: Math.round(dim * 0.36),
            color: '#1A1410',
          }}
        >
          {(initials ?? '··').slice(0, 2).toUpperCase()}
        </Text>
      )}
    </View>
  );
}
