/**
 * Design-pack fixture for Batch B. The data model (trips/places/venues)
 * exists but the pilot DB has no real entities yet; these stand-ins let
 * us build the Feed / Search / Destination / Place screens against the
 * shapes from the brief while we wait for real seed users.
 *
 * Replace each fixture with a real Supabase query in the Phase-final
 * polish pass — the screens consume these types, so swapping the source
 * doesn't change UI code.
 */

import type { Category } from '@/theme';

export type Friend = {
  id: string;
  name: string;
  handle: string;
  avatarUri: string;
};

export type LiveTraveler = Friend & {
  destination: string;
  destinationSlug: string;
  dayNumber: number;
};

export type FriendRec = {
  id: string;
  friend: Friend;
  /** "3 weeks ago", "Just back" — relationship cue surfaced above place name. */
  when: string;
  category: Category;
  placeName: string;
  destinationSlug: string;
  area: string;
  quote: string;
  coverUri: string;
  hearts: number;
};

export type DestinationSummary = {
  slug: string;
  name: string;
  country: string;
  heroUri: string;
  /** "Tara is here now. Kabir was here 3 weeks ago." */
  cue: string;
  friends: Friend[];
  placeCount: number;
  hot?: boolean;
};

// — Friends ----------------------------------------------------------------

export const TARA: Friend = {
  id: 'f-tara',
  name: 'Tara',
  handle: '@tarac',
  avatarUri: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200',
};
export const KABIR: Friend = {
  id: 'f-kabir',
  name: 'Kabir',
  handle: '@kbr',
  avatarUri: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200',
};
export const DIVYANSH: Friend = {
  id: 'f-divyansh',
  name: 'Divyansh',
  handle: '@div',
  avatarUri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
};
export const ANYA: Friend = {
  id: 'f-anya',
  name: 'Anya',
  handle: '@anya',
  avatarUri: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200',
};
export const PRIYA: Friend = {
  id: 'f-priya',
  name: 'Priya',
  handle: '@pri',
  avatarUri: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200',
};

const ALL_FRIENDS: Friend[] = [TARA, KABIR, DIVYANSH, ANYA, PRIYA];

// — Right-now strip (Feed top) --------------------------------------------

export const LIVE_TRAVELERS: ReadonlyArray<LiveTraveler> = [
  { ...TARA, destination: 'Tokyo', destinationSlug: 'tokyo', dayNumber: 3 },
  { ...DIVYANSH, destination: 'Lisbon', destinationSlug: 'lisbon', dayNumber: 5 },
  { ...PRIYA, destination: 'Pondicherry', destinationSlug: 'pondicherry', dayNumber: 1 },
];

// — Feed recommendation cards ---------------------------------------------

export const FRIEND_RECS: ReadonlyArray<FriendRec> = [
  {
    id: 'rec-1',
    friend: KABIR,
    when: '3 weeks ago',
    category: 'stay',
    placeName: 'Hotel K5',
    destinationSlug: 'tokyo',
    area: 'Nihonbashi, Tokyo',
    quote: 'Stay on the Nihonbashi side. The river at 6am is the whole trip.',
    coverUri: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1200',
    hearts: 12,
  },
  {
    id: 'rec-2',
    friend: TARA,
    when: 'Just back',
    category: 'food',
    placeName: 'Cervejaria Ramiro',
    destinationSlug: 'lisbon',
    area: 'Avenida, Lisbon',
    quote: 'Skip the queue lunchtime, go at 4. The clams are not optional.',
    coverUri: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=1200',
    hearts: 28,
  },
  {
    id: 'rec-3',
    friend: ANYA,
    when: '2 months ago',
    category: 'drinks',
    placeName: 'High Ultra Lounge',
    destinationSlug: 'bangalore',
    area: 'UB City, Bangalore',
    quote: "Worth the elevator. Don't drink the cocktails, just stand on the terrace.",
    coverUri: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=1200',
    hearts: 7,
  },
  {
    id: 'rec-4',
    friend: DIVYANSH,
    when: 'last winter',
    category: 'wander',
    placeName: 'Annapurna Sanctuary',
    destinationSlug: 'pokhara',
    area: 'Pokhara',
    quote: 'Three days in, you stop counting altitude and start counting tea breaks.',
    coverUri: 'https://images.unsplash.com/photo-1605640840605-14ac1855827b?w=1200',
    hearts: 19,
  },
];

// — Search "Friends I trust" list -----------------------------------------

