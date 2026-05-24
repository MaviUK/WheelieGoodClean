import { importFootballDataCoUk } from './_shared/footballDataCoUk.js';

export async function handler(event) {
  const configuredSecret = process.env.SYNC_SECRET;
  const providedSecret = event.queryStringParameters?.key;

  if (configuredSecret && providedSecret !== configuredSecret) {
    return {
      statusCode: 401,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'Invalid sync key.' }),
    };
  }

  const query = event.queryStringParameters || {};

  try {
    const result = await importFootballDataCoUk({
      mode: query.mode || 'current',
      season: query.season,
      fromSeason: query.fromSeason,
      toSeason: query.toSeason,
      division: query.division,
      maxSeasons: query.maxSeasons,
    });

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: false, error: error.message }, null, 2),
    };
  }
}
