# 0001 — Monorepo layout

**Status:** Accepted
**Date:** 2026-05-10

## Context

Even at v0 we expect a second target eventually (web admin, marketing site, an internal review surface). Edge functions need to share Zod schemas with the mobile app. Without a workspace setup, those would either drift or be duplicated.

## Decision

pnpm workspaces with two top-level package roots: `apps/*` and `packages/*`. Mobile lives in `apps/mobile`. Cross-target code (Zod schemas, DB types, extractor logic) lives in `packages/shared`. Supabase config and SQL migrations sit at the repo root in `supabase/`, which is not a package — it's consumed by the Supabase CLI directly.

We will not add a shared lint config package; Biome runs from a single root config (`biome.json`) and that's enough. If that limit ever bites, we revisit.

## Consequences

- Tooling has to understand workspaces (Biome, Vitest, Expo Metro). Metro requires `expo/metro-config` resolver hints — see `apps/mobile/metro.config.js`.
- Edge functions can import `@journal/shared` thanks to a Deno import map; without that they would re-implement validators.
- New top-level folders require an ADR — keeps the layout from sprawling.
