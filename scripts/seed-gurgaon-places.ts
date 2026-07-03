// Resolve the Gurgaon seed venues against the Google Places API and emit
// reviewable SQL — the honest path from a hand-drafted list to the DB.
//
// Every CSV row is verified via Places Text Search (New) before any SQL is
// generated: rows that don't resolve (or resolve outside Haryana/Delhi NCR)
// are FLAGGED and excluded, so a drafted-from-memory venue can never enter the
// database unverified. Nothing touches the DB here — output is a SQL file you
// review, then apply with the other migrations at deploy time.
//
// Usage (from repo root):
//   GOOGLE_PLACES_KEY=... pnpm tsx scripts/seed-gurgaon-places.ts
//   # reads  docs/seed/gurgaon-venues.csv
//   # writes supabase/seed/gurgaon-places.generated.sql
//
// The key needs Places API (New) enabled (same key as apps/mobile/.env
// EXPO_PUBLIC_GOOGLE_PLACES_KEY_DEV works).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const CSV_PATH = join(process.cwd(), 'docs/seed/gurgaon-venues.csv');
const OUT_PATH = join(process.cwd(), 'supabase/seed/gurgaon-places.generated.sql');

const KEY = process.env.GOOGLE_PLACES_KEY ?? process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY_DEV;
if (!KEY) {
  console.error('Set GOOGLE_PLACES_KEY (Places API New enabled).');
  process.exit(1);
}

const VALID_CATEGORIES = new Set([
  'restaurant',
  'fine_dining',
  'cafe',
  'bakery_dessert',
  'street_food',
  'bar',
  'cocktail_bar',
  'brewery',
  'club',
  'live_music',
]);
const VALID_HUBS = new Set([
  '32nd_ave',
  'cyberhub',
  'gcr',
  'gc_ext',
  'm3m_ifc',
  'worldmark_65',
  'sector_29',
  'galleria',
  'crosspoint',
  'south_point',
  'mg_road',
  'kitchens',
  'sohna_road',
  'sector_68_airia',
  'udyog_vihar',
]);

type Row = { name: string; hub: string; zone: string; category: string; query: string };

// Minimal CSV parse — the file is ours: no embedded commas outside the quoted
// final column.
const parseCsv = (raw: string): Row[] =>
  raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('name,'))
    .map((line) => {
      const m = line.match(/^([^,]+),([^,]+),([^,]+),([^,]+),"?([^"]*)"?$/);
      if (!m) throw new Error(`Unparseable CSV line: ${line}`);
      const [, name, hub, zone, category, query] = m;
      if (!VALID_CATEGORIES.has(category ?? ''))
        throw new Error(`Unknown category "${category}" for ${name}`);
      if (zone === 'gurgaon' && !VALID_HUBS.has(hub ?? ''))
        throw new Error(`Unknown gurgaon hub "${hub}" for ${name}`);
      return {
        name: name ?? '',
        hub: hub ?? '',
        zone: zone ?? '',
        category: category ?? '',
        query: query ?? '',
      };
    });

type Resolved = {
  row: Row;
  googlePlaceId: string;
  resolvedName: string;
  lat: number;
  lng: number;
  formattedAddress: string;
};

const searchText = async (query: string) => {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.formattedAddress',
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 1 }),
  });
  if (!res.ok) throw new Error(`Places API ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as {
    places?: {
      id: string;
      displayName?: { text?: string };
      location?: { latitude?: number; longitude?: number };
      formattedAddress?: string;
    }[];
  };
  return json.places?.[0] ?? null;
};

const sqlQuote = (s: string) => `'${s.replace(/'/g, "''")}'`;

