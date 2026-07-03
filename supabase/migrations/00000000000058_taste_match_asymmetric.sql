-- Migration 58 — taste_match v2: ASYMMETRIC skip-aware matching.
--
-- v1 used loves-only vectors on BOTH sides, because the match scalar is
-- observable cross-user and folding the TARGET's skips in would make their
-- private skips reconstructable by vector-steering (adversarial review, mig 55).
--
-- v2 recovers the skip signal safely: the VIEWER's side now uses their FULL
-- vector (loves + their own skips at -0.5 + onboarding priors) — zero leak,
-- it's their own data and the result is shown only to them. The OTHER side
-- stays LOVES-ONLY, so nobody's private skips remain probeable.
--
-- Consequence: match(A→B) ≠ match(B→A). That's correct — "fit to YOU" is
-- viewer-centric, exactly like the recommendations it powers.
--
-- PARITY: packages/shared/src/taste.ts TASTE_TUNING.matchOtherSideLovesOnly.

create or replace function public.taste_match(p_other uuid)
returns double precision language plpgsql stable security definer set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_raw double precision;
begin
  if v_me is null or p_other is null or v_me = p_other then return null; end if;
  if public.is_blocked_pair(v_me, p_other) then return null; end if;
  if public.user_love_count(v_me) < 8 or public.user_love_count(p_other) < 8 then
    return null;
  end if;
  v_raw := 0.7 * public.axes_cosine(
             public.user_taste_axes(v_me, false),   -- viewer: FULL (loves + own skips + priors)
             public.user_taste_axes(p_other, true)) -- other: LOVES-ONLY (privacy)
         + 0.3 * public.tags_weighted_jaccard(
             public.user_taste_tags(v_me),
             public.user_taste_tags(p_other));
  return round(greatest(0.0, least(1.0, v_raw))::numeric, 2);
end;
$$;

-- Grants unchanged (create-or-replace preserves them), but re-assert per the
-- mig 55 §10 hygiene note.
revoke execute on function public.taste_match(uuid) from public, anon;
grant execute on function public.taste_match(uuid) to authenticated;

notify pgrst, 'reload schema';
