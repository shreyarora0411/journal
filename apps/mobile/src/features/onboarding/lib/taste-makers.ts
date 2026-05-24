/**
 * Cold-start "taste-makers" fixture for the conditional fallback screen
 * (Batch A #04). Shown when contacts + Instagram both produce zero
 * matches. Hardcoded for the pilot; ranking + real follows lookup move
 * to a Supabase view post-v0.
 *
 * Each entry is a verified traveler whose recommendations seed the user's
 * feed until their real circle joins.
 */
export type TasteMaker = {
  id: string;
  name: string;
  handle: string;
  bio: string;
  avatarUri: string;
  /** "Following 3 of your friends" / "12 trips · 4 countries" — relationship cue. */
  cue: string;
};

/**
 * Session 2 lock: ship the holding state, not stock-photo strangers.
 * When real curated travelers are vouched-for (with permission), they'll
 * replace this array. Until then the Taste-makers screen renders the
 * empty "Coming soon" state below the eyebrow.
 */
export const TASTE_MAKERS: ReadonlyArray<TasteMaker> = [];

const _DEFERRED_TASTE_MAKER_FIXTURES: ReadonlyArray<TasteMaker> = [
  {
    id: 'tm-1',
    name: 'Tara Chandra',
    handle: '@tarac',
    bio: 'Writer. Lives between Goa and Tokyo.',
    avatarUri: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200',
    cue: '12 trips · 8 countries',
  },
  {
    id: 'tm-2',
    name: 'Kabir Mehta',
    handle: '@kbr',
    bio: 'Architecture nerd. Walks every city.',
    avatarUri: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200',
    cue: '18 trips · 11 countries',
  },
  {
    id: 'tm-3',
    name: 'Divyansh Rao',
    handle: '@div',
    bio: 'Eats his way through cities.',
    avatarUri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
    cue: '24 trips · 9 countries',
  },
  {
    id: 'tm-4',
    name: 'Anya Patel',
    handle: '@anya',
    bio: 'Mountains over beaches, every time.',
    avatarUri: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200',
    cue: '15 trips · 6 countries',
  },
];
