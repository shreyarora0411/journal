-- Migration 56 — taste vocabulary seed (v1, NCR-tuned).
--
-- PARITY CONTRACT: these rows are the DB copy of CATEGORY_PRIORS and
-- ALL_TASTE_TAGS in packages/shared/src/taste.ts. If that file changes, ship a
-- new data migration re-upserting the changed rows in the same PR.
-- Axis array order: [substance_scene, mellow_lively, adventurous_trusty,
-- refined_unfussy, value_splurge].

insert into public.category_priors (category, axes) values
  ('restaurant',     '{0,0,0,0,0}'),
  ('fine_dining',    '{-0.3,-0.2,0,-0.5,0.5}'),
  ('cafe',           '{-0.2,-0.4,0,0,-0.2}'),
  ('bakery_dessert', '{-0.3,-0.3,0,0,-0.1}'),
  ('street_food',    '{-0.5,0,0,0.5,-0.5}'),
  ('bar',            '{0.2,0.2,0,0,0}'),
  ('cocktail_bar',   '{0.1,0.1,0,-0.3,0.3}'),
  ('brewery',        '{0.2,0.3,0,0.3,-0.1}'),
  ('club',           '{0.5,0.5,0,0,0.3}'),
  ('live_music',     '{0.3,0.3,0,0,0}')
on conflict (category) do update set axes = excluded.axes;

insert into public.taste_tags (slug, kind, label, axis_effects) values
  ('regional_indian',       'format', 'Regional Indian',       '{"substance_scene":-0.3,"adventurous_trusty":-0.2}'),
  ('north_indian',          'format', 'North Indian',          '{}'),
  ('pan_asian',             'format', 'Pan-Asian',             '{}'),
  ('japanese_izakaya',      'format', 'Japanese / izakaya',    '{"substance_scene":-0.2,"adventurous_trusty":-0.2}'),
  ('european',              'format', 'European',              '{}'),
  ('middle_eastern',        'format', 'Middle Eastern',        '{}'),
  ('small_plates',          'format', 'Small plates',          '{"substance_scene":-0.2}'),
  ('tasting_menu',          'format', 'Tasting menu',          '{"substance_scene":-0.4,"refined_unfussy":-0.4,"value_splurge":0.5}'),
  ('street_food',           'format', 'Street food',           '{"substance_scene":-0.4,"refined_unfussy":0.5,"value_splurge":-0.5}'),
  ('specialty_coffee',      'format', 'Specialty coffee',      '{"substance_scene":-0.4,"mellow_lively":-0.3}'),
  ('dessert',               'format', 'Dessert',               '{}'),
  ('cocktail_forward',      'format', 'Cocktail-forward',      '{"substance_scene":-0.1,"value_splurge":0.2}'),
  ('natural_wine',          'format', 'Natural wine',          '{"substance_scene":-0.2,"adventurous_trusty":-0.3,"mellow_lively":-0.2}'),
  ('craft_beer',            'format', 'Craft beer',            '{"refined_unfussy":0.2}'),
  ('dive_energy',           'format', 'Dive energy',           '{"refined_unfussy":0.5,"value_splurge":-0.3,"substance_scene":0.1}'),
  ('rooftop_view',          'format', 'Rooftop / view',        '{"substance_scene":0.4}'),
  ('live_music',            'format', 'Live music',            '{"substance_scene":0.3,"mellow_lively":0.3}'),
  ('dj_dancefloor',         'format', 'DJ / dancefloor',       '{"substance_scene":0.4,"mellow_lively":0.5}'),
  ('big_night_energy',      'format', 'Big-night energy',      '{"mellow_lively":0.5,"substance_scene":0.3}'),
  ('date_spot',             'format', 'Date spot',             '{"mellow_lively":-0.3}'),
  ('conversation_friendly', 'format', 'You can actually talk', '{"mellow_lively":-0.5}'),
  ('chefs_place',           'format', 'Chef''s place',         '{"substance_scene":-0.4,"adventurous_trusty":-0.2}'),
  ('old_reliable',          'format', 'Old reliable',          '{"adventurous_trusty":0.5}'),
  ('new_opening',           'format', 'New opening',           '{"adventurous_trusty":-0.4}'),
  ('solo_coffee',           'occasion', 'Solo / coffee',       '{}'),
  ('date',                  'occasion', 'Date',                '{}'),
  ('small_group',           'occasion', 'Small group',         '{}'),
  ('big_night',              'occasion', 'Big night',          '{}'),
  ('late_night',            'occasion', 'Late night',          '{}')
on conflict (slug) do update
  set kind = excluded.kind, label = excluded.label, axis_effects = excluded.axis_effects;

notify pgrst, 'reload schema';
