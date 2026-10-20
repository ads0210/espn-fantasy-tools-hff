/**
 * The signed-in home page.
 *
 * Assembles the markup and hands the browser the stylesheet and script that
 * drive it. Panel order is deliberate: the week, this week's matchup, the
 * standings, the tools, then the news.
 */
import { shell, passwordField, displayTitle, teamPickerField, esc, LOGO_FALLBACK_SVG, TEAM_COOKIE }
  from '../ui.js';
import { TOOLS, SITE_CONFIG_TOOL } from '../tools.js';
import { TOOL_ICONS } from './icons.js';
import { linkTools } from './linktools.js';
import { DASHBOARD_CSS } from './dashboard-css.js';
import { dashboardClientJs } from './dashboard-client.js';

export function dashboardPage({
  leagueName, season, theme, reduceMotion, tools, teams, selectedTeamId,
  initial = null, board = null, espnAuth = null,
  version = '', releaseItems = [], repullNeeded = false, needsHistoryRepull = false, dataBanner = null,
  // Week 6 (P9): the note from the Site Admin, already rendered by noteForBoard() (escaped markup), or null.
  adminNote = null,
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

  const dataAlert = dataBannerMarkup(dataBanner);

  /* Shown once per browser, the first time it sees a version it has not seen
     before. A browser with no record at all is a first visit rather than an
     update, and is told nothing — greeting somebody's very first arrival with
     a changelog for a site they have never used describes a history they were
     not part of. */
  const updatePopup = version ? `
  <div class="uplayer" id="updatepop"${updateOpen ? '' : ' hidden'}>
    <div class="upbox vwrap" role="dialog" aria-modal="true" aria-labelledby="updateTitle">
      <div class="upbody vscroll" data-vscroll>
        <div class="uphead">
          <h2 id="updateTitle">Site updated \u2014 v${esc(version)}</h2>
        </div>
        ${releaseItems.length
          ? `<ul class="uplist">${releaseItems.map((i) => `<li>${linkTools(i)}</li>`).join('')}</ul>`
          : '<p class="hint" style="margin:0 0 14px">This site was updated.</p>'}
        <button class="primary" id="updateDone">Got it</button>
      </div>
      <div class="vbar" hidden><div class="vbar-thumb"></div></div>
    </div>
  </div>` : '';

  /* Week 6 (P9): the note from the Site Admin, in the update notice's dialog. Each browser sees a note once; a new
     note (a new id) shows again. Its body arrives as HTML that noteForBoard() built from escaped markup. */
  const notePopup = adminNote ? `
  <div class="uplayer" id="notepop" hidden data-note="${esc(adminNote.id)}">
    <div class="upbox vwrap" role="dialog" aria-modal="true" aria-labelledby="noteTitle">
      <div class="upbody vscroll" data-vscroll>
        <div class="uphead"><div><p class="noteeyebrow">Note from the Site Admin</p><h2 id="noteTitle">${esc(adminNote.subject)}</h2></div></div>
        <div class="notebody">${adminNote.html}</div>
        ${adminNote.sig ? `<p class="notesig">${esc(adminNote.sig)}</p>` : ''}
        <button class="primary" id="noteDone">Got it</button>
      </div>
      <div class="vbar" hidden><div class="vbar-thumb"></div></div>
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

  const teamPicker = teamPickerField({
    id: 'team',
    value: selectedTeamId,
    placeholder: 'Select your team',
    options: teams.map((t) => ({ value: t.id, label: t.name, note: t.owner, logo: t.logo || null })),
  });

  const rail = displayTitle(leagueName || 'Fantasy Football',
    { underline: false, sub: season ? `${season} Season` : '' });

  const body = `
    ${credentialAlert}
    ${repullAlert}
    ${dataAlert}
    <div id="sitenotice" hidden></div>
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
      ${teamPicker}
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
    overlays: updatePopup + notePopup + (dataAlert ? DATA_DISMISS_POPUP : ''),
    instructions: [
      ['01', 'Pick your team first',
       'Choose your team and the whole page follows it: your matchup card, your injury watch, your side of the standings. The choice is shared with every tool, so you only make it once.'],
      ['02', 'The two strips at the top',
       'Your league\u2019s matchups this week, then the NFL games behind them. Both keep moving while games are on, with live scores and projections.'],
      ['03', 'Your matchup, then the table',
       'The card shows this week\u2019s score, projection and win chance for you and your opponent. Below it the full standings, sortable on any column, with playoff odds.'],
      ['04', 'Tools',
       'Each tile opens one. Which tiles appear, and in what order, is up to whoever administers this site, so your league may show more or fewer than another.'],
      ['05', 'News, further down',
       'Injuries on your own roster, everything the league has done lately \u2014 waiver claims, adds, drops and trades \u2014 and headlines from around the NFL. League activity starts at the last seven days; change the range to see further back.'],
      ['06', 'Settings follow you',
       'Theme, motion and time zone live under the gear on every page. Every time on the site is shown in the zone you pick there.'],
    ],
    // The dashboard is home, so its wordmark is not a link, and its one
    // page-level action is the way out of the site rather than back into it.
    home: true,
    action: '<button class="pagebtn danger" id="out">Sign out</button>',
  });
}

