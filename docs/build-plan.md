# Build plan — v0

The plan that takes us from empty repo to a TestFlight build with twenty real users. Five phases. Each phase is shippable in the sense that it leaves the codebase in a working, tested state. Each phase has a clear "done" definition.

This is the order in which Claude Code should build. Do not skip ahead. Do not parallelise unless explicitly told. The order matters because later phases assume the contracts established in earlier ones.

---

## Phase 0 — Foundations (3–4 days)

The point of this phase: establish the repo, the toolchain, the design system primitives, and the data layer. No product features. When this phase ends, we have an empty app that loads to a styled splash screen, can connect to Supabase, and has a working CI pipeline.

### 0.1 Repository scaffolding
- Initialise pnpm monorepo with the structure in `CLAUDE.md` §3.
- Set up Biome, TypeScript strict, shared `tsconfig.base.json`.
- Set up `apps/mobile` with Expo SDK and Expo Router.
- Set up `packages/shared` with empty `schemas/`, `types/`, `extractors/` folders.
- Set up `supabase/` with `config.toml` and an initial migration that creates extension `pgcrypto`.

### 0.2 CI pipeline (GitHub Actions)
- Workflow: `lint → typecheck → test → build`.
- Runs on every PR.
- Caches pnpm and Expo build artifacts.
- Posts EAS preview build links on PRs that touch `apps/mobile`.

### 0.3 Supabase setup
- Local Supabase via Docker.
- Initial migration: `users` table extending `auth.users`, with `handle`, `display_name`, `avatar_url`, `phone_hash`, `default_visibility`.
- `pnpm db:reset` script that drops, re-migrates, and seeds.
- `pnpm types:gen` script that pulls types from local Supabase into `packages/shared/src/types/db.ts`.

### 0.4 Design system primitives
- Restyle theme in `apps/mobile/src/theme/index.ts` with the tokens from `CLAUDE.md` §7.
- Load Newsreader and Inter via `expo-font`. Splash screen blocks until fonts load.
- Build the seven primitive components: `Text`, `Box`, `Button`, `Input`, `Textarea`, `Avatar`, `Pill`, `Card`, `PhotoFrame`.
- Storybook-style preview screen at `/dev/components` (gated by `__DEV__`) showing every primitive in every variant. This is the QA surface for the design system.

### 0.5 Logging and error infrastructure
- Configure Sentry for crashes and unhandled errors.
- Configure PostHog for events. PII scrubbing turned on at config level.
- Build the `log` helper that wraps both.
- Build the toast system (`useToast` hook + `ToastProvider`).

**Done when:** the app builds on iOS and Android via EAS, loads to a splash, transitions to a `/dev/components` screen showing every primitive correctly styled, fonts load, Sentry catches a deliberate crash, and CI is green.

---

## Phase 1 — Auth and onboarding (5–7 days)

The point of this phase: a real user can install the app, sign up with their phone number, and complete the six-screen onboarding flow. No trip logging yet.

### 1.1 Phone OTP via WhatsApp
- Configure Supabase Phone Auth with Twilio Verify.
- Twilio Verify configured to deliver via WhatsApp first, fall back to SMS.
- `useAuth` hook in `features/auth/api/`.
- Session persistence via Supabase's built-in storage adapter on top of `expo-secure-store`.
- Auth state synced to Zustand for non-async access.

### 1.2 Onboarding routes
File-based routes under `app/(auth)/`:
- `phone.tsx` — screen 1
- `framing.tsx` — screen 2
- `instagram.tsx` — screen 3
- `import.tsx` — screen 4 (conditional)
- `friends.tsx` — screen 5
- `welcome.tsx` — screen 6

Each screen uses the primitives from Phase 0. Pixel-level fidelity to the wireframes from the design brief.

### 1.3 Contacts matching (without Instagram, friends list is empty)
- `expo-contacts` for permission and read.
- Hash phone numbers client-side using SHA-256 with a public salt (the pepper is server-side).
- Edge function `match-contacts` that takes hashed phones and returns matched user IDs the caller is allowed to see.
- Populate `contact_matches` table.
- Friends screen uses this to show "already on the platform."

