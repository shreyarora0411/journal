import { z } from 'zod';
import { VisibilitySchema } from './index';

/**
 * Vouched v2 schemas — the "trip note in, atomic tips out" model.
 *
 * TripLog (= the trips table) is the input unit; the user writes a
 * friend-facing note. LogTip is the searchable unit; the extractor turns
 * the note into atomic, action-shaped tips the user confirms.
 *
 * These are the single source of truth for both the mobile client and the
 * `extract-tips` edge function (per CLAUDE.md §3 — shared schemas).
 */

// Action-shape of a tip, not a place-kind. "skip"/"avoid"/"ask_contact"
// are placeless on purpose — they're the advice that generic review sites
// can't represent.
export const AdviceTypeSchema = z.enum([
  'do',
  'eat_drink',
  'stay',
  'book',
  'ask_contact',
  'shop',
  'skip',
  'avoid',
  'area',
  'other',
]);
export type AdviceType = z.infer<typeof AdviceTypeSchema>;

// One-tap trip verdict. Mirrors the existing verdict_kind DB enum
// (love/mid/skip) so we don't fork the value set — the composer surfaces
// them as "Loved it / Mixed / Skip it".
export const TripVerdictSchema = z.enum(['love', 'mid', 'skip']);
export type TripVerdict = z.infer<typeof TripVerdictSchema>;

export const ExtractionStatusSchema = z.enum([
  'system_extracted',
  'user_edited',
  'user_created',
]);
export type ExtractionStatus = z.infer<typeof ExtractionStatusSchema>;

/**
 * The friend-framed composer (v2 Screen B). Hard cap of 4 visible fields:
 *   - destination_text — "Where did you go?"
 *   - verdict          — "Worth it?" (one tap, optional)
 *   - original_note    — "If a friend were going, what's the one thing…"
 *   - did_differently  — optional second free-text
 *
 * No minimum word count. Quality is gated downstream by extraction
 * producing >=1 specific tip (a soft nudge), never by length (v2 §9).
 */
export const ComposerFormSchema = z.object({
  destination_text: z.string().trim().min(1, 'Where did you go?').max(120),
  verdict: TripVerdictSchema.nullable().optional(),
  original_note: z.string().trim().min(1, "What's the one thing you'd tell a friend?").max(4000),
  did_differently: z.string().trim().max(2000).optional(),
  visibility: VisibilitySchema.default('friends_of_friends'),
});
export type ComposerForm = z.infer<typeof ComposerFormSchema>;

/**
 * One candidate tip returned by the extraction endpoint, before the user
 * confirms it. `place_candidate`/`area_text` are loose text — we do NOT
 * force a formal Place record in v0 (v2 §6). confidence drives the
 * low-confidence review flag.
 */
export const LogTipDraftSchema = z.object({
  text: z.string().trim().min(1).max(500),
  advice_type: AdviceTypeSchema,
  place_candidate: z.string().trim().max(160).nullable().optional(),
  area_text: z.string().trim().max(160).nullable().optional(),
  confidence: z.number().min(0).max(1),
});
export type LogTipDraft = z.infer<typeof LogTipDraftSchema>;

/** The extraction endpoint's full response: the source note echoed back
 *  (source of truth) plus the candidate tips. An empty `tips` array is a
 *  valid response — it triggers the composer's "we couldn't find a
 *  specific tip" nudge rather than blocking the save. */
export const ExtractionResultSchema = z.object({
  destination_text: z.string(),
  original_note: z.string(),
  tips: z.array(LogTipDraftSchema),
});
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

/** A confirmed tip the client sends back to persist (post-review). */
export const ConfirmedTipSchema = z.object({
  text: z.string().trim().min(1).max(500),
  advice_type: AdviceTypeSchema,
  area_text: z.string().trim().max(160).nullable().optional(),
  extraction_status: ExtractionStatusSchema,
  confidence: z.number().min(0).max(1).nullable().optional(),
  visibility: VisibilitySchema.default('friends_of_friends'),
});
export type ConfirmedTip = z.infer<typeof ConfirmedTipSchema>;

/** Persisted LogTip row shape (what queries return). */
export type LogTipRow = {
  id: string;
  trip_id: string;
  user_id: string;
  text: string;
  advice_type: AdviceType;
  place_id: string | null;
  area_text: string | null;
  destination_text: string;
  extraction_status: ExtractionStatus;
  confidence: number | null;
  visibility: z.infer<typeof VisibilitySchema>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};
