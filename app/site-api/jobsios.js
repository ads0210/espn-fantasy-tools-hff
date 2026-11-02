/**
 * Site API: the iPhone and iPad jobs of the docket (K2, plan D32), S1-S8.
 *
 * Built on the measured facts of iOS Shortcuts (iOS 26.3 on an iPhone; iPad not verified): an HTML app shown by
 * Show Web View is a full page of our own, reached as Get File from Folder -> Text -> Make Rich Text -> Show Web View;
 * it may ask the API directly (the API answers any origin and allows the Authorization header), keeps its storage
 * between launches, closes with the blue check, and hands one result back to the shortcut through the clipboard. A
 * page script run from Safari's share sheet must call completion() within about a second and then carries on in the
 * page. Every app keeps the site's pace while it is open, waits on pace_changed and stops for good on too_fast,
 * remembering that in its own storage until its Reset button is pressed. test/jobkit.mjs runs every one in a browser
 * against the mock API with time sped up.
 *
 * `addIosJobs(g)` is called by makeGuides() with the guides' own helpers.
 */
/* eslint-disable */
export function addIosJobs(g) {
  var U = g.U, D = g.D, LOOK = g.LOOK, esc = g.esc, notif = g.notif, myMatch = g.myMatch, WEEK = g.WEEK, LEAGUE = g.LEAGUE, actions = g.actions;
  var standingsNow = g.standingsNow;
  var API = U('x').replace(/\/x$/, '');
  var SITE = API.replace(/\/api\/v1$/, '');

  /* ---- the shared kit, written into every app ---- */
  var BASE_CSS = ':root { color-scheme: dark; --bg: #0b100c; --panel: #131b15; --line: #26332a; --ink: #e8f3e6; --dim: #9aaa9d; --accent: #63ff4a; --amber: #ffb020; --red: #ff6b6b; }\n' +
    'html, body { height: 100%; margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.4 -apple-system, system-ui, sans-serif; -webkit-user-select: none; user-select: none; }\n' +
    'main { box-sizing: border-box; min-height: 100%; padding: 14px 14px calc(env(safe-area-inset-bottom, 0px) + 24px); }\n' +
    'h1 { margin: 0 0 4px; font-size: 13px; letter-spacing: .14em; text-transform: uppercase; color: var(--dim); }\n' +
    '.g { background: linear-gradient(96deg, var(--ink) 20%, var(--accent) 110%); -webkit-background-clip: text; background-clip: text; color: transparent; }\n' +
    '.card { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 12px; margin: 10px 0; }\n' +
    '.n { font-variant-numeric: tabular-nums; } .dim { color: var(--dim); } .bad { color: var(--red); } .warn { color: var(--amber); } .ok { color: var(--accent); }\n' +
    'button { font: 700 15px -apple-system, system-ui, sans-serif; color: var(--bg); background: var(--accent); border: 0; border-radius: 10px; padding: 11px 14px; margin: 4px 6px 4px 0; }\n' +
    'button.quiet { background: var(--line); color: var(--ink); }\n' +
    '#note { margin: 10px 0; color: var(--amber); min-height: 1em; } #note:empty { display: none; }\n';

  /* One request, as every app makes it: the stop note first, then the answer read for pace_changed and too_fast. */
  var KIT = "const KEY = { Authorization: 'Bearer %K%' };\nconst STOP = 'site-api-stopped-%NAME%';\n" +
    "const $ = (s) => document.querySelector(s);\nconst esc = (s) => String(s == null ? '' : s).replace(/[&<>\"]/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[x]));\n" +
    "const pts = (x) => (Math.round(Number(x || 0) * 100) / 100).toFixed(2);\n" +
    "const note = (t) => { $('#note').textContent = t || ''; };\n" +
    "const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* full or blocked */ } }, del(k) { try { localStorage.removeItem(k); } catch (e) { /* blocked */ } } };\n" +
    "addEventListener('error', (e) => note('Something went wrong: ' + (e.message || 'an error')));\n" +
    "addEventListener('unhandledrejection', (e) => note('Something went wrong: ' + ((e.reason && e.reason.message) || e.reason)));\n" +
    "/* Asks the site. Answers { data, meta, every } or { wait, message } (pace_changed) or { stop } (too_fast, kept until Reset). */\n" +
    "async function ask(url) {\n  const stopped = store.get(STOP);\n  if (stopped) return { stop: stopped };\n" +
    "  const res = await fetch(url, { headers: KEY });\n  const body = await res.json();\n  if (res.status === 429) {\n" +
    "    if (body.error.stop === 'exit') { store.set(STOP, body.error.message); return { stop: body.error.message }; }\n" +
    "    return { wait: Number(res.headers.get('Retry-After')) || 60, message: body.error.message };\n  }\n" +
    "  if (!body.ok) return { failed: body.error.message };\n" +
    "  return { data: body.data, meta: body.meta, every: Number(res.headers.get('X-Suggested-Interval')) || (body.meta.pace && body.meta.pace.askEverySeconds) || 60 };\n}\n" +
    "function stopped(message) {\n  note('Stopped by the site: ' + message + ' Fix whatever opens this app too often, then press Reset.');\n" +
    "  const b = document.createElement('button'); b.className = 'quiet'; b.textContent = 'Reset'; b.id = 'reset';\n" +
    "  b.addEventListener('click', () => { store.del(STOP); note(''); b.remove(); start(); });\n  $('main').appendChild(b);\n}\n";

  /* A live app asks while it is on screen, never sooner than the site's pace, and rests while it is hidden. */
  var LOOP = "let timer = null, nextAt = 0;\nasync function loop() {\n  clearTimeout(timer);\n  let wait = 60;\n  try {\n" +
    "    const a = await round();\n    if (a.stop) return stopped(a.stop);\n    if (a.failed) { note(a.failed); return; }\n" +
    "    if (a.wait) { note(a.message); wait = a.wait; } else { note(''); wait = a.every; }\n" +
    "  } catch (e) { note('No connection: trying again in a minute.'); }\n  nextAt = Date.now() + wait * 1000;\n  if (!document.hidden) timer = setTimeout(loop, wait * 1000);\n}\n" +
    "document.addEventListener('visibilitychange', () => { clearTimeout(timer); if (!document.hidden) timer = setTimeout(loop, Math.max(0, nextAt - Date.now())); });\n" +
    "function start() { loop(); }\n";
  /* An app that asks once when it opens; Refresh asks again no sooner than the pace allows. */
  var ONCE = "let nextAt = 0;\nasync function start() {\n  if (Date.now() < nextAt) { note('Up to date: the site allows another look at ' + new Date(nextAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '.'); return; }\n" +
    "  try {\n    const a = await round();\n    if (a.stop) return stopped(a.stop);\n    if (a.failed) { note(a.failed); return; }\n" +
    "    if (a.wait) { note(a.message); nextAt = Date.now() + a.wait * 1000; return; }\n    note(''); nextAt = Date.now() + a.every * 1000;\n" +
    "  } catch (e) { offline(); }\n}\nfunction offline() { note('No connection right now.'); }\n";
  /* The screen-on button: a wake lock, asked for inside the tap (the web view allows it only there). */
  var WAKE = "let lock = null;\nfunction wakeButton() {\n  if (!('wakeLock' in navigator)) return '';\n  return '<button class=\"quiet\" id=\"wake\">Keep screen on</button>';\n}\n" +
    "document.addEventListener('click', (e) => {\n  if (!e.target || e.target.id !== 'wake') return;\n" +
    "  if (lock) { lock.release(); lock = null; e.target.textContent = 'Keep screen on'; return; }\n" +
    "  navigator.wakeLock.request('screen').then((l) => { lock = l; e.target.textContent = 'Let the screen sleep'; l.addEventListener('release', () => { lock = null; e.target.textContent = 'Keep screen on'; }); }).catch(() => note('This screen can’t be kept on here.'));\n});\n";

  function page(o, c) {
    var kit = KIT.split('%K%').join(c.K).split('%NAME%').join(o.name);
    return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">\n' +
      '<title>' + o.title + '</title>\n<!-- ' + o.file + ': ' + o.desc + ' Keep it to yourself: it holds the league\'s key. -->\n' +
      '<style>\n' + BASE_CSS + (o.css || '') + '</style>\n</head>\n<body>\n<main>\n<h1>' + o.title + '</h1>\n' + (o.html || '') + '<div id="view"></div>\n<p id="note" role="status"></p>\n</main>\n<script>\n' +
      kit + (o.live ? LOOP : ONCE) + (o.wake ? WAKE : '') + o.script + 'start();\n</script>\n</body>\n</html>\n';
  }
  var APP_STEPS = function (file, extra) {
    return ['Save the file below as <code>' + file + '</code> in the Files app (iCloud Drive or On My iPhone). The league’s key and your team are filled in; keep it to yourself.',
      'In <b>Shortcuts</b>, make a new shortcut with four actions in this order: <b>Get File from Folder</b> (choose <code>' + file + '</code>), <b>Text</b> (holding only the File variable), <b>Make Rich Text from</b> that Text, and <b>Show Web View</b> with the Rich Text.']
      .concat(extra || [])
      .concat(['Close it with the blue check at the top (a downward swipe can close it too). Keep the phone upright.']);
  };
  var APP_STOP = 'Asks only while it is open, at the site’s pace. On <code>pace_changed</code> it shows the message and waits; on <code>too_fast</code> it shows the site’s message, remembers it, and asks nothing on any later launch until you press <b>Reset</b>.';

  /* ---- S1 Pocket matchup ---- */
  var pocket = { key: 'pocket', title: 'Pocket matchup: your game live in an app of its own', have: 'Your matchup full screen on your phone: both scores, both lineups with each player’s points, refreshed at the site’s pace while it is open, with a button that keeps the screen on.',
    steps: APP_STEPS('pocket-matchup.html', ['Run the shortcut from the Shortcuts app, the Home Screen or a widget. It refreshes while it is on screen and rests when it is not.']),
    file: 'pocket-matchup.html', lang: 'html',
    code: function (c) {
      return page({ title: 'Pocket matchup', file: 'pocket-matchup.html', desc: 'my matchup live, at the site\'s pace.', name: 'pocket-matchup', live: true, wake: true,
        html: '<div id="tools"></div>\n',
        css: '.score { display: grid; grid-template-columns: 1fr auto; gap: 4px 10px; align-items: baseline; }\n.score b { font-size: 30px; }\n.side h2 { font-size: 15px; margin: 0 0 6px; }\n' +
          '.p { display: grid; grid-template-columns: 44px 1fr auto; gap: 6px; padding: 5px 0; border-top: 1px solid var(--line); font-size: 14px; }\n.p.live { color: var(--accent); }\n',
        script: "const SCORE = '" + U('scoreboard', { team: c.T, name: 'pocket-matchup' }) + "';\nconst ROSTERS = '" + U('rosters', { name: 'pocket-matchup' }) + "';\nconst TEAM = " + c.T + ";\n" +
          "$('#tools').innerHTML = wakeButton();\n" +
          "async function round() {\n  const s = await ask(SCORE);\n  if (!s.data) return s;\n  const r = await ask(ROSTERS);                         // the same round: two requests together\n" +
          "  const m = s.data[0];\n  if (!m) { $('#view').innerHTML = '<p class=\"dim\">No game this week.</p>'; return s; }\n" +
          "  const rows = r.data || [];\n  const side = (t) => '<div class=\"card side\"><h2 class=\"g\">' + esc(t.team) + '</h2>' + rows.filter((p) => p.teamId === t.teamId && p.slot !== 'BE' && p.slot !== 'IR')\n" +
          "    .map((p) => '<div class=\"p ' + p.gameState + '\"><span class=\"dim\">' + esc(p.slot) + '</span><span>' + esc(p.player) + ' <span class=\"dim\">' + esc(p.nflTeam || '') + '</span></span><span class=\"n\">' + (p.gameState === 'pre' ? '–' : pts(p.points)) + '</span></div>').join('') + '</div>';\n" +
          "  $('#view').innerHTML = '<div class=\"card score\"><span class=\"g\">' + esc(m.home.team) + '</span><b class=\"n\">' + pts(m.home.points) + '</b><span class=\"g\">' + esc(m.away.team) + '</span><b class=\"n\">' + pts(m.away.points) + '</b>' +\n" +
          "    '<span class=\"dim\">' + m.state + ' · ' + (m.home.yetToPlay + m.away.yetToPlay) + ' still to play</span></div>' + side(m.home) + side(m.away);\n  return r.data ? s : r;\n}\n",
      }, c);
    },
    look: function (c) {
      var m = myMatch(c.T);
      var t = m ? m.home.team + '  ' + m.home.points.toFixed(2) + '\n' + m.away.team + '  ' + m.away.points.toFixed(2) : 'Your matchup, live';
      return LOOK.phone('<div class="widget"><div class="wt">Pocket matchup</div>' + t.split('\n').map(function (l) { return '<div class="ws"><span>' + esc(l) + '</span></div>'; }).join('') + '</div>', 'Both lineups follow beneath, each player’s points as they come in.');
    },
    stop: APP_STOP, _runs: 'At the site’s pace while open' };

  /* ---- S2 Front Office in your pocket ---- */
  var fo = { key: 'frontoffice', title: 'Front Office in your pocket', have: 'Front Office’s checklist before lock, the swaps it suggests and the best pickups, in an app on your phone.',
    steps: APP_STEPS('front-office.html', ['It needs Front Office to be visible to members. For a notification, set up <b>Lineup alert on Sunday</b> on this page: it uses the same check.']),
    file: 'front-office.html', lang: 'html',
    code: function (c) {
      return page({ title: 'Front Office', file: 'front-office.html', desc: 'my checklist, swaps and pickups from Front Office.', name: 'front-office-app',
        html: '<button id="again" class="quiet">Refresh</button>\n',
        css: 'li { margin: 6px 0; } .lvl { font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; margin-right: 6px; }\n',
        script: "const URL = '" + U('frontoffice', { team: c.T, name: 'front-office-app' }) + "';\n$('#again').addEventListener('click', () => start());\n" +
          "async function round() {\n  const a = await ask(URL);\n  const t = a.data && a.data[0];\n  if (!t) return a;\n" +
          "  const tone = { 'act now': 'bad', look: 'warn', note: 'dim' };\n" +
          "  const swaps = t.lineup.filter((p) => p.startInstead);\n" +
          "  $('#view').innerHTML = '<div class=\"card\"><b class=\"g\">' + esc(t.team) + '</b><div class=\"n\">Lineup ' + pts(t.totals.lineup) + ' · best ' + pts(t.totals.best) + ' · opponent ' + pts(t.totals.opponent) + '</div></div>' +\n" +
          "    '<div class=\"card\"><b>Before lock</b><ul>' + (t.checklist.length ? t.checklist.map((x) => '<li><span class=\"lvl ' + tone[x.level] + '\">' + x.level + '</span>' + esc(x.text) + '</li>').join('') : '<li class=\"ok\">Nothing to fix.</li>') + '</ul></div>' +\n" +
          "    (swaps.length ? '<div class=\"card\"><b>Start instead</b><ul>' + swaps.map((p) => '<li>' + esc(p.startInstead.player) + ' for ' + esc(p.player) + ' <span class=\"n ok\">+' + pts(p.startInstead.gain) + '</span></li>').join('') + '</ul></div>' : '') +\n" +
          "    '<div class=\"card\"><b>Pickups</b><ul>' + t.pickups.slice(0, 5).map((x) => '<li>' + esc(x.player) + ' <span class=\"dim\">' + esc(x.position + ' · ' + x.status) + '</span> <span class=\"n ok\">+' + pts(x.fitPerWeek) + '</span> <span class=\"dim\">drop ' + esc(x.drop.player) + '</span></li>').join('') + '</ul></div>';\n  return a;\n}\n",
      }, c);
    },
    look: function (c) {
      var t = (D.frontOffice || []).filter(function (x) { return x.teamId === +c.T; })[0];
      var urgent = t ? t.checklist.filter(function (x) { return x.level === 'act now'; }).map(function (x) { return x.text; }) : [];
      return LOOK.phone('<div class="widget"><div class="wt">Front Office · before lock</div>' + (urgent.length ? urgent.slice(0, 3) : ['Nothing to fix.']).map(function (l) { return '<div class="ws"><span>' + esc(l) + '</span></div>'; }).join('') + '</div>', 'Then the swaps it suggests and the five best pickups.');
    },
    stop: APP_STOP, _runs: 'When opened' };

  /* ---- S3 Who's this about? (Safari share sheet) ---- */
  var who = { key: 'who', title: 'Who’s this about? Your league beside any ESPN article', have: 'From Safari’s share sheet on an ESPN article or player page: every player it links to, with who has him in your league, or that he is free, and how much he would add to your lineups.',
    steps: ['Save the script below as <code>whos-this-about.js</code> in the Files app.',
      'Make a shortcut named <b>Who’s this about?</b> and turn on <b>Show in Share Sheet</b> (Safari web pages). Add <b>Get File from Folder</b> (the script) and <b>Run JavaScript on Web Page</b> with the File as its script.',
      'In <b>Settings → Apps → Shortcuts → Advanced</b>, turn on <b>Allow Running Scripts</b>.',
      'On an ESPN page in Safari, tap <b>Share → Who’s this about?</b>. A panel lists the players; tap × to close it. Front Office’s fit appears when Front Office is visible to members.'],
    file: 'whos-this-about.js', lang: 'js',
    code: function (c) {
      return "// whos-this-about.js: your league's view of every player an ESPN page links to. Run from Safari's share sheet.\n" +
        "// It holds the league's key: keep it to yourself. Asks two addresses together, once per run.\n" +
        "completion(null);                                   // Shortcuts needs an answer within a second; the work carries on in the page\n" +
        "(async function () {\n  const KEY = { Authorization: 'Bearer " + c.K + "' };\n  const STOP = 'site-api-stopped-whos-this-about';\n" +
        "  const ROSTERS = '" + U('rosters', { name: 'whos-this-about' }) + "';\n  const FO = '" + U('frontoffice', { team: c.T, name: 'whos-this-about' }) + "';\n" +
        "  const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[x]));\n" +
        "  if (window.__whosThisAbout) window.__whosThisAbout.remove();\n" +
        "  const host = document.createElement('div');\n  window.__whosThisAbout = host;\n" +
        "  host.style.cssText = 'position:fixed;left:8px;right:8px;top:8px;max-height:70vh;overflow:auto;z-index:2147483646';\n" +
        "  const root = host.attachShadow({ mode: 'open' });\n  document.documentElement.appendChild(host);\n" +
        "  const show = (html) => { root.innerHTML = '<style>.b{background:#0b100c;color:#e8f3e6;font:14px/1.4 -apple-system,system-ui,sans-serif;border:1px solid #26332a;border-radius:12px;padding:12px}' +\n" +
        "    '.r{display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-top:1px solid #26332a}.d{color:#9aaa9d}.m{color:#63ff4a}button{float:right;font:700 18px system-ui;background:none;color:#e8f3e6;border:0}</style>' +\n" +
        "    '<div class=\"b\"><button aria-label=\"Close\">×</button>' + html + '</div>'; root.querySelector('button').onclick = () => host.remove(); };\n" +
        "  root.addEventListener('click', (e) => { if (e.target && e.target.id === 'r') { localStorage.removeItem(STOP); host.remove(); } });\n" +
        "  try {\n    // ESPN player links carry the id: /player/_/id/1234567/... or playerId=1234567.\n    const ids = new Map();\n" +
        "    for (const a of document.querySelectorAll('a[href]')) {\n      const m = /\\/player\\/(?:[a-z]+\\/)?_\\/id\\/(\\d+)|[?&]playerId=(\\d+)/.exec(a.href);\n" +
        "      if (m) ids.set(Number(m[1] || m[2]), a.textContent.trim());\n    }\n" +
        "    if (!ids.size) return show('No ESPN player links on this page.');\n    const stopped = localStorage.getItem(STOP);\n" +
        "    if (stopped) return show('Stopped by the site: ' + esc(stopped) + ' <button id=\"r\">Reset</button>');\n" +
        "    show('Looking up ' + ids.size + ' players…');\n" +
        "    const [r, f] = await Promise.all([fetch(ROSTERS, { headers: KEY }), fetch(FO, { headers: KEY })]);\n" +
        "    const rb = await r.json();\n    if (r.status === 429) { if (rb.error.stop === 'exit') localStorage.setItem(STOP, rb.error.message); return show(esc(rb.error.message)); }\n" +
        "    if (!rb.ok) return show(esc(rb.error.message));\n    const fb = f.ok ? await f.json() : null;\n" +
        "    const mine = " + c.T + ";\n    const on = new Map(rb.data.map((p) => [p.playerId, p]));\n" +
        "    const fits = new Map(((fb && fb.ok && fb.data[0] && fb.data[0].pickups) || []).map((p) => [p.playerId, p]));\n" +
        "    show('<b>' + ids.size + ' players on this page</b>' + [...ids].map(([id, text]) => {\n      const p = on.get(id), x = fits.get(id);\n" +
        "      const where = p ? (p.teamId === mine ? '<span class=\"m\">yours</span>' : esc(p.team)) : x ? '<span class=\"m\">free: +' + x.fitPerWeek.toFixed(2) + ' a week for you</span>' : '<span class=\"d\">not on a team</span>';\n" +
        "      return '<div class=\"r\"><span>' + esc((p && p.player) || text || id) + '</span>' + where + '</div>';\n    }).join(''));\n" +
        "  } catch (e) { show('Could not reach the site: ' + esc(e.message)); }\n})();\n";
    },
    look: function (c) {
      var r = (D._rosterRows || []).filter(function (x) { return x.teamId !== +c.T; })[0];
      return LOOK.phone(notif('Who’s this about?', '3 players on this page', (r ? r.player + ': ' + r.team + ' · ' : '') + 'A free agent: +2.40 a week for you'), 'A panel over the article; the page itself is untouched.');
    },
    stop: 'It asks only when you run it, two addresses together. On <code>too_fast</code> it remembers the site’s message on that site and asks nothing until you press its <b>Reset</b>.', _runs: 'When you run it' };

  /* ---- S4 Siri briefing ---- */
  var siri = { key: 'siri', title: 'A Siri briefing: “Hey Siri, brief me”', have: 'Siri reads out your game’s three weightiest Matchup Insights and anything Front Office says to fix before lock. Hands-free.',
    steps: ['Make a new shortcut named <b>Brief me</b> with the actions below. Its first actions are the stopped-note check and error handling from <b>My live score</b>, once per address.',
      'Say “Hey Siri, brief me”. It needs Matchup Insights and Front Office to be visible to members; a part that is not just says so.'],
    file: 'Shortcut actions', lang: 'actions',
    actions: function (c) {
      return actions([
        ['', 'The stopped-note check and error handling, with <b>Get Contents of URL</b> <code>' + esc(U('insights', { name: 'siri-briefing' })) + '</code> · Headers: <code>Authorization</code> = <code>Bearer ' + esc(c.K) + '</code>'],
        ['ok', '<b>Get Dictionary Value</b> <code>data.games</code> · <b>Repeat with Each</b>: <b>If</b> <code>homeTeamId</code> or <code>awayTeamId</code> is ' + c.T + ', <b>Set Variable</b> Game'],
        ['ok', '<b>Get Dictionary Value</b> <code>insights</code> of Game · <b>Get Items from List</b> 1 to 3 · <b>Repeat with Each</b>: <b>Add to Variable</b> Brief its <code>text</code>'],
        ['', '<b>Get Contents of URL</b> <code>' + esc(U('frontoffice', { team: c.T, name: 'siri-briefing' })) + '</code> (same request round, same checks)'],
        ['ok', '<b>Get Dictionary Value</b> <code>data</code> · First Item · <code>checklist</code> · <b>Repeat with Each</b>: <b>If</b> <code>level</code> is not <code>note</code>, <b>Add to Variable</b> Brief its <code>text</code>'],
        ['ok', '<b>Combine Text</b> Brief with New Lines · <b>Speak Text</b>'],
      ]);
    },
    look: function (c) {
      var t = (D.frontOffice || []).filter(function (x) { return x.teamId === +c.T; })[0];
      var said = (t && t.checklist[0] ? t.checklist[0].text : 'Nothing to fix before lock.');
      return LOOK.phone(notif('Siri', 'Brief me', 'Your game: a must win… ' + said), 'Spoken aloud; nothing to look at.');
    },
    stop: 'It asks only when you ask Siri, two addresses in one round. The same stopped note as the live score shortcut.', _runs: 'When you ask Siri' };

  /* ---- S5 Share my week ---- */
  var share = { key: 'share', title: 'Share my week as a picture', have: 'A card of your week (the score, the result, your top player, and a record if one fell) drawn on your phone and handed to the share sheet as an image for the family chat.',
    steps: APP_STEPS('share-my-week.html', ['Tap <b>Share the card</b>: the share sheet opens with the picture. Where sharing a file is not offered, <b>Copy the result</b> copies the words instead.']),
    file: 'share-my-week.html', lang: 'html',
    code: function (c) {
      return page({ title: 'My week', file: 'share-my-week.html', desc: 'a picture of my week to share.', name: 'share-my-week',
        html: '<canvas id="card" width="1080" height="1080" style="width:100%;height:auto;border-radius:12px"></canvas>\n<button id="share">Share the card</button><button id="copy" class="quiet">Copy the result</button>\n',
        script: "const SCORE = '" + U('scoreboard', { team: c.T, name: 'share-my-week' }) + "';\nconst ROSTER = '" + U('rosters', { team: c.T, name: 'share-my-week' }) + "';\nconst INSIGHTS = '" + U('insights', { name: 'share-my-week' }) + "';\nconst TEAM = " + c.T + ";\n" +
          "let words = '';\nasync function round() {\n  const s = await ask(SCORE);\n  if (!s.data) return s;\n  const r = await ask(ROSTER), i = await ask(INSIGHTS);   // one round\n" +
          "  const m = s.data[0];\n  if (!m) { note('No game this week.'); return s; }\n  const me = m.home.teamId === TEAM ? m.home : m.away, them = m.home.teamId === TEAM ? m.away : m.home;\n" +
          "  const top = (r.data || []).filter((p) => p.slot !== 'BE' && p.slot !== 'IR').sort((a, b) => (b.points || 0) - (a.points || 0))[0];\n" +
          "  const g = i.data && i.data.games ? i.data.games.find((x) => x.homeTeamId === TEAM || x.awayTeamId === TEAM) : null;\n" +
          "  const rec = g ? g.insights.find((x) => x.category === 'records' || /record/i.test(x.label)) : null;\n" +
          "  const verdict = m.state !== 'final' ? (me.points >= them.points ? 'Leading' : 'Trailing') : me.points > them.points ? 'Won' : me.points < them.points ? 'Lost' : 'Tied';\n" +
          "  words = me.team + ' ' + pts(me.points) + ' – ' + pts(them.points) + ' ' + them.team + ' (' + verdict.toLowerCase() + ')' + (top ? '. Top player: ' + top.player + ', ' + pts(top.points) : '') + (rec ? '. ' + rec.text : '');\n" +
          "  const x = $('#card').getContext('2d');\n  x.fillStyle = '#0b100c'; x.fillRect(0, 0, 1080, 1080);\n  x.fillStyle = '#63ff4a'; x.fillRect(0, 0, 1080, 14);\n" +
          "  x.fillStyle = '#9aaa9d'; x.font = '700 40px -apple-system, system-ui, sans-serif'; x.fillText('WEEK ' + s.meta.week + ' · ' + verdict.toUpperCase(), 70, 130);\n" +
          "  x.fillStyle = '#e8f3e6'; x.font = '800 64px -apple-system, system-ui, sans-serif'; x.fillText(me.team.slice(0, 26), 70, 300);\n" +
          "  x.fillStyle = '#63ff4a'; x.font = '900 150px -apple-system, system-ui, sans-serif'; x.fillText(pts(me.points), 70, 460);\n" +
          "  x.fillStyle = '#9aaa9d'; x.font = '700 48px -apple-system, system-ui, sans-serif'; x.fillText('v ' + them.team.slice(0, 30) + '  ' + pts(them.points), 70, 560);\n" +
          "  x.fillStyle = '#e8f3e6'; x.font = '600 44px -apple-system, system-ui, sans-serif';\n  if (top) x.fillText('Top player: ' + top.player + ', ' + pts(top.points), 70, 720);\n" +
          "  if (rec) { x.fillStyle = '#ffb020'; x.font = '700 38px -apple-system, system-ui, sans-serif'; x.fillText(rec.text.slice(0, 52), 70, 820); }\n" +
          "  $('#card').toBlob((b) => { blob = b; }, 'image/png');   // ready before the tap: sharing must start inside it\n" +
          "  return i.data ? s : i;\n}\nlet blob = null;\n" +
          "$('#share').addEventListener('click', () => {\n  if (!blob) return note('The picture is not ready yet.');\n  const file = new File([blob], 'my-week.png', { type: 'image/png' });\n" +
          "  if (navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file], text: words }).catch(() => {});\n  else note('Sharing a picture isn’t offered here: use Copy the result.');\n});\n" +
          "$('#copy').addEventListener('click', () => { if (navigator.clipboard) navigator.clipboard.writeText(words).then(() => note('Copied.'), () => note('Copying was refused.')); });\n",
      }, c);
    },
    look: function (c) {
      var m = myMatch(c.T);
      return LOOK.phone(notif('Share', 'my-week.png', m ? m.home.team + ' ' + m.home.points.toFixed(2) + ' – ' + m.away.points.toFixed(2) + ' ' + m.away.team : 'Your week as a picture'), 'A square card, ready for any chat.');
    },
    stop: APP_STOP, _runs: 'When opened' };

  /* ---- S6 Standings in your pocket ---- */
  var standings = { key: 'standings', title: 'Standings in your pocket, even offline', have: 'The league table with all-play, luck, power and both playoff odds; it keeps the last copy, so it opens without a connection, marked with the time it was fetched.',
    steps: APP_STEPS('standings.html'),
    file: 'standings.html', lang: 'html',
    code: function (c) {
      return page({ title: 'Standings', file: 'standings.html', desc: 'the league table, kept for offline.', name: 'standings-app',
        html: '<button id="again" class="quiet">Refresh</button>\n',
        css: 'table { width: 100%; border-collapse: collapse; font-size: 13px; } th, td { padding: 6px 4px; text-align: center; border-top: 1px solid var(--line); } th { color: var(--dim); font-size: 11px; }\n',
        script: "const URL = '" + U('standings', { name: 'standings-app' }) + "';\nconst CACHE = 'standings-copy';\n$('#again').addEventListener('click', () => start());\n" +
          "const pct = (x) => (x == null ? '–' : (Math.round(x * 1000) / 10).toFixed(1) + '%');\n" +
          "function draw(rows, at, old) {\n  $('#view').innerHTML = '<p class=\"' + (old ? 'warn' : 'dim') + '\">' + (old ? 'Offline: as of ' : 'As of ') + new Date(at).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) + '</p>' +\n" +
          "    '<table><tr><th>#</th><th>Team</th><th>W-L</th><th>All-play</th><th>Luck</th><th>Power</th><th>Playoffs</th></tr>' + rows.map((t) => '<tr><td>' + t.seed + '</td><td class=\"g\">' + esc(t.team) + '</td><td class=\"n\">' + t.wins + '-' + t.losses + '</td>' +\n" +
          "    '<td class=\"n\">' + (t.allPlay ? t.allPlay.wins + '-' + t.allPlay.losses : '–') + '</td><td class=\"n\">' + (t.luck == null ? '–' : pts(t.luck)) + '</td><td class=\"n\">' + (t.power == null ? '–' : t.power) + '</td>' +\n" +
          "    '<td class=\"n\">' + (t.decided || pct(t.simPlayoffOdds != null ? t.simPlayoffOdds : t.playoffOdds)) + '</td></tr>').join('') + '</table>';\n}\n" +
          "const kept = (() => { try { return JSON.parse(store.get(CACHE)); } catch (e) { return null; } })();\nif (kept) draw(kept.rows, kept.at, true);\n" +
          "async function round() {\n  const a = await ask(URL);\n  if (a.data) { store.set(CACHE, JSON.stringify({ at: Date.now(), rows: a.data })); draw(a.data, Date.now(), false); }\n  return a;\n}\n" +
          "function offline() { note(kept ? 'No connection: showing the copy kept on this phone.' : 'No connection, and no copy kept yet.'); }\n",
      }, c);
    },
    look: function () {
      var s = standingsNow().slice(0, 4).map(function (t) { return t.seed + '. ' + t.team + '  ' + t.wins + '-' + t.losses; });
      return LOOK.phone('<div class="widget"><div class="wt">Standings</div>' + s.map(function (l) { return '<div class="ws"><span>' + esc(l) + '</span></div>'; }).join('') + '</div>', 'The whole table, with the time it was fetched.');
    },
    stop: APP_STOP, _runs: 'When opened' };

  /* ---- S7 Game-day board (iPad) ---- */
  var board = { key: 'board', title: 'Game-day board on an iPad (not verified on iPad)', have: 'Every matchup in the league at once, live, refreshed at the site’s pace, with the screen kept on: a coffee-table scoreboard. Built for an iPad; iOS Shortcuts has been measured on an iPhone only, so treat the iPad as untested.',
    steps: APP_STEPS('game-day-board.html', ['On an iPad, prop it up and tap <b>Keep screen on</b>. If the iPad shows it in portrait only, that is the web view’s rule, measured on iPhone.']),
    file: 'game-day-board.html', lang: 'html',
    code: function (c) {
      return page({ title: 'Game day', file: 'game-day-board.html', desc: 'every matchup live, at the site\'s pace.', name: 'game-day-board', live: true, wake: true,
        html: '<div id="tools"></div>\n',
        css: '#view { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 10px; }\n.m { display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; }\n.m b { font-size: 26px; } .m.live b { color: var(--accent); }\n',
        script: "const URL = '" + U('scoreboard', { name: 'game-day-board' }) + "';\n$('#tools').innerHTML = wakeButton();\n" +
          "async function round() {\n  const a = await ask(URL);\n  if (!a.data) return a;\n" +
          "  $('#view').innerHTML = a.data.map((m) => '<div class=\"card m ' + m.state + '\"><span class=\"g\">' + esc(m.home.team) + '</span><b class=\"n\">' + pts(m.home.points) + '</b><span class=\"g\">' + esc(m.away.team) + '</span><b class=\"n\">' + pts(m.away.points) + '</b><span class=\"dim\">' + m.state + '</span></div>').join('');\n  return a;\n}\n",
      }, c);
    },
    look: function () {
      var lines = D.scoreboard.slice(0, 3).map(function (m) { return m.home.team + ' ' + m.home.points.toFixed(2) + ' – ' + m.away.points.toFixed(2) + ' ' + m.away.team; });
      return LOOK.phone('<div class="widget"><div class="wt">Game day</div>' + lines.map(function (l) { return '<div class="ws"><span>' + esc(l) + '</span></div>'; }).join('') + '</div>', 'Every matchup, refreshing in place.');
    },
    stop: APP_STOP, _runs: 'At the site’s pace while open' };

  /* ---- S8 Copy a trade idea ---- */
  var trade = { key: 'trade', title: 'Copy a trade idea to Trade Analyzer', have: 'Pick players from your roster and another team’s on your phone; the app copies a Trade Analyzer link and the shortcut opens it in Safari.',
    steps: APP_STEPS('trade-idea.html', ['After <b>Show Web View</b>, add <b>Get Clipboard</b> and <b>Open URLs</b>: once you tap <b>Copy the link</b> and close the app with the blue check, Safari opens Trade Analyzer with the deal built.']),
    file: 'trade-idea.html', lang: 'html',
    code: function (c) {
      return page({ title: 'Trade idea', file: 'trade-idea.html', desc: 'build a deal and copy its Trade Analyzer link.', name: 'trade-idea',
        html: '<p class="dim">Trade with</p><div id="other" role="radiogroup" aria-label="Trade with"></div>\n<button id="copy">Copy the link</button>\n',
        css: '#other button[aria-checked="false"] { background: var(--line); color: var(--ink); } label.p { display: flex; gap: 8px; padding: 6px 0; border-top: 1px solid var(--line); } input { width: 20px; height: 20px; }\n',
        script: "const URL = '" + U('rosters', { name: 'trade-idea' }) + "';\nconst TEAM = " + c.T + ";\nconst SITE = '" + SITE + "';\nlet rows = [], other = null;\n" +
          "function draw() {\n  const list = (id) => rows.filter((p) => p.teamId === id).map((p) => '<label class=\"p\"><input type=\"checkbox\" data-t=\"' + id + '\" value=\"' + p.playerId + '\">' + esc(p.player) + ' <span class=\"dim\">' + esc(p.position + ', ' + p.nflTeam) + '</span></label>').join('');\n" +
          "  $('#view').innerHTML = '<div class=\"card\"><b class=\"g\">You send</b>' + list(TEAM) + '</div><div class=\"card\"><b class=\"g\">You get</b>' + list(other) + '</div>';\n}\n" +
          "$('#other').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; other = Number(b.dataset.id); [...$('#other').children].forEach((x) => x.setAttribute('aria-checked', String(x === b))); draw(); });\n" +
          "async function round() {\n  const a = await ask(URL);\n  if (!a.data) return a;\n  rows = a.data;\n  const teams = [...new Map(rows.filter((p) => p.teamId !== TEAM).map((p) => [p.teamId, p.team])).entries()];\n" +
          "  if (!teams.some(([id]) => id === other)) other = teams.length ? teams[0][0] : null;\n  $('#other').innerHTML = teams.map(([id, name]) => '<button type=\"button\" role=\"radio\" aria-checked=\"' + (id === other) + '\" data-id=\"' + id + '\">' + esc(name) + '</button>').join('');\n  draw();\n  return a;\n}\n" +
          "/* The link Trade Analyzer reads back: ?a=&b=&ao=&bo= with player ids joined by dots. Copied inside the tap. */\n" +
          "$('#copy').addEventListener('click', () => {\n  const ids = (t) => [...document.querySelectorAll('input[data-t=\"' + t + '\"]:checked')].map((x) => x.value).join('.');\n" +
          "  const link = SITE + '/apps/trade-analyzer/?a=' + TEAM + '&b=' + other + '&ao=' + ids(TEAM) + '&bo=' + ids(other);\n" +
          "  if (navigator.clipboard) navigator.clipboard.writeText(link).then(() => note('Copied. Close with the blue check to open it.'), () => note('Copying was refused.'));\n});\n",
      }, c);
    },
    look: function () { return LOOK.phone(notif('Safari', 'Trade Analyzer', 'Your deal, built and judged for both sides.'), 'The link opens in Safari, signed in as you.'); },
    stop: APP_STOP, _runs: 'When opened' };

  g.addJobs('iphone', [pocket, fo, who, siri, share, standings, board, trade]);
  [pocket, fo, who, siri, share, standings, board, trade].forEach(function (j) { g.RUNS['iphone.' + j.key] = j._runs; });
}
