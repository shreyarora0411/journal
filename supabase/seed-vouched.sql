-- Vouched v3 seed — a small trusted graph around the demo user so search,
-- feed, and save can be experienced with real friend vouches.
--
-- Demo user (Shrey): 888671a6-3493-4255-ae55-407ebfad70b5 (already exists).
-- This seeds 5 validator friends, accepted follows (with trust contexts),
-- one trip each, and voiced category-slotted vouches in the PRD register.
--
-- Idempotent: fixed UUIDs + ON CONFLICT; seed-trip vouches are deleted and
-- reinserted so re-running refreshes the vouch text without duplicating.
-- Run in the Supabase SQL editor (service role bypasses RLS).
--
-- The friend rows are graph nodes only — they never log in, so the password
-- is a static placeholder hash.

do $$
declare
  shrey uuid := '888671a6-3493-4255-ae55-407ebfad70b5';
  pw text := '$2a$10$seedseedseedseedseedseueDsUf7p1bQ3hQ2y0r5Yk8mJ5b1pYpO'; -- placeholder, no login
  friends jsonb := '[
    {"id":"d1000000-0000-0000-0000-000000000001","handle":"divyansh","name":"Divyansh","ctx":["outdoors","local_logistics"]},
    {"id":"d1000000-0000-0000-0000-000000000002","handle":"mira_l","name":"Mira","ctx":["food"]},
    {"id":"d1000000-0000-0000-0000-000000000003","handle":"aanya","name":"Aanya","ctx":["stays","food"]},
    {"id":"d1000000-0000-0000-0000-000000000004","handle":"kenji","name":"Kenji","ctx":["food","local_logistics"]},
    {"id":"d1000000-0000-0000-0000-000000000005","handle":"tashi","name":"Tashi","ctx":["art_design","nightlife"]}
  ]'::jsonb;
  f jsonb;
begin
  for f in select * from jsonb_array_elements(friends)
  loop
    -- 1. auth.users (the on_auth_user_created trigger creates public.users).
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin,
      confirmation_token, recovery_token, email_change, email_change_token_new
    )
    values (
      '00000000-0000-0000-0000-000000000000', (f->>'id')::uuid, 'authenticated', 'authenticated',
      'seed-' || (f->>'handle') || '@vouched.seed', pw,
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}', '{}', false,
      '', '', '', ''
    )
    on conflict (id) do nothing;

    -- 2. profile fields (row exists via trigger).
    update public.users
      set handle = (f->>'handle'), display_name = (f->>'name')
      where id = (f->>'id')::uuid;

    -- 3. accepted follows, both directions (mutual circle).
    insert into public.follows (follower_id, followed_id, status, trust_contexts)
    values (shrey, (f->>'id')::uuid, 'accepted',
            array(select jsonb_array_elements_text(f->'ctx')))
    on conflict (follower_id, followed_id)
      do update set status = 'accepted', trust_contexts = excluded.trust_contexts;

    insert into public.follows (follower_id, followed_id, status, trust_contexts)
    values ((f->>'id')::uuid, shrey, 'accepted', '{}')
    on conflict (follower_id, followed_id) do update set status = 'accepted';
  end loop;
end $$;

-- 4. Trips (one per friend). Fixed ids → idempotent.
insert into public.trips (id, user_id, title, destination_text, verdict, visibility) values
  ('70000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000001','Spiti','Spiti','love','friends_of_friends'),
  ('70000000-0000-0000-0000-000000000002','d1000000-0000-0000-0000-000000000002','Bangkok','Bangkok','love','friends_of_friends'),
  ('70000000-0000-0000-0000-000000000003','d1000000-0000-0000-0000-000000000003','Goa','Goa','mid','friends_of_friends'),
  ('70000000-0000-0000-0000-000000000004','d1000000-0000-0000-0000-000000000004','Tokyo','Tokyo','love','friends_of_friends'),
  ('70000000-0000-0000-0000-000000000005','d1000000-0000-0000-0000-000000000005','Jaipur','Jaipur','love','friends_of_friends')
on conflict (id) do nothing;

-- 5. Vouches. Delete-then-insert keyed on the seed trips → idempotent refresh.
delete from public.vouches where trip_id in (
  '70000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000002',
  '70000000-0000-0000-0000-000000000003','70000000-0000-0000-0000-000000000004',
  '70000000-0000-0000-0000-000000000005'
);

insert into public.vouches (trip_id, user_id, text, vouch_type, destination_text, source, visibility) values
  -- Divyansh · Spiti
  ('70000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000001','Banjara in Kaza, book the tents not the rooms.','stay','Spiti','user_created','friends_of_friends'),
  ('70000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000001','Skip Kaza unless you need supplies.','skip','Spiti','user_created','friends_of_friends'),
  ('70000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000001','Key Monastery at sunrise, before the buses.','do','Spiti','user_created','friends_of_friends'),
  ('70000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000001','Carry cash — no ATMs past Reckong Peo.','good_to_know','Spiti','user_created','friends_of_friends'),
  -- Mira · Bangkok
  ('70000000-0000-0000-0000-000000000002','d1000000-0000-0000-0000-000000000002','Sri Trat for lunch not dinner, order the crab curry, book ahead.','eat_drink','Bangkok','user_created','friends_of_friends'),
  ('70000000-0000-0000-0000-000000000002','d1000000-0000-0000-0000-000000000002','Wat Pho early, before the tour groups.','do','Bangkok','user_created','friends_of_friends'),
  ('70000000-0000-0000-0000-000000000002','d1000000-0000-0000-0000-000000000002','Lub''d Siam if you want location on a budget.','stay','Bangkok','user_created','friends_of_friends'),
  -- Aanya · Goa
  ('70000000-0000-0000-0000-000000000003','d1000000-0000-0000-0000-000000000003','Assagao if you want restaurants nearby, skip it if you want a quiet beach.','stay','Goa','user_created','friends_of_friends'),
  ('70000000-0000-0000-0000-000000000003','d1000000-0000-0000-0000-000000000003','Villa Blanche for breakfast, go before 10.','eat_drink','Goa','user_created','friends_of_friends'),
  ('70000000-0000-0000-0000-000000000003','d1000000-0000-0000-0000-000000000003','Skip Baga and Calangute, it''s a zoo.','skip','Goa','user_created','friends_of_friends'),
  -- Kenji · Tokyo
  ('70000000-0000-0000-0000-000000000004','d1000000-0000-0000-0000-000000000004','Don''t over-plan. One neighbourhood a day, leave room to wander.','good_to_know','Tokyo','user_created','friends_of_friends'),
  ('70000000-0000-0000-0000-000000000004','d1000000-0000-0000-0000-000000000004','Fuglen for the hand drip, sit by the window.','eat_drink','Tokyo','user_created','friends_of_friends'),
  ('70000000-0000-0000-0000-000000000004','d1000000-0000-0000-0000-000000000004','Walk Kuramae to Asakusa at sunset.','do','Tokyo','user_created','friends_of_friends'),
  -- Tashi · Jaipur
  ('70000000-0000-0000-0000-000000000005','d1000000-0000-0000-0000-000000000005','Bar Palladio once, but go early — it gets scene-y after 9.','do','Jaipur','user_created','friends_of_friends'),
  ('70000000-0000-0000-0000-000000000005','d1000000-0000-0000-0000-000000000005','28 Kothi, small and lovely.','stay','Jaipur','user_created','friends_of_friends'),
  ('70000000-0000-0000-0000-000000000005','d1000000-0000-0000-0000-000000000005','Tapri for chai on the terrace.','eat_drink','Jaipur','user_created','friends_of_friends');
