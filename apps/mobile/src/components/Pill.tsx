import type { Theme } from '@/theme';
import { useTheme } from '@shopify/restyle';
import { Pressable } from 'react-native';
import { Box } from './Box';
import { Text } from './Text';

type Variant = 'default' | 'on' | 'accent';

type Props = {
  label: string;
  variant?: Variant;
  onPress?: () => void;
};

export function Pill({ label, variant = 'default', onPress }: Props) {
  const theme = useTheme<Theme>();

  const colors = (() => {
    if (variant === 'on')
      return {
        bg: theme.colors.primaryBg,
        fg: theme.colors.primaryFg,
        border: theme.colors.primaryBg,
      };
    if (variant === 'accent')
      return { bg: theme.colors.accentSoft, fg: theme.colors.accent, border: theme.colors.accent };
    return { bg: theme.colors.transparent, fg: theme.colors.ink, border: theme.colors.border };
  })();

  const content = (
    <Box
      paddingHorizontal="m"
      paddingVertical="xs"
      borderRadius="pill"
      borderWidth={1}
      style={{ backgroundColor: colors.bg, borderColor: colors.border }}
      alignSelf="flex-start"
    >
      <Text style={{ color: colors.fg, fontFamily: 'Inter_500Medium', fontSize: 13 }}>{label}</Text>
    </Box>
  );

  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress}>
        {content}
      </Pressable>
    );
  }
  return content;
}
