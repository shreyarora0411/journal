# 0011 — Geographic hierarchy: countries → cities → areas → venues

## Context

Until migration 19 the data model had a flat `places` table with a
free-text `country` column. Two pain points compounded:

1. **Profile stats lied.** "11 countries" was `count(distinct places.country)`
   across free-text values, so "Japan" / "japan" / "JP" counted as three.
2. **Search was country-blind.** Searching "Japan" returned at best
   a tsvector hit on cities tagged with `country = 'Japan'`. There was
   no canonical country entity to surface, no way to group, no way to
   render flags or regions.

The Postmark brief layered `destinations` as an aggregation entity but
left `places` untouched — workable for v0 surfaces, but a dead end for
country pages, taste-twin computations, and any feature that requires
"all friends who've been to X country."

## Decision

Restructure the schema around an explicit hierarchy:

```
trips
 └── cities (renamed from places)
      ├── country_id → countries  (new canonical, ISO-coded)
      ├── areas
      └── venues
```

- `countries` is a new ISO 3166-1 table seeded with the ~30 destinations
  the pilot will touch; the full ~250 can be loaded incrementally as the
  user base grows.
- `places` is renamed to `cities` everywhere — table, FK columns
  (`venues.city_id`, `areas.city_id`, `list_items.city_id`,
  `wishlist_items.city_id`, `trip_photos.city_id`), enum values
  (`tip_parent`, `verdict_target`, `search_result_kind` all rename
  `'place'` to `'city'`), and the canonical view (`canonical_cities`).
- `cities.country` text is replaced with `cities.country_id` (FK to
  countries). Backfill matches by display_name + common variants; a
  hard guard in migration 23 refuses to drop the text column until
  every non-deleted city resolves.

`destinations` (the Postmark aggregation layer) is intentionally
**untouched** in this refactor. It still uses free-text country.
Migrating it to country_id can happen later if/when destinations get
their own surfaces.

## Out of scope

- Country detail pages (a screen showing all friends' trips in a country)
- Region detail pages (all trips in "Asia")
- Country flag rendering on existing screens
- Migrating `destinations.country` to country_id

These all become possible after this refactor.

## Consequences

- **Pro:** real distinct-country aggregations; search can return
  countries as a top-level result; cities have a stable canonical
  parent (no more "Japan" vs "japan" split).
- **Pro:** RLS / function bodies are now bounded by a clearly-named
  hierarchy. `count(distinct country_id)` is honest.
- **Con:** five-migration deploy (20 → 24) with an explicit verify-and-
  retry step at 22 before dropping text at 23. Migrations 21–24 must
  ship together to avoid a broken intermediate state where RPC bodies
  still reference `places`.
- **Con:** the `search_friend_graph` RPC's return shape changed
  (added `country_name`). Any external caller of the RPC must update;
  inside the app the typed `SearchResult` is updated in lockstep.

## Migration ordering

```
20_countries.sql                 # new table + seed
21_cities.sql                    # rename places → cities + enum values
22_cities_country_fk.sql         # add country_id, drop search_vec,
                                 # backfill, recreate search_vec
23_drop_cities_country_text.sql  # guard + drop legacy text column
24_rpcs_use_cities.sql           # rebuild search_friend_graph,
                                 # me_stats, verdict_counts, canonical view
```

Apply in order. Between 22 and 23, run:

```sql
select distinct country, count(*) from public.cities
where country_id is null and country is not null and country <> ''
group by country order by count desc;
```

For each remaining group, add the country to `public.countries` and
re-run migration 22's backfill UPDATEs. Migration 23 will refuse to
drop the column until the diagnostic returns zero rows.
