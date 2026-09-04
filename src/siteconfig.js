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

export function siteConfigPage({ theme, reduceMotion, leagueName }) {
  const rail = `
    <p class="eyebrow">Restricted</p>
    ${displayTitle('Site Config')}
`;

  const body = `
    <section id="gate">
      <div class="panel">
        <span class="ghostmark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="1.6"><rect x="4" y="10.5" width="16" height="11"/>
          <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/><circle cx="12" cy="16" r="1.4"/></svg></span>
        ${passwordField({
          id: 'adminPw', label: 'Admin Password', autofocus: true,
          autocomplete: 'current-password',
        })}
        <button class="primary" id="unlock">Unlock</button>
        <div class="msg" id="gateMsg"></div>
      </div>
    </section>

    <section id="panel" hidden>
      <div class="panel">
        <div class="panelhead"><span class="t">League connection</span></div>
        <div class="row"><span>League ID</span><b id="leagueId">&mdash;</b></div>
        <div class="row"><span>Season</span><b id="season">&mdash;</b></div>
        <div class="row"><span>League type</span><b id="privacy">&mdash;</b></div>
        <div class="row"><span>History seasons</span><b id="history">&mdash;</b></div>
        <p class="hint" style="margin-bottom:0">League ID is fixed after setup.</p>
      </div>

      <div class="panel">
        <div class="panelhead"><span class="t">ESPN cookies</span></div>
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

      <div class="panel">
        <div class="panelhead"><span class="t">Passwords</span></div>
        ${passwordField({ id: 'newLeaguePw', label: 'New League Password',
          hint: 'Leave blank to keep the current one. Everyone will need the new one.' })}
        ${passwordField({ id: 'newAdminPw', label: 'New Admin Password',
          hint: 'Leave blank to keep the current one.' })}
        <button class="primary" data-action="passwords">Save passwords</button>
        <div class="msg" id="msgPasswords"></div>
      </div>

      <div class="panel">
        <div class="panelhead"><span class="t">Tools</span></div>
        <div id="toolRows"></div>
        <div class="msg" id="msgTools"></div>
      </div>

      <div class="panel">
        <div class="panelhead"><span class="t">League data</span></div>
        <div class="row"><span>Status</span><b id="primeState">&mdash;</b></div>
        <div class="bar"><i id="primeBar"></i></div>
        <p class="hint">Fetches every dataset once. Run this if a page is showing
           blanks, or after replacing your ESPN cookies.</p>
        <button class="primary" id="primeRun">Refresh all league data</button>
        <div class="msg" id="msgPrime"></div>
      </div>

      <div class="panel">
        <div class="panelhead"><span class="t">League history</span></div>
        <div class="row"><span>Status</span><b id="histState">&mdash;</b></div>
        <div class="bar"><i id="histBar"></i></div>
        <p class="hint" id="histDetail">Only re-pull when you need to. This may take a
       few minutes: please do not close or refresh this tab.</p>
        <button class="primary" id="histRun">Re-pull league history</button>
        <button class="ghost" id="histResume" style="margin-top:11px" hidden>Resume an interrupted pull</button>
        <div class="msg" id="msgHistory"></div>
      </div>

    </section>`;

  const css = `
    /* The gate is a single question on an otherwise empty page, so it is
       centred rather than left-aligned under a rail that has nothing in it.
       The header centres with it — a restricted-page title hanging off to one
       side of a centred prompt reads as two unrelated things. */
    .pagegrid.stack .rail { max-width:none; }
    .pagegrid.stack .railtext, .pagegrid.stack .titlebar { text-align:center; }
    .pagegrid.stack .railmark { margin:0 auto; }
    .pagegrid.stack .railtext .display { margin:0 auto; }
    .pagegrid.stack .railtext .eyebrow { justify-content:center; }
    body:has(#gate:not([hidden])) .main { display:flex; justify-content:center; }
    body:has(#gate:not([hidden])) #gate { width:min(100%,420px); }
    #gate .panel { text-align:center; }
    #gate .panel .fieldwrap, #gate .panel .msg { text-align:left; }

    /* Panels flow into columns once there is room for them, so a wide window
       reads as a control surface rather than one tall ribbon. Each panel keeps
       its own internal rhythm; only the arrangement changes. */
    /* Scoped so the grid never contradicts the hidden attribute. */
    #panel:not([hidden]) { display:grid; grid-template-columns:1fr; gap:0; align-items:start; }
    #panel > * { min-width:0; }
    @media (min-width:900px) {
      #panel:not([hidden]) { grid-template-columns:repeat(2,minmax(0,1fr)); gap:0 clamp(18px,2.2vw,32px); }
    }
    @media (min-width:1320px) {
      #panel:not([hidden]) { grid-template-columns:repeat(3,minmax(0,1fr)); }
    }
    #gate { max-width:520px; }

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
      letter-spacing:.14em; text-transform:uppercase;
      background:linear-gradient(94deg,var(--ink) 10%,var(--accent) 150%);
      -webkit-background-clip:text; background-clip:text;
      color:transparent; -webkit-text-fill-color:transparent; }
    .toolsel { flex:none; width:164px; }
    .toolsel .xselbtn { padding:9px 11px; }

  `;

  const js = HISTORY_RUNNER_JS + `
var adminPw = null;

document.getElementById('unlock').addEventListener('click', unlock);
document.getElementById('adminPw').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') unlock();
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
  renderHistory(r.history || {});
  renderPrime(r.prime || {});
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
}
function set(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }

var VIS = [['visible', 'Visible'], ['admin', 'Admin only'], ['hidden', 'Not visible']];

function renderTools(tools) {
  var host = document.getElementById('toolRows');
  host.innerHTML = tools.map(function (t) {
    var current = VIS.filter(function (v) { return v[0] === t.visibility; })[0] || VIS[0];
    return '<div class="toolrow"><span class="tname">' + t.name + '</span>'
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
      if (r.ok && r.tools) renderTools(r.tools);
    });
  });
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
      note('msgPasswords', r2.ok ? 'Saved.' : (r2.error || 'Could not save.'), r2.ok ? 'ok' : 'err');
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

async function primePull() {
  var btn = document.getElementById('primeRun');
  btn.disabled = true;
  note('msgPrime', 'Running', 'info');
  var bar = document.getElementById('primeBar');

  var out = await runHistoryPull({
    restart: true,
    call: function (body) { return call('/api/admin/prime-batch', body); },
    onProgress: function (r) {
      renderPrime(r);
      note('msgPrime', 'Running', 'info');
    },
    onNote: function (t) { note('msgPrime', t, 'info'); }
  });

  btn.disabled = false;
  if (out.ok) {
    var f = (out.status && out.status.failureCount) || 0;
    if (out.status) renderPrime(out.status);
    note('msgPrime', f
      ? ('Loaded, with ' + f + ' dataset' + (f === 1 ? '' : 's') + ' unavailable.')
      : 'All league data loaded.', f ? 'info' : 'ok');
  } else {
    note('msgPrime', out.error || 'Stopped.', 'err');
  }
}

document.getElementById('primeRun').addEventListener('click', primePull);

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
    instructions: [
      ['01', 'The Admin Password gates everything here',
       'It is asked for on each change rather than kept in a session, so leaving this page open grants nobody anything.'],
      ['02', 'Tool visibility has three states',
       'Visible to the league, hidden from everyone, or admin-only. Every tool is always built \u2014 this only controls who sees it.'],
      ['03', 'Re-run a pull any time',
       'Both the full data pull and the historical seasons pull can be run again from here. Neither loses anything by being repeated.'],
      ['04', 'Time zone is per person',
       'The zone under the gear is yours alone. It is stored in your browser, not in the league settings.'],
    ] });
}
