import { getSupabaseAdmin } from './_shared/supabaseAdmin.js';

const LIMIT = 2000;
const THRESH_GOALS = [0.5,1.5,2.5,3.5,4.5,5.5,6.5,7.5,8.5];
const THRESH_CORNERS = [0.5,1.5,2.5,3.5,4.5,5.5,6.5,7.5,8.5,9.5,10.5,11.5,12.5];
const THRESH_CARDS = [0.5,1.5,2.5,3.5,4.5,5.5,6.5,7.5,8.5];

const n = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const z = (v) => n(v) ?? 0;
const pct = (a,b) => b ? Number(((a / b) * 100).toFixed(1)) : 0;
const result = (gf,ga) => gf > ga ? 'W' : gf < ga ? 'L' : 'D';
const points = (r) => r === 'W' ? 3 : r === 'D' ? 1 : 0;

function view(match, team) {
  const home = match.home_team === team;
  return {
    ...match,
    isHome: home,
    opponent: home ? match.away_team : match.home_team,
    gf: home ? z(match.fthg) : z(match.ftag),
    ga: home ? z(match.ftag) : z(match.fthg),
    htgf: home ? z(match.hthg) : z(match.htag),
    htga: home ? z(match.htag) : z(match.hthg),
    shotsFor: home ? z(match.home_shots) : z(match.away_shots),
    shotsAgainst: home ? z(match.away_shots) : z(match.home_shots),
    sotFor: home ? z(match.home_shots_target) : z(match.away_shots_target),
    sotAgainst: home ? z(match.away_shots_target) : z(match.home_shots_target),
    cornersFor: home ? z(match.home_corners) : z(match.away_corners),
    cornersAgainst: home ? z(match.away_corners) : z(match.home_corners),
    yellowFor: home ? z(match.home_yellow) : z(match.away_yellow),
    yellowAgainst: home ? z(match.away_yellow) : z(match.home_yellow),
    redFor: home ? z(match.home_red) : z(match.away_red),
    redAgainst: home ? z(match.away_red) : z(match.home_red),
    foulsFor: home ? z(match.home_fouls) : z(match.away_fouls),
    foulsAgainst: home ? z(match.away_fouls) : z(match.home_fouls),
  };
}

function splitViews(matches, team) {
  return matches
    .filter((m) => n(m.fthg) !== null && n(m.ftag) !== null)
    .sort((a,b) => String(a.match_date).localeCompare(String(b.match_date)))
    .map((m) => view(m, team));
}

function record(rows) {
  const out = { matches: rows.length, points: 0, wins: 0, draws: 0, losses: 0, htWins: 0, htDraws: 0, htLosses: 0, cleanSheets: 0, btts: 0, htBtts: 0 };
  for (const r of rows) {
    const ft = result(r.gf,r.ga);
    out.points += points(ft);
    if (ft === 'W') out.wins += 1; else if (ft === 'D') out.draws += 1; else out.losses += 1;
    const ht = result(r.htgf,r.htga);
    if (ht === 'W') out.htWins += 1; else if (ht === 'D') out.htDraws += 1; else out.htLosses += 1;
    if (r.ga === 0) out.cleanSheets += 1;
    if (r.gf > 0 && r.ga > 0) out.btts += 1;
    if (r.htgf > 0 && r.htga > 0) out.htBtts += 1;
  }
  return out;
}

function rowMetric(value, total) {
  return { value, pct: pct(value,total), text: `${value} (${pct(value,total)}%)` };
}

function resultTable(rows) {
  const all = record(rows), home = record(rows.filter(r => r.isHome)), away = record(rows.filter(r => !r.isHome));
  const labels = ['matches','points','wins','draws','losses','htWins','htDraws','htLosses','cleanSheets','btts','htBtts'];
  return Object.fromEntries(labels.map((key) => [key, {
    overall: key === 'matches' || key === 'points' ? { value: all[key], text: String(all[key]) } : rowMetric(all[key], all.matches),
    home: key === 'matches' || key === 'points' ? { value: home[key], text: String(home[key]) } : rowMetric(home[key], home.matches),
    away: key === 'matches' || key === 'points' ? { value: away[key], text: String(away[key]) } : rowMetric(away[key], away.matches),
  }]));
}

function longestCurrent(form, target) {
  let best = 0, run = 0;
  for (const x of form) { run = x === target ? run + 1 : 0; best = Math.max(best, run); }
  let current = 0;
  for (let i = form.length - 1; i >= 0 && form[i] === target; i -= 1) current += 1;
  return { best, current };
}

function formStats(rows) {
  const make = (list) => {
    const form = list.map(r => result(r.gf,r.ga));
    return { form, wins: longestCurrent(form,'W'), draws: longestCurrent(form,'D'), losses: longestCurrent(form,'L') };
  };
  return { overall: make(rows), home: make(rows.filter(r=>r.isHome)), away: make(rows.filter(r=>!r.isHome)) };
}

