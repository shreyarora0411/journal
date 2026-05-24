// stamp-phone-hash — stamps the peppered phone_hash for the calling user.
//
// Symmetry with match-contacts is required. Both functions take the
// client-side SHA-256(normalized_phone) and re-hash with
// `PHONE_HASH_PEPPER`. Mismatched peppers = silently broken contact
// matching, which is exactly the bug this function exists to close.
//
// The client posts { client_hash } where client_hash is hex SHA-256 of the
// normalized phone (no pepper, no salt). The function applies the pepper,
// hashes again, and writes the result onto the caller's public.users.row.
//
// Required env:
//   PHONE_HASH_PEPPER          — MUST equal the one match-contacts uses
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  — auto-injected
//   SUPABASE_ANON_KEY          — used for the user-context auth check

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.6';
import { corsHeaders, handlePreflight } from '../_shared/cors.ts';

type Body = { client_hash: string };

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

  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  // Identify the caller via their JWT — use the anon key so this client
  // runs in user context (defense in depth — even though we only read
  // `auth.getUser()` from it).
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? serviceKey;
  const userClient = createClient(supabaseUrl, anonKey, {
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

  const clientHash = typeof body.client_hash === 'string' ? body.client_hash : '';
  if (!/^[0-9a-f]{64}$/.test(clientHash)) {
    return new Response('Invalid client_hash', { status: 400, headers: corsHeaders });
  }

  const stored = hex(await peppered(clientHash, pepper));

  // Service-role write — column-level grants restrict authenticated users
  // from updating phone_hash directly (fix 2). Service role bypasses RLS.
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { error: updateErr } = await admin
    .from('users')
    .update({ phone_hash: stored })
    .eq('id', callerId);

  if (updateErr) {
    return new Response(JSON.stringify({ error: 'update_failed', detail: updateErr.message }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
});
