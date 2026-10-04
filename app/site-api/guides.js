/**
 * Site API: the platform guides.
 *
 * Eleven platforms and 37 jobs: each job's steps, its code with the league's address, key and team filled in,
 * a picture of it working, and how it stops. Every example keeps the pace and stops itself: it waits the pace
 * the site gives (or runs on a schedule slower than the slowest pace), pauses on pace_changed and stops for
 * good on too_fast, in whatever way its platform allows.
 *
 * The body below is the design sample's guides (src/30-guides.js and src/35-jobs2.js), carried over as they
 * were tested: every job's code was generated from them and run against a mock of the API that keeps the rate
 * window's own rule. A plain module. `makeGuides(env)` gives it the page's world:
 *   API          the site's /api/v1 address
 *   D            the rows its pictures draw on: scoreboard, _rosterRows, _activity, schedule, freeAgents, headToHead
 *   S            the page's state (S.guideTeam: the team the examples are filled in for)
 *   LEAGUE, WEEK the league's name and this week
 *   keyInExamples(), pace(), teamName(id), standingsNow(), and the page's formatting helpers.
 */
/* eslint-disable */
export function makeGuides(env) {
  var API = env.API, D = env.D, S = env.S, LEAGUE = env.LEAGUE, WEEK = env.WEEK, DAY = 86400000, MIN = 60000;
  var esc = env.esc, iso = env.iso, stamp = env.stamp, dayOf = env.dayOf, timeOf = env.timeOf, dateOf = env.dateOf, durWords = env.durWords;
  var keyInExamples = env.keyInExamples, pace = env.pace, teamName = env.teamName, standingsNow = env.standingsNow, toCsv = env.toCsv;
  var num = env.num;

  /* ======== the design sample's src/30-guides.js ======== */
  /* ==========================================================================
     Platform guides: one entry per platform, one per job. Every example keeps
     the rules by construction: it waits the site's pace (or runs on a schedule
     slower than the slowest pace), pauses on pace_changed and stops for good on
     too_fast, in whatever way its platform allows.
     ========================================================================== */
  var GL = {
    sheets: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="3.5" width="22" height="25"/><path d="M5 11h22M5 17.5h22M5 24h22M13 11v17.5"/></svg>',
    excel: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="24" height="24"/><path d="M4 10h24M11 10v18"/><path d="M15 24v-5M19 24v-8M23 24v-11" stroke-width="2.4"/></svg>',
    python: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 6c-3 0-4 1.5-4 4v3c0 2-1 3-2.5 3C5 16 6 17 6 19v3c0 2.5 1 4 4 4M22 6c3 0 4 1.5 4 4v3c0 2 1 3 2.5 3-1.5 0-2.5 1-2.5 3v3c0 2.5-1 4-4 4"/><text x="16" y="19.5" text-anchor="middle" font-size="8.5" font-weight="900" fill="currentColor" stroke="none" font-family="ui-monospace,monospace">py</text></svg>',
    node: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 6c-3 0-4 1.5-4 4v3c0 2-1 3-2.5 3C5 16 6 17 6 19v3c0 2.5 1 4 4 4M22 6c3 0 4 1.5 4 4v3c0 2 1 3 2.5 3-1.5 0-2.5 1-2.5 3v3c0 2.5-1 4-4 4"/><text x="16" y="19.5" text-anchor="middle" font-size="8.5" font-weight="900" fill="currentColor" stroke="none" font-family="ui-monospace,monospace">js</text></svg>',
    powershell: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="6" width="25" height="20" rx="1"/><path d="M8 12l5 4-5 4M15 21h8"/></svg>',
    shell: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="6" width="25" height="20" rx="1"/><path d="M3.5 10.5h25"/><text x="7.5" y="21.5" font-size="8.5" font-weight="900" fill="currentColor" stroke="none" font-family="ui-monospace,monospace">$_</text></svg>',
    iphone: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="3" width="14" height="26" rx="3"/><path d="M14 6h4"/><rect x="12" y="10" width="8" height="5" rx="1"/></svg>',
    android: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="3" width="14" height="26" rx="2"/><path d="M13 25.5h6"/><circle cx="16" cy="14" r="3.5"/><path d="M16 8v2.5"/></svg>',
    homeassistant: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 15 16 5l12 10M7.5 12.5V27h17V12.5"/><circle cx="16" cy="19" r="2.4"/><path d="M16 21.4V27M12.5 16l1.8 1.5M19.5 16l-1.8 1.5"/></svg>',
    chat: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h17v12H11l-5 4v-4H4z"/><path d="M24 11h4v11h-2v4l-4-4h-8v-2"/></svg>',
  };

  /* The address and the key, filled in for the reader. */
  function U(ep, q) {
    var parts = [];
    Object.keys(q || {}).forEach(function (k) { parts.push(k + '=' + q[k]); });
    var path = ep.indexOf('.csv') > 0 ? ep : ep;
    return API + '/' + path + (parts.length ? '?' + parts.join('&') : '');
  }
  function gctx() {
    var t = S.guideTeam;
    return { K: keyInExamples(), T: t, TN: teamName(t), p: pace() };
  }

  var STOPFILE = function (what) {
    return 'On <code>too_fast</code> it writes a <code>SITE_API_STOPPED</code> file beside the ' + (what || 'script') +
      ' with the site’s message and exits. Every run checks for that file first, so a scheduled run stays stopped until you fix the interval and delete the file. On <code>pace_changed</code> it waits for <code>Retry-After</code> and carries on at the new pace.';
  };

  function myMatch(t) {
    return D.scoreboard.filter(function (m) { return m.home.teamId === t || m.away.teamId === t; })[0];
  }
  function scoreLine(m) {
    return m.home.team + ' ' + m.home.points.toFixed(1) + ' - ' + m.away.points.toFixed(1) + ' ' + m.away.team + '  (' + (m.home.yetToPlay + m.away.yetToPlay) + ' yet to play)';
  }
  function leftToPlay(t) {
    return D._rosterRows.filter(function (r) { return r.teamId === t && r.gameState === 'pre' && r.slot !== 'BE' && r.slot !== 'IR'; });
  }
  function pct1(x) { return x == null ? '' : (Math.round(x * 1000 + 1e-6) / 10).toFixed(1) + '%'; }

  /* ---- small drawn stand-ins for "what it looks like working" ------------------------------------------------ */
  var LOOK = {
    term: function (lines, cap) {
      return '<div class="looks"><div class="term">' + lines.map(function (l) {
        if (typeof l === 'string') return esc(l);
        return '<span class="' + l[0] + '">' + esc(l[1]) + '</span>';
      }).join('\n') + '</div>' + (cap ? '<p class="cap">' + cap + '</p>' : '') + '</div>';
    },
    sheet: function (formula, rows, cap, err) {
      var cols = 'ABCDEFGH'.split('');
      var w = Math.min(cols.length, Math.max.apply(null, rows.map(function (r) { return r.length; })));
      var h = '<div class="looks"><div class="sheet"><div class="fx"><i>fx</i>' + esc(formula) + '</div><div class="scrollwrap"><div class="sbar" hidden><div class="sbar-thumb"></div></div><div class="scrollreal"><table><tr><th></th>' +
        cols.slice(0, w).map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr>';
      rows.forEach(function (r, i) {
        h += '<tr><td class="rn">' + (i + 1) + '</td>' + r.slice(0, w).map(function (c) {
          return '<td class="' + (i === 0 && !err ? 'hd' : err && i === 0 ? 'err' : '') + '">' + esc(c) + '</td>';
        }).join('') + '</tr>';
      });
      return h + '</table></div></div></div>' + (cap ? '<p class="cap">' + cap + '</p>' : '') + '</div>';
    },
    phone: function (inner, cap) { return '<div class="looks"><div class="phone">' + inner + '</div>' + (cap ? '<p class="cap">' + cap + '</p>' : '') + '</div>'; },
    chat: function (bot, embeds, cap) {
      return '<div class="looks"><div class="chat"><div class="who"><i></i>' + esc(bot) + ' <small>BOT · today at ' + esc(timeOf(Date.now())) + '</small></div>' +
        embeds.map(function (e) { return '<div class="emb">' + e + '</div>'; }).join('') + '</div>' + (cap ? '<p class="cap">' + cap + '</p>' : '') + '</div>';
    },
    files: function (rows, cap) {
      return '<div class="looks"><div class="files">' + rows.map(function (r) { return '<div class="' + (r[2] || '') + '"><span>' + esc(r[0]) + '</span><span>' + esc(r[1]) + '</span></div>'; }).join('') +
        '</div>' + (cap ? '<p class="cap">' + cap + '</p>' : '') + '</div>';
    },
  };
  function notif(app, title, text, cls) {
    return '<div class="notif ' + (cls || '') + '"><div class="ap"><span>' + esc(app) + '</span><span>now</span></div><b>' + esc(title) + '</b>' + esc(text) + '</div>';
  }
  function weeklyChart() {
    var weekly = {};
    D.schedule.forEach(function (m) {
      if (m.home.points == null) return;
      [m.home, m.away].forEach(function (s) { (weekly[s.team] = weekly[s.team] || {})[m.week] = s.points; });
    });
    var teams = Object.keys(weekly), W = 300, H = 150, pad = 26;
    var weeks = [1, 2, 3], ys = [];
    teams.forEach(function (t) { weeks.forEach(function (w) { if (weekly[t][w] != null) ys.push(weekly[t][w]); }); });
    var lo = Math.floor(Math.min.apply(null, ys) / 20) * 20, hi = Math.ceil(Math.max.apply(null, ys) / 20) * 20;
    var x = function (w) { return pad + (w - 1) * (W - pad - 10) / 2; };
    var y = function (v) { return H - 18 - (v - lo) / (hi - lo) * (H - 30); };
    var hues = ['#63FF4A', '#5BA8FF', '#FFB020', '#FF5C5C', '#FFD24D', '#B6FF3C', '#C792EA', '#4DD0E1', '#F48FB1', '#A1887F'];
    var h = '<svg class="minichart" viewBox="0 0 ' + W + ' ' + H + '"><path class="ax" d="M' + pad + ' 6 V' + (H - 18) + ' H' + (W - 6) + '"/>';
    [lo, (lo + hi) / 2, hi].forEach(function (v) { h += '<text x="' + (pad - 4) + '" y="' + (y(v) + 3) + '" text-anchor="end">' + Math.round(v) + '</text>'; });
    weeks.forEach(function (w) { h += '<text x="' + x(w) + '" y="' + (H - 5) + '" text-anchor="middle">W' + w + '</text>'; });
    teams.forEach(function (t, i) {
      var pts = weeks.filter(function (w) { return weekly[t][w] != null; });
      h += '<path d="' + pts.map(function (w, j) { return (j ? 'L' : 'M') + x(w).toFixed(1) + ' ' + y(weekly[t][w]).toFixed(1); }).join(' ') +
        '" fill="none" stroke="' + hues[i % hues.length] + '" stroke-width="1.6"' + (pts.indexOf(3) >= 0 ? '' : '') + '/>';
      pts.forEach(function (w) { h += '<circle cx="' + x(w).toFixed(1) + '" cy="' + y(weekly[t][w]).toFixed(1) + '" r="2" fill="' + hues[i % hues.length] + '"/>'; });
    });
    return h + '</svg>';
  }

  /* A shortcut's actions, drawn as the Shortcuts editor lists them. */
  function actions(list) {
    return '<div class="shortcut">' + list.map(function (a, i) {
      return '<div class="act ' + (a[0] || '') + '"><span class="ix">' + (i + 1) + '</span><span>' + a[1] + '</span></div>';
    }).join('') + '</div>';
  }

  var PLATFORMS = [
    { key: 'sheets', name: 'Google Sheets', glyph: GL.sheets, schedule: true,
      stops: 'A formula can’t be stopped by an answer; a script switches its own schedule off',
      jobs: [
        { key: 'standings', title: 'Keep the standings in a sheet', have: 'A tab that always shows the league table, refreshed by Sheets itself.',
          keyInAddress: true,
          steps: ['Open a new Google Sheet and click cell <b>A1</b>.',
            'Paste the formula below. The key travels in the address here, because <code>IMPORTDATA</code> can’t send a header.',
            'Press Enter. The standings appear with a header row. Sheets refreshes the import about once an hour, and when the sheet is opened, which is almost always less often than the site allows.',
            'Select the <b>playoffOdds</b> and <b>simPlayoffOdds</b> columns and choose Format → Number → Percent.',
            'Keep the sheet private: anyone who can open it can read the key in the formula.'],
          file: 'Cell A1', lang: 'formula',
          code: function (c) { return '=IMPORTDATA("' + U('standings.csv', { key: c.K, name: 'standings-sheet' }) + '")'; },
          look: function (c) {
            var rows = [['seed', 'teamId', 'team', 'wins', 'losses', 'ties', 'pointsFor', 'pointsAgainst']].concat(standingsNow().slice(0, 6).map(function (r) {
              return [r.seed, r.teamId, r.team, r.wins, r.losses, r.ties, r.pointsFor, r.pointsAgainst];
            }));
            return LOOK.sheet('=IMPORTDATA("…/standings.csv?key=eft_…")', rows, 'Refreshed by Sheets about hourly. If the site ever refuses, cell A1 shows the site’s message in place of the table until the next refresh.');
          },
          stop: 'A formula can’t read an error or switch itself off, and Sheets shows only <code>#N/A</code> for a refusal. So the site answers Google Sheets differently: a refusal arrives as one cell of text, <code>Site API: …</code>, with the reason, in place of the table. Sheets tries again at its next refresh, about an hour later. To stop it for good, delete the formula.' },
        { key: 'left', title: 'List who’s left to play', have: 'Your starters whose games haven’t kicked off, as a short list that updates itself.',
          keyInAddress: true,
          steps: ['In any empty cell of your sheet, paste the formula below. Your team is already filled in (<code>team=%T%</code>).',
            '<code>QUERY</code> keeps the rows whose game state is <code>pre</code> and leaves out the bench and IR. If the site refuses, <code>IFERROR</code> shows its one-cell message instead.',
            'The list shrinks through the week as games kick off. Sheets refreshes it about hourly.'],
          file: 'Any cell', lang: 'formula',
          code: function (c) {
            return '=LET(data, IMPORTDATA("' + U('rosters.csv', { team: c.T, key: c.K, name: 'left-to-play' }) + '"), ' +
              'IFERROR(QUERY(data, "select Col5, Col6, Col7, Col8, Col10 where Col9 = \'pre\' and Col3 <> \'BE\' and Col3 <> \'IR\' ' +
              'label Col5 \'Player\', Col6 \'Pos\', Col7 \'NFL\', Col8 \'Opponent\', Col10 \'Kickoff (UTC)\'", 1), data))';
          },
          look: function (c) {
            var left = leftToPlay(c.T);
            var rows = [['Player', 'Pos', 'NFL', 'Opponent', 'Kickoff (UTC)']].concat(left.length ? left.map(function (r) {
              return [r.player, r.position, r.nflTeam, r.opponent || '', (r.kickoff || '').replace('T', ' ').replace(':00Z', '')];
            }) : [['(everyone has played)', '', '', '', '']]);
            return LOOK.sheet('=LET(data, IMPORTDATA("…/rosters.csv?team=' + c.T + '…"), IFERROR(QUERY(data, …), data))', rows, left.length + ' of ' + c.TN + '’s starters still to play this week.');
          },
          stop: 'As for the standings: a refusal arrives as one cell of text, which <code>QUERY</code> can’t read, so <code>IFERROR</code> shows that message in its place until the next hourly refresh. Deleting the formula stops it for good.' },
        { key: 'log', title: 'Log league activity as rows', have: 'An Activity tab gaining a row for every completed add, drop and trade, and every trade offer, with each offer’s status kept current. Pending waiver claims never appear.',
          steps: ['In your sheet, open <b>Extensions → Apps Script</b>.',
            'Replace everything in <code>Code.gs</code> with the script below and save.',
            'Open <b>Project Settings → Script properties</b> and add <code>SITE_API_KEY</code> with the league’s key as its value. The key stays out of the sheet.',
            'Choose <code>start</code> in the toolbar and press Run. Allow access when Google asks. It fills the Activity tab now, then checks every 30 minutes, less often than the site ever asks for.',
            'To stop it yourself, run <code>stop</code>.'],
          file: 'Code.gs', lang: 'js',
          code: function (c) {
            return "// League activity, one row per transaction, checked every 30 minutes.\n" +
              "const URL = '" + U('activity', { name: 'activity-log' }) + "';\n\n" +
              "function start() {\n  stop();\n  ScriptApp.newTrigger('check').timeBased().everyMinutes(30).create();\n  check();\n}\n\n" +
              "function stop() {\n  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));\n}\n\n" +
              "function check() {\n  const key = PropertiesService.getScriptProperties().getProperty('SITE_API_KEY');\n" +
              "  const res = UrlFetchApp.fetch(URL, { headers: { Authorization: 'Bearer ' + key }, muteHttpExceptions: true });\n" +
              "  const body = JSON.parse(res.getContentText());\n" +
              "  if (res.getResponseCode() === 429) {\n" +
              "    if (body.error.stop === 'exit') {            // too_fast: switch the schedule off for good\n" +
              "      stop();\n" +
              "      MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'Site API stopped your activity log', body.error.message);\n" +
              "    }\n" +
              "    return;                                       // pace_changed: the next run is 30 minutes away\n  }\n" +
              "  if (!body.ok) throw new Error(body.error.message);\n\n" +
              "  const book = SpreadsheetApp.getActive();\n" +
              "  const sheet = book.getSheetByName('Activity') || book.insertSheet('Activity');\n" +
              "  if (sheet.getLastRow() === 0) sheet.appendRow(['id', 'at', 'week', 'kind', 'status', 'teams', 'added', 'dropped']);\n" +
              "  const ids = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues().flat();\n" +
              "  const who = (ps) => ps.map((p) => `${p.player} (${p.position})`).join(', ');\n" +
              "  body.data.slice().reverse().forEach((r) => {             // oldest first, so new rows land at the bottom\n" +
              "    const at = ids.indexOf(r.id);\n" +
              "    if (at >= 0) return sheet.getRange(at + 1, 5).setValue(r.status);   // a trade's status moves on in its row\n" +
              "    sheet.appendRow([r.id, new Date(r.at), r.week, r.kind, r.status,\n" +
              "      r.teams.map((t) => t.team).join(' / '), who(r.added), who(r.dropped)]);\n  });\n}\n";
          },
          look: function () {
            var rows = [['id', 'at', 'week', 'kind', 'status', 'teams', 'added']].concat(D._activity.slice(0, 6).map(function (r) {
              return [r.id.slice(0, 8) + '…', dayOf(Date.parse(r.at)), r.week, r.kind, r.status, r.teams.map(function (t) { return t.team; }).join(' / '),
                r.added.map(function (p) { return p.player; }).join(', ') || (r.sides.length ? r.sides.map(function (s) { return s.sends.map(function (p) { return p.player; }).join(', '); }).join(' ⇄ ') : '')];
            }));
            return LOOK.sheet('Activity', rows, 'Newest at the bottom. A trade keeps its row; its status column moves on (withdrawn, rejected, expired, completed).');
          },
          stop: 'On <code>too_fast</code> the script deletes its own schedule and emails you the site’s message, so it asks nothing more until you run <code>start</code> again. On <code>pace_changed</code> it skips the run; the next is 30 minutes away.' },
        { key: 'email', title: 'A daily email of the standings (Apps Script)', have: 'The league table in your inbox every morning.',
          steps: ['Open <b>Extensions → Apps Script</b> in any sheet (or a new project at script.google.com).',
            'Paste the script below into <code>Code.gs</code>, and add <code>SITE_API_KEY</code> under <b>Project Settings → Script properties</b>.',
            'Run <code>start</code> once and allow access. The email arrives every morning at about 8.',
            'Run <code>send</code> to try it now, and <code>stop</code> to end it.'],
          file: 'Code.gs', lang: 'js',
          code: function (c) {
            return "// The standings by email every morning at about 8.\n" +
              "const URL = '" + U('standings', { name: 'standings-email' }) + "';\n\n" +
              "function start() {\n  stop();\n  ScriptApp.newTrigger('send').timeBased().everyDays(1).atHour(8).create();\n}\n\n" +
              "function stop() {\n  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));\n}\n\n" +
              "function send() {\n  const key = PropertiesService.getScriptProperties().getProperty('SITE_API_KEY');\n" +
              "  const res = UrlFetchApp.fetch(URL, { headers: { Authorization: 'Bearer ' + key }, muteHttpExceptions: true });\n" +
              "  const body = JSON.parse(res.getContentText());\n  const me = Session.getEffectiveUser().getEmail();\n" +
              "  if (!body.ok) {\n    if (body.error.stop === 'exit') stop();          // too_fast: switch the schedule off for good\n" +
              "    MailApp.sendEmail(me, 'Site API: no standings today', body.error.message);\n    return;\n  }\n" +
              "  const pct = (x) => (x == null ? '' : (Math.round(x * 1000 + 1e-6) / 10).toFixed(1) + '%');\n" +
              "  const rows = body.data.map((t) => `<tr><td>${t.seed}</td><td>${t.team}</td>` +\n" +
              "    `<td>${t.wins}-${t.losses}${t.ties ? '-' + t.ties : ''}</td><td>${t.pointsFor}</td><td>${pct(t.playoffOdds)}</td></tr>`);\n" +
              "  MailApp.sendEmail({ to: me, subject: `${body.meta.league}: standings, week ${body.meta.week}`,\n" +
              "    htmlBody: '<table><tr><th>#</th><th>Team</th><th>Record</th><th>PF</th><th>Playoff %</th></tr>' + rows.join('') + '</table>' });\n}\n";
          },
          look: function () {
            var s = standingsNow();
            return '<div class="looks"><div class="mail"><div class="mh"><b>' + esc(LEAGUE) + ': standings, week ' + WEEK + '</b><br>to me · 8:02 AM</div><table><tr><th>#</th><th>Team</th><th>Record</th><th>PF</th><th>Playoff %</th></tr>' +
              s.slice(0, 7).map(function (t) { return '<tr><td>' + t.seed + '</td><td>' + esc(t.team) + '</td><td>' + t.wins + '-' + t.losses + '</td><td>' + t.pointsFor + '</td><td>' + pct1(t.playoffOdds) + '</td></tr>'; }).join('') +
              '</table></div></div>';
          },
          stop: 'On <code>too_fast</code> it deletes its own schedule and emails you why. Any other refusal is emailed too, and tomorrow’s run tries again.' },
      ] },
    { key: 'excel', name: 'Excel', glyph: GL.excel, schedule: true,
      stops: 'A refused refresh fails and shows the message; set Refresh every to 15 minutes or more',
      jobs: [
        { key: 'standings', title: 'Keep the standings in a sheet', have: 'A standings table that refreshes by itself while the workbook is open.',
          steps: ['In Excel, choose <b>Data → Get Data → From Other Sources → Blank Query</b>.',
            'In the Power Query editor choose <b>Advanced Editor</b>, replace everything with the query below and press Done. If Excel asks how to connect, choose <b>Anonymous</b>: the key is already in the query.',
            'Name the query <b>Standings</b> and choose <b>Close &amp; Load</b>.',
            'Right-click the table → <b>Table → External Data Properties</b>, open the query’s properties, tick <b>Refresh every</b> and set <b>15 minutes</b>. Excel can’t read the site’s pace, so it is given room for the busiest day.',
            'Keep the <code>ManualStatusHandling</code> line: without it Excel quietly asks again up to three times when the site refuses, and shows its own error instead of the site’s message.'],
          file: 'Power Query · Advanced Editor', lang: 'm',
          code: function (c) {
            return '// Standings, straight from the site. Refresh every 15 minutes or more.\nlet\n' +
              '    Response = Web.Contents("' + U('standings.csv', { name: 'excel-standings' }) + '", [\n' +
              '        Headers = [Authorization = "Bearer ' + c.K + '"],\n' +
              '        ManualStatusHandling = {400, 401, 403, 404, 429, 500, 503}]),\n' +
              '    Status = Value.Metadata(Response)[Response.Status],\n' +
              '    Checked = if Status = 200 then Response\n' +
              '        else error Error.Record("Site API", Text.FromBinary(Response)),   // the site\'s message, shown by Excel\n' +
              '    Csv = Csv.Document(Checked, [Delimiter = ",", Encoding = 65001, QuoteStyle = QuoteStyle.Csv]),\n' +
              '    Promoted = Table.PromoteHeaders(Csv, [PromoteAllScalars = true]),\n' +
              '    Typed = Table.TransformColumnTypes(Promoted, {\n' +
              '        {"seed", Int64.Type}, {"wins", Int64.Type}, {"losses", Int64.Type}, {"ties", Int64.Type},\n' +
              '        {"pointsFor", type number}, {"pointsAgainst", type number},\n' +
              '        {"playoffOdds", Percentage.Type}, {"simPlayoffOdds", Percentage.Type}})\nin\n    Typed\n';
          },
          look: function () {
            var rows = [['seed', 'team', 'wins', 'losses', 'pointsFor', 'playoffOdds']].concat(standingsNow().slice(0, 6).map(function (r) {
              return [r.seed, r.team, r.wins, r.losses, r.pointsFor, pct1(r.playoffOdds)];
            }));
            return LOOK.sheet('Standings (query) · refreshed every 15 minutes', rows, 'Percentages arrive as fractions and Excel shows them as percent.');
          },
          stop: 'Excel can’t switch itself off. A refused refresh fails and shows the site’s message; the table keeps its last good rows. Excel may hide the site’s headers, so the query reads the message from the answer itself. Every 15 minutes is never more often than the site asks for, even on its busiest day.' },
        { key: 'chart', title: 'Chart weekly points', have: 'A line chart of every team’s points week by week.',
          steps: ['Create a Blank Query as in the first job and paste the query below. It asks for <code>/full</code> once and turns the schedule into a table of points by team and week.',
            'Close &amp; Load, then select the table and choose <b>Insert → Line with Markers</b>.',
            'In the query’s properties tick <b>Refresh data when opening the file</b> only: the schedule changes once a week.'],
          file: 'Power Query · Advanced Editor', lang: 'm',
          code: function (c) {
            return '// Every team\'s points by week, from the season schedule.\nlet\n' +
              '    Response = Web.Contents("' + U('full', { name: 'excel-weekly' }) + '", [\n' +
              '        Headers = [Authorization = "Bearer ' + c.K + '"],\n' +
              '        ManualStatusHandling = {400, 401, 403, 404, 429, 500, 503}]),\n' +
              '    Body = Json.Document(Response),\n' +
              '    Checked = if Value.Metadata(Response)[Response.Status] = 200 then Body\n' +
              '        else error Error.Record("Site API", Body[#"error"][message]),\n' +
              '    Played = List.Select(Checked[data][schedule], each [state] = "final"),\n' +
              '    Sides = List.Combine(List.Transform(Played, each {\n' +
              '        [Week = Text.From([week]), Team = [home][team], Points = [home][points]],\n' +
              '        [Week = Text.From([week]), Team = [away][team], Points = [away][points]]})),\n' +
              '    Weekly = Table.FromRecords(Sides),\n' +
              '    Chart = Table.Pivot(Weekly, List.Distinct(Weekly[Team]), "Team", "Points")\nin\n    Chart\n';
          },
          look: function () { return '<div class="looks">' + weeklyChart() + '<p class="cap">Weeks 1 and 2 are final; week 3 joins once its games settle.</p></div>'; },
          stop: 'It asks only when the file opens, so it never asks too often. A refusal shows the site’s message in place of the refresh.' },
        { key: 'left', title: 'List who’s left to play', have: 'Your starters still to play, as a table that refreshes with the rest.',
          steps: ['Create a Blank Query and paste the query below. Your team is filled in (<code>team=%T%</code>).',
            'Close &amp; Load. Set <b>Refresh every</b> to 15 minutes, as for the standings.'],
          file: 'Power Query · Advanced Editor', lang: 'm',
          code: function (c) {
            return 'let\n    Response = Web.Contents("' + U('rosters.csv', { team: c.T, name: 'excel-left' }) + '", [\n' +
              '        Headers = [Authorization = "Bearer ' + c.K + '"],\n' +
              '        ManualStatusHandling = {400, 401, 403, 404, 429, 500, 503}]),\n' +
              '    Checked = if Value.Metadata(Response)[Response.Status] = 200 then Response\n' +
              '        else error Error.Record("Site API", Text.FromBinary(Response)),\n' +
              '    Rows = Table.PromoteHeaders(Csv.Document(Checked, [Encoding = 65001, QuoteStyle = QuoteStyle.Csv])),\n' +
              '    Left = Table.SelectRows(Rows, each [gameState] = "pre" and not List.Contains({"BE", "IR"}, [slot])),\n' +
              '    Shown = Table.SelectColumns(Left, {"player", "position", "nflTeam", "opponent", "kickoff"})\nin\n    Shown\n';
          },
          look: function (c) {
            var left = leftToPlay(c.T);
            return LOOK.sheet('Left to play (query)', [['player', 'position', 'nflTeam', 'opponent', 'kickoff']].concat(left.map(function (r) {
              return [r.player, r.position, r.nflTeam, r.opponent, r.kickoff];
            })), left.length + ' still to play for ' + c.TN + '.');
          },
          stop: 'As for the standings: a refused refresh shows the message and keeps the last rows; 15 minutes keeps it inside every pace.' },
      ] },
    { key: 'python', name: 'Python', glyph: GL.python,
      stops: 'Writes a SITE_API_STOPPED file and exits; every run checks for it first',
      jobs: [
        { key: 'score', title: 'Show my live score', have: 'Your matchup’s score in a terminal, updated at the site’s pace all game long.',
          steps: ['Install Python 3.9 or later and the <code>requests</code> package: <code>pip install requests</code>.',
            'Save the script below as <code>live_score.py</code>. Your team (<code>team=%T%</code>) and the league’s key are filled in.',
            'Run <code>python live_score.py</code>. It prints the score, then waits exactly as long as the site asks before asking again.',
            'Press Ctrl+C to stop it.'],
          file: 'live_score.py', lang: 'py',
          code: function (c) {
            return '# live_score.py: my live score in the terminal, at the site\'s pace.\nimport sys, time, pathlib, requests\n\n' +
              'URL = "' + U('scoreboard', { team: c.T, name: 'live-score' }) + '"\nKEY = {"Authorization": "Bearer ' + c.K + '"}\n' +
              'STOP = pathlib.Path(__file__).with_name("SITE_API_STOPPED")\n\n' +
              'if STOP.exists():\n    sys.exit(f"Stopped earlier: {STOP.read_text()}\\nFix the interval, then delete {STOP.name}.")\n\n' +
              'etag = None\nwhile True:\n    headers = {**KEY, **({"If-None-Match": etag} if etag else {})}\n' +
              '    r = requests.get(URL, headers=headers, timeout=30)\n    if r.status_code == 429:\n        err = r.json()["error"]\n' +
              '        if err["stop"] == "exit":                  # too_fast: this program asks too often\n            STOP.write_text(err["message"])\n            sys.exit(err["message"])\n' +
              '        time.sleep(int(r.headers["Retry-After"]))  # pace_changed: the site slowed down\n        continue\n' +
              '    if r.status_code != 304:                       # 304: nothing changed since last time\n        body = r.json()\n        if not body["ok"]:\n            sys.exit(body["error"]["message"])\n' +
              '        etag = r.headers.get("ETag")\n        for m in body["data"]:\n            h, a = m["home"], m["away"]\n' +
              '            print(f\'{h["team"]} {h["points"]:.1f} - {a["points"]:.1f} {a["team"]}  \'\n                  f\'({h["yetToPlay"] + a["yetToPlay"]} yet to play)\')\n' +
              '    time.sleep(int(r.headers.get("X-Suggested-Interval", "60")))\n';
          },
          look: function (c) {
            var m = myMatch(c.T);
            return LOOK.term([['pr', '$ python live_score.py'], scoreLine(m), ['dim', '… ' + durWords(c.p.secs || 60) + ' later'], scoreLine(m)],
              'It asks again after exactly the interval the site sends, so it speeds up when the site is quiet and slows down when it is busy.');
          },
          stop: STOPFILE() },
        { key: 'bot', title: 'Post new league activity to Discord or Slack', have: 'A channel message for every completed add, drop and trade, and every new trade offer, a few minutes after it happens. Pending waiver claims never appear.',
          steps: ['Create a webhook for your channel: in Discord, <b>Edit Channel → Integrations → Webhooks → New Webhook → Copy Webhook URL</b>; in Slack, add an <b>Incoming Webhook</b> to the channel.',
            'Save the script below as <code>activity_bot.py</code> and paste the webhook address into <code>WEBHOOK</code>.',
            'Run it once by hand: the first run only remembers what is there and posts nothing.',
            'Schedule it every 20 minutes, less often than the site ever asks for: <code>*/20 * * * * python3 /path/to/activity_bot.py</code> (cron), or a Task Scheduler entry on Windows.'],
          file: 'activity_bot.py', lang: 'py', code: function (c) { return botPy(c); },
          look: function () { return botLook(); },
          stop: STOPFILE() + ' A scheduled run that is refused with <code>pace_changed</code> simply skips; the next run is 20 minutes away.' },
        { key: 'save', title: 'Save the whole league once a day', have: 'A dated JSON file of the whole league every morning: every section, about 1 MB.',
          steps: ['Save the script below as <code>save_league.py</code> in the folder that should hold the files.',
            'Schedule it once a day: <code>15 6 * * * python3 /path/to/save_league.py</code> (cron), or Task Scheduler on Windows.',
            'Each run writes <code>league-YYYY-MM-DD.json</code> beside the script.'],
          file: 'save_league.py', lang: 'py',
          code: function (c) {
            return '# save_league.py: the whole league to a dated file, once a day.\nimport sys, time, pathlib, datetime, requests\n\n' +
              'URL = "' + U('full', { name: 'daily-save' }) + '"\nKEY = {"Authorization": "Bearer ' + c.K + '"}\n' +
              'HERE = pathlib.Path(__file__).parent\nSTOP = HERE / "SITE_API_STOPPED"\n\n' +
              'if STOP.exists():\n    sys.exit(f"Stopped earlier: {STOP.read_text()}\\nFix the schedule, then delete {STOP.name}.")\n\n' +
              'for attempt in range(2):\n    r = requests.get(URL, headers=KEY, timeout=60)\n    if r.status_code != 429:\n        break\n' +
              '    err = r.json()["error"]\n    if err["stop"] == "exit":\n        STOP.write_text(err["message"])\n        sys.exit(err["message"])\n' +
              '    time.sleep(int(r.headers["Retry-After"]))     # pace_changed: wait for the window, then once more\nr.raise_for_status()\n\n' +
              'day = datetime.date.today().isoformat()\n(HERE / f"league-{day}.json").write_bytes(r.content)\nprint(f"Saved league-{day}.json ({len(r.content) // 1024} KB)")\n';
          },
          look: function () {
            var d = Date.now();
            return LOOK.files([['league-' + iso(d - 2 * DAY).slice(0, 10) + '.json', '1.0 MB'], ['league-' + iso(d - DAY).slice(0, 10) + '.json', '1.0 MB'], ['league-' + iso(d).slice(0, 10) + '.json', '1.0 MB'], ['save_league.py', '1 KB']],
              'One file a day. Each is the same shape as the <code>/full</code> answer.');
          },
          stop: STOPFILE() },
        { key: 'chart', title: 'Chart weekly points', have: 'A PNG line chart of every team’s points by week.',
          steps: ['Install <code>requests</code> and <code>matplotlib</code>: <code>pip install requests matplotlib</code>.',
            'Save the script below as <code>weekly_chart.py</code> and run it: <code>python weekly_chart.py</code>.',
            'It writes <code>weekly-points.png</code> beside the script. Run it again any week.'],
          file: 'weekly_chart.py', lang: 'py',
          code: function (c) {
            return '# weekly_chart.py: every team\'s points by week, as a line chart.\nimport sys, pathlib, requests\nimport matplotlib.pyplot as plt\n\n' +
              'URL = "' + U('full', { name: 'weekly-chart' }) + '"\nKEY = {"Authorization": "Bearer ' + c.K + '"}\nSTOP = pathlib.Path(__file__).with_name("SITE_API_STOPPED")\n' +
              'if STOP.exists():\n    sys.exit(f"Stopped earlier: {STOP.read_text()}")\n\n' +
              'r = requests.get(URL, headers=KEY, timeout=60)\nif r.status_code == 429:\n    err = r.json()["error"]\n    if err["stop"] == "exit":\n        STOP.write_text(err["message"])\n    sys.exit(err["message"])      # pace_changed: the message says when to try again\nr.raise_for_status()\n\n' +
              'weekly = {}\nfor m in r.json()["data"]["schedule"]:\n    if m["state"] != "final":\n        continue\n    for side in (m["home"], m["away"]):\n        weekly.setdefault(side["team"], {})[m["week"]] = side["points"]\n\n' +
              'for team, pts in sorted(weekly.items()):\n    weeks = sorted(pts)\n    plt.plot(weeks, [pts[w] for w in weeks], marker="o", label=team)\n' +
              'plt.xlabel("Week"); plt.ylabel("Points"); plt.legend(fontsize=7); plt.tight_layout()\nplt.savefig("weekly-points.png", dpi=160)\nprint("Saved weekly-points.png")\n';
          },
          look: function () { return '<div class="looks">' + weeklyChart() + '<p class="cap">weekly-points.png</p></div>'; },
          stop: STOPFILE() },
      ] },
    { key: 'node', name: 'JavaScript (Node)', glyph: GL.node,
      stops: 'The same SITE_API_STOPPED file as the Python examples',
      jobs: [
        { key: 'score', title: 'Show my live score', have: 'Your matchup’s score in a terminal, at the site’s pace.',
          steps: ['Install Node 18 or later (it has <code>fetch</code> built in; nothing else to install).',
            'Save the script below as <code>live-score.mjs</code>. Your team (<code>team=%T%</code>) and the league’s key are filled in.',
            'Run <code>node live-score.mjs</code>. Press Ctrl+C to stop it.'],
          file: 'live-score.mjs', lang: 'js',
          code: function (c) {
            return "// live-score.mjs: my live score in the terminal, at the site's pace. Node 18 or later.\nimport { existsSync, readFileSync, writeFileSync } from 'node:fs';\n\n" +
              "const ADDRESS = '" + U('scoreboard', { team: c.T, name: 'live-score-js' }) + "';\nconst KEY = { Authorization: 'Bearer " + c.K + "' };\n" +
              "const STOP = new URL('./SITE_API_STOPPED', import.meta.url);\nconst sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));\n\n" +
              "if (existsSync(STOP)) {\n  console.error(`Stopped earlier: ${readFileSync(STOP, 'utf8')}\\nFix the interval, then delete SITE_API_STOPPED.`);\n  process.exit(1);\n}\n\n" +
              "let etag = null;\nfor (;;) {\n  const res = await fetch(ADDRESS, { headers: { ...KEY, ...(etag ? { 'If-None-Match': etag } : {}) } });\n" +
              "  if (res.status === 429) {\n    const { error } = await res.json();\n    if (error.stop === 'exit') {                 // too_fast: this program asks too often\n" +
              "      writeFileSync(STOP, error.message);\n      console.error(error.message);\n      process.exit(1);\n    }\n" +
              "    await sleep(Number(res.headers.get('Retry-After')));   // pace_changed: the site slowed down\n    continue;\n  }\n" +
              "  if (res.status !== 304) {                       // 304: nothing changed since last time\n    const body = await res.json();\n" +
              "    if (!body.ok) { console.error(body.error.message); process.exit(1); }\n    etag = res.headers.get('ETag');\n" +
              "    for (const { home, away } of body.data) {\n      console.log(`${home.team} ${home.points.toFixed(1)} - ${away.points.toFixed(1)} ${away.team}  ` +\n" +
              "        `(${home.yetToPlay + away.yetToPlay} yet to play)`);\n    }\n  }\n  await sleep(Number(res.headers.get('X-Suggested-Interval') ?? 60));\n}\n";
          },
          look: function (c) { var m = myMatch(c.T); return LOOK.term([['pr', '$ node live-score.mjs'], scoreLine(m)]); },
          stop: STOPFILE() },
        { key: 'bot', title: 'Post new league activity to Discord or Slack', have: 'A channel message for every new transaction and trade offer.',
          steps: ['Create a Discord or Slack webhook for the channel (see the Discord or Slack guide).',
            'Save the script below as <code>activity-bot.mjs</code> and paste the webhook address into <code>WEBHOOK</code>.',
            'Run it once by hand (it only remembers what is there), then schedule it every 20 minutes: <code>*/20 * * * * node /path/to/activity-bot.mjs</code>.'],
          file: 'activity-bot.mjs', lang: 'js', code: function (c) { return botJs(c); }, look: function () { return botLook(); },
          stop: STOPFILE() + ' A refused scheduled run simply skips; the next is 20 minutes away.' },
        { key: 'save', title: 'Save the whole league once a day', have: 'A dated JSON file of the whole league every morning.',
          steps: ['Save the script below as <code>save-league.mjs</code>.', 'Schedule it once a day: <code>15 6 * * * node /path/to/save-league.mjs</code>.'],
          file: 'save-league.mjs', lang: 'js',
          code: function (c) {
            return "// save-league.mjs: the whole league to a dated file. Node 18 or later.\nimport { existsSync, readFileSync, writeFileSync } from 'node:fs';\n\n" +
              "const ADDRESS = '" + U('full', { name: 'daily-save-js' }) + "';\nconst KEY = { Authorization: 'Bearer " + c.K + "' };\n" +
              "const STOP = new URL('./SITE_API_STOPPED', import.meta.url);\nconst sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));\n\n" +
              "if (existsSync(STOP)) { console.error(`Stopped earlier: ${readFileSync(STOP, 'utf8')}`); process.exit(1); }\n\n" +
              "let res = await fetch(ADDRESS, { headers: KEY });\nif (res.status === 429) {\n  const { error } = await res.json();\n" +
              "  if (error.stop === 'exit') { writeFileSync(STOP, error.message); console.error(error.message); process.exit(1); }\n" +
              "  await sleep(Number(res.headers.get('Retry-After')));   // pace_changed: wait for the window, then once more\n  res = await fetch(ADDRESS, { headers: KEY });\n}\n" +
              "const text = await res.text();\nif (!res.ok) { console.error(JSON.parse(text).error.message); process.exit(1); }\n\n" +
              "const file = new URL(`./league-${new Date().toISOString().slice(0, 10)}.json`, import.meta.url);\nwriteFileSync(file, text);\nconsole.log(`Saved ${file.pathname}`);\n";
          },
          look: function () { var d = Date.now(); return LOOK.files([['league-' + iso(d - DAY).slice(0, 10) + '.json', '1.0 MB'], ['league-' + iso(d).slice(0, 10) + '.json', '1.0 MB']]); },
          stop: STOPFILE() },
      ] },
    { key: 'powershell', name: 'PowerShell (Windows)', glyph: GL.powershell,
      stops: 'The same stop file; Task Scheduler runs it',
      jobs: [
        { key: 'save', title: 'Save the whole league once a day', have: 'A dated JSON file of the whole league every morning, on Windows.',
          steps: ['Install PowerShell 7 (<code>winget install Microsoft.PowerShell</code>). Its <code>-SkipHttpErrorCheck</code> lets the script read a refused answer instead of throwing; Windows PowerShell 5.1, built into Windows, can’t.',
            'Save the script below as <code>Save-League.ps1</code> in, say, <code>C:\\League</code>.',
            'Add the Task Scheduler entry below once, from a terminal. It runs every morning at 6:15.'],
          file: 'Save-League.ps1', lang: 'ps',
          code: function (c) {
            return "# Save-League.ps1: the whole league to a dated file. PowerShell 7 or later.\n$Url  = '" + U('full', { name: 'daily-save-ps' }) + "'\n$Key  = @{ Authorization = 'Bearer " + c.K + "' }\n" +
              "$Stop = Join-Path $PSScriptRoot 'SITE_API_STOPPED'\n\n" +
              "if (Test-Path $Stop) { Write-Error \"Stopped earlier: $(Get-Content $Stop -Raw) Fix the schedule, then delete SITE_API_STOPPED.\"; exit 1 }\n\n" +
              "$r = Invoke-WebRequest $Url -Headers $Key -SkipHttpErrorCheck\nif ($r.StatusCode -eq 429) {\n    $err = ($r.Content | ConvertFrom-Json).error\n" +
              "    if ($err.stop -eq 'exit') { Set-Content $Stop $err.message; Write-Error $err.message; exit 1 }   # too_fast\n" +
              "    Start-Sleep -Seconds ([int]$r.Headers['Retry-After'][0])     # pace_changed: wait, then once more\n    $r = Invoke-WebRequest $Url -Headers $Key -SkipHttpErrorCheck\n}\n" +
              "if ($r.StatusCode -ne 200) { Write-Error (($r.Content | ConvertFrom-Json).error.message); exit 1 }\n\n" +
              "$file = Join-Path $PSScriptRoot ('league-{0:yyyy-MM-dd}.json' -f (Get-Date))\nSet-Content $file $r.Content -Encoding utf8NoBOM\n\"Saved $file\"\n";
          },
          extra: { file: 'Task Scheduler entry · run once in a terminal', lang: 'sh', text: 'schtasks /Create /SC DAILY /ST 06:15 /TN "Save league" /TR "pwsh -NoProfile -File C:\\League\\Save-League.ps1"' },
          look: function () { var d = Date.now(); return LOOK.files([['C:\\League\\league-' + iso(d - DAY).slice(0, 10) + '.json', '1.0 MB'], ['C:\\League\\league-' + iso(d).slice(0, 10) + '.json', '1.0 MB']]); },
          stop: STOPFILE('script') + ' Task Scheduler keeps starting it each morning, and each run stops at the file straight away.' },
        { key: 'score', title: 'Show my live score', have: 'Your matchup’s score in a PowerShell window, at the site’s pace.',
          steps: ['Save the script below as <code>Live-Score.ps1</code>. Your team (<code>team=%T%</code>) and the league’s key are filled in.', 'Run <code>pwsh .\\Live-Score.ps1</code>. Press Ctrl+C to stop.'],
          file: 'Live-Score.ps1', lang: 'ps',
          code: function (c) {
            return "# Live-Score.ps1: my live score, at the site's pace. PowerShell 7 or later.\n$Url  = '" + U('scoreboard', { team: c.T, name: 'live-score-ps' }) + "'\n$Key  = @{ Authorization = 'Bearer " + c.K + "' }\n" +
              "$Stop = Join-Path $PSScriptRoot 'SITE_API_STOPPED'\nif (Test-Path $Stop) { Write-Error \"Stopped earlier: $(Get-Content $Stop -Raw)\"; exit 1 }\n\n" +
              "while ($true) {\n    $r = Invoke-WebRequest $Url -Headers $Key -SkipHttpErrorCheck\n    if ($r.StatusCode -eq 429) {\n        $err = ($r.Content | ConvertFrom-Json).error\n" +
              "        if ($err.stop -eq 'exit') { Set-Content $Stop $err.message; Write-Error $err.message; exit 1 }   # too_fast\n" +
              "        Start-Sleep -Seconds ([int]$r.Headers['Retry-After'][0]); continue                             # pace_changed\n    }\n" +
              "    $body = $r.Content | ConvertFrom-Json\n    if (-not $body.ok) { Write-Error $body.error.message; exit 1 }\n    foreach ($m in $body.data) {\n" +
              "        '{0} {1:N1} - {2:N1} {3}  ({4} yet to play)' -f $m.home.team, $m.home.points, $m.away.points, $m.away.team, ($m.home.yetToPlay + $m.away.yetToPlay)\n    }\n" +
              "    Start-Sleep -Seconds ([int]$r.Headers['X-Suggested-Interval'][0])\n}\n";
          },
          look: function (c) { var m = myMatch(c.T); return LOOK.term([['pr', 'PS C:\\League> pwsh .\\Live-Score.ps1'], scoreLine(m)]); },
          stop: STOPFILE() },
      ] },
    { key: 'shell', name: 'curl and a shell (macOS, Linux)', glyph: GL.shell,
      stops: 'The same stop file; cron runs it',
      jobs: [
        { key: 'save', title: 'Save the whole league once a day', have: 'A dated JSON file of the whole league every morning, with nothing to install.',
          steps: ['Save the script below as <code>save-league.sh</code> and make it runnable: <code>chmod +x save-league.sh</code>.',
            'Add the cron line below with <code>crontab -e</code>. It runs every morning at 6:15.'],
          file: 'save-league.sh', lang: 'sh',
          code: function (c) {
            return "#!/bin/sh\n# save-league.sh: the whole league to a dated file, once a day.\nURL='" + U('full', { name: 'daily-save-sh' }) + "'\nKEY='Authorization: Bearer " + c.K + "'\n" +
              'DIR=$(dirname "$0"); STOP="$DIR/SITE_API_STOPPED"; OUT="$DIR/league-$(date +%F).json"\n\n' +
              '[ -f "$STOP" ] && { echo "Stopped earlier: $(cat "$STOP")" >&2; exit 1; }\n\n' +
              'code=$(curl -sS -o "$OUT.part" -D "$DIR/.headers" -w \'%{http_code}\' -H "$KEY" "$URL")\n' +
              'if [ "$code" = 429 ]; then\n  if grep -qi \'^x-stop: exit\' "$DIR/.headers"; then   # too_fast: stop until the schedule is fixed\n' +
              '    sed -n \'s/.*"message":"\\([^"]*\\)".*/\\1/p\' "$OUT.part" > "$STOP"; rm -f "$OUT.part"\n    echo "Stopped: $(cat "$STOP")" >&2; exit 1\n  fi\n' +
              '  sleep "$(awk \'tolower($1)=="retry-after:" {print $2+0}\' "$DIR/.headers")"   # pace_changed: wait, then once more\n' +
              '  code=$(curl -sS -o "$OUT.part" -w \'%{http_code}\' -H "$KEY" "$URL")\nfi\n' +
              '[ "$code" = 200 ] || { cat "$OUT.part" >&2; rm -f "$OUT.part"; exit 1; }\nmv "$OUT.part" "$OUT" && echo "Saved $OUT"\n';
          },
          extra: { file: 'crontab -e', lang: 'sh', text: '15 6 * * * /home/you/league/save-league.sh' },
          look: function () { var d = Date.now(); return LOOK.term([['pr', '$ ./save-league.sh'], 'Saved ./league-' + iso(d).slice(0, 10) + '.json', ['pr', '$ ls'], 'league-' + iso(d - DAY).slice(0, 10) + '.json  league-' + iso(d).slice(0, 10) + '.json  save-league.sh']); },
          stop: STOPFILE('script') + ' A refusal of a CSV or any answer also says which kind it is in the <code>X-Stop</code> header, which is what this script reads.' },
        { key: 'csv', title: 'Keep a standings CSV current', have: 'A <code>standings.csv</code> file that other tools can read, never more than 20 minutes old.',
          steps: ['Save the script below as <code>standings.sh</code> and <code>chmod +x</code> it.',
            'Add it to cron every 20 minutes: <code>*/20 * * * * /home/you/league/standings.sh</code>.',
            'It sends the last <code>ETag</code> back, so when nothing has changed the site answers <code>304</code> with no body at all.'],
          file: 'standings.sh', lang: 'sh',
          code: function (c) {
            return "#!/bin/sh\n# standings.sh: keeps standings.csv current. Run it every 20 minutes.\nURL='" + U('standings.csv', { name: 'standings-csv' }) + "'\nKEY='Authorization: Bearer " + c.K + "'\n" +
              'DIR=$(dirname "$0"); STOP="$DIR/SITE_API_STOPPED"\n\n[ -f "$STOP" ] && exit 1\n\n' +
              'code=$(curl -sS -o "$DIR/standings.part" -D "$DIR/.headers" -w \'%{http_code}\' -H "$KEY" \\\n  -H "If-None-Match: $(cat "$DIR/.etag" 2>/dev/null)" "$URL")\n' +
              'case "$code" in\n  200) mv "$DIR/standings.part" "$DIR/standings.csv"\n       awk \'tolower($1)=="etag:" {print $2}\' "$DIR/.headers" | tr -d \'\\r\' > "$DIR/.etag" ;;\n' +
              '  304) rm -f "$DIR/standings.part" ;;                          # nothing changed\n' +
              '  429) grep -qi \'^x-stop: exit\' "$DIR/.headers" && mv "$DIR/standings.part" "$STOP"   # too_fast\n' +
              '       rm -f "$DIR/standings.part"; exit 1 ;;                    # pace_changed: next run in 20 minutes\n' +
              '  *)   cat "$DIR/standings.part" >&2; rm -f "$DIR/standings.part"; exit 1 ;;\nesac\n';
          },
          look: function () {
            var csv = toCsv(standingsNow()).split('\n').slice(0, 5);
            return LOOK.term([['pr', '$ head -5 standings.csv']].concat(csv.map(function (l) { return l.length > 90 ? l.slice(0, 88) + '…' : l; })));
          },
          stop: STOPFILE('script') },
      ] },
    { key: 'iphone', name: 'iPhone and iPad', glyph: GL.iphone,
      stops: 'The shortcut saves a “stopped” note in its folder and checks it first',
      jobs: [
        { key: 'score', title: 'My live score as a widget or a notification', have: 'Your score on the Home Screen, or a notification when you tap or at set times on Sundays.',
          steps: ['Open the <b>Shortcuts</b> app, tap <b>+</b>, and add the actions below in order. Name the shortcut <b>Fantasy score</b>.',
            'In <b>Get Contents of URL</b>, open Show More and add the header <code>Authorization</code> with the value <code>Bearer</code> followed by the league’s key.',
            'For a widget: long-press the Home Screen → <b>Edit → Add Widget → Shortcuts</b>, and choose Fantasy score. Tap it for the latest score. The phone may keep an answer for as long as the site’s pace, so two taps within a minute can show the same score.',
            'For notifications on Sundays: <b>Automation → + → Time of Day</b>, pick a time and Sunday, and run Fantasy score. Add one automation per time you want.'],
          file: 'Shortcut actions', lang: 'actions',
          actions: function (c) {
            return actions([
              ['', '<b>Get File</b> from Shortcuts at path <code>SiteAPI/stopped.txt</code> · Error If Not Found: <b>off</b>'],
              ['cond', '<b>If</b> File <b>has any value</b>'],
              ['stop ind', '<b>Show Notification</b> “Site API stopped this shortcut: File” · then <b>Stop This Shortcut</b>'],
              ['cond', '<b>End If</b>'],
              ['', '<b>Get Contents of URL</b> <code>' + esc(U('scoreboard', { team: c.T, name: 'iphone-score' })) + '</code> · Headers: <code>Authorization</code> = <code>Bearer ' + esc(c.K) + '</code>'],
              ['', '<b>Get Dictionary Value</b> for <code>error</code> in Contents of URL'],
              ['cond', '<b>If</b> Dictionary Value <b>has any value</b>'],
              ['stop ind', '<b>If</b> <code>stop</code> of it <b>is</b> <code>exit</code>: <b>Save File</b> its <code>message</code> to <code>SiteAPI/stopped.txt</code> (Overwrite on) · <b>Show Alert</b> the message · <b>Stop This Shortcut</b>'],
              ['cond ind', '<b>Otherwise</b>: <b>Show Notification</b> the message (the site is busy; try later) · <b>Stop This Shortcut</b>'],
              ['cond', '<b>End If</b>'],
              ['ok', '<b>Get Dictionary Value</b> for <code>data</code> · <b>Get Item from List</b>: First Item'],
              ['ok', '<b>Text</b>: home.team home.points – away.points away.team · yetToPlay left'],
              ['ok', '<b>Show Notification</b> the Text (or <b>Show Result</b> for the widget)'],
            ]);
          },
          look: function (c) {
            var m = myMatch(c.T);
            return LOOK.phone(notif('Shortcuts', 'Fantasy score', m.home.team + ' ' + m.home.points.toFixed(1) + ' – ' + m.away.points.toFixed(1) + ' ' + m.away.team + ' · ' + (m.home.yetToPlay + m.away.yetToPlay) + ' left') +
              '<div class="widget"><div class="wt">Fantasy score</div><div class="ws"><span>' + esc(m.home.team) + '</span><span>' + m.home.points.toFixed(1) + '</span></div><div class="ws"><span>' + esc(m.away.team) + '</span><span>' + m.away.points.toFixed(1) + '</span></div></div>');
          },
          stop: 'An automation can’t switch itself off, so on <code>too_fast</code> the shortcut saves the site’s message to <code>SiteAPI/stopped.txt</code> and shows it. Every run checks that note first and asks nothing while it is there: delete it in the Files app (On My iPhone → Shortcuts → SiteAPI) once you have fixed the automations.' },
        { key: 'left', title: 'Who’s left to play', have: 'A tap-to-see list of your starters still to play.',
          steps: ['Make a new shortcut with the first two groups of actions from the live score (the stopped-note check and the error handling), pointing at the address below.',
            'Then add the actions that pick out starters whose games have not kicked off.',
            'Add it to the Home Screen or the widget, as for the live score.'],
          file: 'Shortcut actions', lang: 'actions',
          actions: function (c) {
            return actions([
              ['', 'The stopped-note check and error handling from <b>My live score</b>, with <b>Get Contents of URL</b> <code>' + esc(U('rosters', { team: c.T, name: 'iphone-left' })) + '</code>'],
              ['ok', '<b>Get Dictionary Value</b> for <code>data</code> · <b>Repeat with Each</b> item'],
              ['cond ind', '<b>If</b> <code>gameState</code> is <code>pre</code> and <code>slot</code> is not <code>BE</code> or <code>IR</code>'],
              ['ok ind2', '<b>Add to Variable</b> Left: player · nflTeam · opponent'],
              ['ok', '<b>End Repeat</b> · <b>Show Result</b> Left'],
            ]);
          },
          look: function (c) {
            var left = leftToPlay(c.T);
            return LOOK.phone(notif('Shortcuts', 'Left to play · ' + c.TN, left.length ? left.map(function (r) { return r.player + ' · ' + r.nflTeam + ' ' + r.opponent; }).join('  ·  ') : 'Everyone has played.'));
          },
          stop: 'The same stopped note as the live score shortcut.' },
      ] },
    { key: 'android', name: 'Android', glyph: GL.android,
      stops: 'Tasker switches its own profile off; a one-tap shortcut simply shows the message',
      jobs: [
        { key: 'tap', title: 'My live score with a one-tap shortcut', have: 'A Home Screen icon that shows your score when you tap it.',
          steps: ['Install <b>HTTP Shortcuts</b> (free, from Google Play or F-Droid) and create a <b>Regular Shortcut</b> named Fantasy score.',
            'Set the URL to the address below, method GET, and under <b>Request Headers</b> add <code>Authorization</code> = <code>Bearer</code> and the league’s key.',
            'Under <b>Scripting</b>, paste the two scripts below into <b>Run on Success</b> and <b>Run on Failure</b>. A refusal counts as a failure, so its message opens in a dialog.',
            'Long-press the shortcut and choose <b>Place on Home Screen</b>.'],
          file: 'HTTP Shortcuts · Scripting', lang: 'js',
          code: function (c) {
            return '// Address: ' + U('scoreboard', { team: c.T, name: 'android-score' }) + '\n// Header:  Authorization: Bearer ' + c.K + '\n\n' +
              '// Run on success\nconst m = JSON.parse(response.body).data[0];\n' +
              'showToast(`${m.home.team} ${m.home.points} – ${m.away.points} ${m.away.team} · ${m.home.yetToPlay + m.away.yetToPlay} left`);\n\n' +
              '// Run on failure: the site refused (response is set), or the phone is offline (it isn\'t)\n' +
              "if (response) {\n  showDialog(JSON.parse(response.body).error.message, 'Site API');\n} else {\n  showToast(networkError);\n}\n";
          },
          look: function (c) { var m = myMatch(c.T); return LOOK.phone('<div style="text-align:center;padding:40px 0 8px"><span class="toast">' + esc(m.home.team + ' ' + m.home.points + ' – ' + m.away.points + ' ' + m.away.team + ' · ' + (m.home.yetToPlay + m.away.yetToPlay) + ' left') + '</span></div>'); },
          stop: 'A one-tap shortcut asks only when you tap it, so a refusal is simply shown; nothing keeps asking.' },
        { key: 'tasker', title: 'A scheduled check with Tasker', have: 'A notification with your score every 20 minutes while the profile is on.',
          steps: ['You need Tasker 5.12 or later. Add a <b>Profile → Time</b>: from 12:00 to 23:59, <b>Repeat every 20 minutes</b>. Name it <b>Site API check</b>.',
            'Give it a new task with the actions below. In <b>HTTP Request</b>, turn on <b>Structure Output</b> and tick <b>Continue Task After Error</b>: a refusal counts as an error, and the task has to carry on to read it.',
            'Tasker then reads the answer for you: <code>%http_data.error.stop</code>, and <code>%http_data.data.home.points(1)</code> for the first matchup (its lists count from 1).'],
          file: 'Tasker task · Site API check', lang: 'actions',
          actions: function (c) {
            return actions([
              ['', '<b>HTTP Request</b> · GET <code>' + esc(U('scoreboard', { team: c.T, name: 'tasker' })) + '</code> · Headers <code>Authorization:Bearer ' + esc(c.K) + '</code> · Timeout 30 · Structure Output <b>on</b> · Continue Task After Error <b>on</b>'],
              ['cond', '<b>If</b> <code>%http_response_code</code> neq <code>200</code>'],
              ['stop ind', '<b>If</b> <code>%http_data.error.stop</code> eq <code>exit</code>: <b>Profile Status</b> Site API check → <b>Off</b> · <b>Notify</b> “Site API stopped” with <code>%http_data.error.message</code> · <b>End If</b>'],
              ['cond ind', '<b>Stop</b> (after too_fast the profile is off; after pace_changed or a passing fault, the next check is 20 minutes away)'],
              ['cond', '<b>End If</b>'],
              ['ok', '<b>Notify</b> <code>%http_data.data.home.team(1) %http_data.data.home.points(1) – %http_data.data.away.points(1) %http_data.data.away.team(1)</code>'],
            ]);
          },
          look: function (c) { var m = myMatch(c.T); return LOOK.phone(notif('Tasker', 'Fantasy score', scoreLine(m))); },
          stop: 'On <code>too_fast</code> the task switches its own profile off and tells you why, so it asks nothing more until you switch it back on.' },
      ] },
    { key: 'ha', name: 'Home Assistant', glyph: GL.homeassistant,
      stops: 'A “Site API stopped” helper blocks every request once it is on',
      jobs: [
        { key: 'sensor', title: 'My live score as a sensor', have: 'A sensor showing your points, for dashboards and automations, asked at the site’s pace.',
          steps: ['Add <code>site_api_key: "Bearer ' + '%K%' + '"</code> to <code>secrets.yaml</code>.',
            'Add the configuration below to <code>configuration.yaml</code> and restart Home Assistant.',
            'The sensor never asks on its own, except once when Home Assistant starts. An automation asks when the site’s pace allows, and remembers the next time from each answer.',
            'Put <b>sensor.my_fantasy_score</b> on a dashboard.'],
          file: 'configuration.yaml', lang: 'yaml',
          code: function (c) {
            return '# My live score as a sensor, asked at the site\'s pace.\ninput_boolean:\n  site_api_stopped:\n    name: Site API stopped\n' +
              'input_datetime:\n  site_api_next:\n    name: Site API next ask\n    has_date: true\n    has_time: true\n\n' +
              'rest:\n  - resource: ' + U('scoreboard', { team: c.T, name: 'home-assistant' }) + '\n    headers:\n      Authorization: !secret site_api_key\n' +
              '    scan_interval: 31536000        # never on its own: the automation below asks\n    sensor:\n      - name: My fantasy score\n        unique_id: site_api_my_score\n' +
              '        value_template: >-\n          {% if value_json.ok %}{% set m = value_json.data[0] %}\n          {{ m.home.points if m.home.teamId == ' + c.T + ' else m.away.points }}\n' +
              "          {% else %}{{ states('sensor.my_fantasy_score') }}{% endif %}\n        json_attributes: [ok, error, meta]\n\n" +
              'automation:\n  - alias: Site API - ask at the site\'s pace\n    trigger:\n      - platform: time_pattern\n        seconds: "/15"\n    condition:\n' +
              '      - condition: state\n        entity_id: input_boolean.site_api_stopped\n        state: "off"\n' +
              "      - \"{{ now().timestamp() >= state_attr('input_datetime.site_api_next', 'timestamp') | float(0) }}\"\n" +
              '    action:\n      - service: homeassistant.update_entity\n        target:\n          entity_id: sensor.my_fantasy_score\n' +
              "      - variables:\n          e: \"{{ state_attr('sensor.my_fantasy_score', 'error') }}\"\n          m: \"{{ state_attr('sensor.my_fantasy_score', 'meta') }}\"\n" +
              "      - if: \"{{ e is mapping and e.stop == 'exit' }}\"      # too_fast: switch off for good\n        then:\n" +
              '          - service: input_boolean.turn_on\n            target:\n              entity_id: input_boolean.site_api_stopped\n' +
              '          - service: persistent_notification.create\n            data:\n              title: Site API stopped\n              message: "{{ e.message }}"\n' +
              '        else:                                               # the next ask: the pace, or the end of a pause\n' +
              '          - service: input_datetime.set_datetime\n            target:\n              entity_id: input_datetime.site_api_next\n            data:\n' +
              '              timestamp: >-\n                {{ now().timestamp() + (e.retryAfterSeconds if e is mapping\n                   else m.pace.askEverySeconds) }}\n';
          },
          look: function (c) {
            var m = myMatch(c.T), mine = m.home.teamId === c.T ? m.home : m.away;
            return '<div class="looks"><div class="hacard"><div class="hr"><i>◆</i><span>My fantasy score</span><b>' + mine.points.toFixed(1) + '</b></div>' +
              '<div class="hr"><i>⏱</i><span>Site API next ask</span><b>' + esc(timeOf(Date.now() + (pace().secs || 60) * 1000)) + '</b></div>' +
              '<div class="hr"><i>■</i><span>Site API stopped</span><b>Off</b></div></div></div>';
          },
          stop: 'On <code>too_fast</code> the automation turns on <b>Site API stopped</b> and leaves a notification with the site’s message. Every ask is conditioned on that helper, so nothing is asked until you turn it off. On <code>pace_changed</code> it sets the next ask to the end of the pause.' },
        { key: 'trade', title: 'A notification when a trade is offered', have: 'A phone notification from Home Assistant whenever a new offer is on the table.',
          steps: ['Set up the helpers and the key from <b>My live score as a sensor</b> first.',
            'Add the configuration below. It asks for activity every 20 minutes, less often than the site ever asks for.',
            'Replace <code>notify.notify</code> with your phone’s notify service if you have several.'],
          file: 'configuration.yaml (add)', lang: 'yaml',
          code: function (c) {
            return '# A notification when a trade is offered. Uses the helpers from the live score.\nrest:\n  - resource: ' + U('activity', { name: 'home-assistant-trades' }) + '\n' +
              '    headers:\n      Authorization: !secret site_api_key\n    scan_interval: 31536000\n    sensor:\n      - name: Newest trade offer\n        unique_id: site_api_trade\n' +
              "        value_template: >-\n          {% set t = value_json.data | default([]) | selectattr('kind', 'eq', 'trade')\n" +
              "               | selectattr('status', 'eq', 'onTheTable') | list %}\n          {{ t[0].id if t else 'none' }}\n        json_attributes: [error, meta]\n\n" +
              'automation:\n  - alias: Site API - ask for activity every 20 minutes\n    trigger:\n      - platform: time_pattern\n        minutes: "/20"\n' +
              '    condition:\n      - condition: state\n        entity_id: input_boolean.site_api_stopped\n        state: "off"\n' +
              '    action:\n      - service: homeassistant.update_entity\n        target:\n          entity_id: sensor.newest_trade_offer\n' +
              "      - if: \"{{ (state_attr('sensor.newest_trade_offer', 'error') or {}).get('stop') == 'exit' }}\"\n        then:\n" +
              '          - service: input_boolean.turn_on\n            target:\n              entity_id: input_boolean.site_api_stopped\n\n' +
              '  - alias: Site API - a trade was offered\n    trigger:\n      - platform: state\n        entity_id: sensor.newest_trade_offer\n' +
              "    condition: \"{{ trigger.to_state.state not in ['none', 'unknown', 'unavailable'] }}\"\n    action:\n      - service: notify.notify\n" +
              '        data:\n          title: Trade offered\n          message: A new offer is on the table. Open Trade Analyzer to see it.\n';
          },
          look: function () { return LOOK.phone(notif('Home Assistant', 'Trade offered', 'A new offer is on the table. Open Trade Analyzer to see it.')); },
          stop: 'The same <b>Site API stopped</b> helper as the live score: once it is on, neither sensor asks again.' },
      ] },
    { key: 'chat', name: 'Discord or Slack', glyph: GL.chat,
      stops: 'Runs as a Python or JavaScript script, with the same stop file',
      jobs: [
        { key: 'activity', title: 'Post new league activity', have: 'A message in your league channel for every new transaction and trade offer.',
          steps: ['<b>Discord:</b> open the channel’s settings → <b>Integrations → Webhooks → New Webhook</b>, name it, and <b>Copy Webhook URL</b>. <b>Slack:</b> add the <b>Incoming Webhooks</b> app to the channel and copy its address.',
            'Save the script below as <code>activity_bot.py</code> (Python 3.9+, <code>pip install requests</code>) and paste the webhook into <code>WEBHOOK</code>. For Slack, change <code>"content"</code> to <code>"text"</code>.',
            'Run it once by hand: the first run remembers what is already there and posts nothing.',
            'Schedule it every 20 minutes on any always-on machine: <code>*/20 * * * * python3 /path/to/activity_bot.py</code>.'],
          file: 'activity_bot.py', lang: 'py', code: function (c) { return botPy(c); }, look: function () { return botLook(); },
          stop: STOPFILE() },
        { key: 'sunday', title: 'Post the scores on Sundays', have: 'Every matchup’s score posted to the channel at set times on game days.',
          steps: ['Create the webhook as above.', 'Save the script below as <code>sunday-scores.mjs</code> (Node 18+) and paste the webhook into <code>WEBHOOK</code>.',
            'Schedule it for the times you want, in UTC: <code>30 20 * * 0</code> (mid-afternoon Eastern) and <code>0 4 * * 1</code> (after the late games).'],
          file: 'sunday-scores.mjs', lang: 'js',
          code: function (c) {
            return "// sunday-scores.mjs: posts every matchup's score to the channel. Node 18 or later.\nimport { existsSync, writeFileSync } from 'node:fs';\n\n" +
              "const ADDRESS = '" + U('scoreboard', { name: 'sunday-scores' }) + "';\nconst KEY = { Authorization: 'Bearer " + c.K + "' };\n" +
              "const WEBHOOK = 'https://discord.com/api/webhooks/…';     // or your Slack incoming-webhook address\nconst STOP = new URL('./SITE_API_STOPPED', import.meta.url);\n\n" +
              "if (existsSync(STOP)) process.exit(1);\n\nconst res = await fetch(ADDRESS, { headers: KEY });\nconst body = await res.json();\nif (res.status === 429) {\n" +
              "  if (body.error.stop === 'exit') writeFileSync(STOP, body.error.message);   // too_fast: stop for good\n  process.exit(1);                                 // pace_changed: skip this post\n}\n" +
              "if (!body.ok) throw new Error(body.error.message);\n\nconst lines = body.data.map(({ state, home, away }) =>\n" +
              "  `${state === 'final' ? '✅' : '🏈'} **${home.team}** ${home.points.toFixed(1)} – ${away.points.toFixed(1)} **${away.team}**`);\n" +
              "await fetch(WEBHOOK, {\n  method: 'POST', headers: { 'Content-Type': 'application/json' },\n  body: JSON.stringify({ content: `Week ${body.meta.week} scores\\n${lines.join('\\n')}` }),   // Slack: { text: … }\n});\n";
          },
          look: function () {
            return LOOK.chat('League Bot', ['<b>Week ' + WEEK + ' scores</b>' + D.scoreboard.map(function (m) {
              return '<div>' + (m.state === 'final' ? '✅' : '🏈') + ' <b>' + esc(m.home.team) + '</b> ' + m.home.points.toFixed(1) + ' – ' + m.away.points.toFixed(1) + ' <b>' + esc(m.away.team) + '</b></div>';
            }).join('')]);
          },
          stop: STOPFILE() },
      ] },
  ];

  /* What kind of platform each is, and when each job asks: shown on the platform and job headings. */
  var PLAT_KIND = { sheets: 'Spreadsheet', excel: 'Spreadsheet', python: 'Script', node: 'Script', powershell: 'Script · Windows',
    shell: 'Script · macOS and Linux', iphone: 'Phone', android: 'Phone', ha: 'Smart home', chat: 'Chat bot' };
  var RUNS = {
    'sheets.standings': 'About hourly, by Sheets', 'sheets.left': 'About hourly, by Sheets', 'sheets.log': 'Every 30 minutes', 'sheets.email': 'Daily at about 8',
    'excel.standings': 'Every 15 minutes', 'excel.chart': 'When the file opens', 'excel.left': 'Every 15 minutes',
    'python.score': 'At the site’s pace', 'python.bot': 'Every 20 minutes', 'python.save': 'Once a day', 'python.chart': 'When you run it',
    'node.score': 'At the site’s pace', 'node.bot': 'Every 20 minutes', 'node.save': 'Once a day',
    'powershell.save': 'Once a day', 'powershell.score': 'At the site’s pace',
    'shell.save': 'Once a day', 'shell.csv': 'Every 20 minutes',
    'iphone.score': 'On a tap, or at set times', 'iphone.left': 'On a tap',
    'android.tap': 'On a tap', 'android.tasker': 'Every 20 minutes',
    'ha.sensor': 'At the site’s pace', 'ha.trade': 'Every 20 minutes',
    'chat.activity': 'Every 20 minutes', 'chat.sunday': 'At set times on Sundays',
  };

  function botPy(c) {
    return '# activity_bot.py: posts each new transaction and trade offer to a Discord or Slack channel.\n# Run it every 20 minutes. It remembers what it has posted in seen.json.\n' +
      'import json, pathlib, sys, requests\n\nURL = "' + U('activity', { name: 'activity-bot' }) + '"\nKEY = {"Authorization": "Bearer ' + c.K + '"}\n' +
      'WEBHOOK = "https://discord.com/api/webhooks/…"      # or your Slack incoming-webhook address\nHERE = pathlib.Path(__file__).parent\n' +
      'STOP, SEEN = HERE / "SITE_API_STOPPED", HERE / "seen.json"\n\n' +
      'if STOP.exists():\n    sys.exit(f"Stopped earlier: {STOP.read_text()}\\nFix the schedule, then delete {STOP.name}.")\n\n' +
      'r = requests.get(URL, headers=KEY, timeout=30)\nif r.status_code == 429:\n    err = r.json()["error"]\n' +
      '    if err["stop"] == "exit":            # too_fast: the schedule is too tight for the site\n        STOP.write_text(err["message"])\n        sys.exit(err["message"])\n' +
      '    sys.exit(0)                          # pace_changed: skip this run; the next is 20 minutes away\nr.raise_for_status()\n\n' +
      'rows = r.json()["data"]\nseen = set(json.loads(SEEN.read_text())) if SEEN.exists() else None\n' +
      'names = lambda ps: ", ".join(p["player"] for p in ps) or "nobody"\n' +
      'if seen is not None:                     # the first run only remembers; it posts nothing\n    for row in reversed([x for x in rows if x["id"] not in seen]):\n' +
      '        teams = " and ".join(t["team"] for t in row["teams"])\n        if row["kind"] == "trade":\n            text = f"🤝 Trade offer, {row[\'status\']}: {teams}"\n' +
      '        else:\n            text = f"📋 {teams} added {names(row[\'added\'])}, dropped {names(row[\'dropped\'])}"\n' +
      '        requests.post(WEBHOOK, json={"content": text}, timeout=30)   # Slack: json={"text": text}\nSEEN.write_text(json.dumps([x["id"] for x in rows]))\n';
  }
  function botJs(c) {
    return "// activity-bot.mjs: posts each new transaction and trade offer. Run it every 20 minutes. Node 18+.\nimport { existsSync, readFileSync, writeFileSync } from 'node:fs';\n\n" +
      "const ADDRESS = '" + U('activity', { name: 'activity-bot-js' }) + "';\nconst KEY = { Authorization: 'Bearer " + c.K + "' };\n" +
      "const WEBHOOK = 'https://discord.com/api/webhooks/…';   // or your Slack incoming-webhook address\n" +
      "const STOP = new URL('./SITE_API_STOPPED', import.meta.url);\nconst SEEN = new URL('./seen.json', import.meta.url);\n\n" +
      "if (existsSync(STOP)) { console.error(`Stopped earlier: ${readFileSync(STOP, 'utf8')}`); process.exit(1); }\n\n" +
      "const res = await fetch(ADDRESS, { headers: KEY });\nconst body = await res.json();\nif (res.status === 429) {\n" +
      "  if (body.error.stop === 'exit') writeFileSync(STOP, body.error.message);   // too_fast: stop for good\n  process.exit(body.error.stop === 'exit' ? 1 : 0); // pace_changed: skip this run\n}\n" +
      "if (!body.ok) throw new Error(body.error.message);\n\n" +
      "const seen = existsSync(SEEN) ? new Set(JSON.parse(readFileSync(SEEN, 'utf8'))) : null;\nconst names = (ps) => ps.map((p) => p.player).join(', ') || 'nobody';\n" +
      "if (seen) {                                        // the first run only remembers; it posts nothing\n  for (const row of body.data.filter((r) => !seen.has(r.id)).reverse()) {\n" +
      "    const teams = row.teams.map((t) => t.team).join(' and ');\n" +
      "    const content = row.kind === 'trade' ? `🤝 Trade offer, ${row.status}: ${teams}`\n      : `📋 ${teams} added ${names(row.added)}, dropped ${names(row.dropped)}`;\n" +
      "    await fetch(WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' },\n      body: JSON.stringify({ content }) });   // Slack: { text: content }\n  }\n}\n" +
      "writeFileSync(SEEN, JSON.stringify(body.data.map((r) => r.id)));\n";
  }
  function botLook() {
    var names = function (ps) { return ps.map(function (p) { return p.player; }).join(', ') || 'nobody'; };
    var rows = D._activity.slice(0, 3).reverse().map(function (r) {
      var teams = r.teams.map(function (t) { return t.team; }).join(' and ');
      return r.kind === 'trade' ? '🤝 Trade offer, ' + esc(r.status) + ': ' + esc(teams) : '📋 ' + esc(teams) + ' added ' + esc(names(r.added)) + ', dropped ' + esc(names(r.dropped));
    });
    return LOOK.chat('League Bot', rows, 'The three newest rows of your league’s activity, as the bot would post them.');
  }

  /* ---- highlighting for the code boxes --------------------------------------------------------------------------- */
  var KW = /\b(import|from|def|return|if|else|elif|while|for|in|not|and|or|const|let|await|async|function|new|continue|break|try|catch|throw|foreach|exit|case|esac|then|fi|let|in)\b/;
  function hlCode(text, lang) {
    var keyed = function (h) { return h.replace(/eft_(?:…|[A-Za-z0-9_-]{40})/g, function (k) { return '<span class="key">' + k + '</span>'; }); };
    if (lang === 'formula') {
      var o = '', l = 0, mm, r = /"[^"]*"/g;
      while ((mm = r.exec(text))) {
        o += esc(text.slice(l, mm.index)).replace(/\b(IMPORTDATA|QUERY|LET|IFERROR)\b/g, '<span class="k">$1</span>') + '<span class="s">' + esc(mm[0]) + '</span>';
        l = r.lastIndex;
      }
      return keyed(o + esc(text.slice(l)));
    }
    var cm = lang === 'js' || lang === 'm' ? '\\/\\/[^\\n]*' : '#[^\\n]*';
    var re = new RegExp('(' + cm + ')|("(?:[^"\\\\\\n]|\\\\.)*"|\'(?:[^\'\\\\\\n]|\\\\.)*\'|`(?:[^`\\\\]|\\\\.)*`)|(\\b\\d+(?:\\.\\d+)?\\b)|' + KW.source, 'g');
    var out = '', last = 0, m;
    while ((m = re.exec(text))) {
      out += esc(text.slice(last, m.index));
      if (m[1]) out += '<span class="c">' + esc(m[1]) + '</span>';
      else if (m[2]) out += '<span class="s">' + esc(m[2]) + '</span>';
      else if (m[3]) out += '<span class="n">' + esc(m[3]) + '</span>';
      else out += '<span class="kw">' + esc(m[0]) + '</span>';
      last = re.lastIndex;
    }
    out += esc(text.slice(last));
    return keyed(out);
  }
  function jobCode(job, c) {
    var text = job.code(c);
    return text;
  }


  /* ======== the design sample's src/35-jobs2.js ======== */
  /* ==========================================================================
     More jobs: lineup and injury alerts, weekly posts, the waiver wire, pandas,
     a lead-change alert, and a Calendar platform. Added to the platforms above
     so every list, count and copy button picks them up.
     ========================================================================== */
  GL.calendar = '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4.5" y="6.5" width="23" height="21"/><path d="M4.5 12.5h23M10.5 3.5v6M21.5 3.5v6"/><path d="M9.5 17h3M14.5 17h3M19.5 17h3M9.5 22h3M14.5 22h3" stroke-width="2.4"/></svg>';

  /* A starter worth a warning before kickoff: on bye, or listed out, doubtful, on IR or suspended. */
  var LINEUP_BAD = ['out', 'doubtful', 'injuredReserve', 'suspension'];
  function lineupProblems(t, week) {
    return D._rosterRows.filter(function (r) { return r.teamId === t && r.slot !== 'BE' && r.slot !== 'IR'; }).map(function (r) {
      if (r.bye === week) return r.player + ' (' + r.slot + ') is on bye';
      if (LINEUP_BAD.indexOf(r.injuryStatus) >= 0 || r.injuryStatus === 'questionable') return r.player + ' (' + r.slot + ') is ' + r.injuryStatus;
      return null;
    }).filter(Boolean);
  }
  function h2hLine(a, b) {
    var h = D.headToHead.filter(function (x) { return (x.teamA === a.teamId && x.teamB === b.teamId) || (x.teamA === b.teamId && x.teamB === a.teamId); })[0];
    if (!h || !h.games.length) return 'First meeting';
    var aw = h.teamA === a.teamId ? h.winsA : h.winsB, bw = h.teamA === a.teamId ? h.winsB : h.winsA;
    var lead = aw === bw ? 'Series level ' + aw + '–' + bw : (aw > bw ? a.team : b.team) + ' lead ' + Math.max(aw, bw) + '–' + Math.min(aw, bw);
    return lead + (h.ties ? ' (' + h.ties + ' tied)' : '');
  }
  function lastFinalWeek() {
    var weeks = {};
    D.schedule.forEach(function (m) { (weeks[m.week] = weeks[m.week] || []).push(m); });
    var done = Object.keys(weeks).filter(function (w) { return weeks[w].every(function (m) { return m.state === 'final'; }); }).map(Number);
    return done.length ? Math.max.apply(null, done) : null;
  }

  function addJobs(key, jobs) { PLATFORMS.filter(function (p) { return p.key === key; })[0].jobs = PLATFORMS.filter(function (p) { return p.key === key; })[0].jobs.concat(jobs); }

  addJobs('python', [
    { key: 'lineup', title: 'Check my lineup before kickoff', have: 'A list of your starters who are on bye, out, doubtful or questionable, printed when you run it before the games.',
      steps: ['Save the script below as <code>lineup_check.py</code> (Python 3.9+, <code>pip install requests</code>). Your team (<code>team=%T%</code>) and the league’s key are filled in.',
        'Run <code>python lineup_check.py</code> before the games: Thursday evening and Sunday morning.',
        'It checks only players whose games haven’t started, so a late run never warns about a game already played. For the same check as a phone notification, see <b>Lineup check on Sunday morning</b> in the iPhone guide.'],
      file: 'lineup_check.py', lang: 'py',
      code: function (c) {
        return '# lineup_check.py: lists starters on bye, out, doubtful or questionable, before their games.\nimport sys, pathlib, requests\n' +
          'URL = "' + U('rosters', { team: c.T, name: 'lineup-check' }) + '"\nKEY = {"Authorization": "Bearer ' + c.K + '"}\n' +
          'BAD = ("out", "doubtful", "injuredReserve", "suspension", "questionable")\n' +
          'STOP = pathlib.Path(__file__).with_name("SITE_API_STOPPED")\n' +
          'if STOP.exists():\n    sys.exit(f"Stopped earlier: {STOP.read_text()}\\nFix how often it runs, then delete {STOP.name}.")\n' +
          'r = requests.get(URL, headers=KEY, timeout=30)\nif r.status_code == 429:\n    err = r.json()["error"]\n' +
          '    if err["stop"] == "exit":                  # too_fast: it is being run too often for the site\n        STOP.write_text(err["message"])\n' +
          '    sys.exit(err["message"])                   # pace_changed: the message says when to try again\nr.raise_for_status()\nbody = r.json()\nweek = body["meta"]["week"]\nproblems = []\n' +
          'for p in body["data"]:\n    if p["slot"] in ("BE", "IR") or p["gameState"] in ("live", "final"):\n        continue\n' +
          '    if p["bye"] == week:\n        problems.append(f"{p[\'player\']} ({p[\'slot\']}) is on bye")\n' +
          '    elif p["injuryStatus"] in BAD:\n        problems.append(f"{p[\'player\']} ({p[\'slot\']}) is {p[\'injuryStatus\']}")\n' +
          'print("\\n".join(problems) or "Lineup looks good: no starter on bye or injured.")\n';
      },
      look: function (c) {
        var p = lineupProblems(c.T, WEEK);
        return LOOK.term([['pr', '$ python lineup_check.py']].concat(p.length ? p : ['Lineup looks good: no starter on bye or injured.']), 'Before Sunday’s games, for ' + c.TN + '.');
      },
      stop: STOPFILE() + ' Run again too soon, it prints the site’s message and asks nothing more.' },
    { key: 'pandas', title: 'Explore the league in pandas', have: 'Every section of the league as pandas tables in a notebook, ready to sort, chart and join.',
      steps: ['Install the tools: <code>pip install requests pandas jupyterlab</code>, then start a notebook with <code>jupyter lab</code>.',
        'Paste the cell below into a new notebook and run it. It asks <code>/full</code> once and builds a table per section.',
        'Try <code>weekly</code>, <code>rosters.sort_values("restOfSeasonProjection")</code>, or any section by name: <code>table("freeAgents")</code>.'],
      file: 'Notebook cell', lang: 'py',
      code: function (c) {
        return '# The whole league as pandas tables. Run the cell again at most once a minute.\nimport requests, pandas as pd\n' +
          'URL = "' + U('full', { name: 'pandas' }) + '"\nKEY = {"Authorization": "Bearer ' + c.K + '"}\n' +
          'r = requests.get(URL, headers=KEY, timeout=60)\nif r.status_code == 429:\n    raise SystemExit(r.json()["error"]["message"])   # asked too soon: the message says when\n' +
          'r.raise_for_status()\nleague = r.json()["data"]\n' +
          'def table(section):\n    return pd.json_normalize(league[section], sep="_")\n' +
          'standings, rosters, schedule = table("standings"), table("rosters"), table("schedule")\n' +
          'played = schedule[schedule.state == "final"]\n' +
          'weekly = pd.concat([played[["week", f"{s}_team", f"{s}_points"]].set_axis(["week", "team", "points"], axis=1)\n' +
          '                    for s in ("home", "away")]).pivot(index="team", columns="week", values="points")\n' +
          'weekly.assign(average=weekly.mean(axis=1)).sort_values("average", ascending=False).round(1)\n';
      },
      look: function () {
        var w = {}, weeks = [];
        D.schedule.forEach(function (m) { if (m.state !== 'final') return; if (weeks.indexOf(m.week) < 0) weeks.push(m.week); [m.home, m.away].forEach(function (s) { (w[s.team] = w[s.team] || {})[m.week] = s.points; }); });
        weeks.sort(function (a, b) { return a - b; });
        var rows = Object.keys(w).map(function (t) { var v = weeks.map(function (k) { return w[t][k]; }), got = v.filter(function (x) { return x != null; });
          return [t].concat(v).concat([got.reduce(function (a, b) { return a + b; }, 0) / (got.length || 1)]); })
          .sort(function (a, b) { return b[b.length - 1] - a[a.length - 1]; }).slice(0, 6);
        return '<div class="looks"><table class="nbtable"><tr><th>team</th>' + weeks.map(function (k) { return '<th>' + k + '</th>'; }).join('') + '<th>average</th></tr>' +
          rows.map(function (r) { return '<tr><th>' + esc(r[0]) + '</th>' + r.slice(1).map(function (v) { return '<td>' + (v == null ? 'NaN' : v.toFixed(1)) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table>' +
          '<p class="cap">The cell’s last line: points by week, best average first.</p></div>';
      },
      stop: 'A notebook asks only when you run the cell, so nothing keeps asking. If you run it again too soon, the cell stops with the site’s message; wait for the time it gives.' },
  ]);

  addJobs('sheets', [
    { key: 'waivers', title: 'A waiver-wire shortlist every Tuesday', have: 'An email of the best available players at each position, by rest-of-season projection, before waivers run.',
      steps: ['Open <b>Extensions → Apps Script</b> in any sheet, paste the script below into <code>Code.gs</code>, and add <code>SITE_API_KEY</code> under <b>Project Settings → Script properties</b>.',
        'Run <code>start</code> once and allow access. The email arrives every Tuesday at about 9, before the week’s waivers clear.',
        'Change <code>PER_POSITION</code> for a longer or shorter list; run <code>stop</code> to end it.'],
      file: 'Code.gs', lang: 'js',
      code: function (c) {
        return "// The best available players at each position, by email every Tuesday at about 9.\n" +
          "const URL = '" + U('full', { name: 'waiver-shortlist' }) + "';\nconst PER_POSITION = 3;\n" +
          "function start() {\n  stop();\n  ScriptApp.newTrigger('send').timeBased().onWeekDay(ScriptApp.WeekDay.TUESDAY).atHour(9).create();\n}\n" +
          "function stop() {\n  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));\n}\n" +
          "function send() {\n  const key = PropertiesService.getScriptProperties().getProperty('SITE_API_KEY');\n" +
          "  const res = UrlFetchApp.fetch(URL, { headers: { Authorization: 'Bearer ' + key }, muteHttpExceptions: true });\n" +
          "  const body = JSON.parse(res.getContentText());\n  const me = Session.getEffectiveUser().getEmail();\n" +
          "  if (!body.ok) {\n    if (body.error.stop === 'exit') stop();          // too_fast: switch the schedule off for good\n" +
          "    MailApp.sendEmail(me, 'Site API: no shortlist this week', body.error.message);\n    return;\n  }\n" +
          "  const rows = [];\n  for (const pos of ['QB', 'RB', 'WR', 'TE', 'D/ST', 'K']) {\n" +
          "    body.data.freeAgents.filter((p) => p.position === pos)\n      .sort((a, b) => b.restOfSeasonProjection - a.restOfSeasonProjection).slice(0, PER_POSITION)\n" +
          "      .forEach((p) => rows.push(`<tr><td>${pos}</td><td>${p.player}</td><td>${p.nflTeam}</td><td>${p.restOfSeasonProjection}</td>` +\n" +
          "        `<td>${p.status === 'onWaivers' ? 'On waivers' : 'Free agent'}</td></tr>`));\n  }\n" +
          "  MailApp.sendEmail({ to: me, subject: `${body.meta.league}: waiver shortlist, week ${body.meta.week}`,\n" +
          "    htmlBody: '<table><tr><th>Pos</th><th>Player</th><th>NFL</th><th>Rest of season</th><th>Status</th></tr>' + rows.join('') + '</table>' });\n}\n";
      },
      look: function () {
        var rows = [];
        ['QB', 'RB', 'WR', 'TE'].forEach(function (pos) {
          D.freeAgents.filter(function (p) { return p.position === pos; }).sort(function (a, b) { return b.restOfSeasonProjection - a.restOfSeasonProjection; }).slice(0, 2).forEach(function (p) {
            rows.push('<tr><td>' + pos + '</td><td>' + esc(p.player) + '</td><td>' + esc(p.nflTeam) + '</td><td>' + p.restOfSeasonProjection + '</td><td>' + (p.status === 'onWaivers' ? 'On waivers' : 'Free agent') + '</td></tr>');
          });
        });
        return '<div class="looks"><div class="mail"><div class="mh"><b>' + esc(LEAGUE) + ': waiver shortlist, week ' + WEEK + '</b><br>to me · Tue 9:04 AM</div><table><tr><th>Pos</th><th>Player</th><th>NFL</th><th>Rest of season</th><th>Status</th></tr>' + rows.join('') + '</table></div></div>';
      },
      stop: 'On <code>too_fast</code> it deletes its own schedule and emails you why. Any other refusal is emailed too, and next Tuesday’s run tries again.' },
  ]);

  addJobs('excel', [
    { key: 'freeagents', title: 'Rank the free agents', have: 'The waiver wire as a sortable table: every available player with projections, % owned and when waivers clear.',
      steps: ['Create a Blank Query as in the first job and paste the query below. It asks <code>/full</code> and keeps the <code>freeAgents</code> section.',
        'Close &amp; Load. Sort or filter by position; the list comes ranked by rest-of-season projection within each position.',
        'In the query’s properties tick <b>Refresh data when opening the file</b>: the list changes a few times a week.'],
      file: 'Power Query · Advanced Editor', lang: 'm',
      code: function (c) {
        return '// The waiver wire, ranked by rest-of-season projection within each position.\nlet\n' +
          '    Response = Web.Contents("' + U('full', { name: 'excel-free-agents' }) + '", [\n' +
          '        Headers = [Authorization = "Bearer ' + c.K + '"],\n' +
          '        ManualStatusHandling = {400, 401, 403, 404, 429, 500, 503}]),\n' +
          '    Body = Json.Document(Response),\n' +
          '    Checked = if Value.Metadata(Response)[Response.Status] = 200 then Body\n' +
          '        else error Error.Record("Site API", Body[#"error"][message]),\n' +
          '    Pool = Table.FromRecords(Checked[data][freeAgents]),\n' +
          '    Shown = Table.SelectColumns(Pool, {"position", "player", "nflTeam", "bye", "restOfSeasonProjection",\n' +
          '        "seasonAverage", "percentOwned", "status", "waiversClear"}),\n' +
          '    Sorted = Table.Sort(Shown, {{"position", Order.Ascending}, {"restOfSeasonProjection", Order.Descending}}),\n' +
          '    Typed = Table.TransformColumnTypes(Sorted, {{"restOfSeasonProjection", type number},\n' +
          '        {"seasonAverage", type number}, {"percentOwned", Percentage.Type}, {"waiversClear", type datetimezone}})\nin\n    Typed\n';
      },
      look: function () {
        var rows = [['position', 'player', 'nflTeam', 'restOfSeason', 'percentOwned']].concat(D.freeAgents.filter(function (p) { return p.position === 'RB'; })
          .sort(function (a, b) { return b.restOfSeasonProjection - a.restOfSeasonProjection; }).slice(0, 5).map(function (p) { return [p.position, p.player, p.nflTeam, p.restOfSeasonProjection, pct1(p.percentOwned)]; }));
        return LOOK.sheet('Free agents (query) · refreshed when the file opens', rows, 'The running backs, best first. Sort or filter by any column.');
      },
      stop: 'It asks only when the file opens, so it never asks too often. A refusal shows the site’s message in place of the refresh.' },
  ]);

  addJobs('iphone', [
    { key: 'lineup', title: 'Lineup check on Sunday morning', have: 'A notification before the games if a starter is on bye, out or doubtful, and a quiet all-clear if not.',
      steps: ['Make a new shortcut named <b>Lineup check</b> with the actions below. Its first actions are the stopped-note check and error handling from <b>My live score</b>.',
        'In <b>Automation → + → Time of Day</b>, choose Sunday at 11:00 AM, set it to <b>Run Immediately</b>, and run Lineup check. Add a Thursday one for the night game if you like.',
        'It checks only players whose games haven’t started.'],
      file: 'Shortcut actions', lang: 'actions',
      actions: function (c) {
        return actions([
          ['', 'The stopped-note check and error handling from <b>My live score</b>, with <b>Get Contents of URL</b> <code>' + esc(U('rosters', { team: c.T, name: 'iphone-lineup' })) + '</code>'],
          ['ok', '<b>Get Dictionary Value</b> for <code>meta.week</code> · <b>Set Variable</b> Week'],
          ['ok', '<b>Get Dictionary Value</b> for <code>data</code> · <b>Repeat with Each</b> item'],
          ['cond ind', '<b>If</b> <code>slot</code> is not <code>BE</code> or <code>IR</code>, and <code>gameState</code> is <code>pre</code>'],
          ['stop ind2', '<b>If</b> <code>bye</code> is Week: <b>Add to Variable</b> Problems “player is on bye”'],
          ['stop ind2', '<b>If</b> <code>injuryStatus</code> is <code>out</code>, <code>doubtful</code> or <code>injuredReserve</code>: <b>Add to Variable</b> Problems “player is injuryStatus”'],
          ['ok', '<b>End Repeat</b>'],
          ['cond', '<b>If</b> Problems <b>has any value</b>: <b>Show Notification</b> Problems · <b>Otherwise</b>: <b>Show Notification</b> “Lineup looks good”'],
        ]);
      },
      look: function (c) {
        var p = lineupProblems(c.T, WEEK);
        return LOOK.phone(notif('Shortcuts', 'Lineup check', p.length ? p.join(' · ') : 'Lineup looks good.'));
      },
      stop: 'The same stopped note as the live score shortcut; an automation that runs twice a week never comes near the pace.' },
  ]);

  addJobs('ha', [
    { key: 'lead', title: 'A notification when the lead changes', have: 'Your phone buzzes when you take the lead in your matchup, or lose it.',
      steps: ['Set up <b>My live score as a sensor</b> first.',
        'Replace its <code>rest:</code> block with the one below. It adds a <b>My fantasy lead</b> sensor beside the score, read from the same answer, so it costs no extra requests.',
        'Add the automation, restart Home Assistant, and replace <code>notify.notify</code> with your phone’s notify service if you have several.'],
      file: 'configuration.yaml', lang: 'yaml',
      code: function (c) {
        return '# The lead, from the same request as the live score: no extra asking.\nrest:\n  - resource: ' + U('scoreboard', { team: c.T, name: 'home-assistant' }) + '\n' +
          '    headers:\n      Authorization: !secret site_api_key\n    scan_interval: 31536000\n    sensor:\n      - name: My fantasy score\n        unique_id: site_api_my_score\n' +
          '        value_template: >-\n          {% if value_json.ok %}{% set m = value_json.data[0] %}\n          {{ m.home.points if m.home.teamId == ' + c.T + ' else m.away.points }}\n' +
          "          {% else %}{{ states('sensor.my_fantasy_score') }}{% endif %}\n        json_attributes: [ok, error, meta]\n" +
          '      - name: My fantasy lead\n        unique_id: site_api_my_lead\n        unit_of_measurement: pts\n' +
          '        value_template: >-\n          {% if value_json.ok %}{% set m = value_json.data[0] %}\n' +
          '          {% set me, them = (m.home, m.away) if m.home.teamId == ' + c.T + ' else (m.away, m.home) %}\n' +
          "          {{ (me.points - them.points) | round(1) }}\n          {% else %}{{ states('sensor.my_fantasy_lead') }}{% endif %}\n" +
          'automation:\n  - alias: Site API - the lead changed\n    trigger:\n      - platform: numeric_state\n        entity_id: sensor.my_fantasy_lead\n        above: 0\n        id: ahead\n' +
          '      - platform: numeric_state\n        entity_id: sensor.my_fantasy_lead\n        below: 0\n        id: behind\n    action:\n      - service: notify.notify\n        data:\n' +
          '          title: "{{ \'You took the lead\' if trigger.id == \'ahead\' else \'You fell behind\' }}"\n' +
          "          message: \"{{ states('sensor.my_fantasy_lead') }} points with {{ states('sensor.my_fantasy_score') }} scored\"\n";
      },
      look: function (c) {
        var m = myMatch(c.T), me = m.home.teamId === c.T ? m.home : m.away, them = m.home.teamId === c.T ? m.away : m.home, d = me.points - them.points;
        return LOOK.phone(notif('Home Assistant', d >= 0 ? 'You took the lead' : 'You fell behind', (d >= 0 ? '+' : '') + d.toFixed(1) + ' points with ' + me.points.toFixed(1) + ' scored'));
      },
      stop: 'It asks nothing itself: the lead sensor rides on the live score’s request, so the live score’s <b>Site API stopped</b> helper covers it.' },
  ]);

  addJobs('chat', [
    { key: 'injuries', title: 'Post injury news for every rostered player', have: 'A message in the league channel whenever a player on any team’s roster gets a new injury status, or comes off one.',
      steps: ['Create the webhook as in the first job.',
        'Save the script below as <code>injury-news.mjs</code> (Node 18+) and paste the webhook into <code>WEBHOOK</code>.',
        'Run it once by hand: the first run only remembers everyone’s status and posts nothing. Then schedule it every 20 minutes: <code>*/20 * * * * node /path/to/injury-news.mjs</code>.',
        'Each run posts at most one message, however many players changed.'],
      file: 'injury-news.mjs', lang: 'js',
      code: function (c) {
        return "// injury-news.mjs: posts to the league channel when a rostered player's injury status changes. Node 18+.\nimport { existsSync, readFileSync, writeFileSync } from 'node:fs';\n" +
          "const ADDRESS = '" + U('rosters', { name: 'injury-news' }) + "';\nconst KEY = { Authorization: 'Bearer " + c.K + "' };\n" +
          "const WEBHOOK = 'https://discord.com/api/webhooks/…';   // or your Slack incoming-webhook address\n" +
          "const STOP = new URL('./SITE_API_STOPPED', import.meta.url);\nconst LAST = new URL('./injuries.json', import.meta.url);\n" +
          "if (existsSync(STOP)) { console.error(`Stopped earlier: ${readFileSync(STOP, 'utf8')}`); process.exit(1); }\n" +
          "const res = await fetch(ADDRESS, { headers: KEY });\nconst body = await res.json();\nif (res.status === 429) {\n" +
          "  if (body.error.stop === 'exit') writeFileSync(STOP, body.error.message);   // too_fast: stop for good\n  process.exit(body.error.stop === 'exit' ? 1 : 0); // pace_changed: skip this run\n}\n" +
          "if (!body.ok) throw new Error(body.error.message);\nconst last = existsSync(LAST) ? JSON.parse(readFileSync(LAST, 'utf8')) : null;\n" +
          "const lines = [];\nfor (const p of last ? body.data : []) {\n  const was = last[p.playerId] ?? null, now = p.injuryStatus ?? null;\n" +
          "  if (!(p.playerId in last) || was === now) continue;           // new to a roster, or no change\n" +
          "  lines.push(`**${p.player}** (${p.position}, ${p.nflTeam}), ${p.team}: ${was ?? 'healthy'} → ${now ?? 'healthy'}`);\n}\n" +
          "if (lines.length) {\n  const post = await fetch(WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' },\n" +
          "    body: JSON.stringify({ content: `🩹 Injury news\\n${lines.join('\\n')}` }) });   // Slack: { text: … }\n" +
          "  if (!post.ok) throw new Error(`The webhook answered ${post.status}`);\n}\n" +
          "writeFileSync(LAST, JSON.stringify(Object.fromEntries(body.data.map((p) => [p.playerId, p.injuryStatus]))));\n";
      },
      look: function () {
        var hurt = D._rosterRows.filter(function (x) { return x.injuryStatus; }).slice(0, 3);
        return LOOK.chat('League Bot', ['<b>🩹 Injury news</b>' + hurt.map(function (r) {
          return '<div><b>' + esc(r.player) + '</b> (' + esc(r.position) + ', ' + esc(r.nflTeam) + '), ' + esc(r.team) + ': healthy → ' + esc(r.injuryStatus) + '</div>';
        }).join('')], 'Only changes are posted, never the whole list.');
      },
      stop: STOPFILE() + ' A run refused with <code>pace_changed</code> skips quietly; the next is 20 minutes away. The statuses are only saved after a run that was answered, so nothing is missed.' },
    { key: 'recap', title: 'Post the week’s results on Tuesdays', have: 'A recap in the channel once each week settles: every result, the top score, the closest game, the biggest win and the standings.',
      steps: ['Create the webhook as in the first job.',
        'Save the script below as <code>weekly_recap.py</code> (Python 3.9+, <code>pip install requests</code>) and paste the webhook into <code>WEBHOOK</code>.',
        'Schedule it on Tuesday mornings: <code>0 15 * * 2 python3 /path/to/weekly_recap.py</code>. It remembers the last week it posted, so a second run posts nothing.'],
      file: 'weekly_recap.py', lang: 'py',
      code: function (c) {
        return '# weekly_recap.py: posts the latest finished week to a Discord or Slack channel, once.\nimport json, pathlib, sys, requests\n' +
          'URL = "' + U('full', { name: 'weekly-recap' }) + '"\nKEY = {"Authorization": "Bearer ' + c.K + '"}\n' +
          'WEBHOOK = "https://discord.com/api/webhooks/…"      # or your Slack incoming-webhook address\nHERE = pathlib.Path(__file__).parent\n' +
          'STOP, POSTED = HERE / "SITE_API_STOPPED", HERE / "recap-posted.txt"\n' +
          'if STOP.exists():\n    sys.exit(f"Stopped earlier: {STOP.read_text()}\\nFix the schedule, then delete {STOP.name}.")\n' +
          'r = requests.get(URL, headers=KEY, timeout=60)\nif r.status_code == 429:\n    err = r.json()["error"]\n' +
          '    if err["stop"] == "exit":            # too_fast: the schedule is too tight for the site\n        STOP.write_text(err["message"])\n        sys.exit(err["message"])\n' +
          '    sys.exit(0)                          # pace_changed: skip; next Tuesday tries again\nr.raise_for_status()\nleague = r.json()["data"]\n' +
          '# the latest week whose every matchup has finished\nweeks = {}\nfor m in league["schedule"]:\n    weeks.setdefault(m["week"], []).append(m)\n' +
          'week = max((w for w, ms in weeks.items() if all(m["state"] == "final" for m in ms)), default=None)\n' +
          'if week is None or POSTED.exists() and POSTED.read_text() == str(week):\n    sys.exit(0)                          # nothing new to post\n' +
          'games = weeks[week]\ngap = lambda m: abs(m["home"]["points"] - m["away"]["points"])\n' +
          'lines = []\nfor m in games:\n    w, l = sorted((m["home"], m["away"]), key=lambda s: -s["points"])\n    lines.append(f"**{w[\'team\']}** {w[\'points\']:.1f} – {l[\'points\']:.1f} {l[\'team\']}")\n' +
          'top = max((s for m in games for s in (m["home"], m["away"])), key=lambda s: s["points"])\nclose, rout = min(games, key=gap), max(games, key=gap)\n' +
          'table = "\\n".join(f"{t[\'seed\']}. {t[\'team\']} ({t[\'wins\']}-{t[\'losses\']})" for t in league["standings"])\n' +
          'text = (f"🏈 **Week {week} results**\\n" + "\\n".join(lines) +\n' +
          '        f"\\n\\nTop score: {top[\'team\']}, {top[\'points\']:.1f}"\n' +
          '        f"\\nClosest: {close[\'home\'][\'team\']} v {close[\'away\'][\'team\']}, by {gap(close):.1f}"\n' +
          '        f"\\nBiggest win: {rout[\'home\'][\'team\']} v {rout[\'away\'][\'team\']}, by {gap(rout):.1f}"\n' +
          '        f"\\n\\n**Standings**\\n{table}")\n' +
          'requests.post(WEBHOOK, json={"content": text}, timeout=30).raise_for_status()   # Slack: json={"text": text}\nPOSTED.write_text(str(week))\n';
      },
      look: function () {
        var wk = lastFinalWeek(), g = D.schedule.filter(function (m) { return m.week === wk; });
        var gap = function (m) { return Math.abs(m.home.points - m.away.points); };
        var lines = g.map(function (m) { var w = m.home.points >= m.away.points ? [m.home, m.away] : [m.away, m.home]; return '<div><b>' + esc(w[0].team) + '</b> ' + w[0].points.toFixed(1) + ' – ' + w[1].points.toFixed(1) + ' ' + esc(w[1].team) + '</div>'; });
        var close = g.slice().sort(function (a, b) { return gap(a) - gap(b); })[0];
        return LOOK.chat('League Bot', ['<b>🏈 Week ' + wk + ' results</b>' + lines.join('') + '<div style="margin-top:6px">Closest: ' + esc(close.home.team) + ' v ' + esc(close.away.team) + ', by ' + gap(close).toFixed(1) + '</div>'], 'Posted once, the Tuesday after the week settles.');
      },
      stop: STOPFILE() + ' A run refused with <code>pace_changed</code> skips; a week is only marked posted once it has been.' },
    { key: 'rivalry', title: 'Post a rivalry preview for each matchup', have: 'Midweek, every matchup with its all-time head-to-head record and when the two last met.',
      steps: ['Create the webhook as in the first job.',
        'Save the script below as <code>rivalry-preview.mjs</code> (Node 18+) and paste the webhook into <code>WEBHOOK</code>.',
        'Schedule it on Wednesdays: <code>0 16 * * 3 node /path/to/rivalry-preview.mjs</code>.'],
      file: 'rivalry-preview.mjs', lang: 'js',
      code: function (c) {
        return "// rivalry-preview.mjs: this week's matchups with their all-time head-to-head records. Node 18+.\nimport { existsSync, writeFileSync } from 'node:fs';\n" +
          "const ADDRESS = '" + U('full', { name: 'rivalry-preview' }) + "';\nconst KEY = { Authorization: 'Bearer " + c.K + "' };\n" +
          "const WEBHOOK = 'https://discord.com/api/webhooks/…';     // or your Slack incoming-webhook address\nconst STOP = new URL('./SITE_API_STOPPED', import.meta.url);\n" +
          "if (existsSync(STOP)) process.exit(1);\nconst res = await fetch(ADDRESS, { headers: KEY });\nconst body = await res.json();\nif (res.status === 429) {\n" +
          "  if (body.error.stop === 'exit') writeFileSync(STOP, body.error.message);   // too_fast: stop for good\n  process.exit(1);                                 // pace_changed: skip this week's post\n}\n" +
          "if (!body.ok) throw new Error(body.error.message);\nconst { scoreboard, headToHead } = body.data;\n" +
          "const lines = scoreboard.map(({ home, away }) => {\n  const h = headToHead.find((x) => [x.teamA, x.teamB].includes(home.teamId) && [x.teamA, x.teamB].includes(away.teamId));\n" +
          "  if (!h || !h.games.length) return `**${home.team}** v **${away.team}**: first meeting`;\n" +
          "  const [hw, aw] = h.teamA === home.teamId ? [h.winsA, h.winsB] : [h.winsB, h.winsA];\n  const last = h.games[h.games.length - 1];\n" +
          "  const lead = hw === aw ? `level ${hw}–${aw}` : `${hw > aw ? home.team : away.team} lead ${Math.max(hw, aw)}–${Math.min(hw, aw)}`;\n" +
          "  return `**${home.team}** v **${away.team}**: ${lead}, last met ${last.season} week ${last.week}`;\n});\n" +
          "const post = await fetch(WEBHOOK, {\n  method: 'POST', headers: { 'Content-Type': 'application/json' },\n" +
          "  body: JSON.stringify({ content: `⚔️ Week ${body.meta.week} rivalries\\n${lines.join('\\n')}` }),   // Slack: { text: … }\n});\nif (!post.ok) throw new Error(`The webhook answered ${post.status}`);\n";
      },
      look: function () {
        return LOOK.chat('League Bot', ['<b>⚔️ Week ' + WEEK + ' rivalries</b>' + D.scoreboard.slice(0, 4).map(function (m) {
          return '<div><b>' + esc(m.home.team) + '</b> v <b>' + esc(m.away.team) + '</b>: ' + esc(h2hLine(m.home, m.away)) + '</div>';
        }).join('')], 'Midweek, before the games.');
      },
      stop: STOPFILE() },
  ]);

  PLATFORMS.push({ key: 'calendar', name: 'Calendar', glyph: GL.calendar, schedule: true,
    stops: 'Google’s script switches its own schedule off; the file script uses the stop file',
    jobs: [
      { key: 'gcal', title: 'My matchups in Google Calendar', have: 'An event for each of your matchups, Thursday to Monday, updated every Wednesday with results and the next opponent.',
        steps: ['Go to <b>script.google.com</b>, start a new project, and paste the script below into <code>Code.gs</code>. Your team (<code>TEAM = %T%</code>) is filled in.',
          'Add <code>SITE_API_KEY</code> under <b>Project Settings → Script properties</b> with the league’s key as its value.',
          'Run <code>start</code> once and allow access to your calendar. It adds the season now, then updates every Wednesday; run <code>stop</code> to end it.',
          'Events are marked as the script’s own, so it updates them rather than adding copies, and never touches anything else in your calendar.'],
        file: 'Code.gs', lang: 'js',
        code: function (c) {
          return "// Your matchups in Google Calendar, Thursday to Monday, updated every Wednesday.\n" +
            "const URL = '" + U('full', { name: 'gcal-matchups' }) + "';\nconst TEAM = " + c.T + ";\nconst DAY = 24 * 3600 * 1000;\n" +
            "function start() {\n  stop();\n  ScriptApp.newTrigger('update').timeBased().onWeekDay(ScriptApp.WeekDay.WEDNESDAY).atHour(9).create();\n  update();\n}\n" +
            "function stop() {\n  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));\n}\n" +
            "// The date a game is played on in the US, as a date in your calendar.\nconst usDay = (iso) => { const d = new Date(Date.parse(iso) - 5 * 3600 * 1000); return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); };\n" +
            "function update() {\n  const key = PropertiesService.getScriptProperties().getProperty('SITE_API_KEY');\n" +
            "  const res = UrlFetchApp.fetch(URL, { headers: { Authorization: 'Bearer ' + key }, muteHttpExceptions: true });\n  const body = JSON.parse(res.getContentText());\n" +
            "  if (res.getResponseCode() === 429) {\n    if (body.error.stop === 'exit') {            // too_fast: switch the schedule off for good\n      stop();\n" +
            "      MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'Site API stopped your calendar', body.error.message);\n    }\n" +
            "    return;                                       // pace_changed: next Wednesday tries again\n  }\n  if (!body.ok) throw new Error(body.error.message);\n" +
            "  const { schedule, nflSchedule } = body.data;\n  const cal = CalendarApp.getDefaultCalendar();\n" +
            "  for (const m of schedule.filter((x) => x.home.teamId === TEAM || x.away.teamId === TEAM)) {\n" +
            "    const games = nflSchedule.filter((g) => g.week === m.week).map((g) => g.kickoff).sort();\n    if (!games.length) continue;\n" +
            "    const first = usDay(games[0]), end = new Date(usDay(games[games.length - 1]).getTime() + DAY);\n" +
            "    const [me, them] = m.home.teamId === TEAM ? [m.home, m.away] : [m.away, m.home];\n" +
            "    const title = m.state === 'final'\n      ? `${me.points > them.points ? 'W' : me.points < them.points ? 'L' : 'T'} ${me.points}–${them.points} v ${them.team}`\n" +
            "      : `Week ${m.week}: v ${them.team}`;\n    const tag = `${TEAM}-${m.week}`;\n" +
            "    const ev = cal.getEvents(first, end).find((e) => e.getTag('siteApi') === tag);\n" +
            "    if (ev) ev.setTitle(title);\n    else cal.createAllDayEvent(title, first, end).setTag('siteApi', tag);\n  }\n}\n";
        },
        look: function (c) {
          var mine = D.schedule.filter(function (m) { return m.home.teamId === c.T || m.away.teamId === c.T; }).slice(0, 5);
          return '<div class="looks"><div class="calmock">' + mine.map(function (m) {
            var me = m.home.teamId === c.T ? m.home : m.away, them = m.home.teamId === c.T ? m.away : m.home;
            var t = m.state === 'final' ? (me.points > them.points ? 'W ' : 'L ') + me.points + '–' + them.points + ' v ' + them.team : 'Week ' + m.week + ': v ' + them.team;
            return '<div class="calrow"><span class="wk">Wk ' + m.week + '</span><span class="ev' + (m.state === 'final' ? ' done' : '') + '">' + esc(t) + '</span></div>';
          }).join('') + '</div><p class="cap">All-day events, Thursday to Monday. Finished weeks show the result.</p></div>';
        },
        stop: 'On <code>too_fast</code> it deletes its own schedule and emails you the site’s message. On <code>pace_changed</code> it skips; next Wednesday’s run tries again.' },
      { key: 'ics', title: 'A calendar file of the season', have: 'One .ics file with every matchup of your season, for Apple Calendar, Outlook or any calendar that imports files.',
        steps: ['Save the script below as <code>season_calendar.py</code> (Python 3.9+, <code>pip install requests</code>) and run it: <code>python season_calendar.py</code>.',
          'It writes <code>fantasy-season.ics</code> beside the script. Open it, or import it into your calendar app.',
          'Run it again after a week settles and import the file again to add the result. Each event keeps the same identity, and a result carries a higher revision than the preview it replaces, so a calendar that imports by identity updates the event rather than adding a copy.'],
        file: 'season_calendar.py', lang: 'py',
        code: function (c) {
          return "# season_calendar.py: every matchup of your season as an .ics calendar file.\nimport sys, pathlib, datetime, requests\nURL = \"%URL%\"\nKEY = {\"Authorization\": \"Bearer %KEY%\"}\nTEAM = %TEAM%\nHERE = pathlib.Path(__file__).parent\nSTOP = HERE / \"SITE_API_STOPPED\"\nif STOP.exists():\n    sys.exit(f\"Stopped earlier: {STOP.read_text()}\")\nr = requests.get(URL, headers=KEY, timeout=60)\nif r.status_code == 429:\n    err = r.json()[\"error\"]\n    if err[\"stop\"] == \"exit\":\n        STOP.write_text(err[\"message\"])\n    sys.exit(err[\"message\"])      # pace_changed: the message says when to try again\nr.raise_for_status()\nleague = r.json()[\"data\"]\ndef us_day(iso):                  # the date a game is played on in the US\n    t = datetime.datetime.fromisoformat(iso.replace(\"Z\", \"+00:00\")) - datetime.timedelta(hours=5)\n    return t.date()\ndef text(s):                      # calendar text: \\ ; , and line breaks are escaped\n    return s.replace(\"\\\\\", \"\\\\\\\\\").replace(\";\", \"\\\\;\").replace(\",\", \"\\\\,\").replace(\"\\n\", \"\\\\n\")\ndef fold(line):                   # a line longer than 75 bytes continues on the next, after a space\n    parts, cur = [], b\"\"\n    for ch in line:\n        b = ch.encode()\n        if len(cur) + len(b) > (74 if parts else 75):\n            parts.append(cur.decode())\n            cur = b\"\"\n        cur += b\n    return \"\\r\\n \".join(parts + [cur.decode()])\nstamp = datetime.datetime.now(datetime.timezone.utc).strftime(\"%Y%m%dT%H%M%SZ\")\nlines = [\"BEGIN:VCALENDAR\", \"VERSION:2.0\", \"PRODID:-//Site API//Season//EN\", \"METHOD:PUBLISH\",\n         \"X-WR-CALNAME:\" + text(league[\"league\"][\"name\"])]\nfor m in league[\"schedule\"]:\n    if TEAM not in (m[\"home\"][\"teamId\"], m[\"away\"][\"teamId\"]):\n        continue\n    kicks = sorted(g[\"kickoff\"] for g in league[\"nflSchedule\"] if g[\"week\"] == m[\"week\"])\n    if not kicks:\n        continue\n    me, them = (m[\"home\"], m[\"away\"]) if m[\"home\"][\"teamId\"] == TEAM else (m[\"away\"], m[\"home\"])\n    if m[\"state\"] == \"final\":\n        wl = \"W\" if me[\"points\"] > them[\"points\"] else \"L\" if me[\"points\"] < them[\"points\"] else \"T\"\n        title = f\"{wl} {me['points']}–{them['points']} v {them['team']}\"\n    else:\n        title = f\"Week {m['week']}: v {them['team']}\"\n    end = us_day(kicks[-1]) + datetime.timedelta(days=1)\n    lines += [\"BEGIN:VEVENT\", f\"UID:week-{m['week']}-team-{TEAM}@site-api\", f\"DTSTAMP:{stamp}\",\n              f\"SEQUENCE:{1 if m['state'] == 'final' else 0}\",   # a result replaces the preview\n              f\"DTSTART;VALUE=DATE:{us_day(kicks[0]):%Y%m%d}\", f\"DTEND;VALUE=DATE:{end:%Y%m%d}\",\n              \"SUMMARY:\" + text(title), \"TRANSP:TRANSPARENT\", \"END:VEVENT\"]\nlines.append(\"END:VCALENDAR\")\n(HERE / \"fantasy-season.ics\").write_bytes((\"\\r\\n\".join(fold(l) for l in lines) + \"\\r\\n\").encode(\"utf-8\"))\nprint(f\"Saved fantasy-season.ics ({lines.count('BEGIN:VEVENT')} matchups)\")\n"
            .split('%URL%').join(U('full', { name: 'season-ics' })).split('%KEY%').join(c.K).split('%TEAM%').join(String(c.T));
        },
        look: function (c) {
          var n = D.schedule.filter(function (m) { return m.home.teamId === c.T || m.away.teamId === c.T; }).length;
          return LOOK.term([['pr', '$ python season_calendar.py'], 'Saved fantasy-season.ics (' + n + ' matchups)', ['pr', '$ head -9 fantasy-season.ics'],
            'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Site API//Season//EN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + LEAGUE, 'BEGIN:VEVENT', 'UID:week-1-team-' + c.T + '@site-api', 'DTSTAMP:…', '…']);
        },
        stop: STOPFILE() },
    ] });

  Object.assign(PLAT_KIND, { calendar: 'Calendar' });
  Object.assign(RUNS, {
    'python.lineup': 'When you run it', 'python.pandas': 'When you run the cell', 'chat.injuries': 'Every 20 minutes',
    'sheets.waivers': 'Tuesdays at about 9', 'excel.freeagents': 'When the file opens', 'iphone.lineup': 'Sunday morning',
    'ha.lead': 'With the live score', 'chat.recap': 'Tuesday mornings', 'chat.rivalry': 'Wednesdays',
    'calendar.gcal': 'Wednesdays at about 9', 'calendar.ics': 'When you run it',
  });

  /* What each job calls itself in name=, read from its own code: Site Backend's Jobs panel counts requests by it. */
  function jobNames() {
    var c = { K: 'eft_…', T: S.guideTeam, TN: teamName(S.guideTeam), p: pace() }, out = {};
    PLATFORMS.forEach(function (p) {
      p.jobs.forEach(function (j) {
        var text = j.code ? j.code(c) : j.actions(c), m, re = /name=([a-z0-9-]+)/g;
        while ((m = re.exec(text))) (out[m[1]] = out[m[1]] || []).push({ p: p, j: j });
      });
    });
    return out;
  }
  /* Scripts are shown and copied without blank lines. */
  function tidy(text) { return text.split('\n').filter(function (l) { return l.trim() !== ''; }).join('\n') + '\n'; }
  function jobText(j, c, extra) { return tidy(extra ? j.extra.text : j.code(c)); }


  return { GL: GL, PLATFORMS: PLATFORMS, PLAT_KIND: PLAT_KIND, RUNS: RUNS, LOOK: LOOK, jobNames: jobNames, tidy: tidy, jobText: jobText, hlCode: hlCode, gctx: gctx };
}
