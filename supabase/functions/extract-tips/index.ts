// extract-tips — Vouched v2, Loop A (Contribute).
//
// A synchronous DRAFT step: takes a friend-facing trip note and returns
// candidate atomic tips for the user to confirm. Saves NOTHING — the client
// shows the review screen, the user accepts/edits/deletes, and only then does
// the client persist the trip + confirmed log_tips (v2 §6: "never publish
// before user confirmation").
//
// Uses Anthropic tool-use with a forced input_schema so the model is REQUIRED
// to return structurally valid tips — extraction reliability is the product's
// make-or-break, so we don't text-parse JSON and hope.
//
// Required env (set in Supabase dashboard, not committed):
//   ANTHROPIC_API_KEY   — Claude API key
//   ANTHROPIC_MODEL     — optional; defaults to claude-sonnet-4-6
//
// Authenticated endpoint — only signed-in users extract. The caller's JWT is
// present; we don't need the user id here (nothing is written), but keeping
// verify_jwt on prevents anonymous abuse of the LLM budget.

import { corsHeaders, handlePreflight } from '../_shared/cors.ts';

const DEFAULT_MODEL = 'claude-sonnet-4-6';

const ADVICE_TYPES = [
  'do',
  'eat_drink',
  'stay',
  'book',
  'ask_contact',
  'shop',
  'skip',
  'avoid',
  'area',
  'other',
] as const;

const SYSTEM_PROMPT = `You read a short travel note one person wrote for their friends, and pull out the atomic, action-shaped tips inside it.

The note is casual — how someone texts a friend who asked "I'm going there, what should I know?" Your job is to surface each separable piece of advice as its own tip, preserving the author's original wording.

A good tip is action-shaped: it contains a verb (stay, book, eat, order, go, walk, ask, message, reserve, skip, avoid) and usually a named place, area, person, dish, route, or timing. Contrasts ("skip X unless Y", "go early not late") are high-signal — keep them intact.

advice_type is the SHAPE of the advice, not a place category:
- stay: where to sleep
- eat_drink: a restaurant, dish, bar, cafe, coffee
- book: something to reserve ahead
- do: an activity, sight, walk, experience
- ask_contact: a person to contact ("ask for Tashi")
- shop: where to buy something
- skip: a thing to deliberately not do
- avoid: a warning
- area: a neighbourhood or zone worth knowing
- other: advice that fits none of the above

Rules:
1. Preserve the author's literal wording in "text" wherever possible. Lightly trim filler, never paraphrase the substance.
2. Extract place_candidate (a named venue/hotel) or area_text (a neighbourhood/town) when the tip references one. Leave both null for placeless tips (skip/avoid/ask_contact often have no formal place).
3. confidence (0-1): how clearly this is a specific, actionable tip. A vague line ("it was nice") is low; "Stay at Banjara, book the tents" is high.
4. Return 0 to 12 tips. If the note has no specific tip, return an EMPTY array — that is valid and expected for vague notes.
5. Do not invent advice the author didn't give.`;

const TOOL = {
  name: 'record_tips',
  description: 'Record the atomic tips extracted from the travel note.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      tips: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            text: { type: 'string', description: "the tip in the author's words" },
            advice_type: { type: 'string', enum: ADVICE_TYPES },
            place_candidate: { type: ['string', 'null'], description: 'named venue/hotel, or null' },
            area_text: { type: ['string', 'null'], description: 'neighbourhood/town, or null' },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
          },
          required: ['text', 'advice_type', 'confidence'],
        },
      },
    },
    required: ['tips'],
  },
};

type Body = { destination_text?: string; original_note?: string };

type Tip = {
  text: string;
  advice_type: string;
  place_candidate?: string | null;
  area_text?: string | null;
  confidence: number;
};

const callAnthropic = async (
  apiKey: string,
  model: string,
  destination: string,
  note: string,
): Promise<Tip[]> => {
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
      tools: [TOOL],
      tool_choice: { type: 'tool', name: 'record_tips' },
      messages: [
        {
          role: 'user',
          content: `Destination: ${destination}\n\nNote:\n${note}`,
        },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`anthropic ${res.status}: ${text.slice(0, 500)}`);
  }
  const json = await res.json();
  const toolUse = (json?.content ?? []).find(
    (b: { type?: string; name?: string }) => b.type === 'tool_use' && b.name === 'record_tips',
  );
  const tips = toolUse?.input?.tips;
  return Array.isArray(tips) ? tips : [];
};

// Defensive clamp: drop anything the model returned that doesn't match the
// shared LogTipDraft contract, even though tool-use should already guarantee it.
const sanitize = (tips: Tip[]): Tip[] =>
  tips
    .filter((t) => typeof t?.text === 'string' && t.text.trim().length > 0)
    .filter((t) => (ADVICE_TYPES as readonly string[]).includes(t.advice_type))
    .map((t) => ({
      text: t.text.trim().slice(0, 500),
      advice_type: t.advice_type,
      place_candidate: t.place_candidate?.trim() || null,
      area_text: t.area_text?.trim() || null,
      confidence: Math.max(0, Math.min(1, Number(t.confidence ?? 0.5))),
    }))
    .slice(0, 12);

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  const model = Deno.env.get('ANTHROPIC_MODEL') ?? DEFAULT_MODEL;
  if (!apiKey) {
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

  const destination = typeof body.destination_text === 'string' ? body.destination_text.trim() : '';
  const note = typeof body.original_note === 'string' ? body.original_note.trim() : '';
  if (!destination || !note) {
    return new Response(JSON.stringify({ error: 'destination_text and original_note required' }), {
      status: 400,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }

  try {
    const raw = await callAnthropic(apiKey, model, destination, note);
    const tips = sanitize(raw);
    return new Response(
      JSON.stringify({ destination_text: destination, original_note: note, tips }),
      { headers: { ...corsHeaders, 'content-type': 'application/json' } },
    );
  } catch (err) {
    // Extraction failure is non-fatal to the product — the client falls back
    // to letting the user save the note with zero tips (the nudge path).
    return new Response(
      JSON.stringify({
        destination_text: destination,
        original_note: note,
        tips: [],
        error: 'extraction_failed',
        detail: String(err).slice(0, 300),
      }),
      { status: 200, headers: { ...corsHeaders, 'content-type': 'application/json' } },
    );
  }
});