function goalStats(rows) {
  const home = rows.filter(r=>r.isHome), away = rows.filter(r=>!r.isHome);
  const sum = (list,key) => list.reduce((s,r)=>s+r[key],0);
  return {
    ft: { scored: sum(rows,'gf'), homeScored: sum(home,'gf'), awayScored: sum(away,'gf'), conceded: sum(rows,'ga'), homeConceded: sum(home,'ga'), awayConceded: sum(away,'ga') },
    ht: { scored: sum(rows,'htgf'), homeScored: sum(home,'htgf'), awayScored: sum(away,'htgf'), conceded: sum(rows,'htga'), homeConceded: sum(home,'htga'), awayConceded: sum(away,'htga') },
  };
}

function htStatePanels(rows) {
  const states = { leading: [], drawing: [], losing: [] };
  for (const r of rows) {
    const state = r.htgf > r.htga ? 'leading' : r.htgf < r.htga ? 'losing' : 'drawing';
    states[state].push(r);
  }
  const pack = (list) => {
    const wins = list.filter(r=>result(r.gf,r.ga)==='W').length;
    const draws = list.filter(r=>result(r.gf,r.ga)==='D').length;
    const losses = list.filter(r=>result(r.gf,r.ga)==='L').length;
    return { matches: list.length, wins: rowMetric(wins,list.length), draws: rowMetric(draws,list.length), losses: rowMetric(losses,list.length) };
  };
  const build = (list) => ({ overall: pack(list), home: pack(list.filter(r=>r.isHome)), away: pack(list.filter(r=>!r.isHome)) });
  return { leading: build(states.leading), drawing: build(states.drawing), losing: build(states.losing) };
}

function topScores(rows, half=false, homeOnly=null) {
  const list = rows.filter(r => homeOnly === null ? true : r.isHome === homeOnly);
  const map = new Map();
  for (const r of list) {
    const key = half ? `${r.htgf}-${r.htga}` : `${r.gf}-${r.ga}`;
    map.set(key, (map.get(key)||0)+1);
  }
  return [...map.entries()].map(([score,count]) => ({ score, count, pct: pct(count,list.length) })).sort((a,b)=>b.count-a.count||a.score.localeCompare(b.score)).slice(0,5);
}

function ouRows(rows, thresholds, homeOnly, valueFor, matchValue) {
  const list = rows.filter(r => homeOnly === null ? true : r.isHome === homeOnly);
  const teamValues = list.map(valueFor), matchValues = list.map(matchValue);
  const calc = (values, over) => thresholds.map(t => pct(values.filter(v => over ? v > t : v <= t).length, values.length));
  return { matches: list.length, thresholds, tgo: calc(teamValues,true), tgu: calc(teamValues,false), mgo: calc(matchValues,true), mgu: calc(matchValues,false) };
}

function shots(rows) {
  const pack = (list) => {
    const shots = list.reduce((s,r)=>s+r.shotsFor,0), target = list.reduce((s,r)=>s+r.sotFor,0), against = list.reduce((s,r)=>s+r.shotsAgainst,0);
    return { matches: list.length, shots, target, accuracy: pct(target,shots), against, average: list.length ? Number((shots/list.length).toFixed(1)) : 0 };
  };
  return { home: pack(rows.filter(r=>r.isHome)), away: pack(rows.filter(r=>!r.isHome)) };
}

function discipline(rows) {
  const sum = (key) => rows.reduce((s,r)=>s+r[key],0), home = rows.filter(r=>r.isHome), away = rows.filter(r=>!r.isHome);
  const pack = (key) => ({ total: sum(key), avg: rows.length ? Number((sum(key)/rows.length).toFixed(2)) : 0, home: home.reduce((s,r)=>s+r[key],0), away: away.reduce((s,r)=>s+r[key],0) });
  return { fouls: pack('foulsFor'), yellow: pack('yellowFor'), red: pack('redFor') };
}

function leagueTable(rows, half=false, mode='all') {
  const map = new Map();
  const ensure = (team) => { if (!map.has(team)) map.set(team,{team,p:0,w:0,d:0,l:0,gf:0,ga:0,gd:0,pts:0}); return map.get(team); };
  const addRow = (team,gf,ga) => { const x=ensure(team); const r=result(gf,ga); x.p++; x.gf+=gf; x.ga+=ga; x.gd=x.gf-x.ga; x.pts+=points(r); if(r==='W')x.w++; else if(r==='D')x.d++; else x.l++; };
  for (const m of rows) {
    const hg = half ? n(m.hthg) : n(m.fthg), ag = half ? n(m.htag) : n(m.ftag);
    if (hg === null || ag === null) continue;
    if (mode === 'all' || mode === 'home') addRow(m.home_team,hg,ag);
    if (mode === 'all' || mode === 'away') addRow(m.away_team,ag,hg);
  }
  return [...map.values()].sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf||a.team.localeCompare(b.team)).map((x,i)=>({...x,pos:i+1}));
}

