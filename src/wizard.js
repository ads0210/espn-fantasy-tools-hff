/**
 * First-run setup wizard.
 *
 * One page, several steps, so a half-finished setup never strands the browser
 * on a URL that no longer means anything. Each step commits to the server as it
 * completes, so an interruption resumes rather than restarts.
 *
 * The progress indicator is a drive chart: five numbered segments that fill as
 * the setup advances, with the active one carrying the accent. It replaces a
 * generic progress bar because the steps are discrete and named, and because a
 * drive down the field is the metaphor the rest of the site already uses.
 */

import { shell, passwordField, displayTitle, esc, HISTORY_RUNNER_JS } from './ui.js';

const STEPS = [
  { n: '01', label: 'Access' },
  { n: '02', label: 'Passwords' },
  { n: '03', label: 'League' },
  { n: '04', label: 'Tools' },
  { n: '05', label: 'History' },
];

const LEAGUE_ID_HELP = `
  <b>Finding your League ID</b>
  <ol>
    <li>Open your league on the ESPN Fantasy site or app.</li>
    <li>Look at the web address while viewing your team.</li>
    <li>Find the part reading <b>leagueId=</b> followed by a number.</li>
    <li>That number is your League ID. Copy just the digits.</li>
  </ol>`;

const COOKIE_HELP = `
  <b>Finding your ESPN cookies</b>
  <p>This is the fiddliest step, and it needs a <b>desktop or laptop browser</b>
     — phone browsers cannot show cookies.</p>
  <ol>
    <li>On a computer, sign in to your league at fantasy.espn.com.</li>
    <li>Open developer tools: <b>F12</b>, or right-click the page and choose
        <b>Inspect</b>. On Safari, first enable the Develop menu under
        Settings &rarr; Advanced, then choose Develop &rarr; Show Web Inspector.</li>
    <li>Go to the <b>Application</b> tab (Chrome, Edge) or <b>Storage</b> tab
        (Firefox, Safari).</li>
    <li>In the sidebar open <b>Cookies</b>, then <b>https://fantasy.espn.com</b>.</li>
    <li>Find the rows named <b>espn_s2</b> and <b>SWID</b>.</li>
    <li>Copy each value exactly as shown. Do not edit them — <b>espn_s2</b>
        contains sequences like %2B and %2F that must stay exactly as they are,
        and <b>SWID</b> must keep its curly braces.</li>
  </ol>
  <p>These let the site read your private league. They are stored server-side
     and are never sent to anyone's browser.</p>`;

function driveChart() {
  return `<div class="drive" id="drive">${STEPS.map((s, i) => `
    <div class="seg" data-seg="${i + 1}">
      <span class="segn">${s.n}</span>
      <span class="segl">${esc(s.label)}</span>
    </div>`).join('')}</div>`;
}

