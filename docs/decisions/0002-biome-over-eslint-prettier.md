# 0002 — Biome over ESLint + Prettier

**Status:** Accepted
**Date:** 2026-05-10

## Context

The CLAUDE.md draft mentioned `packages/eslint-config/` while also locking Biome as the linter. Two tools doing the same job is a maintenance tax we don't need at v0.

## Decision

Biome only. Single `biome.json` at the repo root governs format and lint for every workspace. No shared config package; if we need per-package overrides we'll use `extends` within Biome.

## Consequences

- One config file to reason about.
- `pnpm lint` and `pnpm format` run from the root and cover every workspace.
- We lose some niche ESLint rules (e.g. plugin-react-native specifics). Acceptable for v0; revisit if a missing rule actually causes a bug.
- The CLAUDE.md repo-structure tree was updated to reflect this — see `packages/biome-config/` (currently a placeholder; may not be needed).
