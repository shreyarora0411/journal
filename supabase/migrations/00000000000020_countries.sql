-- Migration 20 — countries: canonical ISO-coded country table.
--
-- Slots into the geographic hierarchy as countries → cities → areas → venues.
-- Replaces the free-text `places.country` column. Seed is the ~30
-- destinations the pilot will actually touch; the full ~250 ISO 3166-1
-- list can be loaded later via scripts/seed-countries.ts.
--
-- RLS: authenticated read only. Writes happen via service-role only
-- (admin scripts / future curation surfaces) — no client policy.

create table public.countries (
  id uuid primary key default gen_random_uuid(),
  iso_alpha2 text not null unique,
  iso_alpha3 text not null unique,
  display_name text not null,
  flag_emoji text,
  region text,                -- 'Asia' / 'Europe' / 'Americas' / 'Africa' / 'Oceania'
  hero_photo_url text,
  hero_photo_credit text,
  created_at timestamptz not null default now(),
  check (length(iso_alpha2) = 2),
  check (length(iso_alpha3) = 3)
);

create index countries_display_name_idx
  on public.countries (lower(display_name));
create index countries_region_idx
  on public.countries (region) where region is not null;

alter table public.countries enable row level security;

create policy countries_authenticated_read on public.countries
  for select to authenticated using (true);

-- Pilot seed ---------------------------------------------------------------
-- ~30 entries covering destinations our pilot users are likely to log.
-- Add new countries here (or via the future seed script) before the
-- place picker is asked to resolve a destination in them.

insert into public.countries (iso_alpha2, iso_alpha3, display_name, flag_emoji, region) values
  ('IN', 'IND', 'India', '🇮🇳', 'Asia'),
  ('NP', 'NPL', 'Nepal', '🇳🇵', 'Asia'),
  ('LK', 'LKA', 'Sri Lanka', '🇱🇰', 'Asia'),
  ('BT', 'BTN', 'Bhutan', '🇧🇹', 'Asia'),
  ('JP', 'JPN', 'Japan', '🇯🇵', 'Asia'),
  ('TH', 'THA', 'Thailand', '🇹🇭', 'Asia'),
  ('VN', 'VNM', 'Vietnam', '🇻🇳', 'Asia'),
  ('ID', 'IDN', 'Indonesia', '🇮🇩', 'Asia'),
  ('SG', 'SGP', 'Singapore', '🇸🇬', 'Asia'),
  ('HK', 'HKG', 'Hong Kong', '🇭🇰', 'Asia'),
  ('KR', 'KOR', 'South Korea', '🇰🇷', 'Asia'),
  ('TW', 'TWN', 'Taiwan', '🇹🇼', 'Asia'),
  ('PH', 'PHL', 'Philippines', '🇵🇭', 'Asia'),
  ('MY', 'MYS', 'Malaysia', '🇲🇾', 'Asia'),
  ('CN', 'CHN', 'China', '🇨🇳', 'Asia'),
  ('PT', 'PRT', 'Portugal', '🇵🇹', 'Europe'),
  ('ES', 'ESP', 'Spain', '🇪🇸', 'Europe'),
  ('FR', 'FRA', 'France', '🇫🇷', 'Europe'),
  ('IT', 'ITA', 'Italy', '🇮🇹', 'Europe'),
  ('GB', 'GBR', 'United Kingdom', '🇬🇧', 'Europe'),
  ('DE', 'DEU', 'Germany', '🇩🇪', 'Europe'),
  ('NL', 'NLD', 'Netherlands', '🇳🇱', 'Europe'),
  ('GR', 'GRC', 'Greece', '🇬🇷', 'Europe'),
  ('TR', 'TUR', 'Turkey', '🇹🇷', 'Europe'),
  ('CH', 'CHE', 'Switzerland', '🇨🇭', 'Europe'),
  ('IS', 'ISL', 'Iceland', '🇮🇸', 'Europe'),
  ('IE', 'IRL', 'Ireland', '🇮🇪', 'Europe'),
  ('US', 'USA', 'United States', '🇺🇸', 'Americas'),
  ('CA', 'CAN', 'Canada', '🇨🇦', 'Americas'),
  ('MX', 'MEX', 'Mexico', '🇲🇽', 'Americas'),
  ('BR', 'BRA', 'Brazil', '🇧🇷', 'Americas'),
  ('AR', 'ARG', 'Argentina', '🇦🇷', 'Americas'),
  ('AE', 'ARE', 'United Arab Emirates', '🇦🇪', 'Asia'),
  ('SA', 'SAU', 'Saudi Arabia', '🇸🇦', 'Asia'),
  ('JO', 'JOR', 'Jordan', '🇯🇴', 'Asia'),
  ('IL', 'ISR', 'Israel', '🇮🇱', 'Asia'),
  ('EG', 'EGY', 'Egypt', '🇪🇬', 'Africa'),
  ('MA', 'MAR', 'Morocco', '🇲🇦', 'Africa'),
  ('ZA', 'ZAF', 'South Africa', '🇿🇦', 'Africa'),
  ('KE', 'KEN', 'Kenya', '🇰🇪', 'Africa'),
  ('TZ', 'TZA', 'Tanzania', '🇹🇿', 'Africa'),
  ('AU', 'AUS', 'Australia', '🇦🇺', 'Oceania'),
  ('NZ', 'NZL', 'New Zealand', '🇳🇿', 'Oceania')
on conflict (iso_alpha2) do nothing;
