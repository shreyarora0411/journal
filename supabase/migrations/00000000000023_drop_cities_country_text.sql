-- Migration 23 — drop the legacy cities.country text column.
--
-- Run ONLY after migration 22's backfill has been verified clean. The
-- DO block below is a hard guard: if any city row has country text
-- without a matching country_id, the migration raises and the column
-- is preserved for manual fix-up.

do $$
declare
  unmatched_count int;
begin
  select count(*) into unmatched_count
  from public.cities
  where deleted_at is null
    and country_id is null
    and country is not null
    and country <> '';

  if unmatched_count > 0 then
    raise exception
      'Backfill incomplete: % cities have country text without a country_id. '
      'Run migration 22 diagnostics, add missing rows to public.countries, '
      'and re-run the backfill UPDATEs before applying this migration.',
      unmatched_count;
  end if;
end $$;

alter table public.cities drop column country;
