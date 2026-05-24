import { useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from './lib/supabaseClient.js';

const PAGE_SIZE = 250;

function formatDate(value) {
  if (!value) return 'TBC';
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00`));
}

function scoreText(match) {
  if (match?.fthg === null || match?.fthg === undefined) return 'vs';
  return `${match.fthg} - ${match.ftag}`;
}

function resultLabel(result) {
  if (result === 'H') return 'Home win';
  if (result === 'A') return 'Away win';
  if (result === 'D') return 'Draw';
  return result || 'TBC';
}

function numberOrDash(value) {
  return value === null || value === undefined || value === '' ? '-' : value;
}

function uniqueOptions(rows, key, labelKey = key) {
  const map = new Map();
  for (const row of rows) {
    const value = row[key];
    if (value === null || value === undefined || value === '') continue;
    if (!map.has(value)) map.set(value, row[labelKey] || value);
  }
  return [...map.entries()]
    .map(([value, label]) => ({ value: String(value), label: String(label) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function StatPill({ label, home, away }) {
  return (
    <div className="stat-pill">
      <span>{label}</span>
      <strong>{numberOrDash(home)}</strong>
      <em>{numberOrDash(away)}</em>
    </div>
  );
}

function MetricCard({ label, value, detail }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

function JsonPreview({ title, data }) {
  const entries = data && typeof data === 'object' ? Object.entries(data) : [];
  if (!entries.length) return null;

  return (
    <div className="json-preview">
      <h4>{title}</h4>
      <div className="json-grid">
        {entries.slice(0, 18).map(([key, value]) => (
          <div key={key}>
            <span>{key}</span>
            <strong>{typeof value === 'object' ? JSON.stringify(value) : numberOrDash(value)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchDetails({ match }) {
  if (!match) return <div className="empty-panel">Select a match to view shots, corners, cards, odds and raw imported fields.</div>;

  const bettingSummary = match.betting_odds?.summary || {};
  const allOdds = match.betting_odds?.all || {};
  const raw = match.raw || {};

  return (
    <section className="details-card">
      <div className="details-header">
        <div>
          <p className="eyebrow">{match.country_name || 'Football-data.co.uk'} · {match.division_name || match.division} · {match.season_label}</p>
          <h2>{match.home_team} <span>{scoreText(match)}</span> {match.away_team}</h2>
          <p>{formatDate(match.match_date)} · {resultLabel(match.ftr)}{match.referee ? ` · Referee: ${match.referee}` : ''}</p>
        </div>
      </div>

      <div className="stats-grid">
        <StatPill label="Shots" home={match.home_shots} away={match.away_shots} />
        <StatPill label="On target" home={match.home_shots_target} away={match.away_shots_target} />
        <StatPill label="Corners" home={match.home_corners} away={match.away_corners} />
        <StatPill label="Fouls" home={match.home_fouls} away={match.away_fouls} />
        <StatPill label="Yellow cards" home={match.home_yellow} away={match.away_yellow} />
        <StatPill label="Red cards" home={match.home_red} away={match.away_red} />
      </div>

      <div className="odds-panel">
        <h3>Betting odds summary</h3>
        <div className="odds-grid">
          <MetricCard label="Avg home" value={numberOrDash(bettingSummary.average?.home ?? match.avg_home_odds)} />
          <MetricCard label="Avg draw" value={numberOrDash(bettingSummary.average?.draw ?? match.avg_draw_odds)} />
          <MetricCard label="Avg away" value={numberOrDash(bettingSummary.average?.away ?? match.avg_away_odds)} />
          <MetricCard label="Max home" value={numberOrDash(bettingSummary.maximum?.home ?? match.max_home_odds)} />
          <MetricCard label="Max draw" value={numberOrDash(bettingSummary.maximum?.draw ?? match.max_draw_odds)} />
          <MetricCard label="Max away" value={numberOrDash(bettingSummary.maximum?.away ?? match.max_away_odds)} />
          <MetricCard label="Avg over 2.5" value={numberOrDash(bettingSummary.average?.over_25 ?? match.avg_over_25)} />
          <MetricCard label="Avg under 2.5" value={numberOrDash(bettingSummary.average?.under_25 ?? match.avg_under_25)} />
        </div>
      </div>

      <div className="two-column-details">
        <JsonPreview title="All saved odds fields" data={allOdds} />
        <JsonPreview title="Raw imported CSV row" data={raw} />
      </div>
    </section>
  );
}

export default function App() {
  const [metadataRows, setMetadataRows] = useState([]);
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [importRuns, setImportRuns] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    country: 'all',
    division: 'all',
    season: 'all',
    team: '',
  });

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    async function loadMetadata() {
      const [metaResult, runResult] = await Promise.all([
        supabase
          .from('football_data_matches')
          .select('country_code, country_name, division, division_name, season_code, season_label, home_team, away_team')
          .order('match_date', { ascending: false })
          .limit(10000),
        supabase
          .from('football_data_import_runs')
          .select('mode, status, started_at, finished_at, seasons, divisions, rows_imported, files_imported, files_tried')
          .order('started_at', { ascending: false })
          .limit(8),
      ]);

      if (metaResult.error) setError(metaResult.error.message);
      setMetadataRows(metaResult.data || []);
      setImportRuns(runResult.data || []);
    }

    loadMetadata();
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    async function loadMatches() {
      setLoading(true);
      setError('');

      let query = supabase
        .from('football_data_matches')
        .select('*', { count: 'exact' })
        .order('match_date', { ascending: false })
        .limit(PAGE_SIZE);

      if (filters.country !== 'all') query = query.eq('country_code', filters.country);
      if (filters.division !== 'all') query = query.eq('division', filters.division);
      if (filters.season !== 'all') query = query.eq('season_code', filters.season);
      if (filters.team.trim()) {
        const term = filters.team.trim().replace(/[%_]/g, '');
        query = query.or(`home_team.ilike.%${term}%,away_team.ilike.%${term}%`);
      }

      const result = await query;
      if (result.error) {
        setError(result.error.message);
        setMatches([]);
        setSelectedMatch(null);
        setTotalCount(0);
      } else {
        setMatches(result.data || []);
        setSelectedMatch((result.data || [])[0] || null);
        setTotalCount(result.count || 0);
      }
      setLoading(false);
    }

    loadMatches();
  }, [filters]);

  const countries = useMemo(() => uniqueOptions(metadataRows, 'country_code', 'country_name'), [metadataRows]);
  const divisions = useMemo(() => {
    const rows = filters.country === 'all'
      ? metadataRows
      : metadataRows.filter((row) => row.country_code === filters.country);
    return uniqueOptions(rows, 'division', 'division_name');
  }, [metadataRows, filters.country]);
  const seasons = useMemo(() => uniqueOptions(metadataRows, 'season_code', 'season_label').sort((a, b) => b.value.localeCompare(a.value)), [metadataRows]);

  const totals = useMemo(() => {
    const goals = matches.reduce((sum, match) => sum + (match.fthg || 0) + (match.ftag || 0), 0);
    const corners = matches.reduce((sum, match) => sum + (match.home_corners || 0) + (match.away_corners || 0), 0);
    const cards = matches.reduce((sum, match) => sum + (match.home_yellow || 0) + (match.away_yellow || 0) + (match.home_red || 0) + (match.away_red || 0), 0);
    return {
      visible: matches.length,
      total: totalCount,
      goals,
      corners,
      cards,
    };
  }, [matches, totalCount]);

  function updateFilter(key, value) {
    setFilters((current) => {
      const next = { ...current, [key]: value };
      if (key === 'country') next.division = 'all';
      return next;
    });
  }

  if (!isSupabaseConfigured) {
    return (
      <main className="app-shell">
        <section className="setup-card">
          <p className="eyebrow">Gerball Football Stats</p>
          <h1>Connect Supabase to start</h1>
          <p>Add your <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> values to <code>.env.local</code>, run the SQL schema, then start the app again.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Gerball Football Stats</p>
          <h1>Football data explorer</h1>
          <p>Browse the imported football-data.co.uk warehouse: historic results, shots, corners, cards, fouls, odds, betting markets and raw CSV fields stored in Supabase.</p>
        </div>
        <div className="hero-card">
          <span>Rows matching filters</span>
          <strong>{totals.total.toLocaleString('en-GB')}</strong>
          <small>Showing latest {totals.visible.toLocaleString('en-GB')} rows</small>
        </div>
      </header>

      <section className="metric-strip">
        <MetricCard label="Goals in loaded rows" value={totals.goals.toLocaleString('en-GB')} />
        <MetricCard label="Corners in loaded rows" value={totals.corners.toLocaleString('en-GB')} />
        <MetricCard label="Cards in loaded rows" value={totals.cards.toLocaleString('en-GB')} />
        <MetricCard label="Imports shown" value={importRuns.length} />
      </section>

      <section className="toolbar data-toolbar">
        <label>
          Country
          <select value={filters.country} onChange={(event) => updateFilter('country', event.target.value)}>
            <option value="all">All countries</option>
            {countries.map((country) => <option key={country.value} value={country.value}>{country.label}</option>)}
          </select>
        </label>
        <label>
          Division
          <select value={filters.division} onChange={(event) => updateFilter('division', event.target.value)}>
            <option value="all">All divisions</option>
            {divisions.map((division) => <option key={division.value} value={division.value}>{division.label}</option>)}
          </select>
        </label>
        <label>
          Season
          <select value={filters.season} onChange={(event) => updateFilter('season', event.target.value)}>
            <option value="all">All seasons</option>
            {seasons.map((season) => <option key={season.value} value={season.value}>{season.label}</option>)}
          </select>
        </label>
        <label>
          Team search
          <input value={filters.team} onChange={(event) => updateFilter('team', event.target.value)} placeholder="Arsenal, Celtic, Barcelona..." />
        </label>
        {loading ? <span className="muted">Loading saved data...</span> : null}
        {error ? <span className="error">{error}</span> : null}
      </section>

      <section className="layout-grid">
        <aside className="match-list-card">
          <div className="section-title">
            <h2>Imported matches</h2>
            <span>{matches.length}</span>
          </div>
          <div className="match-list">
            {matches.map((match) => (
              <button
                className={`match-button ${selectedMatch?.id === match.id ? 'active' : ''}`}
                key={match.id}
                onClick={() => setSelectedMatch(match)}
              >
                <span>{formatDate(match.match_date)} · {match.division_name || match.division} · {match.season_label}</span>
                <strong>{match.home_team} <em>{scoreText(match)}</em> {match.away_team}</strong>
                <small>{resultLabel(match.ftr)} · Corners {numberOrDash(match.home_corners)}-{numberOrDash(match.away_corners)} · Shots {numberOrDash(match.home_shots)}-{numberOrDash(match.away_shots)}</small>
              </button>
            ))}
            {matches.length === 0 ? <p className="muted">No imported football-data.co.uk rows match these filters yet.</p> : null}
          </div>
        </aside>

        <MatchDetails match={selectedMatch} />
      </section>

      <section className="sync-card">
        <div className="section-title">
          <h2>Recent football-data imports</h2>
          <span>{importRuns.length}</span>
        </div>
        <div className="sync-grid">
          {importRuns.map((run) => (
            <div className="sync-run" key={`${run.mode}-${run.started_at}`}>
              <strong>{run.mode} · {run.status}</strong>
              <span>{new Date(run.started_at).toLocaleString('en-GB')}</span>
              <small>{run.rows_imported?.toLocaleString('en-GB')} rows · {run.files_imported}/{run.files_tried} files</small>
              <small>{run.divisions?.join(', ')} · {run.seasons?.join(', ')}</small>
            </div>
          ))}
          {importRuns.length === 0 ? <p className="muted">No football-data import history yet.</p> : null}
        </div>
      </section>
    </main>
  );
}
