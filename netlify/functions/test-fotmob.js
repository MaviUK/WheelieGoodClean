const FOTMOB_BASE_URL = 'https://www.fotmob.com/api';

function todayFotmobDate() {
  return new Date().toISOString().slice(0, 10).replaceAll('-', '');
}

function makeUrl(path, params = {}) {
  const url = new URL(path);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  }
  return url;
}

async function getText(url) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json,text/plain,*/*',
      'user-agent': 'Mozilla/5.0 GerballFootballStats/0.1',
      referer: 'https://www.fotmob.com/',
    },
  });

  const text = await response.text();
  const contentType = response.headers.get('content-type') || '';
  let json = null;

  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    contentType,
    url: url.toString(),
    json,
    snippet: text.slice(0, 500),
  };
}

async function tryFotmob(endpoint, params = {}) {
  const cleanEndpoint = String(endpoint).replace(/^\/+|\/+$/g, '');
  const variants = [
    makeUrl(`${FOTMOB_BASE_URL}/${cleanEndpoint}`, params),
    makeUrl(`${FOTMOB_BASE_URL}/${cleanEndpoint}/`, params),
    makeUrl(`${FOTMOB_BASE_URL}//${cleanEndpoint}/`, params),
  ];

  const attempts = [];
  for (const url of variants) {
    const result = await getText(url);
    attempts.push({
      ok: result.ok,
      status: result.status,
      contentType: result.contentType,
      url: result.url,
      snippet: result.snippet,
    });

    if (result.ok && result.json && !result.contentType.includes('text/html')) {
      return { result, attempts };
    }
  }

  return { result: null, attempts };
}

function getMatchesFromPayload(payload) {
  const leagues = Array.isArray(payload?.leagues) ? payload.leagues : [];
  return leagues.flatMap((league) => {
    const matches = Array.isArray(league.matches) ? league.matches : [];
    return matches.map((match) => ({
      leagueId: league.id,
      leagueName: league.name,
      matchId: match.id,
      home: match.home?.name || match.home?.shortName,
      away: match.away?.name || match.away?.shortName,
      status: match.status?.finished ? 'finished' : match.status?.started ? 'started' : 'scheduled',
      rawKeys: Object.keys(match),
    }));
  });
}

function summariseMatchPayload(payload) {
  return {
    topLevelKeys: Object.keys(payload || {}),
    hasContent: Boolean(payload?.content),
    contentKeys: Object.keys(payload?.content || {}),
    hasGeneral: Boolean(payload?.general),
    generalKeys: Object.keys(payload?.general || {}),
    hasHeader: Boolean(payload?.header),
    headerKeys: Object.keys(payload?.header || {}),
    hasStats: Boolean(payload?.content?.stats),
    statsKeys: Object.keys(payload?.content?.stats || {}),
    hasShotmap: Boolean(payload?.content?.shotmap),
    shotmapKeys: Object.keys(payload?.content?.shotmap || {}),
    hasLineup: Boolean(payload?.content?.lineup),
    lineupKeys: Object.keys(payload?.content?.lineup || {}),
  };
}

export async function handler(event) {
  const query = event.queryStringParameters || {};
  const date = query.date || todayFotmobDate();
  const ccode3 = query.ccode3 || 'ENG';
  const matchId = query.matchId;
  const includeRaw = query.raw === '1';

  const matchesCheck = await tryFotmob('matches', { date, ccode3 });

  if (!matchesCheck.result) {
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ok: false,
        date,
        ccode3,
        message: 'FotMob did not return JSON from any tested URL pattern. This may mean the unofficial endpoint is blocked from Netlify or has changed.',
        attempts: matchesCheck.attempts,
      }, null, 2),
    };
  }

  const matchesPayload = matchesCheck.result.json;
  const matches = getMatchesFromPayload(matchesPayload);
  const selectedMatchId = matchId || matches.find((match) => match.matchId)?.matchId;

  let matchCheck = null;
  let detailsCheck = null;

  if (selectedMatchId) {
    matchCheck = await tryFotmob('match', { id: selectedMatchId });
    detailsCheck = await tryFotmob('matchDetails', { matchId: selectedMatchId });
  }

  const body = {
    ok: true,
    date,
    ccode3,
    matchesAttempts: matchesCheck.attempts,
    matchCount: matches.length,
    firstMatches: matches.slice(0, 10),
    selectedMatchId,
    matchAttempts: matchCheck?.attempts || null,
    matchSummary: matchCheck?.result?.json ? summariseMatchPayload(matchCheck.result.json) : null,
    matchDetailsAttempts: detailsCheck?.attempts || null,
    matchDetailsKeys: detailsCheck?.result?.json ? Object.keys(detailsCheck.result.json || {}) : null,
    note: 'Use raw=1 to include full JSON payloads for inspection.',
  };

  if (includeRaw) {
    body.raw = {
      matches: matchesPayload,
      match: matchCheck?.result?.json || null,
      matchDetails: detailsCheck?.result?.json || null,
    };
  }

  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body, null, 2),
  };
}
