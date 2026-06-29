-- Migration 46 — search that survives an apostrophe.
--
-- Real moment: you type "Lub d" into search and get "Nothing from your circle
-- yet." — even though five Lub'd vouches sit in your Koh Samui list. Type "Lub"
-- and all five appear. The difference is one character: the vouches are stored
-- as "Lub'd" (apostrophe) and search did a LITERAL substring test
-- (`text ilike '%' || query || '%'`). "Lub" is a substring of "Lub'd"; "Lub d"
-- (space, no apostrophe) is not. One opaque blob match, no tokenizing, no
-- punctuation folding — so the apostrophe wins and the recommendation stays
-- invisible.
--
-- Fix (matching/recall only — the trust thesis is untouched):
--   1. norm_search(): lowercase, fold every non-alphanumeric run to a single
--      space, trim. "Lub'd", "Lub d", "lub  d" all collapse to "lub d".
--   2. Token-aware AND: split the normalized query into tokens; a vouch is a
--      candidate only if EVERY token appears in its normalized destination+text.
--      "Lub d" -> [lub, d], both present in "lub d" -> hit.
--   3. pg_trgm fuzzy fallback (`%` similarity): catches near-misses so a
--      fat-fingered query still finds the vouch.
--   4. Non-Latin fallback: a query in a script with no [a-z0-9] (Japanese,
--      Hindi, ...) normalizes to '' — for those we fall back to the old raw
--      ilike so Tokyo/Jaipur queries in native script still match. A genuinely
--      empty query keeps the prior "everything is a candidate" behaviour.
--   5. The trust-led score keeps its exact structure (relationship .55 /
--      trip_relevance .25 / source_specificity .15 / freshness .05). dest_hit
--      now uses the SAME normalized test so a destination match still earns the
--      full trip_relevance band; a small capped similarity bump + a similarity
--      tie-breaker sort the closest match first. No new score term, no stars.
--
-- security invoker + RLS behaviour identical: the function still only ever sees
-- rows the caller could already SELECT under the vouches circle-read policy.
-- pg_trgm's `%` operator and gin_trgm_ops live in the `extensions` schema (where
-- pgcrypto/citext were installed), so search_path widens to public, extensions.

-- 1. Extension (not previously enabled) — installed alongside the other extensions.
create extension if not exists pg_trgm with schema extensions;

-- 2. Normalization helper. IMMUTABLE + parallel safe so it is usable in an
--    expression index. coalesce keeps it null-safe.
create or replace function public.norm_search(t text)
returns text
language sql
immutable
parallel safe
set search_path = public, extensions
as $$
  select btrim(regexp_replace(lower(coalesce(t, '')), '[^a-z0-9]+', ' ', 'g'));
$$;

-- 3. Trigram indexes on the normalized columns so the fuzzy `%` fallback doesn't
--    force a sequential scan. Partial on live rows, matching house convention.
create index if not exists vouches_norm_dest_trgm
  on public.vouches using gin (public.norm_search(destination_text) extensions.gin_trgm_ops)
  where deleted_at is null;

create index if not exists vouches_norm_text_trgm
  on public.vouches using gin (public.norm_search(text) extensions.gin_trgm_ops)
  where deleted_at is null;

-- 4. Redefine the RPC. Signature, RETURNS TABLE column set/order/names,
--    `stable`, and `security invoker` are all preserved exactly so the client
--    (use-vouch-search.ts / VouchSearchResult) and RLS are unaffected.
create or replace function public.search_vouches(
  p_destination text,
  p_context text default null
)
returns table (
  vouch_id uuid, list_id uuid, list_title text, vouch_text text, vouch_type text,
  destination_text text, author_id uuid, author_name text, author_handle text, author_avatar text,
  is_own boolean, is_trusted boolean, context_match boolean, score double precision, created_at timestamptz
)
language sql stable security invoker set search_path = public, extensions
as $$
  with viewer as (select auth.uid() as id),
  -- Normalized query + its tokens + the raw trimmed query, computed once.
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
      -- did the (normalized) query hit the destination? Punctuation-insensitive
      -- now. For a non-Latin query (nq = '' but raw <> '') fall back to raw ilike.
      (
        (q.nq <> '' and public.norm_search(vch.destination_text) like '%' || q.nq || '%')
        or (q.nq = '' and q.raw <> '' and vch.destination_text ilike '%' || q.raw || '%')
      ) as dest_hit,
      -- best fuzzy similarity across destination + text, for the relevance bump
      -- and tie-breaker. 0 when there is no normalizable query.
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
    where vch.deleted_at is null
      and (
        -- Genuinely empty query: keep prior behaviour ('%%' matched all rows).
        q.raw = ''
        -- Token-aware AND: every non-empty query token must appear somewhere in
        -- the normalized destination + text. "Lub d" -> tokens lub, d -> both
        -- present in normalized "Lub'd" ("lub d") -> match.
        or (q.nq <> '' and not exists (
          select 1 from unnest(q.toks) as tok
          where tok <> ''
            and position(
              tok in public.norm_search(vch.destination_text) || ' ' || public.norm_search(vch.text)
            ) = 0
        ))
        -- Fuzzy fallback for typos / near-misses.
        or (q.nq <> '' and (
              public.norm_search(vch.destination_text) % q.nq
           or public.norm_search(vch.text) % q.nq))
        -- Non-Latin query (normalized away to '' but the user typed something):
        -- fall back to the original raw substring match so e.g. a Japanese or
        -- Hindi place name still resolves.
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
    (0.55 * (case when c.is_own then 1.00 when c.is_trusted and c.context_match then 0.95
                  when c.is_trusted then 0.85 else 0.40 end)
     -- trip_relevance: a destination hit is the strongest match (1.00); a
     -- text-only hit is 0.80; a fuzzy-only near-miss earns a small bump scaled
     -- by similarity, capped so it can never beat a real text hit.
     + 0.25 * (case when c.dest_hit then 1.00
                    when c.sim > 0 then least(0.80, 0.55 + 0.25 * c.sim)
                    else 0.80 end)
     + 0.15 * least(1.0,
         (case when array_length(regexp_split_to_array(btrim(c.text), '\s+'),1) >= 4 then 0.8
               when array_length(regexp_split_to_array(btrim(c.text), '\s+'),1) >= 2 then 0.5 else 0.2 end)
         + (case when c.text ~* '\y(skip|unless|only|not|book|ask|before|after)\y' then 0.2 else 0 end))
     + 0.05 * (case when c.created_at > now() - interval '90 days' then 1.0
                    when c.created_at > now() - interval '365 days' then 0.6 else 0.3 end)
    ) as score, c.created_at
  from candidates c
  -- score first (trust-led, unchanged), then closest textual match, then recency.
  order by score desc, c.sim desc, c.created_at desc;
$$;

grant execute on function public.norm_search(text) to authenticated;
grant execute on function public.search_vouches(text, text) to authenticated;

notify pgrst, 'reload schema';
