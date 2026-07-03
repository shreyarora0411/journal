import { Platform } from 'react-native';

/**
 * Build a WhatsApp deep link. Uses the universal wa.me URL which works
 * cross-platform (native app on phone, web on browser).
 *
 * If a phone number is provided it should be E.164 without the leading '+'.
 */
export const buildWhatsAppLink = (text: string, phone?: string): string => {
  const encoded = encodeURIComponent(text);
  const cleaned = (phone ?? '').replace(/\D/g, '');
  if (cleaned) return `https://wa.me/${cleaned}?text=${encoded}`;
  // No phone — opens chooser on phone, default chat on web.
  return Platform.OS === 'web'
    ? `https://wa.me/?text=${encoded}`
    : `whatsapp://send?text=${encoded}`;
};

/**
 * Canonical install destination — the single place the app's invite link lives.
 * EMPTY until the real App Store / TestFlight URL is ready; the maintainer will
 * supply it. Set it here and every invite/share surface picks it up at once,
 * because they all read from this one constant. Never point this at a domain
 * that isn't actually reachable (we had two dead ones — journal.app, lore.app).
 */
export const INVITE_URL: string = '';

/**
 * Appends the install link to a share message — but only once a real URL exists.
 * Until then messages ship link-free rather than pointing at a dead URL.
 */
export const appendInviteLink = (text: string): string =>
  INVITE_URL ? `${text}\n\n${INVITE_URL}` : text;

/** The app's deep-link scheme (matches app.json `scheme`). */
const APP_SCHEME = 'lore';

/**
 * Build a personal follow link for the given user. Opening it on a device with
 * the app installed auto-follows `userId` (handled in app/_layout.tsx).
 *
 * Two forms:
 *   - When a real INVITE_URL exists, we hang `?id=<userId>` off it, so the link
 *     doubles as a web install link (the store/universal-link page can forward
 *     the id into the app). Preserves any existing query string on INVITE_URL.
 *   - Until then, we emit the raw `lore://follow?id=<userId>` scheme link —
 *     usable by already-installed users and QR codes, just not fresh installs
 *     (see the cold-install limitation in pending-follow.ts).
 */
export const buildFollowLink = (userId: string): string => {
  const id = encodeURIComponent(userId);
  if (INVITE_URL) {
    const sep = INVITE_URL.includes('?') ? '&' : '?';
    return `${INVITE_URL}${sep}id=${id}`;
  }
  return `${APP_SCHEME}://follow?id=${id}`;
};

/**
 * The personal-invite message: the generic come-join copy plus a follow link
 * carrying the inviter's id, so whoever installs/opens it lands already
 * following them. Falls back to the link-free INVITE_TEXT when there's no
 * userId (e.g. not signed in yet).
 */
export const buildPersonalInviteText = (userId?: string | null): string => {
  const base = "i'm on Vouch — friends-only travel notes, no reviews, no strangers.";
  if (!userId) return appendInviteLink(base);
  return `${base}\n\n${buildFollowLink(userId)}`;
};

/**
 * The generic "come join" invite, in the product's established voice:
 * friends-only travel notes, no reviews, no strangers. Single source of truth —
 * every invite surface shares this exact copy.
 */
export const INVITE_TEXT = appendInviteLink(
  "i'm on Vouch — friends-only travel notes, no reviews, no strangers.",
);
