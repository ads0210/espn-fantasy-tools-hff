/**
 * Login and dashboard surfaces.
 *
 * Rendered by the Worker rather than served as static assets, so no publicly
 * reachable static file exists at all. Everything under /public stays behind
 * the League Password.
 */

import { shell, passwordField, displayTitle, selectField, esc, LOGO_FALLBACK_SVG, TEAM_COOKIE }
  from './ui.js';

export { THEME_COOKIE, TEAM_COOKIE } from './ui.js';

export function loginPage({ leagueName, season, theme, reduceMotion, error }) {
  const rail = `
    <p class="eyebrow">Members only</p>
    ${displayTitle(leagueName || 'Fantasy Football', { sub: season ? `${season} Season` : '' })}`;

  const body = `
    <div class="panel reveal">
      <span class="ghostnum">10</span>
      ${passwordField({
        id: 'pw', label: 'League Password', autofocus: true,
        autocomplete: 'current-password',
      })}
      <button class="primary" id="go">Enter</button>
      <div class="msg ${error ? 'err' : ''}" id="msg">${esc(error || '')}</div>
      <p class="note" style="text-align:left">Don't have it? Ask whoever runs your league.</p>
    </div>`;

  const js = `
var pw = document.getElementById('pw'), go = document.getElementById('go'), msg = document.getElementById('msg');
function fail(t) {
  msg.textContent = t; msg.className = 'msg err';
  go.disabled = false; go.textContent = 'Enter'; pw.select();
}
async function submit() {
  if (!pw.value) { fail('Enter the League Password.'); return; }
  go.disabled = true; go.textContent = 'Checking'; msg.className = 'msg';
  try {
    var res = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: pw.value })
    });
    var data = await res.json().catch(function () { return {}; });
    if (res.ok && data.ok) { location.href = data.next || '/'; return; }
    fail(data.error || 'That password was not correct.');
  } catch (e) { fail('Could not reach the server. Try again.'); }
}
go.addEventListener('click', submit);
pw.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });`;

  return shell({ title: leagueName || 'ESPN Fantasy Tools', theme, reduceMotion,
                 rail, body, centred: true, extraJs: js,
    instructions: [
      ['01', 'One password for the league',
       'Everyone in the league signs in with the same League Password. Whoever set the site up has it.'],
      ['02', 'Type it, do not paste it',
       'The field is deliberately paste-proof, and the eye icon reveals what you typed so a stray character cannot lock you out.'],
      ['03', 'Nothing loads until you are in',
       'This page fetches nothing from ESPN and shows no league data. That is why it says so little before you sign in.'],
      ['04', 'Trouble getting in',
       'Repeated wrong attempts are slowed down from your connection. Wait a moment and try again, or ask whoever runs the site.'],
    ] });
}

const TOOL_ICONS = {
  // A draft board: a column of picks with the next slot marked. Deliberately
  // not a trophy, which belongs to standings and playoff tools.
  'draft-helper': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 8.5h18M3 14h18"/><path d="M8.5 3v18"/><path d="M12 11.2h5.5M12 16.8h4"/><circle cx="5.7" cy="11.2" r="1"/><circle cx="5.7" cy="16.8" r="1"/></svg>',
  // Two lineups facing each other across a live scoreline: the bracket on each
  // side is a team's stack of players, the pulse between them is the game being
  // played. Deliberately not a clock or a broadcast tower — the subject is the
  // matchup, not the fact that it is live.
  'live-matchups': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 4.2h-3v15.6h3"/><path d="M17.5 4.2h3v15.6h-3"/><path d="M2.2 12h2.4M19.4 12h2.4"/><path d="M8 12h1.6l1.1-3 1.9 6 1.2-3H16"/><circle cx="12" cy="20" r="1.05"/><circle cx="12" cy="4" r="1.05"/></svg>',
  // A trophy on its plinth, with handles and an engraved band. The record book
  // covers every team rather than only the winners, but the name on the tile
  // says Hall of Fame, and a glyph that argues with its own label just reads as
  // the wrong icon.
  'hall-of-fame': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7.4 3.2h9.2v5.4a4.6 4.6 0 0 1-9.2 0z"/><path d="M7.4 4.9H4.9v1.8a3.1 3.1 0 0 0 3.1 3.1"/><path d="M16.6 4.9h2.5v1.8a3.1 3.1 0 0 1-3.1 3.1"/><path d="M12 13.2v3.1"/><path d="M8.9 20.8h6.2l-.7-4.5H9.6z"/><path d="M6.6 20.8h10.8"/></svg>',
  'site-config': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h12"/><path d="M19 6h2"/><circle cx="17" cy="6" r="2"/><path d="M3 12h4"/><path d="M11 12h10"/><circle cx="9" cy="12" r="2"/><path d="M3 18h10"/><path d="M17 18h4"/><circle cx="15" cy="18" r="2"/></svg>',
  default: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
};

