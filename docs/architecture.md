# Architecture

Living document. Update as the system grows. Companion to [data-model.md](./data-model.md) and [build-plan.md](./build-plan.md).

## Runtime topology

```
┌──────────────────┐     ┌─────────────────────────────────┐
│  Expo app (iOS,  │     │  Supabase                       │
│  Android)        │ ◄──►│  ├─ Postgres (RLS)              │
│  - Expo Router   │     │  ├─ Auth (Phone OTP via Twilio) │
│  - Restyle UI    │     │  ├─ Storage (photos)            │
│  - Zustand       │     │  ├─ Realtime                    │
│  - TanStack Q    │     │  └─ Edge Functions (Deno)       │
└──────────────────┘     └─────────────────────────────────┘
                                     │
                         ┌───────────┼───────────┐
                         ▼           ▼           ▼
                    Anthropic  Twilio Verify  Instagram
                    (Sonnet)   (WhatsApp/SMS)  Basic Display
```

## Layers (in the mobile app)

| Layer | Responsibility |
|---|---|
| `app/` | Routes only. No business logic. Each route is a thin wrapper that imports a screen from a feature. |
| `src/features/<feature>/screens` | Composition of components into a screen. |
| `src/features/<feature>/components` | Feature-local components. |
| `src/features/<feature>/api` | TanStack Query hooks wrapping Supabase calls. |
| `src/components` | Cross-feature design system primitives. |
| `src/lib/supabase.ts` | Single Supabase client. Configured once. |
| `src/theme` | Restyle theme tokens + types. |
| `src/hooks` | Cross-feature hooks (auth state, network, theme). |
| `packages/shared` | Zod schemas, generated DB types, domain types, extractor logic. Imported by mobile and edge functions. |

## RLS policy patterns

Every table has RLS enabled. Default deny. Policies live next to the table's migration.

### Pattern 1 — owner can do anything

```sql
create policy "owner full access" on <table>
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

### Pattern 2 — readers gated by trip visibility

For child entities (places, venues, areas, tips, trip_photos), the read policy joins to the parent trip and uses the `is_visible_to(viewer, trip)` SQL function.

```sql
create policy "trip-visible read" on places
  for select using (
    is_visible_to(auth.uid(), (select t.* from trips t where t.id = trip_id))
  );
```

### Pattern 3 — friends-of-friends via materialised view

The `mv_friends_of_friends` materialised view stores the FoF graph. Refreshed via a trigger on `follows` insert/delete. RLS uses an indexed lookup against this view, never a recursive CTE on the request path.

### `is_visible_to(viewer_id, trip)` function (pseudocode)

```
case trip.visibility
  when 'everyone' then true
  when 'followers' then exists (select 1 from follows where follower_id = viewer_id and followed_id = trip.user_id)
  when 'friends_of_friends' then exists (select 1 from mv_friends_of_friends where viewer_id = viewer_id and target_id = trip.user_id)
end
```

The owner always sees their own rows regardless of visibility — Pattern 1 covers that.

## Edge functions

| Function | Trigger | Purpose |
|---|---|---|
| `match-contacts` | Client RPC | Accepts hashed phones, returns matched user IDs the caller can see. |
| `extract-entities` | Client RPC after trip save | Calls Anthropic, writes to `extracted_entities`. |
| `import-instagram` | Client RPC after IG OAuth | Pulls posts, clusters into proposed trips. |
| `strip-exif` | Storage object insert | Strips EXIF GPS, writes coords to the `place`/`trip_photo` row. |

## Networking conventions

- All Supabase calls go through TanStack Query hooks in `features/<feature>/api/`.
- Query keys: `[feature, operation, ...params]`. Document new keys in the feature's `api/keys.ts`.
- Mutations use optimistic updates by default. On error, rollback + toast.
- Offline: TanStack Query persists to AsyncStorage. Mutations queue and replay on reconnect.

## Privacy boundaries

- Phone numbers are hashed with SHA-256 + a server-held pepper before any matching.
- The client only ever sees other users' user IDs and public profile fields, never raw phones.
- Photo EXIF is stripped server-side before storage; GPS is extracted into structured fields first.
- PostHog and Sentry have PII scrubbers configured in `lib/log.ts`.

## Decisions

ADRs live in [decisions/](./decisions/). Read those before changing anything they cover.
