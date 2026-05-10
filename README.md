# Journal (codename)

Friends-graph travel journal for affluent urban Indians. Read [CLAUDE.md](./CLAUDE.md) for the constitution and [docs/build-plan.md](./docs/build-plan.md) for the v0 plan.

## Quick start

```bash
# Prerequisites: Node 20, Docker, pnpm (via corepack), Xcode for iOS, Android Studio for Android.
corepack enable
pnpm install

# Mobile app
pnpm mobile start

# Local Supabase
pnpm db:start
pnpm db:reset
```

## Layout

```
apps/mobile          Expo app (iOS + Android)
packages/shared      Cross-target Zod schemas, types, extractors
supabase/            Local Supabase config, migrations, edge functions
docs/                Architecture, data model, ADRs
```
