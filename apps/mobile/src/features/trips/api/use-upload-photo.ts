import { useAuthStore } from '@/features/auth';
import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImageManipulator from 'expo-image-manipulator';
import { tripKeys } from './keys';

type Vars = {
  tripId: string;
  /** local file URI from expo-image-picker */
  uri: string;
  width?: number;
  height?: number;
  takenAt?: string | null;
  position?: number;
  setAsCover?: boolean;
};

/**
 * Upload a photo. We re-encode through expo-image-manipulator first which
 * strips EXIF (including GPS) on most platforms. The `strip-exif` edge
 * function is a server-side safety net for cases where client-side stripping
 * is incomplete.
 */
export const useUploadPhoto = () => {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);

  return useMutation({
    mutationFn: async (vars: Vars) => {
      if (!userId) throw new Error('Not signed in');

      // Re-encode → strips EXIF on iOS / Android. (On web, manipulator is a no-op
      // for compression but still re-encodes through canvas which drops EXIF.)
      const manipulated = await ImageManipulator.manipulateAsync(
        vars.uri,
        [{ resize: { width: 1600 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      );

      const photoId = crypto.randomUUID();
      const path = `${userId}/${vars.tripId}/${photoId}.jpg`;

      const blob = await fetch(manipulated.uri).then((r) => r.blob());

      const supabase = getSupabase();
      const { error: uploadErr } = await supabase.storage
        .from('trip-photos')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
      if (uploadErr) throw uploadErr;

      const { data: row, error: insertErr } = await supabase
        .from('trip_photos')
        .insert({
          id: photoId,
          trip_id: vars.tripId,
          storage_path: path,
          width: manipulated.width,
          height: manipulated.height,
          taken_at: vars.takenAt ?? null,
          position: vars.position ?? 0,
        })
        .select('*')
        .single();
      if (insertErr) throw insertErr;

      if (vars.setAsCover) {
        await supabase.from('trips').update({ cover_photo_id: photoId }).eq('id', vars.tripId);
      }

      log.event('trip.photo_uploaded');
      return row;
    },
    onSuccess: (_row, vars) => {
      qc.invalidateQueries({ queryKey: tripKeys.detail(vars.tripId) });
    },
  });
};
