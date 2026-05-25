-- Migration 17 — wishlist parent/child + notes columns.
--
-- The brief's "Stash for my Tokyo" surface stashes a specific venue into
-- the user's existing Tokyo wishlist entry. That requires a parent/child
-- relationship between wishlist rows. The `notes` column gives users
-- somewhere to drop the why behind a stash.
--
-- An optional `target_external_id` lets us stash a Google Place that
-- isn't yet a row in public.destinations (the destinations table fills
-- in lazily as users actually visit the place).

alter table public.wishlist_items
  add column if not exists parent_wishlist_item_id uuid
    references public.wishlist_items (id) on delete cascade,
  add column if not exists notes text,
  add column if not exists target_external_id text,
  add column if not exists target_label text;

create index if not exists wishlist_parent_idx
  on public.wishlist_items (parent_wishlist_item_id)
  where parent_wishlist_item_id is not null;

create index if not exists wishlist_user_external_idx
  on public.wishlist_items (user_id, target_external_id)
  where target_external_id is not null;
