import { apiFootballFetch } from './_shared/apiFootball.js';

export async function handler(event) {
  const country = event.queryStringParameters?.country || 'England';
  const season = event.queryStringParameters?.season || '2025';

  try {
    const payload = await apiFootballFetch('leagues', { country, season });
    const simplified = (payload.response || []).map((item) => ({
      league_id: item.league?.id,
      league_name: item.league?.name,
      type: item.league?.type,
      country: item.country?.name,
      season,
      coverage: item.seasons?.find((s) => String(s.year) === String(season))?.coverage || null,
    }));

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true, count: simplified.length, leagues: simplified }, null, 2),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: false, error: error.message }, null, 2),
    };
  }
}
