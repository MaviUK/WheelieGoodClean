-- Gerball Football Stats schema
-- Run this in Supabase SQL Editor before deploying the Netlify site.

create extension if not exists pgcrypto;

create table if not exists public.tracked_leagues (
  id uuid primary key default gen_random_uuid(),
  api_league_id integer not null,
  season integer not null,
  name text not null,
  country text,
  logo text,
  flag text,
  is_active boolean not null default true,
  priority integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (api_league_id, season)
);

create table if not exists public.teams (
  api_team_id integer primary key,
  name text not null,
  code text,
  country text,
  founded integer,
  national boolean,
  logo text,
  raw jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.fixtures (
  api_fixture_id integer primary key,
  api_league_id integer,
  season integer,
  league_name text,
  league_round text,
  country text,
  venue_id integer,
  venue_name text,
  venue_city text,
  referee text,
  kickoff_at timestamptz,
  timezone text,
  status_long text,
  status_short text,
  elapsed integer,
  home_team_id integer,
  away_team_id integer,
  home_team_name text,
  away_team_name text,
  home_logo text,
  away_logo text,
  home_goals integer,
  away_goals integer,
  halftime_home integer,
  halftime_away integer,
  fulltime_home integer,
  fulltime_away integer,
  extratime_home integer,
  extratime_away integer,
  penalty_home integer,
  penalty_away integer,
  raw jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fixtures_kickoff_idx on public.fixtures (kickoff_at desc);
create index if not exists fixtures_league_season_idx on public.fixtures (api_league_id, season);
create index if not exists fixtures_status_idx on public.fixtures (status_short);

create table if not exists public.fixture_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  api_fixture_id integer not null references public.fixtures(api_fixture_id) on delete cascade,
  team_id integer,
  team_name text,
  player_id integer,
  player_name text,
  assist_id integer,
  assist_name text,
  time_elapsed integer,
  time_extra integer,
  event_type text,
  detail text,
  comments text,
  raw jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists fixture_events_fixture_idx on public.fixture_events (api_fixture_id, time_elapsed, time_extra);
create index if not exists fixture_events_type_idx on public.fixture_events (event_type, detail);

create table if not exists public.fixture_statistics (
  id uuid primary key default gen_random_uuid(),
  api_fixture_id integer not null references public.fixtures(api_fixture_id) on delete cascade,
  team_id integer not null,
  team_name text,
  shots_on_goal integer,
  shots_off_goal integer,
  total_shots integer,
  blocked_shots integer,
  shots_inside_box integer,
  shots_outside_box integer,
  fouls integer,
  corner_kicks integer,
  offsides integer,
  ball_possession text,
  yellow_cards integer,
  red_cards integer,
  goalkeeper_saves integer,
  total_passes integer,
  passes_accurate integer,
  passes_percentage text,
  statistics jsonb not null default '[]'::jsonb,
  raw jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (api_fixture_id, team_id)
);

create index if not exists fixture_statistics_fixture_idx on public.fixture_statistics (api_fixture_id);

create table if not exists public.fixture_lineups (
  id uuid primary key default gen_random_uuid(),
  api_fixture_id integer not null references public.fixtures(api_fixture_id) on delete cascade,
  team_id integer not null,
  team_name text,
  formation text,
  coach_id integer,
  coach_name text,
  start_xi jsonb not null default '[]'::jsonb,
  substitutes jsonb not null default '[]'::jsonb,
  raw jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (api_fixture_id, team_id)
);

create table if not exists public.fixture_player_statistics (
  id uuid primary key default gen_random_uuid(),
  api_fixture_id integer not null references public.fixtures(api_fixture_id) on delete cascade,
  team_id integer not null,
  team_name text,
  player_id integer not null,
  player_name text,
  player_photo text,
  statistics jsonb not null default '[]'::jsonb,
  raw jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (api_fixture_id, team_id, player_id)
);

create index if not exists player_stats_fixture_idx on public.fixture_player_statistics (api_fixture_id);
create index if not exists player_stats_player_idx on public.fixture_player_statistics (player_id);

create table if not exists public.standings (
  id uuid primary key default gen_random_uuid(),
  api_league_id integer not null,
  season integer not null,
  team_id integer not null,
  rank integer,
  team_name text,
  team_logo text,
  points integer,
  goals_diff integer,
  group_name text,
  form text,
  status text,
  description text,
  all_played integer,
  all_win integer,
  all_draw integer,
  all_lose integer,
  all_goals_for integer,
  all_goals_against integer,
  home_played integer,
  home_win integer,
  home_draw integer,
  home_lose integer,
  away_played integer,
  away_win integer,
  away_draw integer,
  away_lose integer,
  raw jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (api_league_id, season, team_id)
);

create index if not exists standings_league_idx on public.standings (api_league_id, season, rank);

create table if not exists public.league_snapshots (
  id uuid primary key default gen_random_uuid(),
  api_league_id integer not null,
  season integer not null,
  snapshot_type text not null,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  unique (api_league_id, season, snapshot_type)
);

create table if not exists public.raw_api_responses (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null unique,
  endpoint text not null,
  params jsonb not null default '{}'::jsonb,
  response_count integer,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

create index if not exists raw_api_endpoint_idx on public.raw_api_responses (endpoint, fetched_at desc);

create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  mode text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  leagues_processed integer not null default 0,
  fixtures_seen integer not null default 0,
  fixtures_detailed integer not null default 0,
  api_calls integer not null default 0,
  notes text,
  error text,
  raw jsonb not null default '{}'::jsonb
);

-- Seed a practical starter list. API-FOOTBALL uses the season start year,
-- so 2025 means the 2025/26 European season. Verify/add lower leagues with /leagues.
insert into public.tracked_leagues (api_league_id, season, name, country, priority)
values
  (39, 2025, 'Premier League', 'England', 1),
  (40, 2025, 'Championship', 'England', 2),
  (41, 2025, 'League One', 'England', 3),
  (42, 2025, 'League Two', 'England', 4),
  (43, 2025, 'National League', 'England', 5),
  (140, 2025, 'La Liga', 'Spain', 10),
  (135, 2025, 'Serie A', 'Italy', 11),
  (78, 2025, 'Bundesliga', 'Germany', 12),
  (61, 2025, 'Ligue 1', 'France', 13),
  (2, 2025, 'UEFA Champions League', 'World', 20),
  (3, 2025, 'UEFA Europa League', 'World', 21),
  (848, 2025, 'UEFA Conference League', 'World', 22)
on conflict (api_league_id, season) do nothing;

-- Public read access for the frontend.
alter table public.tracked_leagues enable row level security;
alter table public.teams enable row level security;
alter table public.fixtures enable row level security;
alter table public.fixture_events enable row level security;
alter table public.fixture_statistics enable row level security;
alter table public.fixture_lineups enable row level security;
alter table public.fixture_player_statistics enable row level security;
alter table public.standings enable row level security;
alter table public.league_snapshots enable row level security;

drop policy if exists "public read tracked leagues" on public.tracked_leagues;
create policy "public read tracked leagues" on public.tracked_leagues for select using (true);
drop policy if exists "public read teams" on public.teams;
create policy "public read teams" on public.teams for select using (true);
drop policy if exists "public read fixtures" on public.fixtures;
create policy "public read fixtures" on public.fixtures for select using (true);
drop policy if exists "public read fixture events" on public.fixture_events;
create policy "public read fixture events" on public.fixture_events for select using (true);
drop policy if exists "public read fixture statistics" on public.fixture_statistics;
create policy "public read fixture statistics" on public.fixture_statistics for select using (true);
drop policy if exists "public read fixture lineups" on public.fixture_lineups;
create policy "public read fixture lineups" on public.fixture_lineups for select using (true);
drop policy if exists "public read player statistics" on public.fixture_player_statistics;
create policy "public read player statistics" on public.fixture_player_statistics for select using (true);
drop policy if exists "public read standings" on public.standings;
create policy "public read standings" on public.standings for select using (true);
drop policy if exists "public read league snapshots" on public.league_snapshots;
create policy "public read league snapshots" on public.league_snapshots for select using (true);

-- raw_api_responses and sync_runs are intentionally not public.
alter table public.raw_api_responses enable row level security;
alter table public.sync_runs enable row level security;

-- Optional public sync summaries for the dashboard. Does not contain API keys or raw API payloads.
drop policy if exists "public read sync runs" on public.sync_runs;
create policy "public read sync runs" on public.sync_runs for select using (true);
