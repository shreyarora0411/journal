-- Migration 39 — Loop B (Plan): plans, saved vouches, and the trust-led
-- search RPC.
--
-- Search returns trusted friends' vouches for a destination, ranked by WHO
-- said it (v3 §7). Person is the relevance signal — not taste, not
-- popularity. The score is transparent and computed in SQL:
--   relationship_trust 0.55 + trip_relevance 0.25 + specificity 0.15 + freshness 0.05

-- ---- plans + saved_vouches -------------------------------------------------

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  destination_text text not null,
  title text not null,
  trip_context text,
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists plans_user_idx on public.plans (user_id, created_at desc) where deleted_at is null;

alter table public.plans enable row level security;

drop policy if exists plans_owner_all on public.plans;
create policy plans_owner_all on public.plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists plans_set_updated_at on public.plans;
create trigger plans_set_updated_at
  before update on public.plans for each row execute function public.set_updated_at();

create table if not exists public.saved_vouches (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  vouch_id uuid not null references public.vouches (id) on delete cascade,
  saved_by_user_id uuid not null references public.users (id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  unique (plan_id, vouch_id)
);

create index if not exists saved_vouches_plan_idx on public.saved_vouches (plan_id);

alter table public.saved_vouches enable row level security;

-- A save is visible/editable only by the plan's owner.
drop policy if exists saved_vouches_owner_all on public.saved_vouches;
create policy saved_vouches_owner_all on public.saved_vouches
  for all
  using (exists (select 1 from public.plans p where p.id = plan_id and p.user_id = auth.uid()))
  with check (
    saved_by_user_id = auth.uid()
    and exists (select 1 from public.plans p where p.id = plan_id and p.user_id = auth.uid())
  );

grant select, insert, update, delete on public.plans to authenticated;
grant select, insert, update, delete on public.saved_vouches to authenticated;

-- ---- search_vouches RPC ----------------------------------------------------
-- Trust-led ranking. security invoker so the vouches RLS (circle read) still
-- bounds what the caller can see — the function can only rank rows the caller
-- could already SELECT. The trust/specificity/freshness math is the only
-- thing the function adds.
--
-- vouch_type → trust_context mapping for the context bonus:
--   stay → stays, eat_drink → food, good_to_know → local_logistics
--   (do/skip have no clean single context in v0 — no bonus, just base trust)

create or replace function public.search_vouches(
  p_destination text,
  p_context text default null
)
returns table (
  vouch_id uuid,
  trip_id uuid,
  vouch_text text,
  vouch_type text,
  destination_text text,
  author_id uuid,
  author_name text,
  author_handle text,
  author_avatar text,
  trip_title text,
  trip_verdict text,
  is_own boolean,
  is_trusted boolean,
  context_match boolean,
  score double precision,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  with viewer as (select auth.uid() as id),
  -- The viewer's accepted trust edges + the contexts they trust each person for.
  trust as (
    select f.followed_id as person_id, f.trust_contexts
    from public.follows f, viewer v
    where f.follower_id = v.id and f.status = 'accepted'
  ),
  candidates as (
    select
      vch.id, vch.trip_id, vch.text, vch.vouch_type, vch.destination_text,
      vch.user_id as author_id, vch.created_at,
      u.display_name as author_name, u.handle as author_handle, u.avatar_url as author_avatar,
      t.title as trip_title, t.verdict::text as trip_verdict,
      (vch.user_id = (select id from viewer)) as is_own,
      (tr.person_id is not null) as is_trusted,
      -- does the viewer trust this person for THIS kind of thing?
      coalesce(
        tr.trust_contexts && (
          case vch.vouch_type
            when 'stay' then array['stays']
            when 'eat_drink' then array['food']
            when 'good_to_know' then array['local_logistics']
            else array[]::text[]
          end
        ), false
      ) as context_match
    from public.vouches vch
    join public.users u on u.id = vch.user_id
    join public.trips t on t.id = vch.trip_id
    left join trust tr on tr.person_id = vch.user_id
    where vch.deleted_at is null
      and vch.destination_text ilike '%' || p_destination || '%'
  )
  select
    c.id, c.trip_id, c.text, c.vouch_type, c.destination_text,
    c.author_id, c.author_name, c.author_handle, c.author_avatar,
    c.trip_title, c.trip_verdict, c.is_own, c.is_trusted, c.context_match,
    (
      -- relationship_trust (0.55)
      0.55 * (
        case
          when c.is_own then 1.00
          when c.is_trusted and c.context_match then 0.95
          when c.is_trusted then 0.85
          else 0.40   -- visible but not a direct trust edge (e.g. own ask response surfaced via RLS)
        end
      )
      -- trip_relevance (0.25): returned rows already match the destination.
      + 0.25 * 1.00
      -- source_specificity (0.15): word count + contrast/action words.
      + 0.15 * least(
          1.0,
          (case when array_length(regexp_split_to_array(btrim(c.text), '\s+'), 1) >= 4 then 0.8
                when array_length(regexp_split_to_array(btrim(c.text), '\s+'), 1) >= 2 then 0.5
                else 0.2 end)
          + (case when c.text ~* '\y(skip|unless|only|not|book|ask|before|after)\y' then 0.2 else 0 end)
        )
      -- freshness (0.05): newer vouches lifted slightly; old strong ones still appear.
      + 0.05 * (
          case
            when c.created_at > now() - interval '90 days' then 1.0
            when c.created_at > now() - interval '365 days' then 0.6
            else 0.3
          end
        )
    ) as score,
    c.created_at
  from candidates c
  order by score desc, c.created_at desc;
$$;

grant execute on function public.search_vouches(text, text) to authenticated;

notify pgrst, 'reload schema';
