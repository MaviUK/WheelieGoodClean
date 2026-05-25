(() => {
  const MODE_BY_LABEL = {
    overall: 'overall',
    'home table': 'home',
    'away table': 'away',
  };

  let lastKey = '';
  let loading = false;

  function getFilters() {
    const labels = Array.from(document.querySelectorAll('label'));
    const byLabel = (name) => {
      const label = labels.find((item) => {
        const text = Array.from(item.childNodes)
          .find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim())
          ?.textContent.trim().toLowerCase();
        return text === name;
      });
      return label?.querySelector('select')?.value || 'all';
    };

    return {
      division: byLabel('division'),
      season: byLabel('season'),
    };
  }

  function getMode() {
    const active = document.querySelector('.table-mode-button.active');
    return MODE_BY_LABEL[active?.textContent.trim().toLowerCase()] || 'overall';
  }

  function getLeagueTable() {
    return document.querySelector('.league-table');
  }

  function badgeClass(item) {
    if (item === 'W') return 'w';
    if (item === 'D') return 'd';
    if (item === 'L') return 'l';
    return '';
  }

  function ppgClass(ppg) {
    if (ppg >= 1.7) return 'good';
    if (ppg >= 1.2) return 'ok';
    return 'bad';
  }

  function renderStatsTable(payload) {
    const table = getLeagueTable();
    if (!table || !payload?.table?.length) return;

    table.classList.add('extended-league-table');
    table.innerHTML = `
      <thead>
        <tr>
          <th>#</th>
          <th>Team</th>
          <th>Form</th>
          <th>P</th>
          <th>W</th>
          <th>D</th>
          <th>L</th>
          <th>F</th>
          <th>A</th>
          <th>GD</th>
          <th>PTS</th>
          <th>PPG</th>
          <th>CS</th>
          <th>BTTS</th>
          <th>O1.5</th>
          <th>O2.5</th>
          <th>🟨 / 🟥</th>
        </tr>
      </thead>
      <tbody>
        ${payload.table.map((row) => `
          <tr>
            <td>${row.rank}</td>
            <td><button class="table-team-button" type="button">${row.team}</button></td>
            <td><span class="form-dots">${row.form.map((item) => `<span class="form-badge ${badgeClass(item)}">${item}</span>`).join('')}</span></td>
            <td>${row.played}</td>
            <td>${row.wins}</td>
            <td>${row.draws}</td>
            <td>${row.losses}</td>
            <td>${row.goalsFor}</td>
            <td>${row.goalsAgainst}</td>
            <td>${row.goalDifference}</td>
            <td><strong>${row.points}</strong></td>
            <td><span class="ppg-pill ${ppgClass(row.ppg)}">${row.ppg.toFixed(2)}</span></td>
            <td>${row.cleanSheetsText}</td>
            <td>${row.bttsText}</td>
            <td>${row.over15Text}</td>
            <td>${row.over25Text}</td>
            <td><span class="card-rate">🟨 ${row.yellowPerGame.toFixed(1)} / 🟥 ${row.redPerGame.toFixed(1)}</span></td>
          </tr>
        `).join('')}
      </tbody>
    `;
  }

  async function updateExtendedStats() {
    if (loading) return;

    const table = getLeagueTable();
    if (!table) return;

    const filters = getFilters();
    const mode = getMode();
    if (!filters.division || !filters.season || filters.division === 'all' || filters.season === 'all') return;

    const key = `${filters.division}|${filters.season}|${mode}`;
    if (key === lastKey) return;
    lastKey = key;
    loading = true;

    try {
      const response = await fetch(`/.netlify/functions/league-table-stats?division=${encodeURIComponent(filters.division)}&season=${encodeURIComponent(filters.season)}&mode=${encodeURIComponent(mode)}`);
      const payload = await response.json();
      if (payload.ok) renderStatsTable(payload);
    } catch (error) {
      console.warn('Extended league stats failed:', error);
    } finally {
      loading = false;
    }
  }

  function scheduleUpdate() {
    window.setTimeout(updateExtendedStats, 250);
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('.table-mode-button')) scheduleUpdate();
  });
  document.addEventListener('change', (event) => {
    if (event.target.matches('select')) {
      lastKey = '';
      scheduleUpdate();
    }
  });

  const observer = new MutationObserver(scheduleUpdate);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('load', scheduleUpdate);
})();