export function dashboardPage({
  leagueName, season, theme, reduceMotion, tools, teams, selectedTeamId,
  initial = null, board = null, espnAuth = null,
}) {
  /* Expired ESPN credentials are shown to everyone signed in, not just to the
     administrator, because the site has no way to tell them apart: the Admin
     Password has no persistent session by design. Everyone therefore sees the
     same message, written so a member who cannot fix it still understands why
     the numbers have stopped moving and who to ask. */
  const credentialAlert = espnAuth && espnAuth.failing ? `
    <div class="alertbar" role="status">
      <span class="alerticon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 9v4"/><path d="M12 17h.01"/>
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>
        </svg>
      </span>
      <span>
        <b>ESPN sign-in has expired</b>
        <p>The site\u2019s stored ESPN credentials are no longer being accepted, so
        league data has stopped updating\u2014everything below is the last copy that
        was fetched successfully. Whoever administers this site can replace them in
        <a href="/config">Site Configuration</a>, which asks for the Admin Password.</p>
      </span>
    </div>` : '';
  const tiles = tools.map((t, i) => `
    <a class="tile" href="${esc(t.href)}">
      <span class="tileidx">${String(i + 1).padStart(2, '0')}</span>
      <span class="tileicon">${TOOL_ICONS[t.key] || TOOL_ICONS.default}</span>
      <span class="tiletext">
        <b>${esc(t.name)}</b>
        <i>${esc(t.description)}</i>
      </span>
      ${t.adminOnly ? '<span class="tag">Admin</span>' : ''}
      <span class="tilearrow" aria-hidden="true">&rarr;</span>
    </a>`).join('');

  const teamPicker = selectField({
    id: 'team',
    value: selectedTeamId,
    placeholder: 'Select your team',
    options: teams.map((t) => ({ value: t.id, label: t.name, note: t.owner })),
  });

  const rail = displayTitle(leagueName || 'Fantasy Football',
    { underline: false, sub: season ? `${season} Season` : '' });

  const body = `
    ${credentialAlert}
    <div class="panel tight reveal">
      <div class="tickhead">
        <span class="dot" id="fdot"></span>
        <span class="tickttl">Fantasy matchups</span>
        <span class="tickmeta" id="fmeta"></span>
      </div>
      <div class="tickstrip" id="fstrip"><div class="tickrun" id="frun"></div></div>
      <div id="fempty" hidden>
        <div class="placeholder"><b>No matchups this week</b>
          <span>Fixtures appear once the schedule is live.</span></div>
      </div>
    </div>

    <div class="panel tight reveal">
      <div class="tickhead">
        <span class="dot" id="ndot"></span>
        <span class="tickttl">NFL this week</span>
        <span class="tickmeta" id="nmeta"></span>
      </div>
      <div class="tickstrip" id="nstrip"><div class="tickrun" id="nrun"></div></div>
      <div id="nempty" hidden>
        <div class="placeholder"><b>No games scheduled</b>
          <span>The week's fixtures will show here.</span></div>
      </div>
    </div>

    <div class="panel tight reveal teampanel">
      <div class="teamrow">
        <span class="teamlab"><i></i>My team</span>
        <div class="teamsel">${teamPicker}</div>
      </div>
    </div>

    <div class="panel reveal" id="cardPanel" hidden>
      <div id="cardBody"></div>
    </div>

    <div class="panel reveal">
      <div class="panelhead"><span class="t">Standings</span></div>
      <div id="standings"><p class="hint" style="margin:0">Loading</p></div>
    </div>

    <div class="panel reveal">
      <div class="panelhead"><span class="t">Injury watch</span></div>
      <div id="injuries"><p class="hint" style="margin:0">Loading</p></div>
    </div>

    <div class="panel reveal">
      <div class="panelhead"><span class="t">League activity</span>
        <span class="ranges" id="ranges">
          <button data-range="7">7d</button>
          <button data-range="30" class="on">30d</button>
          <button data-range="90">90d</button>
          <button data-range="0">All</button>
        </span>
      </div>
      <div id="transactions"><p class="hint" style="margin:0">Loading</p></div>
    </div>

    <p class="eyebrow" style="margin-top:26px">Tools</p>
    <div class="tiles reveal">${tiles || '<p class="hint">No tools are enabled yet.</p>'}</div>

    <div class="panel reveal" style="margin-top:14px">
      <div class="panelhead"><span class="t">Around the league</span></div>
      <div id="news"><p class="hint" style="margin:0">Loading</p></div>
    </div>

`;

  const css = `
    .tickhead { display:flex; align-items:center; gap:9px; margin-bottom:11px; }
    .tickttl { font-size:11px; font-weight:900; text-transform:uppercase; letter-spacing:.16em;
      background:linear-gradient(94deg,var(--ink) 10%,var(--accent) 150%);
      -webkit-background-clip:text; background-clip:text;
      color:transparent; -webkit-text-fill-color:transparent; }
    .tickmeta { margin-left:auto; font-size:10px; font-weight:900; letter-spacing:.14em;
                text-transform:uppercase; color:var(--ink-3); }
    .dot { width:7px; height:7px; flex:none; background:var(--ink-3); transform:rotate(45deg); }
    .dot.live { background:var(--accent); animation:pip 1.9s ease-in-out infinite; }
    @keyframes pip { 0%,100% { opacity:1; } 50% { opacity:.35; } }

    /* Fixed metric widths keep every copy the same length, so a score changing
       mid-scroll cannot shift the loop and introduce a seam. */
    .tk { display:flex; align-items:center; gap:9px; padding:7px 18px;
          border-right:1px solid var(--line); white-space:nowrap; }
    .tkside { display:flex; align-items:center; gap:6px; }
    .tklogo { width:19px; height:19px; object-fit:contain; flex:none; }
    .tkab { font-size:12.5px; font-weight:900; letter-spacing:.01em;
            max-width:19ch; overflow:hidden; text-overflow:ellipsis; }
    .tkpts { font-size:12.5px; font-weight:900; font-variant-numeric:tabular-nums;
             color:var(--accent); letter-spacing:.02em;
             min-width:4.2ch; text-align:right; display:inline-block; }
    .tkvs { font-size:9.5px; font-weight:900; letter-spacing:.14em; color:var(--ink-3); }
    /* Width is reserved per strip, from the longest state that strip can show,
       rather than from one number big enough for the worst case anywhere. A
       fixed 120px fitted the NFL strip's "9/13 - 1:00 PM EDT" and left the
       fantasy strip's "Week 1" trailing most of an inch of empty rule. */
    .tkstate { font-size:9.5px; font-weight:900; letter-spacing:.1em; text-transform:uppercase;
               color:var(--ink-3); margin-left:4px; display:inline-block;
               min-width:var(--statew, 5ch); }
    .tk.live .tkstate { color:var(--accent); }
    .tk.win .tkab { color:var(--accent); }

    /* team card */
    .tickstrip { pointer-events:none; }
    .cardlogo { width:38px; height:38px; object-fit:contain; flex:none; }
    .cardstats { display:flex; gap:18px; margin-top:9px; }
    .stat b { display:block; font-size:19px; font-weight:900; font-variant-numeric:tabular-nums;
              color:var(--accent); letter-spacing:-.02em; }
    .stat span { display:block; font-size:9.5px; font-weight:900; letter-spacing:.15em;
                 text-transform:uppercase; color:var(--ink-3); margin-top:1px; }
    .vsrow { display:flex; align-items:center; gap:14px; min-height:104px; }
    .vsme, .vsopp { display:flex; align-items:center; gap:11px; min-width:0; flex:1; }
    .vsopp { justify-content:flex-end; text-align:right; }
    /* The opponent's line mirrors the reader's own, hard against the far edge,
       so the two seasons read as a pair rather than as a list. */
    .vsopp .cardstats { justify-content:flex-end; }
    .vsid { min-width:0; }
    /* Wraps rather than truncating: the full team name is the point, and a
       clipped one is no more readable than a wrapped one is untidy. */
    .vsname { display:block; font-size:13px; font-weight:900; letter-spacing:.1em;
      text-transform:uppercase; overflow-wrap:anywhere; hyphens:auto;
      background:linear-gradient(94deg,var(--ink) 10%,var(--accent) 155%);
      -webkit-background-clip:text; background-clip:text;
      color:transparent; -webkit-text-fill-color:transparent; }
    .vsowner { display:block; font-size:10.5px; font-weight:800; letter-spacing:.14em;
      text-transform:uppercase; color:var(--ink-3); margin-top:3px; }
    .vsopp .vsid { text-align:right; }
    /* Below this the three-across arrangement stops working: a 38px crest and a
       fixed centre column either side of two names leaves each name about two
       characters of room, and both teams render as an ellipsis. Stacking keeps
       the DOM order — you, the state of the game, then them — which is how a
       fixture reads anyway, and gives each name the full width. */
    @media (max-width:620px) {
      .vsrow { flex-direction:column; align-items:stretch; gap:12px; min-height:0; }
      .vsme, .vsopp { justify-content:flex-start; text-align:left; }
      .vsopp .vsid { text-align:left; }
      .vsopp .cardlogo { order:-1; }
      .vsopp .cardstats { justify-content:flex-start; }
      /* Scoped through .vsrow deliberately: the base .vsmid rule is declared
         after this block, and at equal specificity source order would win. */
      .vsrow .vsmid { min-width:0; text-align:left; padding:9px 0 9px 49px;
               border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
      .cardstats { gap:14px; }
      .stat b { font-size:16px; }
    }
    .vsmid { flex:none; text-align:center; min-width:118px; }
    .vsscore { font-size:20px; font-weight:900; font-variant-numeric:tabular-nums;
               color:var(--accent); letter-spacing:-.02em; }
    .vslabel { font-size:9.5px; font-weight:900; letter-spacing:.15em; text-transform:uppercase;
               color:var(--ink-3); margin-top:2px; }
    .countdown { font-size:19px; font-weight:900; font-variant-numeric:tabular-nums;
                 letter-spacing:.02em; color:var(--ink); }
    .countdown em { font-style:normal; color:var(--ink-3); font-size:12px; margin:0 1px 0 1px; }

    /* standings */
    .stbl { width:100%; border-collapse:collapse; font-size:13px; }
    .stbl th { font-size:9.5px; font-weight:900; letter-spacing:.14em; text-transform:uppercase;
               color:var(--ink-3); text-align:right; padding:0 0 8px; }
    .stbl th:nth-child(1), .stbl th:nth-child(2) { text-align:left; }
    .stbl td { padding:8px 0; border-top:1px solid var(--line); text-align:right;
               font-variant-numeric:tabular-nums; }
    .stbl td:nth-child(1) { width:26px; color:var(--ink-3); font-weight:900; font-size:11px; }
    .stbl td:nth-child(2) { text-align:left; }
    .stteam { display:flex; align-items:center; gap:8px; min-width:0; }
    .stteam img { width:18px; height:18px; object-fit:contain; flex:none; }
    .stteam b { font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .stbl tr.me td { background:var(--accent-glow); }
    .stbl tr.me .stteam b { color:var(--accent); }

    /* injuries */
    .inj { display:flex; align-items:center; gap:11px; padding:9px 0;
           border-bottom:1px solid var(--line); }
    .inj:last-child { border-bottom:0; }
    .injtag { flex:none; font-size:9px; font-weight:900; letter-spacing:.1em; padding:3px 6px;
              border:1px solid currentColor; }
    .injtag.OUT, .injtag.IR { color:var(--flag); }
    .injtag.QUESTIONABLE, .injtag.DOUBTFUL { color:var(--signal); }
    .injtag.SUSPENSION, .injtag.DAY_TO_DAY { color:var(--signal); }
    .injname { font-size:13.5px; font-weight:800; }
    .injmeta { font-size:11px; color:var(--ink-3); margin-top:1px; }
    .injslot { margin-left:auto; font-size:10px; font-weight:900; letter-spacing:.12em;
               color:var(--ink-3); }

    /* transactions */
    .ranges { margin-left:auto; display:flex; gap:4px; }
    .ranges button { background:none; border:1px solid var(--line); color:var(--ink-3);
      font-family:inherit; font-size:9.5px; font-weight:900; letter-spacing:.1em;
      padding:4px 7px; cursor:pointer; transition:all .15s ease; }
    .ranges button:hover { color:var(--ink-2); border-color:var(--line-2); }
    .ranges button.on { color:var(--accent); border-color:var(--accent); }
    .txrow { display:flex; align-items:center; gap:10px; padding:8px 0;
             border-bottom:1px solid var(--line); font-size:13px; }
    .txrow:last-child { border-bottom:0; }
    .txkind { flex:none; width:38px; font-size:9px; font-weight:900; letter-spacing:.1em; }
    .txkind.ADD { color:var(--accent); }
    .txkind.DROP { color:var(--flag); }
    .txname { font-weight:800; }
    .txmeta { font-size:11px; color:var(--ink-3); }
    .txwhen { margin-left:auto; font-size:10px; font-weight:800; letter-spacing:.1em;
              color:var(--ink-3); white-space:nowrap; }

    .tiles { display:grid; grid-template-columns:1fr; gap:10px; }
    @media (min-width:560px) { .tiles { grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); } }
    .tile { position:relative; display:flex; align-items:center; gap:13px;
      background:var(--panel); border:1px solid var(--line); padding:16px 17px;
      text-decoration:none; color:var(--ink); overflow:hidden;
      transition:border-color .18s ease, transform .18s ease; }
    .tile::before { content:""; position:absolute; left:0; top:0; bottom:0; width:2px;
      background:var(--accent); transform:scaleY(0); transform-origin:top;
      transition:transform .22s cubic-bezier(.3,.8,.4,1); }
    .tile:hover { border-color:var(--line-2); transform:translateX(2px); }
    .tile:hover::before { transform:scaleY(1); }
    .tile:hover .tilearrow { opacity:1; transform:translateX(0); }
    .tileidx { position:absolute; right:10px; bottom:-6px; font-size:44px; font-weight:900;
      color:var(--ink); opacity:var(--ghost-opacity); line-height:1;
      font-variant-numeric:tabular-nums; pointer-events:none; letter-spacing:-.05em; }
    .tileicon { flex:none; width:26px; height:26px; color:var(--accent); }
    .tileicon svg { width:100%; height:100%; }
    .tiletext { display:flex; flex-direction:column; min-width:0; z-index:1; padding-right:58px; }
    .tiletext b { font-size:14.5px; font-weight:900; letter-spacing:-.01em; }
    .tiletext i { font-style:normal; font-size:12px; color:var(--ink-2); margin-top:2px; }
    .tilearrow { position:absolute; right:14px; top:50%; margin-top:-9px; z-index:2;
      color:var(--accent); font-size:15px; opacity:0; transform:translateX(-4px);
      transition:opacity .2s ease, transform .2s ease; }
    .tag { position:absolute; top:9px; right:11px; font-size:8.5px; font-weight:900;
           text-transform:uppercase; letter-spacing:.16em; color:var(--signal); }

    .newsitem { display:grid; grid-template-columns:26px 1fr; gap:10px; align-items:baseline;
                padding:10px 0; border-bottom:1px solid var(--line); text-decoration:none;
                color:var(--ink); font-size:13.5px; line-height:1.45;
                transition:color .16s ease, padding-left .16s ease; }
    .newsitem:last-child { border-bottom:0; }
    .newsitem:hover { color:var(--accent); padding-left:4px; }
    .newsitem em { font-style:normal; font-size:10.5px; font-weight:900; color:var(--ink-3);
                   font-variant-numeric:tabular-nums; letter-spacing:.06em; }
    .nh span { display:block; font-size:9.5px; font-weight:900; letter-spacing:.14em;
               text-transform:uppercase; color:var(--ink-3); margin-top:3px; }

    .teampanel::after { display:none; }
    .teamrow { display:flex; align-items:stretch; flex-wrap:wrap; }
    .teamlab { flex:none; display:flex; align-items:center; gap:8px; font-size:11px;
      font-weight:900; letter-spacing:.16em; text-transform:uppercase; padding:0 15px;
      border:1px solid var(--line-2); border-right:0;
      background:linear-gradient(94deg,var(--ink) 10%,var(--accent) 150%);
      -webkit-background-clip:text; background-clip:text;
      color:transparent; -webkit-text-fill-color:transparent; }
    .teamlab i { width:6px; height:6px; background:var(--accent); transform:rotate(45deg);
                 flex:none; -webkit-text-fill-color:initial; }
    .teamsel { flex:1; min-width:200px; }
    .teamsel .xselbtn { border-left:0; }
    @media (max-width:520px) {
      .teamlab { border-right:1px solid var(--line-2); padding:9px 13px; width:100%; }
      .teamsel { min-width:100%; }
    }

    .cardname { font-size:11px !important; font-weight:900; letter-spacing:.16em;
      text-transform:uppercase;
      background:linear-gradient(94deg,var(--ink) 10%,var(--accent) 150%);
      -webkit-background-clip:text; background-clip:text;
      color:transparent; -webkit-text-fill-color:transparent; }
  `;

  const js = `
var team = document.getElementById('team');
function teamValue() { return team.dataset.value || ''; }
team.addEventListener('xselect', function (e) {
  document.cookie = '${TEAM_COOKIE}=' + encodeURIComponent(e.detail.value) +
    '; path=/; max-age=31536000; samesite=lax';
  loadBoard();
});
document.getElementById('out').addEventListener('click', async function () {
  await fetch('/api/auth/logout', { method: 'POST' });
  location.href = '/';
});

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function logo(url, alt, cls) {
  /* A team with no logo, or one whose image will not load, gets the shield —
     never a blank gap and never invented initials. The failure path is
     onerror="this.hidden=true" and a CSS sibling rule rather than a handler
     that rewrites markup: this function is emitted inside a template literal,
     where a quoted string in an inline handler needs escaping that does not
     survive the trip to the browser. */
  var c = cls || 'tklogo';
  var shield = '${LOGO_FALLBACK_SVG}';
  if (!url) return '<span class="' + c + ' lgo lgofail">' + shield + '</span>';
  return '<span class="' + c + ' lgo"><img src="' + esc(url) + '" alt="' + esc(alt) +
    '" referrerpolicy="no-referrer" loading="lazy" onerror="this.hidden=true">' +
    shield + '</span>';
}

/* ---------------------------------------------------------------- tickers */
/* A strip is built once and then patched in place. Rebuilding it to show a new
   score would restart the animation and jump the sequence, so only the values
   inside the already-scrolling copies are updated. */
var stripSig = {};

function nflItem(g, i) {
  // The score cell is only rendered once a game is under way. Reserving it
  // beforehand left a visible hole in every fixture. Started state is part of
  // the structure, so a game kicking off rebuilds the strip exactly once.
  var pts = g.started ? '<b class="tkpts j-a"></b>' : '';
  var ptsH = g.started ? '<b class="tkpts j-h"></b>' : '';
  var away = '<span class="tkside">' + logo(g.awayLogo, g.away) +
    '<b class="tkab">' + esc(g.away) + '</b>' + pts + '</span>';
  var home = '<span class="tkside">' + logo(g.homeLogo, g.home) +
    '<b class="tkab">' + esc(g.home) + '</b>' + ptsH + '</span>';
  /* ESPN's own status string is Eastern time whoever is reading it, so before
     kickoff the label is rebuilt from the ISO instant in the reader's chosen
     zone. Once a game is under way the string is a clock or a quarter rather
     than a time of day, and is shown as ESPN wrote it. */
  var state = g.state || '';
  if (!g.started && g.kickoff && typeof window.fmtDateTime === 'function') {
    state = window.fmtDateTime(g.kickoff) || state;
  }
  return { key: 'n' + i,
    html: '<div class="tk" data-k="n' + i + '">' + away +
      '<span class="tkvs">AT</span>' + home + '<span class="tkstate j-s"></span></div>',
    vals: { a: g.started ? g.awayScore : '', h: g.started ? g.homeScore : '',
            s: state, live: !!g.inProgress, win: null } };
}

function fantasyItem(m, i) {
  function side(s, cls) {
    return '<span class="tkside ' + cls + '">' + logo(s.logo, s.name) +
      '<b class="tkab">' + esc(s.name) + '</b>' +
      (m.started ? '<b class="tkpts j-' + cls + '"></b>' : '') + '</span>';
  }
  return { key: 'f' + i,
    html: '<div class="tk" data-k="f' + i + '">' + side(m.away, 'a') +
      '<span class="tkvs">VS</span>' + side(m.home, 'h') + '<span class="tkstate j-s"></span></div>',
    vals: { a: m.started ? m.away.points.toFixed(1) : '',
            h: m.started ? m.home.points.toFixed(1) : '',
            s: m.winner ? 'Final' : (m.started ? 'Live' : 'Week ' + m.period),
            live: m.started && !m.winner, win: m.winner } };
}

function patch(runEl, items) {
  items.forEach(function (it) {
    var nodes = runEl.querySelectorAll('[data-k="' + it.key + '"]');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var a = n.querySelector('.j-a'), h = n.querySelector('.j-h'), st = n.querySelector('.j-s');
      if (a && a.textContent !== it.vals.a) a.textContent = it.vals.a;
      if (h && h.textContent !== it.vals.h) h.textContent = it.vals.h;
      if (st && st.textContent !== it.vals.s) st.textContent = it.vals.s;
      n.classList.toggle('live', !!it.vals.live);
    }
  });
}

function marquee(runEl, stripEl, emptyEl, items) {
  var id = runEl.id;
  if (!items.length) {
    stripEl.hidden = true; emptyEl.hidden = false;
    runEl.innerHTML = ''; stripSig[id] = ''; return;
  }
  stripEl.hidden = false; emptyEl.hidden = true;

  // Structure only. Values are deliberately excluded so a score change patches
  // rather than rebuilds.
  var structure = items.map(function (it) { return it.html; }).join('');
  // Bucket the width so a one-pixel reflow cannot trigger a rebuild.
  /* The zone is part of the signature because a different zone can produce a
     different label length, and the reserved state width is measured at build
     time. Changing zones is a deliberate act, so one rebuild is the right cost
     for keeping the loop seamless afterwards. */
  var signature = structure + '|' + Math.round(stripEl.clientWidth / 24) +
    '|' + (typeof window.siteTz === 'function' ? window.siteTz() : '');

  if (stripSig[id] === signature) { patch(runEl, items); return; }
  stripSig[id] = signature;

  /* Reserve the widest state this strip actually carries — set before the copy
     is measured, because the reservation is part of the copy's width. A game
     going from a kickoff time to FINAL then cannot resize an item mid-scroll
     and shift the loop. */
  var widest = 0;
  items.forEach(function (it) {
    var n = (it.vals.s || '').length;
    if (n > widest) widest = n;
  });
  runEl.style.setProperty('--statew', Math.max(4, widest + 1) + 'ch');

  runEl.style.animation = 'none';
  runEl.innerHTML = structure;
  patch(runEl, items);
  var copyWidth = Math.max(1, runEl.scrollWidth);
  var stripWidth = stripEl.clientWidth || copyWidth;

  var copies = Math.max(3, Math.ceil((stripWidth * 2) / copyWidth) + 2);
  var out = '';
  for (var i = 0; i < copies; i++) out += structure;
  runEl.innerHTML = out;

  runEl.style.setProperty('--shift', (-copyWidth) + 'px');
  runEl.style.setProperty('--dur', Math.max(8, copyWidth / 42).toFixed(2) + 's');
  void runEl.offsetWidth;
  runEl.style.animation = '';
  patch(runEl, items);
}

/* ---------------------------------------------------------------- team card */
var KICKOFF = null, cdTimer = null;

function two(n) { return n < 10 ? '0' + n : String(n); }

function renderCountdown() {
  var el = document.getElementById('cdown');
  if (!el || !KICKOFF) return;
  var ms = new Date(KICKOFF).getTime() - Date.now();
  if (!isFinite(ms)) return;
  if (ms <= 0) { el.innerHTML = 'Kickoff'; return; }
  var s = Math.floor(ms / 1000), d = Math.floor(s / 86400);
  var h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  el.innerHTML = (d ? d + '<em>d</em> ' : '') + two(h) + '<em>:</em>' + two(m) +
    '<em>:</em>' + two(sec);
}

/* Team names are always shown in full.
   Substituting an abbreviation past sixteen characters meant the same team
   read as "Down for THE WIN!" in one place and "DFW" in another, which is a
   worse outcome than a long name wrapping. The card lets the name wrap
   instead. */
function short(name) {
  return name || '';
}

/* Record, rank and points for either side of the card. Shown for both teams:
   a matchup is a comparison, and giving the reader one side's season and not
   the other's just sends them off to look the missing half up. */
function seasonStats(sl, started) {
  if (!sl) return '';
  /* Before week one every record is 0-0 and every rank is just where a team
     landed in a tie-break of nothing. Showing it on one side was quietly
     misleading; showing it on both would have invited a comparison that does
     not exist yet. */
  if (started === false) return '';
  return '<div class="cardstats">' +
    (sl.record ? '<span class="stat"><b>' + esc(sl.record) + '</b><span>Record</span></span>' : '') +
    (sl.rank ? '<span class="stat"><b>' + sl.rank + '</b><span>Rank</span></span>' : '') +
    (sl.pointsFor != null ? '<span class="stat"><b>' + sl.pointsFor.toFixed(0) + '</b><span>PF</span></span>' : '') +
    '</div>';
}

function renderCard(t, identified) {
  var panel = document.getElementById('cardPanel');
  if (!t) { panel.hidden = true; KICKOFF = null; return; }
  if (identified === false) {
    panel.hidden = false;
    document.getElementById('cardBody').innerHTML =
      '<div class="placeholder"><b>Loading league data</b>' +
      '<span>Your matchup appears once team names have loaded.</span></div>';
    KICKOFF = null;
    return;
  }
  panel.hidden = false;
  var mySeason = (t.matchup && t.matchup.mySeason) || (t.record ? {
    record: t.record, rank: t.rank, pointsFor: t.pointsFor, owner: t.owner
  } : null);
  var stats = seasonStats(mySeason, t.seasonStarted);

  var mid, vs = '';
  if (t.matchup) {
    if (t.matchup.started) {
      mid = '<div class="vsscore">' + t.matchup.myPoints.toFixed(1) + ' &middot; ' +
        t.matchup.oppPoints.toFixed(1) + '</div><div class="vslabel">' +
        (t.matchup.winner ? 'Final' : 'Live') + '</div>';
    } else if (t.kickoff) {
      mid = '<div class="countdown" id="cdown">--</div><div class="vslabel">Until kickoff</div>';
    } else {
      mid = '<div class="vslabel">Week ' + t.matchup.period + '</div>';
    }
    var meLabel = short(t.name);
    var oppLabel = short(t.matchup.opponent);
    var oppStats = seasonStats(t.matchup.opponentSeason, t.seasonStarted);
    vs = '<div class="vsrow">' +
      '<span class="vsme">' + logo(t.logo, t.name, 'cardlogo') +
        '<span class="vsid"><span class="vsname">' + esc(meLabel) + '</span>' +
        '<span class="vsowner">' + esc(t.owner || '') + '</span>' + stats + '</span>' +
      '</span>' +
      '<span class="vsmid">' + mid + '</span>' +
      '<span class="vsopp">' +
        '<span class="vsid"><span class="vsname">' + esc(oppLabel) + '</span>' +
        '<span class="vsowner">' + esc(t.matchup.opponentOwner || '') + '</span>' +
        oppStats + '</span>' +
        logo(t.matchup.opponentLogo, t.matchup.opponent, 'cardlogo') +
      '</span></div>';
  } else {
    vs = '<div class="placeholder"><b>No matchup scheduled</b>' +
      '<span>This week has no fixture for your team.</span></div>';
  }

  document.getElementById('cardBody').innerHTML = vs;

  KICKOFF = (t.matchup && !t.matchup.started) ? t.kickoff : null;
  if (cdTimer) clearInterval(cdTimer);
  if (KICKOFF) { renderCountdown(); cdTimer = setInterval(renderCountdown, 1000); }
}

/* ---------------------------------------------------------------- board */
var TX = [], RANGE = 30;

function renderStandings(st) {
  var host = document.getElementById('standings');
  if (!st || !st.rows.length) {
    host.innerHTML = '<div class="placeholder"><b>Standings unavailable</b>' +
      '<span>They appear once the league is set up.</span></div>';
    return;
  }
  /* Rows exist but carry no team identity yet. Rendering them would print
     "Team 1", "Team 2" — which reads as a league nobody named rather than as
     data still on its way. */
  if (st.identified === false) {
    host.innerHTML = '<div class="placeholder"><b>Loading league data</b>' +
      '<span>Team names and records arrive with the next refresh.</span></div>';
    return;
  }
  if (!st.started) {
    host.innerHTML = '<div class="placeholder"><b>Season has not started</b>' +
      '<span>Records and points appear after week one.</span></div>';
    return;
  }
  var mine = teamValue() ? Number(teamValue()) : null;
  host.innerHTML = '<table class="stbl"><tr><th></th><th>Team</th><th>W-L</th>' +
    '<th>PF</th><th>PA</th><th>Strk</th></tr>' +
    st.rows.map(function (r) {
      return '<tr class="' + (r.teamId === mine ? 'me' : '') + '"><td>' + r.rank + '</td>' +
        '<td><span class="stteam">' + logo(r.logo, r.name, 'tklogo') + '<b>' + esc(r.name) + '</b></span></td>' +
        '<td>' + r.wins + '-' + r.losses + (r.ties ? '-' + r.ties : '') + '</td>' +
        '<td>' + r.pointsFor.toFixed(1) + '</td><td>' + r.pointsAgainst.toFixed(1) + '</td>' +
        '<td>' + esc(r.streak || '&mdash;') + '</td></tr>';
    }).join('') + '</table>';
}

function renderInjuries(list, hasTeam) {
  var host = document.getElementById('injuries');
  if (!hasTeam) {
    host.innerHTML = '<div class="placeholder"><b>Pick your team</b>' +
      '<span>Injury alerts follow your roster.</span></div>';
    return;
  }
  if (!list.length) {
    host.innerHTML = '<div class="placeholder"><b>Everyone available</b>' +
      '<span>No recent injuries on your roster.</span></div>';
    return;
  }
  host.innerHTML = list.map(function (p) {
    return '<div class="inj"><span class="injtag ' + esc(p.status) + '">' +
      esc(p.status.slice(0, 4)) + '</span><span><span class="injname">' + esc(p.name) +
      '</span><span class="injmeta">' + esc(p.pos) + ' &middot; ' + esc(p.team) +
      (p.type ? ' &middot; ' + esc(p.type) : '') + '</span></span>' +
      '<span class="injslot">' + esc(p.slot || '') + '</span></div>';
  }).join('');
}

function renderTransactions() {
  var host = document.getElementById('transactions');
  var cutoff = RANGE ? Date.now() - RANGE * 86400000 : 0;
  var rows = TX.filter(function (t) {
    if (!cutoff) return true;
    if (!t.date) return false;
    return Date.parse(t.date) >= cutoff;
  }).slice(0, 25);

  if (!rows.length) {
    host.innerHTML = '<div class="placeholder"><b>No activity</b>' +
      '<span>Nothing moved in this window.</span></div>';
    return;
  }
  host.innerHTML = rows.map(function (t) {
    var when = (t.date && typeof window.fmtDate === 'function') ? window.fmtDate(t.date) : '';
    return '<div class="txrow"><span class="txkind ' + esc(t.kind) + '">' + esc(t.kind) + '</span>' +
      '<span><span class="txname">' + esc(t.player) + '</span>' +
      '<span class="txmeta"> ' + esc(t.pos) + (t.team ? ' &middot; ' + esc(t.team) : '') + '</span></span>' +
      '<span class="txwhen">' + esc(when) + '</span></div>';
  }).join('');
}

document.getElementById('ranges').addEventListener('click', function (e) {
  var b = e.target.closest('[data-range]');
  if (!b) return;
  RANGE = Number(b.dataset.range);
  this.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
  renderTransactions();
});

function paintBoard(d) {
  if (!d) return;
  renderStandings(d.standings);
  renderCard(d.myTeam, d.identified);
  renderInjuries(d.injuries || [], !!d.myTeam);
  TX = d.transactions || [];
  renderTransactions();
}

async function loadBoard() {
  try {
    var q = teamValue() ? ('?team=' + encodeURIComponent(teamValue())) : '';
    var res = await fetch('/api/dashboard/board' + q);
    if (!res.ok) throw new Error(res.status);
    paintBoard(await res.json());
  } catch (e) { /* keep whatever is on screen */ }
}

/* ---------------------------------------------------------------- status */
var INITIAL = ${JSON.stringify(initial || null)};
var BOARD = ${JSON.stringify(board || null)};
var LAST = INITIAL;

window.__relayout = function () { stripSig = {}; if (LAST) paint(LAST); };
window.addEventListener('load', window.__relayout);

// Only a genuine width change can affect the measured loop. Height changes
// constantly on mobile as browser chrome collapses during a scroll, and
// reacting to those was rebuilding the strips mid-scroll.
var lastW = window.innerWidth, rt;
window.addEventListener('resize', function () {
  if (window.innerWidth === lastW) return;
  lastW = window.innerWidth;
  clearTimeout(rt); rt = setTimeout(window.__relayout, 180);
}, { passive: true });

function paint(d) {
    LAST = d;
    var nfl = d.nfl || {};
    document.getElementById('ndot').className = 'dot' + (nfl.live ? ' live' : '');
    document.getElementById('nmeta').textContent = nfl.summary || '';
    marquee(document.getElementById('nrun'), document.getElementById('nstrip'),
      document.getElementById('nempty'), (nfl.games || []).map(nflItem));

    var fan = d.fantasy || {};
    document.getElementById('fdot').className = 'dot' + (fan.live ? ' live' : '');
    document.getElementById('fmeta').textContent = fan.summary || '';
    /* Until the team payload has joined, every side of every matchup is a bare
       id. An empty strip is honest; a strip of "Team 3 vs Team 7" is not. */
    var fanItems = fan.identified === false ? [] : (fan.games || []).map(fantasyItem);
    marquee(document.getElementById('frun'), document.getElementById('fstrip'),
      document.getElementById('fempty'), fanItems);

    if (d.headlines) {
      document.getElementById('news').innerHTML = d.headlines.length
        ? d.headlines.map(function (h, i) {
            return '<a class="newsitem" href="' + esc(h.link || '#') + '" target="_blank" rel="noopener noreferrer">'
              + '<em>' + String(i + 1).padStart(2, '0') + '</em><span class="nh">'
              + esc(h.headline) + '<span>' + esc(h.source || 'ESPN') + '</span></span></a>';
          }).join('')
        : '<div class="placeholder"><b>No headlines</b><span>The wire is quiet.</span></div>';
    }
}

/* Held so a zone change can repaint from the last payload without waiting for
   the next poll. */
var LAST_STATUS = null;

window.addEventListener('tzchange', function () {
  if (LAST_STATUS) paint(LAST_STATUS);
  renderTransactions();
});

async function loadStatus() {
  try {
    var res = await fetch('/api/dashboard/status');
    if (!res.ok) throw new Error(res.status);
    LAST_STATUS = await res.json();
    paint(LAST_STATUS);
  } catch (e) {
    document.getElementById('nmeta').textContent = 'Unavailable';
    document.getElementById('fmeta').textContent = 'Unavailable';
  }
}

if (INITIAL) { LAST_STATUS = INITIAL; paint(INITIAL); } else loadStatus();
if (BOARD) paintBoard(BOARD); else loadBoard();
setInterval(loadBoard, 90000);
${idleAwarePoller('loadStatus', 15000)}`;

  return shell({
    title: leagueName || 'ESPN Fantasy Tools', theme, reduceMotion, rail, body,
    band: true, settings: true, extraCss: css, extraJs: js,
    instructions: [
      ['01', 'Pick your team first',
       'Choose your team above and the whole page follows it: your matchup, your injuries, your activity. The choice is shared with every tool.'],
      ['02', 'The strips across the top',
       'Fantasy matchups and this week\u2019s NFL games. Both keep scrolling even with reduce motion on, because they carry information rather than decoration.'],
      ['03', 'Injury watch is yours only',
       'It lists players on your roster, starters and bench alike, who are carrying a designation. An empty panel means nobody on your roster has one.'],
      ['04', 'Tools live below',
       'Each tile opens a tool. Which ones appear is set in Site Configuration, so your league may show more or fewer than another.'],
      ['05', 'Settings follow you',
       'Theme, motion and time zone are under the gear on every page, and every time on the site is shown in the zone you pick there.'],
    ],
    // The dashboard is home, so its wordmark is not a link, and its one
    // page-level action is the way out of the site rather than back into it.
    home: true,
    action: '<button class="pagebtn danger" id="out">Sign out</button>',
  });
}