### 1.4 Default visibility setting
- Stored on `users.default_visibility`. Defaults to `friends_of_friends`.
- Set silently during onboarding (not a screen — the brief is explicit about this).

### 1.5 Onboarding analytics
- Event for each screen entered, each screen completed, each skip.
- Funnel from `phone.tsx` to `welcome.tsx` is the v0 north star metric for activation.

**Done when:** a real device can install, sign up with a real phone number, complete all six onboarding screens, see at least an empty friends list, and land on the home tab. The user is now in a logged-in state with a row in `users`. Sentry and PostHog are receiving events.

---

## Phase 2 — Trip logging (7–10 days)

The point of this phase: the screen the brief calls out as the heaviest-lifting. If logging feels light, the rest of the product works. Build this carefully.

### 2.1 Migrations
- `trips` table
- `places` table
- `venues` table
- `areas` table
- `tips` table (polymorphic parent)
- `trip_photos` table
- RLS policies for all of the above (see `docs/architecture.md` for the policy patterns)

### 2.2 Zod schemas in `packages/shared`
- `TripSchema`, `PlaceSchema`, `VenueSchema`, `AreaSchema`, `TipSchema`
- Input variants (without server-generated fields) and output variants (with all fields)
- Single source of truth — derive TS types via `z.infer`

### 2.3 The log screen (`app/(tabs)/log.tsx`)
- Two modes: Quick (default) and Detailed
- Quick: title, dates, single prose note, single place pre-filled from title
- Detailed: title, dates, multiple places each with their own optional note, overall trip prose
- Privacy pill at the bottom showing current visibility, "Change" link to a sheet
- Save button creates the trip optimistically
- Form built with React Hook Form + Zod resolver

### 2.4 Entity extraction
- Edge function `extract-entities` triggered after trip save
- Inputs: trip note, place notes, available metadata (title, dates, places)
- Outputs: array of staged entities into `extracted_entities` table
- The prompt and extraction logic live in `packages/shared/src/extractors/`
- Prompt versioning: every extraction record stores the prompt version it used
- The model used is Claude Sonnet (configurable via env var)

### 2.5 Confirmation flow
- After save, the user is taken to a confirmation screen showing the extracted entities
- Each entity can be: confirmed (creates the real `venue`/`area`/`tip`), edited (modify name, kind, area assignment), or rejected
- Bulk confirm: "Looks good — save all"
- Confirmation is required before the trip's entities become searchable
- Confirmation can be deferred — the trip is saved either way; entities are staged

### 2.6 Trip detail view (`app/trip/[id].tsx`)
- Read-only view of the trip
- Shows: cover photo, title, dates, prose note, places, venues grouped by kind, areas, tips
- Friend's voice (italic serif quotes) on each entity
- Privacy indicator
- Edit button (own trips only)

### 2.7 Photo upload
- `expo-image-picker` for selection
- Strip EXIF GPS server-side via edge function before final storage
- Multiple photo upload with progress indicators
- Photos stored in Supabase Storage with public-read but row-level access via signed URLs for private trips
- Cover photo selection — first photo by default, can be reassigned

**Done when:** a user can log a trip in either Quick or Detailed mode, see extracted entities, confirm or edit them, view the saved trip, and edit it later. Optimistic updates work. Offline logging queues and replays on reconnect. The trip is visible to the right people per RLS.

---

## Phase 3 — Search and friend graph (5–7 days)

The point of this phase: the WhatsApp-replacement test. If a user can type "Pokhara" and see their friends' notes faster than they could WhatsApp Divyansh, the thesis is alive.

### 3.1 Search infrastructure
- Postgres full-text search on `places.name`, `venues.name`, `areas.name`, `tips.body`
- A SQL function `search_friend_graph(query, user_id)` that combines FTS results across tables, applies RLS, and returns ranked results
- TanStack Query hook `useSearch(query)` with 300ms debounce

### 3.2 Search screen (`app/(tabs)/search.tsx`)
- Search bar with type-ahead
- Filter pills: All, Stays, Eat, Areas, Tips
- Results grouped by entity kind, sorted by recency
- Each result shows: friend avatar + name, entity name, area, friend's italic quote, time ago
- Tap result → trip detail view scrolled to that entity

