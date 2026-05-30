import { Text, View } from 'react-native';
import { Face } from './Face';

type Person = { uri?: string | null; initials?: string };

type Props = {
  people: Person[];
  /** Max faces rendered before collapsing into a "+N" overflow chip. */
  max?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  testID?: string;
};

const SIZE_DIM: Record<NonNullable<Props['size']>, number> = {
  xs: 20,
  sm: 32,
  md: 44,
  lg: 68,
};

/**
 * Overlapping circle of faces. 8px negative overlap, 2px white ring per
 * face, optional "+N" chip when the list exceeds `max`.
 *
 * Used wherever the brief says "12 friends have been" — the FaceStack is
 * the relationship cue that precedes the place name.
 */
export function FaceStack({ people, max = 3, size = 'sm', testID }: Props) {
  const dim = SIZE_DIM[size];
  const visible = people.slice(0, max);
  const overflow = people.length - visible.length;

  return (
    <View testID={testID} style={{ flexDirection: 'row' }}>
      {visible.map((p, i) => (
        <View
          key={`${p.uri ?? p.initials ?? 'anon'}-${i}`}
          style={{ marginLeft: i === 0 ? 0 : -8 }}
        >
          <Face uri={p.uri ?? null} initials={p.initials} size={size} ring />
        </View>
      ))}
      {overflow > 0 ? (
        <View
          testID={`${testID ?? 'face-stack'}-overflow`}
          style={{
            marginLeft: -8,
            width: dim,
            height: dim,
            borderRadius: dim / 2,
            backgroundColor: '#FAF6F0',
            borderWidth: 2,
            borderColor: '#FFFFFF',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: 'DMSans_600SemiBold',
              fontSize: Math.round(dim * 0.32),
              color: '#1A1410',
            }}
          >
            +{overflow}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
