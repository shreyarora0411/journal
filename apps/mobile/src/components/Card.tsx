import type { ReactNode } from 'react';
import { Box } from './Box';

type Props = {
  children: ReactNode;
  /**
   * Surface treatment:
   *   - `default`: white background, 1px hair border, 14px radius
   *   - `tint`: warm-sand background, no border (for cards on a white page)
   */
  variant?: 'default' | 'tint';
};

export function Card({ children, variant = 'default' }: Props) {
  if (variant === 'tint') {
    return (
      <Box backgroundColor="tint" borderRadius="l" padding="m">
        {children}
      </Box>
    );
  }
  return (
    <Box backgroundColor="cardBg" borderColor="hair" borderWidth={1} borderRadius="l" padding="m">
      {children}
    </Box>
  );
}
