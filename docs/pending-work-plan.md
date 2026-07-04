# Vouch (journal) — pending work, chalked for cold execution

This plan is written to be executed by a model WITHOUT this session's context. Read the whole **Context & ground rules** section before touching anything.

## Context

**Product:** "Vouch" (repo codename `journal`, at `/Users/shreyarora/Documents/journal`) — Expo/React-Native + Supabase monorepo. The product pivoted (2026-07-03) from a trust-graph travel journal to a **taste-graph local going-out app** ("Follow taste, not places or crowds"). The single source of truth is `docs/taste-pivot-spec.md` — READ IT FIRST (thesis §1, engine math §2, five screens §3, You-tab redesign spec §3b, Gurgaon beachhead §4b, progress log §7). CLAUDE.md §0 describes the older vouch model; where they conflict, the taste-pivot spec wins for product direction.

**Current state (all shipped, deployed, committed on branch `feat/vouched-v3.1-place-linking-engagement`, pushed to origin):** taste engine migrations 55–61 applied to the live Supabase project **Trail** (`zcqnffylqfzoeibtkuty`); six screens (Your Map=book tab, Go out=search, Log=add, People=friends, Spot, Person) verified live in the iOS simulator; 41 Gurgaon venues seeded across 15 hub chips; security grant-drift fixed (mig 61); a large audit round of P0/P1 fixes just landed (occasion tag votes, zone inference, honest error states, back-nav, onboarding reroute, invite copy). The founder's account (`888671a6-3493-4255-ae55-407ebfad70b5`) has 3/8 loves.

## Ground rules for the executor (violating these has bitten us repeatedly)

1. **Gates after every phase:** `pnpm typecheck && pnpm lint && pnpm test` from repo root — all green before any commit. Format new/edited files with `npx biome check --write <paths>`.
2. **Prod DB writes need explicit founder approval per session.** Reads/probes are fine. Use the Supabase MCP (`apply_migration` for DDL, `execute_sql` for data). Migrations are append-only, numbered (next free: **62**), idempotent, and the repo file must match what was applied.
3. **Trail drift — never trust the migration tracker.** The live DB predates the numbered migrations. Before writing SQL against any object: check existence (`to_regclass`/`to_regprocedure`), **column types** (`users.handle` is `citext` — a plpgsql `RETURNS TABLE (handle text)` selecting it throws 42804 at runtime; cast `::text`), and **grants** (`information_schema.column_privileges` / `role_table_grants`). Full lesson log: memory file `vouched-trail-db-drift.md` under `~/.claude/projects/-Users-shreyarora-Documents/memory/`.
4. **Column-grant traps (from mig 61):** `users` SELECT is limited to `(id, handle, display_name, avatar_url, bio, is_creator)` — client queries must not SELECT or FILTER on other users columns (`.is('deleted_at', null)` breaks; RLS already hides deleted rows). `place_tag_votes` SELECT is `(place_id, tag_slug)` only — **never use PostgREST upsert/ON CONFLICT on it** (arbiter needs SELECT on user_id); use delete-then-insert (see `use-log-place.ts`). Self full-row reads go through `rpc('me')`; the only phone path is `get_phone_for_friend()`.
5. **SECURITY DEFINER functions:** replace ONLY via `create or replace` (drop recreates default grants); end migrations with `notify pgrst, 'reload schema'`; after creating a NEW function, prefer direct table writes in the client for a while (PostgREST function-cache lag can 404 fresh RPCs).
6. **Privacy invariants (load-bearing, never weaken):** fine/skip sentiment is never observable cross-user in any form; tag votes stay de-attributed; loved places surface only attributed via definer RPCs; no timestamps exposed cross-user; blocked pairs see nothing; the viewer's own skips affect only the viewer's side of the match (mig 58 asymmetric).
7. **Language rules:** no stars/scores ever; never "match" as a noun ("taste overlap", "whose taste fits yours"); no algorithm hints at the point of input (button sublabels were removed deliberately); expose formula *ingredients*, never coefficients.
8. **Simulator verification protocol** (no browser preview — this is Expo/iOS): booted device `5217DD5B-987B-4726-B90D-BFC19994CBEE` (iPhone 17 Pro), bundleId `com.shreyarora.lore`, deep-link scheme `lore:///(tabs)/<route>`. Trustworthy verify = `pkill -f "expo start"` → `cd apps/mobile && npx expo start --clear --port 8081 &` → wait for "iOS Bundled" in the log → `simctl terminate` + `launch`. Type into the sim via computer-use MCP: `write_clipboard` + click field + `cmd+v` (keystrokes don't land). Click the LEFT side of fields (an invisible Notification Centre overlay eats clicks in the window's top-right). Scroll with `left_click_drag`, not wheel. Take a FRESH screenshot immediately before tapping buttons near the bottom (scroll-settle shifts layout; we repeatedly missed Save this way). Known non-bug: the FIRST Supabase write after app idle can fail (`Network request failed`, iOS dead socket) — mutations retry now, but don't misdiagnose it.
9. **Google Places quota is small.** The seed script and the dev app share `EXPO_PUBLIC_GOOGLE_PLACES_KEY_DEV` (in `apps/mobile/.env`). `scripts/seed-gurgaon-places.ts` **overwrites its output file unconditionally** — a quota-exhausted run wipes `supabase/seed/gurgaon-places.generated.sql`. Run it once per day, on purpose.
10. **Parity contract:** `packages/shared/src/taste.ts` ↔ the SQL in migrations must change together (axes order, tuning constants, formulas).
11. Commit per workstream with descriptive messages ending `Co-Authored-By:` trailer as configured; push to `feat/vouched-v3.1-place-linking-engagement`.