export const DESTINATIONS: ReadonlyArray<DestinationSummary> = [
  {
    slug: 'tokyo',
    name: 'Tokyo',
    country: 'Japan',
    heroUri: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1600',
    cue: 'Tara is here now. Kabir was here 3 weeks ago.',
    friends: [TARA, KABIR, ANYA, PRIYA, DIVYANSH],
    placeCount: 31,
    hot: true,
  },
  {
    slug: 'lisbon',
    name: 'Lisbon',
    country: 'Portugal',
    heroUri: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=1600',
    cue: 'Tara just got back. Divyansh is there this week.',
    friends: [TARA, DIVYANSH, ANYA],
    placeCount: 18,
    hot: true,
  },
  {
    slug: 'pondicherry',
    name: 'Pondicherry',
    country: 'India',
    heroUri: 'https://images.unsplash.com/photo-1583244532610-2a234e36cd60?w=1600',
    cue: 'Priya is there now. Three others been in the last year.',
    friends: [PRIYA, KABIR, ANYA],
    placeCount: 9,
  },
  {
    slug: 'pokhara',
    name: 'Pokhara',
    country: 'Nepal',
    heroUri: 'https://images.unsplash.com/photo-1605640840605-14ac1855827b?w=1600',
    cue: 'Divyansh trekked it last winter.',
    friends: [DIVYANSH],
    placeCount: 12,
  },
];

// — Place detail (Hotel K5 in Tokyo) --------------------------------------

export type PlaceDetail = {
  id: string;
  name: string;
  category: Category;
  area: string;
  country: string;
  destinationName: string;
  heroUris: string[];
  primaryFriend: Friend;
  primaryWhen: string;
  primaryQuote: string;
  primaryTip: string;
  otherFriends: Array<{ friend: Friend; quote: string }>;
};

export const PLACES: Record<string, PlaceDetail> = {
  'hotel-k5': {
    id: 'hotel-k5',
    name: 'Hotel K5',
    category: 'stay',
    area: 'Nihonbashi, Tokyo',
    country: 'Japan',
    destinationName: 'Tokyo',
    heroUris: [
      'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1600',
      'https://images.unsplash.com/photo-1568084680786-a84f91d1153c?w=1600',
      'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1600',
    ],
    primaryFriend: KABIR,
    primaryWhen: 'Stayed in March · 4 nights',
    primaryQuote:
      'The rooms are spare in the right way — concrete, two books, a kettle. The river at 6am is the whole trip.',
    primaryTip:
      'Ask for a high floor on the Nihonbashi side. The Otemachi side gets traffic noise.',
    otherFriends: [
      {
        friend: TARA,
        quote: 'Stayed two nights, would do four. Breakfast is excellent.',
      },
      {
        friend: ANYA,
        quote: 'Walk to the river before anyone else is up. Best 30 minutes of the trip.',
      },
    ],
  },
};

// — Trip notebook (Batch C #11) -------------------------------------------

export type NotebookEntry = {
  id: string;
  category: Category;
  placeName: string;
  area: string;
  /** "Day 1" / "Day 2 · afternoon". */
  dayLabel: string;
  quote: string;
  photoUri: string;
};

export type TripNotebook = {
  id: string;
  ownerName: string;
  ownerAvatarUri: string;
  ownerHandle: string;
  destination: string;
  monthLabel: string;
  days: number;
  entryCount: number;
  photoCount: number;
  tipsUsedByFriends: number;
  /** 4 numbered pins for the Map glance card. */
  pins: ReadonlyArray<{ idx: number; label: string; color: string }>;
  entries: NotebookEntry[];
};

export const TRIPS: Record<string, TripNotebook> = {
  'kabir-tokyo': {
    id: 'kabir-tokyo',
    ownerName: 'Kabir',
    ownerAvatarUri: KABIR.avatarUri,
    ownerHandle: '@kbr',
    destination: 'Tokyo',
    monthLabel: 'Mar 2026',
    days: 4,
    entryCount: 4,
    photoCount: 12,
    tipsUsedByFriends: 6,
    pins: [
      { idx: 1, label: 'Hotel K5', color: '#FF4D2E' },
      { idx: 2, label: 'Bricolage', color: '#FF3D87' },
      { idx: 3, label: 'Toraya', color: '#00A67E' },
      { idx: 4, label: 'Yanaka', color: '#FFB300' },
    ],
    entries: [
      {
        id: 'e1',
        category: 'stay',
        placeName: 'Hotel K5',
        area: 'Nihonbashi',
        dayLabel: 'Day 1',
        quote: 'Concrete, two books, a kettle. The river at 6am is the whole trip.',
        photoUri: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1200',
      },
      {
        id: 'e2',
        category: 'food',
        placeName: 'Bricolage Bread & Co.',
        area: 'Roppongi',
        dayLabel: 'Day 2 · morning',
        quote: 'Skip the bread. Get the soft-boiled egg sandwich. Twice.',
        photoUri: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=1200',
      },
      {
        id: 'e3',
        category: 'drinks',
        placeName: 'Toraya',
        area: 'Ginza',
        dayLabel: 'Day 3 · afternoon',
        quote: 'Matcha and a yokan. Sit by the garden window and stop talking.',
        photoUri: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=1200',
      },
      {
        id: 'e4',
        category: 'wander',
        placeName: 'Yanaka',
        area: 'Taito',
        dayLabel: 'Day 4',
        quote: 'Walk it before lunch. The cemetery is the best part nobody mentions.',
        photoUri: 'https://images.unsplash.com/photo-1568084680786-a84f91d1153c?w=1200',
      },
    ],
  },
};

