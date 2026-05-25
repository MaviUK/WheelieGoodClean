(() => {
  const DIVISION_BY_LABEL = {
    'premier league': 'E0', premiership: 'SC0', championship: 'E1', 'league one': 'E2', 'league two': 'E3', 'national league': 'EC',
    bundesliga: 'D1', '2. bundesliga': 'D2', 'serie a': 'I1', 'serie b': 'I2', 'la liga': 'SP1', 'segunda division': 'SP2', 'ligue 1': 'F1', 'ligue 2': 'F2', eredivisie: 'N1', 'jupiler league': 'B1', 'liga i': 'P1', 'ligi 1': 'T1', 'ethniki katigoria': 'G1',
  };

  let lastKey = '';
  let loading = false;

  function getLabelSelect(name) {
    const labels = Array.from(document.querySelectorAll('label'));
    const label = labels.find((item) => {
      const text = Array.from(item.childNodes).find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim())?.textContent.trim().toLowerCase();
      return text === name;
    });
    return label?.querySelector('select') || null;
  }

  function optionValue(select, text) {
    if (!select || !text) return null;
    const normalised = text.trim().toLowerCase();
    return Array.from(select.options).find((item) => item.textContent.trim().toLowerCase() === normalised)?.value || null;
  }

  function seasonCode(label) {
    const m = String(label || '').match(/(19|20)\d{2}\s*\/\s*(\d{2}|(19|20)\d{2})/);
    if (!m) return null;
    const parts = m[0].split('/');
    return `${parts[0].trim().slice(-2)}${parts[1].trim().slice(-2)}`;
  }

  function scope() {
    const divSelect = getLabelSelect('division');
    const seasonSelect = getLabelSelect('season');
    const selectedDiv = divSelect?.value || 'all';
    const selectedSeason = seasonSelect?.value || 'all';
    if (selectedDiv !== 'all' && selectedSeason !== 'all') return { division: selectedDiv, season: selectedSeason };

    const title = document.querySelector('.league-table-card h2')?.textContent || '';
    const [divisionLabel, seasonLabel] = title.split('·').map((part) => part.trim());
    return {
      division: selectedDiv !== 'all' ? selectedDiv : optionValue(divSelect, divisionLabel) || DIVISION_BY_LABEL[String(divisionLabel).toLowerCase()] || null,
      season: selectedSeason !== 'all' ? selectedSeason : optionValue(seasonSelect, seasonLabel) || seasonCode(seasonLabel),
    };
  }

  function bar(label, item, klass) {
    const p = Number(item?.pct || 0);
    return `<div class="gi-bar-row"><span>${label}</span><div><i class="${klass}" style="width:${Math.min(100, p)}%"></i></div><strong>${p.toFixed(1)}%</strong></div>`;
  }

  function scoreList(title, rows) {
    return `<div class="gi-card"><h4>${title}</h4>${(rows || []).map((r, i) => `<p><span>${i + 1}. <b>${r.label}</b></span><em>(${r.count}) ${Number(r.pct).toFixed(1)}%</em></p>`).join('') || '<p>No data</p>'}</div>`;
  }

  function metricCard(title, block) {
    if (!block?.available) return `<div class="gi-card"><h4>${title}</h4><p>No data available</p></div>`;
    return `<div class="gi-card gi-metric"><h4>${title}</h4>
      <div class="gi-big"><strong>${block.total}</strong><span>Total</span></div>
      <p><span>Average</span><em>${block.average}</em></p>
      <p><span>Most</span><em>${block.most?.team || '-'} ${block.most ? `(${block.most.value})` : ''}</em></p>
      <p><span>Least</span><em>${block.least?.team || '-'} ${block.least ? `(${block.least.value})` : ''}</em></p>
      <div class="gi-ou">${(block.overUnder || []).map((x) => `<p><span>O/U ${x.threshold}</span><em>O ${x.overText} · U ${x.underText}</em></p>`).join('')}</div>
    </div>`;
  }

  function resultPanel(title, result, scores) {
    return `<section class="gi-section"><h3>${title}</h3><div class="gi-results">
      ${bar('Home Win', result.homeWin, 'green')}${bar('Draw', result.draw, 'orange')}${bar('Away Win', result.awayWin, 'red')}
    </div><div class="gi-grid four">
      ${scoreList('Home Win Scores', scores.homeWinScores)}${scoreList('Draw Scores', scores.drawScores)}${scoreList('Away Win Scores', scores.awayWinScores)}${scoreList('Top 5 Common Scores', scores.commonScores)}
    </div></section>`;
  }

  function transitionPanel(data) {
    const labels = { winningAtHt: 'Winning at HT → win FT', drawingAtHt: 'Drawing at HT → win FT', losingAtHt: 'Losing at HT → win FT' };
    const cards = (side, obj) => `<div class="gi-card"><h4>${side}</h4>${Object.entries(labels).map(([k, label]) => `<p><span>${label}</span><em>${obj[k]?.text || '0 (0.0%)'}</em></p>`).join('')}</div>`;
    return `<section class="gi-section"><h3>Half-time to Full-time Win Conversion</h3><div class="gi-grid two">${cards('Home teams', data.home)}${cards('Away teams', data.away)}</div></section>`;
  }

  function metricSection(title, data, note = '') {
    return `<section class="gi-section"><h3>${title}</h3>${note ? `<p class="gi-note">${note}</p>` : ''}<div class="gi-grid three">${metricCard('Overall', data.overall)}${metricCard('Home', data.home)}${metricCard('Away', data.away)}</div></section>`;
  }

  function render(payload) {
    const card = document.querySelector('.league-table-card');
    if (!card || !payload?.insights) return;
    document.querySelector('#league-insights-panel')?.remove();
    const x = payload.insights;
    const el = document.createElement('section');
    el.id = 'league-insights-panel';
    el.className = 'league-insights-panel';
    el.innerHTML = `<div class="gi-title"><p class="eyebrow">League insights</p><h2>Detailed league stats</h2><span>${x.matchCount} matches</span></div>
      ${transitionPanel(x.htToFt)}
      ${metricSection('Full-time goals', x.fullTime.goals)}
      ${metricSection('Half-time goals', x.halfTime.goals)}
      ${metricSection('Cards', x.cards)}
      ${metricSection('Fouls', x.fouls, 'Fouls are only available for leagues/seasons where football-data.co.uk includes foul columns.')}
      ${resultPanel('Match Results', x.fullTime.results, x.fullTime.scores)}
      ${resultPanel('Half Time Results', x.halfTime.results, x.halfTime.scores)}`;
    card.insertAdjacentElement('afterend', el);
  }

  async function update() {
    if (loading) return;
    const s = scope();
    if (!s.division || !s.season || s.division === 'all' || s.season === 'all') return;
    const key = `${s.division}|${s.season}`;
    if (key === lastKey && document.querySelector('#league-insights-panel')) return;
    lastKey = key;
    loading = true;
    try {
      const res = await fetch(`/.netlify/functions/league-insights?division=${encodeURIComponent(s.division)}&season=${encodeURIComponent(s.season)}`);
      const payload = await res.json();
      if (payload.ok) render(payload);
    } catch (e) { console.warn('League insights failed', e); }
    finally { loading = false; }
  }

  function schedule() { setTimeout(update, 500); }
  document.addEventListener('change', (e) => { if (e.target.matches('select')) { lastKey = ''; schedule(); } });
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('load', schedule);
})();