---

## Workstream A — Build the You tab (spec approved; highest-value build)

The design is fully written at **`docs/taste-pivot-spec.md` §3b** — follow it exactly. Summary: You tab = public taste identity + account home ("this is the map people borrow"); Your Map (book tab) stays the private working artifact.

Implementation:
- New `apps/mobile/src/features/taste/screens/you-screen.tsx`, wired into `app/(tabs)/you.tsx` (replacing the trust-era `profile-screen`; keep that file in the repo, unrouted).
- Sections in order: (1) header — `Face` lg + display name + @handle + edit avatar/name/bio (reuse `useProfile`, `useUpdateProfile`, `useUploadAvatar` from `features/auth`); (2) taste identity card — readout from `useMyTaste`, loves count + distinct hubs from `useMyPlaces`, whole card navigates to `/(tabs)/person/${viewerId}` ("See your map as others do"); (3) "Your voice" — voiced-note count + latest note preview (Fraunces italic, style precedent in `person-screen.tsx` `rowNote`), plus "N loved places are waiting for your words" nudge → `/(tabs)/add` (loved rows with `note === null` in `useMyPlaces` data — the hook already returns `note` per place); (4) lists — reuse the existing lists feature entry points (`features/lists`); (5) reach — `useFollowCounts` (accepted-only was already fixed) framed as "people borrowing your map", + the WhatsApp invite entry (copy the `onInvite` pattern from `people-screen.tsx`: `buildWhatsAppLink(buildPersonalInviteText(viewerId))`); (6) account — default visibility (via `useUpdateProfile`), house-rules link (route exists: `/(tabs)/house-rules`), sign out (see `features/auth` for the session store).
- Design language: Fraunces (`Fraunces_500`, `Fraunces_400Italic`) + Hanken Grotesk variants, coral `#FF4D2E`, ink `#1B1714`, hairline `#E7E1D7`, card `#FFFDFA` — match the other taste screens, NOT the old profile screen.
- Rules from §3b: identity always derived, no match-as-noun, no gamified stats, no photo wall. No new backend — every data need is served by existing hooks.
- RNTL test: render with mocked hooks; assert readout, borrow-count line, and that tapping the identity card pushes `person/[id]`.
- Verify in sim (protocol above): You tab renders all six sections; identity card → own person page → back retraces.

## Workstream B — TestFlight readiness (blocks all invites)

The app has only ever run in the simulator. Goal: an EAS build the founder can install via TestFlight.
1. **Key restriction first (founder does the console clicks; prepare exact instructions):** `EXPO_PUBLIC_GOOGLE_PLACES_KEY_IOS` must be restricted in Google Cloud console to iOS apps with bundleId `com.shreyarora.lore`, API-restricted to Places API (New). The DEV key stays unrestricted but must NOT ship: verify `getGooglePlacesKey()` in `apps/mobile/src/lib/google-places.ts` picks the IOS key when `!__DEV__` (it does — confirm no regressions) and that `.env` values flow into EAS via `eas.json` env or EAS secrets, not hardcoded.
2. Check `apps/mobile/app.json` / `app.config`: bundleId `com.shreyarora.lore` (do NOT rename — deep links/auth break), version/buildNumber, icon assets present.
3. Create/verify `eas.json` with a `preview`/`internal` profile (internal distribution) and a `production` profile. `npx eas build --platform ios --profile preview` — needs the founder's Apple credentials interactively; prepare everything so the founder only has to authenticate.
4. Supabase env for prod builds: `EXPO_PUBLIC_SUPABASE_URL/ANON_KEY` point at Trail — same values as `.env`; wire through EAS env.
5. Sentry/PostHog DSNs: check they're env-driven and present (log helper routes there in prod).
6. Verify: build completes; founder installs via TestFlight; the five hero flows work on device (founder-run; provide a checklist).

**Founder-gated:** Apple account auth, Google console clicks, on-device QA.

## Workstream C — Dummy-data wipe (STOP for founder approval before executing)

