-- football-data.co.uk import tables
-- Run this in Supabase SQL Editor before using /.netlify/functions/import-football-data.

create table if not exists public.football_data_matches (
  id uuid primary key default gen_random_uuid(),
  country_code text not null,
  country_name text,
  division text not null,
  division_name text,
  season_code text not null,
  season_label text,
  match_date date not null,
  kickoff_time text,
  home_team text not null,
  away_team text not null,
  fthg integer,
  ftag integer,
  ftr text,
  hthg integer,
  htag integer,
  htr text,
  referee text,
  home_shots integer,
  away_shots integer,
  home_shots_target integer,
  away_shots_target integer,
  home_corners integer,
  away_corners integer,
  home_fouls integer,
  away_fouls integer,
  home_yellow integer,
  away_yellow integer,
  home_red integer,
  away_red integer,
  avg_home_odds numeric,
  avg_draw_odds numeric,
  avg_away_odds numeric,
  max_home_odds numeric,
  max_draw_odds numeric,
  max_away_odds numeric,
  avg_over_25 numeric,
  avg_under_25 numeric,
  max_over_25 numeric,
  max_under_25 numeric,
  source_url text,
  row_hash text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country_code, division, season_code, match_date, home_team, away_team)
);

create index if not exists football_data_matches_date_idx on public.football_data_matches (match_date desc);
create index if not exists football_data_matches_division_idx on public.football_data_matches (division, season_code, match_date desc);
create index if not exists football_data_matches_teams_idx on public.football_data_matches (home_team, away_team);

create table if not exists public.football_data_import_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  mode text not null,
  status text not null,
  seasons text[] not null default array[]::text[],
  divisions text[] not null default array[]::text[],
  rows_imported integer not null default 0,
  files_imported integer not null default 0,
  files_tried integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  raw jsonb not null default '{}'::jsonb
);

alter table public.football_data_matches enable row level security;
alter table public.football_data_import_runs enable row level security;

drop policy if exists "public read football data matches" on public.football_data_matches;
create policy "public read football data matches" on public.football_data_matches for select using (true);

drop policy if exists "public read football data import runs" on public.football_data_import_runs;
create policy "public read football data import runs" on public.football_data_import_runs for select using (true);
