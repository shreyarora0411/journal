-- Migration 67 — place_dishes: structured "what to order" capture, and
-- place_lovers() recreated to carry each lover's dishes.
--
-- WHY dishes live on (user, place) and NOT on vouches: a vouch row only
-- exists when a voiced note was written (the note is optional at log time;
-- the reaction is the core), so a vouches column would make dishes
-- impossible for note-less logs — and quotes-are-immutable makes editing
-- vouches doctrinally awkward. Dishes are re-statable log data, exactly
-- like place_reactions/place_tag_votes: own-row RLS, delete-then-insert on
-- re-log.
--
-- NO-LLM constitution respected: dishes are captured structurally at log
-- time ("What should they order?", <= 3 chips), never mined from notes.

create table public.place_dishes (
  user_id uuid not null references public.users(id) on delete cascade,
  place_id uuid not null references public.canonical_places(id) on delete cascade,
  position int not null check (position between 1 and 3),
  dish text not null check (char_length(dish) between 1 and 40),
  created_at timestamptz not null default now(),
  primary key (user_id, place_id, position)
);

alter table public.place_dishes enable row level security;

-- Own-row only, mirroring place_reactions: cross-user exposure happens
-- exclusively through the place_lovers() definer surface below, which
-- already enforces blocked-pair and deleted-user filtering.
create policy place_dishes_select_own on public.place_dishes
  for select using (auth.uid() = user_id);
create policy place_dishes_insert_own on public.place_dishes
  for insert with check (auth.uid() = user_id);
create policy place_dishes_delete_own on public.place_dishes
  for delete using (auth.uid() = user_id);

grant select, insert, delete on public.place_dishes to authenticated;

-- ---- place_lovers(): + dishes text[] per lover -------------------------
-- Return-type change requires drop + recreate (create or replace cannot
-- alter the OUT table). Grants are re-issued below because drop discards
-- them — the one case where the repo's create-or-replace-preserves-grants
-- convention doesn't apply.

drop function public.place_lovers(uuid);

create function public.place_lovers(p_place uuid)
returns table (
  user_id uuid,
  display_name text,
  handle text,
  avatar_url text,
  match double precision,
  followed boolean,
  note text,
  dishes text[]
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_viewer uuid := auth.uid();
begin
  if v_viewer is null or p_place is null then return; end if;

  return query
  select u.id, u.display_name, u.handle::text, u.avatar_url,
         public.taste_match(u.id) as match,
         exists (
           select 1 from public.follows f
           where f.follower_id = v_viewer and f.followed_id = u.id
             and f.status = 'accepted'
         ) as followed,
         (
           select vch.text from public.vouches vch
           where vch.user_id = u.id and vch.place_id = p_place
             and vch.deleted_at is null
             and public.is_visible_to(v_viewer, vch.user_id, vch.visibility)
           order by vch.created_at desc limit 1
         ) as note,
         (
           select array_agg(d.dish order by d.position)
           from public.place_dishes d
           where d.user_id = u.id and d.place_id = p_place
         ) as dishes
  from public.place_reactions r
  join public.users u on u.id = r.user_id
  where r.place_id = p_place
    and r.sentiment = 'loved'
    and r.user_id <> v_viewer
    and u.deleted_at is null
    and not public.is_blocked_pair(v_viewer, r.user_id)
  order by public.taste_match(u.id) desc nulls last
  limit 20;
end;
$$;

revoke execute on function public.place_lovers(uuid) from public;
revoke execute on function public.place_lovers(uuid) from anon;
grant execute on function public.place_lovers(uuid) to authenticated;

notify pgrst, 'reload schema';