The live DB still has 14 users (13 dummy + founder), trust-era vouches/follows/trips. First real invites must land on a clean graph.
1. **Dry-run first (read-only):** produce exact counts of what would be deleted: `users` where id != founder (13), their `vouches`, `follows`, `place_reactions`, `place_tag_votes`, `user_taste_priors`, `lists`, `vouch_list_items`, `trips`+children, `activity`, `contact_matches`, `wishlist_items`, `destination_signals`, `recommendation_requests/responses`. Also inventory the FOUNDER's trust-era artifacts (his 10 Thailand-era vouches with `place_id` null or Thailand places, old trips/lists) and ask whether to keep them (they're invisible to the taste surfaces except old tabs; recommend KEEP — they're real memories and harmless).
2. **PRESERVE:** the founder row + auth identity, `canonical_places` (all 57 — the 16 Thailand rows are zone-null and correctly invisible in Go Out), `category_priors`, `taste_tags`, the founder's 3 reactions + 1 tag vote + priors.
3. Present the dry-run table to the founder; **do not execute without an explicit yes.**
4. Execute in FK-safe order inside one transaction; `auth.users` rows for dummies need `auth.admin` deletion or leaving auth rows orphaned (acceptable at pilot — decide with founder). Re-run the People/Go-out screens after: mv_friends_of_friends refreshes via the follows trigger; verify no screen errors on the emptier graph.

## Workstream D — Seed pass 2 (Places quota has reset)

