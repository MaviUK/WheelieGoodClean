import { getSupabaseAdmin } from './_shared/supabaseAdmin.js';

const TABLE_LIMIT = 1500;

function number(value) {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function emptyRow(team) {
  return {
    team,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    form: [],
    cleanSheets: 0,
    btts: 0,
    over15: 0,
    over25: 0,
    yellowCards: 0,
    redCards: 0,
  };
}

function applyResult(table, match, team, goalsFor, goalsAgainst, yellowCards, redCards) {
  if (!table.has(team)) table.set(team, emptyRow(team));
  const row = table.get(team);
  const totalGoals = number(match.fthg) + number(match.ftag);

  row.played += 1;
  row.goalsFor += goalsFor;
  row.goalsAgainst += goalsAgainst;
  row.goalDifference = row.goalsFor - row.goalsAgainst;
  row.yellowCards += yellowCards;
  row.redCards += redCards;

  if (goalsAgainst === 0) row.cleanSheets += 1;
  if (number(match.fthg) > 0 && number(match.ftag) > 0) row.btts += 1;
  if (totalGoals >= 2) row.over15 += 1;
  if (totalGoals >= 3) row.over25 += 1;

  if (goalsFor > goalsAgainst) {
    row.wins += 1;
    row.points += 3;
    row.form.push('W');
  } else if (goalsFor < goalsAgainst) {
    row.losses += 1;
    row.form.push('L');
  } else {
    row.draws += 1;
    row.points += 1;
    row.form.push('D');
  }
}

function pct(value, played) {
  return played ? `${value} (${((value / played) * 100).toFixed(1)}%)` : '0 (0.0%)';
}

function buildTable(matches, mode) {
  const table = new Map();
  const completed = matches
    .filter((match) => match.home_team && match.away_team && match.fthg !== null && match.fthg !== undefined && match.ftag !== null && match.ftag !== undefined)
    .sort((a, b) => String(a.match_date).localeCompare(String(b.match_date)));

  for (const match of completed) {
    const homeGoals = number(match.fthg);
    const awayGoals = number(match.ftag);

    if (mode === 'overall' || mode === 'home') {
      applyResult(
        table,
        match,
        match.home_team,
        homeGoals,
        awayGoals,
        number(match.home_yellow),
        number(match.home_red),
      );
    }

    if (mode === 'overall' || mode === 'away') {
      applyResult(
        table,
        match,
        match.away_team,
        awayGoals,
        homeGoals,
        number(match.away_yellow),
        number(match.away_red),
      );
    }
  }

  return [...table.values()]
    .sort((a, b) => (
      b.points - a.points
      || b.goalDifference - a.goalDifference
      || b.goalsFor - a.goalsFor
      || b.wins - a.wins
      || a.team.localeCompare(b.team)
    ))
    .map((row, index) => ({
      ...row,
      rank: index + 1,
      ppg: row.played ? Number((row.points / row.played).toFixed(2)) : 0,
      cleanSheetsText: pct(row.cleanSheets, row.played),
      bttsText: pct(row.btts, row.played),
      over15Text: pct(row.over15, row.played),
      over25Text: pct(row.over25, row.played),
      yellowPerGame: row.played ? Number((row.yellowCards / row.played).toFixed(1)) : 0,
      redPerGame: row.played ? Number((row.redCards / row.played).toFixed(1)) : 0,
      form: row.form.slice(-6),
    }));
}

export async function handler(event) {
  try {
    const division = event.queryStringParameters?.division;
    const season = event.queryStringParameters?.season;
    const mode = event.queryStringParameters?.mode || 'overall';

    if (!division || !season || division === 'all' || season === 'all') {
      return {
        statusCode: 400,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
        body: JSON.stringify({ ok: false, error: 'division and season are required.' }, null, 2),
      };
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('football_data_matches')
      .select('match_date,home_team,away_team,fthg,ftag,home_yellow,away_yellow,home_red,away_red')
      .eq('division', division)
      .eq('season_code', season)
      .order('match_date', { ascending: true })
      .limit(TABLE_LIMIT);

    if (error) throw error;

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' },
      body: JSON.stringify({
        ok: true,
        division,
        season,
        mode,
        matches: data?.length || 0,
        table: buildTable(data || [], mode),
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      body: JSON.stringify({ ok: false, error: error.message || 'Could not build league stats table.' }, null, 2),
    };
  }
}
