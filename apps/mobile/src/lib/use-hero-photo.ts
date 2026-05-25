import { useQuery } from '@tanstack/react-query';
import { type HeroPhoto, type PlaceRowForHero, resolveHeroPhoto } from './hero-photo';

/**
 * Cached hero-photo lookup. `staleTime: Infinity` is intentional — once
 * a place's hero is resolved, the cache row is the source of truth
 * forever (until a future invalidation flow ships).
 */
export const useHeroPhoto = (place: PlaceRowForHero | null | undefined) =>
  useQuery({
    queryKey: ['hero-photo', place?.id],
    enabled: Boolean(place?.id),
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async (): Promise<HeroPhoto> => {
      if (!place) return null;
      return resolveHeroPhoto(place);
    },
  });
