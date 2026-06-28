-- Migration 45 — search matches the vouch TEXT, not just the destination.
--
-- Real "what do I order here?" moment: standing in a restaurant, you search
-- the venue ("Baan Ya Jai") or a dish ("masaman curry") — but those live in
-- the vouch TEXT, while search only matched destination_text. So the query
-- returned nothing even though a friend had vouched exactly that.
--
-- Fix: the WHERE now matches destination_text OR text. A vouch surfaces
-- whether you searched its place ("Spiti") or what's inside it ("Banjara",
-- "crab curry"). The voiced vouch already carries venue + dish; search just
-- needs to look inside it. Everything else (ranking, RLS) is unchanged.

create or replace function public.search_vouches(
  p_destination text,
  p_context text default null
)
returns table (
  vouch_id uuid, list_id uuid, list_title text, vouch_text text, vouch_type text,
  destination_text text, author_id uuid, author_name text, author_handle text, author_avatar text,
  is_own boolean, is_trusted boolean, context_match boolean, score double precision, created_at timestamptz
)
language sql stable security invoker set search_path = public
as $$
  with viewer as (select auth.uid() as id),
  trust as (
    select f.followed_id as person_id, f.trust_contexts
    from public.follows f, viewer v
    where f.follower_id = v.id and f.status = 'accepted'
  ),
  candidates as (
    select
      vch.id, vch.text, vch.vouch_type, vch.destination_text,
      vch.user_id as author_id, vch.created_at,
      u.display_name as author_name, u.handle as author_handle, u.avatar_url as author_avatar,
      (vch.user_id = (select id from viewer)) as is_own,
      (tr.person_id is not null) as is_trusted,
      coalesce(tr.trust_contexts && (case vch.vouch_type
          when 'stay' then array['stays'] when 'eat_drink' then array['food']
          when 'good_to_know' then array['local_logistics'] when 'nightlife' then array['nightlife']
          else array[]::text[] end), false) as context_match,
      -- did the query hit the destination, or something inside the vouch?
      (vch.destination_text ilike '%' || p_destination || '%') as dest_hit,
      (select l.id from public.vouch_list_items vli
         join public.lists l on l.id = vli.list_id
        where vli.vouch_id = vch.id and l.owner_id = vch.user_id and l.deleted_at is null
        order by (l.destination_text is not null) desc, l.created_at asc limit 1) as src_list_id
    from public.vouches vch
    join public.users u on u.id = vch.user_id
    left join trust tr on tr.person_id = vch.user_id
    where vch.deleted_at is null
      and (
        vch.destination_text ilike '%' || p_destination || '%'
        or vch.text ilike '%' || p_destination || '%'
      )
  )
  select c.id, c.src_list_id,
    (select l.title from public.lists l where l.id = c.src_list_id) as list_title,
    c.text, c.vouch_type, c.destination_text,
    c.author_id, c.author_name, c.author_handle, c.author_avatar,
    c.is_own, c.is_trusted, c.context_match,
    (0.55 * (case when c.is_own then 1.00 when c.is_trusted and c.context_match then 0.95
                  when c.is_trusted then 0.85 else 0.40 end)
     -- trip_relevance: a destination hit is a stronger match than a mid-text
     -- mention, so weight it slightly higher.
     + 0.25 * (case when c.dest_hit then 1.00 else 0.80 end)
     + 0.15 * least(1.0,
         (case when array_length(regexp_split_to_array(btrim(c.text), '\s+'),1) >= 4 then 0.8
               when array_length(regexp_split_to_array(btrim(c.text), '\s+'),1) >= 2 then 0.5 else 0.2 end)
         + (case when c.text ~* '\y(skip|unless|only|not|book|ask|before|after)\y' then 0.2 else 0 end))
     + 0.05 * (case when c.created_at > now() - interval '90 days' then 1.0
                    when c.created_at > now() - interval '365 days' then 0.6 else 0.3 end)
    ) as score, c.created_at
  from candidates c order by score desc, c.created_at desc;
$$;
grant execute on function public.search_vouches(text, text) to authenticated;
notify pgrst, 'reload schema';
