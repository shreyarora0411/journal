import { Image } from 'expo-image';
import { Box } from './Box';
import { Text } from './Text';

type Size = 'xs' | 'sm' | 'md' | 'lg';

type Props = {
  size?: Size;
  uri?: string | null;
  fallback: string;
};

const dimensions: Record<Size, { d: number; fontSize: number }> = {
  xs: { d: 24, fontSize: 11 },
  sm: { d: 32, fontSize: 13 },
  md: { d: 44, fontSize: 16 },
  lg: { d: 64, fontSize: 22 },
};

const initials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.charAt(0) ?? '';
  const second = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : '';
  return (first + second).toUpperCase() || '·';
};

export function Avatar({ size = 'md', uri, fallback }: Props) {
  const { d, fontSize } = dimensions[size];

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: d, height: d, borderRadius: d / 2 }}
        contentFit="cover"
        accessibilityLabel={fallback}
      />
    );
  }

  return (
    <Box
      width={d}
      height={d}
      borderRadius="pill"
      backgroundColor="accentSoft"
      alignItems="center"
      justifyContent="center"
      accessibilityLabel={fallback}
    >
      <Text style={{ color: '#A8482F', fontFamily: 'Inter_500Medium', fontSize }}>
        {initials(fallback)}
      </Text>
    </Box>
  );
}
