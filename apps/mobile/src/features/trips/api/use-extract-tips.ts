import { getSupabase } from '@/lib/supabase';
import { log } from '@/lib/log';
import { type ExtractionResult, ExtractionResultSchema } from '@journal/shared';
import { useMutation } from '@tanstack/react-query';

type Vars = { destinationText: string; originalNote: string };

/**
 * Loop A draft step: send the friend-facing note to the `extract-tips`
 * edge function and get back candidate tips for review. Saves nothing —
 * the user confirms in the review screen before anything persists.
 *
 * Never throws on extraction failure: the edge function returns an empty
 * tips array (and an `error` marker) so the user can still save the note
 * and hit the zero-tip nudge path (v2 §4C). A thrown error here only
 * happens on transport failure, which the caller surfaces as a retry.
 */
export const useExtractTips = () =>
  useMutation({
    mutationFn: async ({ destinationText, originalNote }: Vars): Promise<ExtractionResult> => {
      const supabase = getSupabase();
      const { data, error } = await supabase.functions.invoke<unknown>('extract-tips', {
        body: { destination_text: destinationText, original_note: originalNote },
      });
      if (error) throw error;
      // Validate against the shared contract; tolerate the extra `error`
      // marker the function may include by parsing only the known shape.
      const parsed = ExtractionResultSchema.safeParse(data);
      if (!parsed.success) {
        log.warn('extract-tips returned an unexpected shape', { issues: parsed.error.message });
        return { destination_text: destinationText, original_note: originalNote, tips: [] };
      }
      return parsed.data;
    },
  });
