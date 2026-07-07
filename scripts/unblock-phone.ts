// Free a phone number stranded by a lost anonymous session.
//
// Auth is Supabase anonymous sign-in + a phone_hash stamped on public.users.
// A reinstall wipes the anonymous session; without it there is no way back
// into the account, yet the number stays "known" forever under the partial
// unique index users_phone_hash_uq (migration 48) — re-onboarding with the
// same number is permanently blocked. This script soft-deletes the ghost row
// and nulls its phone columns, which (a) frees the number under the partial
// index (null rows are exempt) and (b) hides the ghost from taste_twins /
// place_lovers / recover-session, all of which filter deleted_at (verified).
//
// Why we do NOT hand the account back instead (auth.admin.generateLink):
// the generated link redeems in a browser tab, and the app has no
// token-entry screen to paste the resulting session into — the link path
// cannot restore the account on-device today. Account hand-back is future
// work tied to a real OTP build. auth.users is deliberately left untouched:
// the orphaned anonymous auth row is inert and harmless.
//
// DRY-RUN BY DEFAULT: prints a summary + plan and exits. Executes only when
// --confirm <handle> is passed and matches the resolved handle exactly
// (retyped-handle confirmation).
//
// --purge-reactions additionally hard-deletes the ghost's place_reactions,
// place_tag_votes and place_dishes rows — private, restatable data. Vouches
// are NEVER touched (quotes are immutable; voice is the moat).
//
// Env (must be set before running):
//   SUPABASE_URL                  Your project URL
//   SUPABASE_SERVICE_ROLE_KEY     The service role key (server-only secret)
//
// Usage (from repo root):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     pnpm tsx scripts/unblock-phone.ts --handle priya          # dry run
//     pnpm tsx scripts/unblock-phone.ts --user <uuid>           # dry run
//     pnpm tsx scripts/unblock-phone.ts --handle priya --confirm priya
//     pnpm tsx scripts/unblock-phone.ts --handle priya --confirm priya --purge-reactions

import { createClient } from '@supabase/supabase-js';

const argv = process.argv.slice(2);
const opts = new Map<string, string>();
const flags = new Set<string>();
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (!arg?.startsWith('--')) continue;
  const next = argv[i + 1];
  if (next !== undefined && !next.startsWith('--')) {
    opts.set(arg.slice(2), next);
    i++;
  } else {
    flags.add(arg.slice(2));
  }
}

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing env. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const targetUserId = opts.get('user');
const targetHandle = opts.get('handle');
if ((targetUserId ? 1 : 0) + (targetHandle ? 1 : 0) !== 1) {
  console.error('Pass exactly one of --user <uuid> or --handle <handle>.');
  console.error('Example: pnpm tsx scripts/unblock-phone.ts --handle priya');
  process.exit(1);
}

// Pure-REST script, but supabase-js (2.5x+) eagerly resolves a realtime
// WebSocket constructor inside createClient() and crashes on Node < 22 (no
// native WebSocket). No channel is ever opened here, so hand it an inert
// transport instead of adding a `ws` dependency.
type RealtimeTransport = NonNullable<
  NonNullable<NonNullable<Parameters<typeof createClient>[2]>['realtime']>['transport']
>;
const inertTransport = class {
  constructor() {
    throw new Error('realtime is disabled in admin scripts');
  }
} as unknown as RealtimeTransport;

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
  realtime: { transport: inertTransport },
});

type UserRow = {
  id: string;
  handle: string | null;
  display_name: string | null;
  created_at: string;
  onboarding_completed_at: string | null;
  phone_hash: string | null;
  deleted_at: string | null;
} & Record<string, unknown>;

const countRows = async (
  table: string,
  column: string,
  value: string,
  alsoNotDeleted = false,
): Promise<number> => {
  let query = supabase.from(table).select('*', { count: 'exact', head: true }).eq(column, value);
  if (alsoNotDeleted) query = query.is('deleted_at', null);
  const { count, error } = await query;
  if (error) {
    console.error(`Count on ${table} failed: ${error.message}`);
    process.exit(1);
  }
  return count ?? 0;
};

