-- Migration 40 — is_visible_to() must respect follows.status.
--
-- Privacy leak (caught in v3 review): migration 4 defined is_visible_to()
-- when `follows` was a bare (follower, followed) edge with no status. Migration
-- 37 added follows.status ('pending'|'accepted'|'blocked') for the v3
-- request-and-accept model — but is_visible_to() was never updated, so its
-- `followers` and `friends_of_friends` branches treat ANY edge as conferring
-- visibility. Result: a pending requester (not yet accepted) or a blocked user
-- still sees followers/friends-of-friends content. The search_vouches RPC
-- (security invoker) inherits the leak through the vouches RLS policy.
--
-- Fix: the direct-follow existence checks now require status = 'accepted'.
-- This is the same bar the search_vouches trust CTE already uses, so the two
-- now agree. The mv_friends_of_friends branch is left as-is — that view is
-- refreshed from accepted edges (a separate concern); this migration closes
-- the direct-edge leak that is exploitable today.
--
-- Definition is otherwise byte-identical to migration 4. security definer is
-- preserved (the function must read follows regardless of caller RLS).

create or replace function public.is_visible_to(viewer uuid, trip_owner uuid, vis public.visibility)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    viewer is not null
    and (
      viewer = trip_owner
      or vis = 'everyone'
      or (vis = 'followers' and exists (
        select 1 from public.follows
        where follower_id = viewer and followed_id = trip_owner
          and status = 'accepted'
      ))
      or (vis = 'friends_of_friends' and (
        exists (
          select 1 from public.follows
          where follower_id = viewer and followed_id = trip_owner
            and status = 'accepted'
        )
        or exists (
          select 1 from public.mv_friends_of_friends
          where viewer_id = viewer and target_id = trip_owner
        )
      ))
    );
$$;

notify pgrst, 'reload schema';
