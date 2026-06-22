-- Migration 41 — Loop C (Ask): recommendation requests + responses.
--
-- With a sparse seed graph, passive search (Loop B) returns thin results.
-- Ask generates targeted supply on demand: a user asks their circle about a
-- destination, trusted people respond with a vouch (or free text). v3 treats
-- Ask as a peer to Search, not a fallback.

create table if not exists public.recommendation_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references public.users (id) on delete cascade,
  destination_text text not null,
  request_text text not null,
  audience text not null default 'trusted_circle',
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint rec_req_audience_check check (audience in ('trusted_circle','selected_people')),
  constraint rec_req_status_check check (status in ('open','closed'))
);

create index if not exists rec_req_requester_idx on public.recommendation_requests (requester_user_id, created_at desc) where deleted_at is null;

alter table public.recommendation_requests enable row level security;

-- The requester manages their own requests.
drop policy if exists rec_req_owner_all on public.recommendation_requests;
create policy rec_req_owner_all on public.recommendation_requests
  for all using (auth.uid() = requester_user_id) with check (auth.uid() = requester_user_id);

-- A trusted circle member can SEE a request addressed to the circle, so they
-- can answer it. (selected_people targeting is a v0+ refinement; for now a
-- trusted_circle request is visible to anyone the requester has an accepted
-- trust edge to.)
drop policy if exists rec_req_circle_read on public.recommendation_requests;
create policy rec_req_circle_read on public.recommendation_requests
  for select
  using (
    deleted_at is null
    and audience = 'trusted_circle'
    and exists (
      select 1 from public.follows f
      where f.follower_id = auth.uid()
        and f.followed_id = recommendation_requests.requester_user_id
        and f.status = 'accepted'
    )
  );

drop trigger if exists rec_req_set_updated_at on public.recommendation_requests;
create trigger rec_req_set_updated_at
  before update on public.recommendation_requests for each row execute function public.set_updated_at();

create table if not exists public.recommendation_responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.recommendation_requests (id) on delete cascade,
  responder_user_id uuid not null references public.users (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete set null,
  vouch_id uuid references public.vouches (id) on delete set null,
  text text,
  created_at timestamptz not null default now(),
  -- A response must carry something: a linked vouch, a trip, or free text.
  constraint rec_resp_has_content check (vouch_id is not null or trip_id is not null or text is not null)
);

create index if not exists rec_resp_request_idx on public.recommendation_responses (request_id, created_at);

alter table public.recommendation_responses enable row level security;

-- A responder can write their own response (to a request they can see).
drop policy if exists rec_resp_responder_insert on public.recommendation_responses;
create policy rec_resp_responder_insert on public.recommendation_responses
  for insert
  with check (
    responder_user_id = auth.uid()
    and exists (select 1 from public.recommendation_requests r where r.id = request_id)
  );

-- Visible to the request's requester OR the responder. (The requester needs
-- to read the answers; a responder can see their own.)
drop policy if exists rec_resp_read on public.recommendation_responses;
create policy rec_resp_read on public.recommendation_responses
  for select
  using (
    responder_user_id = auth.uid()
    or exists (
      select 1 from public.recommendation_requests r
      where r.id = request_id and r.requester_user_id = auth.uid()
    )
  );

drop policy if exists rec_resp_responder_modify on public.recommendation_responses;
create policy rec_resp_responder_modify on public.recommendation_responses
  for delete using (responder_user_id = auth.uid());

grant select, insert, update, delete on public.recommendation_requests to authenticated;
grant select, insert, update, delete on public.recommendation_responses to authenticated;

notify pgrst, 'reload schema';
