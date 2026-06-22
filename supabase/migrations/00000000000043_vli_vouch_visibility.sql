-- Migration 43 — vouch_list_items read also gates on the vouch's visibility.
--
-- Review of migration 42 found an asymmetry: vli_read gated a membership row
-- solely on the parent LIST's visibility, not the linked vouch's own. A list
-- owner can add a more-private vouch (e.g. 'followers') into a wider list
-- ('everyone'); a viewer who can see the list but not the vouch could then
-- read the vouch_list_items row (a vouch UUID + membership) even though the
-- vouches RLS correctly blocks the vouch content itself.
--
-- Low severity (no content leaks — only an opaque id + membership), but it's
-- an inconsistency that returns items whose vouch then fails to load. Tighten
-- vli_read to require BOTH the list and the vouch be visible to the viewer.

drop policy if exists vli_read on public.vouch_list_items;
create policy vli_read on public.vouch_list_items
  for select
  using (
    exists (
      select 1 from public.lists l
      where l.id = list_id
        and l.deleted_at is null
        and (l.owner_id = auth.uid() or public.is_visible_to(auth.uid(), l.owner_id, l.visibility))
    )
    and exists (
      select 1 from public.vouches v
      where v.id = vouch_id
        and v.deleted_at is null
        and (auth.uid() = v.user_id or public.is_visible_to(auth.uid(), v.user_id, v.visibility))
    )
  );

notify pgrst, 'reload schema';
