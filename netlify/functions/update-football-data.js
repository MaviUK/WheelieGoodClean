import { importFootballDataCoUk } from './_shared/footballDataCoUk.js';

export async function handler() {
  try {
    const result = await importFootballDataCoUk({ mode: 'current' });
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
