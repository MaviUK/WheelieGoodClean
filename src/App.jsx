import { useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from './lib/supabaseClient.js';

function formatDate(value) {
  if (!value) return 'TBC';
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function scoreText(fixture) {
  if (fixture.home_goals === null || fixture.home_goals === undefined) return 'vs';
  return `${fixture.home_goals} - ${fixture.away_goals}`;
}

function isComplete(status) {
  return ['FT', 'AET', 'PEN'].includes(status);
}

function StatPill({ label, home, away }) {
  return (
    <div className="stat-pill">
      <span>{label}</span>
      <strong>{home ?? '-'}</strong>
      <em>{away ?? '-'}</em>
    </div>
  );
}

function MatchDetails({ fixture }) {
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState([]);
  const [lineups, setLineups] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!fixture?.api_fixture_id || !supabase) return;

    async function loadDetails() {
      setLoading(true);
      const [eventsResult, statsResult, lineupsResult] = await Promise.all([
        supabase
          .from('fixture_events')
          .select('*')
          .eq('api_fixture_id', fixture.api_fixture_id)
          .order('time_elapsed', { ascending: true }),
        supabase
          .from('fixture_statistics')
          .select('*')
          .eq('api_fixture_id', fixture.api_fixture_id),
        supabase
          .from('fixture_lineups')
          .select('*')
          .eq('api_fixture_id', fixture.api_fixture_id),
      ]);

      setEvents(eventsResult.data || []);
      setStats(statsResult.data || []);
      setLineups(lineupsResult.data || []);
      setLoading(false);
    }

    loadDetails();
  }, [fixture]);

  const homeStats = stats.find((row) => row.team_id === fixture?.home_team_id) || {};
  const awayStats = stats.find((row) => row.team_id === fixture?.away_team_id) || {};

  if (!fixture) return <div className="empty-panel">Select a match to view details.</div>;

  return (
    <section className="details-card">
      <div className="details-header">
        <div>
          <p className="eyebrow">{fixture.league_name} · {fixture.league_round}</p>
          <h2>{fixture.home_team_name} {scoreText(fixture)} {fixture.away_team_name}</h2>
          <p>{formatDate(fixture.kickoff_at)} · {fixture.status_long || fixture.status_short || 'Scheduled'}</p>
        </div>
      </div>

      {loading ? <p className="muted">Loading match details...</p> : null}

      <div className="stats-grid">
        <StatPill label="Shots" home={homeStats.total_shots} away={awayStats.total_shots} />
        <StatPill label="On target" home={homeStats.shots_on_goal} away={awayStats.shots_on_goal} />
        <StatPill label="Corners" home={homeStats.corner_kicks} away={awayStats.corner_kicks} />
        <StatPill label="Possession" home={homeStats.ball_possession} away={awayStats.ball_possession} />
        <StatPill label="Yellow cards" home={homeStats.yellow_cards} away={awayStats.yellow_cards} />
        <StatPill label="Red cards" home={homeStats.red_cards} away={awayStats.red_cards} />
      </div>

      <div className="two-column-details">
        <div>
          <h3>Timeline</h3>
          {events.length === 0 ? (
            <p className="muted">No event timeline saved yet.</p>
          ) : (
            <div className="timeline">
              {events.map((event) => (
                <div className="timeline-row" key={event.id}>
                  <span>{event.time_elapsed}{event.time_extra ? `+${event.time_extra}` : ''}'</span>
                  <strong>{event.event_type}</strong>
                  <p>{event.team_name} · {event.player_name || 'Unknown'} · {event.detail}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3>Lineups</h3>
          {lineups.length === 0 ? (
            <p className="muted">No lineup data saved yet.</p>
          ) : (
            <div className="lineups">
              {lineups.map((lineup) => (
                <div className="lineup-card" key={lineup.id}>
                  <strong>{lineup.team_name}</strong>
                  <span>{lineup.formation || 'Formation TBC'}</span>
                  <small>{lineup.start_xi?.length || 0} starters · {lineup.substitutes?.length || 0} subs</small>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const [leagues, setLeagues] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState('all');
  const [fixtures, setFixtures] = useState([]);
  const [selectedFixture, setSelectedFixture] = useState(null);
  const [syncRuns, setSyncRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    async function loadInitialData() {
      setLoading(true);
      setError('');

      const today = new Date();
      const start = new Date(today);
      start.setUTCDate(start.getUTCDate() - 2);
      const end = new Date(today);
      end.setUTCDate(end.getUTCDate() + 7);

      const [leagueResult, fixtureResult, runResult] = await Promise.all([
        supabase.from('tracked_leagues').select('*').eq('is_active', true).order('priority'),
        supabase
          .from('fixtures')
          .select('*')
          .gte('kickoff_at', start.toISOString())
          .lte('kickoff_at', end.toISOString())
          .order('kickoff_at', { ascending: true })
          .limit(200),
        supabase
          .from('sync_runs')
          .select('mode, started_at, finished_at, status, leagues_processed, fixtures_seen, fixtures_detailed, api_calls, error')
          .order('started_at', { ascending: false })
          .limit(5),
      ]);

      if (leagueResult.error) setError(leagueResult.error.message);
      if (fixtureResult.error) setError(fixtureResult.error.message);

      setLeagues(leagueResult.data || []);
      setFixtures(fixtureResult.data || []);
      setSyncRuns(runResult.data || []);
      setSelectedFixture((fixtureResult.data || [])[0] || null);
      setLoading(false);
    }

    loadInitialData();
  }, []);

  const filteredFixtures = useMemo(() => {
    if (selectedLeague === 'all') return fixtures;
    return fixtures.filter((fixture) => String(fixture.api_league_id) === selectedLeague);
  }, [fixtures, selectedLeague]);

  const totals = useMemo(() => {
    const completed = filteredFixtures.filter((fixture) => isComplete(fixture.status_short)).length;
    return {
      fixtures: filteredFixtures.length,
      completed,
      upcoming: filteredFixtures.length - completed,
    };
  }, [filteredFixtures]);

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
          <h1>Football match data warehouse</h1>
          <p>Daily API-FOOTBALL syncs into Supabase: fixtures, results, goals, cards, corners, shots, lineups, player stats and raw JSON.</p>
        </div>
        <div className="hero-card">
          <span>Fixtures loaded</span>
          <strong>{totals.fixtures}</strong>
          <small>{totals.completed} completed · {totals.upcoming} upcoming</small>
        </div>
      </header>

      <section className="toolbar">
        <label>
          League
          <select value={selectedLeague} onChange={(event) => setSelectedLeague(event.target.value)}>
            <option value="all">All tracked leagues</option>
            {leagues.map((league) => (
              <option key={`${league.api_league_id}-${league.season}`} value={league.api_league_id}>
                {league.name} {league.season}
              </option>
            ))}
          </select>
        </label>
        {loading ? <span className="muted">Loading saved data...</span> : null}
        {error ? <span className="error">{error}</span> : null}
      </section>

      <section className="layout-grid">
        <aside className="match-list-card">
          <div className="section-title">
            <h2>Matches</h2>
            <span>{filteredFixtures.length}</span>
          </div>
          <div className="match-list">
            {filteredFixtures.map((fixture) => (
              <button
                className={`match-button ${selectedFixture?.api_fixture_id === fixture.api_fixture_id ? 'active' : ''}`}
                key={fixture.api_fixture_id}
                onClick={() => setSelectedFixture(fixture)}
              >
                <span>{formatDate(fixture.kickoff_at)}</span>
                <strong>{fixture.home_team_name} <em>{scoreText(fixture)}</em> {fixture.away_team_name}</strong>
                <small>{fixture.league_name} · {fixture.status_short || 'NS'}</small>
              </button>
            ))}
            {filteredFixtures.length === 0 ? <p className="muted">No fixtures saved yet. Run the manual sync after setup.</p> : null}
          </div>
        </aside>

        <MatchDetails fixture={selectedFixture} />
      </section>

      <section className="sync-card">
        <div className="section-title">
          <h2>Recent sync runs</h2>
          <span>{syncRuns.length}</span>
        </div>
        <div className="sync-grid">
          {syncRuns.map((run) => (
            <div className="sync-run" key={`${run.mode}-${run.started_at}`}>
              <strong>{run.mode} · {run.status}</strong>
              <span>{new Date(run.started_at).toLocaleString('en-GB')}</span>
              <small>{run.api_calls} API calls · {run.fixtures_seen} fixtures · {run.fixtures_detailed} detailed</small>
              {run.error ? <p className="error">{run.error}</p> : null}
            </div>
          ))}
          {syncRuns.length === 0 ? <p className="muted">No sync history yet.</p> : null}
        </div>
      </section>
    </main>
  );
}