/**
 * A polling loop that stops on its own.
 *
 * Refresh cost scales with how long a page keeps polling, not with how many
 * people are watching, so an abandoned tab is the only real cost risk. Polling
 * pauses while the tab is hidden and stops entirely after four hours without
 * interaction — long enough to sit through a full slate of games, short enough
 * that a forgotten tab can never poll indefinitely.
 */
export function idleAwarePoller(fnName, intervalMs, idleMs = 4 * 60 * 60 * 1000) {
  return `
(function () {
  var lastActive = Date.now(), timer = null, stopped = false;
  ['pointerdown','keydown','scroll','focus','touchstart'].forEach(function (evt) {
    window.addEventListener(evt, function () {
      lastActive = Date.now();
      if (stopped) { stopped = false; hideResume(); tick(); }
    }, { passive: true });
  });
  function hideResume() { var b = document.getElementById('resumebar'); if (b) b.remove(); }
  function showResume() {
    if (document.getElementById('resumebar')) return;
    var b = document.createElement('div');
    b.id = 'resumebar'; b.className = 'msg info'; b.style.display = 'block';
    b.textContent = 'Live updates paused after 4 hours idle. Tap anywhere to resume.';
    var host = document.querySelector('.main');
    if (host) host.insertBefore(b, host.firstChild);
  }
  function tick() {
    if (timer) clearTimeout(timer);
    if (Date.now() - lastActive > ${idleMs}) { stopped = true; showResume(); return; }
    if (!document.hidden) { try { ${fnName}(); } catch (e) {} }
    timer = setTimeout(tick, ${intervalMs});
  }
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && !stopped) { lastActive = Date.now(); tick(); }
  });
  timer = setTimeout(tick, ${intervalMs});
})();`;
}
