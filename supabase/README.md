# Supabase

Local Supabase via Docker. The CLI ships separately — install with `brew install supabase/tap/supabase` (macOS) or follow the [official docs](https://supabase.com/docs/guides/local-development).

## Common commands

```bash
pnpm db:start    # start the local stack (Postgres, Auth, Storage, Studio at :54323)
pnpm db:stop     # stop everything
pnpm db:reset    # drop, re-migrate from scratch, seed
pnpm types:gen   # regenerate packages/shared/src/types/db.ts from the local schema
```

## Layout

```
supabase/
├── config.toml             Local stack configuration (ports, auth, storage)
├── migrations/             Append-only SQL migrations, sorted by filename prefix
│   ├── 00000000000000_pgcrypto.sql
│   └── 00000000000001_users.sql
├── seed.sql                Local-only seed data
└── functions/              Edge functions (Deno) — populated in Phase 2+
```

## Migrations

Append-only. Never edit a committed migration. New migrations get a fresh timestamp prefix.

The conventions in `docs/data-model.md` apply: every table has `id`, `created_at`, `updated_at`, `deleted_at` (soft delete). RLS enabled, default deny, policies in the same migration as the table.

## Edge functions

Functions live in `supabase/functions/<name>/index.ts`. They import from `@journal/shared` via a Deno import map; see [docs/architecture.md](../docs/architecture.md) for the cross-package wiring.
