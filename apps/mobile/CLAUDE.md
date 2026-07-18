# apps/mobile — Expo app conventions

Area guide for the `@journal/mobile` client. The root [`CLAUDE.md`](../../CLAUDE.md) is the constitution; this file records how the app is *actually* wired. See also [`docs/codebase-map.md`](../../docs/codebase-map.md) and the drift note there.

> **Product name is `lore.`** but code identifiers stay `journal` ([ADR 0007](../../docs/decisions/0007-rename-to-lore.md)). Don't "fix" the mismatch.

---

## Routing (Expo Router, file-based)

- Routes live in `app/`. **Route files are thin** — they read params and render a screen component from `src/features/*/screens/`. Keep logic out of `app/`.
- Groups: `app/(auth)/` (onboarding stack) and `app/(tabs)/` (main tab navigator).
- **Tab bar is five tabs** rendered by the custom `FloatingTabBar`: **Book · Search · Add · Friends · You** (`app/(tabs)/_layout.tsx`). The center **Add** is a raised coral disc.
- Detail routes (`trip/[id]`, `place/[id]`, `list/[id]`, `friend/[handle]`, `map`, `wishlist`, `year-in-travel`, `house-rules`, `trip-notebook/[id]`) live **inside `(tabs)`** with `options={{ href: null }}` so the tab bar persists over them. New detail screens follow the same pattern.
- Tab-name → feature mapping is not 1:1: **Book = feed**, **Friends = activity**, **Add = trips/log**, **You = profile**.

### Auth gating & entry
- `app/_layout.tsx` → `AuthGate` decides routing from `useAuthSession()` + `useProfile()`:
  - no session → `/(auth)/welcome`
  - session but not onboarded → next step via `onboardingNextRoute()`
  - onboarded → `/(tabs)/book`
- Pilot uses **anonymous auth** ([ADR 0004](../../docs/decisions/0004-pilot-anonymous-auth.md)), not phone OTP.
- `app/index.tsx` redirects into the auth flow (or shows a dev hint if Supabase env is unset).

---

## Providers (set up once, in `app/_layout.tsx`)

Order, outermost first:

```
GestureHandlerRootView → SafeAreaProvider → QueryClientProvider → ThemeProvider → ToastProvider → (StatusBar + AuthGate)
```

- `initSentry()` runs at module load (before the tree). `initPostHog()` runs after fonts load.
- `QueryClient` config: `retry: 1`, `staleTime: 30_000`. Reuse this client — don't create ad-hoc ones.
- Fonts load in a `useEffect` gated on a `ready` flag; the splash screen blocks until then. Loaded families: **Instrument Serif Italic, Geist (400/500), JetBrains Mono** (plus legacy Fraunces/Inter kept only for un-migrated slice-1/2/3 screens).

---

## Theme (`src/theme/index.ts`, Shopify Restyle)

Single `createTheme()` call. **Consume tokens; never hardcode colors, spacing, or fonts.**

- **Color:** one accent — **coral `#FF4D2E`** — on a **white/paper** ground (`ink` text, `mute` secondary, `hair` hairlines). Pink / emerald / gold are **category markers only** (dots + category pills), never button fills.
- **Spacing:** `xs 4 · s 8 · m 16 · l 24 · xl 32 · xxl 48`. No raw pixel values.
- **Radii:** `xs 6 · s 8 · m 12 · l 14 · xl 18 · pill 999`.
- **Text variants:** `display` / `title` / `heading` / `quote` are **Instrument Serif italic** (the human voice — never for UI labels or buttons). `body` / `bodyMute` / `headline` / `placeName` / `caption` / `meta` are Geist. `eyebrow` / `label` are JetBrains Mono, uppercase, letter-spaced (eyebrow pairs with a 6×6 colored dot via the `Eyebrow` primitive).
- **Component variants** live in the theme: `cardVariants` (default/tint), `buttonVariants` (primary/accent/ghost/link), `pillVariants` (default/on/accent/filled).
- **Categories:** `CATEGORIES` map = `stay / food / drinks / wander / buy`, each with a color + soft tint. Use it for `CategoryPill` and recommendation cards.
- Some `colors` keys are **legacy aliases** kept so un-migrated screens still compile; prefer the new token names (`ink`, `mute`, `hair`, `coral`, `tint`) in new code.

---

## Components (`src/components/`)

Import from the barrel: `import { Box, Text, Button } from '@/components'`. **No raw `View` / `Text` / `TextInput` / `Image` in feature code** — route through the design system.

- Restyle primitives `Box` / `Text` accept theme spacing, color, and variant props.
- Layout: `Page` (standard scrollable screen — safe-area + ~96px bottom clearance for the floating bar), `StatusSpace`, `Nav`, `DetailHeader`.
- Content/media: `Photo` (wraps `expo-image`; children overlay for pills/chips), `PhotoFrame`, `Card`, `PullQuote`, `Eyebrow`, `Wordmark`.
- People: `Avatar`, `Face`, `FaceStack`.
- Inputs/selection: `Input`, `Textarea`, `Pill`, `CategoryPill`, `VerdictPicker`, `PlacePicker`.
- Feedback: `Toast` / `ToastProvider`, plus `useToast()` from `src/hooks/`.

Primitive API convention: small prop set, `variant`/`size` string unions, theme read via `useTheme<Theme>()` for computed colors. A component needing ~12 props is a sign to split it (root §8).

---

## Infrastructure (`src/lib/`)

- `supabase.ts` — **always** get the client via `getSupabase()`; never construct one inline.
- `log.ts` — use `log.{debug,info,warn,error,event,identify}`. **No `console.log` in committed code** (root §8).
- `google-places.ts` — `placeAutocomplete` / `placeDetails` / `newSessionToken`; degrades to `null` on error.
- `phone-hash.ts` — client SHA-256 (`hashPhone`/`hashPhones`); the server applies the pepper.
- `posthog.ts` / `sentry.ts` — analytics + error init with PII scrubbing (root §9).

---

## Working here

- Data access → feature `api/` hooks over TanStack Query; see [`src/features/CLAUDE.md`](src/features/CLAUDE.md).
- Forms → React Hook Form + Zod resolver (schemas from `@journal/shared`). Never manual `useState` for fields.
- Client state → Zustand (e.g. `features/auth/state.ts`). Server state → TanStack Query. URL state → router params.
- Tests co-locate as `*.test.tsx`; render via `src/test/render.tsx`. Scope per root §10 (five hero primitives, log form, privacy pills).
- Before finishing: `pnpm typecheck && pnpm lint && pnpm test`.
