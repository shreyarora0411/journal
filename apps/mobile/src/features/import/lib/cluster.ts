/**
 * Camera-roll → proposed-trips clustering. Replaces Instagram OAuth per the
 * lore brief Instagram constraint (ADR 0005). Slice 2 adds GPS-based
 * destination seeding (ADR 0008) — `suggestedPlace` is populated by the
 * loader after reverse-geocoding the cluster's photo centroid.
 *
 * Inputs: photos with a `creationTime` (ms) and optional `location`.
 * Rule of thumb:
 *   - Sort by creationTime asc.
 *   - Start a new cluster on a gap > 36h between consecutive photos.
 *   - Each cluster becomes a proposed trip.
 */

export type LatLng = { latitude: number; longitude: number };

export type PhotoAsset = {
  id: string;
  uri: string;
  creationTime: number;
  width?: number;
  height?: number;
  location?: LatLng | null;
};

export type ProposedTrip = {
  id: string;
  /** Photos in the cluster, sorted by creationTime asc. */
  photos: PhotoAsset[];
  startMs: number;
  endMs: number;
  durationDays: number;
  suggestedTitle: string;
  /**
   * Reverse-geocoded city/region for the cluster, populated by the loader
   * after sampling photo GPS. Undefined when no GPS is available or the
   * geocoder returns nothing.
   */
  suggestedPlace?: string;
};

