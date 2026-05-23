import { runSync } from './_shared/syncLogic.js';

export async function handler() {
  try {
    const result = await runSync({ mode: 'evening' });
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
