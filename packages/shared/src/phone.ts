/**
 * Phone number normalization. Used on both client (before SHA-256 hashing for
 * contact matching) and server (when stamping users.phone_hash on signup).
 *
 * Normalization rules:
 * - Strip all non-digits except a leading '+'.
 * - Require an E.164-shaped result (leading '+' then 8-15 digits).
 * - If the raw input has no country code (e.g. iOS contact stored as
 *   "99999 11111"), assume `defaultCountryCode` and prepend it. India is
 *   the pilot default — set explicitly at the call site.
 *
 * The hash itself is computed elsewhere (Web Crypto on client, Deno crypto on
 * the edge function) because the runtimes differ. This file only normalizes.
 */

/** Maps an ISO alpha-2 country code to its dialing prefix (no '+'). */
const COUNTRY_DIAL_PREFIX: Record<string, string> = {
  IN: '91',
  US: '1',
  CA: '1',
  GB: '44',
  AU: '61',
  AE: '971',
  SG: '65',
  // Extend as the pilot grows beyond India. Adding a country here is
  // safe — the normalizer only applies the prefix when the input has no
  // country code AND looks like a local number for that country.
};

const LOCAL_DIGITS_BY_COUNTRY: Record<string, number> = {
  IN: 10,
  US: 10,
  CA: 10,
  GB: 10,
  AU: 9,
  AE: 9,
  SG: 8,
};

export const normalizePhone = (
  raw: string,
  defaultCountryCode?: keyof typeof COUNTRY_DIAL_PREFIX,
): string => {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';

  // Caller already provided a country code (e.g. "+91 99999 11111" or any
  // form that includes the +). Just normalize the punctuation.
  if (hasPlus) return `+${digits}`;

  // No country code in the input. If we have a defaultCountryCode AND the
  // local digit count matches what we'd expect for that country, prepend.
  // This is the contact-import case — iOS contacts often save numbers
  // bare for the user's own country.
  if (defaultCountryCode && COUNTRY_DIAL_PREFIX[defaultCountryCode]) {
    const expectedLocal = LOCAL_DIGITS_BY_COUNTRY[defaultCountryCode];
    if (expectedLocal && digits.length === expectedLocal) {
      return `+${COUNTRY_DIAL_PREFIX[defaultCountryCode]}${digits}`;
    }
  }

  // Fall through: produce a syntactic E.164 from whatever we have.
  // isLikelyValidPhone() will reject the truly bad cases downstream.
  return `+${digits}`;
};

export const isLikelyValidPhone = (raw: string): boolean => {
  const normalized = normalizePhone(raw);
  // E.164: + followed by 8–15 digits.
  return /^\+\d{8,15}$/.test(normalized);
};