### 3.3 Friend profile (`app/friend/[handle].tsx`)
- Header: avatar, name, stats (trips, countries, follow status)
- Tabs: Trips, Stays, Places, Tips
- Trips tab is default — reverse chronological
- Other tabs are derived views — places they've been to, stays they've recommended, tips they've left

### 3.4 Follow / unfollow
- Mutations on `follows` table
- Optimistic UI on the follow button
- Edge function recomputes the materialised view of friends-of-friends for the affected users

**Done when:** a user can search and see results from friends and friends-of-friends only, filtered by kind, ranked by recency. They can visit a friend's profile and see all four views. Follow/unfollow works and updates visibility within seconds.

---

## Phase 4 — Feed and Instagram import (5–7 days)

The point of this phase: the surfaces that make the app feel alive on day one and that solve the cold-start problem.

### 4.1 Feed (`app/(tabs)/feed.tsx`)
- Reverse chronological list of friends' trips
- Card layout per the design brief — cover photo framed, friend meta, trip title in italic serif, snippet, entity pills
- Pull to refresh
- Infinite scroll with TanStack Query's `useInfiniteQuery`
- Empty state: own trips if the user has logged any, otherwise the welcome message

### 4.2 Instagram import
- OAuth flow via Instagram Basic Display API
- Edge function `import-instagram` that:
  - Fetches the user's recent posts (last 18 months)
  - Clusters by location and timestamp into proposed trips
  - Returns proposed trips with photos, dates, and inferred place names
- Import screen (revisited from Phase 1) shows clustered trips with checkboxes
- Confirmed clusters become draft trips
- The user is then walked into the log screen for each draft to add prose
- Drafts that don't get prose remain as photo-only trips and are flagged in the user's profile

### 4.3 Cold-start invite flow
- Invite three friends from contacts
- Pre-filled WhatsApp message via deep link with personalised invite text
- Track invites for analytics

**Done when:** a user with imported Instagram data sees their travel history populated, the feed shows friend activity for users who follow at least one other person, and the invite flow works end-to-end.

---

## Phase 5 — Polish, performance, and TestFlight (5–7 days)

The point of this phase: ship to twenty real users.

### 5.1 Performance audit against budgets in `CLAUDE.md` §11
- Profile cold start, fix anything over 2s
- Profile feed scroll, fix any frame drops
- Profile search, fix any over 500ms
- Image loading: confirm size variants are being served correctly

### 5.2 Crash and error pass
- Sentry triage
- Edge function error logs
- Supabase RLS audit (run a test user against a controlled dataset)

### 5.3 Accessibility minimums
- Semantic labels on all interactive elements
- Sufficient contrast verified against WCAG AA on primary text
- Tap target audit — minimum 44x44

### 5.4 TestFlight and Play Internal
- EAS Build for production targets
- TestFlight set up with twenty seed users
- Play Internal track with the same users

### 5.5 Onboarding the first 20 users
- Personalised invite to each
- Brief 10-minute call with each to walk through expectations
- A single shared Notion doc for them to drop feedback into
- A weekly review session to triage feedback

**Done when:** twenty real users have the app installed, have logged at least one trip each, and are showing up in each other's feeds. The product instinct test from the design brief now has data behind it.

---

## What comes after v0

If the WhatsApp-replacement test passes — meaning users in the same friend group prefer the platform over WhatsApp asks for trip planning — these are the v1 candidates, in rough priority order:

1. **Map view** — friend recommendations on a map, filtered by trip date and friend
2. **Push notifications** — only for "a friend logged a trip in a place you've been"
3. **Comments on trips** — to capture the follow-up question dynamic that WhatsApp does today
4. **Group trips** — multi-author trips for friends who travel together
5. **Dark mode**
6. **Web app** — read-only first, then full
7. **Tablet layouts**
8. **Public profiles** — opt-in only, for the cohort that wants to share more broadly

None of these are decided. They are candidates for the post-v0 conversation.
