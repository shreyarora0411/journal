import { getPhotoUrl } from '@/features/trips/lib/photo-url';
import { tryGooglePlacesPhoto } from '@/lib/hero-photo';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

const TINT = '#FAF6F0';
const HAIR = '#EFEAE2';

type Props = {
  /** Storage path on `trip-photos` bucket — wins if set (user upload). */
  storagePath?: string | null;
  /** Google Place ID — falls back here when storagePath is empty. */
  googlePlaceId?: string | null;
  /** Square edge size. */
  size?: number;
};

/**
 * Small square thumbnail for a venue.
 *
 * Resolution chain:
 *   1. User-uploaded cover_photo_path → signed URL from Supabase Storage
 *   2. Google Places photo via google_place_id (cached 24h by React Query)
 *   3. Empty tinted square (never a broken-image frame)
 *
 * Google Places photo cost is ~$0.007 each so the cache is important.
 */
export function VenueThumb({ storagePath, googlePlaceId, size = 64 }: Props) {
  const [userUrl, setUserUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!storagePath) {
      setUserUrl(null);
      return;
    }
    let cancelled = false;
    getPhotoUrl(storagePath).then((u) => {
      if (!cancelled) setUserUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  // Google Places fallback — only fetched when there's no user photo
  // AND the venue has a google_place_id. React Query caches by place_id
  // for 24h so scrolling back doesn't re-bill.
  const googleQ = useQuery({
    queryKey: ['venue-google-photo', googlePlaceId],
    queryFn: () => (googlePlaceId ? tryGooglePlacesPhoto(googlePlaceId) : null),
    enabled: Boolean(googlePlaceId) && !storagePath && !userUrl,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const url = userUrl ?? googleQ.data?.url ?? null;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      {url ? (
        <Image
          source={{ uri: url }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: TINT,
    borderWidth: 1,
    borderColor: HAIR,
  },
});
