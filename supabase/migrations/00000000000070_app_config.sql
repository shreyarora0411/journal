-- Migration 70 — app_config: a tiny, server-only key/value store.
--
-- WHY: the invite-redirect edge function needs a stable target URL that
-- changes every time a new EAS build ships (this session alone produced
-- four different artifact URLs). Baking the target into app.json/INVITE_URL
-- would mean every rebuild requires a NEW app release for old shared links
-- to still resolve — exactly backwards. Baking it into the edge function's
-- source would mean redeploying the function on every build. A one-row
-- config table lets the founder (or an agent on their behalf) repoint every
-- outstanding invite link with a single UPDATE, no app release, no function
-- redeploy.
--
-- Locked down deliberately: RLS enabled, ZERO policies. Not even
-- `authenticated` can read or write this table — only service_role
-- (the edge function's client) and postgres. There is no product reason for
-- any client, logged in or not, to see or set config.

create table public.app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;
-- No policies: default-deny for anon and authenticated, per this table's
-- entire purpose (see header). service_role bypasses RLS by design.

grant select on public.app_config to service_role;

insert into public.app_config (key, value) values
  ('invite_install_url', 'https://expo.dev/artifacts/eas/OB5koVqD0BCKJAY5H-uMff7mQ2muMmjtz4Ke8o6kt70.apk');

notify pgrst, 'reload schema';
