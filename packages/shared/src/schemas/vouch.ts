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
export const VouchTypeSchema = z.enum([
  'stay',
  'eat_drink',
  'do',
  'nightlife',
  'good_to_know',
  'skip',
]);
export type VouchType = z.infer<typeof VouchTypeSchema>;

// Verdict was dropped in v3.1 (the voiced vouch text carries the sentiment —
// "book the tents", "skip Kaza"). The verdict_kind DB enum survives only for
// the legacy trips table; the vouch flow has no verdict.

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
    type: 'nightlife',
    prompt: 'Where to go out?',
    hint: 'bar, club, late-night',
    placeholder: 'Bar crawl at Lub’d, quiz night is fun',
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
 * The composer payload (v3.1 — Lists replace trips). One vouch at a time,
 * dropped into a list. The floor is: category → one field → destination →
 * accept the default destination list → save. `list_id` is optional: when
 * omitted, the create flow finds-or-creates the destination list. No verdict
 * (the voiced text carries the sentiment — "book the tents", "skip Kaza").
 */
export const VouchComposerSchema = z.object({
  vouch_type: VouchTypeSchema,
  text: z.string().trim().min(1, "What's the one thing you'd tell a friend?").max(500),
  destination_text: z.string().trim().min(1, 'Where is this?').max(120),
  /** Target list. Omit to land in the auto-created destination list. */
  list_id: z.string().uuid().nullable().optional(),
  /** A custom list name to create instead of the destination default. */
  new_list_name: z.string().trim().max(120).nullable().optional(),
  visibility: VisibilitySchema.default('friends_of_friends'),
});
export type VouchComposer = z.infer<typeof VouchComposerSchema>;

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

/** Persisted Vouch row shape (what queries return). Standalone — a vouch
 *  links to lists via vouch_list_items, not a trip_id. */
export type VouchRow = {
  id: string;
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
