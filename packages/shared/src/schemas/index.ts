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

export const ProfileUpdateSchema = z.object({
  display_name: DisplayNameSchema.optional(),
  avatar_url: z.string().url().nullable().optional(),
  default_visibility: VisibilitySchema.optional(),
});
export type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>;
