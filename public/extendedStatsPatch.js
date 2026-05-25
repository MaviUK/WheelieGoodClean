(() => {
  const MODE_BY_LABEL = {
    overall: 'overall',
    'home table': 'home',
    'away table': 'away',
  };

  const DIVISION_BY_LABEL = {
    'premier league': 'E0',
    premiership: 'SC0',
    championship: 'E1',
    'league one': 'E2',
    'league two': 'E3',
    'national league': 'EC',
    bundesliga: 'D1',
    '2. bundesliga': 'D2',
    'serie a': 'I1',
    'serie b': 'I2',
    'la liga': 'SP1',
    'segunda division': 'SP2',
    'ligue 1': 'F1',
    'ligue 2': 'F2',
    eredivisie: 'N1',
    'jupiler league': 'B1',
    'liga i': 'P1',
    'ligi 1': 'T1',
    'ethniki katigoria': 'G1',
  };

  let lastKey = '';
  let loading = false;

  function getLabelSelect(name) {
    const labels = Array.from(document.querySelectorAll('label'));
    const label = labels.find((item) => {
      const text = Array.from(item.childNodes)
        .find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim())
        ?.textContent.trim().toLowerCase();
      return text === name;
    });
    return label?.querySelector('select') || null;
  }

  function valueFromOptionText(select, text) {
    if (!select || !text) return null;
    const normalised = text.trim().toLowerCase();
    const option = Array.from(select.options).find((item) => item.textContent.trim().toLowerCase() === normalised);
    return option?.value || null;
  }

  function seasonCodeFromLabel(label) {
    if (!label) return null;
    const match = label.match(/(19|20)\d{2}\s*\/\s*(\d{2}|(19|20)\d{2})/);
    if (!match) return null;
    const startYear = Number.parseInt(match[0].split('/')[0].trim(), 10);
    const endPart = match[0].split('/')[1].trim();
    const endYear = endPart.length === 2 ? Number.parseInt(endPart, 10) : Number.parseInt(endPart.slice(-2), 10);
    return `${String(startYear).slice(-2)}${String(endYear).padStart(2, '0')}`;
  }

  function getTitleScope() {
    const title = document.querySelector('.league-table-card h2')?.textContent || '';
    const [divisionLabelRaw, seasonLabelRaw] = title.split('·').map((part) => part.trim());
    if (!divisionLabelRaw || !seasonLabelRaw) return {};

    const divisionSelect = getLabelSelect('division');
    const seasonSelect = getLabelSelect('season');
    const divisionFromOption = valueFromOptionText(divisionSelect, divisionLabelRaw);
    const seasonFromOption = valueFromOptionText(seasonSelect, seasonLabelRaw);

    return {
      division: divisionFromOption || DIVISION_BY_LABEL[divisionLabelRaw.toLowerCase()] || null,
      season: seasonFromOption || seasonCodeFromLabel(seasonLabelRaw) || null,
    };
  }

  function getFilters() {
    const divisionSelect = getLabelSelect('division');
    const seasonSelect = getLabelSelect('season');
    const selected = {
      division: divisionSelect?.value || 'all',
      season: seasonSelect?.value || 'all',
    };

    if (selected.division !== 'all' && selected.season !== 'all') return selected;

    const titleScope = getTitleScope();
    return {
      division: selected.division !== 'all' ? selected.division : titleScope.division || selected.division,
      season: selected.season !== 'all' ? selected.season : titleScope.season || selected.season,
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
          <th>Y/R</th>
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
            <td><span class="card-rate">${row.yellowPerGame.toFixed(1)} / ${row.redPerGame.toFixed(1)}</span></td>
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
    if (key === lastKey && table.classList.contains('extended-league-table')) return;
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
    window.setTimeout(updateExtendedStats, 350);
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('.table-mode-button')) {
      lastKey = '';
      scheduleUpdate();
    }
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
