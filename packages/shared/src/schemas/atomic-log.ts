import { z } from 'zod';
import { UuidSchema, VisibilitySchema } from './index';

/**
 * Atomic-log schemas. An atomic log is a single venue-level
 * recommendation captured from the Tip path on the log screen. It
 * carries a category, a one-line distilled sentence, optional
 * prose, and an optional trip attachment.
 *
 * Server contract:
 *   1. Client calls resolve_google_place RPC with the Places pick →
 *      returns (resolved_kind, country_id, city_id, area_id).
 *   2. Client calls insert_atomic_log RPC with city_id + content →
 *      returns the new venue uuid.
 *   3. Client writes the verdict via the existing verdicts hook.
 *   4. If the user picked one or more lists, the polymorphic
 *      list_items inserts happen with target_type='venue'.
 */

// `do` and `nightlife` were added to make active experiences and
// late-night venues first-class. Keep the existing five so old rows
// still parse. Any DB-side migration (check constraint, RPC validate)
// must extend in lockstep.
export const CategorySchema = z.enum([
  'stay',
  'food',
  'drinks',
  'wander',
  'buy',
  'do',
  'nightlife',
]);
export type Category = z.infer<typeof CategorySchema>;

/** The form state captured by AtomicLogForm before submit. */
export const AtomicLogFormSchema = z.object({
  // ---- Place selection (from the Google Places picker) ----
  google_place_id: z.string().min(1, 'Pick a place first.'),
  name: z.string().min(1).max(200),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  place_types: z.array(z.string()),

  // Country / parent locality context — extracted from Google's
  // addressComponents at pick time so the server can resolve the
  // hierarchy without a second round-trip.
  country_iso2: z.string().length(2).nullable().optional(),
  country_name: z.string().nullable().optional(),
  parent_locality_name: z.string().nullable().optional(),
  parent_locality_place_id: z.string().nullable().optional(),

  // ---- Atomic content ----
  category: CategorySchema,
  one_line: z.string().trim().min(1, 'The one line is required').max(280, 'Keep it to one breath.'),
  prose: z.string().trim().max(10_000).optional().nullable(),

  // ---- Optional trip attachment (manual; default standalone) ----
  trip_id: UuidSchema.nullable().optional(),

  // Verdict (love / mid / skip) is captured via a separate mutation
  // on the verdicts table after the venue id is known.

  visibility: VisibilitySchema.default('friends_of_friends'),
});

export type AtomicLogForm = z.infer<typeof AtomicLogFormSchema>;
