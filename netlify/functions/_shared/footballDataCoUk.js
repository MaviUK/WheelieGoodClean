import crypto from 'node:crypto';
import { getSupabaseAdmin } from './supabaseAdmin.js';

const BASE_URL = 'https://www.football-data.co.uk/mmz4281';

export const FOOTBALL_DATA_CURRENT_SEASON = '2526';

export const FOOTBALL_DATA_DIVISIONS = {
  E0: { countryCode: 'ENG', countryName: 'England', divisionName: 'Premier League' },
  E1: { countryCode: 'ENG', countryName: 'England', divisionName: 'Championship' },
  E2: { countryCode: 'ENG', countryName: 'England', divisionName: 'League One' },
  E3: { countryCode: 'ENG', countryName: 'England', divisionName: 'League Two' },
  EC: { countryCode: 'ENG', countryName: 'England', divisionName: 'National League' },

  SC0: { countryCode: 'SCO', countryName: 'Scotland', divisionName: 'Premiership' },
  SC1: { countryCode: 'SCO', countryName: 'Scotland', divisionName: 'Championship' },
  SC2: { countryCode: 'SCO', countryName: 'Scotland', divisionName: 'League One' },
  SC3: { countryCode: 'SCO', countryName: 'Scotland', divisionName: 'League Two' },

  D1: { countryCode: 'DEU', countryName: 'Germany', divisionName: 'Bundesliga' },
  D2: { countryCode: 'DEU', countryName: 'Germany', divisionName: '2. Bundesliga' },

  I1: { countryCode: 'ITA', countryName: 'Italy', divisionName: 'Serie A' },
  I2: { countryCode: 'ITA', countryName: 'Italy', divisionName: 'Serie B' },

  SP1: { countryCode: 'ESP', countryName: 'Spain', divisionName: 'La Liga' },
  SP2: { countryCode: 'ESP', countryName: 'Spain', divisionName: 'Segunda Division' },

  F1: { countryCode: 'FRA', countryName: 'France', divisionName: 'Ligue 1' },
  F2: { countryCode: 'FRA', countryName: 'France', divisionName: 'Ligue 2' },

  N1: { countryCode: 'NLD', countryName: 'Netherlands', divisionName: 'Eredivisie' },
  B1: { countryCode: 'BEL', countryName: 'Belgium', divisionName: 'Jupiler League' },
  P1: { countryCode: 'PRT', countryName: 'Portugal', divisionName: 'Liga I' },
  T1: { countryCode: 'TUR', countryName: 'Turkey', divisionName: 'Ligi 1' },
  G1: { countryCode: 'GRC', countryName: 'Greece', divisionName: 'Ethniki Katigoria' },
};

const CORE_RESULT_COLUMNS = new Set([
  'Div', 'Date', 'Time', 'HomeTeam', 'AwayTeam', 'FTHG', 'FTAG', 'FTR',
  'HTHG', 'HTAG', 'HTR', 'Referee', 'HG', 'AG', 'Res',
]);

const MATCH_STAT_COLUMNS = new Set([
  'HS', 'AS', 'HST', 'AST', 'HF', 'AF', 'HC', 'AC', 'HY', 'AY', 'HR', 'AR',
]);

function getDivisionConfig(division) {
  return FOOTBALL_DATA_DIVISIONS[division] || {
    countryCode: 'UNK',
    countryName: 'Unknown',
    divisionName: division,
  };
}

export function seasonCodeToLabel(code) {
  const start = Number.parseInt(code.slice(0, 2), 10);
  const end = Number.parseInt(code.slice(2, 4), 10);
  const startYear = start >= 90 ? 1900 + start : 2000 + start;
  const endYear = end >= 90 ? 1900 + end : 2000 + end;
  return `${startYear}/${endYear}`;
}

export function generateSeasonCodes(from = '9394', to = FOOTBALL_DATA_CURRENT_SEASON) {
  const fromStart = Number.parseInt(from.slice(0, 2), 10);
  const toStart = Number.parseInt(to.slice(0, 2), 10);
  const fromYear = fromStart >= 90 ? 1900 + fromStart : 2000 + fromStart;
  const toYear = toStart >= 90 ? 1900 + toStart : 2000 + toStart;
  const codes = [];

  for (let year = fromYear; year <= toYear; year += 1) {
    const yy = String(year % 100).padStart(2, '0');
    const next = String((year + 1) % 100).padStart(2, '0');
    codes.push(`${yy}${next}`);
  }

  return codes;
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

export function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] === undefined ? null : values[index];
    });
    return row;
  });
}

function parseNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInteger(value) {
  const parsed = parseNumber(value);
  return parsed === null ? null : Math.trunc(parsed);
}

