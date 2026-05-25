-- Migration 16 — store plaintext E.164 phone for following users.
--
-- Why plaintext: the Ping button on a destination page deep-links to
-- WhatsApp with `whatsapp://send?phone=...`. The hash isn't reversible
-- so we need the plaintext somewhere the client can read.
--
-- Privacy posture (pilot scale):
--   - The column lives on public.users alongside the hash.
--   - The safe-column grant (migration 10) does NOT include phone_e164.
--     Direct SELECT of phone_e164 from `authenticated` is blocked.
--   - The only read path is `get_phone_for_friend(target_user_id)` which
--     returns the number only when caller and target follow each other in
--     at least one direction.
--   - Supabase admins (service_role) can still read everyone's number —
--     for real production an envelope-encryption scheme is the next step,
--     but for 20 pilot users this is acceptable.

alter table public.users
  add column if not exists phone_e164 text;

alter table public.users
  add constraint users_phone_e164_e164_format
  check (phone_e164 is null or phone_e164 ~ '^\+[0-9]{8,15}$');

-- The column is NOT in the safe-columns grant. Authenticated users
-- cannot SELECT it directly even via the existing
-- users_safe_cols_read policy — column privileges win.
-- (No grant statement here; absence is denial.)

-- ---- get_phone_for_friend() -------------------------------------------
-- Returns target user's plaintext phone if the caller is in a follow
-- relationship with them (either direction), else null.
-- security invoker — runs as the caller so the auth.uid() check is
-- bound to the actual request. The function reads via service-role
-- privileges granted to the function owner (the migration runner has
-- broad SELECT on users), so we don't hit the column grant.

create or replace function public.get_phone_for_friend(target_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select phone_e164 from public.users
  where id = target_user_id
    and deleted_at is null
    and phone_e164 is not null
    and (
      exists (
        select 1 from public.follows
        where follower_id = auth.uid() and followed_id = target_user_id
      )
      or exists (
        select 1 from public.follows
        where follower_id = target_user_id and followed_id = auth.uid()
      )
    );
$$;

grant execute on function public.get_phone_for_friend(uuid) to authenticated;