const main = async () => {
  // select('*') so we can probe which columns actually exist on the live DB
  // (it has drifted from repo migrations before — trust the row, not the
  // tracker). phone_e164 (migration 16) is only nulled if the key is present.
  const { data, error } = targetUserId
    ? await supabase.from('users').select('*').eq('id', targetUserId).maybeSingle()
    : await supabase
        .from('users')
        .select('*')
        .eq('handle', targetHandle ?? '')
        .maybeSingle();
  if (error) {
    console.error(`Lookup failed: ${error.message}`);
    process.exit(1);
  }
  if (!data) {
    console.error(
      `No public.users row matches ${targetUserId ? `id ${targetUserId}` : `handle "${targetHandle}"`}.`,
    );
    process.exit(1);
  }
  const user = data as UserRow;

  if (user.deleted_at != null) {
    console.error(`Refusing: user is already soft-deleted (deleted_at = ${user.deleted_at}).`);
    process.exit(1);
  }
  if (user.phone_hash == null) {
    console.error('Refusing: phone_hash is null — there is no number to free.');
    process.exit(1);
  }
  const hasPhoneE164 = 'phone_e164' in user;

  const [reactions, tagVotes, dishes, vouches, following, followers] = await Promise.all([
    countRows('place_reactions', 'user_id', user.id),
    countRows('place_tag_votes', 'user_id', user.id),
    countRows('place_dishes', 'user_id', user.id),
    countRows('vouches', 'user_id', user.id, true),
    countRows('follows', 'follower_id', user.id),
    countRows('follows', 'followed_id', user.id),
  ]);

  console.log('Target user:');
  console.log(`  id:              ${user.id}`);
  console.log(`  handle:          ${user.handle ?? '(none)'}`);
  console.log(`  display_name:    ${user.display_name ?? '(none)'}`);
  console.log(`  created_at:      ${user.created_at}`);
  console.log(
    `  onboarding:      ${
      user.onboarding_completed_at ? `completed ${user.onboarding_completed_at}` : 'not completed'
    }`,
  );
  console.log(`  place_reactions: ${reactions}`);
  console.log(`  place_tag_votes: ${tagVotes}`);
  console.log(`  place_dishes:    ${dishes}`);
  console.log(`  vouches (live):  ${vouches}`);
  console.log(`  follows:         ${following} following / ${followers} followers`);

  const purge = flags.has('purge-reactions') || opts.has('purge-reactions');
  const phoneColumns = hasPhoneE164 ? 'phone_hash = null, phone_e164 = null' : 'phone_hash = null';
  console.log('\nPlan:');
  console.log(`  update public.users set ${phoneColumns}, deleted_at = now()`);
  console.log(`    where id = ${user.id}`);
  if (!hasPhoneE164) {
    console.log('  (live users table has no phone_e164 column — skipping it)');
  }
  if (purge) {
    console.log(
      `  hard-delete ${reactions} place_reactions, ${tagVotes} place_tag_votes, ${dishes} place_dishes`,
    );
  }
  console.log('  vouches are never touched (quotes are immutable); auth.users is never touched.');

  const confirm = opts.get('confirm');
  if (!confirm) {
    console.log(`\nDRY RUN — nothing written. Re-run with --confirm ${user.handle ?? '<handle>'}`);
    return;
  }
  if (user.handle == null) {
    console.error('\nRefusing: user has no handle, so retyped-handle confirmation is impossible.');
    process.exit(1);
  }
  if (confirm !== user.handle) {
    console.error(
      `\nRefusing: --confirm "${confirm}" does not exactly match the resolved handle "${user.handle}".`,
    );
    process.exit(1);
  }

  const patch: Record<string, unknown> = {
    phone_hash: null,
    deleted_at: new Date().toISOString(),
  };
  if (hasPhoneE164) patch.phone_e164 = null;
  const { error: updateError } = await supabase.from('users').update(patch).eq('id', user.id);
  if (updateError) {
    console.error(`Update failed: ${updateError.message}`);
    process.exit(1);
  }
  console.log(`\n✓ Freed phone for @${user.handle} — row soft-deleted, number re-usable.`);

  if (purge) {
    for (const table of ['place_reactions', 'place_tag_votes', 'place_dishes']) {
      const { error: deleteError } = await supabase.from(table).delete().eq('user_id', user.id);
      if (deleteError) {
        console.error(`Purge of ${table} failed: ${deleteError.message}`);
        process.exit(1);
      }
      console.log(`✓ Purged ${table}`);
    }
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
