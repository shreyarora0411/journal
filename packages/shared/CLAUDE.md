# packages/shared — cross-target contracts

`@journal/shared` is the **single source of truth** for validation schemas, domain types, entity-extraction logic, and phone normalization. Both the mobile app and the Supabase edge functions import from here. Root [`CLAUDE.md`](../../CLAUDE.md) §8 mandates: define once here, derive types via `z.infer`, never redefine downstream.

---

## Layout & exports

```
src/
├── index.ts            Re-exports schemas, types, extractors, phone
├── schemas/            Zod schemas (source of truth)
│   ├── index.ts        Common: Visibility, Handle, Uuid, Phone, DisplayName, Otp, HomeCity, ProfileUpdate
│   ├── trip.ts         Trip/City/Venue/Area/Tip + enums + QuickLogForm + ExtractedEntity
│   ├── list.ts         List, ListItem (polymorphic), Wishlist
│   └── atomic-log.ts   AtomicLogForm (venue recommendation + Google Places context)
├── types/index.ts      Domain types (+ generated db.ts from `pnpm types:gen`)
├── extractors/         Entity-extraction prompt + payload types
│   ├── index.ts        EXTRACTION_PROMPT_V0, PROMPT_VERSION, ExtractedEntityProposal, ExtractionPayload
│   └── prompts/v0.ts   Claude system prompt (v0)
└── phone.ts            normalizePhone / isLikelyValidPhone (E.164)
```

Subpath exports: `.`, `./schemas`, `./types`, `./extractors`.

---

## Schema conventions

- **Input → row pattern.** A `*InputSchema` defines the client/form shape; the row `*Schema` extends it with server fields (`id`, `user_id`, timestamps, `deleted_at`). Derive types with `z.infer`, e.g. `export type Trip = z.infer<typeof TripSchema>`.
- **Enums are shared, not inlined:** `Visibility` (followers/friends_of_friends/everyone), `VenueKind` (stay/restaurant/cafe/nightlife/other), `TipKind` (macro/atomic), `TipParent` (trip/city), `EntityKind` (venue/area/tip), `Verdict` (love/mid/skip), atomic-log category (stay/food/drinks/wander/buy).
- **Naming reflects the migration:** the former `Place` is now `City` (`CityInputSchema`, `country_id` FK). Don't reintroduce "place" table names.
- **Polymorphic list items:** `ListItemTargetSchema` = trip/city/venue; `ListItemInputSchema` carries the new `target_type`/`target_id` plus legacy `destination_id`/`city_id` for back-compat.
- Forms in the app (React Hook Form) use these schemas as the Zod resolver — keep field shapes form-friendly.

When the DB shape changes: write the migration first, run `pnpm db:reset`, then `pnpm types:gen` (writes `src/types/db.ts`), then update the hand-written Zod schemas here — in that order (root §13).

---

## Extractors

- `extractors/prompts/v0.ts` is the Claude system prompt used by the `extract-entities` edge function (model via `ANTHROPIC_MODEL`). It instructs the model to emit **0–12** venue/area/tip proposals as raw JSON, with **verbatim quotes** (the trust thesis — quotes are immutable, root §5).
- `PROMPT_VERSION` is stored on every `extraction_runs` row; **bump it whenever the prompt changes** so runs stay attributable.
- `ExtractedEntityProposal` / `ExtractionPayload` are the typed contract between the edge function's output and the app's confirmation flow (`features/trips`).

---

## phone.ts

- `normalizePhone(raw, defaultCountryCode?)` → E.164 (`+CC` + 8–15 digits). Prepends the dialing code when a bare local number matches a known length (IN/US/CA/GB/AU/AE/SG tables).
- `isLikelyValidPhone(raw)` → matches `/^\+\d{8,15}$/`.
- Shared by the client (hash before contact upload) and edge functions (`match-contacts`, `stamp-phone-hash`). **Both sides must normalize identically** or contact matching silently breaks.

---

## Build

- Only runtime dep: `zod`. Consumed **unbundled** in the monorepo — `main`/`types` point at `src/index.ts`.
- `tsc -p tsconfig.build.json` emits ESNext + `.d.ts` (excludes tests) when a built artifact is needed.
- Tests: Vitest, co-located `*.test.ts` (schemas, phone). Run `pnpm test`.
