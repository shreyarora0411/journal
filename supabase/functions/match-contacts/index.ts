// match-contacts — Phase 1.3
//
// The client uploads a list of contact phone numbers it has SHA-256 hashed
// (with a public salt). The server applies a server-side pepper, re-hashes,
// and looks up matches against public.users.phone_hash. We persist matches
// into public.contact_matches and return only the matched user IDs the caller
// is authorised to see (RLS owner-only).
//
// Request:  POST { hashes: string[] }   // hex-encoded SHA-256
// Response: { matched_user_ids: string[] }
//
// Required env (set in Supabase dashboard, not committed):
//   PHONE_HASH_PEPPER          — server-side secret prepended before re-hashing
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  — auto-injected by the Supabase runtime
//
// Note: the client-side hash uses normalize(phone) only. The server pepper
// makes the stored hash unguessable from a leaked client-side hash.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.6';
import { corsHeaders, handlePreflight } from '../_shared/cors.ts';

type Body = { hashes: string[] };

const MAX_HASHES = 5_000;

const peppered = async (clientHashHex: string, pepper: string): Promise<Uint8Array> => {
  const encoder = new TextEncoder();
  const buf = encoder.encode(`${pepper}:${clientHashHex}`);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return new Uint8Array(digest);
};

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

  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  // Identify the caller via their access token.
  const userClient = createClient(supabaseUrl, serviceKey, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }
  const callerId = userData.user.id;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return new Response('Bad JSON', { status: 400, headers: corsHeaders });
  }

  const rawHashes = Array.isArray(body.hashes) ? body.hashes : [];
  const hashes = [...new Set(rawHashes)]
    .filter((h): h is string => typeof h === 'string' && /^[0-9a-f]{64}$/.test(h))
    .slice(0, MAX_HASHES);

  if (hashes.length === 0) {
    return new Response(JSON.stringify({ matched_user_ids: [] }), {
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }

  // Re-hash with the server pepper.
  const peppered_hashes = await Promise.all(hashes.map((h) => peppered(h, pepper)));

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Look up matches. phone_hash is bytea; pass each as \x... escape.
  const hex = (b: Uint8Array) =>
    `\\x${Array.from(b)
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('')}`;
  const candidates = peppered_hashes.map(hex);

  const { data: matchRows, error: matchErr } = await admin
    .from('users')
    .select('id, phone_hash')
    .in('phone_hash', candidates)
    .neq('id', callerId)
    .is('deleted_at', null);

  if (matchErr) {
    return new Response(JSON.stringify({ error: 'lookup_failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }

  const matchedIds = (matchRows ?? []).map((r) => r.id as string);

  if (matchedIds.length > 0) {
    // Persist matches both directions so reads stay one-row.
    const rows = matchedIds.flatMap((other) => [
      { user_id: callerId, matched_user_id: other },
      { user_id: other, matched_user_id: callerId },
    ]);
    await admin.from('contact_matches').upsert(rows, { onConflict: 'user_id,matched_user_id' });
  }

  return new Response(JSON.stringify({ matched_user_ids: matchedIds }), {
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
});
