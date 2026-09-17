/**
 * The signed-in home page.
 *
 * Assembles the markup and hands the browser the stylesheet and script that
 * drive it. Panel order is deliberate: the week, this week's matchup, the
 * standings, the tools, then the news.
 */
import { shell, passwordField, displayTitle, selectField, esc, LOGO_FALLBACK_SVG, TEAM_COOKIE, CLOSE }
  from '../ui.js';
import { TOOLS, SITE_CONFIG_TOOL } from '../tools.js';
import { TOOL_ICONS } from './icons.js';
import { linkTools } from './linktools.js';
import { DASHBOARD_CSS } from './dashboard-css.js';
import { dashboardClientJs } from './dashboard-client.js';

export function dashboardPage({
  leagueName, season, theme, reduceMotion, tools, teams, selectedTeamId,
  initial = null, board = null, espnAuth = null,
  version = '', releaseItems = [], repullNeeded = false, needsHistoryRepull = false,
  // Diagnostics only: render the update dialog already open. The real page
  // never sets this — whether the dialog opens is decided in the browser from
  // what that browser has already seen, which a server render cannot know.
  updateOpen = false,
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

  /* An update added data this deployment has never fetched.
   *
   * Written for the reader who cannot fix it, the same way the credentials
   * banner is: a member seeing an empty tool needs to know why it is empty and
   * who to ask, not to be addressed as the person holding the Admin Password. */
  const repullAlert = repullNeeded ? `
    <div class="alertbar" role="status">
      <span class="alerticon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v5.5h-5.5"/>
        </svg>
      </span>
      <span>
        <b>Update needs a data pull</b>
        <p>A recent update added information this site has not fetched yet, so some
        tools may be empty until it arrives. Whoever administers this site can finish
        the update by running ${needsHistoryRepull
          ? 'both the league data and past seasons pulls'
          : 'the league data pull'} in
        <a href="/config">Site Configuration</a>, which asks for the Admin Password.</p>
      </span>
    </div>` : '';

  /* Shown once per browser, the first time it sees a version it has not seen
     before. A browser with no record at all is a first visit rather than an
     update, and is told nothing — greeting somebody's very first arrival with
     a changelog for a site they have never used describes a history they were
     not part of. */
  const updatePopup = version ? `
  <div class="uplayer" id="updatepop"${updateOpen ? '' : ' hidden'}>
    <div class="upbox" role="dialog" aria-modal="true" aria-labelledby="updateTitle">
      <div class="uphead">
        <h2 id="updateTitle">Site updated \u2014 v${esc(version)}</h2>
        <button class="ctlbtn" id="updateClose" aria-label="Close">${CLOSE}</button>
      </div>
      ${releaseItems.length
        ? `<ul class="uplist">${releaseItems.map((i) => `<li>${linkTools(i)}</li>`).join('')}</ul>`
        : '<p class="hint" style="margin:0 0 14px">This site was updated.</p>'}
      <button class="primary" id="updateDone">Got it</button>
    </div>
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
    ${repullAlert}
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

    <p class="eyebrow" style="margin-top:26px">Tools</p>
    <div class="tiles reveal">${tiles || '<p class="hint">No tools are enabled yet.</p>'}</div>

    <p class="eyebrow" style="margin-top:26px">News</p>
    <div class="panel reveal">
      <div class="panelhead"><span class="t">Injury watch</span></div>
      <div id="injuries"><p class="hint" style="margin:0">Loading</p></div>
    </div>

    <div class="panel reveal" style="margin-top:14px">
      <div class="panelhead"><span class="t">League activity</span>
        <span class="ranges" id="ranges">
          <button data-range="7" class="on">7d</button>
          <button data-range="30">30d</button>
          <button data-range="90">90d</button>
          <button data-range="0">All</button>
        </span>
      </div>
      <div id="transactions"><p class="hint" style="margin:0">Loading</p></div>
    </div>

    <div class="panel reveal" style="margin-top:14px">
      <div class="panelhead"><span class="t">Around the league</span></div>
      <div id="news"><p class="hint" style="margin:0">Loading</p></div>
    </div>

`;

  const css = DASHBOARD_CSS;
  const js = dashboardClientJs({ version, initial, board });

  return shell({
    title: leagueName || 'ESPN Fantasy Tools', theme, reduceMotion, rail, body,
    band: true, settings: true, extraCss: css, extraJs: js,
    overlays: updatePopup,
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
