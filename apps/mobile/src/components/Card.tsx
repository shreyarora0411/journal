import type { ReactNode } from 'react';
import { Box } from './Box';

type Props = {
  children: ReactNode;
};

export function Card({ children }: Props) {
  return (
    <Box backgroundColor="cardBg" borderColor="border" borderWidth={1} borderRadius="m" padding="m">
      {children}
    </Box>
  );
}
