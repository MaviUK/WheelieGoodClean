import { getSupabaseAdmin } from './_shared/supabaseAdmin.js';

const LIMIT = 1500;
const LEVELS = [0.5, 1.5, 2.5, 3.5, 4.5];
const has = (v) => v !== null && v !== undefined && v !== '';
const num = (v) => (has(v) && Number.isFinite(Number(v)) ? Number(v) : null);
const z = (v) => num(v) ?? 0;
const pct = (a, b) => (b ? Number(((a / b) * 100).toFixed(1)) : 0);
const pctText = (a, b) => `${a} (${pct(a, b).toFixed(1)}%)`;
const res = (h, a) => (!has(h) || !has(a) ? null : h > a ? 'H' : h < a ? 'A' : 'D');

function top(map, limit, denom) {
  return [...map.entries()]
    .map(([label, count]) => ({ label, count, pct: pct(count, denom) }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

function distribution(rows, half = false) {
  const counts = { H: 0, D: 0, A: 0 };
  let total = 0;
  for (const m of rows) {
    const h = half ? num(m.hthg) : num(m.fthg);
    const a = half ? num(m.htag) : num(m.ftag);
    const r = res(h, a);
    if (!r) continue;
    counts[r] += 1;
    total += 1;
  }
  return {
    total,
    homeWin: { count: counts.H, pct: pct(counts.H, total) },
    draw: { count: counts.D, pct: pct(counts.D, total) },
    awayWin: { count: counts.A, pct: pct(counts.A, total) },
  };
}

function scoreLists(rows, half = false) {
  const all = new Map();
  const hwin = new Map();
  const draw = new Map();
  const awin = new Map();
  let total = 0;
  for (const m of rows) {
    const h = half ? num(m.hthg) : num(m.fthg);
    const a = half ? num(m.htag) : num(m.ftag);
    const r = res(h, a);
    if (!r) continue;
    const key = `${h}-${a}`;
    all.set(key, (all.get(key) || 0) + 1);
    if (r === 'H') hwin.set(key, (hwin.get(key) || 0) + 1);
    if (r === 'D') draw.set(key, (draw.get(key) || 0) + 1);
    if (r === 'A') awin.set(key, (awin.get(key) || 0) + 1);
    total += 1;
  }
  return {
    total,
    homeWinScores: top(hwin, 10, total),
    drawScores: top(draw, 10, total),
    awayWinScores: top(awin, 10, total),
    commonScores: top(all, 5, total),
  };
}

function transition(rows) {
  const home = { winningAtHt: { total: 0, ftWins: 0 }, drawingAtHt: { total: 0, ftWins: 0 }, losingAtHt: { total: 0, ftWins: 0 } };
  const away = { winningAtHt: { total: 0, ftWins: 0 }, drawingAtHt: { total: 0, ftWins: 0 }, losingAtHt: { total: 0, ftWins: 0 } };
  for (const m of rows) {
    const hth = num(m.hthg), hta = num(m.htag), fth = num(m.fthg), fta = num(m.ftag);
    if ([hth, hta, fth, fta].some((v) => v === null)) continue;
    const hs = hth > hta ? 'winningAtHt' : hth < hta ? 'losingAtHt' : 'drawingAtHt';
    const as = hta > hth ? 'winningAtHt' : hta < hth ? 'losingAtHt' : 'drawingAtHt';
    home[hs].total += 1;
    away[as].total += 1;
    if (fth > fta) home[hs].ftWins += 1;
    if (fta > fth) away[as].ftWins += 1;
  }
  const done = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, { ...v, pct: pct(v.ftWins, v.total), text: pctText(v.ftWins, v.total) }]));
  return { home: done(home), away: done(away) };
}

function add(map, team, value) {
  map.set(team, (map.get(team) || 0) + value);
}

function bestWorst(map) {
  const arr = [...map.entries()].map(([team, value]) => ({ team, value }));
  if (!arr.length) return { most: null, least: null };
  const desc = [...arr].sort((a, b) => b.value - a.value || a.team.localeCompare(b.team));
  const asc = [...arr].sort((a, b) => a.value - b.value || a.team.localeCompare(b.team));
  return { most: desc[0], least: asc[0] };
}

function ou(values) {
  return LEVELS.map((threshold) => {
    const over = values.filter((v) => v > threshold).length;
    const under = values.length - over;
    return { threshold, over, under, overPct: pct(over, values.length), underPct: pct(under, values.length), overText: pctText(over, values.length), underText: pctText(under, values.length) };
  });
}

function block(rows, homeFn, awayFn) {
  const totals = [], homes = [], aways = [];
  const teamAll = new Map(), teamHome = new Map(), teamAway = new Map();
  for (const m of rows) {
    const hv = homeFn(m), av = awayFn(m);
    if (hv === null || av === null) continue;
    totals.push(hv + av); homes.push(hv); aways.push(av);
    add(teamAll, m.home_team, hv); add(teamAll, m.away_team, av);
    add(teamHome, m.home_team, hv); add(teamAway, m.away_team, av);
  }
  const pack = (values, teamMap) => {
    const total = values.reduce((s, v) => s + v, 0);
    return { available: values.length > 0, matches: values.length, total, average: values.length ? Number((total / values.length).toFixed(2)) : null, ...bestWorst(teamMap), overUnder: ou(values) };
  };
  return { overall: pack(totals, teamAll), home: pack(homes, teamHome), away: pack(aways, teamAway) };
}

function insights(rows) {
  const completed = rows.filter((m) => has(m.fthg) && has(m.ftag));
  return {
    matchCount: completed.length,
    htToFt: transition(completed),
    fullTime: { results: distribution(completed, false), scores: scoreLists(completed, false), goals: block(completed, (m) => num(m.fthg), (m) => num(m.ftag)) },
    halfTime: { results: distribution(completed, true), scores: scoreLists(completed, true), goals: block(completed, (m) => num(m.hthg), (m) => num(m.htag)) },
    cards: block(completed, (m) => (num(m.home_yellow) === null && num(m.home_red) === null ? null : z(m.home_yellow) + z(m.home_red)), (m) => (num(m.away_yellow) === null && num(m.away_red) === null ? null : z(m.away_yellow) + z(m.away_red))),
    fouls: block(completed, (m) => num(m.home_fouls), (m) => num(m.away_fouls)),
  };
}

export async function handler(event) {
  try {
    const division = event.queryStringParameters?.division;
    const season = event.queryStringParameters?.season;
    if (!division || !season || division === 'all' || season === 'all') {
      return { statusCode: 400, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok: false, error: 'division and season are required.' }) };
    }
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('football_data_matches')
      .select('match_date,home_team,away_team,fthg,ftag,hthg,htag,home_yellow,away_yellow,home_red,away_red,home_fouls,away_fouls')
      .eq('division', division)
      .eq('season_code', season)
      .order('match_date', { ascending: true })
      .limit(LIMIT);
    if (error) throw error;
    return { statusCode: 200, headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' }, body: JSON.stringify({ ok: true, division, season, matches: data?.length || 0, insights: insights(data || []) }) };
  } catch (error) {
    return { statusCode: 500, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok: false, error: error.message || 'Could not build league insights.' }) };
  }
}
