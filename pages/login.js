/**
 * The signed-out door.
 *
 * What an unauthenticated request gets, which is why nothing here may trigger
 * an upstream fetch: anything this page loads is something the open internet
 * can make the site do.
 */
import { shell, passwordField, displayTitle, selectField, esc, LOGO_FALLBACK_SVG, TEAM_COOKIE, CLOSE }
  from '../ui.js';
import { TOOLS, SITE_CONFIG_TOOL } from '../tools.js';

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
