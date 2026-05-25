// Add a single curated destination row.
//
// Usage:
//   pnpm tsx scripts/add-curated-destination.ts \
//     --place-id ChIJ... \
//     --name "Lisbon" \
//     --country "Portugal" \
//     --photo-url "https://..." \
//     --photographer "Saul Leiter" \
//     --photographer-url "https://..."
//
// `--place-id` is optional but strongly preferred — without it the row
// can only be matched by name + country, which is fragile.
//
// Env (must be set before running):
//   SUPABASE_URL                  Your project URL
//   SUPABASE_SERVICE_ROLE_KEY     The service role key (server-only secret)
//
// Run from repo root, after migration 15 is applied:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     pnpm tsx scripts/add-curated-destination.ts --name "Lisbon" ...

import { createClient } from '@supabase/supabase-js';

const args = Object.fromEntries(
  process.argv.slice(2).reduce<[string, string][]>((acc, arg, i, arr) => {
    if (arg.startsWith('--')) acc.push([arg.slice(2), arr[i + 1] ?? '']);
    return acc;
  }, []),
);

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing env. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const name = (args.name ?? '').trim();
const photoUrl = (args['photo-url'] ?? '').trim();
if (!name || !photoUrl) {
  console.error('--name and --photo-url are required.');
  console.error(
    'Example: pnpm tsx scripts/add-curated-destination.ts --name "Lisbon" --country "Portugal" --photo-url "https://..." --place-id "ChIJ..."',
  );
  process.exit(1);
}

const row = {
  google_place_id: args['place-id']?.trim() || null,
  normalized_name: name.toLowerCase(),
  country: args.country?.trim() || null,
  display_name: name,
  photo_url: photoUrl,
  photo_credit: args.photographer ? `Photo by ${args.photographer}` : null,
  photographer_name: args.photographer?.trim() || null,
  photographer_url: args['photographer-url']?.trim() || null,
};

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

const main = async () => {
  const { error } = await supabase.from('curated_destinations').insert(row);
  if (error) {
    console.error(`Insert failed: ${error.message}`);
    process.exit(1);
  }
  console.log(`✓ Added curated destination: ${row.display_name}`);
  if (!row.google_place_id) {
    console.warn('  (no place_id — row will be matched by name+country only)');
  }
};

void main();
