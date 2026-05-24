/**
 * Mocked Instagram trip-detection response (ADR 0005). Used by the Import
 * screen (#05 of Batch A) to render the "from Instagram" section
 * alongside the real camera-roll classifier.
 *
 * Shape mirrors what a real Instagram-Graph `recent posts → cluster`
 * endpoint will return when we wire it post-pilot. Swap the source
 * (this file → an API call) without changing the screen.
 */
export type InstagramTrip = {
  id: string;
  destination: string;
  monthLabel: string;
  postCount: number;
  coverUri: string;
};

export const INSTAGRAM_TRIPS: ReadonlyArray<InstagramTrip> = [
  {
    id: 'ig-1',
    destination: 'Lisbon',
    monthLabel: 'Mar 2026',
    postCount: 7,
    coverUri: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800',
  },
  {
    id: 'ig-2',
    destination: 'Tokyo',
    monthLabel: 'Feb 2026',
    postCount: 12,
    coverUri: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800',
  },
  {
    id: 'ig-3',
    destination: 'Pondicherry',
    monthLabel: 'Jan 2026',
    postCount: 4,
    coverUri: 'https://images.unsplash.com/photo-1583244532610-2a234e36cd60?w=800',
  },
  {
    id: 'ig-4',
    destination: 'Sri Lanka',
    monthLabel: 'Dec 2025',
    postCount: 9,
    coverUri: 'https://images.unsplash.com/photo-1586500036706-41963de24d8b?w=800',
  },
];
