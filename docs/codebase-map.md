# Codebase map

A navigable index of the `journal` monorepo (product name **lore.** — see [ADR 0007](./decisions/0007-rename-to-lore.md)). Start here when you don't know where something lives.

- The root [`CLAUDE.md`](../CLAUDE.md) is the **constitution** (intent, rules, out-of-scope).
- This file is the **map** (what actually exists and where).
- Nested `CLAUDE.md` files give area-specific conventions:
  - [`apps/mobile/CLAUDE.md`](../apps/mobile/CLAUDE.md) — app routing, theme, components, providers
  - [`apps/mobile/src/features/CLAUDE.md`](../apps/mobile/src/features/CLAUDE.md) — feature-module + data-layer conventions
  - [`packages/shared/CLAUDE.md`](../packages/shared/CLAUDE.md) — schemas, types, extractors
  - [`supabase/CLAUDE.md`](../supabase/CLAUDE.md) — migrations, RLS, RPCs, edge functions

> **Drift note.** The codebase has moved ahead of the root constitution in several places. Where they disagree, code wins; this map records reality. Known drift is listed in the [Reality vs. constitution](#reality-vs-constitution) section at the bottom.

---

## Top-level layout

```
journal/
├── apps/mobile/          Expo app (iOS + Android + web smoke-test)  — the only client
├── packages/shared/      Cross-target Zod schemas, domain types, extractors, phone utils
├── supabase/             Local Supabase config, SQL migrations, edge functions
├── docs/                 Architecture, data model, design system, ADRs, ops, this map
├── scripts/              One-off maintenance scripts (curated destinations)
├── CLAUDE.md             Constitution (read every session)
├── biome.json            Lint + format config (Biome, not ESLint/Prettier)
├── pnpm-workspace.yaml   Workspaces: apps/*, packages/*
└── tsconfig.base.json    Shared TS config (strict)
```

Workspace packages: `@journal/mobile`, `@journal/shared`.

---

## Commands (root `package.json`)

| Command | What it does |
|---|---|
| `pnpm lint` / `pnpm lint:fix` | Biome check / autofix |
| `pnpm typecheck` | `tsc` across all workspaces |
| `pnpm test` | Vitest across all workspaces |
| `pnpm mobile <script>` | Run a script in `@journal/mobile` (e.g. `pnpm mobile web`) |
| `pnpm db:start` / `db:stop` / `db:reset` | Local Supabase lifecycle |
| `pnpm types:gen` | Regenerate `packages/shared/src/types/db.ts` from local Supabase |

CI (`.github/workflows/ci.yml`) runs lint → typecheck → test → build on every PR.

---

## Mobile app — routes → screens

Expo Router, file-based, under `apps/mobile/app/`. Route files are thin; they delegate to screen components in `src/features/*/screens/`. Auth gating and provider setup live in `app/_layout.tsx`.

**Tab bar (five tabs, custom `FloatingTabBar`):** Book · Search · Add · Friends · You.

| Route file | Screen / feature | Notes |
|---|---|---|
| `app/_layout.tsx` | — | Providers + `AuthGate` (redirects by session/onboarding state) |
| `app/index.tsx` | — | Redirect to `(auth)/welcome` (or dev hint if unconfigured) |
| `app/(auth)/welcome.tsx` | onboarding/welcome | |
| `app/(auth)/login.tsx` | onboarding/login | Pilot anonymous auth ([ADR 0004](decisions/0004-pilot-anonymous-auth.md)) |
| `app/(auth)/framing.tsx` | onboarding/framing | |
| `app/(auth)/circle.tsx` | onboarding/circle | |
| `app/(auth)/taste-makers.tsx` | onboarding/taste-makers | |
| `app/(auth)/friends.tsx` | onboarding/friends | Contacts matching |
| `app/(tabs)/book.tsx` | feed | "Book" tab = the feed |
| `app/(tabs)/search.tsx` | search | |
| `app/(tabs)/add.tsx` | trips/log | Raised coral "Add" disc |
| `app/(tabs)/friends.tsx` | activity | "Friends" tab = activity stream |
| `app/(tabs)/you.tsx` | profile | Own profile |
| `app/(tabs)/trip/[id]/index.tsx` | trips/trip-detail | Hidden route (`href: null`) |
| `app/(tabs)/trip/[id]/edit.tsx` | trips/edit-trip | |
| `app/(tabs)/trip/[id]/confirm.tsx` | trips/confirm | Entity-confirmation flow |
| `app/(tabs)/trip-notebook/[id].tsx` | trips/trip-notebook | |
| `app/(tabs)/place/[id].tsx` | places/place-redesigned | |
| `app/(tabs)/destination/[slug].tsx` | destinations/destination | |
| `app/(tabs)/list/[id].tsx` | lists/list-detail | |
| `app/(tabs)/list/new.tsx` | lists/create-list | |
| `app/(tabs)/friend/[handle].tsx` | profile/friend-profile | |
| `app/(tabs)/map.tsx` | map | |
| `app/(tabs)/wishlist.tsx` | wishlist | |
| `app/(tabs)/year-in-travel.tsx` | year-in-travel | |
| `app/(tabs)/house-rules.tsx` | legal/house-rules | |
| `app/wrapped.tsx` | wrapped | Year-end summary |
| `app/validation.tsx` | validation | |
| `app/dev/components.tsx` | — | Design-system preview (`__DEV__`) |

---

## Feature modules

Under `apps/mobile/src/features/`. Each owns `api/` (TanStack Query hooks + `keys.ts`), `components/`, `screens/`, optional `lib/`/`state.ts`, and an `index.ts` public barrel. Details in [features/CLAUDE.md](../apps/mobile/src/features/CLAUDE.md).

| Feature | Purpose |
|---|---|
| `activity` | Friends-tab activity stream (trip added, follow started, list created) |
| `auth` | Session + profile CRUD + avatar upload; Zustand mirror of Supabase auth |
| `destinations` | Canonical-destination display screen |
| `feed` | Infinite-scroll, RLS-filtered friend trips + love counts (the "Book" tab) |
| `follows` | Follow/unfollow (optimistic) + status/counts; phone-for-friend lookup |
| `invite` | WhatsApp invite deep-link builder + button |
| `legal` | House-rules / policy screen |
| `lists` | User lists + polymorphic list items; `ListPickerSheet` |
| `map` | Map view of places |
| `onboarding` | welcome → login → framing → circle → taste-makers → friends |
| `places` | Canonical place aggregation + friend-graph sightings |
| `profile` | Own + friend profiles; user trips/stats/favourites |
| `search` | Debounced full-text search via `search_friend_graph` RPC |
| `trips` | Trip CRUD, atomic logs, extracted entities, photo upload |
| `validation` | Validation / recovery screen |
| `verdicts` | love / mid / skip sentiment upsert on trip/city/venue |
| `wishlist` | Save destinations/cities to a wishlist |
| `wrapped` | Year-end "wrapped" summary |
| `year-in-travel` | Year-in-travel summary |

---

## Shared design-system components

`apps/mobile/src/components/` (barrel `index.ts`). Restyle-based. No raw `View`/`Text`/`TextInput` in feature code.

- **Restyle primitives:** `Box`, `Text` (theme variants + color props)
- **Controls:** `Button`, `Input`, `Textarea`, `Pill`, `CategoryPill`, `VerdictPicker`, `PlacePicker`
- **Layout / chrome:** `Page`, `StatusSpace`, `Nav`, `DetailHeader`, `FloatingTabBar`
- **Content:** `Card`, `Photo`, `PhotoFrame`, `PullQuote`, `Eyebrow`, `EyebrowLabel`, `Wordmark`
- **People:** `Avatar`, `Face`, `FaceStack`
- **Feedback:** `Toast` / `ToastProvider` (+ `useToast` in `src/hooks/`)

Theme + tokens live in `src/theme/index.ts`. See [apps/mobile/CLAUDE.md](../apps/mobile/CLAUDE.md).

---

## Infrastructure libs

`apps/mobile/src/lib/`:

| File | Purpose |
|---|---|
| `supabase.ts` | Singleton client via `getSupabase()`; secure storage adapter |
| `log.ts` | Unified logger → console (dev) / Sentry breadcrumbs / PostHog events |
| `storage.ts` | Auth storage adapter (SecureStore + AsyncStorage; localStorage on web) |
| `google-places.ts` | Google Places v1 wrapper (autocomplete, details, session tokens) |
| `phone-hash.ts` | Client SHA-256 phone hashing (server applies pepper) |
| `country-lookup.ts`, `hero-photo.ts`, `use-hero-photo.ts` | Country + hero-photo helpers |
| `posthog.ts`, `sentry.ts` | Analytics + error-tracking init with PII scrubbing |

---

## Backend

`supabase/` — 30+ numbered migrations, edge functions, config. See [supabase/CLAUDE.md](../supabase/CLAUDE.md).

**Core tables:** `users`, `trips`, `cities` (formerly `places`), `venues` (now first-class *atomic logs*), `areas`, `tips`, `trip_photos`, `extraction_runs`, `extracted_entities`, `follows`, `contact_matches`, `destinations`, `lists`, `list_items`, `wishlist_items`, `activity`, `verdicts`, `countries`.

**Key RPCs/views:** `search_friend_graph()`, `is_visible_to()`, `me()`, `me_stats()`, `verdict_counts()`, `resolve_google_place()`, `insert_atomic_log()`, `get_phone_for_friend()`; views `canonical_places`, `public_profiles`, `trip_with_verdict_counts`, `mv_friends_of_friends`.

**Edge functions:** `extract-entities` (Claude entity extraction), `match-contacts` (hashed contact matching), `stamp-phone-hash` (phone-hash + E.164 stamping), `_shared/cors.ts`.

---

## Shared package

`packages/shared/src/`:

- `schemas/` — Zod source of truth (`trip.ts`, `list.ts`, `atomic-log.ts`, `index.ts`). Pattern: `*InputSchema` → `*Schema`, types via `z.infer`.
- `types/` — domain types + generated `db.ts` (via `pnpm types:gen`).
- `extractors/` — entity-extraction prompt (`prompts/v0.ts`) + payload types, shared by client and the `extract-entities` edge function.
- `phone.ts` — `normalizePhone` / `isLikelyValidPhone` (E.164), used client- and server-side.

---

## Reality vs. constitution

Where the running code has diverged from the root `CLAUDE.md`. Flagged so nobody "fixes" the mismatch by mistake:

- **Name:** product is **lore.**; repo/workspace identifiers stay `journal`/`postmark` ([ADR 0007](decisions/0007-rename-to-lore.md)).
- **Tabs:** IA is **Book / Search / Add / Friends / You**, not the constitution's `feed/search/log/profile`.
- **Auth:** pilot uses **anonymous auth** ([ADR 0004](decisions/0004-pilot-anonymous-auth.md)), not WhatsApp/Twilio phone OTP.
- **Theme:** accent is **coral `#FF4D2E`** on a **white** ground (not terracotta on warm off-white); fonts are **Instrument Serif (italic) + Geist + JetBrains Mono**, not Newsreader + Inter.
- **`places` → `cities`:** the "place" table was renamed to `cities`; a canonical geographic hierarchy (`countries` → `cities` → `areas` → `venues`) was added ([ADR 0011](decisions/0011-geographic-hierarchy.md)).
- **New domain concepts** not in the constitution: **atomic logs** (venues as first-class recommendations), **verdicts** (love/mid/skip), **lists** (polymorphic items), **wishlist**, **activity stream**, **wrapped / year-in-travel**.