1. Six hubs have ZERO venues: `32nd_ave`, `worldmark_65`, `mg_road`, `sohna_road`, `crosspoint`, `south_point`. Draft 4–8 anchor venues each into `docs/seed/gurgaon-venues.csv` (format documented in the file header; hub slugs must be in the header comment's list). Venue choice is founder ground truth — draft from web research, then ASK the founder to correct before applying.
2. Fix the previously flagged rows (13): the dupe-guard output listed Burma Burma/Pa Pa Ya resolving to one place id; Downtown/Brewhouse/Clap House to one; The Uncommon/Bawri/Slay/Oh So Stoned/Rara Avis all to the "32nd Avenue" complex itself. Fix = venue-specific `search_query` values (see how Vellam/Asper were fixed: name + street/locality, not the complex name).
3. Run ONCE: `set -a && source apps/mobile/.env && set +a && npx tsx scripts/seed-gurgaon-places.ts` (from repo root). Review the generated SQL: every row's resolved name must match intent and coords must be in-market (Gurgaon ≈ 28.33–28.545 lat / 76.88–77.155 lng). Exclude anything fishy.
4. Apply to Trail via `execute_sql` (idempotent `on conflict (google_place_id) do update`). The 10-venue Kitchens batch precedent: `supabase/seed/gurgaon-places-kitchens.sql`.
5. Verify hub counts: `select hub, count(*) from canonical_places where zone='gurgaon' group by hub` — no v1 hub should be empty.

## Workstream E — Security/advisor cleanup (migration 62, small)

Deferred advisor findings from the mig-61 pass (all confirmed on live):
1. `public.canonical_cities` is a SECURITY DEFINER **view** (advisor ERROR). Legacy trip-era, city names only. Fix: `alter view public.canonical_cities set (security_invoker = true);` — then check whether any legacy screen reading it breaks under RLS (underlying `cities` may have no policies → empty reads on legacy screens = acceptable; the taste app doesn't use it).
2. `destinations` INSERT policy `destinations_authenticated_insert` is `WITH CHECK (true)` — tighten or drop (legacy table; check client usage first with grep `from('destinations')`).
3. Pin `search_path` on `public.set_updated_at()` and `public.gen_user_handle()` (`alter function ... set search_path = public`).
4. `mv_friends_of_friends` is selectable by anon/authenticated → `revoke select on public.mv_friends_of_friends from anon, authenticated;` — BUT first grep the client for direct reads of it (RLS visibility computations happen server-side; expected safe).
5. Avatars bucket allows listing (`avatars_public_read` on storage.objects) — narrow the policy to reads by exact object path if straightforward; otherwise document as accepted risk at pilot.
6. Optional hardening: `alter default privileges` so future tables don't get TRUNCATE/TRIGGER/REFERENCES for anon/authenticated (mig 61 comment flags this).
Run `get_advisors(security)` after; the ERROR must be gone. Probe like mig 61 (set local role + jwt claims) that app reads still work.

## Workstream F — Deferred product gaps (build when A–E are done)

1. **Free-text place creation:** PlacePicker has an `onFreeText` prop wired nowhere in taste flows, and `find_or_create_place` (mig 57) requires `google_place_id`. Fix: migration adds a sibling definer RPC (e.g. `create_freetext_place(p_name, p_hub, p_zone)`) with name+hub dedupe (`lower(name)` unique-ish check) returning the place id; wire `onFreeText` in `log-place-screen.tsx` and `taste-setup-screen.tsx`; the log mutation then skips the Google-fields path. Keep curated-fields-win semantics.
2. **Offline log queue:** per CLAUDE.md §8 convention — persist failed `LogPlaceVars` to AsyncStorage in `use-log-place`'s final onError, replay on app foreground (see `app/_layout.tsx` for where the QueryClient and app-state listeners live). The founder chose "minimum now" earlier — build this only after real users hit it.
3. **Legacy route cleanup:** trust-era routes are still registered in `app/(tabs)/_layout.tsx` (trip/, list/, friend/, ask/, wishlist, year-in-travel, map, trip-notebook, destination/, place/). Replace each legacy route FILE's default export with `<Redirect href="/(tabs)/book" />` (keep the screens in `src/features/*` for reference) OR delete outright — founder's call; redirect stubs are the safe default. `app/+not-found.tsx` already catches unmatched links.
4. **PlacePicker canonical-hit secondary shows raw slugs** (`m3m_ifc · gurgaon`): in `PlacePicker.tsx` the `extra` mapping builds `secondary: [c.hub, c.zone]...` — wrap with `hubLabel(c.hub)` from `@journal/shared`. One line + import. (Noticed in sim, not yet fixed.)
5. **Investigate: Your Map readout intermittently shows the empty prompt** ("Log a few places you love…") despite 3 loves + priors — observed once after rapid saves; suspect a race between the `['taste']` invalidation and `my_taste_axes` staleTime, or the identity block rendering before `tasteQ` refetch resolves. Reproduce (save → immediately switch to Map), check `useMyTaste` (staleTime 60s) — likely fix: also key `['taste','mine']` invalidation or show the previous readout while refetching (placeholderData).

## Workstream G — v1.2 engine (POST-invite; do not build before real usage)

Sketched in spec §2③: per-place disagreement penalty in `recommend_places` (downweight lovers whose loved places the viewer skipped, `×0.7^min(n,3)`, viewer-side only — never observable to others); revealed-preference weighting (boost loves the user re-logged or acted on — needs an act-on-it signal: log Maps-opens per place into a private table first); price/time-of-day chips on Go Out as RETRIEVAL filters (price band from `value_splurge` axis of the place, NOT new user questions). Every change here must respect the parity contract (shared taste.ts + SQL together, tests in `packages/shared/src/taste.test.ts`).

## Workstream H — PostHog success dashboards (founder-facing, post-launch)

Spec §3 success bar: ~2+ logs/person/week over 3 weeks; recs acted on. Events already fire: `taste.place_logged` (sentiment/tags/occasion), `taste.go_out_entered`, `taste.people_entered`, `taste.setup_entered`, `taste.invite_tapped`, `follow.created`. Missing: an act-on-a-rec event — add `taste.maps_opened` (place_id, from=goout|spot) in `go-out-screen.tsx` `openMaps` and `spot-screen.tsx` `openMaps`. Then a PostHog dashboard: weekly loggers, logs/user/week, occasion-vote rate, maps-opens per rec impression.

## Priority order

1. **B (TestFlight)** — nothing real happens until the app leaves the simulator.
2. **C (wipe, gated)** + **D (seed pass 2)** — clean graph + non-empty hubs before invites.
3. **A (You tab)** — the last contradicting surface.
4. **E (advisor cleanup)** — small, do alongside.
5. **F items 4–5** (tiny) anytime; F 1–3 after first invites reveal need.
6. **G, H** — only after real usage exists.

## Founder-only actions (cannot be done by the model)

- Log your real map to 8+ loves with notes (the demo everyone sees; also unlocks people-matching once a second user crosses 8).
- Google Cloud console key restrictions; Apple/TestFlight auth; on-device QA.
- Ground-truth the seed CSV (which venues the tribe actually rates).
- Approve the dummy-data wipe after seeing the dry-run.
- Recruit the first ~20 (not 250) obsessives.
- Optional: `git config --global user.name "Shrey Arora" && git config --global user.email shreyarora0411@gmail.com` (commits currently show a hostname identity).

## Verification (applies to every workstream)

- Gates: `pnpm typecheck && pnpm lint && pnpm test` green; new logic gets unit tests in the owning package.
- DB changes: probe as `authenticated` with `set local role authenticated; set local request.jwt.claims to '{"sub":"<founder-id>","role":"authenticated"}'` inside a rolled-back transaction — verify both the denial AND every app query shape still works; `get_advisors(security)` after DDL.
- UI changes: full clean-Metro sim pass per ground rule 8, screenshot evidence of each new/changed surface.
- Update `docs/taste-pivot-spec.md` §7 and the memory files (`vouched-taste-pivot.md`, `vouched-trail-db-drift.md`) with anything a future session must know; commit + push per workstream.