function parseDate(value) {
  if (!value) return null;
  const parts = String(value).split('/');
  if (parts.length !== 3) return null;

  const day = parts[0].padStart(2, '0');
  const month = parts[1].padStart(2, '0');
  let year = Number.parseInt(parts[2], 10);
  if (!Number.isFinite(year)) return null;
  if (year < 100) year += year >= 90 ? 1900 : 2000;

  return `${year}-${month}-${day}`;
}

function rowHash(row) {
  return crypto.createHash('sha1').update(JSON.stringify(row)).digest('hex');
}

function cleanedValue(value) {
  if (value === undefined || value === null || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : value;
}

function buildJsonBucket(row, predicate) {
  return Object.fromEntries(
    Object.entries(row)
      .filter(([key]) => predicate(key))
      .map(([key, value]) => [key, cleanedValue(value)]),
  );
}

function buildMatchStats(row) {
  return {
    raw: buildJsonBucket(row, (key) => MATCH_STAT_COLUMNS.has(key)),
    home: {
      shots: parseInteger(row.HS),
      shots_on_target: parseInteger(row.HST),
      fouls: parseInteger(row.HF),
      corners: parseInteger(row.HC),
      yellow_cards: parseInteger(row.HY),
      red_cards: parseInteger(row.HR),
    },
    away: {
      shots: parseInteger(row.AS),
      shots_on_target: parseInteger(row.AST),
      fouls: parseInteger(row.AF),
      corners: parseInteger(row.AC),
      yellow_cards: parseInteger(row.AY),
      red_cards: parseInteger(row.AR),
    },
  };
}

function buildBettingOdds(row) {
  const betting = buildJsonBucket(row, (key) => !CORE_RESULT_COLUMNS.has(key) && !MATCH_STAT_COLUMNS.has(key));
  const grouped = {};

  for (const [key, value] of Object.entries(betting)) {
    const match = key.match(/^([A-Za-z0-9]+)(H|D|A|CH|CD|CA|O|U|CO|CU|AHH|AHA|CHH|CHA|AHCh|AHCa)$/);
    const group = match ? match[1] : 'other';
    grouped[group] ||= {};
    grouped[group][key] = value;
  }

  return {
    all: betting,
    grouped,
    summary: {
      average: {
        home: parseNumber(row.AvgH),
        draw: parseNumber(row.AvgD),
        away: parseNumber(row.AvgA),
        over_25: parseNumber(row['Avg>2.5']),
        under_25: parseNumber(row['Avg<2.5']),
      },
      maximum: {
        home: parseNumber(row.MaxH),
        draw: parseNumber(row.MaxD),
        away: parseNumber(row.MaxA),
        over_25: parseNumber(row['Max>2.5']),
        under_25: parseNumber(row['Max<2.5']),
      },
      closing_average: {
        home: parseNumber(row.AvgCH),
        draw: parseNumber(row.AvgCD),
        away: parseNumber(row.AvgCA),
      },
      closing_maximum: {
        home: parseNumber(row.MaxCH),
        draw: parseNumber(row.MaxCD),
        away: parseNumber(row.MaxCA),
      },
    },
  };
}

function buildSourceMetadata(row, sourceUrl) {
  const columns = Object.keys(row);
  return {
    source_url: sourceUrl,
    column_count: columns.length,
    columns,
    has_match_stats: columns.some((key) => MATCH_STAT_COLUMNS.has(key)),
    betting_column_count: columns.filter((key) => !CORE_RESULT_COLUMNS.has(key) && !MATCH_STAT_COLUMNS.has(key)).length,
  };
}

function csvRowToDbRow({ row, seasonCode, division, sourceUrl }) {
  const config = getDivisionConfig(division);
  return {
    country_code: config.countryCode,
    country_name: config.countryName,
    division,
    division_name: config.divisionName,
    season_code: seasonCode,
    season_label: seasonCodeToLabel(seasonCode),
    match_date: parseDate(row.Date),
    kickoff_time: row.Time || null,
    home_team: row.HomeTeam || null,
    away_team: row.AwayTeam || null,
    fthg: parseInteger(row.FTHG ?? row.HG),
    ftag: parseInteger(row.FTAG ?? row.AG),
    ftr: row.FTR ?? row.Res ?? null,
    hthg: parseInteger(row.HTHG),
    htag: parseInteger(row.HTAG),
    htr: row.HTR ?? null,
    referee: row.Referee || null,
    home_shots: parseInteger(row.HS),
    away_shots: parseInteger(row.AS),
    home_shots_target: parseInteger(row.HST),
    away_shots_target: parseInteger(row.AST),
    home_corners: parseInteger(row.HC),
    away_corners: parseInteger(row.AC),
    home_fouls: parseInteger(row.HF),
    away_fouls: parseInteger(row.AF),
    home_yellow: parseInteger(row.HY),
    away_yellow: parseInteger(row.AY),
    home_red: parseInteger(row.HR),
    away_red: parseInteger(row.AR),
    avg_home_odds: parseNumber(row.AvgH),
    avg_draw_odds: parseNumber(row.AvgD),
    avg_away_odds: parseNumber(row.AvgA),
    max_home_odds: parseNumber(row.MaxH),
    max_draw_odds: parseNumber(row.MaxD),
    max_away_odds: parseNumber(row.MaxA),
    avg_over_25: parseNumber(row['Avg>2.5']),
    avg_under_25: parseNumber(row['Avg<2.5']),
    max_over_25: parseNumber(row['Max>2.5']),
    max_under_25: parseNumber(row['Max<2.5']),
    match_stats: buildMatchStats(row),
    betting_odds: buildBettingOdds(row),
    source_columns: buildSourceMetadata(row, sourceUrl),
    source_url: sourceUrl,
    row_hash: rowHash(row),
    raw: row,
    updated_at: new Date().toISOString(),
  };
}

async function fetchDivisionCsv(seasonCode, division) {
  const sourceUrl = `${BASE_URL}/${seasonCode}/${division}.csv`;
  const response = await fetch(sourceUrl, {
    headers: {
      accept: 'text/csv,text/plain,*/*',
      'user-agent': 'GerballFootballStats/0.1',
    },
  });

  const text = await response.text();
  if (!response.ok || text.trim().startsWith('<!DOCTYPE html')) {
    return {
      ok: false,
      status: response.status,
      sourceUrl,
      rows: [],
      message: text.slice(0, 200),
    };
  }

  const csvRows = parseCsv(text);
  const rows = csvRows
    .map((row) => csvRowToDbRow({ row, seasonCode, division, sourceUrl }))
    .filter((row) => row.match_date && row.home_team && row.away_team);

  return {
    ok: true,
    status: response.status,
    sourceUrl,
    rows,
  };
}

async function upsertChunked(supabase, table, rows, chunkSize = 500) {
  let imported = 0;
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const { error } = await supabase
      .from(table)
      .upsert(chunk, {
        onConflict: 'country_code,division,season_code,match_date,home_team,away_team',
      });

    if (error) throw new Error(`${table} upsert failed: ${error.message}`);
    imported += chunk.length;
  }
  return imported;
}

