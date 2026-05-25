(() => {
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct = (item) => item?.text || '0 (0%)';
  let currentKey = '';
  let tableMode = 'fullAll';

  function teamFromUrl() {
    const match = location.pathname.match(/\/team\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  function selectedOpponent() {
    return document.querySelector('#tp-opponent')?.value || null;
  }

  function selectedKeys() {
    const params = new URLSearchParams(location.search);
    if (params.get('selections')) return params.get('selections').split(',').filter(Boolean);
    if (params.get('division') && params.get('season')) return [`${params.get('division')}:${params.get('season')}`];
    return Array.from(document.querySelectorAll('.tp-season-choice.active')).map((button) => button.dataset.key).filter(Boolean);
  }

  function row(label, obj) {
    return `<tr><th>${label}</th><td>${pct(obj.overall)}</td><td>${pct(obj.home)}</td><td>${pct(obj.away)}</td></tr>`;
  }

  function resultBox(d) {
    return `<section class="tp-card"><h2>H2H Match Results</h2><table class="tp-results"><thead><tr><th></th><th>Overall</th><th>Home</th><th>Away</th></tr></thead><tbody>
      <tr><th>Matches</th><td>${d.matches.overall.text}</td><td>${d.matches.home.text}</td><td>${d.matches.away.text}</td></tr>
      <tr><th>Points</th><td>${d.points.overall.text}</td><td>${d.points.home.text}</td><td>${d.points.away.text}</td></tr>
      ${row('Wins',d.wins)}${row('Draws',d.draws)}${row('Losses',d.losses)}${row('Half Time Wins',d.htWins)}${row('Half Time Draws',d.htDraws)}${row('Half Time Losses',d.htLosses)}${row('Clean Sheets',d.cleanSheets)}${row('BTTS',d.btts)}${row('HT BTTS',d.htBtts)}
    </tbody></table></section>`;
  }

  function leagueTable(rows, activeTeam) {
    return `<table class="tp-league"><thead><tr><th>Pos</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr></thead><tbody>${(rows || []).map((r) => `<tr class="${r.team===activeTeam?'active':''}"><td>${r.pos}</td><td>${esc(r.team)}</td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf}</td><td>${r.ga}</td><td>${r.gd}</td><td>${r.pts}</td></tr>`).join('')}</tbody></table>`;
  }

  function leagueBox(data) {
    const rows = data.analysis.leagueTables[tableMode] || [];
    return `<section class="tp-card"><h2>H2H Table</h2><div class="tp-tabs h2h-tabs">
      ${['fullAll','fullHome','fullAway','halfAll'].map((key) => `<button data-h2h-table="${key}" class="${tableMode===key?'active':''}">${key==='fullAll'?'Full All':key==='fullHome'?'Home':key==='fullAway'?'Away':'Half Time'}</button>`).join('')}
    </div>${leagueTable(rows, data.team)}</section>`;
  }

  function formBadge(x) { return `<span class="tp-form ${String(x).toLowerCase()}">${x}</span>`; }
  function streakCard(title, obj, cls) { return `<div class="tp-streak ${cls}"><span>${title}</span><strong>${obj.best}</strong><small>Current: ${obj.current}</small></div>`; }
  function formBox(form) {
    return `<section class="tp-section"><h2>H2H Form & Streaks</h2><div class="tp-formline">${form.overall.form.map(formBadge).join('')}</div>
      <div class="tp-grid three">${streakCard('Most Wins in a Row',form.overall.wins,'win')}${streakCard('Most Draws in a Row',form.overall.draws,'draw')}${streakCard('Most Losses in a Row',form.overall.losses,'loss')}</div>
      <div class="tp-grid six">${streakCard('Home Wins',form.home.wins,'win')}${streakCard('Home Draws',form.home.draws,'draw')}${streakCard('Home Losses',form.home.losses,'loss')}${streakCard('Away Wins',form.away.wins,'win')}${streakCard('Away Draws',form.away.draws,'draw')}${streakCard('Away Losses',form.away.losses,'loss')}</div></section>`;
  }

  function goalsBox(g) {
    return `<section class="tp-section"><h2>H2H Goals</h2><div class="tp-grid two"><div class="tp-card"><h2>Full Time Goals</h2><p>Total Goals Scored: ${g.ft.scored}</p><p>Goals When Home: ${g.ft.homeScored}</p><p>Goals When Away: ${g.ft.awayScored}</p><p>Total Goals Conceded: ${g.ft.conceded}</p><p>Goals Conceded at Home: ${g.ft.homeConceded}</p><p>Goals Conceded Away: ${g.ft.awayConceded}</p></div><div class="tp-card"><h2>Half Time Goals</h2><p>HT Goals Scored: ${g.ht.scored}</p><p>HT Goals When Home: ${g.ht.homeScored}</p><p>HT Goals When Away: ${g.ht.awayScored}</p><p>HT Goals Conceded: ${g.ht.conceded}</p><p>HT Goals Conceded Home: ${g.ht.homeConceded}</p><p>HT Goals Conceded Away: ${g.ht.awayConceded}</p></div></div></section>`;
  }

  function htPanel(title, p) {
    const sub = (name, o) => `<div class="tp-ht-sub"><h4>${name}</h4><p>Win at FT <b>${o.wins.text}</b></p><p>Draw at FT <b>${o.draws.text}</b></p><p>Loss at FT <b>${o.losses.text}</b></p></div>`;
    return `<div class="tp-card"><h2>${title}</h2><p>${p.overall.matches} matches</p>${sub('Overall',p.overall)}${sub('Home',p.home)}${sub('Away',p.away)}</div>`;
  }

  function scoreList(title, list) {
    return `<div class="tp-card"><h3>${title}</h3>${(list || []).map((x) => `<p><b>${x.score}</b><span>${x.count} matches</span><em>${x.pct}%</em></p>`).join('') || '<p>No data</p>'}</div>`;
  }

  function scoreBox(s) {
    return `<section class="tp-section"><h2>H2H Score Analysis</h2><div class="tp-grid four">${scoreList('Home FT Scores',s.homeFt)}${scoreList('Home HT Scores',s.homeHt)}${scoreList('Away FT Scores',s.awayFt)}${scoreList('Away HT Scores',s.awayHt)}</div></section>`;
  }

  function ouTable(title, data) {
    const make = (label, block) => `<h3>${label} (${block.matches} Matches)</h3><div class="tp-ou"><div></div>${block.thresholds.map((t) => `<b>${t}</b>`).join('')}${['tgo','tgu','mgo','mgu'].map((k) => `<strong>${k.toUpperCase()}</strong>${block[k].map((v) => `<span class="${v>=75?'green':v>=50?'amber':''}">${Math.round(v)}%</span>`).join('')}`).join('')}</div>`;
    return `<section class="tp-card wide"><h2>${title}</h2>${make('Home',data.home)}${make('Away',data.away)}</section>`;
  }

  function shotsBox(s) {
    const box = (title,x) => `<div class="tp-card"><h2>${title}</h2><p>Total Shots: ${x.shots}</p><p>Shots on Target: ${x.target}</p><p>Shot Accuracy: ${x.accuracy}%</p><p>Opponent Shots: ${x.against}</p><p>Average Shots: ${x.average}</p></div>`;
    return `<section class="tp-section"><h2>H2H Shots Analysis</h2><div class="tp-grid two">${box('Home Shots',s.home)}${box('Away Shots',s.away)}</div></section>`;
  }

  function disciplineBox(d) {
    const b = (t,x) => `<div class="tp-card"><h2>${t}</h2><p>Total: ${x.total}</p><p>Average: ${x.avg} per game</p><p>Home: ${x.home}</p><p>Away: ${x.away}</p></div>`;
    return `<section class="tp-section"><h2>H2H Discipline</h2><div class="tp-grid three">${b('Fouls',d.fouls)}${b('Yellow Cards',d.yellow)}${b('Red Cards',d.red)}</div></section>`;
  }

  function historyBox(history) {
    return `<section class="tp-card wide"><h2>H2H Match History</h2>${(history || []).map((m) => `<div class="tp-match"><strong>${esc(m.homeTeam)} ${m.fthg} - ${m.ftag} ${esc(m.awayTeam)}</strong><span>${m.date}</span><small>HT: ${m.hthg}-${m.htag} · Shots: ${m.shots} · Corners: ${m.corners} · Cards: ${m.cards}</small></div>`).join('') || '<p>No matches found.</p>'}</section>`;
  }

  function render(data) {
    document.querySelector('#h2h-full-analysis')?.remove();
    const target = document.querySelector('#tp-opponent')?.closest('.tp-section');
    if (!target) return;
    const x = data.analysis;
    const el = document.createElement('section');
    el.id = 'h2h-full-analysis';
    el.className = 'tp-section h2h-full-analysis';
    el.innerHTML = `<h2>Full H2H Analysis: ${esc(data.team)} vs ${esc(data.opponent)}</h2><p class="tp-muted">${data.matches} matches from the selected season set.</p><div class="tp-grid two top">${resultBox(x.resultTable)}${leagueBox(data)}</div>${formBox(x.form)}${goalsBox(x.goals)}<section class="tp-grid three">${htPanel('Leading at HT',x.htPanels.leading)}${htPanel('Drawing at HT',x.htPanels.drawing)}${htPanel('Losing at HT',x.htPanels.losing)}</section>${scoreBox(x.scoreAnalysis)}${ouTable('H2H Goals Over/Under',x.overUnder.goals)}${ouTable('H2H Corners Over/Under',x.overUnder.corners)}${shotsBox(x.shots)}${ouTable('H2H Cards Over/Under',x.overUnder.cards)}${disciplineBox(x.discipline)}${historyBox(data.history)}`;
    target.insertAdjacentElement('afterend', el);
    el.querySelectorAll('[data-h2h-table]').forEach((button) => button.addEventListener('click', () => {
      tableMode = button.dataset.h2hTable;
      render(data);
    }));
  }

  async function load() {
    const team = teamFromUrl();
    const opponent = selectedOpponent();
    if (!team || !opponent) return;
    const keys = selectedKeys();
    const key = `${team}|${opponent}|${keys.join(',')}|${tableMode}`;
    if (key === currentKey && document.querySelector('#h2h-full-analysis')) return;
    currentKey = key;
    const params = new URLSearchParams();
    params.set('team', team);
    params.set('opponent', opponent);
    if (keys.length) params.set('selections', keys.join(','));
    const res = await fetch(`/.netlify/functions/h2h-analysis?${params}`);
    const data = await res.json();
    if (data.ok) render(data);
  }

  function schedule() { setTimeout(load, 500); }
  document.addEventListener('change', (event) => {
    if (event.target?.id === 'tp-opponent') {
      currentKey = '';
      tableMode = 'fullAll';
      schedule();
    }
  });
  document.addEventListener('click', (event) => {
    if (event.target?.id === 'tp-apply-seasons') {
      currentKey = '';
      schedule();
    }
  });
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('load', schedule);
})();
