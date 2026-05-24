import { useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from './lib/supabaseClient.js';

const PAGE_SIZE = 250;
const TABLE_LIMIT = 1200;
const TABLE_MODES = [
  { value: 'overall', label: 'Overall' },
  { value: 'home', label: 'Home table' },
  { value: 'away', label: 'Away table' },
];

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

function average(total, count, decimals = 2) {
  if (!count) return '-';
  return (total / count).toFixed(decimals);
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

function getTeamMatchView(match, teamName) {
  const isHome = match.home_team === teamName;
  const forGoals = isHome ? match.fthg : match.ftag;
  const againstGoals = isHome ? match.ftag : match.fthg;
  const shotsFor = isHome ? match.home_shots : match.away_shots;
  const shotsAgainst = isHome ? match.away_shots : match.home_shots;
  const cornersFor = isHome ? match.home_corners : match.away_corners;
  const cornersAgainst = isHome ? match.away_corners : match.home_corners;
  const cardsFor = isHome
    ? (match.home_yellow || 0) + (match.home_red || 0)
    : (match.away_yellow || 0) + (match.away_red || 0);
  const cardsAgainst = isHome
    ? (match.away_yellow || 0) + (match.away_red || 0)
    : (match.home_yellow || 0) + (match.home_red || 0);
  const opponent = isHome ? match.away_team : match.home_team;
  let result = '-';

  if (forGoals !== null && forGoals !== undefined && againstGoals !== null && againstGoals !== undefined) {
    if (forGoals > againstGoals) result = 'W';
    else if (forGoals < againstGoals) result = 'L';
    else result = 'D';
  }

  return {
    isHome,
    opponent,
    forGoals,
    againstGoals,
    shotsFor,
    shotsAgainst,
    cornersFor,
    cornersAgainst,
    cardsFor,
    cardsAgainst,
    result,
  };
}

function summariseTeam(teamName, rows) {
  const summary = {
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    home: 0,
    away: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    shotsFor: 0,
    shotsAgainst: 0,
    shotsRows: 0,
    cornersFor: 0,
    cornersAgainst: 0,
    cornerRows: 0,
    cardsFor: 0,
    cardsAgainst: 0,
    recent: [],
  };

  for (const match of rows) {
    const view = getTeamMatchView(match, teamName);
    const hasScore = view.forGoals !== null && view.forGoals !== undefined && view.againstGoals !== null && view.againstGoals !== undefined;
    if (!hasScore) continue;

    summary.played += 1;
    if (view.isHome) summary.home += 1;
    else summary.away += 1;

    if (view.result === 'W') summary.wins += 1;
    if (view.result === 'D') summary.draws += 1;
    if (view.result === 'L') summary.losses += 1;

    summary.goalsFor += view.forGoals || 0;
    summary.goalsAgainst += view.againstGoals || 0;

    if (view.shotsFor !== null && view.shotsFor !== undefined) {
      summary.shotsFor += view.shotsFor || 0;
      summary.shotsAgainst += view.shotsAgainst || 0;
      summary.shotsRows += 1;
    }

    if (view.cornersFor !== null && view.cornersFor !== undefined) {
      summary.cornersFor += view.cornersFor || 0;
      summary.cornersAgainst += view.cornersAgainst || 0;
      summary.cornerRows += 1;
    }

    summary.cardsFor += view.cardsFor || 0;
    summary.cardsAgainst += view.cardsAgainst || 0;
  }

  summary.recent = rows
    .filter((match) => match.fthg !== null && match.fthg !== undefined)
    .slice(0, 10)
    .map((match) => ({ match, view: getTeamMatchView(match, teamName) }));

  return summary;
}

function emptyTableRow(team) {
  return {
    team,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    form: [],
  };
}

function calculateLeagueTable(rows, mode = 'overall') {
  const table = new Map();

  function ensure(team) {
    if (!table.has(team)) table.set(team, emptyTableRow(team));
    return table.get(team);
  }

  function applyResult(team, goalsFor, goalsAgainst) {
    const row = ensure(team);
    row.played += 1;
    row.goalsFor += goalsFor;
    row.goalsAgainst += goalsAgainst;
    row.goalDifference = row.goalsFor - row.goalsAgainst;

    if (goalsFor > goalsAgainst) {
      row.wins += 1;
      row.points += 3;
      row.form.push('W');
    } else if (goalsFor < goalsAgainst) {
      row.losses += 1;
      row.form.push('L');
    } else {
      row.draws += 1;
      row.points += 1;
      row.form.push('D');
    }
  }

  const completed = [...rows]
    .filter((match) => match.home_team && match.away_team && match.fthg !== null && match.fthg !== undefined && match.ftag !== null && match.ftag !== undefined)
    .sort((a, b) => String(a.match_date).localeCompare(String(b.match_date)));

  for (const match of completed) {
    if (mode === 'overall' || mode === 'home') {
      applyResult(match.home_team, match.fthg, match.ftag);
    }
    if (mode === 'overall' || mode === 'away') {
      applyResult(match.away_team, match.ftag, match.fthg);
    }
  }

  return [...table.values()]
    .sort((a, b) => (
      b.points - a.points
      || b.goalDifference - a.goalDifference
      || b.goalsFor - a.goalsFor
      || b.wins - a.wins
      || a.team.localeCompare(b.team)
    ))
    .map((row, index) => ({ ...row, rank: index + 1, form: row.form.slice(-5) }));
}

function getTableResultMatches(rows, teamName, resultType, mode = 'overall') {
  return [...rows]
    .filter((match) => {
      if (match.fthg === null || match.fthg === undefined || match.ftag === null || match.ftag === undefined) return false;
      if (mode === 'home' && match.home_team !== teamName) return false;
      if (mode === 'away' && match.away_team !== teamName) return false;
      if (mode === 'overall' && match.home_team !== teamName && match.away_team !== teamName) return false;
      return getTeamMatchView(match, teamName).result === resultType;
    })
    .sort((a, b) => String(b.match_date).localeCompare(String(a.match_date)));
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

function FormDots({ form }) {
  if (!form?.length) return <span className="muted">-</span>;
  return (
    <span className="form-dots">
      {form.map((item, index) => (
        <span className={`form-badge ${item.toLowerCase()}`} key={`${item}-${index}`}>{item}</span>
      ))}
    </span>
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

function MatchDetails({ match, onTeamSelect }) {
  if (!match) return <div className="empty-panel">Select a match to view shots, corners, cards, odds and raw imported fields.</div>;

  const bettingSummary = match.betting_odds?.summary || {};
  const allOdds = match.betting_odds?.all || {};
  const raw = match.raw || {};

  return (
    <section className="details-card">
      <div className="details-header">
        <div>
          <p className="eyebrow">{match.country_name || 'Football-data.co.uk'} · {match.division_name || match.division} · {match.season_label}</p>
          <h2 className="match-title">
            <button className="team-link" type="button" onClick={() => onTeamSelect(match.home_team)}>{match.home_team}</button>
            <span>{scoreText(match)}</span>
            <button className="team-link" type="button" onClick={() => onTeamSelect(match.away_team)}>{match.away_team}</button>
          </h2>
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

function LeagueTablePanel({ scope, rows, loading, error, onTeamSelect, onMatchSelect }) {
  const [tableMode, setTableMode] = useState('overall');
  const [drilldown, setDrilldown] = useState(null);
  const table = useMemo(() => calculateLeagueTable(rows, tableMode), [rows, tableMode]);
  const playedMatches = rows.filter((match) => match.fthg !== null && match.fthg !== undefined).length;
  const drilldownMatches = drilldown ? getTableResultMatches(rows, drilldown.team, drilldown.result, tableMode) : [];
  const modeLabel = TABLE_MODES.find((mode) => mode.value === tableMode)?.label || 'Overall';

  useEffect(() => {
    setDrilldown(null);
  }, [scope?.division, scope?.season, tableMode]);

  function openDrilldown(team, result) {
    setDrilldown({ team, result });
  }

  return (
    <section className="league-table-card">
      <div className="section-title league-table-title">
        <div>
          <p className="eyebrow">League table</p>
          <h2>{scope?.divisionName || 'Select a division'} {scope?.seasonLabel ? `· ${scope.seasonLabel}` : ''}</h2>
        </div>
        <span>{table.length}</span>
      </div>

      <div className="league-table-controls" role="group" aria-label="League table view">
        {TABLE_MODES.map((mode) => (
          <button
            className={`table-mode-button ${tableMode === mode.value ? 'active' : ''}`}
            key={mode.value}
            type="button"
            onClick={() => setTableMode(mode.value)}
          >
            {mode.label}
          </button>
        ))}
      </div>

      <p className="muted table-help">
        {scope
          ? `${modeLabel} calculated from ${playedMatches} completed imported matches. Click W, D or L totals to display the matching results.`
          : 'Choose a division and season, or select a match, to calculate the table.'}
      </p>

      {loading ? <p className="muted">Loading league table...</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <div className="table-scroll">
        <table className="league-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Team</th>
              <th>P</th>
              <th>W</th>
              <th>D</th>
              <th>L</th>
              <th>GF</th>
              <th>GA</th>
              <th>GD</th>
              <th>Pts</th>
              <th>Form</th>
            </tr>
          </thead>
          <tbody>
            {table.map((row) => (
              <tr key={row.team}>
                <td>{row.rank}</td>
                <td>
                  <button className="table-team-button" type="button" onClick={() => onTeamSelect(row.team)}>{row.team}</button>
                </td>
                <td>{row.played}</td>
                <td><button className="table-stat-button win" type="button" disabled={!row.wins} onClick={() => openDrilldown(row.team, 'W')}>{row.wins}</button></td>
                <td><button className="table-stat-button draw" type="button" disabled={!row.draws} onClick={() => openDrilldown(row.team, 'D')}>{row.draws}</button></td>
                <td><button className="table-stat-button loss" type="button" disabled={!row.losses} onClick={() => openDrilldown(row.team, 'L')}>{row.losses}</button></td>
                <td>{row.goalsFor}</td>
                <td>{row.goalsAgainst}</td>
                <td>{row.goalDifference}</td>
                <td><strong>{row.points}</strong></td>
                <td><FormDots form={row.form} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && table.length === 0 ? <p className="muted empty-table-message">No completed matches found for this table yet.</p> : null}
      </div>

      {drilldown ? (
        <div className="table-drilldown">
          <div className="section-title compact-title">
            <div>
              <p className="eyebrow">{modeLabel}</p>
              <h3>{drilldown.team} · {drilldown.result === 'W' ? 'Wins' : drilldown.result === 'D' ? 'Draws' : 'Losses'} · {drilldownMatches.length}</h3>
            </div>
            <button className="ghost-button" type="button" onClick={() => setDrilldown(null)}>Close</button>
          </div>
          <div className="drilldown-grid">
            {drilldownMatches.map((match) => {
              const view = getTeamMatchView(match, drilldown.team);
              return (
                <button className="drilldown-row" key={match.id} type="button" onClick={() => onMatchSelect(match)}>
                  <span>{formatDate(match.match_date)}</span>
                  <strong>{view.isHome ? 'Home' : 'Away'} v {view.opponent}</strong>
                  <em>{view.forGoals}-{view.againstGoals}</em>
                  <small>{match.division_name || match.division} · {match.season_label}</small>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function TeamPanel({ teamName, rows, loading, error, onClose, onMatchSelect }) {
  if (!teamName) return null;

  const summary = summariseTeam(teamName, rows);

  return (
    <section className="team-card">
      <div className="section-title">
        <div>
          <p className="eyebrow">Team data</p>
          <h2>{teamName}</h2>
        </div>
        <button className="ghost-button" type="button" onClick={onClose}>Close</button>
      </div>

      {loading ? <p className="muted">Loading team history...</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <div className="team-metrics">
        <MetricCard label="Played" value={summary.played} detail={`${summary.home} home · ${summary.away} away`} />
        <MetricCard label="Record" value={`${summary.wins}-${summary.draws}-${summary.losses}`} detail="W-D-L" />
        <MetricCard label="Goals" value={`${summary.goalsFor}-${summary.goalsAgainst}`} detail={`${average(summary.goalsFor, summary.played)} scored per game`} />
        <MetricCard label="Avg corners" value={`${average(summary.cornersFor, summary.cornerRows)}-${average(summary.cornersAgainst, summary.cornerRows)}`} detail="For-against" />
        <MetricCard label="Avg shots" value={`${average(summary.shotsFor, summary.shotsRows)}-${average(summary.shotsAgainst, summary.shotsRows)}`} detail="For-against" />
        <MetricCard label="Cards" value={`${summary.cardsFor}-${summary.cardsAgainst}`} detail="For-against" />
      </div>

      <div className="team-recent">
        <h3>Recent matches</h3>
        <div className="team-match-grid">
          {summary.recent.map(({ match, view }) => (
            <button className="team-match-row" key={match.id} type="button" onClick={() => onMatchSelect(match)}>
              <span className={`form-badge ${view.result.toLowerCase()}`}>{view.result}</span>
              <strong>{formatDate(match.match_date)}</strong>
              <span>{view.isHome ? 'Home' : 'Away'} v {view.opponent}</span>
              <em>{view.forGoals}-{view.againstGoals}</em>
              <small>Corners {numberOrDash(view.cornersFor)}-{numberOrDash(view.cornersAgainst)} · Shots {numberOrDash(view.shotsFor)}-{numberOrDash(view.shotsAgainst)}</small>
            </button>
          ))}
          {!loading && summary.recent.length === 0 ? <p className="muted">No completed matches found for this team under the current filters.</p> : null}
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const [metadataRows, setMetadataRows] = useState([]);
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamMatches, setTeamMatches] = useState([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState('');
  const [tableRows, setTableRows] = useState([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [tableError, setTableError] = useState('');
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

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !selectedTeam) return;

    function applyScope(query) {
      let scoped = query;
      if (filters.country !== 'all') scoped = scoped.eq('country_code', filters.country);
      if (filters.division !== 'all') scoped = scoped.eq('division', filters.division);
      if (filters.season !== 'all') scoped = scoped.eq('season_code', filters.season);
      return scoped;
    }

    async function loadTeamMatches() {
      setTeamLoading(true);
      setTeamError('');

      const selectFields = 'id,country_name,division,division_name,season_code,season_label,match_date,home_team,away_team,fthg,ftag,ftr,home_shots,away_shots,home_shots_target,away_shots_target,home_corners,away_corners,home_fouls,away_fouls,home_yellow,away_yellow,home_red,away_red,avg_home_odds,avg_draw_odds,avg_away_odds,betting_odds,raw';
      const homeQuery = applyScope(
        supabase
          .from('football_data_matches')
          .select(selectFields)
          .eq('home_team', selectedTeam)
          .order('match_date', { ascending: false })
          .limit(600),
      );
      const awayQuery = applyScope(
        supabase
          .from('football_data_matches')
          .select(selectFields)
          .eq('away_team', selectedTeam)
          .order('match_date', { ascending: false })
          .limit(600),
      );

      const [homeResult, awayResult] = await Promise.all([homeQuery, awayQuery]);
      if (homeResult.error || awayResult.error) {
        setTeamError(homeResult.error?.message || awayResult.error?.message || 'Could not load team data.');
        setTeamMatches([]);
      } else {
        const byId = new Map();
        [...(homeResult.data || []), ...(awayResult.data || [])].forEach((match) => byId.set(match.id, match));
        setTeamMatches([...byId.values()].sort((a, b) => String(b.match_date).localeCompare(String(a.match_date))));
      }
      setTeamLoading(false);
    }

    loadTeamMatches();
  }, [selectedTeam, filters.country, filters.division, filters.season]);

  const countries = useMemo(() => uniqueOptions(metadataRows, 'country_code', 'country_name'), [metadataRows]);
  const divisions = useMemo(() => {
    const rows = filters.country === 'all'
      ? metadataRows
      : metadataRows.filter((row) => row.country_code === filters.country);
    return uniqueOptions(rows, 'division', 'division_name');
  }, [metadataRows, filters.country]);
  const seasons = useMemo(() => uniqueOptions(metadataRows, 'season_code', 'season_label').sort((a, b) => b.value.localeCompare(a.value)), [metadataRows]);

  const tableScope = useMemo(() => {
    if (filters.division !== 'all' && filters.season !== 'all') {
      const row = metadataRows.find((item) => item.division === filters.division && item.season_code === filters.season);
      return {
        division: filters.division,
        divisionName: row?.division_name || filters.division,
        season: filters.season,
        seasonLabel: row?.season_label || filters.season,
      };
    }

    if (selectedMatch?.division && selectedMatch?.season_code) {
      return {
        division: selectedMatch.division,
        divisionName: selectedMatch.division_name || selectedMatch.division,
        season: selectedMatch.season_code,
        seasonLabel: selectedMatch.season_label || selectedMatch.season_code,
      };
    }

    return null;
  }, [filters.division, filters.season, metadataRows, selectedMatch]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !tableScope) {
      setTableRows([]);
      return;
    }

    async function loadLeagueTableRows() {
      setTableLoading(true);
      setTableError('');

      const result = await supabase
        .from('football_data_matches')
        .select('id,country_name,division,division_name,season_code,season_label,match_date,home_team,away_team,fthg,ftag,ftr,home_shots,away_shots,home_shots_target,away_shots_target,home_corners,away_corners,home_fouls,away_fouls,home_yellow,away_yellow,home_red,away_red,avg_home_odds,avg_draw_odds,avg_away_odds,betting_odds,raw')
        .eq('division', tableScope.division)
        .eq('season_code', tableScope.season)
        .order('match_date', { ascending: true })
        .limit(TABLE_LIMIT);

      if (result.error) {
        setTableError(result.error.message);
        setTableRows([]);
      } else {
        setTableRows(result.data || []);
      }
      setTableLoading(false);
    }

    loadLeagueTableRows();
  }, [tableScope]);

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

  function handleTeamSelect(teamName) {
    setSelectedTeam(teamName);
    window.setTimeout(() => {
      document.querySelector('.team-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  function handleTeamMatchSelect(match) {
    setSelectedMatch(match);
    window.setTimeout(() => {
      document.querySelector('.details-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
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
          <p>Browse the imported football-data.co.uk warehouse: historic results, league tables, shots, corners, cards, fouls, odds, betting markets and raw CSV fields stored in Supabase.</p>
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

      <LeagueTablePanel
        scope={tableScope}
        rows={tableRows}
        loading={tableLoading}
        error={tableError}
        onTeamSelect={handleTeamSelect}
        onMatchSelect={handleTeamMatchSelect}
      />

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

        <MatchDetails match={selectedMatch} onTeamSelect={handleTeamSelect} />
      </section>

      <TeamPanel
        teamName={selectedTeam}
        rows={teamMatches}
        loading={teamLoading}
        error={teamError}
        onClose={() => setSelectedTeam(null)}
        onMatchSelect={handleTeamMatchSelect}
      />

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
