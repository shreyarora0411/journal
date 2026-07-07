// Export the venue corpus to a CSV for founder axis-fingerprinting.
//
// Reads every canonical_places row with a zone (the going-out corpus; travel
// logs carry zone = null and never enter Go Out) plus category_priors, and
// writes docs/seed/axes-draft.csv with one column per taste axis for the
// founder to fill in (-1..1). The final column renders the category prior as
// a readable DRAFT suggestion — it is never auto-applied; apply-axes.ts only
// reads the five axis columns.
//
// Round-trip safe: a place whose axes are already curated re-exports with its
// current values prefilled, so edit → apply → re-export is lossless.
//
// The axis column order comes from TASTE_AXES (packages/shared/src/taste.ts)
// — imported, not hardcoded, so the CSV can never drift from the engine.
//
// Env (must be set before running):
//   SUPABASE_URL                  Your project URL
//   SUPABASE_SERVICE_ROLE_KEY     The service role key (server-only secret)
//
// Usage (from repo root):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     pnpm tsx scripts/export-axes-draft.ts
//   # fill the axis columns, then apply with scripts/apply-axes.ts

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { TASTE_AXES } from '../packages/shared/src/taste';

const OUT_PATH = join(process.cwd(), 'docs/seed/axes-draft.csv');

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing env. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
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

// Minimal quoted-CSV writer — venue names contain commas and quotes.
const csvField = (v: string): string => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const csvLine = (fields: string[]): string => fields.map(csvField).join(',');

type PlaceRow = {
  google_place_id: string;
  name: string;
  hub: string | null;
  category: string | null;
  axes: number[] | null;
};

type PriorRow = { category: string; axes: number[] };

const main = async () => {
  const { data: places, error: placesError } = await supabase
    .from('canonical_places')
    .select('google_place_id, name, hub, category, axes')
    .not('zone', 'is', null)
    .order('hub')
    .order('name');
  if (placesError) {
    console.error(`Reading canonical_places failed: ${placesError.message}`);
    process.exit(1);
  }

  const { data: priors, error: priorsError } = await supabase
    .from('category_priors')
    .select('category, axes');
  if (priorsError) {
    console.error(`Reading category_priors failed: ${priorsError.message}`);
    process.exit(1);
  }
  const priorByCategory = new Map<string, number[]>();
  for (const prior of (priors ?? []) as PriorRow[]) {
    priorByCategory.set(prior.category, prior.axes);
  }

  const header = [
    'google_place_id',
    'name',
    'hub',
    'category',
    ...TASTE_AXES,
    'suggested_from_category_prior_DRAFT',
  ];

  let prefilled = 0;
  const lines = [csvLine(header)];
  for (const place of (places ?? []) as PlaceRow[]) {
    const curated =
      Array.isArray(place.axes) && place.axes.length === TASTE_AXES.length ? place.axes : null;
    if (curated) prefilled++;
    const prior = place.category ? priorByCategory.get(place.category) : undefined;
    const suggestion = prior
      ? TASTE_AXES.map((axis, i) => `${axis}=${prior[i] ?? 0}`).join('; ')
      : '(no category prior)';
    lines.push(
      csvLine([
        place.google_place_id,
        place.name,
        place.hub ?? '',
        place.category ?? '',
        ...TASTE_AXES.map((_, i) => (curated ? String(curated[i] ?? 0) : '')),
        suggestion,
      ]),
    );
  }

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, `${lines.join('\n')}\n`);
  console.log(`Wrote ${OUT_PATH}`);
  console.log(
    `${(places ?? []).length} places exported (${prefilled} with curated axes prefilled).`,
  );
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
