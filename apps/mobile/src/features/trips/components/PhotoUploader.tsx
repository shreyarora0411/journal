import { Box, Button, Text } from '@/components';
import { useToast } from '@/hooks/use-toast';
import { log } from '@/lib/log';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { useUploadPhoto } from '../api/use-upload-photo';

type Props = {
  tripId: string;
  /** Existing photo count (for ordering position). */
  existingCount: number;
};

export function PhotoUploader({ tripId, existingCount }: Props) {
  const upload = useUploadPhoto();
  const toast = useToast();

  const onPick = async () => {
    if (Platform.OS !== 'web') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast.show({ message: 'No photo permission.', variant: 'error' });
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 1,
      exif: false,
    });
    if (result.canceled) return;

    let i = 0;
    for (const asset of result.assets) {
      try {
        await upload.mutateAsync({
          tripId,
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          position: existingCount + i,
          setAsCover: existingCount + i === 0,
        });
        i += 1;
      } catch (err) {
        log.error('photo upload failed', err);
        toast.show({ message: 'A photo failed to upload.', variant: 'error' });
      }
    }
    if (i > 0)
      toast.show({ message: `Uploaded ${i} photo${i > 1 ? 's' : ''}.`, variant: 'success' });
  };

  return (
    <Box gap="s">
      <Button
        label={upload.isPending ? 'Uploading…' : 'Add photos'}
        variant="ghost"
        loading={upload.isPending}
        onPress={onPick}
      />
      <Text variant="caption">
        Photos get re-encoded before upload — GPS and other metadata are stripped.
      </Text>
    </Box>
  );
}
