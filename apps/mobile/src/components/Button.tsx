import type { Theme } from '@/theme';
import { useTheme } from '@shopify/restyle';
import { ActivityIndicator, Pressable, type PressableProps } from 'react-native';
import { Box } from './Box';
import { Text } from './Text';

type Variant = 'primary' | 'ghost' | 'accent';
type Size = 'sm' | 'md' | 'lg';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
};

const sizing: Record<Size, { paddingVertical: keyof Theme['spacing']; fontSize: number }> = {
  sm: { paddingVertical: 'xs', fontSize: 14 },
  md: { paddingVertical: 's', fontSize: 16 },
  lg: { paddingVertical: 'm', fontSize: 17 },
};

const colorFor = (variant: Variant, theme: Theme) => {
  if (variant === 'primary') return { bg: theme.colors.primaryBg, fg: theme.colors.primaryFg };
  if (variant === 'accent') return { bg: theme.colors.accentBg, fg: theme.colors.accentFg };
  return { bg: theme.colors.transparent, fg: theme.colors.ink };
};

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  ...rest
}: Props) {
  const theme = useTheme<Theme>();
  const { bg, fg } = colorFor(variant, theme);
  const isInactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isInactive, busy: loading }}
      disabled={isInactive}
      {...rest}
    >
      {({ pressed }) => (
        <Box
          alignItems="center"
          justifyContent="center"
          flexDirection="row"
          paddingHorizontal="l"
          paddingVertical={sizing[size].paddingVertical}
          borderRadius="pill"
          borderWidth={variant === 'ghost' ? 1 : 0}
          borderColor="border"
          style={{
            backgroundColor: bg,
            opacity: isInactive ? 0.5 : pressed ? 0.85 : 1,
            alignSelf: fullWidth ? 'stretch' : 'flex-start',
            // WCAG AA — minimum tap target 44x44.
            minHeight: 44,
          }}
        >
          {loading ? (
            <ActivityIndicator color={fg} size="small" />
          ) : (
            <Text
              style={{ color: fg, fontSize: sizing[size].fontSize }}
              fontFamily="Inter_500Medium"
            >
              {label}
            </Text>
          )}
        </Box>
      )}
    </Pressable>
  );
}
