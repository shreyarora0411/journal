import { z } from 'zod';
import { VisibilitySchema } from './index';

/**
 * Vouched v3 schemas — the no-LLM, category-slotted vouch model.
 *
 * Trip is the container; the atomic Vouch is the input unit. The composer
 * asks 5 singular, category-scoped questions (stay / eat_drink / do /
 * good_to_know / skip); each answer the user writes becomes one Vouch,
 * typed by the slot it came from. No prose blob, no extraction, no model
 * deciding type or wording — the structure is structured because the user
 * put it in a slot.
 *
 * Single source of truth for the mobile client (CLAUDE.md §3).
 */

// The 5 composer categories = the v0 vouch_type set. This IS the format
// constraint that forces specificity: "where to stay? one place, worth it"
// can't be answered with mush.
export const VouchTypeSchema = z.enum(['stay', 'eat_drink', 'do', 'good_to_know', 'skip']);
export type VouchType = z.infer<typeof VouchTypeSchema>;

// One-tap trip verdict. Mirrors the DB verdict_kind enum (love/mid/skip);
// surfaced as "Loved it / Mixed / Skip it".
export const TripVerdictSchema = z.enum(['love', 'mid', 'skip']);
export type TripVerdict = z.infer<typeof TripVerdictSchema>;

/** Display metadata for each category ask, in composer order. The prompt is
 *  the question; the hint models register; the placeholder is a real voiced
 *  example. Kept in shared so the composer and any seed tooling agree. */
export const VOUCH_CATEGORIES: ReadonlyArray<{
  type: VouchType;
  prompt: string;
  hint: string;
  placeholder: string;
}> = [
  {
    type: 'stay',
    prompt: 'Where to stay?',
    hint: 'one place, worth it or not',
    placeholder: 'Banjara, book the tents not the rooms',
  },
  {
    type: 'eat_drink',
    prompt: 'Where to eat or drink?',
    hint: 'one spot, one dish if you remember',
    placeholder: 'Taste of Spiti, get the thukpa',
  },
  {
    type: 'do',
    prompt: 'One thing to do?',
    hint: '',
    placeholder: 'Key Monastery at sunrise, before the buses',
  },
  {
    type: 'good_to_know',
    prompt: "One thing that's good to know?",
    hint: '',
    placeholder: 'Carry cash, no ATMs past Reckong Peo',
  },
  {
    type: 'skip',
    prompt: 'Anything to skip?',
    hint: '',
    placeholder: 'Skip Kaza unless you need supplies',
  },
];

/** A single voiced vouch the user wrote into a category slot. */
export const VouchInputSchema = z.object({
  vouch_type: VouchTypeSchema,
  text: z.string().trim().min(1).max(500),
});
export type VouchInput = z.infer<typeof VouchInputSchema>;

/**
 * The composer payload (v3 Screen B). destination + required verdict + the
 * vouches the user banked. At least one vouch is required to save — a trip
 * with zero vouches helps no one (v3 §9).
 */
export const TripComposerSchema = z.object({
  destination_text: z.string().trim().min(1, 'Where did you go?').max(120),
  verdict: TripVerdictSchema,
  trip_context: z.string().trim().max(2000).optional(),
  visibility: VisibilitySchema.default('friends_of_friends'),
  vouches: z.array(VouchInputSchema).min(1, 'Add at least one vouch'),
});
export type TripComposer = z.infer<typeof TripComposerSchema>;

/**
 * Soft specificity check (v3 §9): a one-word vouch is nudged at entry, never
 * blocked. Returns true when the text looks specific enough — has more than
 * one word OR names something with a digit/proper-noun-ish capital. Used to
 * decide whether to show the "one place, dish, or specific thing?" hint.
 */
export const looksSpecific = (text: string): boolean => {
  const t = text.trim();
  if (t.length === 0) return true; // empty = not yet answered, don't nag
  const words = t.split(/\s+/).filter(Boolean);
  // Multi-word is specific. A single word also passes if it names something
  // — a proper noun ("Banjara") or a number ("Room 412") is a real vouch;
  // only a lone lowercase common word ("nice", "good") gets the nudge.
  return words.length >= 2 || /[A-Z]/.test(t) || /\d/.test(t);
};

/** Persisted Vouch row shape (what queries return). */
export type VouchRow = {
  id: string;
  trip_id: string;
  user_id: string;
  text: string;
  vouch_type: VouchType;
  place_id: string | null;
  area_text: string | null;
  destination_text: string;
  source: 'user_created';
  visibility: z.infer<typeof VisibilitySchema>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};
