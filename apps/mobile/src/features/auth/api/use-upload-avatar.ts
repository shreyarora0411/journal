import { useAuthStore } from '@/features/auth';
import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImageManipulator from 'expo-image-manipulator';
import { authKeys } from './keys';

/**
 * Uploads a user avatar to the public `avatars` bucket, then writes the
 * public URL to users.avatar_url. EXIF is stripped via re-encode before
 * upload.
 */
export const useUploadAvatar = () => {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);

  return useMutation({
    mutationFn: async (localUri: string): Promise<string> => {
      if (!userId) throw new Error('Not signed in');

      // Re-encode at avatar size — strips EXIF and keeps the file small.
      const manipulated = await ImageManipulator.manipulateAsync(
        localUri,
        [{ resize: { width: 512 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      );

      const path = `${userId}/avatar-${Date.now()}.jpg`;
      const blob = await fetch(manipulated.uri).then((r) => r.blob());

      const supabase = getSupabase();
      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = pub.publicUrl;

      const { error: updateErr } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);
      if (updateErr) throw updateErr;

      log.event('avatar.uploaded');
      return publicUrl;
    },
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: authKeys.profile(userId) });
    },
  });
};