const main = async () => {
  const rows = parseCsv(readFileSync(CSV_PATH, 'utf8'));
  console.log(`Resolving ${rows.length} venues against Places API…`);

  const resolved: Resolved[] = [];
  const flagged: { row: Row; reason: string }[] = [];

  for (const row of rows) {
    try {
      const hit = await searchText(row.query);
      if (!hit?.id || hit.location?.latitude == null || hit.location?.longitude == null) {
        flagged.push({ row, reason: 'no Places result' });
        continue;
      }
      const addr = hit.formattedAddress ?? '';
      // Sanity: the resolved place must sit in NCR (Haryana for gurgaon rows).
      const inNcr = /haryana|gurugram|gurgaon|delhi/i.test(addr);
      if (!inNcr) {
        flagged.push({ row, reason: `resolved outside NCR: ${addr}` });
        continue;
      }
      resolved.push({
        row,
        googlePlaceId: hit.id,
        resolvedName: hit.displayName?.text ?? row.name,
        lat: hit.location.latitude,
        lng: hit.location.longitude,
        formattedAddress: addr,
      });
      console.log(`  ✓ ${row.name} → ${hit.id}`);
    } catch (err) {
      flagged.push({ row, reason: String(err) });
    }
    // Gentle rate limit.
    await new Promise((r) => setTimeout(r, 150));
  }

  // Duplicate-ID guard: if two CSV rows resolved to the SAME place, Google
  // fuzzy-matched a drafted-from-memory venue onto a nearby real one. We can't
  // tell which row is genuine — flag ALL of them for founder review rather
  // than silently writing a wrongly-named row.
  const byId = new Map<string, Resolved[]>();
  for (const r of resolved) {
    const arr = byId.get(r.googlePlaceId) ?? [];
    arr.push(r);
    byId.set(r.googlePlaceId, arr);
  }
  const clean: Resolved[] = [];
  for (const group of byId.values()) {
    if (group.length === 1 && group[0]) {
      clean.push(group[0]);
    } else {
      for (const g of group) {
        flagged.push({
          row: g.row,
          reason: `duplicate resolution — ${group.map((x) => x.row.name).join(' / ')} all matched ${g.googlePlaceId} (${g.resolvedName}); verify which is real`,
        });
      }
    }
  }
  resolved.length = 0;
  resolved.push(...clean);

  const lines: string[] = [
    '-- GENERATED by scripts/seed-gurgaon-places.ts — review before applying.',
    `-- Source: docs/seed/gurgaon-venues.csv · resolved ${resolved.length}/${rows.length} via Places API.`,
    '-- Curated category/hub/zone are authoritative here (overwrite on conflict):',
    '-- this is the founder seed, which find_or_create_place defers to.',
    '',
  ];
  for (const r of resolved) {
    lines.push(
      'insert into public.canonical_places (google_place_id, name, destination_text, lat, lng, category, hub, zone)',
      `values (${sqlQuote(r.googlePlaceId)}, ${sqlQuote(r.resolvedName)}, ${sqlQuote(
        r.row.zone === 'gurgaon' ? 'Gurgaon' : 'Delhi',
      )}, ${r.lat}, ${r.lng}, ${sqlQuote(r.row.category)}, ${sqlQuote(r.row.hub)}, ${sqlQuote(r.row.zone)})`,
      'on conflict (google_place_id) do update set',
      '  name = excluded.name, lat = excluded.lat, lng = excluded.lng,',
      '  category = excluded.category, hub = excluded.hub, zone = excluded.zone,',
      '  updated_at = now();',
      '',
    );
  }
  if (flagged.length > 0) {
    lines.push('-- FLAGGED (excluded — fix the CSV row and re-run):');
    for (const f of flagged) lines.push(`--   ${f.row.name}: ${f.reason}`);
  }

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, lines.join('\n'));
  console.log(`\nWrote ${OUT_PATH}`);
  console.log(`Resolved ${resolved.length}, flagged ${flagged.length}.`);
  if (flagged.length > 0) {
    console.log('Flagged rows:');
    for (const f of flagged) console.log(`  ✗ ${f.row.name} — ${f.reason}`);
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
