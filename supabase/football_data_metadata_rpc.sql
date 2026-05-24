-- Lightweight metadata function for the website dropdowns.
-- Run this in Supabase SQL Editor.
-- It returns one row per country/division/season instead of making the browser scan the full match table.

create or replace function public.get_football_data_metadata()
returns table (
  country_code text,
  country_name text,
  division text,
  division_name text,
  season_code text,
  season_label text,
  rows_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    country_code,
    country_name,
    division,
    division_name,
    season_code,
    season_label,
    count(*)::bigint as rows_count
  from public.football_data_matches
  group by country_code, country_name, division, division_name, season_code, season_label
  order by country_name, division_name, season_code desc;
$$;

grant execute on function public.get_football_data_metadata() to anon;
grant execute on function public.get_football_data_metadata() to authenticated;

create index if not exists football_data_matches_metadata_rpc_idx
on public.football_data_matches (
  country_code,
  country_name,
  division,
  division_name,
  season_code,
  season_label
);

analyze public.football_data_matches;

-- Test after creating it:
select * from public.get_football_data_metadata()
where country_code = 'SCO';