function h2h(rows, team) {
  const opponents = [...new Set(rows.map(r=>r.opponent))].sort();
  const byOpponent = {};
  for (const opp of opponents) {
    const list = rows.filter(r=>r.opponent===opp);
    byOpponent[opp] = { matches: list.slice().reverse().map(r=>({date:r.match_date,homeTeam:r.home_team,awayTeam:r.away_team,fthg:r.fthg,ftag:r.ftag,hthg:r.hthg,htag:r.htag,shots:`${r.home_shots ?? '-'}-${r.away_shots ?? '-'}`, corners:`${r.home_corners ?? '-'}-${r.away_corners ?? '-'}`, cards:`${r.home_yellow ?? 0}-${r.away_yellow ?? 0}`})) };
  }
  return { opponents, byOpponent };
}

export async function handler(event) {
  try {
    const team = decodeURIComponent(event.queryStringParameters?.team || '').trim();
    let division = event.queryStringParameters?.division;
    let season = event.queryStringParameters?.season;
    if (!team) return { statusCode:400, headers:{'content-type':'application/json'}, body:JSON.stringify({ok:false,error:'team is required'}) };
    const supabase = getSupabaseAdmin();
    const cols = 'id,match_date,country_name,division,division_name,season_code,season_label,home_team,away_team,fthg,ftag,hthg,htag,home_shots,away_shots,home_shots_target,away_shots_target,home_corners,away_corners,home_fouls,away_fouls,home_yellow,away_yellow,home_red,away_red';
    let hq = supabase.from('football_data_matches').select(cols).eq('home_team',team).order('match_date',{ascending:false}).limit(LIMIT);
    let aq = supabase.from('football_data_matches').select(cols).eq('away_team',team).order('match_date',{ascending:false}).limit(LIMIT);
    if (division) { hq = hq.eq('division',division); aq = aq.eq('division',division); }
    if (season) { hq = hq.eq('season_code',season); aq = aq.eq('season_code',season); }
    const [hr,ar] = await Promise.all([hq,aq]);
    if (hr.error) throw hr.error; if (ar.error) throw ar.error;
    let matches = [...(hr.data||[]),...(ar.data||[])].sort((a,b)=>String(b.match_date).localeCompare(String(a.match_date)));
    if (!division || !season) { const first = matches[0]; division = first?.division; season = first?.season_code; matches = matches.filter(m=>m.division===division&&m.season_code===season); }
    const sample = matches[0] || {};
    const views = splitViews(matches,team);
    const seasons = [...new Map([...(hr.data||[]),...(ar.data||[])].map(m=>[`${m.division}|${m.season_code}`,{division:m.division,divisionName:m.division_name,season:m.season_code,seasonLabel:m.season_label}])).values()].sort((a,b)=>b.season.localeCompare(a.season)).slice(0,12);
    const lr = await supabase.from('football_data_matches').select(cols).eq('division',division).eq('season_code',season).order('match_date',{ascending:true}).limit(LIMIT);
    if (lr.error) throw lr.error;
    const leagueRows = lr.data || [];
    const response = { ok:true, team, division, season, divisionName: sample.division_name, seasonLabel: sample.season_label, seasons,
      resultTable: resultTable(views), form: formStats(views), goals: goalStats(views), htPanels: htStatePanels(views),
      scoreAnalysis: { homeFt: topScores(views,false,true), homeHt: topScores(views,true,true), awayFt: topScores(views,false,false), awayHt: topScores(views,true,false) },
      overUnder: { goals:{home:ouRows(views,THRESH_GOALS,true,r=>r.gf,r=>r.gf+r.ga),away:ouRows(views,THRESH_GOALS,false,r=>r.gf,r=>r.gf+r.ga)}, corners:{home:ouRows(views,THRESH_CORNERS,true,r=>r.cornersFor,r=>r.cornersFor+r.cornersAgainst),away:ouRows(views,THRESH_CORNERS,false,r=>r.cornersFor,r=>r.cornersFor+r.cornersAgainst)}, cards:{home:ouRows(views,THRESH_CARDS,true,r=>r.yellowFor+r.redFor,r=>r.yellowFor+r.redFor+r.yellowAgainst+r.redAgainst),away:ouRows(views,THRESH_CARDS,false,r=>r.yellowFor+r.redFor,r=>r.yellowFor+r.redFor+r.yellowAgainst+r.redAgainst)} },
      shots: shots(views), discipline: discipline(views), h2h: h2h(views,team),
      leagueTables: { fullAll: leagueTable(leagueRows,false,'all'), fullHome: leagueTable(leagueRows,false,'home'), fullAway: leagueTable(leagueRows,false,'away'), halfAll: leagueTable(leagueRows,true,'all'), halfHome: leagueTable(leagueRows,true,'home'), halfAway: leagueTable(leagueRows,true,'away') }
    };
    return { statusCode:200, headers:{'content-type':'application/json','cache-control':'public, max-age=300'}, body:JSON.stringify(response) };
  } catch (error) {
    return { statusCode:500, headers:{'content-type':'application/json'}, body:JSON.stringify({ok:false,error:error.message||'Could not build team page'}) };
  }
}