/* Week 6 (F2, PD9, PD21): "Some league data can't be reached". Written for a member who cannot fix it: what is
   missing, which pages it touches (in their names), how old the copy they see is, and that it clears itself.
   Times are ISO instants the browser renders in the chosen zone (class "dbtime"). */
const joinList = (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);
const stamp = (ms) => (ms ? `<time class="dbtime" datetime="${new Date(ms).toISOString()}">${new Date(ms).toISOString().slice(0, 16).replace('T', ' ')} UTC</time>` : 'an earlier fetch');

export function dataBannerMarkup(list) {
  if (!list || !list.length) return '';
  const since = Math.min(...list.map((d) => d.since || Date.now()));
  const goods = list.map((d) => d.lastGood).filter(Boolean);
  const good = goods.length ? Math.min(...goods) : null;
  let what;
  if (list.length === 1) {
    const d = list[0];
    what = `ESPN has not answered for <strong>${esc(d.name)}</strong> since ${stamp(d.since)}. ` + (d.tools.length
      ? `${esc(joinList(d.tools)).replace(/^the/, 'The')} ${d.tools.length === 1 ? 'shows' : 'show'} the last good copy, from ${stamp(d.lastGood)}.`
      : 'This is background data: nothing on the site uses it yet.');
  } else {
    what = `ESPN has not answered for ${list.length} kinds of league data since ${stamp(since)}: ${joinList(list.map((d) => `<strong>${esc(d.name)}</strong> (${d.tools.length ? esc(joinList(d.tools)) : 'background data, nothing on the site uses it yet'})`))}. Pages show the last good copy, from ${stamp(good)}.`;
  }
  return `
    <div class="alertbar dbbar" id="databanner" role="status">
      <span class="alerticon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>
        </svg>
      </span>
      <span class="dbtext">
        <b>Some league data can’t be reached</b>
        <p>${what} The site checks again every hour and this notice clears itself when ESPN answers.</p>
        <p>Whoever administers this site can look into it in <a href="/apps/site-backend/#data">Site Backend</a> (the Data Layer tab) or <a href="/config">Site Configuration</a>. Both ask for the Admin Password.</p>
      </span>
      <button type="button" class="ghost dbdismiss" id="dbDismiss">Dismiss</button>
    </div>`;
}

const DATA_DISMISS_POPUP = `
  <div class="uplayer" id="dbpop" hidden>
    <div class="upbox" role="dialog" aria-modal="true" aria-labelledby="dbTitle">
      <div class="upbody">
        <div class="uphead"><h2 id="dbTitle">Dismiss for everyone</h2></div>
        <p class="hint dbhint">This hides the notice for every member until a check fails three times in a row again. Only whoever administers this site can do that.</p>
        ${passwordField({ id: 'dbPw', label: 'Admin Password', autocomplete: 'current-password' })}
        <p class="dberr" id="dbErr" role="alert" hidden></p>
        <div class="dbbtns"><button type="button" class="ghost" id="dbCancel">Cancel</button><button type="button" class="primary" id="dbGo">Dismiss for everyone</button></div>
      </div>
    </div>
  </div>`;
