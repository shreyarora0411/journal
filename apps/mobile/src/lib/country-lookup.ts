import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase';

/**
 * Resolves an ISO 3166-1 alpha-2 country code (from Google Places
 * addressComponents) to a country_id in public.countries. Returns null
 * when the country isn't seeded — caller should proceed without
 * country_id, and the country should be added to migration 20's seed.
 *
 * One-shot, no caching beyond what Supabase + the network layer do.
 * At pilot scale this runs once per Log save, so caching isn't worth
 * the complexity.
 */
export const lookupCountryIdByIso = async (isoAlpha2: string | null): Promise<string | null> => {
  if (!isoAlpha2) return null;
  const code = isoAlpha2.toUpperCase();
  if (code.length !== 2) return null;

  try {
    const { data, error } = await getSupabase()
      .from('countries')
      .select('id')
      .eq('iso_alpha2', code)
      .maybeSingle();
    if (error) {
      // 42P01 = relation does not exist (migration not yet applied).
      if (error.code === '42P01') return null;
      log.warn('country lookup failed', { iso: code, error: error.message });
      return null;
    }
    if (!data) {
      log.warn('country not seeded', { iso: code });
      return null;
    }
    return (data as { id: string }).id;
  } catch (err) {
    log.warn('country lookup threw', { iso: code, error: String(err) });
    return null;
  }
};
