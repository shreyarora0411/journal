import { log } from '@/lib/log';
import { useMutation } from '@tanstack/react-query';
import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';
import { type PhotoAsset, type ProposedTrip, clusterPhotos } from '../lib/cluster';

/**
 * Loads the last N months of camera-roll photos via expo-media-library and
 * clusters them into proposed trips. Web is unsupported (no media-library on
 * web); native asks permission first.
 */
const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;
const PAGE_SIZE = 200;
const MAX_PAGES = 5; // up to 1000 photos to cluster

export const useLoadCameraRoll = () =>
  useMutation({
    mutationFn: async (): Promise<{ proposed: ProposedTrip[]; supported: boolean }> => {
      if (Platform.OS === 'web') return { proposed: [], supported: false };

      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) throw new Error('No photo permission');

      const since = Date.now() - SIX_MONTHS_MS;
      const photos: PhotoAsset[] = [];
      let after: string | undefined;
      for (let i = 0; i < MAX_PAGES; i += 1) {
        const page = await MediaLibrary.getAssetsAsync({
          mediaType: 'photo',
          sortBy: [['creationTime', false]],
          first: PAGE_SIZE,
          after,
        });
        for (const a of page.assets) {
          if (a.creationTime < since) {
            return { proposed: clusterPhotos(photos), supported: true };
          }
          photos.push({
            id: a.id,
            uri: a.uri,
            creationTime: a.creationTime,
            width: a.width,
            height: a.height,
            location: null,
          });
        }
        if (!page.hasNextPage) break;
        after = page.endCursor;
      }

      log.event('import.camera_roll_scanned', { photo_count: photos.length });
      return { proposed: clusterPhotos(photos), supported: true };
    },
  });
