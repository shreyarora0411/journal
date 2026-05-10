import { getSupabase } from '@/lib/supabase';

const cache = new Map<string, { url: string; expiresAt: number }>();
const SIGNED_TTL_S = 3600; // 1h

/**
 * Resolve a Supabase Storage path into a signed URL. Cached in-process.
 *
 * For Phase 2 we always sign; in Phase 3 with public-read for everyone-trips
 * we'll add an `isPublic` shortcut.
 */
export const getPhotoUrl = async (path: string): Promise<string | null> => {
  const cached = cache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const supabase = getSupabase();
  const { data, error } = await supabase.storage
    .from('trip-photos')
    .createSignedUrl(path, SIGNED_TTL_S);
  if (error || !data) return null;
  cache.set(path, { url: data.signedUrl, expiresAt: Date.now() + (SIGNED_TTL_S - 60) * 1000 });
  return data.signedUrl;
};
