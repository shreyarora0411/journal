import type { Theme } from '@/theme';
import { useTheme } from '@shopify/restyle';
import { forwardRef } from 'react';
import { TextInput, type TextInputProps } from 'react-native';
import { Box } from './Box';
import { Text } from './Text';

type Props = Omit<TextInputProps, 'style' | 'multiline' | 'numberOfLines'> & {
  label?: string;
  error?: string;
  minRows?: number;
  maxRows?: number;
};

const LINE_HEIGHT = 24;

export const Textarea = forwardRef<TextInput, Props>(function Textarea(
  { label, error, minRows = 4, maxRows = 12, ...rest },
  ref,
) {
  const theme = useTheme<Theme>();
  const minHeight = minRows * LINE_HEIGHT + 16;
  const maxHeight = maxRows * LINE_HEIGHT + 16;

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
          multiline
          textAlignVertical="top"
          placeholderTextColor={theme.colors.textHint}
          {...rest}
          style={{
            color: theme.colors.ink,
            fontFamily: 'Inter_400Regular',
            fontSize: 16,
            lineHeight: LINE_HEIGHT,
            minHeight,
            maxHeight,
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
