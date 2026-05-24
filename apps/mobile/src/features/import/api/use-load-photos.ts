import { log } from '@/lib/log';
import { useMutation } from '@tanstack/react-query';
import * as Location from 'expo-location';
import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';
import {
  type ClusterKind,
  type LatLng,
  type PhotoAsset,
  type ProposedTrip,
  centroid,
  classifyCluster,
  clusterPhotos,
  sampleSpread,
  splitClusterByLocationJumps,
} from '../lib/cluster';

/**
 * Loads the last N months of camera-roll photos via expo-media-library,
 * clusters them by 36h gap, then classifies each cluster as TRIP / UNKNOWN
 * / drop using the user's manually-set home city (ADR 0009). Slice 2 added
 * GPS-based destination seeding (ADR 0008); slice 3 adds the
 * distance-from-home filter and the foreign-trip shortcut.
 */
const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;
const PAGE_SIZE = 200;
const MAX_PAGES = 5; // up to 1000 photos to cluster
const GPS_SAMPLE_PER_CLUSTER = 5;

export type Home = {
  lat: number;
  lng: number;
  countryCode: string | null;
} | null;

export type ClassifiedTrip = ProposedTrip & {
  kind: ClusterKind;
  countryCode?: string;
};

/**
 * iOS exposes screenshots via the `mediaSubtypes` array. Android either
 * lacks the field entirely or returns `[]`. We err on the side of keeping
 * borderline assets — only drop ones we're sure are screenshots.
 */
const isScreenshot = (asset: MediaLibrary.Asset): boolean => {
  const subtypes = (asset as MediaLibrary.Asset & { mediaSubtypes?: string[] }).mediaSubtypes;
  return Array.isArray(subtypes) && subtypes.includes('screenshot');
};

/**
 * Samples up to N photos spread across a cluster's duration (first, last,
 * middle, etc.), fetches their full asset info (which carries `.location`
 * on iOS / Android), and returns the resolved lat/lng list. Per-asset
 * failures are tolerated.
 */
export const sampleClusterPoints = async (cluster: ProposedTrip): Promise<Array<LatLng | null>> => {
  const sample = sampleSpread(cluster.photos, GPS_SAMPLE_PER_CLUSTER);
  const infos = await Promise.all(
    sample.map((p) => MediaLibrary.getAssetInfoAsync(p.id).catch(() => null)),
  );
  return infos.map((info) =>
    info?.location
      ? { latitude: info.location.latitude, longitude: info.location.longitude }
      : null,
  );
};

/**
 * Reverse-geocodes a centroid into `{ city, isoCountryCode }`. Returns
 * partial data when the geocoder is patchy; both fields may be undefined.
 */
export const reverseGeocodeCentroid = async (
  center: LatLng,
): Promise<{ city?: string; countryCode?: string }> => {
  try {
    const results = await Location.reverseGeocodeAsync(center);
    const hit = results[0];
    if (!hit) return {};
    const city = hit.city ?? hit.subregion ?? hit.region ?? undefined;
    const countryCode = hit.isoCountryCode ?? undefined;
    return { city, countryCode };
  } catch (err) {
    log.error('reverse geocode failed', err);
    return {};
  }
};

export const useLoadCameraRoll = () =>
  useMutation({
    mutationFn: async (home: Home): Promise<{ proposed: ClassifiedTrip[]; supported: boolean }> => {
      if (Platform.OS === 'web') return { proposed: [], supported: false };

      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) throw new Error('No photo permission');

      const since = Date.now() - SIX_MONTHS_MS;
      const photos: PhotoAsset[] = [];
      let after: string | undefined;
      let stop = false;
      for (let i = 0; i < MAX_PAGES && !stop; i += 1) {
        const page = await MediaLibrary.getAssetsAsync({
          mediaType: 'photo',
          sortBy: [['creationTime', false]],
          first: PAGE_SIZE,
          after,
        });
        for (const a of page.assets) {
          if (a.creationTime < since) {
            stop = true;
            break;
          }
          if (isScreenshot(a)) continue;
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

      const initial = clusterPhotos(photos);

      // Per-cluster: attach GPS samples → centroid → reverse-geocode →
      // classify. Drop the locals; keep `trip` and `unknown`.
      const enriched: ClassifiedTrip[] = [];
      for (const cluster of initial) {
        const points = await sampleClusterPoints(cluster);
        // Attach each sampled photo's location back onto its asset so the
        // splitter can see day-by-day medians.
        const sample = sampleSpread(cluster.photos, GPS_SAMPLE_PER_CLUSTER);
        for (let i = 0; i < sample.length; i += 1) {
          const photo = sample[i];
          const point = points[i];
          if (photo && point) photo.location = point;
        }
        const center = centroid(points);
        const { city, countryCode } = center
          ? await reverseGeocodeCentroid(center)
          : { city: undefined, countryCode: undefined };

        const kind = classifyCluster({
          cluster,
          home,
          centroid: center,
          countryCode: countryCode ?? null,
        });
        if (kind === 'drop') continue;

        const base: ClassifiedTrip = {
          ...cluster,
          suggestedPlace: city,
          kind,
          countryCode,
        };
        // Only TRIPs get the same-cluster mid-trip split — UNKNOWNs have
        // no GPS to split on by definition.
        if (kind === 'trip') {
          const parts = splitClusterByLocationJumps(cluster).map((p) => ({
            ...p,
            suggestedPlace: city,
            kind: 'trip' as const,
            countryCode,
          }));
          enriched.push(...parts);
        } else {
          enriched.push(base);
        }
      }

      log.event('import.camera_roll_scanned', {
        photo_count: photos.length,
        trip_count: enriched.filter((c) => c.kind === 'trip').length,
        unknown_count: enriched.filter((c) => c.kind === 'unknown').length,
      });
      return { proposed: enriched, supported: true };
    },
  });