export const getTrip = (id: string): TripNotebook | undefined => TRIPS[id];

// — Profile / Wrapped (Batch C #12, #15) ----------------------------------

export type MyProfile = {
  name: string;
  handle: string;
  avatarUri: string;
  tagline: string;
  trips: number;
  countries: number;
  tipsGiven: number;
  myTrips: ReadonlyArray<{
    id: string;
    destination: string;
    monthLabel: string;
    placesCount: number;
    coverUri: string;
  }>;
};

export const ME: MyProfile = {
  name: 'Shrey Arora',
  handle: '@shrey',
  avatarUri: 'https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=200',
  tagline: 'Cities mostly, mountains when the legs want it.',
  trips: 23,
  countries: 11,
  tipsGiven: 142,
  myTrips: [
    {
      id: 'kabir-tokyo',
      destination: 'Tokyo',
      monthLabel: 'Mar 2026',
      placesCount: 4,
      coverUri: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1200',
    },
    {
      id: 'mine-lisbon',
      destination: 'Lisbon',
      monthLabel: 'Feb 2026',
      placesCount: 6,
      coverUri: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=1200',
    },
    {
      id: 'mine-pondi',
      destination: 'Pondicherry',
      monthLabel: 'Jan 2026',
      placesCount: 3,
      coverUri: 'https://images.unsplash.com/photo-1583244532610-2a234e36cd60?w=1200',
    },
    {
      id: 'mine-pokhara',
      destination: 'Pokhara',
      monthLabel: 'Dec 2025',
      placesCount: 5,
      coverUri: 'https://images.unsplash.com/photo-1605640840605-14ac1855827b?w=1200',
    },
  ],
};

export type Wrapped = {
  yearLabel: string;
  cities: number;
  placesLogged: number;
  tipsGiven: number;
  tipsUsedByFriends: number;
  mostStolenTips: ReadonlyArray<{
    id: string;
    place: string;
    coverUri: string;
    usedCount: number;
  }>;
};

export const WRAPPED_2026: Wrapped = {
  yearLabel: 'MY 2026',
  cities: 9,
  placesLogged: 47,
  tipsGiven: 142,
  tipsUsedByFriends: 38,
  mostStolenTips: [
    {
      id: 'wt-1',
      place: 'Hotel K5',
      coverUri: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600',
      usedCount: 12,
    },
    {
      id: 'wt-2',
      place: 'Cervejaria Ramiro',
      coverUri: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=600',
      usedCount: 9,
    },
    {
      id: 'wt-3',
      place: 'Bricolage',
      coverUri: 'https://images.unsplash.com/photo-1568084680786-a84f91d1153c?w=600',
      usedCount: 7,
    },
    {
      id: 'wt-4',
      place: 'High Ultra Lounge',
      coverUri: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=600',
      usedCount: 5,
    },
  ],
};

// — Validation modal (Batch C #14) ----------------------------------------

export type Validation = {
  byFriend: Friend;
  placeName: string;
  destination: string;
  stayLabel: string;
  thankYou: string;
  tripsPowered: number;
  recsUsedThisYear: number;
};

export const SAMPLE_VALIDATION: Validation = {
  byFriend: TARA,
  placeName: 'Hotel K5',
  destination: 'Tokyo',
  stayLabel: 'Stayed 2 nights in Nihonbashi · Mar 18–20',
  thankYou: 'The river-side window was the trip. Thank you ✦',
  tripsPowered: 1,
  recsUsedThisYear: 12,
};

/** Returns a place detail by id, or undefined. */
export const getPlace = (id: string): PlaceDetail | undefined => PLACES[id];

/** Returns the destination matching a slug, or undefined. */
export const getDestination = (slug: string): DestinationSummary | undefined =>
  DESTINATIONS.find((d) => d.slug === slug);

/** Returns all friend recs filtered to a destination. */
export const recsForDestination = (slug: string): FriendRec[] =>
  FRIEND_RECS.filter((r) => r.destinationSlug === slug);

export { ALL_FRIENDS };
