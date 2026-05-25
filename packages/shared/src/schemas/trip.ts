import { z } from 'zod';
import { UuidSchema, VisibilitySchema } from './index';

export const VenueKindSchema = z.enum(['stay', 'restaurant', 'cafe', 'nightlife', 'other']);
export type VenueKind = z.infer<typeof VenueKindSchema>;

// Session: geographic hierarchy refactor — the polymorphic tip parent
// flipped from 'place' to 'city' alongside the migration 21 enum rename.
export const TipParentSchema = z.enum(['trip', 'city']);
export type TipParent = z.infer<typeof TipParentSchema>;

export const TipKindSchema = z.enum(['macro', 'atomic']);
export type TipKind = z.infer<typeof TipKindSchema>;

export const EntityKindSchema = z.enum(['venue', 'area', 'tip']);
export type EntityKind = z.infer<typeof EntityKindSchema>;

export const ImportedFromSchema = z.enum(['instagram']);

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
  .optional()
  .nullable();

const trimmed = (max: number) => z.string().trim().max(max);

// ---- Country -------------------------------------------------------------

export const CountrySchema = z.object({
  id: UuidSchema,
  iso_alpha2: z.string().length(2),
  iso_alpha3: z.string().length(3),
  display_name: z.string(),
  flag_emoji: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  hero_photo_url: z.string().url().nullable().optional(),
  hero_photo_credit: z.string().nullable().optional(),
});
export type Country = z.infer<typeof CountrySchema>;

// ---- Trip ----------------------------------------------------------------

export const TripInputSchema = z.object({
  title: trimmed(120).min(1, 'Give it a title'),
  start_date: dateString,
  end_date: dateString,
  note: z.string().trim().max(20_000).optional().nullable(),
  visibility: VisibilitySchema.default('friends_of_friends'),
});
export type TripInput = z.infer<typeof TripInputSchema>;

export const TripSchema = TripInputSchema.extend({
  id: UuidSchema,
  user_id: UuidSchema,
  cover_photo_id: UuidSchema.nullable().optional(),
  imported_from: ImportedFromSchema.nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable().optional(),
});
export type Trip = z.infer<typeof TripSchema>;

// ---- City (formerly Place) ----------------------------------------------
// One per trip-row. country_id is the FK into public.countries (canonical
// ISO-coded country). Legacy free-text country was dropped in migration 23.

export const CityInputSchema = z.object({
  name: trimmed(120).min(1, 'City needs a name'),
  region: trimmed(120).optional().nullable(),
  country_id: UuidSchema.optional().nullable(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  note: z.string().trim().max(10_000).optional().nullable(),
  arrival_date: dateString,
  position: z.number().int().min(0).default(0),
  // Session 1 (revised) — place identity. Populated when the user picks
  // a result from the Google Places autocomplete; null for free-text
  // submissions that don't match.
  google_place_id: z.string().min(1).max(255).optional().nullable(),
  place_types: z.array(z.string()).optional().nullable(),
});
export type CityInput = z.infer<typeof CityInputSchema>;

export const CitySchema = CityInputSchema.extend({
  id: UuidSchema,
  trip_id: UuidSchema,
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable().optional(),
});
export type City = z.infer<typeof CitySchema>;

// ---- Venue ---------------------------------------------------------------

export const VenueInputSchema = z.object({
  city_id: UuidSchema,
  area_id: UuidSchema.nullable().optional(),
  name: trimmed(120).min(1),
  kind: VenueKindSchema,
  quote: z.string().trim().max(2_000).optional().nullable(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  external_id: trimmed(200).optional().nullable(),
});
export type VenueInput = z.infer<typeof VenueInputSchema>;

export const VenueSchema = VenueInputSchema.extend({
  id: UuidSchema,
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable().optional(),
});
export type Venue = z.infer<typeof VenueSchema>;

// ---- Area ----------------------------------------------------------------

export const AreaInputSchema = z.object({
  city_id: UuidSchema,
  name: trimmed(120).min(1),
  quote: z.string().trim().max(2_000).optional().nullable(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
});
export type AreaInput = z.infer<typeof AreaInputSchema>;

export const AreaSchema = AreaInputSchema.extend({
  id: UuidSchema,
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable().optional(),
});
export type Area = z.infer<typeof AreaSchema>;

// ---- Tip -----------------------------------------------------------------

/**
 * Verdict (love/mid/skip) — see ADR 0010. Captured on the logger's Log
 * screen, surfaced only on their own profile. Three buckets only — no
 * stars, no 5-point scales.
 */
export const VerdictSchema = z.enum(['love', 'mid', 'skip']);
export type Verdict = z.infer<typeof VerdictSchema>;

export const TipInputSchema = z.object({
  parent_type: TipParentSchema,
  parent_id: UuidSchema,
  body: trimmed(2_000).min(1),
  kind: TipKindSchema,
  verdict: VerdictSchema.nullable().optional(),
});
export type TipInput = z.infer<typeof TipInputSchema>;

export const TipSchema = TipInputSchema.extend({
  id: UuidSchema,
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable().optional(),
});
export type Tip = z.infer<typeof TipSchema>;

// ---- Trip photo ----------------------------------------------------------

export const TripPhotoSchema = z.object({
  id: UuidSchema,
  trip_id: UuidSchema,
  city_id: UuidSchema.nullable().optional(),
  storage_path: z.string(),
  width: z.number().int().nullable().optional(),
  height: z.number().int().nullable().optional(),
  taken_at: z.string().nullable().optional(),
  position: z.number().int(),
  created_at: z.string(),
  deleted_at: z.string().nullable().optional(),
});
export type TripPhoto = z.infer<typeof TripPhotoSchema>;

// ---- Extracted entity (staged extraction output) -------------------------

export const ExtractedEntitySchema = z.object({
  id: UuidSchema,
  extraction_run_id: UuidSchema,
  trip_id: UuidSchema,
  kind: EntityKindSchema,
  proposed_name: z.string(),
  proposed_quote: z.string().nullable().optional(),
  proposed_metadata: z.record(z.unknown()),
  confirmed: z.boolean(),
  rejected: z.boolean(),
  confirmed_entity_id: UuidSchema.nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ExtractedEntity = z.infer<typeof ExtractedEntitySchema>;

// Quick-mode form is a single trip + a single city; Detailed adds more.
export const QuickLogFormSchema = z.object({
  title: trimmed(120).min(1, 'Give it a title'),
  start_date: dateString,
  end_date: dateString,
  city_name: trimmed(120).min(1, 'Where did you go?'),
  note: z.string().trim().max(20_000).optional(),
  visibility: VisibilitySchema.default('friends_of_friends'),
  // Session 1 (revised) + geographic hierarchy: when the user picks a
  // Google Places autocomplete result, these identify the city + its
  // canonical country for the hero-photo resolver and aggregations.
  // Free-text submissions leave them null.
  city_country_id: UuidSchema.optional().nullable(),
  city_region: trimmed(120).optional().nullable(),
  city_lat: z.number().min(-90).max(90).optional().nullable(),
  city_lng: z.number().min(-180).max(180).optional().nullable(),
  city_google_place_id: z.string().min(1).max(255).optional().nullable(),
  city_types: z.array(z.string()).optional().nullable(),
});
export type QuickLogForm = z.infer<typeof QuickLogFormSchema>;
