-- Migration 66 — seed_members(): ungated member suggestions for the
-- taste-setup follow step.
--
-- WHY: taste_twins() (mig 57) gates on BOTH sides having >= 8 loves and a
-- non-null taste_match — correct for the People tab's "whose taste fits
-- yours" promise, but during onboarding it guarantees an empty follow step
-- at seed scale (live check 2026-07-07: 3 users, 0 follows — the core
-- borrow-a-map loop was invisible to every tester). This function answers a
-- weaker, honest question instead: "who is here and has actually logged
-- places?" — ordered by love count, match reported when computable and NULL
-- when not (never fabricated).
--
-- Deliberately a NEW function rather than a p_gated param on taste_twins:
-- adding a defaulted param creates a second overload (taste_twins(int)
-- survives alongside) and re-grant churn on the engine's People-tab surface
-- is exactly where mig 57's grant-hygiene note says mistakes happen.
--
-- Return shape mirrors taste_twins so the client's TasteTwin type is reused
-- as-is (match is already nullable there in practice: left as-is).

create or replace function public.seed_members(
  p_limit int default 20,
  p_min_loves int default 3
)
returns table (
  user_id uuid,
  display_name text,
  handle text,
  avatar_url text,
  match double precision,
  followed boolean,
  love_count int
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_viewer uuid := auth.uid();
begin
  if v_viewer is null then return; end if;

  return query
  select u.id,
         u.display_name,
         u.handle::text,
         u.avatar_url,
         public.taste_match(u.id) as match,
         exists (
           select 1 from public.follows f
           where f.follower_id = v_viewer and f.followed_id = u.id
             and f.status = 'accepted'
         ) as followed,
         public.user_love_count(u.id) as love_count
  from public.users u
  where u.id <> v_viewer
    and u.deleted_at is null
    and not public.is_blocked_pair(v_viewer, u.id)
    and public.user_love_count(u.id) >= p_min_loves
  order by public.user_love_count(u.id) desc, u.created_at asc
  limit p_limit;
end;
$$;

revoke execute on function public.seed_members(int, int) from public;
revoke execute on function public.seed_members(int, int) from anon;
grant execute on function public.seed_members(int, int) to authenticated;

notify pgrst, 'reload schema';
