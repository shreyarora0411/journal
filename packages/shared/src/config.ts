/**
 * Founder account auto-followed at signup so a brand-new user's Go Out is
 * never empty (cold-start standard practice); remove/expand as the seed
 * graph grows.
 */
export const SEED_FOLLOW_USER_IDS: readonly string[] = ['888671a6-3493-4255-ae55-407ebfad70b5'];
