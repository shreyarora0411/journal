import { z } from 'zod';
import { isLikelyValidPhone, normalizePhone } from '../phone';

export const VisibilitySchema = z.enum(['followers', 'friends_of_friends', 'everyone']);
export type Visibility = z.infer<typeof VisibilitySchema>;

export const HandleSchema = z
  .string()
  .min(3)
  .max(24)
  .regex(/^[a-z0-9_]+$/, 'lowercase letters, digits, and underscore only');

export const UuidSchema = z.string().uuid();

export const PhoneSchema = z
  .string()
  .transform((v) => normalizePhone(v))
  .refine((v) => isLikelyValidPhone(v), { message: 'Enter a valid international phone number' });

export const DisplayNameSchema = z
  .string()
  .trim()
  .min(1, 'Tell us what to call you')
  .max(60, 'Keep it short');

export const OtpCodeSchema = z.string().regex(/^\d{6}$/, 'Six digits');

export const HomeCitySchema = z.object({
  home_city: z.string().trim().min(1).max(80).optional(),
  home_lat: z.number().min(-90).max(90).optional(),
  home_lng: z.number().min(-180).max(180).optional(),
  home_country_code: z
    .string()
    .regex(/^[A-Z]{2}$/, 'ISO 3166-1 alpha-2')
    .optional(),
});
export type HomeCity = z.infer<typeof HomeCitySchema>;

export const ProfileUpdateSchema = z
  .object({
    display_name: DisplayNameSchema.optional(),
    avatar_url: z.string().url().nullable().optional(),
    bio: z.string().trim().max(280).nullable().optional(),
    default_visibility: VisibilitySchema.optional(),
  })
  .merge(HomeCitySchema);
export type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>;
