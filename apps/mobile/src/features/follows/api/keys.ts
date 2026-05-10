export const followKeys = {
  all: ['follows'] as const,
  status: (followedId: string) => [...followKeys.all, 'status', followedId] as const,
  following: (userId: string) => [...followKeys.all, 'following', userId] as const,
  followers: (userId: string) => [...followKeys.all, 'followers', userId] as const,
  counts: (userId: string) => [...followKeys.all, 'counts', userId] as const,
};
