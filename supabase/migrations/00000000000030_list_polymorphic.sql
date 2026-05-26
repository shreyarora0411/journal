-- Migration 30 — polymorphic list items.
--
-- Lists need to reference trips and venues, not just destinations and
-- cities. Add a `list_item_target` enum + `target_type` + `target_id`
-- columns alongside the existing destination_id / city_id pair.
--
-- Backward compat: existing rows keep their destination_id / city_id
-- and may have NULL target_type. New writes go through the polymorphic
-- columns. Eventually destination_id / city_id can be backfilled into
-- the polymorphic columns and dropped — separate migration.

create type public.list_item_target as enum ('trip', 'city', 'venue');

alter table public.list_items
  add column if not exists target_type public.list_item_target,
  add column if not exists target_id uuid,
  add column if not exists added_by_user_id uuid references public.users(id) on delete set null;

-- One polymorphic item per (list, target). Doesn't constrain the legacy
-- (destination_id / city_id) rows — those have target_type null.
create unique index if not exists list_items_unique_target
  on public.list_items (list_id, target_type, target_id)
  where target_type is not null and target_id is not null;

-- Soft check: if target_type is set, target_id must be too, and vice versa.
alter table public.list_items
  drop constraint if exists list_items_polymorphic_pair;
alter table public.list_items
  add constraint list_items_polymorphic_pair
  check ((target_type is null) = (target_id is null));

-- The brief uses `position` rather than the legacy `order_index`. Both
-- name the same concept; add a position alias as a separate column for
-- new code, defaulting to a copy of order_index. Tightening this into
-- one column is a follow-up migration once all client code stops using
-- order_index.
alter table public.list_items
  add column if not exists position int not null default 0;

-- Backfill: copy existing order_index into position for legacy rows.
update public.list_items
set position = order_index
where position = 0 and order_index <> 0;

-- Index for stable ordering inside a list.
create index if not exists list_items_list_position_idx
  on public.list_items (list_id, position);
