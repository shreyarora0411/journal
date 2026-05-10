-- Phase 0.3: users table extending auth.users with application profile fields.
-- Created via a trigger on auth.users insert; one row per auth user.

create type public.visibility as enum ('followers', 'friends_of_friends', 'everyone');

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  handle citext unique,
  display_name text,
  avatar_url text,
  phone_hash bytea,
  default_visibility public.visibility not null default 'friends_of_friends',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index users_phone_hash_idx on public.users (phone_hash);
create index users_handle_idx on public.users (handle);

-- Enable RLS. Default deny.
alter table public.users enable row level security;

-- Owner can read/update their own row.
create policy users_owner_select
  on public.users for select
  using (auth.uid() = id and deleted_at is null);

create policy users_owner_update
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Authenticated users can read other users' minimal public fields.
-- (Tightened in Phase 1 once we know the exact surface.)
create policy users_authenticated_read
  on public.users for select
  to authenticated
  using (deleted_at is null);

-- Bump updated_at on every update.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- Auto-create a public.users row when a new auth.users row is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
