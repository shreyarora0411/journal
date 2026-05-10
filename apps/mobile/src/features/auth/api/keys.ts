export const authKeys = {
  profile: (userId: string) => ['auth', 'profile', userId] as const,
};
