import { useAuthStore } from '@/features/auth';
import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase';
import { useMutation } from '@tanstack/react-query';
import * as ImageManipulator from 'expo-image-manipulator';

type Vars = {
  venueId: string;
  /** local file URI from expo-image-picker */
  uri: string;
};

/**
 * Upload a cover photo for an atomic-log venue. Storage path follows
 * `<user_id>/venues/<venue_id>/<photoId>.jpg` so it satisfies the
 * existing trip-photos bucket policy (auth.uid()::text = first
 * folder). EXIF is stripped via expo-image-manipulator's re-encode.
 *
 * Writes the resulting path to venues.cover_photo_path (migration 33).
 */
export const useUploadVenuePhoto = () => {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);

  return useMutation({
    mutationFn: async (vars: Vars): Promise<{ path: string }> => {
      if (!userId) throw new Error('Not signed in');

      const manipulated = await ImageManipulator.manipulateAsync(
        vars.uri,
        [{ resize: { width: 1600 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      );

      const photoId = crypto.randomUUID();
      const path = `${userId}/venues/${vars.venueId}/${photoId}.jpg`;
      const blob = await fetch(manipulated.uri).then((r) => r.blob());

      const supabase = getSupabase();
      const { error: uploadErr } = await supabase.storage
        .from('trip-photos')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
      if (uploadErr) throw uploadErr;

      const { error: updateErr } = await supabase
        .from('venues')
        .update({ cover_photo_path: path })
        .eq('id', vars.venueId);
      if (updateErr) throw updateErr;

      log.event('venue.photo_uploaded');
      return { path };
    },
  });
};
