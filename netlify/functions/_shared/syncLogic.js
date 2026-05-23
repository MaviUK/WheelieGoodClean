import { apiFootballFetch, makeCacheKey } from './apiFootball.js';
import { getSupabaseAdmin } from './supabaseAdmin.js';

const COMPLETED_STATUSES = new Set(['FT', 'AET', 'PEN']);
const DETAIL_CHUNK_SIZE = 20;
const RATE_LIMIT_DELAY_MS = 1250;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isoDateOffset(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getRangeForMode(mode) {
  if (mode === 'morning') {
    return { from: isoDateOffset(0), to: isoDateOffset(7), detailCompletedMatches: false };
  }

  if (mode === 'backfill') {
    return { from: isoDateOffset(-30), to: isoDateOffset(0), detailCompletedMatches: true };
  }

  return { from: isoDateOffset(-1), to: isoDateOffset(0), detailCompletedMatches: true };
}

function chunkArray(values, size) {
  const chunks = [];
  for (let i = 0; i < values.length; i += size) {
    chunks.push(values.slice(i, i + size));
  }
  return chunks;
}

function asInt(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace('%', '').trim();
  const parsed = Number.parseInt(cleaned, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function statValue(stats = [], type) {
  const item = stats.find((entry) => entry.type === type);
  return item ? item.value : null;
}

function fixtureToRow(item) {
  const fixture = item.fixture || {};
  const league = item.league || {};
  const teams = item.teams || {};
  const goals = item.goals || {};
  const score = item.score || {};
  const venue = fixture.venue || {};
  const status = fixture.status || {};

  return {
    api_fixture_id: fixture.id,
    api_league_id: league.id,
    season: league.season,
    league_name: league.name,
    league_round: league.round,
    country: league.country,
    venue_id: venue.id,
    venue_name: venue.name,
    venue_city: venue.city,
    referee: fixture.referee,
    kickoff_at: fixture.date,
    timezone: fixture.timezone,
    status_long: status.long,
    status_short: status.short,
    elapsed: status.elapsed,
    home_team_id: teams.home?.id,
    away_team_id: teams.away?.id,
    home_team_name: teams.home?.name,
    away_team_name: teams.away?.name,
    home_logo: teams.home?.logo,
    away_logo: teams.away?.logo,
    home_goals: goals.home,
    away_goals: goals.away,
    halftime_home: score.halftime?.home,
    halftime_away: score.halftime?.away,
    fulltime_home: score.fulltime?.home,
    fulltime_away: score.fulltime?.away,
    extratime_home: score.extratime?.home,
    extratime_away: score.extratime?.away,
    penalty_home: score.penalty?.home,
    penalty_away: score.penalty?.away,
    raw: item,
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function uniqueBy(values, keyFn) {
  const map = new Map();
  for (const value of values) {
    const key = keyFn(value);
    if (key !== undefined && key !== null && !map.has(key)) map.set(key, value);
  }
  return [...map.values()];
}

function teamsFromFixture(item) {
  const rows = [];
  for (const side of ['home', 'away']) {
    const team = item.teams?.[side];
    if (team?.id) {
      rows.push({
        api_team_id: team.id,
        name: team.name,
        logo: team.logo,
        raw: team,
        updated_at: new Date().toISOString(),
      });
    }
  }
  return rows;
}

function eventToRow(apiFixtureId, event) {
  const time = event.time || {};
  const team = event.team || {};
  const player = event.player || {};
  const assist = event.assist || {};
  const keyParts = [
    apiFixtureId,
    time.elapsed ?? '',
    time.extra ?? '',
    team.id ?? '',
    player.id ?? player.name ?? '',
    assist.id ?? assist.name ?? '',
    event.type ?? '',
    event.detail ?? '',
    event.comments ?? '',
  ];

  return {
    event_key: keyParts.join('|'),
    api_fixture_id: apiFixtureId,
    team_id: team.id,
    team_name: team.name,
    player_id: player.id,
    player_name: player.name,
    assist_id: assist.id,
    assist_name: assist.name,
    time_elapsed: time.elapsed,
    time_extra: time.extra,
    event_type: event.type,
    detail: event.detail,
    comments: event.comments,
    raw: event,
    updated_at: new Date().toISOString(),
  };
}

function statisticsToRow(apiFixtureId, statBlock) {
  const stats = statBlock.statistics || [];
  const team = statBlock.team || {};

  return {
    api_fixture_id: apiFixtureId,
    team_id: team.id,
    team_name: team.name,
    shots_on_goal: asInt(statValue(stats, 'Shots on Goal')),
    shots_off_goal: asInt(statValue(stats, 'Shots off Goal')),
    total_shots: asInt(statValue(stats, 'Total Shots')),
    blocked_shots: asInt(statValue(stats, 'Blocked Shots')),
    shots_inside_box: asInt(statValue(stats, 'Shots insidebox')),
    shots_outside_box: asInt(statValue(stats, 'Shots outsidebox')),
    fouls: asInt(statValue(stats, 'Fouls')),
    corner_kicks: asInt(statValue(stats, 'Corner Kicks')),
    offsides: asInt(statValue(stats, 'Offsides')),
    ball_possession: statValue(stats, 'Ball Possession'),
    yellow_cards: asInt(statValue(stats, 'Yellow Cards')),
    red_cards: asInt(statValue(stats, 'Red Cards')),
    goalkeeper_saves: asInt(statValue(stats, 'Goalkeeper Saves')),
    total_passes: asInt(statValue(stats, 'Total passes')),
    passes_accurate: asInt(statValue(stats, 'Passes accurate')),
    passes_percentage: statValue(stats, 'Passes %'),
    statistics: stats,
    raw: statBlock,
    updated_at: new Date().toISOString(),
  };
}

function lineupToRow(apiFixtureId, lineup) {
  const team = lineup.team || {};
  const coach = lineup.coach || {};
  return {
    api_fixture_id: apiFixtureId,
    team_id: team.id,
    team_name: team.name,
    formation: lineup.formation,
    coach_id: coach.id,
    coach_name: coach.name,
    start_xi: lineup.startXI || [],
    substitutes: lineup.substitutes || [],
    raw: lineup,
    updated_at: new Date().toISOString(),
  };
}

function playerStatRows(apiFixtureId, teamPlayerBlock) {
  const team = teamPlayerBlock.team || {};
  const players = teamPlayerBlock.players || [];
  return players
    .filter((entry) => entry.player?.id)
    .map((entry) => ({
      api_fixture_id: apiFixtureId,
      team_id: team.id,
      team_name: team.name,
      player_id: entry.player.id,
      player_name: entry.player.name,
      player_photo: entry.player.photo,
      statistics: entry.statistics || [],
      raw: entry,
      updated_at: new Date().toISOString(),
    }));
}

function standingRows(apiLeagueId, season, response) {
  const league = response?.[0]?.league;
  const groups = league?.standings || [];
  return groups.flat().map((standing) => ({
    api_league_id: apiLeagueId,
    season,
    team_id: standing.team?.id,
    rank: standing.rank,
    team_name: standing.team?.name,
    team_logo: standing.team?.logo,
    points: standing.points,
    goals_diff: standing.goalsDiff,
    group_name: standing.group,
    form: standing.form,
    status: standing.status,
    description: standing.description,
    all_played: standing.all?.played,
    all_win: standing.all?.win,
    all_draw: standing.all?.draw,
    all_lose: standing.all?.lose,
    all_goals_for: standing.all?.goals?.for,
    all_goals_against: standing.all?.goals?.against,
    home_played: standing.home?.played,
    home_win: standing.home?.win,
    home_draw: standing.home?.draw,
    home_lose: standing.home?.lose,
    away_played: standing.away?.played,
    away_win: standing.away?.win,
    away_draw: standing.away?.draw,
    away_lose: standing.away?.lose,
    raw: standing,
    updated_at: new Date().toISOString(),
  })).filter((row) => row.team_id);
}

async function upsertOrThrow(supabase, table, rows, options = {}) {
  if (!rows || rows.length === 0) return;
  const { error } = await supabase.from(table).upsert(rows, options);
  if (error) throw new Error(`${table} upsert failed: ${error.message}`);
}

async function storeRawResponse(supabase, endpoint, params, payload) {
  await upsertOrThrow(supabase, 'raw_api_responses', [{
    cache_key: makeCacheKey(endpoint, params),
    endpoint,
    params,
    response_count: Array.isArray(payload.response) ? payload.response.length : null,
    payload,
    fetched_at: new Date().toISOString(),
  }], { onConflict: 'cache_key' });
}

async function fetchAndStore(supabase, endpoint, params, counters) {
  const payload = await apiFootballFetch(endpoint, params);
  counters.apiCalls += 1;
  await storeRawResponse(supabase, endpoint, params, payload);
  return payload;
}

async function saveFixtureBundle(supabase, fixtureItems) {
  if (!fixtureItems?.length) return { fixtures: 0, detailed: 0 };

  await upsertOrThrow(supabase, 'fixtures', fixtureItems.map(fixtureToRow), { onConflict: 'api_fixture_id' });

  const teams = uniqueBy(fixtureItems.flatMap(teamsFromFixture), (team) => team.api_team_id);
  await upsertOrThrow(supabase, 'teams', teams, { onConflict: 'api_team_id' });

  const events = [];
  const stats = [];
  const lineups = [];
  const playerStats = [];

  for (const item of fixtureItems) {
    const apiFixtureId = item.fixture?.id;
    if (!apiFixtureId) continue;

    if (Array.isArray(item.events)) {
      events.push(...item.events.map((event) => eventToRow(apiFixtureId, event)));
    }
    if (Array.isArray(item.statistics)) {
      stats.push(...item.statistics.filter((block) => block.team?.id).map((block) => statisticsToRow(apiFixtureId, block)));
    }
    if (Array.isArray(item.lineups)) {
      lineups.push(...item.lineups.filter((lineup) => lineup.team?.id).map((lineup) => lineupToRow(apiFixtureId, lineup)));
    }
    if (Array.isArray(item.players)) {
      playerStats.push(...item.players.flatMap((block) => playerStatRows(apiFixtureId, block)));
    }
  }

  await upsertOrThrow(supabase, 'fixture_events', events, { onConflict: 'event_key' });
  await upsertOrThrow(supabase, 'fixture_statistics', stats, { onConflict: 'api_fixture_id,team_id' });
  await upsertOrThrow(supabase, 'fixture_lineups', lineups, { onConflict: 'api_fixture_id,team_id' });
  await upsertOrThrow(supabase, 'fixture_player_statistics', playerStats, { onConflict: 'api_fixture_id,team_id,player_id' });

  const detailed = fixtureItems.filter((item) => item.events || item.statistics || item.lineups || item.players).length;
  return { fixtures: fixtureItems.length, detailed };
}

async function syncStandings(supabase, league, counters) {
  const payload = await fetchAndStore(
    supabase,
    'standings',
    { league: league.api_league_id, season: league.season },
    counters,
  );

  const rows = standingRows(league.api_league_id, league.season, payload.response || []);
  await upsertOrThrow(supabase, 'standings', rows, { onConflict: 'api_league_id,season,team_id' });

  await upsertOrThrow(supabase, 'league_snapshots', [{
    api_league_id: league.api_league_id,
    season: league.season,
    snapshot_type: 'standings',
    payload,
    fetched_at: new Date().toISOString(),
  }], { onConflict: 'api_league_id,season,snapshot_type' });
}

async function syncLeagueFixtures(supabase, league, range, mode, counters) {
  const params = {
    league: league.api_league_id,
    season: league.season,
    from: range.from,
    to: range.to,
  };

  if (range.detailCompletedMatches) {
    params.status = 'FT-AET-PEN';
  }

  const fixtureListPayload = await fetchAndStore(supabase, 'fixtures', params, counters);
  const fixtures = fixtureListPayload.response || [];
  const saved = await saveFixtureBundle(supabase, fixtures);
  counters.fixturesSeen += saved.fixtures;

  if (!range.detailCompletedMatches) return;

  const completedIds = fixtures
    .filter((item) => COMPLETED_STATUSES.has(item.fixture?.status?.short))
    .map((item) => item.fixture?.id)
    .filter(Boolean);

  for (const idChunk of chunkArray(completedIds, DETAIL_CHUNK_SIZE)) {
    const detailPayload = await fetchAndStore(
      supabase,
      'fixtures',
      { ids: idChunk.join('-') },
      counters,
    );
    const detailItems = detailPayload.response || [];
    const detailSaved = await saveFixtureBundle(supabase, detailItems);
    counters.fixturesDetailed += detailSaved.fixtures;
    await delay(RATE_LIMIT_DELAY_MS);
  }
}

export async function runSync({ mode = 'evening' } = {}) {
  const supabase = getSupabaseAdmin();
  const range = getRangeForMode(mode);
  const counters = {
    apiCalls: 0,
    leaguesProcessed: 0,
    fixturesSeen: 0,
    fixturesDetailed: 0,
  };

  const { data: run, error: runError } = await supabase
    .from('sync_runs')
    .insert({ mode, status: 'running', raw: { range } })
    .select()
    .single();

  if (runError) throw new Error(`Could not create sync run: ${runError.message}`);

  try {
    const { data: leagues, error: leaguesError } = await supabase
      .from('tracked_leagues')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: true });

    if (leaguesError) throw new Error(`Could not load tracked leagues: ${leaguesError.message}`);

    for (const league of leagues || []) {
      await syncLeagueFixtures(supabase, league, range, mode, counters);
      await delay(RATE_LIMIT_DELAY_MS);

      // Update standings once per run. This is useful for the dashboard and cheap: 1 call per league.
      await syncStandings(supabase, league, counters);
      await delay(RATE_LIMIT_DELAY_MS);

      counters.leaguesProcessed += 1;
    }

    const { error: updateError } = await supabase
      .from('sync_runs')
      .update({
        status: 'success',
        finished_at: new Date().toISOString(),
        leagues_processed: counters.leaguesProcessed,
        fixtures_seen: counters.fixturesSeen,
        fixtures_detailed: counters.fixturesDetailed,
        api_calls: counters.apiCalls,
        raw: { range, counters },
      })
      .eq('id', run.id);

    if (updateError) throw new Error(`Could not finish sync run: ${updateError.message}`);

    return { ok: true, mode, range, ...counters };
  } catch (error) {
    await supabase
      .from('sync_runs')
      .update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        leagues_processed: counters.leaguesProcessed,
        fixtures_seen: counters.fixturesSeen,
        fixtures_detailed: counters.fixturesDetailed,
        api_calls: counters.apiCalls,
        error: error.message,
        raw: { range, counters },
      })
      .eq('id', run.id);

    throw error;
  }
}