export async function importFootballDataCoUk({
  mode = 'current',
  season,
  fromSeason,
  toSeason,
  division,
  maxSeasons = 3,
} = {}) {
  const supabase = getSupabaseAdmin();
  const divisions = division
    ? String(division).split(',').map((item) => item.trim()).filter(Boolean)
    : Object.keys(FOOTBALL_DATA_DIVISIONS);
  const seasonCodes = mode === 'historic'
    ? generateSeasonCodes(fromSeason || '9394', toSeason || FOOTBALL_DATA_CURRENT_SEASON).slice(0, Number(maxSeasons) || 3)
    : [season || FOOTBALL_DATA_CURRENT_SEASON];

  const startedAt = new Date().toISOString();
  const result = {
    ok: true,
    source: 'football-data.co.uk',
    mode,
    startedAt,
    seasonCodes,
    divisions,
    filesTried: 0,
    filesImported: 0,
    rowsImported: 0,
    errors: [],
  };

  for (const seasonCode of seasonCodes) {
    for (const div of divisions) {
      result.filesTried += 1;
      try {
        const file = await fetchDivisionCsv(seasonCode, div);
        if (!file.ok) {
          result.errors.push({ seasonCode, division: div, sourceUrl: file.sourceUrl, status: file.status, message: file.message });
          continue;
        }

        const imported = await upsertChunked(supabase, 'football_data_matches', file.rows);
        result.filesImported += 1;
        result.rowsImported += imported;
      } catch (error) {
        result.errors.push({ seasonCode, division: div, error: error.message });
      }
    }
  }

  result.finishedAt = new Date().toISOString();
  result.ok = result.rowsImported > 0 || result.errors.length === 0;

  await supabase.from('football_data_import_runs').insert({
    source: 'football-data.co.uk',
    mode,
    status: result.ok ? (result.errors.length ? 'partial_success' : 'success') : 'failed',
    seasons: seasonCodes,
    divisions,
    rows_imported: result.rowsImported,
    files_imported: result.filesImported,
    files_tried: result.filesTried,
    started_at: startedAt,
    finished_at: result.finishedAt,
    raw: result,
  });

  return result;
}
