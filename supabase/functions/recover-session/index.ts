// recover-session — phone-hash lookup that returns a magic-link token
// the client can redeem to sign in AS the existing user.
//
// Anonymous Supabase auth (the pilot's ADR 0004) mints a fresh user on
// every signInAnonymously() — there is no built-in path to recover the
// same user from a fresh device. This function closes that gap.
//
// Flow:
//   1. Client hashes the entered phone (no pepper) and POSTs it here.
//   2. We apply the server pepper, look up public.users.phone_hash.
//   3. If found, we fetch the auth user's synthetic email
//      (`<id>@no-email.lore.app`, stamped at sign-up by stamp-phone-hash)
//      and call auth.admin.generateLink({type:'magiclink', email}).
//   4. We return {found:true, email, hashedToken} — the client then
//      calls supabase.auth.verifyOtp({email, token, type:'magiclink'}).
//   5. If no match, we return {found:false} and the client falls back
//      to the existing signInAnonymously + stamp-phone-hash flow.
//
// Required env:
//   PHONE_HASH_PEPPER          — MUST equal stamp-phone-hash + match-contacts
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  — auto-injected
//
// Public endpoint — NOT authenticated. Returns enough information to
// sign in if you guess the correct phone hash, which is exactly what
// match-contacts already exposes. Both are gated only by the pepper.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.6';
import { corsHeaders, handlePreflight } from '../_shared/cors.ts';

type Body = {
  client_hash: string;
};

const peppered = async (clientHashHex: string, pepper: string): Promise<Uint8Array> => {
  const encoder = new TextEncoder();
  const buf = encoder.encode(`${pepper}:${clientHashHex}`);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return new Uint8Array(digest);
};

const hex = (b: Uint8Array) =>
  `\\x${Array.from(b)
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('')}`;

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const pepper = Deno.env.get('PHONE_HASH_PEPPER');

  if (!supabaseUrl || !serviceKey || !pepper) {
    return new Response(JSON.stringify({ error: 'server_misconfigured' }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return new Response('Bad JSON', { status: 400, headers: corsHeaders });
  }

  const clientHash = typeof body.client_hash === 'string' ? body.client_hash : '';
  if (!/^[0-9a-f]{64}$/.test(clientHash)) {
    return new Response('Invalid client_hash', { status: 400, headers: corsHeaders });
  }

  const stored = hex(await peppered(clientHash, pepper));
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Look up the user by phone_hash. Multiple users can share a hash
  // because no unique constraint enforces uniqueness on the column
  // (and historically the anon-auth flow minted duplicates on every
  // sign-in before recovery existed). Pick the OLDEST — that's the
  // canonical original account; later duplicates are abandoned. The
  // accompanying cleanup SQL soft-deletes the duplicates.
  const { data: userRows, error: lookupErr } = await admin
    .from('users')
    .select('id, created_at')
    .eq('phone_hash', stored)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1);
  if (lookupErr) {
    return new Response(JSON.stringify({ error: 'lookup_failed', detail: lookupErr.message }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
  const userRow = userRows?.[0];
  if (!userRow) {
    return new Response(JSON.stringify({ found: false }), {
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }

  const userId = (userRow as { id: string }).id;
  const email = `${userId}@no-email.lore.app`;

  // generateLink emits a hashed_token the client can verify without an
  // email actually being sent. We use type=magiclink because it accepts
  // an existing user's email and returns a token.
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (linkErr || !linkData) {
    return new Response(
      JSON.stringify({ error: 'link_failed', detail: linkErr?.message ?? 'no data' }),
      { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } },
    );
  }

  // The properties shape: { action_link, hashed_token, verification_type,
  // redirect_to, email_otp }. We return `email_otp` (the 6-digit code)
  // rather than `hashed_token`. verifyOtp({type:'magiclink'}) with a
  // hashed_token consistently rejects as "Token has expired or is invalid"
  // — the hashed_token is meant for the action_link redirect flow, not for
  // direct verifyOtp consumption. email_otp + type:'email' is the
  // documented admin-generateLink → client-verify recipe that actually
  // works.
  const emailOtp = linkData.properties?.email_otp ?? null;
  const hashedToken = linkData.properties?.hashed_token ?? null;
  if (!emailOtp && !hashedToken) {
    return new Response(JSON.stringify({ error: 'no_token' }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ found: true, email, emailOtp, hashedToken }), {
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
});
