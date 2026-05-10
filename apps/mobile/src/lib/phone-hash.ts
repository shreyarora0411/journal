import { normalizePhone } from '@journal/shared';
import * as Crypto from 'expo-crypto';

/**
 * Client-side SHA-256 hash of a normalized phone number, hex-encoded.
 *
 * This is the value sent to the match-contacts edge function. The server
 * applies a server-held pepper before storing or matching, so this client
 * hash on its own is not the value stored in users.phone_hash.
 *
 * See CLAUDE.md §9 (privacy) and supabase/functions/match-contacts/index.ts.
 */
export const hashPhone = async (raw: string): Promise<string> => {
  const normalized = normalizePhone(raw);
  if (!normalized) return '';
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, normalized, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
};

export const hashPhones = async (raws: readonly string[]): Promise<string[]> => {
  const out: string[] = [];
  for (const raw of raws) {
    const h = await hashPhone(raw);
    if (h) out.push(h);
  }
  return out;
};