const TRIP_GAP_MS = 36 * 60 * 60 * 1000; // 36 hours

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const fmt = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTH[d.getMonth()]}`;
};

/**
 * Averages a list of lat/lng points, ignoring nulls. Returns null when no
 * valid points are present — caller should treat as "no GPS" and skip
 * reverse-geocoding.
 */
export const centroid = (points: Array<LatLng | null | undefined>): LatLng | null => {
  const valid = points.filter((p): p is LatLng => Boolean(p));
  if (valid.length === 0) return null;
  const sum = valid.reduce(
    (acc, p) => ({ latitude: acc.latitude + p.latitude, longitude: acc.longitude + p.longitude }),
    { latitude: 0, longitude: 0 },
  );
  return {
    latitude: sum.latitude / valid.length,
    longitude: sum.longitude / valid.length,
  };
};

/**
 * Great-circle distance between two lat/lng points in km. Haversine formula.
 * Plenty accurate for trip-clustering thresholds (50–200km).
 */
export const haversineKm = (a: LatLng, b: LatLng): number => {
  const R = 6371; // Earth radius in km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

/**
 * Picks `n` items evenly spread across an array — always includes the first
 * and last, fills the middle with evenly-distributed indexes. Used so the
 * cluster GPS centroid reflects the whole trip, not just the airport on
 * day 1.
 */
export const sampleSpread = <T>(items: T[], n: number): T[] => {
  if (items.length === 0 || n <= 0) return [];
  if (items.length <= n) return [...items];
  if (n === 1) return [items[0] as T];
  const out: T[] = [];
  for (let i = 0; i < n; i += 1) {
    const idx = Math.round((i * (items.length - 1)) / (n - 1));
    out.push(items[idx] as T);
  }
  return out;
};

export type ClusterKind = 'trip' | 'unknown';

export type ClassifyInput = {
  cluster: Pick<ProposedTrip, 'durationDays' | 'photos'>;
  home: { lat: number; lng: number; countryCode: string | null } | null;
  centroid: LatLng | null;
  countryCode: string | null;
};

/**
 * Decides whether a cluster is a real trip, a low-confidence "unknown" we
 * should ask the user about, or a local day-out we should drop entirely.
 * See ADR 0009 for the rule choices.
 */
export const classifyCluster = (input: ClassifyInput): ClusterKind | 'drop' => {
  const { cluster, home, centroid, countryCode } = input;
  if (!centroid) return 'unknown';
  if (home?.countryCode && countryCode && countryCode !== home.countryCode) return 'trip';
  if (!home) return 'trip';
  const distKm = haversineKm(centroid, { latitude: home.lat, longitude: home.lng });
  if (distKm > 200) return 'trip';
  if (distKm > 50 && (cluster.durationDays >= 2 || cluster.photos.length >= 8)) return 'trip';
  return 'drop';
};

/**
 * Splits a cluster on big intra-trip location jumps — i.e. two distinct
 * destinations within a single 36h-gap cluster. Uses the median location of
 * each calendar day; if adjacent days' medians are > `jumpKm` apart, the
 * cluster is cut between them.
 */
export const splitClusterByLocationJumps = (
  cluster: ProposedTrip,
  jumpKm = 200,
): ProposedTrip[] => {
  // Group photos by yyyy-mm-dd of creationTime.
  const buckets: { day: string; photos: PhotoAsset[] }[] = [];
  for (const p of cluster.photos) {
    const day = new Date(p.creationTime).toISOString().slice(0, 10);
    const last = buckets[buckets.length - 1];
    if (last && last.day === day) last.photos.push(p);
    else buckets.push({ day, photos: [p] });
  }

  const median = (arr: PhotoAsset[]): LatLng | null => {
    const locs = arr.map((p) => p.location).filter((l): l is LatLng => Boolean(l));
    if (locs.length === 0) return null;
    const sortedLat = [...locs].sort((a, b) => a.latitude - b.latitude);
    const sortedLng = [...locs].sort((a, b) => a.longitude - b.longitude);
    const mid = Math.floor(locs.length / 2);
    return {
      latitude: sortedLat[mid]?.latitude ?? 0,
      longitude: sortedLng[mid]?.longitude ?? 0,
    };
  };

  const dayMedians = buckets.map((b) => median(b.photos));

  // Find split indexes (cut between bucket i and i+1).
  const cuts: number[] = [];
  for (let i = 0; i < dayMedians.length - 1; i += 1) {
    const a = dayMedians[i];
    const b = dayMedians[i + 1];
    if (a && b && haversineKm(a, b) > jumpKm) cuts.push(i + 1);
  }

  if (cuts.length === 0) return [cluster];

  // Build sub-clusters between the cuts.
  const ranges: number[][] = [];
  let start = 0;
  for (const cut of cuts) {
    ranges.push([start, cut]);
    start = cut;
  }
  ranges.push([start, buckets.length]);

  return ranges.map((range, idx) => {
    const sliceStart = range[0] as number;
    const sliceEnd = range[1] as number;
    const photos = buckets.slice(sliceStart, sliceEnd).flatMap((b) => b.photos);
    const first = photos[0];
    const last = photos[photos.length - 1];
    if (!first || !last) return cluster;
    const startMs = first.creationTime;
    const endMs = last.creationTime;
    const durationDays = Math.max(1, Math.round((endMs - startMs) / (24 * 60 * 60 * 1000)));
    const sameYear = new Date(startMs).getFullYear() === new Date(endMs).getFullYear();
    const suggestedTitle = `${fmt(startMs)} – ${fmt(endMs)}${sameYear ? ` ${new Date(endMs).getFullYear()}` : ''}`;
    return {
      id: `${cluster.id}-split-${idx}`,
      photos,
      startMs,
      endMs,
      durationDays,
      suggestedTitle,
    };
  });
};

export const clusterPhotos = (photos: PhotoAsset[]): ProposedTrip[] => {
  const sorted = [...photos].sort((a, b) => a.creationTime - b.creationTime);
  const clusters: PhotoAsset[][] = [];
  for (const p of sorted) {
    const last = clusters[clusters.length - 1];
    const lastPhoto = last?.[last.length - 1];
    if (!last || !lastPhoto || p.creationTime - lastPhoto.creationTime > TRIP_GAP_MS) {
      clusters.push([p]);
    } else {
      last.push(p);
    }
  }
  return clusters
    .filter((c) => c.length >= 3) // 1–2 photos in a day isn't a trip
    .map((photos, idx) => {
      const first = photos[0];
      const last = photos[photos.length - 1];
      if (!first || !last) {
        return null as unknown as ProposedTrip;
      }
      const startMs = first.creationTime;
      const endMs = last.creationTime;
      const durationDays = Math.max(1, Math.round((endMs - startMs) / (24 * 60 * 60 * 1000)));
      const sameYear = new Date(startMs).getFullYear() === new Date(endMs).getFullYear();
      const suggestedTitle = `${fmt(startMs)} – ${fmt(endMs)}${sameYear ? ` ${new Date(endMs).getFullYear()}` : ''}`;
      return {
        id: `cluster-${idx}-${startMs}`,
        photos,
        startMs,
        endMs,
        durationDays,
        suggestedTitle,
      };
    })
    .filter((c): c is ProposedTrip => Boolean(c));
};
