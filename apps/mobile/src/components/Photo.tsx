import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';

type Props = {
  uri: string;
  /** Width × height. Pass height: 'auto' for natural aspect via `aspectRatio`. */
  width?: number | `${number}%`;
  height?: number;
  aspectRatio?: number;
  radius?: number;
  /** Children render as overlays (category pill, friend chip, etc.). */
  children?: ReactNode;
  style?: ViewStyle;
  testID?: string;
};

/**
 * `expo-image` wrapped in a rounded clip with optional overlay children.
 * Brief rule: all photos are real, no SVG hero art. Photos sourced from
 * Unsplash during prototyping, Supabase Storage in production.
 */
export function Photo({
  uri,
  width = '100%',
  height,
  aspectRatio,
  radius = 14,
  children,
  style,
  testID,
}: Props) {
  return (
    <View
      testID={testID}
      style={[
        {
          width,
          height,
          aspectRatio,
          borderRadius: radius,
          overflow: 'hidden',
          backgroundColor: '#EFEAE2',
        },
        style,
      ]}
    >
      <Image
        source={{ uri }}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        accessibilityIgnoresInvertColors
      />
      {children}
    </View>
  );
}
