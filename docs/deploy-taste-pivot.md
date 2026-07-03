# Deploy runbook — taste pivot v1 (Gurgaon Phase 0)

Everything below is built and reviewed; nothing has touched the live Trail DB
(`zcqnffylqfzoeibtkuty`). Execute in order. Each step is idempotent.

## Pre-flight

- [ ] Trail DB drift caveat: verify by OBJECT EXISTENCE, not the migration
      tracker (see memory `vouched-trail-db-drift`).
- [ ] All prior data is dummy (pre-launch). Optional: clear dummy
      vouches/follows/users before seeding real users — decide before invite-out.

## 1. Apply migrations (in order, via Supabase MCP `apply_migration`)

1. `00000000000055_taste_engine.sql` — schema + scoring functions
   (adversarially reviewed: 3 blockers + privacy hardening fixed).
2. `00000000000056_taste_vocab_seed.sql` — vocabulary (10 category priors,
   24 format + 5 occasion tags). Parity source: `packages/shared/src/taste.ts`.
3. `00000000000057_taste_surfaces.sql` — `find_or_create_place`,
   `taste_twins`, `place_lovers`.

Post-check (execute_sql):
```sql
select to_regclass('public.place_reactions')      as reactions,
       to_regclass('public.place_tag_votes')       as tag_votes,
       to_regclass('public.user_taste_priors')     as priors,
       (select count(*) from public.taste_tags)    as tags,       -- expect 29
       (select count(*) from public.category_priors) as priors_n, -- expect 10
       to_regprocedure('public.recommend_places(text,text,text,int)') as recommender,
       to_regprocedure('public.taste_match(uuid)') as match,
       to_regprocedure('public.find_or_create_place(text,text,text,double precision,double precision,text,text,text)') as foc;
```

## 2. Seed the Gurgaon venues

- [ ] Founder pass on `docs/seed/gurgaon-venues.csv`: fix the 9 FLAGGED rows
      (see bottom of the generated SQL), extend toward ~300 across hubs.
- [ ] Re-run: `GOOGLE_PLACES_KEY=… npx tsx scripts/seed-gurgaon-places.ts`
- [ ] Review `supabase/seed/gurgaon-places.generated.sql`, then apply it
      (execute_sql). Currently: 35 verified venues.
- Post-check: `select hub, count(*) from canonical_places where zone='gurgaon' group by hub;`

## 3. RLS / privacy smoke test (execute_sql, rollback)

```sql
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"<some-real-user-uuid>","role":"authenticated"}';
-- own reaction write works:
insert into place_reactions (user_id, place_id, sentiment)
  select '<some-real-user-uuid>', id, 'loved' from canonical_places limit 1;
-- cross-user reads return ONLY aggregates:
select public.recommend_places('gurgaon', null, null, 5);
select public.taste_match('<other-user-uuid>');  -- null below 8 loves: correct
rollback;
```
Also verify the tag-vote column grant: `select user_id from place_tag_votes limit 1;`
as authenticated MUST fail with permission denied (place_id/tag_slug only).

## 4. Client

- [ ] Clean Metro restart (`pkill -f "expo start"; npx expo start --clear`) —
      terminate+relaunch alone is NOT enough (see memory `sim-verify-clean-bundle`).
- [ ] Smoke: Map (taste setup CTA) → taste-setup (4 taps + 5 loves) → Map shows
      readout + places → Log a place end-to-end → Go out (Gurgaon hubs) →
      People (gate at <8 loves) → Spot page.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` all green before build.

## 5. Post-deploy sanity

- [ ] `get_advisors` (security) — expect no NEW errors beyond the pre-existing
      baseline (canonical_cities definer view etc.).
- [ ] Onboard the founder account for real: taste-setup + first 8 loves →
      confirm `my_taste_axes()` returns a non-zero vector and Map shows the
      readout.

## Known deferred (not blockers)

- "You" tab still renders the trust-era profile (identity readout now lives on
  Map) — converge later.
- Old trust-era screens (feed/plan/composer/friends-directory) remain in the
  repo unrouted; delete in a cleanup pass.
- Ask/vouch surfaces coexist: voiced notes written from Log attach to places
  and surface in recommendations.
