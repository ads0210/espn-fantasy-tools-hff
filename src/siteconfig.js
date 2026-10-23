/**
 * Site Configuration.
 *
 * Admin-gated with no persistent session: the Admin Password is asked for when
 * the page opens and re-sent with every individual change, and the server
 * verifies it afresh each time. The password lives only in a JavaScript
 * variable for the life of the page — never a cookie, never storage — so
 * closing the tab ends admin access completely.
 *
 * Visually this is the densest surface in the site, so it leans on the same
 * broadcast framing but swaps the roomy form rhythm for stat-line rows: label
 * left, value right, hairline between. That keeps it legible at a glance
 * without inventing a second visual language.
 */

import { shell, passwordField, selectField, displayTitle, esc, backAction, HISTORY_RUNNER_JS } from './ui.js';
import { TRADE_ROWS, TRADE_GROUPS } from './traderows.js';
import { adminGateRail, adminGateSection, ADMIN_GATE_CSS } from './admingate.js';
import { NOTE_JS, NOTE_CSS, NOTE_COLOURS, NOTE_LIMITS, notePages } from './notemarkup.js';

export function siteConfigPage({ theme, reduceMotion, leagueName }) {
  // The shared gate (src/admingate.js): the same header, panel and note as an admin-only tool's.
  const rail = adminGateRail('Site Config');

  const body = `${adminGateSection()}

    <section id="panel" hidden>
      <!-- Every panel starts shut and opens on its header. The short panels are
           stacked the way the home page stacks its tiles: even columns where the
           window allows, any left over centred beneath. The weighting list, far
           longer than the rest, runs full width under them, shut or open. -->
      <div class="cfgflow">
        <div class="panel p-conn">
          <button type="button" class="panelhead cfgtoggle" aria-expanded="false" aria-controls="cb-conn"><span class="t">League connection</span><i class="cfgchev" aria-hidden="true"></i></button>
          <div class="cfgbody" id="cb-conn" hidden>
          <div class="row"><span>League ID</span><b id="leagueId">&mdash;</b></div>
          <div class="row"><span>Season</span><b id="season">&mdash;</b></div>
          <div class="row"><span>League type</span><b id="privacy">&mdash;</b></div>
          <div class="row"><span>History seasons</span><b id="history">&mdash;</b></div>
          <p class="hint" style="margin-bottom:0">League ID is fixed after setup.</p>
          </div>
        </div>

        <div class="panel p-cookies">
          <button type="button" class="panelhead cfgtoggle" aria-expanded="false" aria-controls="cb-cookies"><span class="t">ESPN cookies</span><i class="cfgchev" aria-hidden="true"></i></button>
          <div class="cfgbody" id="cb-cookies" hidden>
          <div class="row"><span>espn_s2</span><b id="s2state">&mdash;</b></div>
          <div class="row"><span>SWID</span><b id="swidstate">&mdash;</b></div>
          <p class="hint">Replace these if league data stops loading.</p>
          <div class="field-row">
            <label for="newS2">New espn_s2</label>
            <input id="newS2" type="text" autocomplete="off" spellcheck="false"
                   placeholder="Leave blank to keep">
          </div>
          <div class="field-row">
            <label for="newSwid">New SWID</label>
            <input id="newSwid" type="text" autocomplete="off" spellcheck="false"
                   placeholder="Leave blank to keep">
          </div>
          <button class="primary" data-action="cookies">Test and save</button>
          <div class="msg" id="msgCookies"></div>
          </div>
        </div>

        <div class="panel p-pw">
          <button type="button" class="panelhead cfgtoggle" aria-expanded="false" aria-controls="cb-pw"><span class="t">Passwords</span><i class="cfgchev" aria-hidden="true"></i></button>
          <div class="cfgbody" id="cb-pw" hidden>
          ${passwordField({ id: 'newLeaguePw', label: 'New League Password',
            hint: 'Leave blank to keep the current one. Everyone will need the new one. <span class="warnh">Changing the League Password also replaces the Site API key at once.</span>' })}
          ${passwordField({ id: 'newAdminPw', label: 'New Admin Password',
            hint: 'Leave blank to keep the current one.' })}
          <button class="primary" data-action="passwords">Save passwords</button>
          <div class="msg" id="msgPasswords"></div>
          </div>
        </div>

        <div class="panel p-tools">
          <button type="button" class="panelhead cfgtoggle" aria-expanded="false" aria-controls="cb-tools"><span class="t">Tools</span><i class="cfgchev" aria-hidden="true"></i></button>
          <div class="cfgbody" id="cb-tools" hidden>
          <div id="toolRows"></div>
          <div class="msg" id="msgTools"></div>
          </div>
        </div>

        <div class="panel p-order">
          <button type="button" class="panelhead cfgtoggle" aria-expanded="false" aria-controls="cb-order"><span class="t">Home page order</span><i class="cfgchev" aria-hidden="true"></i></button>
          <div class="cfgbody" id="cb-order" hidden>
          <p class="hint">The order the tiles appear in on the home page. A tool that is not
             visible keeps its place for when it is.</p>
          <ol id="orderRows" class="orderlist"></ol>
          <button class="ghost" id="orderReset" hidden>Reset to the default order</button>
          <div class="msg" id="msgOrder"></div>
          <span class="lbl2">Standings</span>
          <div id="homeStRows"></div>
          <div class="msg" id="msgHomeSt"></div>
          </div>
        </div>

        <div class="panel p-sess">
          <button type="button" class="panelhead cfgtoggle" aria-expanded="false" aria-controls="cb-sess"><span class="t">Sign-in length</span><i class="cfgchev" aria-hidden="true"></i></button>
          <div class="cfgbody" id="cb-sess" hidden>
          <p class="hint">How long a member stays signed in before the League Password is asked for again.
             A change applies from the next sign-in; people already signed in keep the length they were given.
             Changing the League Password signs everyone out, whatever this says.</p>
          <div class="sessrow">
            <input id="sessSlide" class="wslide" type="range" min="0" max="10" step="1" value="3" aria-label="Sign-in length" aria-valuetext="8 hours">
            <b id="sessVal" class="sessval">8 hours</b>
          </div>
          <div class="msg" id="msgSess"></div>
          </div>
        </div>

        <div class="panel p-note">
          <button type="button" class="panelhead cfgtoggle" aria-expanded="false" aria-controls="cb-note"><span class="t">Note from the Site Admin</span><i class="cfgchev" aria-hidden="true"></i></button>
          <div class="cfgbody" id="cb-note" hidden>
          <p class="hint">A short note shown to every member once, over the home page. Publishing a new note shows it again to everyone.</p>
          <div class="row"><span>Status</span><b id="noteState">Nothing shown</b></div>
          <label class="nlab" for="noteSubj">Subject</label><input id="noteSubj" class="ninput" type="text" maxlength="${NOTE_LIMITS.subject}" autocomplete="off">
          <label class="nlab" for="noteBody">Note</label>
          <div class="ntools" role="toolbar" aria-label="Formatting">
            <button type="button" class="ntool" data-k="bold" title="Bold" aria-label="Bold"><b>B</b></button><button type="button" class="ntool" data-k="italic" title="Italic" aria-label="Italic"><i>I</i></button>
            <span class="nsep"></span>${Object.keys(NOTE_COLOURS).map((c) => `<button type="button" class="ntool sw-${c}" data-k="colour" data-a="${c}" title="${c[0].toUpperCase() + c.slice(1)}" aria-label="Colour: ${c}"><i class="nsw"></i></button>`).join('')}
            <span class="nsep"></span><span class="nlink"><span>Link to</span>${Object.entries(notePages()).map(([k, p]) => `<button type="button" class="ntool lk" data-k="link" data-a="${esc(k)}">${esc(p.name)}</button>`).join('')}</span>
          </div>
          <textarea id="noteBody" class="ntext" rows="7" maxlength="${NOTE_LIMITS.body}" spellcheck="true"></textarea>
          <p class="hint">Select words, then a button. Blank lines start a new paragraph.</p>
          <p class="nlab" id="noteSigLab">Signature</p>
          <div class="nsigs" id="noteSigs" role="radiogroup" aria-labelledby="noteSigLab"></div>
          <p class="nlab">Preview</p><div class="npreview" id="notePrev"></div>
          <div class="nbtns"><button type="button" class="primary" id="notePub">Publish note</button><button type="button" class="ghost" id="noteShow">Show it as members will</button><button type="button" class="ghost" id="noteDel" disabled>Remove note</button></div>
          <div class="msg" id="msgNote"></div>
          </div>
        </div>

        <div class="panel p-api" id="cfgApi">
          <button type="button" class="panelhead cfgtoggle" aria-expanded="false" aria-controls="cb-api"><span class="t">Site API</span><i class="cfgchev" aria-hidden="true"></i></button>
          <div class="cfgbody" id="cb-api" hidden>
          <div id="apiRows"><p class="hint">&mdash;</p></div>
          <div class="msg" id="msgApi"></div>
          </div>
        </div>

        <div class="panel p-data">
          <button type="button" class="panelhead cfgtoggle" aria-expanded="false" aria-controls="cb-data"><span class="t">League data</span><i class="cfgchev" aria-hidden="true"></i></button>
          <div class="cfgbody" id="cb-data" hidden>
          <div class="row"><span>Status</span><b id="primeState">&mdash;</b></div>
          <div class="bar"><i id="primeBar"></i></div>
          <p class="hint">Fetches every dataset once. Run this if a page is showing
             blanks, or after replacing your ESPN cookies.</p>
          <div class="pullbtns"><button class="ghost" id="primeResume" hidden>Resume</button><button class="primary" id="primeRun">Retry</button></div>
          <div class="msg" id="msgPrime"></div>
          <ul class="faillist" id="primeFails" hidden></ul>
          </div>
        </div>

        <div class="panel p-hist">
          <button type="button" class="panelhead cfgtoggle" aria-expanded="false" aria-controls="cb-hist"><span class="t">League history</span><i class="cfgchev" aria-hidden="true"></i></button>
          <div class="cfgbody" id="cb-hist" hidden>
          <div class="row"><span>Status</span><b id="histState">&mdash;</b></div>
          <div class="bar"><i id="histBar"></i></div>
          <p class="hint" id="histDetail">Only re-pull when you need to. This may take a
         few minutes: please do not close or refresh this tab.</p>
          <div class="pullbtns"><button class="ghost" id="histResume" hidden>Resume</button><button class="primary" id="histRun">Retry</button></div>
          <div class="msg" id="msgHistory"></div>
          </div>
        </div>

        <div class="panel p-ft">
          <button type="button" class="panelhead cfgtoggle" aria-expanded="false" aria-controls="cb-ft"><span class="t">Fortune Teller</span><i class="cfgchev" aria-hidden="true"></i></button>
          <div class="cfgbody" id="cb-ft" hidden>
          <div class="row"><span>Status</span><b id="ftState">&mdash;</b></div>
          <div class="row"><span>Season</span><b id="ftSeason">&mdash;</b></div>
          <div class="row"><span>Build</span><b id="ftSize">&mdash;</b></div>
          <div class="bar"><i id="ftBar"></i></div>
          <p class="hint" id="ftDetail">Maps every way the rest of the regular season can go. Once switched on it
            builds by itself as soon as a build fits, runs in the background within the daily allowance, and moves on
            each week as results come in.</p>
          <button class="primary" id="ftToggle">Switch on</button>
          <button class="ghost" id="ftCheck" style="margin-top:11px">Check now</button>
          <button class="ghost" id="ftRebuild" style="margin-top:11px" hidden>Rebuild the map</button>
          <div class="msg" id="msgFt"></div>
          </div>
        </div>
      </div>

      <div class="panel p-weights">
        <button type="button" class="panelhead cfgtoggle" aria-expanded="false" aria-controls="cb-weights"><span class="t">Trade Analyzer weighting</span><i class="cfgchev" aria-hidden="true"></i></button>
        <div class="cfgbody" id="cb-weights" hidden>
        <p class="hint">What each statistic is worth when Trade Analyzer judges a
           deal. These become your league&rsquo;s defaults; anyone can still move the
           adjustable ones for themselves while they are looking at a trade, and
           their changes never touch these. Leave a row alone and it follows the
           shipped default, including if that default changes later.</p>
        <div id="weightRows"></div>
        <div class="wactions">
          <button class="primary" id="weightSave">Save weighting</button>
          <button class="ghost" id="weightReset">Reset all to defaults</button>
        </div>
        <div class="msg" id="msgWeights"></div>
        </div>
      </div>

    </section>`;

  /* Week 6 (P9): the note panel (as sampled in S6) and the "as members will" dialog (the update notice's look). */
  const noteCss = `
    .p-note .nlab { display:block; font-size:10.5px; font-weight:900; letter-spacing:.14em; text-transform:uppercase; color:var(--ink-2); margin:16px 0 6px; }
    .p-note .ninput, .p-note .ntext { width:100%; font:inherit; font-size:14px; color:var(--ink); background:var(--inset); border:1px solid var(--line-2); padding:10px 11px; border-radius:0; box-sizing:border-box; }
    .p-note .ntext { font-family:ui-monospace,Menlo,Consolas,monospace; font-size:13px; line-height:1.55; resize:vertical; display:block; }
    .p-note .ninput:focus, .p-note .ntext:focus { outline:2px solid var(--accent); outline-offset:-1px; }
    .p-note .ntools { display:flex; flex-wrap:wrap; align-items:center; gap:4px; padding:6px; background:var(--panel-2); border:1px solid var(--line-2); border-bottom:0; }
    .p-note .ntool { width:auto; min-width:30px; height:28px; margin:0; font:inherit; font-size:12.5px; letter-spacing:0; text-transform:none; color:var(--ink); background:var(--panel); border:1px solid var(--line-2); cursor:pointer; padding:0 8px; border-radius:0; box-shadow:none; }
    .p-note .ntool:hover { border-color:var(--accent); } .p-note .ntool:focus-visible { outline:2px solid var(--accent); outline-offset:1px; }
    .p-note .ntool .nsw { display:block; width:14px; height:14px; margin:auto; }
    .p-note .sw-green .nsw { background:var(--accent); } .p-note .sw-red .nsw { background:var(--flag); } .p-note .sw-amber .nsw { background:var(--signal); } .p-note .sw-blue .nsw { background:var(--sky); } .p-note .sw-gold .nsw { background:var(--gold); }
    .p-note .nsep { width:1px; height:20px; background:var(--line-2); margin:0 4px; }
    .p-note .nlink { display:inline-flex; flex-wrap:wrap; align-items:center; gap:4px; }
    .p-note .nlink > span { font-size:10.5px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; color:var(--ink-2); margin-right:2px; }
    .p-note .ntool.lk { font-size:11.5px; }
    .p-note .nsigs { display:flex; flex-direction:column; gap:6px; }
    .p-note .nsig { display:flex; flex-wrap:wrap; align-items:center; gap:6px; padding:6px 8px; border:1px solid var(--line); }
    .p-note .nsig.on { border-color:var(--accent); }
    .p-note .nsigpick { width:auto; margin:0; font:inherit; font-size:14px; font-weight:800; letter-spacing:0; text-transform:none; color:var(--ink); background:transparent; border:0; box-shadow:none; cursor:pointer; padding:2px 4px; text-align:left; flex:1 1 150px; min-width:0; }
    .p-note .nsigpick::before { content:""; display:inline-block; width:10px; height:10px; border:2px solid var(--line-2); border-radius:50%; margin-right:8px; vertical-align:-1px; }
    .p-note .nsig.on .nsigpick::before { background:var(--accent); border-color:var(--accent); }
    .p-note .nsigacts { display:inline-flex; flex-wrap:wrap; gap:4px; margin-left:auto; }
    .p-note .nsig .ninput { flex:1; min-width:140px; }
    .p-note .ghost.sm { width:auto; margin:0; font-size:10.5px; padding:5px 8px; }
    .p-note .nsigs > .ghost { align-self:flex-start; }
    .p-note .npreview { border:1px dashed var(--line-2); padding:14px 16px; background:var(--panel-2); text-align:left; }
    .p-note .npreview h3 { margin:0 0 8px; font-size:18px; font-weight:900; letter-spacing:-.01em; color:var(--ink); overflow-wrap:anywhere; }
    .p-note .nbtns { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-top:14px; }
    .p-note .nbtns button { width:auto; margin:0; }
    .p-note .nbtns .primary { padding:12px 18px; }
    .uplayer { position:fixed; inset:0; z-index:90; padding:20px; background:rgba(3,6,4,.66); }
    .uplayer:not([hidden]) { display:flex; align-items:center; justify-content:center; }
    .upbox { width:min(440px,100%); max-height:min(78vh,620px); overflow:hidden; background:var(--panel); color:var(--ink);
      border:1px solid var(--line-2); border-radius:14px; box-shadow:0 24px 60px rgba(0,0,0,.55); text-align:left; }
    .upbody { max-height:min(78vh,620px); padding:20px 20px 18px; }
    .upbox .vbar { top:8px; bottom:8px; right:5px; }
    .upbody h2 { margin:0 0 12px; font-size:20px; font-weight:900; color:var(--ink); overflow-wrap:anywhere; }
    .noteeyebrow { margin:0 0 6px; font-size:10px; font-weight:900; letter-spacing:.18em; text-transform:uppercase; color:var(--ink-3); }
    ${NOTE_CSS}
  `;
  const css = noteCss + `
    /* The gate's own layout comes from src/admingate.js, shared with admin-only tools. */
    ${ADMIN_GATE_CSS}

    /* Every panel starts shut (its header is the button that opens it), so the page opens as a board of headers
       rather than one tall ribbon with gaps beside the short panels. The short panels stack like the home page's
       tiles: one a row, two from 620px, three from 940px, a short last row centred. The weighting panel runs full
       width beneath them at every width. */
    /* Scoped so the layout never contradicts the hidden attribute. */
    #panel:not([hidden]) { display:block; }
    #panel .panel { min-width:0; margin:0; }
    .cfgflow { display:flex; flex-wrap:wrap; justify-content:center; align-items:flex-start; gap:14px; container-type:inline-size; }
    .cfgflow > .panel { flex:0 0 100%; }
    @container (min-width:620px) { .cfgflow > .panel { flex-basis:calc((100% - 14px) / 2); } }
    @container (min-width:940px) { .cfgflow > .panel { flex-basis:calc((100% - 28px) / 3); } }
    @supports not (container-type:inline-size) {
      @media (min-width:660px) { .cfgflow > .panel { flex-basis:calc((100% - 14px) / 2); } }
      @media (min-width:1000px) { .cfgflow > .panel { flex-basis:calc((100% - 28px) / 3); } }
    }
    .p-weights { margin-top:14px !important; }
    /* The header is the whole button: the title, and a chevron that turns when the panel is open. */
    .panelhead.cfgtoggle { width:100%; margin:0; padding:0; border:0; background:none; color:inherit; font:inherit; text-align:left;
      cursor:pointer; -webkit-tap-highlight-color:transparent; }
    .cfgtoggle .t { flex:1; min-width:0; }
    .cfgtoggle:focus-visible { outline:2px solid var(--accent); outline-offset:6px; }
    .cfgchev { flex:none; width:8px; height:8px; margin-right:3px; border-right:2px solid var(--accent); border-bottom:2px solid var(--accent);
      transform:rotate(45deg) translate(-2px,-2px); transition:transform .18s ease; }
    .cfgtoggle[aria-expanded="true"] .cfgchev { transform:rotate(-135deg) translate(-2px,-2px); }
    .cfgtoggle:hover .cfgchev { filter:drop-shadow(0 0 5px var(--accent-glow)); }
    .cfgbody:not([hidden]) { display:block; margin-top:14px; animation:cfgopen .2s ease both; }
    .cfgbody > *:last-child { margin-bottom:0; }
    @keyframes cfgopen { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:none; } }
    html.stillness .cfgbody:not([hidden]) { animation:none; }
    /* Week 6 (F3): Resume and Retry side by side; a finished pull's failures listed under its message. */
    .pullbtns { display:flex; gap:10px; }
    .pullbtns > button { flex:1 1 0; margin:0; }
    .pullbtns > button[hidden] { display:none; }
    .faillist { margin:8px 0 0; padding-left:18px; font-size:12px; line-height:1.6; color:var(--ink-2); }
    .faillist code { font-size:11.5px; }
    .wactions { display:flex; flex-direction:column; gap:11px; }
    @media (min-width:900px) {
      .wactions { flex-direction:row; flex-wrap:wrap; }
      .wactions button { width:auto; flex:0 1 260px; margin:0; }
    }
    @media (min-width:1100px) {
      #weightRows { columns:2; column-gap:40px; }
      #weightRows .wrow { break-inside:avoid; -webkit-column-break-inside:avoid; }
      #weightRows .wgroup { break-after:avoid; -webkit-column-break-after:avoid; }
      #weightRows > :first-child { margin-top:0; }
    }

    .row { display:flex; justify-content:space-between; gap:14px; padding:9px 0;
           border-bottom:1px solid var(--line); font-size:13.5px; }
    .row:last-of-type { border-bottom:0; }
    .row span { color:var(--ink-2); font-size:11px; font-weight:800;
                text-transform:uppercase; letter-spacing:.13em; padding-top:2px; }
    .row b { text-align:right; word-break:break-word; font-weight:700;
             font-variant-numeric:tabular-nums; }

    .toolrow { display:flex; align-items:center; gap:12px; padding:12px 0;
               border-bottom:1px solid var(--line); }
    .toolrow:last-child { border-bottom:0; }
    .toolrow .tname { flex:1; min-width:0; font-size:11px; font-weight:900;
      letter-spacing:.14em; text-transform:uppercase; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
    .toolrow .tname b { font-weight:900;
      background:linear-gradient(94deg,var(--ink) 10%,var(--accent) 150%);
      -webkit-background-clip:text; background-clip:text;
      color:transparent; -webkit-text-fill-color:transparent; }
    /* New in this release (C8): set apart from the gradient name, never inside it. */
    .newtag { display:inline-block; padding:1px 6px; font-size:8.5px; font-weight:900; letter-spacing:.16em;
      text-transform:uppercase; color:var(--field); background:var(--signal); line-height:1.6;
      -webkit-text-fill-color:var(--field); vertical-align:2px; margin-left:8px; }
    .toolrow .newtag { margin-left:0; }
    .toolsel { flex:none; width:164px; }

    /* Home page order: a numbered list, each row moved one place at a time. */
    .orderlist { list-style:none; margin:4px 0 12px; padding:0; }
    .orow { display:flex; align-items:center; gap:12px; padding:9px 0; border-bottom:1px solid var(--line); }
    .orow:last-child { border-bottom:0; }
    .oidx { flex:none; width:20px; font-size:10px; font-weight:900; color:var(--ink-3);
      font-variant-numeric:tabular-nums; }
    .oname { flex:1; min-width:0; font-size:11px; font-weight:900; letter-spacing:.14em; text-transform:uppercase; }
    .oname b { font-weight:900; background:linear-gradient(94deg,var(--ink) 10%,var(--accent) 150%);
      -webkit-background-clip:text; background-clip:text; color:transparent; -webkit-text-fill-color:transparent; }
    .oname em { display:block; margin-top:3px; font-style:normal; font-size:9px; letter-spacing:.1em; color:var(--ink-3); }
    .orow.off .oname b { opacity:.55; }
    .omove { flex:none; display:flex; gap:6px; }
    .omove button { width:34px; height:34px; display:grid; place-items:center; padding:0; margin:0;
      background:var(--inset); border:1px solid var(--line); color:var(--ink-2); cursor:pointer; }
    .omove button:hover:not(:disabled) { color:var(--accent); border-color:var(--accent-deep); }
    .omove button:disabled { opacity:.3; cursor:default; }
    .omove svg { width:15px; height:15px; }
    .toolsel .xselbtn { padding:9px 11px; }

    /* Site API: the switch, the key's dates, replacing it, and whether it may travel in an address. */
    .hint.warnh, .hint .warnh { color:var(--signal); }
    .cfgsw { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:9px 0; border-bottom:1px solid var(--line); }
    .cfgsw span.l { color:var(--ink-2); font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.13em; }
    .cfgsw .r { display:flex; align-items:center; gap:10px; font-size:13px; font-weight:700; }
    .cfgsw.locked .sw { opacity:.6; cursor:not-allowed; }
    .p-api .lbl2, .p-order .lbl2 { display:block; margin:16px 0 8px; font-size:10.5px; font-weight:900; color:var(--ink-2); letter-spacing:.2em; text-transform:uppercase; }
    .p-api .btnstack { display:flex; flex-direction:column; gap:10px; }
    .p-api .btnstack button { margin-top:0; width:100%; }
    .p-api .btnstack button.minor { padding:12px 14px; }
    .p-api .xsellist li small { margin-left:8px; font-size:9px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; color:var(--ink-3); }
    .instr .dlgbody p { font-size:13px; line-height:1.55; color:var(--ink-2); margin:0 0 12px; }
    .instr .dlgbody p b { color:var(--ink); }
    .instr .dlgbody .dlgbtns { display:flex; flex-direction:column; gap:10px; margin-top:14px; }
    .instr .dlgbody .dlgbtns button { margin-top:0; }

    /* Trade Analyzer weighting. A row per statistic, grouped the way the tool
       groups them, so an administrator reads the same structure they will see
       in the breakdown. */
    .wgroup { margin:16px 0 6px; font-size:9px; font-weight:900; letter-spacing:.17em;
      text-transform:uppercase; color:var(--ink-3); display:flex; align-items:center;
      gap:8px; }
    .wgroup::before { content:""; width:5px; height:5px; background:var(--accent-deep);
      transform:rotate(45deg); flex:none; }
    .wrow { display:flex; align-items:center; gap:12px; padding:7px 0;
      border-bottom:1px solid var(--line); }
    .wrow:last-child { border-bottom:0; }
    .wname { flex:1 1 auto; min-width:0; font-size:12px; font-weight:800; }
    .wname em { font-style:normal; display:block; margin-top:2px; font-size:9px;
      font-weight:900; letter-spacing:.1em; text-transform:uppercase; color:var(--ink-3); }
    .wrow .wslide { flex:0 1 190px; min-width:120px; -webkit-appearance:none;
      appearance:none; height:16px; background:transparent; cursor:pointer; margin:0; }
    .wrow .wslide::-webkit-slider-runnable-track { height:3px; background:var(--line-2); }
    .wrow .wslide::-moz-range-track { height:3px; background:var(--line-2); }
    .wrow .wslide::-webkit-slider-thumb { -webkit-appearance:none; appearance:none;
      width:10px; height:14px; margin-top:-5.5px; background:var(--accent); border:0;
      box-shadow:0 0 0 1px var(--field); cursor:grab; }
    .wrow .wslide::-moz-range-thumb { width:10px; height:14px; border-radius:0;
      background:var(--accent); border:0; box-shadow:0 0 0 1px var(--field); }
    .sessrow { display:flex; align-items:center; gap:14px; padding:8px 0 2px; }
    .sessrow .wslide { flex:1 1 auto; min-width:120px; -webkit-appearance:none; appearance:none; height:16px; background:transparent; cursor:pointer; margin:0; }
    .sessrow .wslide::-webkit-slider-runnable-track { height:3px; background:var(--line-2); }
    .sessrow .wslide::-moz-range-track { height:3px; background:var(--line-2); }
    .sessrow .wslide::-webkit-slider-thumb { -webkit-appearance:none; appearance:none; width:10px; height:14px; margin-top:-5.5px; background:var(--accent); border:0; box-shadow:0 0 0 1px var(--field); cursor:grab; }
    .sessrow .wslide::-moz-range-thumb { width:10px; height:14px; border-radius:0; background:var(--accent); border:0; box-shadow:0 0 0 1px var(--field); }
    .sessval { flex:none; min-width:92px; text-align:right; font-size:13px; font-weight:900; font-variant-numeric:tabular-nums; color:var(--accent); }
    .wval { flex:none; width:44px; text-align:right; font-size:12px; font-weight:900;
      font-variant-numeric:tabular-nums; color:var(--accent); }
    .wdef { flex:none; width:82px; text-align:right; font-size:9px; font-weight:800;
      letter-spacing:.06em; text-transform:uppercase; color:var(--ink-3); }
    /* Says plainly which rows this league has an opinion about. */
    .wdef.moved { color:var(--signal); }
    @media (max-width:640px) {
      .wrow { flex-wrap:wrap; gap:8px 10px; }
      .wname { flex:1 1 100%; }
      .wrow .wslide { flex:1 1 auto; }
      .wdef { width:auto; }
    }

  `;

  /* Only what the panel draws. The help text is left behind deliberately: it
     is long, it is the tool's to explain, and it would be the one part of this
     payload that could carry a character the template literal cares about. */
  const weightSpec = TRADE_ROWS.map((r) => ({ id: r.id, g: r.g, n: r.n, s: r.s ? 1 : 0, w: r.w }));

  const js = HISTORY_RUNNER_JS + NOTE_JS + `
var adminPw = null;
var WEIGHT_ROWS = ${JSON.stringify(weightSpec)};
var WEIGHT_GROUPS = ${JSON.stringify(TRADE_GROUPS)};
function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

document.getElementById('unlock').addEventListener('click', unlock);
document.getElementById('adminPw').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') unlock();
});

// Every panel starts shut; its header opens and shuts it. The body is hidden outright rather than squeezed, so
// nothing inside (a dropdown's list, a dialog's opener) is ever clipped, and the state is the markup's own.
document.getElementById('panel').addEventListener('click', function (e) {
  var b = e.target.closest ? e.target.closest('.cfgtoggle') : null;
  if (!b) return;
  var body = document.getElementById(b.getAttribute('aria-controls'));
  var open = b.getAttribute('aria-expanded') !== 'true';
  b.setAttribute('aria-expanded', String(open));
  if (body) body.hidden = !open;
  if (open) window.dispatchEvent(new Event('resize'));
});

async function unlock() {
  var el = document.getElementById('adminPw');
  var gm = document.getElementById('gateMsg');
  if (!el.value) { gm.textContent = 'Enter the Admin Password.'; gm.className = 'msg err'; return; }
  gm.className = 'msg';
  var r = await call('/api/admin/config', {}, el.value);
  if (!r.ok) {
    gm.textContent = r.error || 'That password was not correct.';
    gm.className = 'msg err'; el.select(); return;
  }
  adminPw = el.value;
  el.value = '';
  document.getElementById('gate').hidden = true;
  document.getElementById('panel').hidden = false;
  render(r);
}

function render(r) {
  var c = r.config || {};
  set('leagueId', c.leagueId || '\\u2014');
  set('season', c.season || '\\u2014');
  set('privacy', c.leaguePrivate ? 'Private' : 'Public');
  set('history', (c.historySeasons || []).join(', ') || 'not discovered yet');
  set('s2state', c.espnS2Present ? 'Set (' + c.espnS2Length + ' chars)' : 'Not set');
  set('swidstate', c.swidPresent ? (c.swidWellFormed ? 'Set' : 'Set, malformed') : 'Not set');
  renderTools(r.tools || []);
  renderOrder(r.order || { tiles: [], custom: false });
  HOMEST.stored = c.homeStandings === true;
  renderHomeSt();
  renderSession(c.sessionHours);
  noteRender(c.adminNote || null, c.noteSigs || ['- Site admin']);
  renderWeights((r.config || {}).tradeWeights || {});
  renderHistory(r.history || {});
  renderPrime(r.prime || {});
  renderApi(r.siteApi || null);
}

/* The league data panel has to report its state on open, not just while it is
   running. Without this it showed an em dash on every visit, including
   immediately after a successful pull. */
function renderPrime(p) {
  var pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
  document.getElementById('primeBar').style.width = pct + '%';
  if (p.complete) {
    var failed = p.failureCount || 0;
    set('primeState', failed ? ('Loaded, ' + failed + ' unavailable') : 'Loaded');
  } else if (p.running) {
    set('primeState', 'Partly loaded (' + p.done + ' of ' + p.total + ')');
  } else {
    set('primeState', 'Not loaded');
  }
  // Week 6 (F3): Resume only while an unfinished job exists.
  var res = document.getElementById('primeResume');
  if (res) res.hidden = !(p.running && !p.complete);
  primeFails(p.complete ? (p.failedKeys || []) : []);
}
/* The datasets a finished pull could not load, by name. */
function primeFails(keys) {
  var ul = document.getElementById('primeFails');
  if (!ul) return;
  ul.innerHTML = keys.map(function (k) { return '<li><code>' + String(k).replace(/[<>&]/g, '') + '</code></li>'; }).join('');
  ul.hidden = !keys.length;
}
function set(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }

var VIS = [['visible', 'Visible'], ['admin', 'Admin only'], ['hidden', 'Not visible']];
/* A tool that arrived in the release the site is running (C8); never on the home page's own tiles. */
var NEW_TAG = '<span class="newtag" title="New in this release">New</span>';

function renderTools(tools) {
  var host = document.getElementById('toolRows');
  host.innerHTML = tools.map(function (t) {
    var current = VIS.filter(function (v) { return v[0] === t.visibility; })[0] || VIS[0];
    return '<div class="toolrow' + (t.isNew ? ' newtool' : '') + '"><span class="tname"><b>' + t.name + '</b>' + (t.isNew ? NEW_TAG : '') + '</span>'
      + '<div class="toolsel"><div class="xsel" data-toolkey="' + t.key + '" data-value="'
      + t.visibility + '">'
      + '<button type="button" class="xselbtn" aria-haspopup="listbox" aria-expanded="false">'
      + '<span class="xselval">' + current[1] + '</span><span class="xselchev"></span></button>'
      + '<ul class="xsellist" role="listbox">'
      + VIS.map(function (v) {
          return '<li role="option" data-v="' + v[0] + '"'
            + (v[0] === t.visibility ? ' class="on"' : '') + '>' + v[1] + '</li>';
        }).join('')
      + '</ul></div></div></div>';
  }).join('');

  host.querySelectorAll('[data-toolkey]').forEach(function (sel) {
    sel.addEventListener('xselect', async function (e) {
      var r = await call('/api/admin/tool-visibility',
        { tool: sel.dataset.toolkey, visibility: e.detail.value });
      note('msgTools', r.ok ? 'Saved.' : (r.error || 'Could not save.'), r.ok ? 'ok' : 'err');
      if (r.ok && r.tools) {
        renderTools(r.tools);
        // The order panel says which tiles reach the home page, so it follows a visibility change.
        var vis = {};
        r.tools.forEach(function (t) { vis[t.key] = t.visibility; });
        ORDER.tiles.forEach(function (t) { if (vis[t.key]) t.visibility = vis[t.key]; });
        renderOrder(ORDER);
        renderHomeSt();
      }
    });
  });
}

var ORDER = { tiles: [], custom: false };
var CHEV = {
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>'
};
var VIS_NOTE = { admin: 'Admin only', hidden: 'Not visible, so not on the home page', always: 'Admin only, always' };

function renderOrder(o, focus) {
  ORDER = o;
  var host = document.getElementById('orderRows');
  var n = o.tiles.length;
  host.innerHTML = o.tiles.map(function (t, i) {
    var noteText = VIS_NOTE[t.visibility] || '';
    return '<li class="orow' + (t.visibility === 'hidden' ? ' off' : '') + '" data-key="' + esc(t.key) + '">'
      + '<span class="oidx">' + String(i + 1).padStart(2, '0') + '</span>'
      + '<span class="oname"><b>' + esc(t.name) + '</b>' + (t.isNew ? NEW_TAG : '') + (noteText ? '<em>' + esc(noteText) + '</em>' : '') + '</span>'
      + '<span class="omove">'
      + '<button type="button" data-move="-1" aria-label="Move ' + esc(t.name) + ' up"' + (i === 0 ? ' disabled' : '') + '>' + CHEV.up + '</button>'
      + '<button type="button" data-move="1" aria-label="Move ' + esc(t.name) + ' down"' + (i === n - 1 ? ' disabled' : '') + '>' + CHEV.down + '</button>'
      + '</span></li>';
  }).join('');
  document.getElementById('orderReset').hidden = !o.custom;
  if (focus) {
    var row = host.querySelector('[data-key="' + focus.key + '"]');
    var btn = row && row.querySelector('[data-move="' + focus.dir + '"]');
    if (btn && btn.disabled) btn = row.querySelector('[data-move="' + (-focus.dir) + '"]');
    if (btn) btn.focus({ preventScroll: true });
  }
}

document.getElementById('orderRows').addEventListener('click', async function (e) {
  var btn = e.target.closest('[data-move]');
  if (!btn || btn.disabled) return;
  var key = btn.closest('.orow').dataset.key;
  var dir = Number(btn.dataset.move);
  var keys = ORDER.tiles.map(function (t) { return t.key; });
  var i = keys.indexOf(key), j = i + dir;
  if (i < 0 || j < 0 || j >= keys.length) return;
  keys[i] = keys[j]; keys[j] = key;
  // Drawn at once, then confirmed by what the server kept.
  var byKey = {};
  ORDER.tiles.forEach(function (t) { byKey[t.key] = t; });
  renderOrder({ tiles: keys.map(function (k) { return byKey[k]; }), custom: true }, { key: key, dir: dir });
  var r = await call('/api/admin/tool-order', { order: keys });
  note('msgOrder', r.ok ? 'Saved.' : (r.error || 'Could not save.'), r.ok ? 'ok' : 'err');
  if (r.ok && r.order) renderOrder(r.order, { key: key, dir: dir });
});

/* Season Statistics (plan D10, D31): the standings on the home page too. Forced on, and locked, while Season
   Statistics is not Visible, so every member can still see the standings. */
var HOMEST = { stored: false };
function renderHomeSt() {
  var host = document.getElementById('homeStRows');
  if (!host) return;
  var ss = (ORDER.tiles || []).filter(function (t) { return t.key === 'season-stats'; })[0];
  var vis = ss ? ss.visibility : 'visible';
  var locked = vis !== 'visible';
  var on = locked || HOMEST.stored;
  host.innerHTML = '<div class="cfgsw' + (locked ? ' locked' : '') + '"><span class="l">On the home page</span><span class="r">' + (on ? 'On' : 'Off') +
    '<button class="sw" role="switch" type="button" aria-checked="' + on + '" aria-label="Standings on the home page" id="homeStSwitch"' + (locked ? ' aria-disabled="true"' : '') + '></button></span></div>' +
    (locked ? '<p class="hint warnh">On while Season Statistics is ' + (vis === 'hidden' ? 'Hidden' : 'Admin-only') + ', so every member can still see the standings. It can be turned off once Season Statistics is Visible.</p>'
      : '<p class="hint">The standings always appear on Season Statistics. On also shows the same table on the home page, below the matchup card.</p>');
  document.getElementById('homeStSwitch').addEventListener('click', async function () {
    if (locked) return;
    var r = await call('/api/admin/home-standings', { on: !HOMEST.stored });
    note('msgHomeSt', r.ok ? 'Saved.' : (r.error || 'Could not save.'), r.ok ? 'ok' : 'err');
    if (r.ok) { HOMEST.stored = r.stored; renderHomeSt(); var b = document.getElementById('homeStSwitch'); if (b) b.focus({ preventScroll: true }); }
  });
}

var SESS_STOPS = [1, 2, 4, 8, 12, 24, 72, 168, 720, 2160, 'infinite'];
function sessWords(h) {
  if (h === 'infinite') return 'Infinite';
  if (h < 24) return h + (h === 1 ? ' hour' : ' hours');
  var d = h / 24;
  return d + (d === 1 ? ' day' : ' days');
}
function renderSession(h) {
  var i = SESS_STOPS.indexOf(h);
  var slide = document.getElementById('sessSlide');
  slide.value = String(i < 0 ? 3 : i);
  document.getElementById('sessVal').textContent = sessWords(SESS_STOPS[Number(slide.value)]);
  slide.setAttribute('aria-valuetext', sessWords(SESS_STOPS[Number(slide.value)]));
}
document.getElementById('sessSlide').addEventListener('input', function (e) {
  var w = sessWords(SESS_STOPS[Number(e.target.value)]);
  document.getElementById('sessVal').textContent = w;
  e.target.setAttribute('aria-valuetext', w);
});
document.getElementById('sessSlide').addEventListener('change', async function (e) {
  var h = SESS_STOPS[Number(e.target.value)];
  var r = await call('/api/admin/session-length', { hours: h });
  note('msgSess', r.ok ? 'Saved. Applies from the next sign-in.' : (r.error || 'Could not save.'), r.ok ? 'ok' : 'err');
  if (r.ok) renderSession(r.hours);
});

document.getElementById('orderReset').addEventListener('click', async function () {
  var r = await call('/api/admin/tool-order', { reset: true });
  note('msgOrder', r.ok ? 'Back to the default order.' : (r.error || 'Could not save.'), r.ok ? 'ok' : 'err');
  if (r.ok && r.order) renderOrder(r.order);
});

/* One row per statistic, grouped the way the tool groups them.
   All twenty-eight, not only the eleven a member can move: the other
   seventeen are fixed at whatever these say, so an administrator who cannot
   reach them cannot actually set the league's weighting. */
function renderWeights(saved) {
  var host = document.getElementById('weightRows');
  if (!host) return;
  var lastGroup = null;
  host.innerHTML = WEIGHT_ROWS.map(function (row) {
    var value = saved[row.id] === undefined ? row.w : saved[row.id];
    var head = '';
    if (row.g !== lastGroup) {
      lastGroup = row.g;
      head = '<div class="wgroup">' + esc(WEIGHT_GROUPS[row.g] || row.g) + '</div>';
    }
    return head +
      '<div class="wrow" data-row="' + row.id + '">' +
        '<span class="wname">' + esc(row.n) +
          (row.s ? '' : '<em>fixed for members</em>') + '</span>' +
        '<input class="wslide" type="range" min="0" max="200" step="5"' +
          ' value="' + Math.round(value * 100) + '"' +
          ' aria-label="Weight for ' + esc(row.n) + '">' +
        '<b class="wval">' + Math.round(value * 100) + '%</b>' +
        '<span class="wdef' + (Math.abs(value - row.w) > 1e-9 ? ' moved' : '') + '">' +
          'default ' + Math.round(row.w * 100) + '%</span>' +
      '</div>';
  }).join('');

  host.querySelectorAll('.wrow').forEach(function (rowEl) {
    var id = rowEl.dataset.row;
    var def = WEIGHT_ROWS.find(function (x) { return x.id === id; });
    var slider = rowEl.querySelector('.wslide');
    var out = rowEl.querySelector('.wval');
    var tag = rowEl.querySelector('.wdef');
    slider.addEventListener('input', function () {
      out.textContent = slider.value + '%';
      var differs = Math.abs(Number(slider.value) / 100 - def.w) > 1e-9;
      tag.classList.toggle('moved', differs);
    });
  });
}

function collectWeights() {
  var out = {};
  document.querySelectorAll('#weightRows .wrow').forEach(function (rowEl) {
    out[rowEl.dataset.row] = Number(rowEl.querySelector('.wslide').value) / 100;
  });
  return out;
}

function renderHistory(h) {
  set('histState', h.complete ? 'Loaded' : (h.running ? 'Partly loaded' : 'Not loaded'));
  // Only offer to resume when there is genuinely something part-finished.
  document.getElementById('histResume').hidden = !(h.running && !h.complete);
  var pct = h.total ? Math.round((h.done / h.total) * 100) : 0;
  document.getElementById('histBar').style.width = pct + '%';
  if (h.total) {
    document.getElementById('histDetail').textContent = h.done + ' of ' + h.total + ' steps'
      + (h.failureCount ? ' \\u00b7 ' + h.failureCount + ' failures' : '');
  }
}

document.querySelectorAll('[data-action]').forEach(function (btn) {
  btn.addEventListener('click', function () { act(btn.dataset.action, btn); });
});

async function act(action, btn) {
  btn.disabled = true;
  var label = btn.textContent; btn.textContent = 'Working';
  try {
    if (action === 'cookies') {
      var body = {
        espnS2: document.getElementById('newS2').value.trim(),
        swid: document.getElementById('newSwid').value.trim()
      };
      if (!body.espnS2 && !body.swid) { note('msgCookies', 'Enter at least one value.', 'err'); return; }
      var r = await call('/api/admin/cookies', body);
      note('msgCookies', r.ok ? 'Saved and verified against ESPN.' : (r.error || 'Could not save.'),
        r.ok ? 'ok' : 'err');
      if (r.ok) {
        document.getElementById('newS2').value = '';
        document.getElementById('newSwid').value = '';
        render(r);
      }
    }
    if (action === 'passwords') {
      var lp = document.getElementById('newLeaguePw').value;
      var ap = document.getElementById('newAdminPw').value;
      if (!lp && !ap) { note('msgPasswords', 'Enter at least one new password.', 'err'); return; }
      var r2 = await call('/api/admin/passwords', { leaguePassword: lp, adminPassword: ap });
      note('msgPasswords', r2.ok ? ('Saved.' + (r2.keyReplaced ? ' The Site API key was replaced at the same time; the old one stops within about a minute.' : '')) : (r2.error || 'Could not save.'), r2.ok ? 'ok' : 'err');
      if (r2.ok && r2.siteApi) renderApi(r2.siteApi);
      if (r2.ok) {
        if (ap) adminPw = ap;
        document.getElementById('newLeaguePw').value = '';
        document.getElementById('newAdminPw').value = '';
      }
    }
  } finally { btn.disabled = false; btn.textContent = label; }
}

document.getElementById('histRun').addEventListener('click', function () { pull(true); });
document.getElementById('histResume').addEventListener('click', function () { pull(false); });

async function primePull(restart) {
  var btn = document.getElementById('primeRun');
  var resumeBtn = document.getElementById('primeResume');
  btn.disabled = true; resumeBtn.disabled = true;
  primeFails([]);
  note('msgPrime', 'Running', 'info');
  var bar = document.getElementById('primeBar');

  var out = await runHistoryPull({
    restart: restart !== false,
    call: function (body) { return call('/api/admin/prime-batch', body); },
    onProgress: function (r) {
      renderPrime(r);
      note('msgPrime', 'Running', 'info');
    },
    onNote: function (t) { note('msgPrime', t, 'info'); }
  });

  btn.disabled = false; resumeBtn.disabled = false;
  if (out.ok) {
    var f = (out.status && out.status.failureCount) || 0;
    if (out.status) renderPrime(out.status);
    note('msgPrime', f
      ? ('Loaded, with ' + f + ' dataset' + (f === 1 ? '' : 's') + ' unavailable:')
      : 'All league data loaded.', f ? 'info' : 'ok');
  } else {
    note('msgPrime', out.error || 'Stopped. Resume to carry on, or Retry to start over.', 'err');
    resumeBtn.hidden = false;
  }
}

document.getElementById('primeRun').addEventListener('click', function () { primePull(true); });
document.getElementById('primeResume').addEventListener('click', function () { primePull(false); });

async function pull(restart) {
  var run = document.getElementById('histRun');
  var resume = document.getElementById('histResume');
  run.disabled = true; resume.disabled = true;
  note('msgHistory', 'Running', 'info');

  var out = await runHistoryPull({
    restart: restart,
    call: function (body) { return call('/api/admin/history-batch', body); },
    onProgress: function (r) { renderHistory(r); note('msgHistory', 'Running', 'info'); },
    onNote: function (t) { note('msgHistory', t, 'info'); }
  });

  run.disabled = false; resume.disabled = false;
  note('msgHistory', out.ok ? 'League history loaded.' : (out.error || 'Stopped.'),
    out.ok ? 'ok' : 'err');
}

function note(id, text, kind) {
  var el = document.getElementById(id);
  el.textContent = text; el.className = 'msg ' + (kind || 'err');
}

document.getElementById('weightSave').addEventListener('click', async function () {
  var r = await call('/api/admin/trade-weights', { weights: collectWeights() });
  note('msgWeights', r.ok ? 'Saved. Trade Analyzer will use this weighting.'
    : (r.error || 'Could not save.'), r.ok ? 'ok' : 'err');
  if (r.ok) renderWeights(r.tradeWeights || {});
});

document.getElementById('weightReset').addEventListener('click', async function () {
  // Saving nothing is what "use the defaults" means, so this is the same call
  // with every row at its shipped value rather than a separate path.
  var r = await call('/api/admin/trade-weights', { weights: {} });
  note('msgWeights', r.ok ? 'Reset to the shipped defaults.'
    : (r.error || 'Could not save.'), r.ok ? 'ok' : 'err');
  if (r.ok) renderWeights(r.tradeWeights || {});
});

/* Site API: the switch, the key's short name and dates, Replace now, Replace automatically, and Key in the
   address. The key itself is only ever on the Site API page. */
var API = null;
var API_IVS = [[30, 'Every 30 days'], [60, 'Every 60 days'], [90, 'Every 90 days'], [180, 'Every 180 days'], ['season', 'At Season End']];
function apiDate(iso) {
  if (!iso) return '';
  // Week 6 (A8): the site's one date style, with the year (a key's dates can be next year's).
  return window.fmtDate(iso, true) || String(iso).slice(0, 10);
}
function apiInDays(iso) {
  var d = Math.round((Date.parse(iso) - Date.now()) / 86400000);
  if (d <= 0) return 'today';
  return d === 1 ? 'tomorrow' : 'in ' + d + ' days';
}
function renderApi(f) {
  if (f) API = f;
  f = API;
  var host = document.getElementById('apiRows');
  if (!host || !f) return;
  var cur = API_IVS.filter(function (i) { return i[0] === f.interval; })[0] || API_IVS[2];
  var h = '<div class="cfgsw"><span class="l">API</span><span class="r">' + (f.on ? 'On' : 'Off') +
    '<button class="sw" role="switch" type="button" aria-checked="' + f.on + '" aria-label="API" id="apiSwitch"></button></span></div>' +
    '<p class="hint">Off turns every API request away with <code>api_off</code>. Downloads on the Site API page keep working.</p>';
  if (f.on && f.started) {
    h += '<span class="lbl2">The key</span>' +
      '<div class="row"><span>Short name</span><b>ending ' + esc(f.short) + '</b></div>' +
      '<div class="row"><span>Started</span><b>' + esc(apiDate(f.startedAt)) + '</b></div>' +
      '<div class="row"><span>Changes</span><b>' + esc(apiDate(f.changesAt)) + ' · ' + esc(apiInDays(f.changesAt)) + '</b></div>' +
      '<span class="lbl2">Replace now</span><div class="btnstack"><button type="button" class="ghost" id="apiReplace">Replace; old key works 7 more days</button>' +
      '<button type="button" class="minor" id="apiStop">Replace and stop the old key now</button></div>' +
      '<p class="hint">Use the first for a routine change. Use the second if the key has leaked: every program using the old key stops within about a minute.</p>';
  }
  h += '<span class="lbl2">Replace automatically</span><div class="xsel" id="apiInterval" data-value="' + esc(String(cur[0])) + '">' +
    '<button type="button" class="xselbtn" aria-haspopup="listbox" aria-expanded="false"><span class="xselval">' + esc(cur[1]) + '</span><span class="xselchev"></span></button>' +
    '<ul class="xsellist" role="listbox">' + API_IVS.map(function (i) {
      return '<li role="option" data-v="' + i[0] + '"' + (i === cur ? ' class="on"' : '') + '>' + esc(i[1]) + (i[0] === 90 ? '<small>Default</small>' : '') + '</li>';
    }).join('') + '</ul></div>' +
    '<p class="hint">Season End replaces the key when the site moves to its next season, on 1 August (UTC). A changed choice moves the due date, never the key.</p>' +
    '<div class="cfgsw" style="margin-top:8px"><span class="l">Key in the address</span><span class="r">' + (f.inAddress ? 'Allowed' : 'Header only') +
    '<button class="sw" role="switch" type="button" aria-checked="' + f.inAddress + '" aria-label="Key in the address" id="apiAddr"></button></span></div>' +
    '<p class="hint' + (f.inAddress ? '' : ' warnh') + '">' + (f.inAddress ? 'Lets tools that can’t send a header, like a Google Sheets formula, put the key in the address. Anyone who can see the sheet can see the key.' :
      'Keys in an address are refused with a message saying this site takes the key in a header only; a Google Sheets formula shows that message instead of its table.') + '</p>';
  host.innerHTML = h;
  document.getElementById('apiSwitch').addEventListener('click', function () { apiAct({ action: f.on ? 'off' : 'on' }, this); });
  document.getElementById('apiAddr').addEventListener('click', function () { apiAct({ action: 'settings', inAddress: !f.inAddress }, this); });
  var rep = document.getElementById('apiReplace');
  if (rep) rep.addEventListener('click', function () { apiAct({ action: 'replace', stop: false }, this); });
  var stp = document.getElementById('apiStop');
  if (stp) stp.addEventListener('click', function () { apiStopAsk(stp); });
  document.getElementById('apiInterval').addEventListener('xselect', function (e) {
    var v = e.detail.value;
    apiAct({ action: 'settings', interval: v === 'season' ? 'season' : Number(v) }, null);
  });
}
async function apiAct(body, btn) {
  if (btn) btn.disabled = true;
  var r = await call('/api/admin/site-api', body);
  if (btn) btn.disabled = false;
  if (!r.ok) { note('msgApi', r.error || 'Could not save.', 'err'); return; }
  var f = r.siteApi;
  var text = 'Saved.';
  if (body.action === 'on') text = 'The API is on. The key is the same as before.';
  else if (body.action === 'off') text = 'The API is off. Every request is answered api_off within about a minute.';
  else if (body.action === 'replace') text = body.stop ? 'Replaced. The old key stops within about a minute.'
    : 'Replaced. The old key works for 7 more days, until ' + apiDate(f.prev && f.prev.stopsAt) + '.';
  else if ('interval' in body) text = r.changed === 'due'
    ? 'Saved. The new due date had already passed, so the key was replaced; the old one works for 7 more days, until ' + apiDate(f.prev && f.prev.stopsAt) + '.'
    : 'Saved. The key’s due date moved to ' + apiDate(f.changesAt) + '; the key itself did not change.';
  renderApi(f);
  note('msgApi', text, 'ok');
}
var apiDlgOpener = null;
function apiStopAsk(opener) {
  var d = document.getElementById('apiStopDlg');
  apiDlgOpener = opener;
  d.hidden = false;
  var pane = d.querySelector('.instrbody'); if (pane) pane.scrollTop = 0;
  document.getElementById('apiStopYes').focus({ preventScroll: true });
}
function apiStopClose() {
  document.getElementById('apiStopDlg').hidden = true;
  var o = document.getElementById('apiStop') || apiDlgOpener;
  if (o && o.focus) o.focus({ preventScroll: true });
}
document.getElementById('apiStopDlg').addEventListener('click', function (e) { if (e.target === this) apiStopClose(); });
document.getElementById('apiStopNo').addEventListener('click', apiStopClose);
document.getElementById('apiStopYes').addEventListener('click', function () {
  document.getElementById('apiStopDlg').hidden = true;
  apiAct({ action: 'replace', stop: true }, null).then(function () { var o = document.getElementById('apiStop'); if (o) o.focus({ preventScroll: true }); });
});
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !document.getElementById('apiStopDlg').hidden) apiStopClose(); });
window.addEventListener('tzchange', function () { renderApi(null); });

/* Fortune Teller: where the pipeline stands, and the switch. */
var ftEnabled = false, ftTimer = null;
function ftRender(p) {
  var words = { early: 'Waiting for the season', available: 'Ready to build', building: 'Building', updating: 'Updating',
    ready: 'Live', 'season-over': 'Regular season over', failed: 'Failed', 'no-data': 'League data not pulled yet' };
  var st = p && p.state, b = p && p.build;
  document.getElementById('ftState').textContent = st ? (words[st] || st) : 'Not checked yet';
  document.getElementById('ftSeason').textContent = p && p.mpc ? ('Week ' + p.lastSettled + ' of ' + p.mpc + ' played' + (p.weeksLeft ? ', ' + p.weeksLeft + ' left' : '')) : '\u2014';
  document.getElementById('ftSize').textContent = st === 'early' && p.opensAfterWeek ? ('Opens after week ' + p.opensAfterWeek)
    : p && p.estimate ? (Number(p.estimate.paths).toLocaleString('en-US') + ' paths, about ' + (p.estimate.hours < 0.1 ? 'a few minutes' : p.estimate.hours < 24 ? p.estimate.hours.toFixed(1) + ' hours' : (p.estimate.hours / 24).toFixed(1) + ' days')) : '\u2014';
  var share = b && b.n ? Math.min(1, ((b.team || 0) + (b.parts > 1 && b.next !== 'merge' ? (b.part || 0) / b.parts : 0)) / b.n) : (st === 'ready' ? 1 : 0);
  document.getElementById('ftBar').style.width = Math.round(share * 100) + '%';
  document.getElementById('ftDetail').textContent = st === 'failed' ? ('The last attempt stopped: ' + (p.error || 'no reason recorded') + '. Rebuild to try again.')
    : st === 'building' || st === 'updating' ? ('Team ' + Math.min((b && b.team || 0) + 1, b && b.n || 0) + ' of ' + (b && b.n || '?') + '. It carries on without this page open.')
    : st === 'ready' ? ('The league is seeing the map through week ' + p.thru + '. It moves on by itself as each week settles.')
    : st === 'early' ? ('A build fits once week ' + p.opensAfterWeek + ' has been played. Switch it on now and it will start by itself then.')
    : st === 'available' ? 'A build fits now. Switch it on and it starts straight away.'
    : 'Maps every way the rest of the regular season can go.';
  ftEnabled = !!(p && p.enabled);
  document.getElementById('ftToggle').textContent = ftEnabled ? 'Switch off' : 'Switch on';
  document.getElementById('ftRebuild').hidden = !ftEnabled || st === 'building' || st === 'updating';
  clearTimeout(ftTimer); if (st === 'building' || st === 'updating') ftTimer = setTimeout(ftLoad, 20000);
}
async function ftLoad() {
  try { var d = await (await fetch('/api/fortune-teller', { credentials: 'same-origin' })).json(); ftRender(d.pipeline || null); } catch (e) { /* shown as not checked */ }
}
async function ftAct(action, id) {
  var btn = document.getElementById(id); btn.disabled = true;
  var r = await call('/api/admin/fortune-teller', { action: action });
  btn.disabled = false;
  note('msgFt', r.ok ? ({ enable: 'Switched on.', disable: 'Switched off.', check: 'Checked.', rebuild: 'Rebuilding.' }[action]) : (r.error || 'Could not change it.'), r.ok ? 'ok' : 'err');
  if (r.ok && r.pipeline) ftRender(Object.assign({}, r.pipeline, { enabled: r.enabled }));
}
document.getElementById('ftToggle').addEventListener('click', function () { ftAct(ftEnabled ? 'disable' : 'enable', 'ftToggle'); });
document.getElementById('ftCheck').addEventListener('click', function () { ftAct('check', 'ftCheck'); });
document.getElementById('ftRebuild').addEventListener('click', function () { ftAct('rebuild', 'ftRebuild'); });
ftLoad();

/* Week 6 (P9): the note from the Site Admin. The body is the small markup the toolbar writes; the preview runs the
   same rules the home page does (NOTE_JS), so what is shown here is what members see. */
var NOTE_PAGES = ${JSON.stringify(notePages())};
var NOTE = { note: null, sigs: ['- Site admin'], sig: 0, editing: -1 };
function notePreview() {
  var subj = document.getElementById('noteSubj').value.trim(), body = document.getElementById('noteBody').value;
  var sig = NOTE.sigs[NOTE.sig] || '';
  return '<h3>' + esc(subj || 'Subject') + '</h3><div class="notebody">' + (renderNote(body, NOTE_PAGES) || '<p class="hint">The note appears here as you type.</p>') + '</div>' + (sig ? '<p class="notesig">' + esc(sig) + '</p>' : '');
}
function notePaintPreview() { document.getElementById('notePrev').innerHTML = notePreview(); }
function noteState() {
  var n = NOTE.note;
  document.getElementById('noteState').textContent = n ? 'Showing since ' + fmtDateTime(n.at) : 'Nothing shown';
  document.getElementById('noteDel').disabled = !n;
}
function noteSigsPaint() {
  var box = document.getElementById('noteSigs');
  box.innerHTML = NOTE.sigs.map(function (s, i) {
    if (NOTE.editing === i) return '<div class="nsig on"><input class="ninput" data-i="' + i + '" value="' + esc(s) + '" maxlength="${NOTE_LIMITS.sig}" aria-label="Rename signature"><button type="button" class="ghost sm" data-act="done" data-i="' + i + '">Done</button></div>';
    return '<div class="nsig' + (i === NOTE.sig ? ' on' : '') + '"><button type="button" class="nsigpick" role="radio" aria-checked="' + (i === NOTE.sig) + '" data-i="' + i + '">' + esc(s) + '</button>'
      + '<span class="nsigacts"><button type="button" class="ghost sm" data-act="up" data-i="' + i + '"' + (i ? '' : ' disabled') + '>Move up</button>'
      + '<button type="button" class="ghost sm" data-act="ren" data-i="' + i + '">Rename</button>'
      + '<button type="button" class="ghost sm" data-act="del" data-i="' + i + '"' + (NOTE.sigs.length > 1 ? '' : ' disabled') + '>Remove</button></span></div>';
  }).join('') + (NOTE.sigs.length < ${NOTE_LIMITS.sigs} ? '<button type="button" class="ghost sm" data-act="add">Add a signature</button>' : '');
  var ed = box.querySelector('input[data-i]'); if (ed) ed.focus({ preventScroll: true });
  notePaintPreview();
}
function noteRender(n, sigs) {
  NOTE.note = n; NOTE.sigs = sigs && sigs.length ? sigs.slice() : ['- Site admin'];
  NOTE.sig = n && n.sig && NOTE.sigs.indexOf(n.sig) >= 0 ? NOTE.sigs.indexOf(n.sig) : 0;
  document.getElementById('noteSubj').value = n ? n.subject : '';
  document.getElementById('noteBody').value = n ? n.body : '';
  noteState(); noteSigsPaint();
}
async function noteSaveSigs() {
  var r = await call('/api/admin/note', { action: 'sigs', sigs: NOTE.sigs });
  note('msgNote', r.ok ? 'Signatures saved.' : (r.error || 'Could not save.'), r.ok ? 'ok' : 'err');
  if (r.ok) { NOTE.sigs = r.sigs; if (NOTE.sig >= NOTE.sigs.length) NOTE.sig = 0; noteSigsPaint(); }
}
document.getElementById('noteSubj').addEventListener('input', notePaintPreview);
document.getElementById('noteBody').addEventListener('input', notePaintPreview);
document.querySelectorAll('.p-note .ntool').forEach(function (b) {
  b.addEventListener('click', function () {
    var ta = document.getElementById('noteBody');
    var r = wrapSelection(ta.value, ta.selectionStart, ta.selectionEnd, b.dataset.k, b.dataset.a);
    ta.value = r.value; ta.focus({ preventScroll: true }); ta.setSelectionRange(r.start, r.end); notePaintPreview();
  });
});
document.getElementById('noteSigs').addEventListener('click', function (e) {
  var t = e.target.closest('button'); if (!t) return;
  var i = Number(t.dataset.i);
  if (t.classList.contains('nsigpick')) { NOTE.sig = i; noteSigsPaint(); return; }
  var a = t.dataset.act;
  if (a === 'add') { NOTE.sigs.push('- New signature'); NOTE.editing = NOTE.sigs.length - 1; noteSigsPaint(); return; }
  if (a === 'ren') { NOTE.editing = i; noteSigsPaint(); return; }
  if (a === 'done') { var v = document.querySelector('#noteSigs input[data-i="' + i + '"]').value.trim(); if (v) NOTE.sigs[i] = v; NOTE.editing = -1; noteSaveSigs(); return; }
  if (a === 'del') { NOTE.sigs.splice(i, 1); if (NOTE.sig >= NOTE.sigs.length || NOTE.sig === i) NOTE.sig = 0; else if (NOTE.sig > i) NOTE.sig--; noteSaveSigs(); return; }
  if (a === 'up' && i) { var x = NOTE.sigs[i - 1]; NOTE.sigs[i - 1] = NOTE.sigs[i]; NOTE.sigs[i] = x; if (NOTE.sig === i) NOTE.sig = i - 1; else if (NOTE.sig === i - 1) NOTE.sig = i; noteSaveSigs(); }
});
document.getElementById('noteSigs').addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && e.target.matches('input[data-i]')) { e.preventDefault(); var d = e.target.parentNode.querySelector('[data-act="done"]'); if (d) d.click(); }
});
document.getElementById('notePub').addEventListener('click', async function () {
  var r = await call('/api/admin/note', { action: 'publish', subject: document.getElementById('noteSubj').value, body: document.getElementById('noteBody').value, sig: NOTE.sigs[NOTE.sig] || '' });
  note('msgNote', r.ok ? 'Published. Every member sees it once, the next time they open the home page.' : (r.error || 'Could not publish.'), r.ok ? 'ok' : 'err');
  if (r.ok) { NOTE.note = r.note; noteState(); }
});
document.getElementById('noteDel').addEventListener('click', async function () {
  var r = await call('/api/admin/note', { action: 'remove' });
  note('msgNote', r.ok ? 'Removed. The home page no longer shows it.' : (r.error || 'Could not remove it.'), r.ok ? 'ok' : 'err');
  if (r.ok) { NOTE.note = null; noteState(); }
});
(function () {
  var pop = document.getElementById('notePop'), back = null;
  function shut() { pop.hidden = true; if (back && back.focus) back.focus({ preventScroll: true }); }
  document.getElementById('noteShow').addEventListener('click', function () {
    back = document.activeElement;
    document.getElementById('notePopBody').innerHTML = '<p class="noteeyebrow">Note from the Site Admin</p>' + notePreview().replace('<h3>', '<h2 id="notePopTitle">').replace('</h3>', '</h2>');
    pop.hidden = false; pop.querySelector('.vscroll').scrollTop = 0; window.dispatchEvent(new Event('resize'));
    document.getElementById('notePopGot').focus({ preventScroll: true });
  });
  document.getElementById('notePopGot').addEventListener('click', shut);
  pop.addEventListener('click', function (e) { if (e.target === pop) shut(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !pop.hidden) shut(); });
})();

async function call(url, body, pwOverride) {
  try {
    var res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json',
                 'x-admin-password': pwOverride || adminPw || '' },
      body: JSON.stringify(body || {})
    });
    var d = await res.json().catch(function () { return {}; });
    if (!d.ok && !d.error) d.error = 'Request failed (' + res.status + ').';
    d.status = res.status;
    return d;
  } catch (e) { return { ok: false, status: 0, error: 'Could not reach the server.' }; }
}`;

  return shell({
    action: backAction(), title: 'Site Configuration', theme, reduceMotion, rail, body,
    settings: true, stack: true, centred: true, extraCss: css, extraJs: js,
    overlays: `
  <div class="uplayer" id="notePop" hidden>
    <div class="upbox vwrap" role="dialog" aria-modal="true" aria-labelledby="notePopTitle">
      <div class="upbody vscroll" data-vscroll><div id="notePopBody"></div><button class="primary" id="notePopGot" type="button">Got it</button></div>
      <div class="vbar" hidden><div class="vbar-thumb"></div></div>
    </div>
  </div>
  <div class="instr" id="apiStopDlg" hidden role="dialog" aria-modal="true" aria-label="Stop the old key now?">
    <div class="instrwrap vwrap">
      <div class="instrbody vscroll" data-vscroll>
        <div class="instrhead"><h2>Stop the old key now?</h2></div>
        <div class="dlgbody"><p>A new key replaces it, and <b>every program using the old key stops within about a minute</b>. Use this if the key has leaked. Programs need the new key from the Site API page to work again.</p>
          <div class="dlgbtns"><button type="button" class="minor" id="apiStopYes" style="width:100%;padding:13px">Replace and stop the old key now</button>
          <button type="button" class="ghost" id="apiStopNo">Keep the old key</button></div></div>
      </div>
      <div class="vbar" hidden><div class="vbar-thumb"></div></div>
    </div>
  </div>`,
    instructions: [
      ['01', 'The Admin Password is asked for every time',
       'It is needed for each change rather than held onto, so leaving this page open gives nobody else the run of it. Every panel starts shut: choose its header to open it, and again to shut it.'],
      ['02', 'Keeping the league connected',
       'League connection shows what the site is pointed at. If pages start coming up empty, replace your ESPN cookies here and save \u2014 that is almost always the cause.'],
      ['03', 'Tools have three settings',
       'Visible to the league, admin-only, or hidden. Admin-only tools still appear on the home page with a lock, so the league can see they exist. A tool that arrived in this release is marked New here and in the order below.'],
      ['04', 'Home page order',
       'Move a tile up or down and the home page follows at once. Reset puts the shipped order back. A tool that arrived in this release is marked New, so you can see where it landed; the home page\u2019s tiles never are. Beneath the list, Standings on the home page shows the league table there as well as on Season Statistics; it stays on while Season Statistics is not Visible.'],
      ['05', 'Sign-in length',
       'The slider sets how long a member stays signed in before the League Password is asked for again, from one hour to infinite. It applies from the next sign-in. Changing the League Password signs everyone out.'],
      ['06', 'Note from the Site Admin',
       'Write a short note for everyone, shown once over the home page. Select words and use the buttons for bold, italic, a colour or a link to one of the site\u2019s pages; the preview shows exactly what members will see. Pick a signature from your saved list, or add, rename and reorder them. Publishing a new note shows it again to everyone; Remove note stops it showing.'],
      ['07', 'Site API',
       'Switch the API on or off, see when the key started and when it next changes, replace it now (gently, or at once after a leak), choose how often it is replaced, and whether it may travel in an address. The key itself is on the Site API page.'],
      ['08', 'Trade Analyzer weighting',
       'Sets what each statistic is worth when the tool judges a deal for your league. Anyone can still move the adjustable ones while they look at a trade; that never changes what you save here.'],
      ['09', 'Fortune Teller',
       'Switch it on and it builds the map by itself as soon as the league is close enough to the end of the regular season, then moves on each week. Check now asks it to look straight away; Rebuild starts the map again from scratch.'],
      ['10', 'Re-run a pull any time',
       'Refreshing league data, and re-pulling past seasons, can both be run again whenever you like. Neither loses anything by being repeated.'],
      ['11', 'Time zone is per person',
       'The zone under the gear is yours alone, not a league setting. Everyone picks their own.'],
    ] });
}
