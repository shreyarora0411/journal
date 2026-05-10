import { PhotoFrame } from '@/components';
import { useEffect, useState } from 'react';
import { getPhotoUrl } from '../lib/photo-url';

type Props = {
  storagePath: string;
  aspect?: number;
  maxWidth?: number;
  accessibilityLabel?: string;
};

/**
 * Resolves a Supabase Storage path to a short-lived signed URL and shows it
 * inside a PhotoFrame. Returns null while resolving / on failure (safe in lists).
 */
export function SignedPhoto({
  storagePath,
  aspect = 4 / 3,
  maxWidth = 220,
  accessibilityLabel,
}: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPhotoUrl(storagePath).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  if (!url) return null;
  return (
    <PhotoFrame
      uri={url}
      aspect={aspect}
      maxWidth={maxWidth}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
