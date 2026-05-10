/**
 * Phone number normalization. Used on both client (before SHA-256 hashing for
 * contact matching) and server (when stamping users.phone_hash on signup).
 *
 * Normalization rules:
 * - Strip all non-digits except a leading '+'.
 * - Require a leading '+' (E.164). If missing, callers must add a country code first.
 * - Lowercase letters are not legal in phone numbers — they're stripped above.
 *
 * The hash itself is computed elsewhere (web crypto on client, Deno crypto on
 * edge function) because the runtimes differ. This file only normalizes.
 */
export const normalizePhone = (raw: string): string => {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  return `+${digits}`.replace(/^\+\++/, '+') === `+${digits}` && hasPlus
    ? `+${digits}`
    : `+${digits}`;
};

export const isLikelyValidPhone = (raw: string): boolean => {
  const normalized = normalizePhone(raw);
  // E.164: + followed by 8–15 digits.
  return /^\+\d{8,15}$/.test(normalized);
};
