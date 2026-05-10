# Journal (codename)

Friends-graph travel journal for affluent urban Indians. Read [CLAUDE.md](./CLAUDE.md) for the constitution and [docs/build-plan.md](./docs/build-plan.md) for the v0 plan.

## Quick start

```bash
# Prerequisites: Node 20, pnpm (via corepack).
corepack enable
pnpm install

# Web smoke-test
cd apps/mobile && pnpm web

# iOS / Android via Expo Go
cd apps/mobile && npx expo start  # press i / a / w
```

`apps/mobile/.env` must contain `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. See [docs/operations.md](./docs/operations.md) for the full pilot ops runbook (Supabase setup, edge function deploy, TestFlight, Play Internal).

## Layout

```
apps/mobile          Expo app (iOS + Android + web smoke-test)
packages/shared      Cross-target Zod schemas, types, extractors
supabase/            Local Supabase config, migrations, edge functions
docs/                Architecture, data model, ADRs, operations
```

## Phases

1. **Phase 0** — Foundations: monorepo, design system, theming, CI, Supabase schema baseline. ✅
2. **Phase 1** — Auth + onboarding: pilot-grade anonymous auth ([ADR 0004](./docs/decisions/0004-pilot-anonymous-auth.md)), six-screen flow, contacts matching edge function. ✅
3. **Phase 2** — Trip logging: trips/places/venues/areas/tips schema, Quick-mode log screen, Anthropic-backed entity extraction with staged confirmation, photo upload with EXIF strip. ✅
4. **Phase 3** — Search + friend graph: full-text search across the friend graph, follows + materialised friends-of-friends view, friend profiles. ✅
5. **Phase 4** — Feed + invites: reverse-chronological feed with infinite scroll, WhatsApp invite deep link. Instagram OAuth deferred ([ADR 0005](./docs/decisions/0005-defer-instagram-oauth.md)). ✅
6. **Phase 5** — Polish + TestFlight: accessibility pass, EAS production config, ops docs. App ship + pilot onboarding remains your turn.
