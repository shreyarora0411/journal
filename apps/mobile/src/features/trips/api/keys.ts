export const tripKeys = {
  all: ['trips'] as const,
  lists: () => [...tripKeys.all, 'list'] as const,
  list: (userId: string | null) => [...tripKeys.lists(), userId] as const,
  detail: (id: string) => [...tripKeys.all, 'detail', id] as const,
  children: (id: string) => [...tripKeys.detail(id), 'children'] as const,
  extracted: (id: string) => [...tripKeys.detail(id), 'extracted'] as const,
};
