# CLAUDE.md
This file is the constitution for this repository. Claude Code reads it on every session. It defines what we are building, how the code is organised, what the conventions are, and what is out of scope. When in doubt, this document wins. When this document is silent, ask before deciding.
---
## 0. CURRENT MODEL — v3.1 (READ FIRST; this supersedes the trip-era text below)
The product pivoted from "log trips → an LLM extracts entities" to a **no-LLM, voice-first VOUCH model**. Wherever §1/§4/§5 below describe trips, entity extraction, Instagram import, venues/areas/tips, Twilio WhatsApp OTP, or Newsreader/Inter fonts, treat **this section as canonical** — those are historical. Full current state, decisions, and the next build live in the persistent memory (`~/.claude/.../memory/MEMORY.md`): consumer-psych principles, MVP priorities (shipped + open), and the profile/friends design.

- **Working name:** "Vouched" (codename `journal`). iOS-first via Expo; audience unchanged (affluent metro-India, 25–40).
- **The atom is the VOUCH, not the trip.** A vouch = a friend's voiced free-text rec + `vouch_type` (`stay`/`eat_drink`/`do`/`nightlife`/`good_to_know`/`skip`) + `destination_text` + optional `place_id`. The user typed it into a category slot — **no LLM extraction**. Quotes are immutable (voice is the moat). **No stars/scores ever. No generic place photos.**
- **Lists are optional containers** — vouch ↔ list is M2M via `vouch_list_items`; a vouch can be standalone. The composer "fast door" (Add tab) logs standalone vouches with no list; lists are a curation layer created from Profile.
- **Places:** vouches link to canonical venues — `canonical_places` (keyed on `google_place_id` + lat/lng), resolved in the background client-side via `apps/mobile/src/lib/google-places.ts`. "Open in Maps" drops a precise pin. The Places key must have *Places API (New)* + billing; `EXPO_PUBLIC_GOOGLE_PLACES_KEY_*` is client-exposed — restrict before prod.
- **Trust graph IS relevance (no taste-similarity engine, by design).** `follows` carry `status` (`pending`/`accepted`/`blocked`) + `trust_contexts[]` (domain-specific trust, learned behaviorally from saves + act-on-it). `search_vouches` ranks: relationship tier (own 1.00 / trusted+context 0.95 / direct 0.85 / friend-of-a-friend 0.60 / stranger 0.40) ×.55 + query-fit ×.25 + specificity ×.15 + freshness ×.05; `skip` de-ranked ×0.70.
- **Auth:** Supabase **anonymous + phone-keyed recovery** (NOT Twilio WhatsApp OTP). `users.phone_hash` is unique. **No push (v0)** — payoff/return is pull-based.
- **Fonts:** **Playfair Display** (serif; italic for quotes) + **DM Sans** (sans). NOT Newsreader/Inter. Note: emoji (🔖/📍) render as a "?" box in these custom fonts — use plain text / the `↗` arrow.
- **Tabs:** Book (home — an intent desk: payoff banner, contextual log CTA, resurfacing, demoted "lately" feed) · Search · Add (`+`, composer) · Friends · You (profile). Ask-your-circle (Loop C) is reachable from Search and (per the design) belongs on Friends.
- **Loops:** log (POST-trip) · search/discover (PRE) · ask-your-circle (on-demand supply) · payoff ("a friend used your vouch", `get_vouch_uses`).
- **DB:** core tables are `vouches`, `lists`, `vouch_list_items`, `canonical_places`, `follows`, `vouch_interactions`, `users`. `trips`/`venues`/`cities` are LEGACY (trip-era). Migrations are append-only, numbered, through `0000000000005x`.
- **Still out of scope:** in-app map *view* (post-v0; the precise Open-in-Maps deep-link is fine), web app, dark mode, push, comments/DMs.
---
## 1. What we are building (HISTORICAL — see §0 for the current model)
A friends-graph travel journal for affluent urban Indians. Users log trips in their own voice; the platform extracts structured entities (places, stays, restaurants, cafés, nightlife venues, areas, tips) and makes them searchable across the user's trusted friend network. The product replaces the WhatsApp-ask-a-friend behaviour that currently dominates Indian travel discovery.
**Working name:** TBD — codename `journal` in the codebase.
**Platforms:** iOS and Android only. No web app in v0.
**Audience:** 25–40, metro India, affluent, taste-led, 4–10 trips per year.
**Aesthetic posture:** literary magazine, photographer's notebook, well-kept journal. Not Instagram. Not Airbnb. Not Tripadvisor. Quiet, considered, slightly insider.
---
## 2. Stack — locked
These choices are decided. Do not introduce alternatives without explicit approval.
| Layer | Choice | Why |
|---|---|---|
| Framework | Expo SDK (latest stable) | Fastest path to polished native on both platforms. EAS Build handles distribution. |
| Language | TypeScript, strict mode | Non-negotiable. No `any` without a comment explaining why. |
| Navigation | Expo Router (file-based) | Native feel, deep links, type-safe routes. |
| State | Zustand for client state, TanStack Query for server state | Simpler than Redux. Query handles caching, refetching, optimistic updates. |
| Backend | Supabase (Postgres + Auth + Storage + Realtime + Edge Functions) | One piece. Postgres is the right shape for our relational data. |
| Auth | Supabase Phone Auth via WhatsApp OTP (Twilio Verify integration) | Phone is non-negotiable per product brief. |
| Forms | React Hook Form + Zod | Schema-first validation, shared types between form and API. |
| Styling | Restyle (Shopify) with a custom theme | Type-safe styling, theme tokens enforced at compile time. |
| Fonts | Newsreader (serif) + Inter (sans) via expo-font | Locked in product brief. |
| Image handling | expo-image (caching), expo-image-picker, expo-image-manipulator | Performance and offline matter. |
| Networking | Supabase JS client + custom hooks layered over TanStack Query | No raw fetch in feature code. |
| Offline | TanStack Query persistence + Supabase optimistic updates | Logging a trip must work offline. |
| Analytics | PostHog | Privacy-respecting, self-hostable later if needed. |
| Error tracking | Sentry | Standard. |
| Testing | Vitest (unit), React Native Testing Library (component), Maestro (E2E flows) | E2E covers the three critical flows only — see §10. |
| Linting | Biome | Faster than ESLint+Prettier, single config. |
| Package manager | pnpm | Workspace support, faster installs. |
**Things we are not using and why:**
- Redux — too much ceremony for our state shape
- Firebase — wrong data model for a relational graph
- React Native CLI (bare) — slower to v0, no real reason to leave Expo
- Tailwind / NativeWind — fine, but Restyle's type-safe theme tokens align better with our locked design system
- GraphQL — Postgres + RPC is enough for v0; revisit at v1 if query complexity grows
---
## 3. Repository structure
Monorepo via pnpm workspaces. Even at v0, this layout pays for itself the moment we add a second app target (web admin, marketing site, second client).
```
/
├── apps/
│   └── mobile/                  # The Expo app
│       ├── app/                 # Expo Router routes (file-based)
│       │   ├── (auth)/          # Auth-only routes (onboarding)
│       │   ├── (tabs)/          # Main tab navigator
│       │   │   ├── feed.tsx
│       │   │   ├── search.tsx
│       │   │   ├── log.tsx
│       │   │   └── profile.tsx
│       │   ├── trip/[id].tsx
│       │   ├── friend/[handle].tsx
│       │   └── _layout.tsx
│       ├── src/
│       │   ├── features/        # Feature modules — see §4
│       │   ├── components/      # Shared UI primitives
│       │   ├── theme/           # Restyle theme + tokens
│       │   ├── lib/             # Supabase client, helpers
│       │   ├── hooks/           # Cross-feature hooks
│       │   └── types/           # Shared TS types
│       └── assets/
│
├── packages/
│   ├── shared/                  # Cross-target shared code (types, validators)
│   │   ├── src/
│   │   │   ├── schemas/         # Zod schemas — single source of truth
│   │   │   ├── types/           # Generated Supabase types + domain types
│   │   │   └── extractors/      # Entity extraction logic (used by both client and edge functions)
│   │   └── package.json
│   └── biome-config/            # Shared lint/format config (Biome, not ESLint)
│
├── supabase/
│   ├── migrations/              # SQL migrations, numbered
│   ├── functions/               # Edge functions (entity extraction, Instagram import)
│   ├── seed.sql                 # Seed data for local dev
│   └── config.toml
│
├── docs/
│   ├── architecture.md
│   ├── data-model.md
│   ├── design-system.md
│   └── decisions/               # ADRs — one file per significant decision
│
└── CLAUDE.md                    # This file
```
**Rules about structure:**
- A feature module owns its own routes, components, hooks, queries, and types. No cross-feature imports except through `components/` (UI primitives) or `lib/` (infrastructure).
- Shared types and Zod schemas live in `packages/shared`. The mobile app imports them. Edge functions import them. One source of truth.
- New top-level folders require an ADR.
---
## 4. Feature modules
Each feature module follows the same shape:
```
src/features/<feature>/
├── api/             # Supabase queries + mutations, wrapped in hooks
├── components/      # Components used only inside this feature
├── screens/         # Screen-level components (called by routes)
├── hooks/           # Feature-specific hooks
├── types.ts         # Feature-specific types
└── index.ts         # Public API of the feature
```
Feature modules for v0:
- `auth` — phone OTP, session management
- `onboarding` — six-screen flow including Instagram import
- `trips` — log, view, edit trips
- `places` — place sub-entries inside trips
- `entities` — venues, areas, tips (extraction + display)
- `feed` — home feed of friend activity
- `search` — search across the friend graph
- `friends` — contacts matching, follow/unfollow
- `profile` — own profile + friend profile views
- `instagram` — Instagram OAuth + post import
A feature module is the unit of ownership and the unit of code review. Keep them small; split when they exceed ~15 files.
---
## 5. Data model
The full schema lives in `supabase/migrations/`. Here is the conceptual model.
### Core tables
**`users`** — extends `auth.users`. Has a `handle`, `display_name`, `avatar_url`, `phone_hash`, `default_visibility`.
**`trips`** — top-level travel unit.
- `id`, `user_id`, `title`, `start_date`, `end_date`, `note` (long text, the user's prose), `cover_photo_id`, `visibility` (`followers` | `friends_of_friends` | `everyone`), `imported_from` (nullable, `instagram` for imports), `created_at`, `updated_at`.
**`places`** — child of trips. Geographic sub-entry.
- `id`, `trip_id`, `name` (e.g. "Pokhara"), `region` (nullable, e.g. "Annapurna"), `country`, `lat`, `lng`, `note` (optional, prose specific to this place), `arrival_date` (nullable), `position` (int, ordering within trip).
**`venues`** — child of places. Stays, restaurants, cafés, bars/nightlife.
- `id`, `place_id`, `name`, `kind` (`stay` | `restaurant` | `cafe` | `nightlife` | `other`), `area_id` (nullable, FK to areas), `quote` (the friend's exact words), `lat`, `lng`, `external_id` (Google Places ID where available).
**`areas`** — child of places. Neighbourhood-level groupings.
- `id`, `place_id`, `name` (e.g. "Lakeside, Pokhara"), `quote`, `lat`, `lng`.
**`tips`** — child of trips OR places (polymorphic).
- `id`, `parent_type` (`trip` | `place`), `parent_id`, `body`, `kind` (`macro` for trip-level, `atomic` for place-level).
**`trip_photos`** — photos attached to a trip.
- `id`, `trip_id`, `place_id` (nullable, if photo belongs to a specific place), `storage_path`, `width`, `height`, `taken_at`, `position`.
### Social tables
**`follows`** — directed graph. `follower_id`, `followed_id`, `created_at`. Unique on (follower, followed).
**`contact_matches`** — hashed phone matching for friend discovery. `user_id`, `matched_user_id`, `created_at`.
### Extraction tables
**`extraction_runs`** — when we ran extraction on a trip note. `id`, `trip_id`, `model`, `prompt_version`, `input_text`, `raw_output`, `created_at`.
**`extracted_entities`** — staged extractions awaiting user confirmation.
- `id`, `extraction_run_id`, `kind`, `proposed_name`, `proposed_quote`, `proposed_metadata` (jsonb), `confirmed` (boolean), `confirmed_entity_id` (nullable, points to the real venue/area/tip after confirmation).
### Rules
- **Trips are the logging and display unit.** Always show trips as the top-level surface in user-facing UI.
- **Places, venues, areas, tips are the search unit.** Search queries hit these, not trips. Results link back to parent trip for context.
- **Quotes are immutable.** Once a friend's quote is captured (`venues.quote`, `areas.quote`), do not regenerate or paraphrase it. The product's trust thesis depends on the friend's actual voice.
- **Visibility is per-trip.** Inherited by all child entities. Changing trip visibility cascades. Per-entity overrides are out of scope for v0.
- **Soft delete only.** Add `deleted_at` to every table. Hard deletes happen via a scheduled job after 30 days. Users can restore from a "Recently deleted" view.
---
## 6. Row-Level Security (RLS)
Every table has RLS enabled. Default deny. Policies live alongside migrations.
The privacy levels:
- `followers` — visible to users who follow the author
- `friends_of_friends` — visible to users who follow someone the author follows
- `everyone` — visible to all authenticated users on the platform
Policy patterns are documented in `docs/architecture.md`. Two non-obvious rules:
1. **Followers-of-followers is computed via a SQL view, not at query time.** Materialised once, refreshed on follow/unfollow. Don't run a recursive CTE on every read.
2. **Search results filter at the place/venue level, not the trip level.** A user can match a venue inside a trip whose visibility includes them, even if they don't see other venues in that trip. RLS policies are written on each child table independently.
---
## 7. Design system
The full design system lives in `apps/mobile/src/theme/` and is documented in `docs/design-system.md`. Key tokens:
### Colors
```ts
{
  paper: '#FAF8F5',          // primary background — warm off-white
  ink: '#2C2C2A',            // primary text — soft black
  inkSecondary: '#5F5E5A',   // muted text
  inkTertiary: '#888780',    // hints, captions
  divider: '#E8E5DD',        // subtle dividers
  surface: '#FFFFFF',        // cards on paper
  accent: '#A8482F',         // terracotta — used <5% of pixels
  accentSoft: 'rgba(168, 72, 47, 0.08)',
}
```
Dark mode is out of scope for v0. Build with light-only theme; structure the theme so dark mode is a single additional theme file later.
### Typography
- **Newsreader** (serif) — trip titles, framing copy, friend voice quotes. Always italic for quotes.
- **Inter** (sans) — UI, labels, metadata, buttons.
Loaded via `expo-font` with weight subsets only (regular, italic, medium for serif; regular, medium for sans). Don't ship full font families.
### Spacing
4px base unit. Theme exposes `s`, `m`, `l`, `xl` (8 / 16 / 24 / 32). No raw pixel values in components.
### Components
Built once, used everywhere. The starter set:
- `Text` (variants: title, body, caption, quote, label)
- `Box` (Restyle primitive)
- `Button` (primary, ghost, accent)
- `Input`, `Textarea` (with the warm-paper styling)
- `Avatar` (xs, sm, md, lg)
- `Pill` (default, on, accent)
- `Card` (paper card with thin border)
- `PhotoFrame` (the framed-photo treatment from the brief)
No raw `View` or `TextInput` in feature code. Everything routes through the design system.
### Photos
- Aspect ratios preserved. No forced square crops.
- Framed (4px padding inside a thin border), not edge-to-edge.
- Smaller than Instagram. Cover photos max 220px wide on a card.
---
## 8. Conventions
### Code style
- Functional components only. No classes.
- Hooks at the top of the function. Effects last.
- Prefer composition over configuration. A component with 12 props is a sign it should be split.
- Co-locate styles with components via Restyle's `createBox` / `createText`.
- File names: `kebab-case.tsx` for components, `use-name.ts` for hooks, `name.ts` for everything else.
- Component names: `PascalCase`. Hook names: `useCamelCase`.
- One component per file. Helpers can live in the same file if they're truly local.
### TypeScript
- `strict: true` always.
- No `any` without an inline `// eslint-disable` and a comment explaining why.
- Prefer `type` over `interface` unless extending.
- Domain types live in `packages/shared/src/types`. Import, don't redefine.
- Zod schemas in `packages/shared/src/schemas` are the single source of truth — derive TS types via `z.infer`.
### API layer
- All Supabase calls are wrapped in a hook (`useTrip`, `useTrips`, `useCreateTrip`).
- Hooks live in `features/<feature>/api/`.
- TanStack Query keys follow the pattern `[feature, operation, ...params]` — e.g. `['trips', 'detail', tripId]`.
- Optimistic updates are the default for create/update/delete. Logging a trip should feel instant.
- Errors are surfaced via a shared toast system, not alerts.
### State
- **Server state → TanStack Query.** Anything that came from Supabase is server state.
- **Client state → Zustand.** Auth session, ephemeral UI state, draft trip being composed.
- **Form state → React Hook Form.** Never manual `useState` for form fields.
- **URL state → Expo Router params.** Filters, tab selections that should survive navigation.
### Logging and errors
- No `console.log` in committed code. Use the `log` helper which routes to PostHog in dev and Sentry breadcrumbs in prod.
- Errors that the user sees: a toast with a plain-language message, not the raw error.
- Errors that the user doesn't need to see: silent, but logged to Sentry.
- Network failures during trip logging: queue locally, retry on next app open.
### Naming
- Avoid clever names. `TripCard`, not `Memento`.
- Booleans start with `is`, `has`, or `should`.
- Async functions have verbs: `fetchTrips`, `createTrip`. Hooks read as nouns: `useTrips`.
---
## 9. Privacy and security
These are non-negotiable.
- **Phone numbers are hashed before any matching.** SHA-256 with a server-held pepper. Never store raw phone numbers outside of `auth.users`.
- **Contact matching is server-side only.** The client uploads hashed contacts; the server returns matches. Never expose the full match list.
- **No email addresses collected in v0.** Phone-only signup.
- **PII in logs is forbidden.** PostHog and Sentry are configured to scrub user identifiers from event payloads. User ID is the only personal field allowed in logs, and only as a hashed UUID.
- **Photo EXIF is stripped on upload.** GPS coordinates are extracted server-side for the place-coordinate field, then stripped from the file before storage.
- **Default trip visibility is `friends_of_friends`.** This is set in onboarding and inherited by every new trip. Users can override per-trip.
- **No notifications in v0.** No push, no email. First-week behavioural design relies on user-driven return.
---
## 10. Testing strategy
We do not chase coverage. We test the things that, if broken, would break the product's core promise.
### Unit tests
- Zod schemas
- Entity extraction logic (`packages/shared/src/extractors`)
- Visibility resolution helpers
- Date / itinerary computations
### Component tests (RNTL)
- The five most-used design system components (Button, Text, Input, Avatar, Card)
- Trip log form behaviour (Quick / Detailed mode toggle, validation, submit)
- Privacy pill state transitions
### E2E tests (Maestro)
Three flows only:
1. **Onboard and log first trip.** Phone OTP → framing → skip Instagram → manual log → save.
2. **Search a friend's recommendation.** Open as user A who follows user B → search a place B has logged → see B's quote in results.
3. **Edit and re-extract.** Log a trip → edit the note → confirm new entities are surfaced.
Anything beyond these three is out of scope for v0 testing.
### Manual QA before each TestFlight build
- Real device, real network, real data.
- The five hero flows from the design brief, not the test suite.
---
## 11. Performance budgets
- Cold start to interactive: < 2s on iPhone 12 / equivalent Android.
- Trip log save: optimistic, < 100ms perceived.
- Feed scroll: 60fps on iPhone 12 / Pixel 6.
- Search results: < 500ms from keystroke to first result.
- Image: never load full-resolution; serve the right size from Supabase Storage transformations.
If a feature can't hit these budgets, it doesn't ship.
---
## 12. Out of scope for v0
Do not build these unless explicitly approved. If a request would touch any of these, stop and ask.
- Web app
- Tablet layouts (build phone-only; tablets get the phone layout for now)
- Push notifications
- Email signup
- Comments on trips
- DMs / chat
- Group trips (multiple authors on one trip)
- Recommendation algorithms (the feed is reverse-chronological in v0)
- Map view of friend recommendations (post-v0)
- Public/discoverable creator profiles
- Monetisation surfaces of any kind
- Internationalisation — English only in v0
- Accessibility audit beyond basic semantic labels (WCAG AA target is post-v0)
- Dark mode
---
## 13. How to work in this repo
When asked to build a feature:
1. **Read the relevant section of this file and `docs/architecture.md`.** If the feature touches data, read `docs/data-model.md`.
2. **Check the build plan** (`docs/build-plan.md`) to see which phase the work belongs to and whether dependencies exist.
3. **Write the migration first** if data shape changes are needed. Migrations are append-only; never edit a committed migration.
4. **Update Zod schemas in `packages/shared`** before touching feature code.
5. **Build the feature module** following the structure in §4.
6. **Add tests at the level prescribed in §10** — not more, not less.
7. **Update documentation** if the change is architectural (new ADR) or affects the data model.
When uncertain:
- If the question is architectural — stop and ask. Don't guess.
- If the question is naming or layout — pick the simplest option and add a comment so it's easy to revisit.
- If the question is product (what should this screen do?) — refer to the design brief in `docs/design-brief.md`. If still unclear, stop and ask.
When making a decision worth remembering:
- Write an ADR in `docs/decisions/NNNN-short-title.md`. Two paragraphs is enough. The point is to leave a trail.
When you finish a task:
- Run `pnpm typecheck`, `pnpm lint`, `pnpm test`. All must pass.
- If you touched the data model, regenerate types: `pnpm types:gen`.
- If you touched the schema, run migrations against local Supabase: `pnpm db:reset`.
---
## 14. Things this document is silent about
This document does not specify:
- Exact component implementation details
- Animation curves or micro-interaction specs (design's job, not mine)
- The Instagram import internals (separate ADR — see `docs/decisions/0003-instagram-import.md` once written)
- The entity extraction prompt (lives in `packages/shared/src/extractors/prompts/`)
- Pricing, monetisation, business logic of any kind
When this document is silent and the answer matters, ask. When the answer doesn't matter, pick the simplest option and move on.
