const FOTMOB_BASE_URL = 'https://www.fotmob.com/api';

function todayFotmobDate() {
  return new Date().toISOString().slice(0, 10).replaceAll('-', '');
}

async function fotmobFetch(endpoint, params = {}) {
  // FotMob's unofficial API expects a trailing slash after the endpoint name,
  // for example /api/matches/?date=YYYYMMDD. Without it, FotMob returns the
  // public HTML app shell with a 404.
  const cleanEndpoint = String(endpoint).replace(/^\/+|\/+$/g, '');
  const url = new URL(`${FOTMOB_BASE_URL}/${cleanEndpoint}/`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url, {
    headers: {
      accept: 'application/json,text/plain,*/*',
      'user-agent': 'Mozilla/5.0 GerballFootballStats/0.1',
    },
  });

  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { rawText: text.slice(0, 2000) };
  }

  const contentType = response.headers.get('content-type') || '';
  if (!response.ok || contentType.includes('text/html')) {
    throw new Error(`FotMob ${cleanEndpoint} failed with ${response.status}: ${text.slice(0, 300)}`);
  }

  return { url: url.toString(), payload };
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

  try {
    const matchesResult = await fotmobFetch('matches', { date, ccode3 });
    const matches = getMatchesFromPayload(matchesResult.payload);
    const selectedMatchId = matchId || matches.find((match) => match.matchId)?.matchId;

    let matchResult = null;
    let matchDetailsResult = null;

    if (selectedMatchId) {
      matchResult = await fotmobFetch('match', { id: selectedMatchId });
      matchDetailsResult = await fotmobFetch('matchDetails', { matchId: selectedMatchId });
    }

    const body = {
      ok: true,
      date,
      ccode3,
      matchesEndpoint: matchesResult.url,
      matchCount: matches.length,
      firstMatches: matches.slice(0, 10),
      selectedMatchId,
      matchEndpoint: matchResult?.url || null,
      matchSummary: matchResult ? summariseMatchPayload(matchResult.payload) : null,
      matchDetailsEndpoint: matchDetailsResult?.url || null,
      matchDetailsKeys: matchDetailsResult ? Object.keys(matchDetailsResult.payload || {}) : null,
      note: 'Use raw=1 to include full JSON payloads for inspection.',
    };

    if (includeRaw) {
      body.raw = {
        matches: matchesResult.payload,
        match: matchResult?.payload || null,
        matchDetails: matchDetailsResult?.payload || null,
      };
    }

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body, null, 2),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: false, error: error.message }, null, 2),
    };
  }
}
