// extract-entities — Phase 2.4
//
// Triggered by the client after a trip save. Reads the trip + its places
// (using service role), calls Anthropic Claude Sonnet, and writes a row per
// proposed entity into public.extracted_entities for the user to confirm.
//
// Required env (set in Supabase dashboard, not committed):
//   ANTHROPIC_API_KEY          — Claude API key
//   ANTHROPIC_MODEL            — optional override; defaults to claude-sonnet-4-6
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — auto-injected by the runtime

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.6';
import { corsHeaders, handlePreflight } from '../_shared/cors.ts';

const PROMPT_VERSION = 'v0';
const SYSTEM_PROMPT = `You read travel notes written by one person for their friends, and extract the structured entities they recommend.

The author writes casually. Your job is to surface what they would tell a friend who asked for tips, not to summarise the whole note.

Output a JSON object with a single key "entities" — an array. Each entity has:
- "kind": one of "venue" | "area" | "tip"
- "name": short string. For venues, the venue's name. For areas, the neighbourhood. For tips, a one-line piece of advice (e.g. "Fly into KTM, not Pokhara").
- "quote": the author's exact words about this thing — verbatim, never paraphrased. If the author didn't say anything quotable about it, omit this field.
- "metadata": an object. For venues, include "kind": one of "stay" | "restaurant" | "cafe" | "nightlife" | "other". For tips, include "tip_kind": "macro" (trip-level — applies broadly) or "atomic" (place-specific).

Rules:
1. Only extract things the author actually recommends or names. Don't invent.
2. Quotes must be the author's literal words. If you have to paraphrase to make it readable, leave the quote out.
3. Aim for between 0 and 12 entities per note. If the note is short or vague, return fewer or none — empty array is valid.
4. Don't extract the place itself (e.g. "Pokhara") — that's already captured separately.
5. Output valid JSON. No markdown fences, no prose outside the JSON.`;

type Body = { trip_id: string };

type Proposal = {
  kind: 'venue' | 'area' | 'tip';
  name?: string;
  quote?: string;
  metadata?: Record<string, unknown>;
};

const callAnthropic = async (apiKey: string, model: string, userText: string) => {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userText }],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`anthropic ${res.status}: ${text.slice(0, 500)}`);
  }
  const json = await res.json();
  const text: string = json?.content?.[0]?.text ?? '';
  return { text, raw: json };
};

const safeParse = (text: string): { entities: Proposal[] } => {
  try {
    const parsed = JSON.parse(text);
    if (parsed && Array.isArray(parsed.entities)) return parsed;
  } catch {
    // Fall through.
  }
  // Try to find the first JSON object even if the model added stray text.
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(text.slice(start, end + 1));
      if (parsed && Array.isArray(parsed.entities)) return parsed;
    } catch {
      /* noop */
    }
  }
  return { entities: [] };
};

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  const model = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-6';

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'server_misconfigured' }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }

  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

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
  const tripId = body.trip_id;
  if (!tripId || typeof tripId !== 'string') {
    return new Response('trip_id required', { status: 400, headers: corsHeaders });
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Authorize: caller must own the trip.
  const { data: trip, error: tripErr } = await admin
    .from('trips')
    .select('id, user_id, title, start_date, end_date, note')
    .eq('id', tripId)
    .maybeSingle();
  if (tripErr || !trip || trip.user_id !== callerId) {
    return new Response('Forbidden', { status: 403, headers: corsHeaders });
  }

  // Pull places to give the model context.
  const { data: places } = await admin
    .from('places')
    .select('name, region, country, note')
    .eq('trip_id', tripId)
    .is('deleted_at', null);

  const inputText = [
    `Title: ${trip.title}`,
    trip.start_date
      ? `Dates: ${trip.start_date}${trip.end_date ? ` to ${trip.end_date}` : ''}`
      : '',
    places && places.length > 0 ? `Places: ${places.map((p) => p.name).join(', ')}` : '',
    '',
    'Note:',
    trip.note ?? '(no prose note)',
    ...(places ?? []).filter((p) => p.note).map((p) => `\nNote on ${p.name}:\n${p.note}`),
  ]
    .filter(Boolean)
    .join('\n');

  let parsed: { entities: Proposal[] } = { entities: [] };
  let rawOutput: unknown = null;
  let errorMsg: string | null = null;

  if (apiKey) {
    try {
      const { text, raw } = await callAnthropic(apiKey, model, inputText);
      rawOutput = raw;
      parsed = safeParse(text);
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : String(e);
    }
  } else {
    errorMsg = 'ANTHROPIC_API_KEY not set';
  }

  const { data: run, error: runErr } = await admin
    .from('extraction_runs')
    .insert({
      trip_id: tripId,
      model,
      prompt_version: PROMPT_VERSION,
      input_text: inputText,
      raw_output: rawOutput,
      error: errorMsg,
    })
    .select('id')
    .single();
  if (runErr) {
    return new Response(JSON.stringify({ error: 'run_insert_failed', detail: runErr.message }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }

  const validKinds = new Set(['venue', 'area', 'tip']);
  const rows = parsed.entities
    .filter(
      (e): e is Proposal & { name: string } =>
        Boolean(e?.kind) &&
        validKinds.has(e.kind) &&
        typeof e.name === 'string' &&
        e.name.length > 0,
    )
    .slice(0, 24)
    .map((e) => ({
      extraction_run_id: (run as { id: string }).id,
      trip_id: tripId,
      kind: e.kind,
      proposed_name: e.name.slice(0, 120),
      proposed_quote: e.quote ? e.quote.slice(0, 2000) : null,
      proposed_metadata: e.metadata ?? {},
    }));

  if (rows.length > 0) {
    await admin.from('extracted_entities').insert(rows);
  }

  return new Response(
    JSON.stringify({
      run_id: (run as { id: string }).id,
      proposed_count: rows.length,
      error: errorMsg,
    }),
    { headers: { ...corsHeaders, 'content-type': 'application/json' } },
  );
});
