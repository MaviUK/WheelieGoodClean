const API_BASE_URL = 'https://v3.football.api-sports.io';

export function makeCacheKey(endpoint, params = {}) {
  const sorted = Object.keys(params)
    .sort()
    .map((key) => `${key}=${String(params[key])}`)
    .join('&');
  return `${endpoint}?${sorted}`;
}

export async function apiFootballFetch(endpoint, params = {}) {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    throw new Error('Missing API_FOOTBALL_KEY environment variable.');
  }

  const url = new URL(`${API_BASE_URL}/${endpoint.replace(/^\//, '')}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'x-apisports-key': apiKey,
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`API-FOOTBALL ${response.status}: ${JSON.stringify(payload)}`);
  }

  if (payload.errors && Object.keys(payload.errors).length > 0) {
    throw new Error(`API-FOOTBALL error: ${JSON.stringify(payload.errors)}`);
  }

  return payload;
}
