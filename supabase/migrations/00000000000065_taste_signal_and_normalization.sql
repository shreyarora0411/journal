-- Migration 65 — give the taste engine real per-place signal, and stop the
-- identity readout from disappearing as users engage with the product.
--
-- ROOT CAUSE 1 (no signal): place_axes() only ever derived a place's
-- fingerprint from its CATEGORY's shared prior (category_priors.axes) plus
-- crowd tag votes. category_priors.restaurant = '{0,0,0,0,0}' by design (the
-- bucket spans everything from a dhaba to a tasting menu, so a single
-- shared vector for "restaurant" would misrepresent most of them) — but
-- with 36 of 71 live Gurgaon venues categorized as bare "restaurant" and a
-- total of 1 tag vote in the whole database, effectively the entire corpus
-- carries zero taste signal. Every loved place contributes nothing, so
-- taste_match between any two real users currently computes to ~0.
--
-- FIX 1: add a nullable per-PLACE `axes` override on canonical_places.
-- place_axes() now prefers it over the category prior. This is genuine new
-- infrastructure, not a data fix — hand-fingerprinting real venues with
-- real per-place signal is founder-owned taste judgment (tracked separately,
-- NOT fabricated here); this migration only builds the column + the
-- function preferring it, so that work has somewhere to land.
--
-- ROOT CAUSE 2 (readout dilution): user_taste_axes summed every reaction's
-- contribution into a SINGLE shared weight denominator (v_total) applied
-- uniformly across all 5 axes. A reaction that is exactly neutral (0) on a
-- given axis still counted toward that axis's denominator — so loving
-- zero-signal places (unavoidable while root cause 1 stood) pulled EVERY
-- axis toward zero even though those places said nothing about it. Modeled:
-- with a ±0.5 quiz prior and zero-signal loves, the vector crossed below
-- tasteReadout's ±0.25 "speak" threshold after just 3 loves. Verified live:
-- the founder's account (19 loves, mostly zero-signal legacy places) has a
-- loves-only vector of {0,0,0,0,0} and a full vector of ~±0.048 — an order
-- of magnitude below the threshold, exactly matching the model.
--
-- FIX 2: user_taste_axes now tracks a PER-AXIS weight, not one shared
-- scalar. A reaction contributes to axis i's sum/denominator only when the
-- place is non-neutral on axis i. A neutral place is now uninformative for
-- that axis rather than diluting it — "leans substance-first" no longer
-- erodes just because you also loved three places with no opinion on
-- substance vs scene.
--
-- packages/shared/src/taste.ts's userTasteAxes/blendFingerprint are updated
-- in the same PR per the parity contract (see that file's header).

alter table public.canonical_places
  add column if not exists axes double precision[];

comment on column public.canonical_places.axes is
  'Optional per-place curated taste fingerprint (5 axes, same order as '
  'TASTE_AXES in packages/shared/src/taste.ts). Overrides the category '
  'prior in place_axes() when present. Founder/curator-set; never '
  'inferred from a single user''s reactions.';

-- ---- place_axes(): per-place override wins over category prior ---------

create or replace function public.place_axes(p_place uuid)
returns double precision[] language plpgsql stable security definer set search_path = public
as $$
declare
  v_axes double precision[];
  v_total int;
  rec record;
  v_axis_names text[] := array['substance_scene','mellow_lively','adventurous_trusty','refined_unfussy','value_splurge'];
  i int;
begin
  select coalesce(cp.axes, cp2.axes, '{0,0,0,0,0}')
    into v_axes
  from public.canonical_places cp
  left join public.category_priors cp2 on cp2.category = cp.category
  where cp.id = p_place;
  if v_axes is null then v_axes := '{0,0,0,0,0}'; end if;

  select count(distinct user_id) into v_total
  from public.place_tag_votes where place_id = p_place;
  if v_total = 0 then return v_axes; end if;

  for rec in
    select t.axis_effects, count(distinct v.user_id)::double precision / v_total as share
    from public.place_tag_votes v
    join public.taste_tags t on t.slug = v.tag_slug
    where v.place_id = p_place
    group by t.slug, t.axis_effects
  loop
    for i in 1..5 loop
      v_axes[i] := v_axes[i]
        + coalesce((rec.axis_effects ->> v_axis_names[i])::double precision, 0) * rec.share;
    end loop;
  end loop;

  for i in 1..5 loop
    v_axes[i] := public.clamp_axis(v_axes[i]);
  end loop;
  return v_axes;
end;
$$;

-- ---- user_taste_axes(): per-axis weight, not one shared scalar ---------

create or replace function public.user_taste_axes(p_user uuid, p_loves_only boolean default false)
returns double precision[] language plpgsql stable security definer set search_path = public
as $$
declare
  v_sum double precision[] := '{0,0,0,0,0}';
  v_axis_weight double precision[] := '{0,0,0,0,0}';
  v_out double precision[] := '{0,0,0,0,0}';
  v_prior double precision[];
  rec record;
  v_w double precision;
  v_place_axes double precision[];
  i int;
begin
  for rec in
    select place_id, sentiment,
           extract(epoch from (now() - updated_at)) / 86400.0 as age_days
    from public.place_reactions
    where user_id = p_user
      and (sentiment = 'loved' or (not p_loves_only and sentiment = 'skip'))
  loop
    v_w := case rec.sentiment when 'loved' then 1.0 else -0.5 end
           * power(2.0, -rec.age_days / 180.0);
    v_place_axes := public.place_axes(rec.place_id);
    for i in 1..5 loop
      -- A place exactly neutral on axis i carries no information about
      -- it — exclude it from axis i's weight rather than diluting toward
      -- zero (this is the readout-dilution fix).
      if v_place_axes[i] != 0 then
        v_sum[i] := v_sum[i] + v_w * v_place_axes[i];
        v_axis_weight[i] := v_axis_weight[i] + abs(v_w);
      end if;
    end loop;
  end loop;

  if not p_loves_only then
    select axes into v_prior from public.user_taste_priors where user_id = p_user;
    if v_prior is not null then
      for i in 1..5 loop
        if v_prior[i] != 0 then
          v_sum[i] := v_sum[i] + 2.0 * v_prior[i];
          v_axis_weight[i] := v_axis_weight[i] + 2.0;
        end if;
      end loop;
    end if;
  end if;

  for i in 1..5 loop
    v_out[i] := case when v_axis_weight[i] = 0 then 0
                      else public.clamp_axis(v_sum[i] / v_axis_weight[i]) end;
  end loop;
  return v_out;
end;
$$;

notify pgrst, 'reload schema';
