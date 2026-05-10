import type { Theme } from '@/theme';
import { useTheme } from '@shopify/restyle';
import { forwardRef } from 'react';
import { TextInput, type TextInputProps } from 'react-native';
import { Box } from './Box';
import { Text } from './Text';

type Props = Omit<TextInputProps, 'style'> & {
  label?: string;
  error?: string;
};

export const Input = forwardRef<TextInput, Props>(function Input({ label, error, ...rest }, ref) {
  const theme = useTheme<Theme>();

  return (
    <Box>
      {label ? (
        <Text variant="label" marginBottom="xs">
          {label.toUpperCase()}
        </Text>
      ) : null}
      <Box
        backgroundColor="surface"
        borderColor={error ? 'accent' : 'border'}
        borderWidth={1}
        borderRadius="m"
        paddingHorizontal="m"
        paddingVertical="s"
      >
        <TextInput
          ref={ref}
          placeholderTextColor={theme.colors.textHint}
          {...rest}
          style={{
            color: theme.colors.ink,
            fontFamily: 'Inter_400Regular',
            fontSize: 16,
            paddingVertical: 4,
          }}
        />
      </Box>
      {error ? (
        <Text variant="caption" color="accent" marginTop="xs">
          {error}
        </Text>
      ) : null}
    </Box>
  );
});
