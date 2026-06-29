import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase';

/**
 * Auto-follow plumbing for the `lore://follow?id=<userId>` deep link.
 *
 * The link can arrive in two situations:
 *
 *   1. The viewer already has a session (app installed, signed in). We can
 *      apply the follow immediately — see `applyFollow`.
 *   2. The viewer taps the link before they have a session (fresh open that
 *      lands on the login flow). We can't follow yet, so we stash the
 *      inviter id here and replay it the moment a session exists — see
 *      `setPendingFollow` / `consumePendingFollow`, which `use-start-session`
 *      drains after a just-signed-in user lands.
 *
 * IMPORTANT cold-install limitation: a brand-new App Store install does NOT
 * preserve the originating URL (no deferred-deep-link infra — Branch/Firebase
 * Dynamic Links — wired up). So this only auto-follows users who already have
 * the app installed (tapping a link or scanning a QR), not fresh installs.
 */

/**
 * Module-level stash for an inviter id captured before a session exists.
 * Lives only for the current process — that's fine, the window between
 * tapping the link and signing in is a single app session.
 */
let pendingInviterId: string | null = null;

/** Remember an inviter to follow once the viewer has a session. */
export const setPendingFollow = (inviterId: string): void => {
  pendingInviterId = inviterId;
};

/** Take (and clear) any stashed inviter id. Returns null if none pending. */
export const consumePendingFollow = (): string | null => {
  const id = pendingInviterId;
  pendingInviterId = null;
  return id;
};

/**
 * Parse a `lore://follow?id=<userId>` URL and return the inviter id, or null
 * if the URL isn't a follow link / has no usable id. Tolerant of the host
 * landing in either the host slot (`lore://follow?id=...`) or as the first
 * path segment (`lore:///follow?id=...`), and of an `https://…/follow?id=…`
 * web form once a real INVITE_URL exists.
 */
export const parseFollowUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  try {
    // expo-linking isn't needed here — a hand-rolled parse keeps this pure and
    // unit-testable without RN/native modules in scope.
    const isFollow = /(?:^|[/:])follow(?:[/?#]|$)/i.test(url);
    if (!isFollow) return null;
    const queryStart = url.indexOf('?');
    if (queryStart === -1) return null;
    const query = url.slice(queryStart + 1);
    for (const pair of query.split('&')) {
      const [rawKey, rawVal] = pair.split('=');
      if (rawKey === 'id' && rawVal) {
        const id = decodeURIComponent(rawVal).trim();
        return id.length > 0 ? id : null;
      }
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Create an accepted follow edge viewer→inviter. Mirrors the insert in
 * `useFollow` (accepted is the table default; 23505 = already-following is
 * ignored) plus a best-effort activity row, but is a plain async function so
 * it can run from the deep-link handler and from `use-start-session` without a
 * React hook.
 *
 * The follow model is directed (one row per direction), so we only create the
 * viewer→inviter edge here; the inviter follows back via their own circle.
 *
 * No-ops (returns false) when there's no session, or when the inviter is the
 * viewer themselves (self-follow from one's own link).
 */
export const applyFollow = async (inviterId: string): Promise<boolean> => {
  if (!inviterId) return false;
  const supabase = getSupabase();

  const { data: authData } = await supabase.auth.getUser();
  const viewerId = authData?.user?.id ?? null;
  if (!viewerId) return false;
  if (viewerId === inviterId) return false;

  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: viewerId, followed_id: inviterId });
  // 23505 = unique violation — already following. Treat as success.
  if (error && error.code !== '23505') {
    log.warn('auto-follow insert failed', { error: error.message });
    return false;
  }

  // Activity stream: surface the new connection on the inviter's feed.
  // Best-effort — failure is non-blocking.
  supabase
    .from('activity')
    .insert({
      user_id: viewerId,
      type: 'follow_started',
      payload: { followed_user_id: inviterId },
    })
    .then(({ error: actErr }) => {
      if (actErr) log.warn('auto-follow activity insert failed', { error: actErr.message });
    });

  log.event('invite.auto_follow_applied');
  return true;
};

/**
 * Drain any inviter stashed before sign-in and apply the follow. Called by
 * `use-start-session` once a just-signed-in user has a session. Safe to call
 * unconditionally — no-ops when nothing is pending.
 */
export const applyPendingFollow = async (): Promise<void> => {
  const inviterId = consumePendingFollow();
  if (!inviterId) return;
  try {
    await applyFollow(inviterId);
  } catch (err) {
    log.warn('applyPendingFollow failed', { error: String(err) });
  }
};

/**
 * Handle a freshly-received URL: if it's a follow link, either apply the
 * follow now (session exists) or stash it for replay after sign-in. Returns
 * true when the URL was a follow link we handled (so callers can stop).
 */
export const handleFollowUrl = async (url: string | null | undefined): Promise<boolean> => {
  const inviterId = parseFollowUrl(url);
  if (!inviterId) return false;

  log.event('invite.follow_link_opened');
  const applied = await applyFollow(inviterId);
  if (!applied) {
    // No session yet (or it was a self/no-op). Stash so we can replay the
    // follow the instant a session exists. A self-follow stashes harmlessly —
    // applyFollow no-ops it again on replay.
    setPendingFollow(inviterId);
  }
  return true;
};
