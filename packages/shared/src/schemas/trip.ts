import { z } from 'zod';
import { UuidSchema, VisibilitySchema } from './index';

export const VenueKindSchema = z.enum(['stay', 'restaurant', 'cafe', 'nightlife', 'other']);
export type VenueKind = z.infer<typeof VenueKindSchema>;

export const TipParentSchema = z.enum(['trip', 'place']);
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

// ---- Place ---------------------------------------------------------------

export const PlaceInputSchema = z.object({
  name: trimmed(120).min(1, 'Place needs a name'),
  region: trimmed(120).optional().nullable(),
  country: trimmed(80).optional().nullable(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  note: z.string().trim().max(10_000).optional().nullable(),
  arrival_date: dateString,
  position: z.number().int().min(0).default(0),
});
export type PlaceInput = z.infer<typeof PlaceInputSchema>;

export const PlaceSchema = PlaceInputSchema.extend({
  id: UuidSchema,
  trip_id: UuidSchema,
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable().optional(),
});
export type Place = z.infer<typeof PlaceSchema>;

// ---- Venue ---------------------------------------------------------------

export const VenueInputSchema = z.object({
  place_id: UuidSchema,
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
  place_id: UuidSchema,
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

export const TipInputSchema = z.object({
  parent_type: TipParentSchema,
  parent_id: UuidSchema,
  body: trimmed(2_000).min(1),
  kind: TipKindSchema,
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
  place_id: UuidSchema.nullable().optional(),
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

// Quick-mode form is a single trip + a single place; Detailed adds more.
export const QuickLogFormSchema = z.object({
  title: trimmed(120).min(1, 'Give it a title'),
  start_date: dateString,
  end_date: dateString,
  place_name: trimmed(120).min(1, 'Where did you go?'),
  note: z.string().trim().max(20_000).optional(),
  visibility: VisibilitySchema.default('friends_of_friends'),
});
export type QuickLogForm = z.infer<typeof QuickLogFormSchema>;
