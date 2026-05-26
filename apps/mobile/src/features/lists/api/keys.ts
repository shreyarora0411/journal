export const listKeys = {
  all: ['lists'] as const,
  mine: (userId: string | null) => [...listKeys.all, 'mine', userId] as const,
  ofUser: (userId: string) => [...listKeys.all, 'user', userId] as const,
  detail: (id: string) => [...listKeys.all, 'detail', id] as const,
  items: (id: string) => [...listKeys.all, 'items', id] as const,
  containing: (userId: string | null, targetType: string, targetId: string) =>
    [...listKeys.all, 'containing', userId, targetType, targetId] as const,
};

export const wishlistKeys = {
  mine: (userId: string | null) => ['wishlist', userId] as const,
};