export function wizardPage({ theme, reduceMotion, codeRequired, step = 1, leagueName }) {
  const codeStep = codeRequired
    ? `
      <p class="eyebrow">Step 01</p>
      <h2 class="stepttl">Take the field</h2>
      <p class="sub">Enter the one-time code from your build log.</p>
      <div class="panel">
        <span class="ghostnum">01</span>
        <div class="field-row">
          <label for="code">Setup code</label>
          <input id="code" type="text" autocomplete="off" autocapitalize="characters"
                 spellcheck="false" placeholder="XXXX-XXXX-XXXX" autofocus>
          <p class="hint">Cloudflare dashboard &rarr; your Worker &rarr; Deployments
             &rarr; newest build &rarr; build output. It is printed in a box near the end.</p>
        </div>
        <button class="primary" data-next="1">Continue</button>
        <div class="msg" id="msg1"></div>
      </div>`
    : `
      <p class="eyebrow">Step 01</p>
      <h2 class="stepttl">Take the field</h2>
      <p class="sub">This deployment is brand new and has not been configured.</p>
      <div class="panel">
        <span class="ghostnum">01</span>
        <div class="msg info" style="display:block;margin-top:0">
          <b>This site is not protected yet.</b> No setup code was generated at
          build time, so anyone who finds this address could configure it.
          Finish setup now.
        </div>
        <button class="primary" data-next="1">Begin setup</button>
        <div class="msg" id="msg1"></div>
      </div>`;

  const rail = `
    <p class="eyebrow">First run</p>
    ${displayTitle('Set Up')}
    <p class="sub">A few steps and your league is live.</p>
    ${driveChart()}`;

  const body = `
    <section class="step" data-step="1">${codeStep}</section>

    <section class="step" data-step="2" hidden>
      <p class="eyebrow">Step 02</p>
      <h2 class="stepttl">Two passwords</h2>
      <p class="sub">One for your league, one for you. Write them down &mdash; they can't be recovered.</p>
      <div class="panel">
        <span class="ghostnum">02</span>
        ${passwordField({ id: 'leaguePw', label: 'League Password',
          hint: 'Share with your league.' })}
        ${passwordField({ id: 'adminPw', label: 'Admin Password',
          hint: 'Keep this to yourself. Unlocks Site Configuration.' })}
        <button class="primary" data-next="2">Save passwords</button>
        <div class="msg" id="msg2"></div>
      </div>
    </section>

    <section class="step" data-step="3" hidden>
      <p class="eyebrow">Step 03</p>
      <h2 class="stepttl">Connect your league</h2>
      <p class="sub">Point the site at your ESPN league.</p>
      <div class="panel">
        <span class="ghostnum">03</span>
        <div class="field-row">
          <label for="leagueId">League ID</label>
          <input id="leagueId" type="text" inputmode="numeric" autocomplete="off"
                 placeholder="1234567890">
          <button class="helpbtn" type="button" data-help="helpLeague">Where do I find this</button>
          <div class="helpbox" id="helpLeague">${LEAGUE_ID_HELP}</div>
        </div>
        <div class="field-row">
          <label for="privacy">League type</label>
          <select id="privacy">
            <option value="true" selected>Private — needs my ESPN sign-in</option>
            <option value="false">Public — anyone can view it</option>
          </select>
          <p class="hint">Most leagues are private.</p>
        </div>
        <div id="cookieFields">
          <div class="field-row">
            <label for="espnS2">espn_s2 cookie</label>
            <input id="espnS2" type="text" autocomplete="off" spellcheck="false">
          </div>
          <div class="field-row">
            <label for="swid">SWID cookie</label>
            <input id="swid" type="text" autocomplete="off" spellcheck="false"
                   placeholder="{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}">
            <button class="helpbtn" type="button" data-help="helpCookies">Where do I find these</button>
            <div class="helpbox" id="helpCookies">${COOKIE_HELP}</div>
          </div>
        </div>
        <button class="primary" data-next="3">Test connection</button>
        <div class="msg" id="msg3"></div>
      </div>
    </section>

    <section class="step" data-step="4" hidden>
      <p class="eyebrow">Step 04</p>
      <h2 class="stepttl">Choose your tools</h2>
      <p class="sub">Change these any time in Site Configuration.</p>
      <div class="panel">
        <span class="ghostnum">04</span>
        <div id="toolList"></div>
        <button class="primary" data-next="4">Continue</button>
        <div class="msg" id="msg4"></div>
      </div>
    </section>

    <section class="step" data-step="5" hidden>
      <p class="eyebrow">Step 05</p>
      <h2 class="stepttl">Load your league</h2>
      <p class="sub">Two pulls, in order.</p>
      <div class="panel">
        <span class="ghostnum">05</span>
        <div id="primeIdle">
          <p class="hint" style="margin-top:0">Fetches your league and the current NFL
             season once, so nothing on the site is empty when you arrive.</p>
          <button class="primary" id="primeStart">Load league data</button>
        </div>
        <div id="primeRun" hidden>
          <div class="runline"><span id="primeText">Starting</span><b id="primePct">0%</b></div>
          <div class="bar"><i id="primeBar"></i></div>
          <p class="hint" id="primeDetail"></p>
        </div>
        <div id="histIdle" hidden>
          <p class="hint" style="margin-top:0">Past seasons and every game result. Several tools
             read this, so the site is not opened until it has run.</p>
          <button class="primary" id="histStart">Load past seasons</button>
          <div id="histBail" hidden>
            <p class="hint">Past seasons are still missing. Tools that read them will say
               so until the pull is finished from Site Configuration.</p>
            <button class="ghost" id="histSkip">Continue without past seasons</button>
          </div>
        </div>
        <div id="histRun" hidden>
          <div class="runline"><span id="histText">Starting</span><b id="histPct">0%</b></div>
          <div class="bar"><i id="histBar"></i></div>
          <p class="hint" id="histDetail"></p>
        </div>
        <!-- Applies to both pulls, so it is shown for the whole step rather than
             appearing alongside whichever one happens to be running. -->
        <p class="hint"><b>This may take a few minutes: please do not close or
           refresh this tab.</b></p>
        <div class="msg" id="msg5"></div>
      </div>
    </section>

    <section class="step" data-step="6" hidden>
      <p class="eyebrow">Ready</p>
      <h2 class="stepttl">You're all set</h2>
      <p class="sub">${esc(leagueName || 'Your league')} is configured and live.</p>
      <div class="panel">
        <span class="ghostnum">00</span>
        <div class="readyrow"><span>League Password</span><b>Share with your league</b></div>
        <div class="readyrow"><span>Admin Password</span><b>Keep to yourself</b></div>
        <button class="primary" id="done">Enter the site</button>
      </div>
    </section>`;

  const css = `
    /* Drive chart: discrete, named, numbered steps. */
    .drive { display:flex; gap:3px; margin:18px 0 4px; }
    @media (min-width:960px) {
      .drive { flex-direction:column; gap:5px; }
      .seg, .seg:first-child, .seg:last-child {
        clip-path:polygon(0 0, 100% 0, calc(100% - 9px) 100%, 0 100%);
        display:flex; align-items:baseline; gap:10px; padding:10px 12px;
      }
      .segl { display:block !important; margin-top:0; }
    }
    .stepttl { font-size:clamp(19px,2.4vw,25px); margin-bottom:8px; }
    .seg {
      flex:1; min-width:0; position:relative; background:var(--inset);
      border:1px solid var(--line); padding:8px 6px 7px;
      clip-path:polygon(0 0, calc(100% - 7px) 0, 100% 50%, calc(100% - 7px) 100%, 0 100%, 7px 50%);
      transition:background .3s ease, border-color .3s ease;
    }
    .seg:first-child { clip-path:polygon(0 0, calc(100% - 7px) 0, 100% 50%, calc(100% - 7px) 100%, 0 100%); }
    .seg:last-child  { clip-path:polygon(0 0, 100% 0, 100% 100%, 0 100%, 7px 50%); }
    .segn { display:block; font-size:11px; font-weight:900; letter-spacing:.06em;
            color:var(--ink-3); font-variant-numeric:tabular-nums; transition:color .3s ease; }
    .segl { display:block; font-size:8.5px; font-weight:800; letter-spacing:.14em;
            text-transform:uppercase; color:var(--ink-3); margin-top:2px;
            white-space:nowrap; overflow:hidden; text-overflow:ellipsis; transition:color .3s ease; }
    .seg.done { background:var(--accent-glow); border-color:var(--accent-deep); }
    .seg.done .segn { color:var(--accent); }
    .seg.on { background:var(--accent); border-color:var(--accent); }
    .seg.on .segn, .seg.on .segl { color:#04170A; }
    @media (max-width:430px) { .segl { display:none; } .seg { padding:9px 5px; } }

    .runline { display:flex; justify-content:space-between; align-items:baseline;
               font-size:12px; font-weight:700; text-transform:uppercase;
               letter-spacing:.12em; color:var(--ink-2); }
    .runline b { color:var(--accent); font-size:15px; font-variant-numeric:tabular-nums; }

    .readyrow { display:flex; justify-content:space-between; gap:12px;
                padding:10px 0; border-bottom:1px solid var(--line); font-size:13px; }
    .readyrow:last-of-type { border-bottom:0; }
    .readyrow span { color:var(--ink-2); }
    .readyrow b { color:var(--ink); text-align:right; }

    .toolpick { display:flex; gap:11px; align-items:flex-start; padding:12px 0;
                border-bottom:1px solid var(--line); cursor:pointer;
                text-transform:none; letter-spacing:0; font-size:14px;
                font-weight:500; color:var(--ink); margin:0; }
    .toolpick:last-child { border-bottom:0; }
    .toolpick input { width:auto; margin-top:3px; accent-color:var(--accent); }
    .toolpick b { display:block; font-size:14px; font-weight:700; }
    .toolpick i { display:block; font-style:normal; font-size:12.5px;
                  color:var(--ink-2); margin-top:2px; }
  `;

  const js = HISTORY_RUNNER_JS + `
var state = { step: 1, codeRequired: ${codeRequired ? 'true' : 'false'}, code: '' };

function show(n) {
  state.step = n;
  document.querySelectorAll('.step').forEach(function (s) {
    s.hidden = Number(s.dataset.step) !== n;
  });
  document.querySelectorAll('.seg').forEach(function (seg) {
    var i = Number(seg.dataset.seg);
    seg.classList.toggle('done', i < n);
    seg.classList.toggle('on', i === n);
  });
  window.scrollTo(0, 0);
}
function msg(n, text, kind) {
  var el = document.getElementById('msg' + n);
  if (!el) return;
  el.textContent = text || '';
  el.className = 'msg' + (text ? ' ' + (kind || 'err') : '');
}
function busy(btn, on, label) {
  btn.disabled = on;
  if (on) { btn.dataset.label = btn.textContent; btn.textContent = label || 'Working'; }
  else if (btn.dataset.label) btn.textContent = btn.dataset.label;
}

document.getElementById('privacy').addEventListener('change', function () {
  document.getElementById('cookieFields').hidden = this.value !== 'true';
});

document.querySelectorAll('[data-next]').forEach(function (btn) {
  btn.addEventListener('click', function () { handle(Number(btn.dataset.next), btn); });
});

async function handle(step, btn) {
  if (step === 1) {
    var codeEl = document.getElementById('code');
    state.code = codeEl ? codeEl.value : '';
    if (state.codeRequired && !state.code) { msg(1, 'Enter the setup code.'); return; }
    if (state.codeRequired) {
      busy(btn, true, 'Checking');
      var r = await post('/api/setup/check-code', { setupCode: state.code });
      busy(btn, false);
      if (!r.ok) { msg(1, r.error || 'That code is not correct.'); return; }
    }
    msg(1, ''); show(2); return;
  }

  if (step === 2) {
    busy(btn, true, 'Saving');
    var r2 = await post('/api/setup/passwords', {
      setupCode: state.code,
      leaguePassword: document.getElementById('leaguePw').value,
      adminPassword: document.getElementById('adminPw').value
    });
    busy(btn, false);
    if (!r2.ok) { msg(2, r2.error || 'Could not save.'); return; }
    msg(2, ''); show(3); return;
  }

  if (step === 3) {
    var priv = document.getElementById('privacy').value === 'true';
    var payload = {
      leagueId: document.getElementById('leagueId').value.trim(),
      leaguePrivate: priv,
      espnS2: priv ? document.getElementById('espnS2').value.trim() : '',
      swid: priv ? document.getElementById('swid').value.trim() : ''
    };
    if (!payload.leagueId) { msg(3, 'Enter your League ID.'); return; }
    busy(btn, true, 'Testing');
    var r3 = await post('/api/setup/league', payload);
    busy(btn, false);
    if (!r3.ok) { msg(3, r3.error || 'Could not reach that league.'); return; }
    msg(3, 'Connected to ' + (r3.leagueName || 'your league') + '.', 'ok');
    await loadTools();
    setTimeout(function () { msg(3, ''); show(4); }, 750);
    return;
  }

  if (step === 4) {
    var picked = [];
    document.querySelectorAll('[data-tool]').forEach(function (c) {
      if (c.checked) picked.push(c.dataset.tool);
    });
    busy(btn, true, 'Saving');
    var r4 = await post('/api/setup/tools', { tools: picked });
    busy(btn, false);
    if (!r4.ok) { msg(4, r4.error || 'Could not save.'); return; }
    msg(4, ''); show(5); return;
  }
}

document.getElementById('primeStart').addEventListener('click', runPrime);

/* Started by the reader rather than on arrival. It used to begin the moment the
   step appeared, which read as the page having done something on its own. Both
   pulls on this step now work the same way: you press a button, you watch a
   meter. */
async function runPrime() {
  document.getElementById('primeIdle').hidden = true;
  document.getElementById('primeRun').hidden = false;
  var bar = document.getElementById('primeBar');
  var text = document.getElementById('primeText');
  var pctEl = document.getElementById('primePct');
  var detail = document.getElementById('primeDetail');
  text.textContent = 'Loading league data';

  var out = await runHistoryPull({
    restart: true,
    call: function (body) { return post('/api/setup/prime-batch', body); },
    onProgress: function (r) {
      var pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
      bar.style.width = pct + '%';
      pctEl.textContent = pct + '%';
      text.textContent = r.retrying
        ? ('Retrying ' + r.retrying + ' item' + (r.retrying === 1 ? '' : 's'))
        : 'Loading league data';
      /* The same running commentary the history pull gives. Without it this
         meter can sit still for a while and look stuck. */
      detail.textContent = r.label ? (r.label + ' \u00b7 ' + r.done + ' of ' + r.total + ' steps') : '';
      msg(5, '');
    },
    onNote: function (t) { text.textContent = 'Paused'; msg(5, t, 'info'); }
  });

  if (!out.ok) {
    text.textContent = 'Stopped';
    msg(5, (out.error || 'Could not load league data.') +
      ' Press Load league data to carry on from where it stopped.');
    document.getElementById('primeRun').hidden = true;
    document.getElementById('primeIdle').hidden = false;
    return;
  }
  /* A pull that finished with failures has not finished. Advancing past it
     leaves datasets empty that nothing will later go back for, and the first
     anyone hears of it is a tool that looks broken — which is exactly how this
     was found. Retrying is offered instead, and the step does not open up. */
  var failed = out.ok ? (out.failureCount || 0) : 0;
  if (out.ok && !failed) {
    text.textContent = 'League data loaded';
    detail.textContent = 'All ' + (out.total || '') + ' steps complete.';
    pctEl.textContent = '100%';
    document.getElementById('primeBar').style.width = '100%';
    document.getElementById('histIdle').hidden = false;
  } else if (out.ok && failed) {
    text.textContent = 'Finished with failures';
    detail.textContent = failed + ' item' + (failed === 1 ? '' : 's') + ' did not load.';
    msg(5, failed + ' item' + (failed === 1 ? '' : 's') + ' did not load. '
      + 'Press Load league data to try those again before continuing.', 'err');
    document.getElementById('primeRun').hidden = true;
    document.getElementById('primeIdle').hidden = false;
  }
}

async function loadTools() {
  var r = await get('/api/setup/tools');
  document.getElementById('toolList').innerHTML = (r.tools || []).map(function (t) {
    return '<label class="toolpick"><input type="checkbox" data-tool="' + t.key + '" checked>'
      + '<span><b>' + t.name + '</b><i>' + t.description + '</i></span></label>';
  }).join('');
}

document.getElementById('histStart').addEventListener('click', runHistory);
document.getElementById('histSkip').addEventListener('click', function () { finishSetup(); });

/* Setup is only complete once both pulls have finished. The history pull used
   to be skippable, which was fine while nothing depended on it; several tools
   now read past seasons, and a site opened without them looks broken rather
   than incomplete. Claiming completion any earlier is also what used to strand
   the wizard on its own last step. */
async function finishSetup() {
  await post('/api/setup/finish', {});
  show(6);
}

var HIST_RESUME = false;
var HIST_ATTEMPTS = 0;

async function runHistory() {
  document.getElementById('histIdle').hidden = true;
  document.getElementById('histRun').hidden = false;
  var bar = document.getElementById('histBar');
  var text = document.getElementById('histText');
  var pctEl = document.getElementById('histPct');
  var detail = document.getElementById('histDetail');
  text.textContent = 'Loading history';

  var out = await runHistoryPull({
    // Restart on the first attempt, so a first-time setup does not inherit a
    // job document left behind by anything else along with its failure count.
    // A retry after a stall resumes instead: the work already done still counts.
    restart: !HIST_RESUME,
    call: function (body) { return post('/api/setup/history-batch', body); },
    onProgress: function (r) {
      var pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
      bar.style.width = pct + '%';
      pctEl.textContent = pct + '%';
      text.textContent = r.retrying
        ? ('Retrying ' + r.retrying + ' item' + (r.retrying === 1 ? '' : 's'))
        : 'Loading history';
      detail.textContent = r.label ? (r.label + ' \\u00b7 ' + r.done + ' of ' + r.total + ' steps') : '';
      msg(5, '');
    },
    onNote: function (t) { text.textContent = 'Paused'; msg(5, t, 'info'); }
  });

  if (!out.ok) {
    text.textContent = 'Stopped';
    document.getElementById('histRun').hidden = true;
    document.getElementById('histIdle').hidden = false;
    /* Resume rather than restart: the completed part of the job is still good,
       and re-fetching it would cost the same again for nothing. */
    HIST_RESUME = true;
    HIST_ATTEMPTS += 1;

    /* The pull is required, not compulsory. Making it unskippable stops someone
       clicking past data that several tools depend on; leaving no way out at all
       would stand between an owner and their own site because ESPN was having a
       bad afternoon. So the way through opens only once the pull has actually
       exhausted its retries, and says plainly what is still missing. */
    if (HIST_ATTEMPTS >= 2) {
      document.getElementById('histBail').hidden = false;
      msg(5, (out.error || 'The pull stopped.') +
        ' You can try again, or continue and run it later from Site Configuration.', 'info');
    } else {
      msg(5, (out.error || 'The pull stopped.') +
        ' Press Load past seasons to carry on from where it stopped.');
    }
    return;
  }
  text.textContent = 'History loaded';
  pctEl.textContent = '100%';
  msg(5, '');
  await finishSetup();
}

document.getElementById('done').addEventListener('click', function () { location.href = '/'; });

async function post(url, body) {
  try {
    var res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body) });
    var d = await res.json().catch(function () { return {}; });
    if (!d.ok && !d.error) d.error = 'Request failed (' + res.status + ').';
    d.status = res.status;
    return d;
  } catch (e) { return { ok: false, status: 0, error: 'Could not reach the server.' }; }
}
async function get(url) {
  try { return await (await fetch(url)).json(); } catch (e) { return { ok: false }; }
}
show(${step});
if (${step} >= 4) loadTools();`;

  return shell({ title: 'Set up ESPN Fantasy Tools', theme, reduceMotion, rail, body,
    extraCss: css, extraJs: js,
    instructions: [
      ['01', 'You only do this once',
       'Setup runs on a fresh deployment. Once it finishes, this page is replaced by the site itself.'],
      ['02', 'Two passwords, different jobs',
       'The League Password is shared with everyone who uses the site. The Admin Password is yours and is asked for on every administrative change.'],
      ['03', 'Private leagues need your cookies',
       'ESPN only serves a private league to a signed-in session. The two values are stored server-side and are never sent back to a browser.'],
      ['04', 'Both pulls matter',
       'The first fills the site so nothing is empty when you arrive. The second fetches past seasons, which several tools read.'],
      ['05', 'Leave the tab open',
       'Both pulls run from this page. It holds the screen awake and keeps going on its own \u2014 you do not need to nudge it along.'],
    ] });
}
