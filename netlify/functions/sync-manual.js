import { runSync } from './_shared/syncLogic.js';

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
  const payload = event.body ? JSON.parse(event.body) : {};
  const mode = query.mode || payload.mode || 'sample';
  const from = query.from || payload.from;
  const to = query.to || payload.to;

  try {
    const result = await runSync({ mode, from, to });
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
