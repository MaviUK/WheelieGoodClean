-- Fix dropdown metadata timeout in the Gerball Football Stats frontend.
-- Run this in Supabase SQL Editor.
-- The country/division/season dropdown query orders by country_name, division_name and season_code.
-- This index lets Postgres serve that query without scanning/sorting the whole table.

create index if not exists football_data_matches_metadata_dropdown_idx
on public.football_data_matches (
  country_name asc,
  division_name asc,
  season_code desc,
  country_code,
  division,
  season_label
);

-- Extra indexes for the main app filters and league table queries.
create index if not exists football_data_matches_country_idx
on public.football_data_matches (country_code);

create index if not exists football_data_matches_country_division_season_idx
on public.football_data_matches (country_code, division, season_code, match_date desc);

create index if not exists football_data_matches_division_season_table_idx
on public.football_data_matches (division, season_code, match_date asc);

create index if not exists football_data_matches_home_team_idx
on public.football_data_matches (home_team, match_date desc);

create index if not exists football_data_matches_away_team_idx
on public.football_data_matches (away_team, match_date desc);

-- Update planner statistics after adding indexes and after large imports.
analyze public.football_data_matches;

-- Quick check: this should return Scotland now and should run fast.
select
  country_code,
  country_name,
  division,
  division_name,
  season_code,
  season_label,
  count(*) as rows
from public.football_data_matches
group by country_code, country_name, division, division_name, season_code, season_label
order by country_name, division_name, season_code desc
limit 100;
