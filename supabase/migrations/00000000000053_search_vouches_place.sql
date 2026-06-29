-- Migration 53 — surface each vouch's canonical place through search. Migration
-- 52 wired vouches.place_id to canonical_places; this exposes that link so the
-- client can drop a precise Maps pin from a search result instead of guessing
-- from a lead phrase.
--
-- Additive (builds on migration 49's exact body):
--   - LEFT JOIN public.canonical_places cp ON cp.id = vch.place_id in the
--     candidates CTE, carrying cp.google_place_id / cp.lat / cp.lng / cp.name
--     through to the output. LEFT JOIN so an unresolved vouch (place_id null)
--     still returns, with these four columns null.
--   - Four columns APPENDED to the RETURNS TABLE *after* is_fof — preserving
--     existing column order — and the matching expressions appended to the
--     final SELECT.
-- Everything else from migration 49 (FoF tier, 'skip' 0.70 multiplier, dest_hit,
-- sim, specificity, freshness, ordering, security invoker + search_path) is
-- preserved exactly.
--
-- NOTE: CREATE OR REPLACE FUNCTION cannot change a function's return type, and
-- appending four columns to the RETURNS TABLE does exactly that — so we DROP the
-- existing (16-column) signature first, then recreate it with 20 columns.
-- Re-grant + notify so PostgREST picks up the new columns.

drop function if exists public.search_vouches(text, text);

create or replace function public.search_vouches(
  p_destination text,
  p_context text default null
)
returns table (
  vouch_id uuid, list_id uuid, list_title text, vouch_text text, vouch_type text,
  destination_text text, author_id uuid, author_name text, author_handle text, author_avatar text,
  is_own boolean, is_trusted boolean, context_match boolean, score double precision, created_at timestamptz,
  is_fof boolean,
  place_google_id text, place_lat double precision, place_lng double precision, place_name text
)
language sql stable security invoker set search_path = public, extensions
as $$
  with viewer as (select auth.uid() as id),
  q as (
    select
      public.norm_search(p_destination) as nq,
      regexp_split_to_array(public.norm_search(p_destination), '\s+') as toks,
      btrim(coalesce(p_destination, '')) as raw
  ),
  trust as (
    select f.followed_id as person_id, f.trust_contexts
    from public.follows f, viewer v
    where f.follower_id = v.id and f.status = 'accepted'
  ),
  -- Friend-of-a-friend: people my accepted follows accept-follow, minus the
  -- viewer and the viewer's own direct follows (those are own/trusted already).
  fof as (
    select distinct f2.followed_id as person_id
    from viewer v
    join public.follows f1
      on f1.follower_id = v.id and f1.status = 'accepted'
    join public.follows f2
      on f2.follower_id = f1.followed_id and f2.status = 'accepted'
    where f2.followed_id <> v.id
      and f2.followed_id not in (select person_id from trust)
  ),
  candidates as (
    select
      vch.id, vch.text, vch.vouch_type, vch.destination_text,
      vch.user_id as author_id, vch.created_at,
      u.display_name as author_name, u.handle as author_handle, u.avatar_url as author_avatar,
      (vch.user_id = (select id from viewer)) as is_own,
      (tr.person_id is not null) as is_trusted,
      (fof.person_id is not null) as is_fof,
      -- Canonical place (null when the vouch is unresolved).
      cp.google_place_id as place_google_id,
      cp.lat as place_lat,
      cp.lng as place_lng,
      cp.name as place_name,
      coalesce(tr.trust_contexts && (case vch.vouch_type
          when 'stay' then array['stays'] when 'eat_drink' then array['food']
          when 'good_to_know' then array['local_logistics'] when 'nightlife' then array['nightlife']
          else array[]::text[] end), false) as context_match,
      (
        (q.nq <> '' and public.norm_search(vch.destination_text) like '%' || q.nq || '%')
        or (q.nq = '' and q.raw <> '' and vch.destination_text ilike '%' || q.raw || '%')
      ) as dest_hit,
      (case when q.nq = '' then 0
            else greatest(
              extensions.similarity(public.norm_search(vch.destination_text), q.nq),
              extensions.similarity(public.norm_search(vch.text), q.nq)
            ) end) as sim,
      (select l.id from public.vouch_list_items vli
         join public.lists l on l.id = vli.list_id
        where vli.vouch_id = vch.id and l.owner_id = vch.user_id and l.deleted_at is null
        order by (l.destination_text is not null) desc, l.created_at asc limit 1) as src_list_id
    from public.vouches vch
    cross join q
    join public.users u on u.id = vch.user_id
    left join trust tr on tr.person_id = vch.user_id
    left join fof on fof.person_id = vch.user_id
    left join public.canonical_places cp on cp.id = vch.place_id
    where vch.deleted_at is null
      and (
        q.raw = ''
        or (q.nq <> '' and not exists (
          select 1 from unnest(q.toks) as tok
          where tok <> ''
            and position(
              tok in public.norm_search(vch.destination_text) || ' ' || public.norm_search(vch.text)
            ) = 0
        ))
        or (q.nq <> '' and (
              public.norm_search(vch.destination_text) % q.nq
           or public.norm_search(vch.text) % q.nq))
        or (q.nq = '' and q.raw <> '' and (
              vch.destination_text ilike '%' || q.raw || '%'
           or vch.text ilike '%' || q.raw || '%'))
      )
  )
  select c.id, c.src_list_id,
    (select l.title from public.lists l where l.id = c.src_list_id) as list_title,
    c.text, c.vouch_type, c.destination_text,
    c.author_id, c.author_name, c.author_handle, c.author_avatar,
    c.is_own, c.is_trusted, c.context_match,
    (
      (0.55 * (case when c.is_own then 1.00 when c.is_trusted and c.context_match then 0.95
                    when c.is_trusted then 0.85
                    -- FoF (weak tie) — the discovery supply. Above a stranger's
                    -- 0.40, below a direct friend's 0.85.
                    when c.is_fof then 0.60 else 0.40 end)
       + 0.25 * (case when c.dest_hit then 1.00
                      when c.sim > 0 then least(0.80, 0.55 + 0.25 * c.sim)
                      else 0.80 end)
       + 0.15 * least(1.0,
           (case when array_length(regexp_split_to_array(btrim(c.text), '\s+'),1) >= 4 then 0.8
                 when array_length(regexp_split_to_array(btrim(c.text), '\s+'),1) >= 2 then 0.5 else 0.2 end)
           -- 'skip' dropped from the keyword bonus — a warning is not a
           -- decisive positive and shouldn't earn specificity credit for it.
           + (case when c.text ~* '\y(unless|only|not|book|ask|before|after)\y' then 0.2 else 0 end))
       + 0.05 * (case when c.created_at > now() - interval '90 days' then 1.0
                      when c.created_at > now() - interval '365 days' then 0.6 else 0.3 end))
      -- de-rank 'skip' so a warning never leads a positive-intent query; it
      -- still surfaces (client shows it in a "Heads up" strip).
      * (case when c.vouch_type = 'skip' then 0.70 else 1.0 end)
    ) as score, c.created_at,
    c.is_fof,
    c.place_google_id, c.place_lat, c.place_lng, c.place_name
  from candidates c
  order by score desc, c.sim desc, c.created_at desc;
$$;

grant execute on function public.search_vouches(text, text) to authenticated;

notify pgrst, 'reload schema';
