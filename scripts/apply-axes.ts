// Apply founder-edited axis fingerprints from docs/seed/axes-draft.csv
// (written by scripts/export-axes-draft.ts) to canonical_places.axes.
//
// EFFECT IS IMMEDIATE: place_axes() (migration 65) prefers a per-place
// canonical_places.axes vector over the category prior the moment it is set,
// so taste_match / recommend_places start computing real numbers for these
// places as soon as this runs — no backfill or refresh step.
//
// Keyed on google_place_id, never name (names are display data; the id is
// the identity). Per row: all five axis cells empty → skipped silently;
// some-but-not-all filled → hard error naming the row (all-5-or-none);
// every value must parse as a number in [-1, 1]. The
// suggested_from_category_prior_DRAFT column is ignored — it is a
// suggestion for the founder's eyes, never applied.
//
// DRY-RUN BY DEFAULT — prints the update plan. Pass --apply to execute.
//
// Env (must be set before running):
//   SUPABASE_URL                  Your project URL
//   SUPABASE_SERVICE_ROLE_KEY     The service role key (server-only secret)
//
// Usage (from repo root):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     pnpm tsx scripts/apply-axes.ts                    # review the plan
//     pnpm tsx scripts/apply-axes.ts --apply            # execute
//     pnpm tsx scripts/apply-axes.ts --path other.csv   # non-default CSV

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { TASTE_AXES } from '../packages/shared/src/taste';

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

const CSV_PATH = opts.get('path') ?? join(process.cwd(), 'docs/seed/axes-draft.csv');

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

// Minimal quoted-CSV parser (no embedded newlines — the export never writes
// them). Handles commas and doubled quotes inside quoted fields, which venue
// names do contain.
const parseCsvLine = (line: string): string[] => {
  const out: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line.charAt(i);
    if (inQuotes) {
      if (ch === '"') {
        if (line.charAt(i + 1) === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out;
};

type Update = { googlePlaceId: string; name: string; axes: number[] };

const axesEqual = (a: number[] | null, b: number[]): boolean =>
  a != null && a.length === b.length && a.every((v, i) => v === b[i]);

const formatAxes = (axes: number[] | null): string =>
  axes ? `[${axes.join(', ')}]` : '(none — category prior applies)';

const main = async () => {
  const rawLines = readFileSync(CSV_PATH, 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '');
  const headerLine = rawLines.shift();
  if (!headerLine) {
    console.error(`${CSV_PATH} is empty.`);
    process.exit(1);
  }

  // The header must carry the axes in TASTE_AXES order — a mismatch means
  // the CSV predates an engine change and the columns can't be trusted.
  const header = parseCsvLine(headerLine);
  const expectedPrefix = ['google_place_id', 'name', 'hub', 'category', ...TASTE_AXES];
  for (const [i, expected] of expectedPrefix.entries()) {
    if (header[i] !== expected) {
      console.error(
        `Header mismatch at column ${i + 1}: expected "${expected}", got "${header[i] ?? ''}". Re-export with scripts/export-axes-draft.ts.`,
      );
      process.exit(1);
    }
  }

  const updates: Update[] = [];
  let skipped = 0;
  for (const [idx, line] of rawLines.entries()) {
    const cells = parseCsvLine(line);
    const rowNo = idx + 2; // 1-based, counting the header
    const googlePlaceId = (cells[0] ?? '').trim();
    const name = (cells[1] ?? '').trim();
    if (!googlePlaceId) {
      console.error(`Row ${rowNo}: missing google_place_id.`);
      process.exit(1);
    }
    const axisCells = TASTE_AXES.map((_, i) => (cells[4 + i] ?? '').trim());
    const filledCount = axisCells.filter((c) => c !== '').length;
    if (filledCount === 0) {
      skipped++;
      continue;
    }
    if (filledCount < TASTE_AXES.length) {
      console.error(
        `Row ${rowNo} (${name || googlePlaceId}): only ${filledCount}/${TASTE_AXES.length} axis cells filled — fill all five or none.`,
      );
      process.exit(1);
    }
    const axes = axisCells.map((cell, i) => {
      const value = Number(cell);
      if (!Number.isFinite(value) || value < -1 || value > 1) {
        console.error(
          `Row ${rowNo} (${name || googlePlaceId}): ${TASTE_AXES[i]} = "${cell}" is not a number in [-1, 1].`,
        );
        process.exit(1);
      }
      return value;
    });
    updates.push({ googlePlaceId, name, axes });
  }

  // Fetch current axes so the plan shows old → new, and so a stale CSV row
  // (place no longer in the DB) aborts instead of silently doing nothing.
  const current = new Map<string, { name: string; axes: number[] | null }>();
  for (let i = 0; i < updates.length; i += 200) {
    const chunk = updates.slice(i, i + 200);
    const { data, error } = await supabase
      .from('canonical_places')
      .select('google_place_id, name, axes')
      .in(
        'google_place_id',
        chunk.map((u) => u.googlePlaceId),
      );
    if (error) {
      console.error(`Reading canonical_places failed: ${error.message}`);
      process.exit(1);
    }
    for (const row of (data ?? []) as {
      google_place_id: string;
      name: string;
      axes: number[] | null;
    }[]) {
      current.set(row.google_place_id, { name: row.name, axes: row.axes });
    }
  }
  const missing = updates.filter((u) => !current.has(u.googlePlaceId));
  if (missing.length > 0) {
    console.error('These CSV rows match no canonical_places row — stale file? Re-export first:');
    for (const m of missing) console.error(`  ✗ ${m.name} (${m.googlePlaceId})`);
    process.exit(1);
  }

  let unchanged = 0;
  const toWrite = updates.filter((u) => {
    if (axesEqual(current.get(u.googlePlaceId)?.axes ?? null, u.axes)) {
      unchanged++;
      return false;
    }
    return true;
  });

  console.log(`Update plan (${toWrite.length} place${toWrite.length === 1 ? '' : 's'}):`);
  for (const u of toWrite) {
    console.log(
      `  ${u.name}: ${formatAxes(current.get(u.googlePlaceId)?.axes ?? null)} → ${formatAxes(u.axes)}`,
    );
  }
  console.log(
    `\nTotals: update ${toWrite.length}, unchanged ${unchanged}, skipped (axes empty) ${skipped}.`,
  );

  if (!flags.has('apply') && !opts.has('apply')) {
    console.log('DRY RUN — nothing written. Re-run with --apply to execute.');
    return;
  }

  for (const u of toWrite) {
    const { error } = await supabase
      .from('canonical_places')
      .update({ axes: u.axes, updated_at: new Date().toISOString() })
      .eq('google_place_id', u.googlePlaceId);
    if (error) {
      console.error(`Update failed for ${u.name} (${u.googlePlaceId}): ${error.message}`);
      process.exit(1);
    }
    console.log(`  ✓ ${u.name}`);
  }
  console.log(`\nApplied: updated ${toWrite.length}, unchanged ${unchanged}, skipped ${skipped}.`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
