// recover-session — phone-hash lookup for the returning-user path.
//
// SECURITY (2026-07-05 fix): this endpoint is public and unauthenticated by
// necessity — a device with no session yet needs to ask "does this phone
// belong to an existing account?" before one exists. It previously answered
// that question by minting a Supabase magic-link token and returning the
// redeemable email_otp/hashed_token DIRECTLY IN THE RESPONSE BODY. Since the
// client computes client_hash as an UNPEPPERED sha256(phone) — the pepper is
// applied server-side only — anyone who knew a user's phone number could
// reproduce the same hash, POST here, and receive a token that signed them
// in AS that user. This was a live account-takeover vector.
//
// There is currently no real OTP delivery channel wired (no SMS/WhatsApp
// provider — see supabase/config.toml's auth.sms.twilio block, unconfigured;
// the account's synthetic email `<id>@no-email.lore.app` cannot receive
// mail). Until one exists, this function no longer returns anything
// redeemable: it answers {found: boolean} ONLY. A known phone with no
// self-serve delivery channel means recovery is human-mediated for now
// (the inviter/founder helps out-of-band) rather than instant self-serve —
// see use-start-session.ts's handling of found:true.
//
// TODO(next session with SMS/WhatsApp OTP provider credentials): once a
// provider is wired, re-introduce automatic delivery by sending the OTP TO
// the phone number on file (not returning it to the caller) and have the
// client collect it via a code-entry screen.
//
// Flow:
//   1. Client hashes the entered phone (no pepper) and POSTs it here.
//   2. We apply the server pepper, look up public.users.phone_hash.
//   3. We return {found: boolean} only. No token, no email, ever.
//
// Required env:
//   PHONE_HASH_PEPPER          — MUST equal stamp-phone-hash + match-contacts
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  — auto-injected

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
  // canonical original account; later duplicates are abandoned.
  const { data: userRows, error: lookupErr } = await admin
    .from('users')
    .select('id')
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

  // Answer ONLY whether the phone is known — never a redeemable token.
  return new Response(JSON.stringify({ found: Boolean(userRows?.[0]) }), {
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
});
