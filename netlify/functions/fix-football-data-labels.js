import { getSupabaseAdmin } from './_shared/supabaseAdmin.js';

const LABELS = {
  E0: { country_code: 'ENG', country_name: 'England', division_name: 'Premier League' },
  E1: { country_code: 'ENG', country_name: 'England', division_name: 'Championship' },
  E2: { country_code: 'ENG', country_name: 'England', division_name: 'League One' },
  E3: { country_code: 'ENG', country_name: 'England', division_name: 'League Two' },
  EC: { country_code: 'ENG', country_name: 'England', division_name: 'National League' },

  SC0: { country_code: 'SCO', country_name: 'Scotland', division_name: 'Premiership' },
  SC1: { country_code: 'SCO', country_name: 'Scotland', division_name: 'Championship' },
  SC2: { country_code: 'SCO', country_name: 'Scotland', division_name: 'League One' },
  SC3: { country_code: 'SCO', country_name: 'Scotland', division_name: 'League Two' },

  D1: { country_code: 'DEU', country_name: 'Germany', division_name: 'Bundesliga' },
  D2: { country_code: 'DEU', country_name: 'Germany', division_name: '2. Bundesliga' },

  I1: { country_code: 'ITA', country_name: 'Italy', division_name: 'Serie A' },
  I2: { country_code: 'ITA', country_name: 'Italy', division_name: 'Serie B' },

  SP1: { country_code: 'ESP', country_name: 'Spain', division_name: 'La Liga' },
  SP2: { country_code: 'ESP', country_name: 'Spain', division_name: 'Segunda Division' },

  F1: { country_code: 'FRA', country_name: 'France', division_name: 'Ligue 1' },
  F2: { country_code: 'FRA', country_name: 'France', division_name: 'Ligue 2' },

  N1: { country_code: 'NLD', country_name: 'Netherlands', division_name: 'Eredivisie' },
  B1: { country_code: 'BEL', country_name: 'Belgium', division_name: 'Jupiler League' },
  P1: { country_code: 'PRT', country_name: 'Portugal', division_name: 'Liga I' },
  T1: { country_code: 'TUR', country_name: 'Turkey', division_name: 'Ligi 1' },
  G1: { country_code: 'GRC', country_name: 'Greece', division_name: 'Ethniki Katigoria' },
};

export async function handler(event) {
  const configuredSecret = process.env.SYNC_SECRET;
  const providedSecret = event.queryStringParameters?.key;

  if (configuredSecret && providedSecret !== configuredSecret) {
    return {
      statusCode: 401,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'Invalid sync key.' }, null, 2),
    };
  }

  const supabase = getSupabaseAdmin();
  const results = [];

  for (const [division, labels] of Object.entries(LABELS)) {
    const { count, error } = await supabase
      .from('football_data_matches')
      .update({ ...labels, updated_at: new Date().toISOString() }, { count: 'exact' })
      .eq('division', division);

    if (error) {
      results.push({ division, ok: false, error: error.message });
    } else {
      results.push({ division, ok: true, updated: count || 0, ...labels });
    }
  }

  const failed = results.filter((item) => !item.ok);

  return {
    statusCode: failed.length ? 500 : 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ok: failed.length === 0,
      message: failed.length
        ? 'Some labels failed to update.'
        : 'Football-data country and division labels updated.',
      results,
    }, null, 2),
  };
}
