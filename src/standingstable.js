/**
 * The league's standings table: one renderer for the home page and Season Statistics (plan D40, D61).
 *
 * Shipped as a literal source string (STANDINGS_JS), never a function's toString() (the bundler
 * rewrites named functions), and run as plain browser script: the home page appends it to its client script, and
 * Season Statistics' tool shell loads it before its bundle (scripts/build.mjs). It defines one global,
 * window.EFTStandings.render(host, data, opts).
 *
 * The markup is the home page's table as it was (classes, medals, owner line, the Playoffs line in standings
 * order, Clinched / Eliminated, sorting that replaces only the rows, the drawn scroller), with three more columns
 * (All-play, Luck, Power) and a row of small info buttons under the headings; a column's note opens beside its
 * heading over the page, drawn like a panel's note (.stnote).
 *
 * data: { rows: [{ team, seed, w, l, t, winPct, pf, pa, diff, ppg, streak: { type, n } | null, playoffPct, simPct,
 *         allPlay: { w, l, t, share } | null, luck, power }], teams: { id: { name, logo, owner } },
 *         places, sim (whether to show Sim %), mine (the chosen team's id, the home page only: D69) }
 */
import { PTS_JS, LOGO_FALLBACK_SVG } from './ui.js';

/** Every column's note (plan D26: one per column). */
export const STANDINGS_NOTES = {
  rank: 'The playoff seed: by record, ties broken by points for. The top places reach the playoffs; after the regular season the seed is final.',
  name: 'The team, with its owner beneath.',
  record: 'Wins, losses and ties.',
  winPct: 'Share of games won; a tie counts as half a win.',
  pointsFor: 'Points for: every point the team has scored.',
  pointsAgainst: 'Points against: every point scored against the team.',
  diff: 'Points for minus points against.',
  ppg: 'Points per week played. A two-week postseason matchup counts as two weeks.',
  streak: 'The current run of wins (W) or losses (L).',
  playoffPct: 'ESPN’s chance of reaching the playoffs. On Season Statistics, an After week view shows the figure ESPN gave after that week, as the site recorded it.',
  simPct: 'Fortune Teller’s exact chance of reaching the playoffs, counted over every way the rest of the season can go.',
  allPlay: 'The record the team would have if it had played every other team every week.',
  luck: 'Wins the team has, minus the wins its scores earned against the whole league (its all-play win share × games played). Above zero: more wins than its scores deserved.',
  power: 'The power ranking, out of 100: half the season’s all-play win share, a quarter its win share, and a quarter its all-play win share over the last three weeks.',
};

