import { normalizePhone } from '@journal/shared';
import * as Crypto from 'expo-crypto';

/**
 * Client-side SHA-256 hash of a normalized phone number, hex-encoded.
 *
 * This is the value sent to the match-contacts edge function (and the
 * stamp-phone-hash function on sign-up). The server applies a server-held
 * pepper before storing or matching, so this client hash on its own is
 * not the value stored in users.phone_hash.
 *
 * `defaultCountryCode` is consulted only when the input has no '+'
 * prefix — i.e. iOS contact entries saved bare. For sign-up the Login
 * screen always passes a `+CC`-prefixed number so the default is moot.
 *
 * See CLAUDE.md §9 (privacy) and supabase/functions/match-contacts/index.ts.
 */
type CountryCode = 'IN' | 'US' | 'CA' | 'GB' | 'AU' | 'AE' | 'SG';

export const hashPhone = async (
  raw: string,
  defaultCountryCode: CountryCode = 'IN',
): Promise<string> => {
  const normalized = normalizePhone(raw, defaultCountryCode);
  if (!normalized) return '';
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, normalized, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
};

export const hashPhones = async (
  raws: readonly string[],
  defaultCountryCode: CountryCode = 'IN',
): Promise<string[]> => {
  const out: string[] = [];
  for (const raw of raws) {
    const h = await hashPhone(raw, defaultCountryCode);
    if (h) out.push(h);
  }
  return out;
};
