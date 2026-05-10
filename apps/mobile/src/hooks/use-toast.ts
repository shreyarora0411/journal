import { createContext, useContext } from 'react';

export type ToastVariant = 'info' | 'error' | 'success';

export type ToastInput = {
  message: string;
  variant?: ToastVariant;
  durationMs?: number;
};

export type ToastContextValue = {
  show: (input: ToastInput) => void;
};

export const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return ctx;
};