/** The table's own rules, beside the shared table in src/ui.js (moved here from the home page's stylesheet). */
export const STANDINGS_CSS = `
    .medal { display:inline-flex; align-items:center; justify-content:center;
             width:22px; height:22px; border-radius:50%; font-size:10px;
             font-weight:900; color:var(--field); }
    .medal.g { background:var(--gold); box-shadow:0 0 12px -2px var(--gold-glow); }
    .medal.s { background:#C8D2D6; }
    .medal.b { background:#CD8A4D; color:#1C1206; }
    /* Silver is light enough that the site's own ink disappears on it in the
       light theme; the number is set dark on that one badge only. */
    .medal.s { color:#1C2B24; }
    .stflag { display:inline-block; font-size:8.5px; font-weight:900; letter-spacing:.11em;
              text-transform:uppercase; padding:3px 8px; border:1px solid currentColor; }
    .stflag.in { color:var(--accent); }
    .stflag.out { color:var(--flag); }
    .stupd { opacity:.55; }
    /* The line under the last playoff place, drawn as Fortune Teller draws it. */
    table.stbl tr.porow td { padding:0; height:20px; border:0; position:relative; background:transparent; }
    table.stbl tr.porow td::before { content:""; position:absolute; left:0; right:0; top:50%; height:1px;
      background:repeating-linear-gradient(90deg,var(--accent) 0 7px,transparent 7px 11px); opacity:.9; }
    table.stbl tr.porow td span { position:absolute; left:10px; top:50%; transform:translateY(-50%); z-index:2; display:inline-flex; align-items:center; gap:6px; padding:0 7px 0 5px;
      font-size:7.5px; font-weight:900; letter-spacing:.18em; text-transform:uppercase; color:var(--accent); background:var(--panel); line-height:1; }
    table.stbl tr.porow td span i { width:6px; height:6px; background:var(--accent); transform:rotate(45deg); box-shadow:0 0 8px var(--accent-glow); }
    /* Fourteen columns fit the site's measure on a desktop with a little less room either side of each. */
    table.stbl th, table.stbl td { padding-left:12px; padding-right:12px; }
    .stbl tr.me td { background:var(--accent-glow); }
    /* The chosen team's owner line, on its green row, takes the full ink to reach 4.5:1 in the dark theme. */
    .stbl tr.me .stnamewrap em { color:var(--ink); }
    .stbl .tklogo { width:19px; height:19px; object-fit:contain; flex:none; }
    /* The row of notes under the headings. */
    table.stbl thead tr:first-child th { border-bottom:0; padding-bottom:3px; }
    table.stbl thead tr.stinforow th { padding:0 6px 8px; cursor:default; }
    .stinfo { width:15px; height:15px; padding:0; border-radius:50%; border:1px solid var(--line-2); background:none; color:var(--ink-3);
      font:900 8.5px/13px ui-sans-serif, system-ui, sans-serif; cursor:pointer; transition:color .16s ease, border-color .16s ease; }
    .stinfo:hover, .stinfo[aria-expanded="true"] { color:var(--accent); border-color:var(--accent); }
    .stinfo:focus-visible { outline:2px solid var(--sky); outline-offset:2px; }
    .stnote { position:fixed; z-index:70; background:var(--panel); border:1px solid var(--accent); padding:9px 10px;
      font-size:10.5px; line-height:1.45; color:var(--ink-2); text-align:left; box-shadow:0 8px 22px rgba(0,0,0,.34);
      font-family:inherit; max-width:calc(100vw - 24px); }
    .stnote::before { content:""; position:absolute; top:-6px; left:calc(var(--arrow, 50%) - 5px); width:9px; height:9px;
      background:var(--panel); border-left:1px solid var(--accent); border-top:1px solid var(--accent); transform:rotate(45deg); }
    .stnote b { display:block; margin-bottom:3px; font-size:9px; font-weight:900; letter-spacing:.16em; text-transform:uppercase; color:var(--accent); }
`;

