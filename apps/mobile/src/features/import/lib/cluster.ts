/**
 * Camera-roll → proposed-trips clustering. Replaces Instagram OAuth per the
 * (Postmark brief Instagram constraint — see ADR 0005 + my chat recommendation).
 *
 * Inputs: photos with a `creationTime` (ms) and optional `location`.
 * Rule of thumb:
 *   - Sort by creationTime asc.
 *   - Start a new cluster on a gap > 36h between consecutive photos.
 *   - Each cluster becomes a proposed trip.
 *
 * Location is currently advisory only — the location reverse-geocoding lives
 * with the user to wire (no free worldwide reverse-geocoder we can ship).
 * Cluster names default to a date-range string ("12 Mar – 17 Mar 2026") and
 * the user renames in the import-review screen.
 */

export type PhotoAsset = {
  id: string;
  uri: string;
  creationTime: number;
  width?: number;
  height?: number;
  location?: { latitude: number; longitude: number } | null;
};

export type ProposedTrip = {
  id: string;
  /** Photos in the cluster, sorted by creationTime asc. */
  photos: PhotoAsset[];
  startMs: number;
  endMs: number;
  durationDays: number;
  suggestedTitle: string;
};

const TRIP_GAP_MS = 36 * 60 * 60 * 1000; // 36 hours

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const fmt = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTH[d.getMonth()]}`;
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
