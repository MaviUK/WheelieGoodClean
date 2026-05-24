const FOTMOB_BASE_URL = 'https://www.fotmob.com/api';

function normaliseDate(value) {
  if (value && /^\d{8}$/.test(value)) return value;
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value.replaceAll('-', '');
  return new Date().toISOString().slice(0, 10).replaceAll('-', '');
}

function makeUrl(endpoint, params = {}) {
  const cleanEndpoint = String(endpoint).replace(/^\/+|\/+$/g, '');
  const url = new URL(`${FOTMOB_BASE_URL}/${cleanEndpoint}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  }
  return url;
}

async function getJson(endpoint, params = {}) {
  const url = makeUrl(endpoint, params);
  const response = await fetch(url, {
    headers: {
      accept: 'application/json,text/plain,*/*',
      'user-agent': 'Mozilla/5.0 GerballFootballStats/0.1',
      referer: 'https://www.fotmob.com/',
    },
  });

  const text = await response.text();
  let json = null;

  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  return {
    ok: response.ok && Boolean(json),
    status: response.status,
    contentType: response.headers.get('content-type') || '',
    url: url.toString(),
    json,
    snippet: text.slice(0, 500),
  };
}

function interestingPaths(value, path = '', found = new Set()) {
  if (!value || typeof value !== 'object') return found;

  if (Array.isArray(value)) {
    value.slice(0, 3).forEach((item, index) => interestingPaths(item, `${path}[${index}]`, found));
    return found;
  }

  const interesting = /shot|xg|corner|card|goal|event|lineup|stat|possession|foul|substitution|player|table|standing|fixture|match/i;
  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    if (interesting.test(key)) found.add(childPath);
    if (child && typeof child === 'object') interestingPaths(child, childPath, found);
  }
  return found;
}

function summarisePayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  return {
    topLevelKeys: Object.keys(payload).sort(),
    interestingPaths: [...interestingPaths(payload)].slice(0, 80),
  };
}

function flattenFixtures(fixturesPayload) {
  const values = [];

  function walk(value) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }

    const possibleId = value.id || value.matchId || value.fixtureId;
    const hasTeams = value.home || value.away || value.homeTeam || value.awayTeam || value.homeName || value.awayName;
    if (possibleId && hasTeams) values.push(value);

    Object.values(value).forEach(walk);
  }

  walk(fixturesPayload);
  const seen = new Set();
  return values.filter((item) => {
    const id = item.id || item.matchId || item.fixtureId;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function summariseMatchCandidate(match) {
  if (!match) return null;
  return {
    id: match.id || match.matchId || match.fixtureId,
    home: match.home?.name || match.homeName || match.homeTeam?.name || match.home?.shortName,
    away: match.away?.name || match.awayName || match.awayTeam?.name || match.away?.shortName,
    score: match.scoreStr || match.status?.scoreStr || match.score,
    status: match.status?.reason?.short || match.status?.short || match.status,
    time: match.status?.utcTime || match.time || match.startTime,
    keys: Object.keys(match).sort(),
  };
}

function summariseMatchDetails(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const content = payload.content || {};
  const shotmap = content.shotmap || payload.shotmap || {};
  const stats = content.stats || payload.stats || null;
  const lineup = content.lineup || content.lineups || payload.lineup || payload.lineups || null;
  const facts = content.matchFacts || payload.matchFacts || null;

  return {
    topLevelKeys: Object.keys(payload).sort(),
    contentKeys: Object.keys(content).sort(),
    interestingPaths: [...interestingPaths(payload)].slice(0, 120),
    hasStats: Boolean(stats),
    hasShotmap: Boolean(shotmap.shots || shotmap.length || Object.keys(shotmap).length),
    shotCount: Array.isArray(shotmap.shots) ? shotmap.shots.length : null,
    hasLineup: Boolean(lineup),
    hasMatchFacts: Boolean(facts),
    sampleShot: Array.isArray(shotmap.shots) ? shotmap.shots[0] : null,
    statsShape: stats && typeof stats === 'object' ? Object.keys(stats).sort() : null,
  };
}

export async function handler(event) {
  const query = event.queryStringParameters || {};
  const date = normaliseDate(query.date);
  const leagueId = query.leagueId || '47';
  const season = query.season || '2025/2026';
  const matchId = query.matchId;
  const includeRaw = query.raw === '1';

  const allLeagues = await getJson('allLeagues');
  const matches = await getJson('matches', { date, timezone: 'Europe/London', ccode3: 'ENG' });
  const league = await getJson('leagues', { id: leagueId });
  const fixtures = await getJson('fixtures', { id: leagueId, season });
  const table = await getJson('tltable', { leagueId });

  const fixtureCandidates = fixtures.ok ? flattenFixtures(fixtures.json) : [];
  const selectedMatchId = matchId || fixtureCandidates.find((item) => item.id || item.matchId || item.fixtureId)?.id || fixtureCandidates.find((item) => item.id || item.matchId || item.fixtureId)?.matchId;

  const match = selectedMatchId ? await getJson('match', { id: selectedMatchId }) : null;
  const matchDetails = selectedMatchId ? await getJson('matchDetails', { matchId: selectedMatchId }) : null;

  const body = {
    ok: Boolean(allLeagues.ok || league.ok || fixtures.ok || table.ok || matches.ok),
    note: 'FotMob is unofficial. This test checks which endpoints still return JSON from Netlify.',
    request: { date, leagueId, season, selectedMatchId },
    endpointStatus: {
      allLeagues: { ok: allLeagues.ok, status: allLeagues.status, url: allLeagues.url, contentType: allLeagues.contentType },
      matchesByDate: { ok: matches.ok, status: matches.status, url: matches.url, contentType: matches.contentType, snippet: matches.ok ? undefined : matches.snippet },
      league: { ok: league.ok, status: league.status, url: league.url, contentType: league.contentType },
      fixtures: { ok: fixtures.ok, status: fixtures.status, url: fixtures.url, contentType: fixtures.contentType },
      table: { ok: table.ok, status: table.status, url: table.url, contentType: table.contentType },
      match: match ? { ok: match.ok, status: match.status, url: match.url, contentType: match.contentType } : null,
      matchDetails: matchDetails ? { ok: matchDetails.ok, status: matchDetails.status, url: matchDetails.url, contentType: matchDetails.contentType } : null,
    },
    summaries: {
      allLeagues: allLeagues.ok ? summarisePayload(allLeagues.json) : null,
      league: league.ok ? summarisePayload(league.json) : null,
      fixtures: fixtures.ok ? summarisePayload(fixtures.json) : null,
      table: table.ok ? summarisePayload(table.json) : null,
      fixtureCount: fixtureCandidates.length,
      firstTenFixtures: fixtureCandidates.slice(0, 10).map(summariseMatchCandidate),
      match: match?.ok ? summariseMatchDetails(match.json) : null,
      matchDetails: matchDetails?.ok ? summarisePayload(matchDetails.json) : null,
    },
  };

  if (includeRaw) {
    body.raw = {
      allLeagues: allLeagues.ok ? allLeagues.json : null,
      matches: matches.ok ? matches.json : null,
      league: league.ok ? league.json : null,
      fixtures: fixtures.ok ? fixtures.json : null,
      table: table.ok ? table.json : null,
      match: match?.ok ? match.json : null,
      matchDetails: matchDetails?.ok ? matchDetails.json : null,
    };
  }

  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body, null, 2),
  };
}
