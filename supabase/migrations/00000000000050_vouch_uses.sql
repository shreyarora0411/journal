-- Migration 50 — the PAYOFF LOOP: "used by your circle".
--
-- A vouch is the atom, and the altruistic reward for writing one is learning
-- that someone you know actually used it (Hennig-Thurau concern-for-others) —
-- NOT a like count, NOT points, NOT a score. The signal is: a real person in
-- your circle SAVED the thing you said, in their own list, to act on later.
-- That is the social proof the no-stars thesis trades on, surfaced PULL-only
-- (no push — CLAUDE.md §9, §12): the author sees it next time they open their
-- profile.
--
-- "Someone saved MY vouch" = a vouch_list_items row whose vouch belongs to the
-- caller (vouches.user_id = auth.uid(), not deleted) AND whose added_by_user_id
-- is some OTHER user (the saver). We join through to that saver's public
-- identity for a voice-forward line ("{Saver} saved your '{vouch}'").
--
-- Why SECURITY DEFINER: a vouch_list_items row lives inside the SAVER's list,
-- which may be private — the author has no SELECT on it under the vli_read RLS
-- policy (migration 42/43). So the author can never see their own payoff via a
-- plain query. This function reads with definer rights but is SAFE BY
-- CONSTRUCTION: every row it returns is gated on vch.user_id = auth.uid(), so a
-- caller only ever sees saves of vouches they themselves authored — never
-- anyone else's list contents, never the list id/title, only the saver's
-- already-public profile fields (display_name, handle, avatar_url) that the
-- users table exposes platform-wide. set search_path = public pins resolution.
--
-- Self-saves (added_by_user_id = the author) are excluded — saving your own
-- vouch into your own list is not a payoff signal. Newest save first.

create or replace function public.get_vouch_uses()
returns table (
  vouch_id uuid,
  vouch_text text,
  vouch_type text,
  destination_text text,
  saver_id uuid,
  saver_name text,
  saver_handle text,
  saver_avatar text,
  saved_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    vch.id              as vouch_id,
    vch.text            as vouch_text,
    vch.vouch_type      as vouch_type,
    vch.destination_text as destination_text,
    su.id               as saver_id,
    su.display_name     as saver_name,
    su.handle::text     as saver_handle,
    su.avatar_url       as saver_avatar,
    vli.added_at        as saved_at
  from public.vouch_list_items vli
  join public.vouches vch
    on vch.id = vli.vouch_id
   and vch.user_id = auth.uid()
   and vch.deleted_at is null
  join public.users su
    on su.id = vli.added_by_user_id
  where vli.added_by_user_id is not null
    and vli.added_by_user_id <> auth.uid()
  order by vli.added_at desc;
$$;

grant execute on function public.get_vouch_uses() to authenticated;

notify pgrst, 'reload schema';
