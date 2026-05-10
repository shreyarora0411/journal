import { z } from 'zod';

export const VisibilitySchema = z.enum(['followers', 'friends_of_friends', 'everyone']);
export type Visibility = z.infer<typeof VisibilitySchema>;

export const HandleSchema = z
  .string()
  .min(3)
  .max(24)
  .regex(/^[a-z0-9_]+$/, 'lowercase letters, digits, and underscore only');

export const UuidSchema = z.string().uuid();
