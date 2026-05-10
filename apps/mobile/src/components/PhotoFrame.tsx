import type { Theme } from '@/theme';
import { useTheme } from '@shopify/restyle';
import { Image } from 'expo-image';
import { Box } from './Box';

type Props = {
  uri: string;
  /** width / height — preserves aspect ratio */
  aspect?: number;
  /** max width in px, defaults to 220 (cover photo cap) */
  maxWidth?: number;
  accessibilityLabel?: string;
};

export function PhotoFrame({ uri, aspect = 4 / 3, maxWidth = 220, accessibilityLabel }: Props) {
  const theme = useTheme<Theme>();
  const innerWidth = maxWidth - 8; // 4px paper padding on each side
  const innerHeight = innerWidth / aspect;

  return (
    <Box
      style={{ width: maxWidth }}
      borderColor="border"
      borderWidth={1}
      backgroundColor="paper"
      padding="xs"
    >
      <Image
        source={{ uri }}
        style={{ width: innerWidth, height: innerHeight, backgroundColor: theme.colors.divider }}
        contentFit="cover"
        accessibilityLabel={accessibilityLabel}
      />
    </Box>
  );
}