export const STANDINGS_JS = `
(function () {
  if (window.EFTStandings) return;
${PTS_JS}
  var SHIELD = ${JSON.stringify(LOGO_FALLBACK_SVG)};
  var NOTES = ${JSON.stringify(STANDINGS_NOTES)};
  var COLS = [
    { key: 'rank', label: 'Seed', dir: 1 },
    { key: 'name', label: 'Team', dir: 1, cls: 'col-team' },
    { key: 'record', label: 'Record', dir: -1 },
    { key: 'winPct', label: 'Win%', dir: -1 },
    { key: 'pointsFor', label: 'PF', dir: -1 },
    { key: 'pointsAgainst', label: 'PA', dir: -1 },
    { key: 'diff', label: 'Diff', dir: -1 },
    { key: 'ppg', label: 'PPG', dir: -1 },
    { key: 'streak', label: 'Strk', dir: -1 },
    { key: 'playoffPct', label: 'Playoff%', dir: -1 },
    { key: 'simPct', label: 'Sim%', dir: -1 },
    { key: 'allPlay', label: 'All-play', dir: -1 },
    { key: 'luck', label: 'Luck', dir: -1 },
    { key: 'power', label: 'Power', dir: -1 }
  ];
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function pct1(x) { return (Math.round(x * 1000 + 1e-6) / 10).toFixed(1) + '%'; }
  function logo(url, alt) {
    if (!url) return '<span class="tklogo lgo lgofail">' + SHIELD + '</span>';
    return '<span class="tklogo lgo"><img src="' + esc(url) + '" alt="' + esc(alt) + '" referrerpolicy="no-referrer" loading="lazy" onerror="this.hidden=true">' + SHIELD + '</span>';
  }
  function medal(rank) {
    if (rank === 1) return '<span class="medal g" title="First">1</span>';
    if (rank === 2) return '<span class="medal s" title="Second">2</span>';
    if (rank === 3) return '<span class="medal b" title="Third">3</span>';
    return String(rank);
  }
  /* At the extremes the number has stopped being a probability: Clinched or Eliminated instead. */
  function odds(v) {
    if (v == null) return '<span class="dim">&mdash;</span>';
    if (v >= 0.9995) return '<span class="stflag in">Clinched</span>';
    if (v <= 0.0005) return '<span class="stflag out">Eliminated</span>';
    return '<span class="stpct">' + pct1(v) + '</span>';
  }
  function value(r, key, teams) {
    if (key === 'rank') return r.seed;
    if (key === 'name') return String((teams[r.team] || {}).name || '').toLowerCase();
    if (key === 'record') return r.w * 1000 - r.l + (r.t || 0) * 0.5;
    if (key === 'winPct') return r.winPct;
    if (key === 'pointsFor') return r.pf;
    if (key === 'pointsAgainst') return r.pa;
    if (key === 'diff') return r.diff;
    if (key === 'ppg') return r.ppg;
    if (key === 'streak') return r.streak ? (r.streak.type === 'W' ? 1 : -1) * r.streak.n : -999;
    if (key === 'playoffPct') return r.playoffPct == null ? -1 : r.playoffPct;
    if (key === 'simPct') return r.simPct == null ? -1 : r.simPct;
    if (key === 'allPlay') return r.allPlay ? r.allPlay.share : -1;
    if (key === 'luck') return r.luck == null ? -999 : r.luck;
    if (key === 'power') return r.power == null ? -1 : r.power;
    return 0;
  }
  function signed(x, two) {
    var t = two ? Math.abs(x).toFixed(2) : pts2(Math.abs(x));
    return (x >= 0 ? '+' : '\\u2212') + t;
  }

  /* The same drawn scroller Hall of Fame uses: the native one hides itself when idle, so a table with more to the
     right looked like a table that ended there. */
  function wireScrollBox(host) {
    var wrap = host.querySelector('.scrollwrap');
    if (!wrap || wrap._wired) return;
    wrap._wired = true;
    var real = wrap.querySelector('.scrollreal'), bar = wrap.querySelector('.sbar'), thumb = wrap.querySelector('.sbar-thumb');
    if (!real || !bar || !thumb) return;
    var drag = null, frame = 0;
    function layout() {
      var cw = real.clientWidth, sw = real.scrollWidth;
      if (sw <= cw + 1) { bar.hidden = true; return; }
      bar.hidden = false;
      var barW = bar.clientWidth || cw;
      var tw = Math.max(32, Math.round(barW * (cw / sw)));
      thumb.style.width = tw + 'px';
      var max = sw - cw;
      thumb.style.transform = 'translateX(' + (max > 0 ? (real.scrollLeft / max) * (barW - tw) : 0) + 'px)';
    }
    function schedule() { if (frame) return; frame = requestAnimationFrame(function () { frame = 0; layout(); }); }
    real.addEventListener('scroll', layout);
    window.addEventListener('resize', schedule);
    if (typeof ResizeObserver === 'function') { try { new ResizeObserver(schedule).observe(real); } catch (e) { /* not fatal */ } }
    thumb.addEventListener('pointerdown', function (e) {
      drag = { x: e.clientX, left: real.scrollLeft, tw: thumb.offsetWidth, barW: bar.clientWidth };
      bar.classList.add('dragging');
      try { thumb.setPointerCapture(e.pointerId); } catch (err) { /* not fatal */ }
      e.preventDefault(); e.stopPropagation();
    });
    thumb.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var travel = Math.max(1, drag.barW - drag.tw);
      real.scrollLeft = drag.left + ((e.clientX - drag.x) / travel) * (real.scrollWidth - real.clientWidth);
      layout(); e.preventDefault();
    });
    function release(e) { if (!drag) return; drag = null; bar.classList.remove('dragging'); try { thumb.releasePointerCapture(e.pointerId); } catch (err) { /* not fatal */ } }
    thumb.addEventListener('pointerup', release);
    thumb.addEventListener('pointercancel', release);
    bar.addEventListener('pointerdown', function (e) {
      if (e.target === thumb) return;
      var r = bar.getBoundingClientRect();
      real.scrollLeft = ((e.clientX - r.left) / Math.max(1, r.width)) * (real.scrollWidth - real.clientWidth);
      layout();
    });
    layout();
    setTimeout(layout, 120);
  }

  /* One note open at a time, over the page beside its button; Escape, a click elsewhere or the button closes it. */
  var open = null;
  function closeNote(focus) {
    if (!open) return;
    var o = open; open = null;
    if (o.el.parentNode) o.el.parentNode.removeChild(o.el);
    o.btn.setAttribute('aria-expanded', 'false');
    window.removeEventListener('scroll', o.place, true);
    window.removeEventListener('resize', o.place);
    document.removeEventListener('pointerdown', o.down, true);
    document.removeEventListener('keydown', o.key, true);
    if (focus) o.btn.focus({ preventScroll: true });
  }
  function openNote(btn, title, text) {
    closeNote(false);
    var el = document.createElement('div');
    el.className = 'stnote';
    el.setAttribute('role', 'note');
    el.innerHTML = '<b>' + esc(title) + '</b>' + esc(text);
    (btn.closest('[data-theme]') || document.body).appendChild(el);
    if (el.parentNode !== document.body && getComputedStyle(el).position !== 'fixed') document.body.appendChild(el);
    function place() {
      var r = btn.getBoundingClientRect();
      var w = Math.min(260, window.innerWidth - 24);
      var left = Math.max(12, Math.min(window.innerWidth - 12 - w, r.left + r.width / 2 - w / 2));
      el.style.width = w + 'px'; el.style.left = left + 'px'; el.style.top = (r.bottom + 8) + 'px';
      el.style.setProperty('--arrow', (r.left + r.width / 2 - left) + 'px');
    }
    function down(e) { if (!el.contains(e.target) && e.target !== btn) closeNote(false); }
    function key(e) { if (e.key === 'Escape') { e.stopPropagation(); closeNote(true); } }
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', key, true);
    btn.setAttribute('aria-expanded', 'true');
    open = { el: el, btn: btn, place: place, down: down, key: key };
  }

  function render(host, data, opts) {
    if (!host) return;
    opts = opts || {};
    var st = host._st || (host._st = { sort: { key: 'rank', dir: 1 } });
    st.data = data;
    var rows0 = (data && data.rows) || [];
    var teams = (data && data.teams) || {};
    if (!rows0.length) {
      var e = (data && data.empty) || { title: 'Standings unavailable', note: 'They appear once the league is set up.' };
      host.innerHTML = '<div class="placeholder"><b>' + esc(e.title) + '</b><span>' + esc(e.note) + '</span></div>';
      return;
    }
    var cols = COLS.filter(function (c) { return c.key !== 'simPct' || data.sim; });
    if (!cols.some(function (c) { return c.key === st.sort.key; })) st.sort = { key: 'rank', dir: 1 };
    var s = st.sort;
    var rows = rows0.slice().sort(function (a, b) {
      var av = value(a, s.key, teams), bv = value(b, s.key, teams);
      if (av < bv) return -1 * s.dir;
      if (av > bv) return 1 * s.dir;
      return (a.seed || 0) - (b.seed || 0);
    });
    var head = '<tr>' + cols.map(function (c) {
      var on = s.key === c.key;
      return '<th class="' + (c.cls || '') + '" aria-sort="' + (on ? (s.dir === 1 ? 'ascending' : 'descending') : 'none') + '" data-sort="' + c.key + '">' +
        '<span class="lbl">' + esc(c.label) + '</span><span class="arrow">' + (on && s.dir === 1 ? '\\u25B2' : '\\u25BC') + '</span></th>';
    }).join('') + '</tr><tr class="stinforow">' + cols.map(function (c) {
      return '<th class="' + (c.cls || '') + '"><button type="button" class="stinfo" data-note="' + c.key + '" aria-expanded="false" aria-label="What ' + esc(c.label) + ' means">i</button></th>';
    }).join('') + '</tr>';
    var places = Number(data.places) || 0;
    var body = rows.map(function (r) {
      var t = teams[r.team] || { name: 'Team ' + r.team };
      var ap = r.allPlay;
      return '<tr class="' + (data.mine != null && Number(data.mine) === Number(r.team) ? 'me' : '') + '">' +
        '<td class="c-rank">' + medal(r.seed) + '</td>' +
        '<td class="col-team"><div class="stname">' + logo(t.logo, t.name) + '<div class="stnamewrap"><b>' + esc(t.name) + '</b>' +
          (t.owner ? '<em>' + esc(t.owner) + '</em>' : '') + '</div></div></td>' +
        '<td class="c-key">' + r.w + '-' + r.l + '-' + (r.t || 0) + '</td>' +
        '<td class="c-key">' + (r.winPct * 100).toFixed(1) + '%</td>' +
        '<td class="c-num">' + pts2(r.pf) + '</td>' +
        '<td class="c-num">' + pts2(r.pa) + '</td>' +
        '<td class="' + (r.diff >= 0 ? 'c-pos' : 'c-neg') + '">' + signed(r.diff) + '</td>' +
        '<td class="c-num">' + pts2(r.ppg) + '</td>' +
        '<td class="' + (!r.streak ? 'c-muted' : (r.streak.type === 'W' ? 'c-pos' : 'c-neg')) + '">' + (r.streak ? esc(r.streak.type + r.streak.n) : '\\u2014') + '</td>' +
        '<td class="c-num">' + odds(r.playoffPct) + '</td>' +
        (data.sim ? '<td class="c-num">' + (data.simUpdating ? '<span class="stupd" title="Updating for the week just played">' + odds(r.simPct) + '</span>' : odds(r.simPct)) + '</td>' : '') +
        '<td class="c-key">' + (ap ? ap.w + '-' + ap.l + '-' + (ap.t || 0) : '<span class="dim">&mdash;</span>') + '</td>' +
        (r.luck == null ? '<td class="c-muted">\\u2014</td>' : '<td class="' + (r.luck >= 0 ? 'c-pos' : 'c-neg') + '">' + signed(r.luck, true) + '</td>') +
        '<td class="c-num">' + (r.power == null ? '<span class="dim">&mdash;</span>' : Number(r.power).toFixed(1)) + '</td>' +
        '</tr>' +
        /* The line under the last playoff place, in standings order only: sorted any other way it would mark nothing. */
        (s.key === 'rank' && s.dir === 1 && places && r.seed === places && places < rows.length
          ? '<tr class="porow" aria-hidden="true"><td colspan="' + cols.length + '"><span><i></i>Playoffs</span></td></tr>' : '');
    }).join('');
    /* Sorting replaces the rows, never the scrolling element: rebuilding the scroller would throw the reader back
       to the left edge on every click. */
    closeNote(false);
    var table = host.querySelector('.scrollreal table.stbl');
    if (table) table.innerHTML = '<thead>' + head + '</thead><tbody>' + body + '</tbody>';
    else {
      host.innerHTML = '<div class="scrollwrap"><div class="sbar" hidden><div class="sbar-thumb"></div></div>' +
        '<div class="scrollreal"><table class="datatable stbl">' + '<thead>' + head + '</thead><tbody>' + body + '</tbody></table></div></div>';
      wireScrollBox(host);
      host.addEventListener('click', function (ev) {
        var info = ev.target.closest ? ev.target.closest('.stinfo') : null;
        if (info) {
          ev.stopPropagation();
          if (open && open.btn === info) { closeNote(false); return; }
          var c = COLS.filter(function (x) { return x.key === info.getAttribute('data-note'); })[0];
          if (c) openNote(info, c.label, NOTES[c.key] || '');
          return;
        }
        var th = ev.target.closest ? ev.target.closest('th[data-sort]') : null;
        if (!th || !host.contains(th)) return;
        var key = th.getAttribute('data-sort');
        var col = COLS.filter(function (x) { return x.key === key; })[0];
        if (!col) return;
        var cur = host._st.sort;
        host._st.sort = cur.key === key ? { key: key, dir: -cur.dir } : { key: key, dir: col.dir };
        render(host, host._st.data, opts);
      });
    }
  }
  window.EFTStandings = { render: render, notes: NOTES };
})();
`;
