# Feature modules — conventions

How feature modules under `apps/mobile/src/features/` are built. Complements root [`CLAUDE.md`](../../../../CLAUDE.md) §4 and [`apps/mobile/CLAUDE.md`](../../CLAUDE.md).

---

## Module shape

```
features/<feature>/
├── api/          TanStack Query hooks + keys.ts (Supabase reads/writes)
├── components/   Components used only inside this feature
├── screens/      Screen-level components rendered by app/ routes
├── lib/          Feature-local helpers (optional)
├── state.ts      Zustand store (only where needed, e.g. auth)
└── index.ts      Public API barrel — the ONLY cross-feature entry point
```

- **`index.ts` exports the public surface only** (hooks, key factories, screens, exported types). Import features via the barrel, e.g. `import { useMyTrips, tripKeys } from '@/features/trips'` — never deep-import another feature's internals.
- Cross-feature sharing goes through `@/components` (UI) or `@/lib` (infra), not feature-to-feature.
- Keep modules under ~15 files; split when they grow (root §4).

---

## Data layer (TanStack Query + Supabase)

Every Supabase call is wrapped in a hook in `api/`. No raw Supabase in screens/components.

### Query keys — one `keys.ts` per feature, hierarchical
```ts
export const tripKeys = {
  all: ['trips'] as const,
  lists: () => [...tripKeys.all, 'list'] as const,
  list: (userId: string | null) => [...tripKeys.lists(), userId] as const,
  detail: (id: string) => [...tripKeys.all, 'detail', id] as const,
  children: (id: string) => [...tripKeys.detail(id), 'children'] as const,
};
```
Always key off these factories so invalidation stays consistent. Include the acting `userId` in list keys.

### Queries
```ts
export const useMyTrips = () => {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: tripKeys.list(userId),
    enabled: Boolean(userId),          // gate on auth
    queryFn: async () => {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('trips').select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)         // soft-delete filter, always
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Trip[];
    },
  });
};
```
Conventions: acting user via `useAuthStore((s) => s.session?.user.id ?? null)`; client via `getSupabase()`; `enabled` gates on prerequisites; **always filter `deleted_at IS NULL`**; throw on `error` (a shared boundary surfaces a toast).

### Mutations
```ts
export const useCreateTripQuick = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input) => { /* sequential inserts, throw on error */ },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: tripKeys.list(userId) });
      qc.invalidateQueries({ queryKey: tripKeys.detail(result.trip.id) });
    },
  });
};
```
- **Side effects are fire-and-forget:** the `extract-entities` edge function and `activity`-stream inserts are `.catch()`-swallowed best-effort — they must not fail the primary write.
- Log outcomes with `log.event('trip.created', …)`.

### Optimistic updates (create/update/delete default — root §8)
`follows/api/use-follow.ts` is the reference: `onMutate` cancels in-flight queries, snapshots, sets the optimistic value; `onError` rolls back from the snapshot; `onSettled` invalidates. Follow this shape for follow/unfollow, verdicts, wishlist toggles.

### RPCs & infinite queries
- Complex reads/writes call Postgres RPCs via `supabase.rpc(...)`: search (`search_friend_graph`), atomic logs (`resolve_google_place` → `insert_atomic_log`), stats (`me_stats`), verdicts.
- Paginated lists use `useInfiniteQuery` with a timestamp cursor (`feed/api/use-feed.ts`, `PAGE_SIZE = 10`), backed by an RLS-aware view.

---

## Feature index

| Feature | Purpose | Notable api/ |
|---|---|---|
| `activity` | Friends-tab activity stream; buckets events client-side (today/…/earlier) | `use-activity` |
| `auth` | Session + profile CRUD + avatar upload; Zustand mirror (`state.ts`) | `use-auth-session`, `use-profile`, `use-update-profile`, `use-upload-avatar` |
| `destinations` | Canonical-destination display screen | — |
| `feed` | Infinite friend-trip feed (RLS view) + love counts | `use-feed` |
| `follows` | Follow/unfollow (optimistic), status/counts, phone-for-friend | `use-follow`, `use-follow-status`, `use-get-phone-for-friend` |
| `invite` | WhatsApp invite deep-link builder + button | — (`lib/invite-link`) |
| `legal` | House-rules / policy screen | — |
| `lists` | Lists + polymorphic items; `ListPickerSheet` | `use-lists`, `use-list-items`, `use-add-polymorphic-item`, `use-lists-containing` |
| `map` | Map of places | `use-map-data` |
| `onboarding` | welcome → login → framing → circle → taste-makers → friends | `use-match-contacts`, `use-matched-friends` |
| `places` | Canonical place aggregation + friend-graph sightings | `use-canonical-place` |
| `profile` | Own + friend profiles; trips, stats, favourites | `use-user-by-handle`, `use-user-trips`, `use-me-stats`, `use-favourite-four` |
| `search` | Debounced (300ms, min 2 chars) full-text search RPC | `use-search`, `use-discover` |
| `trips` | Trip CRUD, atomic logs, extracted entities, photo upload | `use-trips`, `use-create-trip`, `use-trip`, `use-atomic-log(s)`, `use-extracted-entities`, `use-upload-photo` |
| `validation` | Validation / recovery screen | — |
| `verdicts` | love/mid/skip upsert on trip/city/venue | `use-set-verdict` |
| `wishlist` | Save destinations/cities; tracks origin trip/user | `use-wishlist`, `use-wishlist-toggle` |
| `wrapped` | Year-end "wrapped" summary screen | — |
| `year-in-travel` | Year-in-travel summary screen | — |

---

## Domain concepts (beyond root §5)

- **Atomic logs** — venue-level recommendations that are first-class rows in `venues` (`category` = stay/food/drinks/wander/buy, `one_line` + `prose`). Created via Google Places pick → `resolve_google_place` → `insert_atomic_log`. Have their own visibility and can belong to multiple lists.
- **Verdicts** — one `(user, target_type, target_id)` sentiment of **love / mid / skip** (`target_type` = trip | city | venue), upserted; aggregated into feed `love_count` via `trip_with_verdict_counts`.
- **Lists (polymorphic)** — `list_items` uses `(target_type, target_id)` for trips/cities/venues. Legacy `destination_id`/`city_id` columns preserved for back-compat; new writes use the polymorphic path.
- **Wishlist** — separate `wishlist_items`; records `saved_from_trip_id` / `saved_from_user_id`.
- **Cities/Destinations** — `places` was renamed `cities`; a canonical `countries → cities → areas → venues` hierarchy exists. UI "places" = canonical cities via the `canonical_places` view.
