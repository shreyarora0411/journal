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

export const ListItemInputSchema = z.object({
  destination_id: UuidSchema.optional().nullable(),
  place_id: UuidSchema.optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
  order_index: z.number().int().nonnegative().default(0),
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
