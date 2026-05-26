import { z } from 'zod';
import { UuidSchema, VisibilitySchema } from './index';

export const ListInputSchema = z.object({
  title: z.string().trim().min(1, 'Give it a title').max(80),
  description: z.string().trim().max(500).optional().nullable(),
  visibility: VisibilitySchema.optional().default('friends_of_friends'),
  cover_color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i)
    .optional()
    .nullable(),
});
/** Raw input shape (visibility optional, default applied on parse). */
export type ListInput = z.input<typeof ListInputSchema>;

export const ListSchema = ListInputSchema.extend({
  id: UuidSchema,
  owner_id: UuidSchema,
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable().optional(),
});
export type List = z.infer<typeof ListSchema>;

/** Polymorphic target — `list_item_target` enum on the server side. */
export const ListItemTargetSchema = z.enum(['trip', 'city', 'venue']);
export type ListItemTarget = z.infer<typeof ListItemTargetSchema>;

export const ListItemInputSchema = z
  .object({
    list_id: UuidSchema,
    // Polymorphic target — the canonical path for new writes.
    target_type: ListItemTargetSchema.optional(),
    target_id: UuidSchema.optional(),
    // Legacy direct-FK targets (kept for backward compat with existing
    // list rows; new code should pass target_type + target_id instead).
    destination_id: UuidSchema.optional().nullable(),
    city_id: UuidSchema.optional().nullable(),
    note: z.string().trim().max(500).optional().nullable(),
  })
  .refine(
    (v) => Boolean(v.target_type && v.target_id) || Boolean(v.destination_id) || Boolean(v.city_id),
    { message: 'Pick a target: trip / city / venue or destination_id / city_id.' },
  )
  .refine((v) => Boolean(v.target_type) === Boolean(v.target_id), {
    message: 'target_type and target_id must be set together.',
  });
export type ListItemInput = z.infer<typeof ListItemInputSchema>;

export const WishlistInputSchema = z.object({
  place_id: UuidSchema.optional().nullable(),
  destination_id: UuidSchema.optional().nullable(),
  saved_from_trip_id: UuidSchema.optional().nullable(),
  saved_from_user_id: UuidSchema.optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
});
export type WishlistInput = z.infer<typeof WishlistInputSchema>;
