(() => {
  const state = { data: null, table: 'fullAll', opponent: null, selectedKeys: [] };
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct = (item) => item?.text || '0 (0%)';

  function qs(name) { return new URLSearchParams(location.search).get(name); }
  function teamFromUrl() {
    const m = location.pathname.match(/\/team\/([^/?#]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

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

  function navigateToTeam(team, event) {
    if (!team) return;
    event?.preventDefault();
    event?.stopPropagation();
    event?.stopImmediatePropagation?.();

    const params = new URLSearchParams();
    const div = getLabelSelect('division')?.value;
    const season = getLabelSelect('season')?.value;
    if (div && div !== 'all') params.set('division', div);
    if (season && season !== 'all') params.set('season', season);

    window.location.assign(`/team/${encodeURIComponent(team)}${params.toString() ? `?${params}` : ''}`);
  }

  function linkTeamButtons() {
    document.querySelectorAll('.league-table .table-team-button').forEach((btn) => {
      if (btn.dataset.teamLinked) return;
      btn.dataset.teamLinked = '1';
      btn.style.cursor = 'pointer';
      btn.title = `Open ${btn.textContent.trim()} team page`;
      btn.addEventListener('click', (event) => navigateToTeam(btn.textContent.trim(), event), true);
    });
  }

  function setupLeagueTableClickNavigation() {
    linkTeamButtons();
    document.addEventListener('click', (event) => {
      const btn = event.target.closest?.('.league-table .table-team-button');
      if (btn) navigateToTeam(btn.textContent.trim(), event);
    }, true);
    const observer = new MutationObserver(linkTeamButtons);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('load', linkTeamButtons);
  }

  function row(label, obj) {
    return `<tr><th>${label}</th><td>${pct(obj.overall)}</td><td>${pct(obj.home)}</td><td>${pct(obj.away)}</td></tr>`;
  }

  function resultBox(d) {
    return `<section class="tp-card"><h2>Match Results</h2><table class="tp-results"><thead><tr><th></th><th>Overall</th><th>Home</th><th>Away</th></tr></thead><tbody>
      <tr><th>Matches</th><td>${d.matches.overall.text}</td><td>${d.matches.home.text}</td><td>${d.matches.away.text}</td></tr>
      <tr><th>Points</th><td>${d.points.overall.text}</td><td>${d.points.home.text}</td><td>${d.points.away.text}</td></tr>
      ${row('Wins',d.wins)}${row('Draws',d.draws)}${row('Losses',d.losses)}${row('Half Time Wins',d.htWins)}${row('Half Time Draws',d.htDraws)}${row('Half Time Losses',d.htLosses)}${row('Clean Sheets',d.cleanSheets)}${row('BTTS',d.btts)}${row('HT BTTS',d.htBtts)}
    </tbody></table></section>`;
  }

  function leagueTable(rows, activeTeam) {
    return `<table class="tp-league"><thead><tr><th>Pos</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>Pts</th></tr></thead><tbody>${rows.map(r=>`<tr class="${r.team===activeTeam?'active':''}"><td>${r.pos}</td><td>${esc(r.team)}</td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.pts}</td></tr>`).join('')}</tbody></table>`;
  }

  function leagueBox(data) {
    const rows = data.leagueTables[state.table] || [];
    return `<section class="tp-card"><h2>League Table</h2><p class="tp-muted small">For multi-season selections this table combines the selected seasons.</p><div class="tp-tabs">
      ${['fullAll','halfAll','fullAway'].map(k=>`<button data-table="${k}" class="${state.table===k?'active':''}">${k==='fullAll'?'Full Time':k==='halfAll'?'Half Time':'Away'}</button>`).join('')}
    </div>${leagueTable(rows,data.team)}</section>`;
  }

  function formBadge(x) { return `<span class="tp-form ${x.toLowerCase()}">${x}</span>`; }
  function streakCard(title, obj, cls) { return `<div class="tp-streak ${cls}"><span>${title}</span><strong>${obj.best}</strong><small>Current: ${obj.current}</small></div>`; }
  function formBox(form) {
    return `<section class="tp-section"><h2>Season Form</h2><div class="tp-formline">${form.overall.form.map(formBadge).join('')}</div>
      <div class="tp-grid three">${streakCard('Most Wins in a Row',form.overall.wins,'win')}${streakCard('Most Draws in a Row',form.overall.draws,'draw')}${streakCard('Most Losses in a Row',form.overall.losses,'loss')}</div>
      <h3>Home Streaks / Away Streaks</h3><div class="tp-grid six">${streakCard('Home Wins',form.home.wins,'win')}${streakCard('Home Draws',form.home.draws,'draw')}${streakCard('Home Losses',form.home.losses,'loss')}${streakCard('Away Wins',form.away.wins,'win')}${streakCard('Away Draws',form.away.draws,'draw')}${streakCard('Away Losses',form.away.losses,'loss')}</div></section>`;
  }

  function goalsBox(g) {
    return `<section class="tp-section"><h2>Match Statistics</h2><div class="tp-grid two"><div class="tp-card"><h2>Full Time Goals</h2><p>Total Goals Scored: ${g.ft.scored}</p><p>Goals When Home: ${g.ft.homeScored}</p><p>Goals When Away: ${g.ft.awayScored}</p><p>Total Goals Conceded: ${g.ft.conceded}</p><p>Goals Conceded at Home: ${g.ft.homeConceded}</p><p>Goals Conceded Away: ${g.ft.awayConceded}</p></div><div class="tp-card"><h2>Half Time Goals</h2><p>Half Time Goals When Home: ${g.ht.homeScored}</p><p>Half Time Goals When Away: ${g.ht.awayScored}</p><p>Half Time Goals Conceded at Home: ${g.ht.homeConceded}</p><p>Half Time Goals Conceded Away: ${g.ht.awayConceded}</p></div></div></section>`;
  }

  function htPanel(title, p) {
    const sub = (name, o) => `<div class="tp-ht-sub"><h4>${name}</h4><p>Win at FT <b>${o.wins.text}</b></p><p>Draw at FT <b>${o.draws.text}</b></p><p>Loss at FT <b>${o.losses.text}</b></p></div>`;
    return `<div class="tp-card"><h2>${title}</h2><p>${p.overall.matches} matches</p>${sub('Overall',p.overall)}${sub('Home',p.home)}${sub('Away',p.away)}</div>`;
  }

  function scoreList(title, list) { return `<div class="tp-card"><h3>${title}</h3>${list.map(x=>`<p><b>${x.score}</b><span>${x.count} matches</span><em>${x.pct}%</em></p>`).join('')}</div>`; }
  function scoreBox(s) { return `<section class="tp-section"><h2>Team Score Analysis</h2><div class="tp-grid four">${scoreList('Home FT Scores',s.homeFt)}${scoreList('Home HT Scores',s.homeHt)}${scoreList('Away FT Scores',s.awayFt)}${scoreList('Away HT Scores',s.awayHt)}</div></section>`; }

  function ouTable(title, data) {
    const make = (label, block) => `<h3>${label} (${block.matches} Matches)</h3><div class="tp-ou"><div></div>${block.thresholds.map(t=>`<b>${t}</b>`).join('')}${['tgo','tgu','mgo','mgu'].map(k=>`<strong>${k.toUpperCase()}</strong>${block[k].map(v=>`<span class="${v>=75?'green':v>=50?'amber':''}">${Math.round(v)}%</span>`).join('')}`).join('')}</div>`;
    return `<section class="tp-card wide"><h2>${title}</h2>${make('Home',data.home)}${make('Away',data.away)}</section>`;
  }

  function shotsBox(s) { const box=(title,x)=>`<div class="tp-card"><h2>${title}</h2><p>Total Shots: ${x.shots}</p><p>Shots on Target: ${x.target}</p><p>Shot Accuracy: ${x.accuracy}%</p><p>Opponent Shots: ${x.against}</p><p>Average Shots: ${x.average}</p></div>`; return `<section class="tp-section"><h2>Detailed Shots Analysis</h2><div class="tp-grid two">${box('Home Shots Analysis',s.home)}${box('Away Shots Analysis',s.away)}</div></section>`; }
  function disciplineBox(d) { const b=(t,x)=>`<div class="tp-card"><h2>${t}</h2><p>Total: ${x.total}</p><p>Average: ${x.avg} per game</p><p>Home: ${x.home}</p><p>Away: ${x.away}</p></div>`; return `<section class="tp-section"><h2>Discipline</h2><div class="tp-grid three">${b('Fouls',d.fouls)}${b('Yellow Cards',d.yellow)}${b('Red Cards',d.red)}</div></section>`; }

  function h2hBox(h) {
    const opp = state.opponent || h.opponents[0]; state.opponent = opp;
    const rows = h.byOpponent[opp]?.matches || [];
    return `<section class="tp-section"><h2>Head to Head Analysis</h2><select id="tp-opponent">${h.opponents.map(o=>`<option ${o===opp?'selected':''}>${esc(o)}</option>`).join('')}</select><div class="tp-card wide"><h2>Match History</h2>${rows.map(m=>`<div class="tp-match"><strong>${esc(m.homeTeam)} ${m.fthg} - ${m.ftag} ${esc(m.awayTeam)}</strong><span>${m.date}</span><small>HT: ${m.hthg}-${m.htag} · Shots: ${m.shots} · Corners: ${m.corners} · Cards: ${m.cards}</small></div>`).join('')}</div></section>`;
  }

  function buildParams(team, keys) {
    const params = new URLSearchParams();
    params.set('team', team);
    if (keys?.length) params.set('selections', keys.join(','));
    return params;
  }

  function selectedKeysFromUrl() {
    const selections = qs('selections');
    if (selections) return selections.split(',').map((key) => key.trim()).filter(Boolean);
    if (qs('division') && qs('season')) return [`${qs('division')}:${qs('season')}`];
    return [];
  }

  function seasonSelector(data) {
    const selected = new Set(data.selectedKeys || []);
    return `<section class="tp-seasons"><div class="tp-season-head"><h2>Select Seasons</h2><div><button id="tp-select-all" type="button">Select All</button><button id="tp-clear-selection" type="button">Clear Selection</button><button id="tp-apply-seasons" type="button">Apply Selection</button></div></div><p class="tp-muted">Select one or more seasons, then apply. Stats below are combined across selected seasons.</p><div class="tp-season-list">${data.seasons.map(s=>`<button class="tp-season-choice ${selected.has(s.key)?'active':''}" type="button" data-key="${esc(s.key)}"><span>${esc(s.seasonLabel)}</span><small>${esc(s.divisionName)}</small></button>`).join('')}</div></section>`;
  }

  function attachTeamPageEvents(data) {
    document.querySelectorAll('[data-table]').forEach(b=>b.addEventListener('click',()=>{state.table=b.dataset.table; document.querySelector('.tp-grid.two.top').innerHTML=resultBox(data.resultTable)+leagueBox(data); attachTeamPageEvents(data); }));
    document.querySelector('#tp-opponent')?.addEventListener('change',e=>{state.opponent=e.target.value; document.querySelector('#tp-opponent').closest('.tp-section').outerHTML=h2hBox(data.h2h); attachTeamPageEvents(data);});

    document.querySelectorAll('.tp-season-choice').forEach((button) => {
      button.addEventListener('click', () => {
        button.classList.toggle('active');
      });
    });
    document.querySelector('#tp-select-all')?.addEventListener('click', () => document.querySelectorAll('.tp-season-choice').forEach((button) => button.classList.add('active')));
    document.querySelector('#tp-clear-selection')?.addEventListener('click', () => document.querySelectorAll('.tp-season-choice').forEach((button) => button.classList.remove('active')));
    document.querySelector('#tp-apply-seasons')?.addEventListener('click', () => {
      let keys = Array.from(document.querySelectorAll('.tp-season-choice.active')).map((button) => button.dataset.key).filter(Boolean);
      if (!keys.length) keys = data.selectedKeys?.length ? data.selectedKeys : [data.seasons[0]?.key].filter(Boolean);
      const params = new URLSearchParams();
      params.set('selections', keys.join(','));
      window.location.assign(`/team/${encodeURIComponent(data.team)}?${params}`);
    });
  }

  async function loadTeamPage() {
    const team = teamFromUrl(); if (!team) return false;
    document.body.classList.add('team-page-active');
    document.querySelector('#root').innerHTML = '<main class="team-page"><h1>Loading team page...</h1></main>';
    const params = buildParams(team, selectedKeysFromUrl());
    const res = await fetch(`/.netlify/functions/team-page-stats?${params}`); const data = await res.json(); state.data = data; state.selectedKeys = data.selectedKeys || [];
    if (!data.ok) { document.querySelector('#root').innerHTML = `<main class="team-page"><h1>${esc(team)}</h1><p>${esc(data.error)}</p></main>`; return true; }
    document.querySelector('#root').innerHTML = `<main class="team-page"><a class="tp-back" href="/">← Back to league table</a><h1>${esc(data.team)}</h1><p class="tp-muted">${esc(data.selectedLabel || `${data.divisionName} · ${data.seasonLabel}`)}</p>${seasonSelector(data)}<div class="tp-grid two top">${resultBox(data.resultTable)}${leagueBox(data)}</div>${h2hBox(data.h2h)}${formBox(data.form)}${goalsBox(data.goals)}<section class="tp-grid three">${htPanel('Leading at HT',data.htPanels.leading)}${htPanel('Drawing at HT',data.htPanels.drawing)}${htPanel('Losing at HT',data.htPanels.losing)}</section>${scoreBox(data.scoreAnalysis)}${ouTable('Goals Over/Under',data.overUnder.goals)}${ouTable('Corners Over/Under',data.overUnder.corners)}${shotsBox(data.shots)}${ouTable('Cards Over/Under',data.overUnder.cards)}${disciplineBox(data.discipline)}</main>`;
    attachTeamPageEvents(data);
    return true;
  }

  loadTeamPage()
    .then((isTeamPage) => {
      if (!isTeamPage) setupLeagueTableClickNavigation();
    })
    .catch((error) => {
      console.warn('Team page patch failed:', error);
      setupLeagueTableClickNavigation();
    });
})();
