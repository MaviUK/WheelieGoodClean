# Gerball Football Stats

A Netlify + Supabase starter for collecting API-FOOTBALL match data once or twice per day instead of polling live matches.

The important design choice is that the sync stores:

1. **Raw API JSON** in `raw_api_responses`, so you keep everything API-FOOTBALL returns.
2. **Normalized tables** for the dashboard: fixtures, events, team statistics, lineups, player match stats and standings.

## What this collects

The evening sync is built around API-FOOTBALL's efficient `fixtures?ids=` approach. It first finds completed matches, then requests detailed fixture bundles in groups of up to 20 fixture IDs.

The schema is ready for:

- fixtures and results
- goals and timing
- cards and timing
- substitutions and timing
- team match statistics: corners, shots, cards, possession, passes, saves and more
- lineups
- player match statistics
- standings
- raw endpoint payloads for future use

Coverage depends on the competition and season. Some lower leagues may not have all statistics, so the app stores `null` where the API does not provide a value.

## Local setup

### 1. Create the Supabase database

Open your Supabase project, go to **SQL Editor**, and run:

```sql
-- paste the contents of supabase/schema.sql
```

The schema also seeds a starter set of competitions for the 2025/26 season:

- Premier League
- Championship
- League One
- League Two
- National League
- La Liga
- Serie A
- Bundesliga
- Ligue 1
- Champions League
- Europa League
- Conference League

To add more English or European leagues later, insert rows into `tracked_leagues`.

### 2. Add environment variables

Copy `.env.example` to `.env.local` for local development:

```bash
cp .env.example .env.local
```

Fill in:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
API_FOOTBALL_KEY=
SYNC_SECRET=
```

Use the service role key only in Netlify Functions. Never expose it in browser code.

### 3. Install and run

```bash
npm install
npm run dev
```

For testing Netlify Functions locally:

```bash
npm install -g netlify-cli
netlify dev
```

Then trigger a manual sync:

```bash
curl "http://localhost:8888/.netlify/functions/sync-manual?mode=evening&key=YOUR_SYNC_SECRET"
```

Or run a morning fixtures/upcoming sync:

```bash
curl "http://localhost:8888/.netlify/functions/sync-manual?mode=morning&key=YOUR_SYNC_SECRET"
```

## Deploy to Netlify

1. Push this folder to GitHub.
2. Create a new Netlify site from the repository.
3. Add the environment variables in **Site configuration > Environment variables**.
4. Deploy.

Netlify will run scheduled functions from `netlify.toml`:

- `sync-morning`: 07:00 UTC daily
- `sync-evening`: 22:30 UTC daily

Netlify cron schedules use UTC. Adjust `netlify.toml` if you want different UK times during GMT/BST.

## Useful function URLs

After deployment:

```text
/.netlify/functions/sync-manual?mode=morning&key=YOUR_SYNC_SECRET
/.netlify/functions/sync-manual?mode=evening&key=YOUR_SYNC_SECRET
/.netlify/functions/discover-leagues?country=England&season=2025
/.netlify/functions/discover-leagues?country=Spain&season=2025
```

`discover-leagues` helps find exact league IDs and coverage flags before you add more leagues to `tracked_leagues`.

## Request budget notes

The default starter tracks 12 competitions. A normal morning sync is around 24 calls because it fetches fixtures and standings for each league. A busier evening sync can use more calls because completed fixtures are then requested in chunks of 20 IDs.

If you are staying on API-FOOTBALL's 100 requests/day free plan, reduce `tracked_leagues` at first or disable standings calls until the project is working.

## Next improvements

- Add admin login for managing tracked leagues.
- Add a historical backfill job that processes one league at a time.
- Add top scorers, top assists, top yellow cards and top red cards snapshots.
- Add team pages and player pages.
- Add filters for corners, shots, cards and both-teams-to-score research.
