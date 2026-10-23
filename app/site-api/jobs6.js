/**
 * Site API: the week-6 jobs (plan N3, PD24, PD43).
 *
 * The twelve picked jobs — close-game alert, whole-league live ticker, desk scoreboard, injury status change, bye-week
 * planner, notable drop alert, trade breakdown post, playoff odds tracker, clinched / eliminated post, weekly awards,
 * SQL over the league, season dashboard — each on the platforms its row lists, with ntfy wherever the job is an
 * alert. Five platforms join the page: ntfy, Telegram, GroupMe, desk and TV displays, and dashboards and SQL.
 *
 * Every example keeps the page's rules: it keeps the site's pace (or runs on a schedule of at least a minute, which
 * is never too fast), pauses on pace_changed and stops for good on too_fast. The Python alert scripts are built from
 * one set of parts (how to ask, how to remember, how to send), so each is whole and stands alone, and every one is
 * run by test/jobkit.mjs against a mock of the API that keeps the real rate rule with time sped up.
 *
 * `addWeek6Jobs(g)` is called by makeGuides() with the guides' own helpers.
 */
/* eslint-disable */
export function addWeek6Jobs(g) {
  var PLATFORMS = g.PLATFORMS, GL = g.GL, PLAT_KIND = g.PLAT_KIND, RUNS = g.RUNS, U = g.U, D = g.D, LOOK = g.LOOK, esc = g.esc;
  var notif = g.notif, myMatch = g.myMatch, WEEK = g.WEEK, LEAGUE = g.LEAGUE, STOPFILE = g.STOPFILE, standingsNow = g.standingsNow;
  var addJobs = g.addJobs, lastFinalWeek = g.lastFinalWeek;
  function rosterOf(t) { return D._rosterRows.filter(function (r) { return r.teamId === t; }); }

  GL.ntfy = '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 22V14a7 7 0 0 1 14 0v8l2.5 3h-19z"/><path d="M13.5 28h5"/></svg>';
  GL.telegram = '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 15.5 27 6l-4 20-7.5-6-3.5 4v-5.5L23 10l-13.5 8z"/></svg>';
  GL.groupme = '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="5" width="24" height="18" rx="3"/><path d="M10 23v5l5-5"/><path d="M12 10.5v8M18 10.5v8M9.5 13h11M9.5 16.5h11"/></svg>';
  GL.display = '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="5" width="25" height="17" rx="1"/><path d="M12 27h8M16 22v5"/><path d="M8 13.5h4M14 11v5M18.5 13.5h5" stroke-width="2.2"/></svg>';
  GL.data = '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8"><ellipse cx="16" cy="8" rx="10" ry="3.5"/><path d="M6 8v16c0 2 4.5 3.5 10 3.5s10-1.5 10-3.5V8"/><path d="M6 16c0 2 4.5 3.5 10 3.5s10-1.5 10-3.5"/></svg>';

  /* ======================================================================== Python, from parts */

  var PREP = {
    ntfy: { imports: [], conf: 'NTFY = "https://ntfy.sh"                    # or your own ntfy server\nTOPIC = "pick-a-long-private-topic"         # anyone who knows the topic can read it\n',
      send: 'def send(title, text):\n    requests.post(NTFY, json={"topic": TOPIC, "title": title, "message": text, "tags": ["football"]}, timeout=30)\n',
      setup: ['Install the free <b>ntfy</b> app (iPhone or Android) and subscribe to a topic of your own: a long, random name, because anyone who knows a topic on the public server can read it. To keep it entirely in your hands, run your own ntfy server and put its address in <code>NTFY</code>.',
        'Put the topic in <code>TOPIC</code> in the script.'] },
    telegram: { imports: [], conf: 'TOKEN = "123456789:your-bot-token"       # from @BotFather\nCHAT = "-1001234567890"                   # the group\'s chat id\nTELEGRAM = "https://api.telegram.org"\n',
      send: 'def send(title, text):\n    requests.post(f"{TELEGRAM}/bot{TOKEN}/sendMessage", json={"chat_id": CHAT, "text": f"{title}\\n{text}"}, timeout=30)\n',
      setup: ['In Telegram, message <b>@BotFather</b>, send <code>/newbot</code>, and copy the token it gives you into <code>TOKEN</code>.',
        'Add the bot to your league’s group and send any message there. Open <code>https://api.telegram.org/bot&lt;token&gt;/getUpdates</code> in a browser and copy the group’s <code>chat.id</code> (it starts with <code>-</code>) into <code>CHAT</code>.'] },
    groupme: { imports: [], conf: 'BOT = "your-bot-id"                        # from dev.groupme.com\nGROUPME = "https://api.groupme.com/v3/bots/post"\n',
      send: 'def send(title, text):\n    requests.post(GROUPME, json={"bot_id": BOT, "text": f"{title}\\n{text}"[:1000]}, timeout=30)\n',
      setup: ['Sign in at <b>dev.groupme.com</b>, choose <b>Bots → Create Bot</b>, pick your league’s group and name it.',
        'Copy the bot’s <b>Bot ID</b> into <code>BOT</code>.'] },
    chat: { imports: [], conf: 'WEBHOOK = "https://discord.com/api/webhooks/…"      # or your Slack incoming-webhook address\n',
      send: 'def send(title, text):\n    requests.post(WEBHOOK, json={"content": f"**{title}**\\n{text}"}, timeout=30)   # Slack: json={"text": ...}\n',
      setup: ['Create a webhook for your channel: in Discord, <b>Edit Channel → Integrations → Webhooks → New Webhook → Copy Webhook URL</b>; in Slack, add an <b>Incoming Webhook</b> to the channel.',
        'Paste the address into <code>WEBHOOK</code>.'] },
    email: { imports: ['smtplib', 'from email.message import EmailMessage'], conf: 'SMTP_HOST, SMTP_PORT, SMTP_TLS = "smtp.gmail.com", 587, True\nSMTP_USER = "you@example.com"\nSMTP_PASSWORD = "an app password"          # Gmail: Account → Security → App passwords\nTO = "you@example.com"\n',
      send: 'def send(title, text):\n    msg = EmailMessage()\n    msg["Subject"], msg["From"], msg["To"] = title, SMTP_USER, TO\n    msg.set_content(text)\n    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as s:\n        if SMTP_TLS:\n            s.starttls()\n        s.login(SMTP_USER, SMTP_PASSWORD)\n        s.send_message(msg)\n',
      setup: ['Fill in your mail server: for Gmail, <code>smtp.gmail.com</code> on port 587 with an <b>app password</b> (Google Account → Security → App passwords), never your real password.',
        'Set <code>TO</code> to the address that should get it.'] },
  };
  var SEND_NAME = { ntfy: 'ntfy', telegram: 'Telegram', groupme: 'GroupMe', chat: 'the channel', email: 'email' };

  /* A scheduled run: asks once (or twice, in one round), remembers in a small JSON file, and stops on too_fast. */
  function pyScheduled(o) {
    var p = PREP[o.via];
    var imports = ['json', 'pathlib', 'sys', 'requests'].concat(p.imports.filter(function (x) { return x.indexOf(' ') < 0; }));
    var froms = p.imports.filter(function (x) { return x.indexOf(' ') > 0; });
    return '# ' + o.file + ': ' + o.desc + '\n# ' + o.when + '. It remembers what it has seen in ' + o.state + '.json.\n' +
      'import ' + imports.join(', ') + '\n' + froms.map(function (x) { return x + '\n'; }).join('') + '\n' +
      o.urls + 'KEY = {"Authorization": "Bearer ' + o.c.K + '"}\n' + p.conf + (o.conf || '') +
      'HERE = pathlib.Path(__file__).parent\nSTOP, STATE = HERE / "SITE_API_STOPPED", HERE / "' + o.state + '.json"\n\n' +
      'if STOP.exists():\n    sys.exit(f"Stopped earlier: {STOP.read_text()}\\nFix the schedule, then delete {STOP.name}.")\n\n' +
      'def ask(url):\n    r = requests.get(url, headers=KEY, timeout=60)\n    if r.status_code == 429:\n        err = r.json()["error"]\n' +
      '        if err["stop"] == "exit":            # too_fast: the schedule is too tight for the site\n            STOP.write_text(err["message"])\n            sys.exit(err["message"])\n' +
      '        sys.exit(0)                          # pace_changed: skip this run; the next one tries again\n    r.raise_for_status()\n    return r.json()["data"]\n\n' +
      p.send + '\n' + o.body;
  }
  function pyFile(o) { return o.file; }

  /* ---- the checks ---- */
  function injuryBody() {
    return 'now = {str(p["playerId"]): [p["player"], p["position"], p["nflTeam"], p["injuryStatus"]] for p in ask(URL)}\n' +
      'was = json.loads(STATE.read_text()) if STATE.exists() else None\n' +
      'if was is not None:                     # the first run only remembers; it sends nothing\n' +
      '    for pid, (player, pos, nfl, status) in now.items():\n        old = was.get(pid)\n' +
      '        if old and old[3] != status:\n            send("Injury update", f"{player} ({pos}, {nfl}): {old[3] or \'healthy\'} → {status or \'healthy\'}")\n' +
      'STATE.write_text(json.dumps(now))\n';
  }
  function dropBody() {
    return 'LINE = 0.5                               # notable: rostered in at least half of ESPN leagues\n' +
      'rows = ask(ACTIVITY)\nseen = set(json.loads(STATE.read_text())) if STATE.exists() else None\n' +
      'drops = [(row, p) for row in reversed(rows) if seen is not None and row["id"] not in seen for p in row["dropped"]]\n' +
      'if drops:                                # the whole league only when there is something to look up\n' +
      '    players = {p["playerId"]: p for p in ask(FULL)["players"]}\n    for row, p in drops:\n' +
      '        owned = (players.get(p["playerId"]) or {}).get("percentOwned") or 0\n        if owned >= LINE:\n' +
      '            send("Notable drop", f"{row[\'teams\'][0][\'team\']} dropped {p[\'player\']} ({p[\'position\']}, {p[\'nflTeam\']}), "\n' +
      '                                 f"rostered in {owned:.0%} of ESPN leagues")\n' +
      'STATE.write_text(json.dumps([x["id"] for x in rows]))\n';
  }
  function decidedBody() {
    return 'rows = ask(URL)\nnow = {str(t["teamId"]): t["decided"] for t in rows}\n' +
      'was = json.loads(STATE.read_text()) if STATE.exists() else None\n' +
      'if was is not None:                     # the first run only remembers; it sends nothing\n    for t in rows:\n' +
      '        if t["decided"] and was.get(str(t["teamId"])) != t["decided"]:\n            record = f"{t[\'wins\']}-{t[\'losses\']}" + (f"-{t[\'ties\']}" if t["ties"] else "")\n' +
      '            if t["decided"] == "clinched":\n                send("Clinched", f"{t[\'team\']} ({record}) has clinched a playoff place.")\n' +
      '            else:\n                send("Eliminated", f"{t[\'team\']} ({record}) is out of the playoff race.")\n' +
      'STATE.write_text(json.dumps(now))\n';
  }
  function awardsBody() {
    return 'league = ask(URL)\ngames = [m for m in league["schedule"] if not m["postseasonRound"]]\n' +
      'weeks = sorted({m["week"] for m in games if all(x["state"] == "final" for x in games if x["week"] == m["week"])})\n' +
      'done = json.loads(STATE.read_text()) if STATE.exists() else []\nif not weeks or weeks[-1] in done:\n    sys.exit(0)                          # nothing new since the last post\n' +
      'week = weeks[-1]\nsides = []\nfor m in (x for x in games if x["week"] == week):\n    h, a = m["home"], m["away"]\n' +
      '    sides += [(h, a, h["points"] - a["points"]), (a, h, a["points"] - h["points"])]\n' +
      'scores = sorted(s[0]["points"] for s in sides)\nmedian = (scores[len(scores) // 2] + scores[(len(scores) - 1) // 2]) / 2\n' +
      'top = max(sides, key=lambda s: s[0]["points"])\nlow = min(sides, key=lambda s: s[0]["points"])\n' +
      'blowout = max(sides, key=lambda s: s[2])\nclose = min((s for s in sides if s[2] > 0), key=lambda s: s[2], default=None)\n' +
      'lucky = min((s for s in sides if s[2] > 0), key=lambda s: s[0]["points"], default=None)\nunlucky = max((s for s in sides if s[2] < 0), key=lambda s: s[0]["points"], default=None)\n' +
      'lines = [f"🏆 Top score: {top[0][\'team\']}, {top[0][\'points\']:.2f}",\n         f"🪫 Lowest score: {low[0][\'team\']}, {low[0][\'points\']:.2f}",\n' +
      '         f"💥 Blowout: {blowout[0][\'team\']} beat {blowout[1][\'team\']} by {blowout[2]:.2f}"]\n' +
      'if close:\n    lines.append(f"😬 Nail-biter: {close[0][\'team\']} beat {close[1][\'team\']} by {close[2]:.2f}")\n' +
      'if lucky and lucky[0]["points"] < median:\n    lines.append(f"🍀 Luckiest win: {lucky[0][\'team\']} won with {lucky[0][\'points\']:.2f}, below the week\'s median")\n' +
      'if unlucky and unlucky[0]["points"] > median:\n    lines.append(f"🌧 Unluckiest loss: {unlucky[0][\'team\']} lost with {unlucky[0][\'points\']:.2f}, above the week\'s median")\n' +
      'send(f"Week {week} awards", "\\n".join(lines))\nSTATE.write_text(json.dumps(done + [week]))\n';
  }

  /* The close-game watch keeps the pace itself: it runs all game long, like the live score. */
  function pyClose(c, via, name) {
    var p = PREP[via];
    var imports = ['pathlib', 'sys', 'time', 'requests'].concat(p.imports.filter(function (x) { return x.indexOf(' ') < 0; }));
    return '# close_game.py: an alert when your matchup is close late in the week, at the site\'s pace.\n# Start it before the games; it stops by itself when your matchup is final.\n' +
      'import ' + imports.join(', ') + '\n\n' +
      'URL = "' + U('scoreboard', { team: c.T, name: name }) + '"\nKEY = {"Authorization": "Bearer ' + c.K + '"}\n' + p.conf +
      'CLOSE = 10                               # points apart, or fewer\nLATE = 2                                 # starters left to play, both sides together\n' +
      'STOP = pathlib.Path(__file__).with_name("SITE_API_STOPPED")\n\n' +
      'if STOP.exists():\n    sys.exit(f"Stopped earlier: {STOP.read_text()}\\nFix the interval, then delete {STOP.name}.")\n\n' + p.send + '\n' +
      'told, etag = set(), None\nwhile True:\n    headers = {**KEY, **({"If-None-Match": etag} if etag else {})}\n' +
      '    r = requests.get(URL, headers=headers, timeout=30)\n    if r.status_code == 429:\n        err = r.json()["error"]\n' +
      '        if err["stop"] == "exit":                  # too_fast: this program asks too often\n            STOP.write_text(err["message"])\n            sys.exit(err["message"])\n' +
      '        time.sleep(int(r.headers["Retry-After"]))  # pace_changed: the site slowed down\n        continue\n' +
      '    if r.status_code != 304:                       # 304: nothing changed since last time\n        body = r.json()\n        if not body["ok"]:\n            sys.exit(body["error"]["message"])\n' +
      '        etag = r.headers.get("ETag")\n        m = body["data"][0]\n        h, a = m["home"], m["away"]\n' +
      '        left = h["yetToPlay"] + h["playing"] + a["yetToPlay"] + a["playing"]\n        gap = abs(h["points"] - a["points"])\n' +
      '        if m["state"] == "live" and left <= LATE and gap <= CLOSE and m["matchupId"] not in told:\n            told.add(m["matchupId"])\n' +
      '            send("Close game", f\'{h["team"]} {h["points"]:.2f} - {a["points"]:.2f} {a["team"]}: \'\n                               f\'{gap:.2f} apart, {left} still to play\')\n' +
      '        if m["state"] == "final":\n            sys.exit(f\'Final: {h["team"]} {h["points"]:.2f} - {a["points"]:.2f} {a["team"]}\')\n' +
      '    time.sleep(int(r.headers.get("X-Suggested-Interval", "60")))\n';
  }

  /* ---- pictures ---- */
  function closeText() {
    var m = myMatch(g.S.guideTeam) || D.scoreboard[0];
    if (!m) return 'Close game: 4.20 apart, 1 still to play';
    var gap = Math.min(Math.abs(m.home.points - m.away.points), 9.5);
    return m.home.team + ' ' + m.home.points.toFixed(2) + ' - ' + (m.home.points + (m.home.points >= m.away.points ? -gap : gap)).toFixed(2) + ' ' + m.away.team + ': ' + gap.toFixed(2) + ' apart, 1 still to play';
  }
  function injuryText(c) {
    var r = rosterOf(c.T).filter(function (x) { return x.injuryStatus; })[0] || rosterOf(c.T)[0];
    return r ? r.player + ' (' + r.position + ', ' + r.nflTeam + '): ' + (r.injuryStatus === 'questionable' ? 'healthy → questionable' : 'questionable → ' + (r.injuryStatus || 'healthy')) : 'A player: healthy → questionable';
  }
  function dropText() {
    var row = D._activity.filter(function (r) { return r.dropped && r.dropped.length; })[0];
    if (!row) return 'A team dropped a player rostered in 62% of ESPN leagues';
    var p = row.dropped[0];
    return row.teams[0].team + ' dropped ' + p.player + ' (' + p.position + ', ' + p.nflTeam + '), rostered in 62% of ESPN leagues';
  }
  function decidedText() {
    var s = standingsNow()[0];
    return s ? s.team + ' (' + s.wins + '-' + s.losses + ') has clinched a playoff place.' : 'A team has clinched a playoff place.';
  }
  function awardsLines() {
    var w = lastFinalWeek();
    var games = D.schedule.filter(function (m) { return m.week === w && !m.postseasonRound; });
    if (!games.length) return ['🏆 Top score: …'];
    var sides = [];
    games.forEach(function (m) { sides.push([m.home, m.away, m.home.points - m.away.points]); sides.push([m.away, m.home, m.away.points - m.home.points]); });
    var top = sides.slice().sort(function (a, b) { return b[0].points - a[0].points; })[0];
    var low = sides.slice().sort(function (a, b) { return a[0].points - b[0].points; })[0];
    var blow = sides.slice().sort(function (a, b) { return b[2] - a[2]; })[0];
    var wins = sides.filter(function (s) { return s[2] > 0; }).sort(function (a, b) { return a[2] - b[2]; });
    var out = ['Week ' + w + ' awards', '🏆 Top score: ' + top[0].team + ', ' + top[0].points.toFixed(2), '🪫 Lowest score: ' + low[0].team + ', ' + low[0].points.toFixed(2),
      '💥 Blowout: ' + blow[0].team + ' beat ' + blow[1].team + ' by ' + blow[2].toFixed(2)];
    if (wins[0]) out.push('😬 Nail-biter: ' + wins[0][0].team + ' beat ' + wins[0][1].team + ' by ' + wins[0][2].toFixed(2));
    return out;
  }
  var phoneAlert = function (app, title, text) { return LOOK.phone(notif(app, title, text)); };

  /* ---- one job, any channel ---- */
  var ALERT = {
    close: { title: 'A close-game alert', have: 'A message when your matchup is within 10 points with two or fewer starters left to play.',
      runs: 'At the site’s pace, during games', file: 'close_game.py',
      code: function (c, via) { return pyClose(c, via, 'close-game-' + via); },
      steps: function (via) { return PREP[via].setup.concat(['Save the script below as <code>close_game.py</code> (Python 3.9+, <code>pip install requests</code>). Your team (<code>team=%T%</code>) and the league’s key are filled in. Change <code>CLOSE</code> and <code>LATE</code> to taste.',
        'Start it before the games: <code>python close_game.py</code>. It asks exactly as often as the site says, tells you once per matchup, and stops by itself when your matchup is final.']); },
      text: closeText, head: 'Close game', stop: STOPFILE() },
    injury: { title: 'An alert when a player’s injury status changes', have: 'A message the moment ESPN changes the injury status of anyone on your roster: questionable, doubtful, out, back to healthy.',
      runs: 'Every 20 minutes', file: 'injury_watch.py',
      code: function (c, via) { return pyScheduled({ c: c, via: via, file: 'injury_watch.py', desc: 'a message when a player on my roster changes injury status.', when: 'Run it every 20 minutes', state: 'injuries',
        urls: 'URL = "' + U('rosters', { team: c.T, name: 'injury-watch-' + via }) + '"\n', body: injuryBody() }); },
      steps: function (via) { return PREP[via].setup.concat(['Save the script below as <code>injury_watch.py</code> (<code>pip install requests</code>). Your team (<code>team=%T%</code>) is filled in.',
        'Run it once by hand: the first run only remembers your roster’s statuses.',
        'Schedule it every 20 minutes: <code>*/20 * * * * python3 /path/to/injury_watch.py</code> (cron), or Task Scheduler on Windows.']); },
      text: injuryText, head: 'Injury update', stop: STOPFILE() + ' A run refused with <code>pace_changed</code> skips; the next is 20 minutes away.' },
    drop: { title: 'A notable drop alert', have: 'A message when any team drops a player rostered in at least half of ESPN leagues: the waiver wire’s best news.',
      runs: 'Every 20 minutes', file: 'notable_drops.py',
      code: function (c, via) { return pyScheduled({ c: c, via: via, file: 'notable_drops.py', desc: 'a message when a team drops a player worth picking up.', when: 'Run it every 20 minutes', state: 'drops',
        urls: 'ACTIVITY = "' + U('activity', { name: 'notable-drops-' + via }) + '"\nFULL = "' + U('full', { name: 'notable-drops-' + via }) + '"\n', body: dropBody() }); },
      steps: function (via) { return PREP[via].setup.concat(['Save the script below as <code>notable_drops.py</code> (<code>pip install requests</code>). <code>LINE</code> is the share of ESPN leagues a player must be rostered in to count; 0.5 is half.',
        'Run it once by hand: the first run only remembers what has happened.',
        'Schedule it every 20 minutes (cron or Task Scheduler). It asks for the whole league only when a new drop needs looking up.']); },
      text: dropText, head: 'Notable drop', stop: STOPFILE() + ' A run refused with <code>pace_changed</code> skips; the next is 20 minutes away.' },
    decided: { title: 'A post when a team clinches or is eliminated', have: 'A message the moment a team clinches a playoff place or is knocked out, from ESPN’s figures and Fortune Teller’s exact simulation.',
      runs: 'Every hour', file: 'playoff_race.py',
      code: function (c, via) { return pyScheduled({ c: c, via: via, file: 'playoff_race.py', desc: 'a message when a team clinches a playoff place or is eliminated.', when: 'Run it every hour', state: 'decided',
        urls: 'URL = "' + U('standings', { name: 'playoff-race-' + via }) + '"\n', body: decidedBody() }); },
      steps: function (via) { return PREP[via].setup.concat(['Save the script below as <code>playoff_race.py</code> (<code>pip install requests</code>).',
        'Run it once by hand: the first run only remembers where every team stands.',
        'Schedule it every hour: <code>0 * * * * python3 /path/to/playoff_race.py</code> (cron), or Task Scheduler on Windows.']); },
      text: decidedText, head: 'Clinched', stop: STOPFILE() + ' A run refused with <code>pace_changed</code> skips; the next is an hour away.' },
    awards: { title: 'Weekly awards', have: 'Once a week settles: the top and lowest scores, the blowout, the nail-biter, and the luckiest win and unluckiest loss against the week’s median.',
      runs: 'Tuesday mornings', file: 'weekly_awards.py',
      code: function (c, via) { return pyScheduled({ c: c, via: via, file: 'weekly_awards.py', desc: 'the week\'s awards, once each week has settled.', when: 'Run it on Tuesday mornings', state: 'awards',
        urls: 'URL = "' + U('full', { name: 'weekly-awards-' + via }) + '"\n', body: awardsBody() }); },
      steps: function (via) { return PREP[via].setup.concat(['Save the script below as <code>weekly_awards.py</code> (<code>pip install requests</code>).',
        'Schedule it for Tuesday mornings: <code>0 10 * * 2 python3 /path/to/weekly_awards.py</code> (cron), or Task Scheduler on Windows. It posts each settled week once, and does nothing when there is nothing new.']); },
      text: function () { return awardsLines().slice(1).join('\n'); }, head: function () { return awardsLines()[0]; },
      stop: STOPFILE() + ' A run refused with <code>pace_changed</code> skips; next Tuesday’s run, or one by hand, tries again.' },
  };
  function alertJob(kind, via) {
    var A = ALERT[kind];
    return { key: kind, title: A.title + (via === 'email' ? ' by email' : ''), have: A.have,
      steps: A.steps(via), file: A.file, lang: 'py',
      code: function (c) { return A.code(c, via); },
      look: function (c) {
        var head = typeof A.head === 'function' ? A.head() : A.head, text = A.text(c);
        if (via === 'chat') return LOOK.chat('League Bot', ['<b>' + esc(head) + '</b><br>' + esc(text).split('\n').join('<br>')]);
        if (via === 'email') return '<div class="looks"><div class="mail"><div class="mh"><b>' + esc(head) + '</b><br>to me · now</div><p>' + esc(text).split('\n').join('<br>') + '</p></div></div>';
        return phoneAlert({ ntfy: 'ntfy', telegram: 'Telegram', groupme: 'GroupMe' }[via], head, text);
      },
      stop: A.stop, _runs: A.runs, _via: via, _kind: kind };
  }
  function jobsFor(via, kinds) { return kinds.map(function (k) { return alertJob(k, via); }); }
  function runsFor(pkey, jobs) { jobs.forEach(function (j) { RUNS[pkey + '.' + j.key] = j._runs; }); }

  /* ======================================================================== new platforms */

  var ntfyJobs = jobsFor('ntfy', ['close', 'injury', 'drop', 'decided']);
  PLATFORMS.push({ key: 'ntfy', name: 'ntfy (phone alerts)', glyph: GL.ntfy, schedule: true,
    stops: 'Writes a SITE_API_STOPPED file and exits; every run checks for it first', jobs: ntfyJobs });
  var tgJobs = jobsFor('telegram', ['close', 'injury', 'drop', 'decided', 'awards']);
  PLATFORMS.push({ key: 'telegram', name: 'Telegram', glyph: GL.telegram, schedule: true,
    stops: 'Writes a SITE_API_STOPPED file and exits; every run checks for it first', jobs: tgJobs });
  var gmJobs = jobsFor('groupme', ['close', 'injury', 'drop']);
  PLATFORMS.push({ key: 'groupme', name: 'GroupMe', glyph: GL.groupme, schedule: true,
    stops: 'Writes a SITE_API_STOPPED file and exits; every run checks for it first', jobs: gmJobs });
  runsFor('ntfy', ntfyJobs); runsFor('telegram', tgJobs); runsFor('groupme', gmJobs);

  /* ---- desk and TV displays ---- */
  var DISPLAY = [
    { key: 'tv', title: 'The whole league live on a TV or in OBS', have: 'One page with every matchup’s score, refreshing at the site’s pace: full-screen on a TV for a watch party, or a browser source in OBS.',
      steps: ['Save the page below as <code>league-ticker.html</code> on the computer that drives the TV (or the one running OBS). The league’s key is filled in.',
        'Open it in a browser and press F11 for full screen. In OBS: <b>Sources → + → Browser</b>, tick <b>Local file</b> and choose it; 1280 × 720 suits it.',
        'It asks exactly as often as the site says. Keep the file to yourself: it holds the key.'],
      file: 'league-ticker.html', lang: 'html',
      code: function (c) {
        return '<!doctype html>\n<!-- league-ticker.html: every matchup live, at the site\'s pace. -->\n<meta charset="utf-8">\n<title>League ticker</title>\n' +
          '<style>\n  body { margin: 0; background: #070a08; color: #e6f2e4; font: 700 28px/1.3 system-ui, sans-serif; }\n  main { padding: 3vh 4vw; }\n' +
          '  .m { display: grid; grid-template-columns: 1fr auto auto auto 1fr; gap: 1.2vw; align-items: center; padding: 1.4vh 0; border-bottom: 2px solid #1f2a21; }\n' +
          '  .m b { font-size: 1.4em; font-variant-numeric: tabular-nums; } .m .a { text-align: right; } .live b { color: #63ff4a; }\n  .s { color: #96a599; font-size: .6em; text-transform: uppercase; letter-spacing: .1em; }\n  #note { color: #ffb020; }\n</style>\n' +
          '<main><div id="week" class="s"></div><div id="board"></div><p id="note"></p></main>\n<script>\n' +
          "const URL = '" + U('scoreboard', { name: 'league-ticker' }) + "';\nconst KEY = { Authorization: 'Bearer " + c.K + "' };\n" +
          "const esc = (s) => String(s).replace(/[&<>]/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[x]));\n" +
          "async function tick() {\n  let wait = 60;\n  try {\n    const res = await fetch(URL, { headers: KEY });\n    const body = await res.json();\n" +
          "    if (res.status === 429) {\n      document.getElementById('note').textContent = body.error.message;\n" +
          "      if (body.error.stop === 'exit') return;                     // too_fast: stop for good\n" +
          "      wait = Number(res.headers.get('Retry-After')) || 60;          // pace_changed: wait, then carry on\n    } else if (body.ok) {\n" +
          "      document.getElementById('note').textContent = '';\n      document.getElementById('week').textContent = `Week ${body.meta.week}`;\n" +
          "      document.getElementById('board').innerHTML = body.data.map(({ state, home, away }) =>\n" +
          "        `<div class=\"m ${state}\"><span class=\"a\">${esc(home.team)}</span><b>${home.points.toFixed(2)}</b><span class=\"s\">${state}</span>` +\n" +
          "        `<b>${away.points.toFixed(2)}</b><span>${esc(away.team)}</span></div>`).join('');\n" +
          "      wait = Number(res.headers.get('X-Suggested-Interval')) || 60;\n    }\n  } catch (e) { /* offline for a moment: try again after a minute */ }\n" +
          "  setTimeout(tick, wait * 1000);\n}\ntick();\n</script>\n";
      },
      look: function () {
        var lines = [['dim', 'Week ' + WEEK]];
        D.scoreboard.forEach(function (m) {
          lines.push(m.home.points.toFixed(2) + '  ' + m.home.team, m.away.points.toFixed(2) + '  ' + m.away.team, ['dim', '  ' + m.state.toUpperCase()]);
        });
        return LOOK.term(lines, 'Every matchup, large enough to read across a room. It updates in place at the site’s pace.');
      },
      stop: 'On <code>too_fast</code> the page shows the site’s message and asks nothing more until it is reloaded. On <code>pace_changed</code> it shows the message and waits for <code>Retry-After</code>.', _runs: 'At the site’s pace' },
    { key: 'menubar', title: 'My score in the macOS menu bar', have: 'Your matchup’s score beside the clock, with the full scoreboard in its menu.',
      steps: ['Install <b>SwiftBar</b> (free, swiftbar.app) and choose a plugin folder.',
        'Save the script below in that folder as <code>fantasy.1m.py</code> and make it runnable: <code>chmod +x fantasy.1m.py</code>. SwiftBar runs it every minute (the <code>1m</code> in its name).',
        'It asks the site only when the site’s pace allows, and shows the last answer in between, so a minute’s refresh never asks too often.'],
      file: 'fantasy.1m.py', lang: 'py',
      code: function (c) {
        return '#!/usr/bin/env python3\n# fantasy.1m.py: my score in the macOS menu bar (SwiftBar runs it every minute).\n' +
          'import json, pathlib, sys, time, urllib.request, urllib.error\n\n' +
          'URL = "' + U('scoreboard', { name: 'menu-bar' }) + '"\nKEY = "Bearer ' + c.K + '"\nTEAM = ' + c.T + '\n' +
          'HERE = pathlib.Path(__file__).with_suffix("")\nSTOP, CACHE = pathlib.Path(str(HERE) + ".stopped"), pathlib.Path(str(HERE) + ".json")\n\n' +
          'if STOP.exists():\n    print("⚠︎ Site API stopped")\n    print("---")\n    print(STOP.read_text())\n    sys.exit(0)\n' +
          'cache = json.loads(CACHE.read_text()) if CACHE.exists() else {"next": 0, "data": None, "note": ""}\n' +
          'if time.time() >= cache["next"]:            # ask only when the site\'s pace allows\n    req = urllib.request.Request(URL, headers={"Authorization": KEY})\n    try:\n' +
          '        with urllib.request.urlopen(req, timeout=20) as r:\n            pace = int(r.headers.get("X-Suggested-Interval", "60"))\n            cache.update(data=json.load(r)["data"], note="", next=time.time() + pace - min(5, pace / 10))\n' +
          '    except urllib.error.HTTPError as e:\n        if e.code != 429:\n            raise\n        err = json.load(e)["error"]\n' +
          '        if err["stop"] == "exit":                 # too_fast: stop for good\n            STOP.write_text(err["message"])\n' +
          '        cache.update(note=err["message"], next=time.time() + int(e.headers.get("Retry-After", "60")))\n    CACHE.write_text(json.dumps(cache))\n' +
          'games = cache["data"] or []\nmine = next((m for m in games if TEAM in (m["home"]["teamId"], m["away"]["teamId"])), None)\n' +
          'if mine:\n    me, them = (mine["home"], mine["away"]) if mine["home"]["teamId"] == TEAM else (mine["away"], mine["home"])\n' +
          '    print(f"🏈 {me[\'points\']:.2f}–{them[\'points\']:.2f}")\nelse:\n    print("🏈 –")\nprint("---")\n' +
          'for m in games:\n    print(f"{m[\'home\'][\'team\']} {m[\'home\'][\'points\']:.2f} – {m[\'away\'][\'points\']:.2f} {m[\'away\'][\'team\']} | font=Menlo")\n' +
          'if cache["note"]:\n    print(cache["note"])\n';
      },
      look: function (c) {
        var m = myMatch(c.T), me = m ? (m.home.teamId === c.T ? m.home : m.away) : null, them = m ? (m.home.teamId === c.T ? m.away : m.home) : null;
        return LOOK.term([['pr', '🏈 ' + (me ? me.points.toFixed(2) + '–' + them.points.toFixed(2) : '–') + '        Sat 9:41 AM']].concat(D.scoreboard.slice(0, 5).map(function (x) {
          return x.home.team + ' ' + x.home.points.toFixed(2) + ' – ' + x.away.points.toFixed(2) + ' ' + x.away.team;
        })), 'The menu bar item and, below it, the menu it opens.');
      },
      stop: 'On <code>too_fast</code> it writes <code>fantasy.1m.stopped</code> beside itself, shows “Site API stopped” and asks nothing more until you delete that file. On <code>pace_changed</code> it shows the last score and the site’s message, and asks again only after <code>Retry-After</code>.', _runs: 'Every minute, asking at the site’s pace' },
    { key: 'pi', title: 'A desk scoreboard on a Raspberry Pi', have: 'Your matchup on a 64 × 32 LED panel on your desk, at the site’s pace. Without the panel it draws <code>scoreboard.png</code> instead, so you can try it on any computer first.',
      steps: ['On a Raspberry Pi with an Adafruit RGB Matrix Bonnet and a 64 × 32 panel, install hzeller’s <code>rpi-rgb-led-matrix</code> Python bindings (Adafruit’s guide walks through it), then <code>pip install requests pillow</code>.',
        'Save the script below as <code>scoreboard.py</code>. Your team (<code>team=%T%</code>) and the league’s key are filled in.',
        'Run it with <code>sudo python3 scoreboard.py</code> (the panel needs it). To start it with the Pi, add it to <code>/etc/rc.local</code> or a systemd service.'],
      file: 'scoreboard.py', lang: 'py',
      code: function (c) {
        return '# scoreboard.py: my matchup on a 64x32 LED panel, at the site\'s pace.\n# Without the panel library it saves scoreboard.png instead, to try it anywhere.\n' +
          'import pathlib, sys, time, requests\nfrom PIL import Image, ImageDraw, ImageFont\n\n' +
          'URL = "' + U('scoreboard', { team: c.T, name: 'desk-scoreboard' }) + '"\nKEY = {"Authorization": "Bearer ' + c.K + '"}\nTEAM = ' + c.T + '\n' +
          'HERE = pathlib.Path(__file__).parent\nSTOP = HERE / "SITE_API_STOPPED"\n' +
          'try:\n    from rgbmatrix import RGBMatrix, RGBMatrixOptions\n    opts = RGBMatrixOptions()\n    opts.rows, opts.cols, opts.hardware_mapping = 32, 64, "adafruit-hat"\n    panel = RGBMatrix(options=opts)\n' +
          'except ImportError:\n    panel = None\nfont = ImageFont.load_default()\n\n' +
          'def show(lines, colour=(99, 255, 74)):\n    img = Image.new("RGB", (64, 32))\n    d = ImageDraw.Draw(img)\n    for i, text in enumerate(lines[:3]):\n        d.text((1, 1 + i * 10), text[:12], font=font, fill=colour)\n' +
          '    if panel:\n        panel.SetImage(img)\n    else:\n        img.resize((640, 320), Image.NEAREST).save(HERE / "scoreboard.png")\n\n' +
          'if STOP.exists():\n    show(["STOPPED", "see the", "STOP file"], (255, 92, 92))\n    sys.exit(f"Stopped earlier: {STOP.read_text()}")\n' +
          'while True:\n    r = requests.get(URL, headers=KEY, timeout=30)\n    if r.status_code == 429:\n        err = r.json()["error"]\n' +
          '        if err["stop"] == "exit":                  # too_fast: stop for good\n            STOP.write_text(err["message"])\n            show(["STOPPED", "see the", "STOP file"], (255, 92, 92))\n            sys.exit(err["message"])\n' +
          '        time.sleep(int(r.headers["Retry-After"]))  # pace_changed: the site slowed down\n        continue\n' +
          '    r.raise_for_status()\n    m = r.json()["data"][0]\n    me, them = (m["home"], m["away"]) if m["home"]["teamId"] == TEAM else (m["away"], m["home"])\n' +
          '    show([f"{me[\'points\']:.2f}", f"{them[\'points\']:.2f}", f"{m[\'state\'].upper()} {me[\'yetToPlay\'] + me[\'playing\']} LEFT"],\n         (99, 255, 74) if me["points"] >= them["points"] else (255, 176, 32))\n' +
          '    if m["state"] == "final" and "--once" not in sys.argv:\n        time.sleep(3600)                           # the week is over: look again in an hour\n' +
          '    if "--once" in sys.argv:\n        break\n    time.sleep(int(r.headers.get("X-Suggested-Interval", "60")))\n';
      },
      look: function (c) {
        var m = myMatch(c.T), me = m ? (m.home.teamId === c.T ? m.home : m.away) : { points: 0 }, them = m ? (m.home.teamId === c.T ? m.away : m.home) : { points: 0 };
        return LOOK.term([['ok', me.points.toFixed(2)], them.points.toFixed(2), ['dim', (m ? m.state.toUpperCase() : 'PRE') + ' ' + (me.yetToPlay + (me.playing || 0) || 0) + ' LEFT']],
          'Three lines on the panel: your points, theirs, and the state with your starters left. Green while you lead, amber while you trail.');
      },
      stop: 'On <code>too_fast</code> it shows STOPPED on the panel, writes <code>SITE_API_STOPPED</code> and exits; it stays stopped until you delete that file. On <code>pace_changed</code> it waits for <code>Retry-After</code>. Tested against a mock of the API; not tried on a real panel.', _runs: 'At the site’s pace' },
    { key: 'esp32', title: 'A pocket scoreboard on an ESP32', have: 'Your score on a small OLED screen run by an ESP32 with MicroPython, at the site’s pace.',
      steps: ['Flash MicroPython onto an ESP32 and wire a 128 × 64 SSD1306 OLED to it over I2C (SDA to GPIO 21, SCL to GPIO 22). Copy MicroPython’s <code>ssd1306.py</code> driver onto the board.',
        'Save the program below as <code>main.py</code> on the board (Thonny does this), with your Wi-Fi name and password filled in. Your team and the league’s key are already in it.',
        'Restart the board. It joins the Wi-Fi, then shows your score and asks again exactly when the site says.'],
      file: 'main.py (MicroPython)', lang: 'py',
      code: function (c) {
        return '# main.py: my score on an SSD1306 OLED, on an ESP32 running MicroPython, at the site\'s pace.\n' +
          'import time, network, urequests, ujson\nfrom machine import Pin, I2C\nimport ssd1306\n\n' +
          'WIFI, PASSWORD = "your-wifi", "your-password"\nURL = "' + U('scoreboard', { team: c.T, name: 'esp32-scoreboard' }) + '"\nKEY = {"Authorization": "Bearer ' + c.K + '"}\nTEAM = ' + c.T + '\n\n' +
          'oled = ssd1306.SSD1306_I2C(128, 64, I2C(0, scl=Pin(22), sda=Pin(21)))\n' +
          'def show(*lines):\n    oled.fill(0)\n    for i, text in enumerate(lines):\n        oled.text(text[:16], 0, i * 16)\n    oled.show()\n\n' +
          'wlan = network.WLAN(network.STA_IF)\nwlan.active(True)\nwlan.connect(WIFI, PASSWORD)\nwhile not wlan.isconnected():\n    time.sleep(1)\n\n' +
          'while True:\n    r = urequests.get(URL, headers=KEY)\n    body = ujson.loads(r.text)\n    wait = 60\n' +
          '    if r.status_code == 429:\n        if body["error"]["stop"] == "exit":       # too_fast: stop for good\n            show("Site API", "stopped:", "fix the program")\n            r.close()\n            break\n' +
          '        wait = body["error"]["retryAfterSeconds"]   # pace_changed: wait, then carry on\n    elif body["ok"]:\n        m = body["data"][0]\n' +
          '        me, them = (m["home"], m["away"]) if m["home"]["teamId"] == TEAM else (m["away"], m["home"])\n' +
          '        show("Me   %.2f" % me["points"], "Them %.2f" % them["points"], m["state"].upper())\n        wait = body["meta"]["pace"]["askEverySeconds"]\n' +
          '    r.close()\n    time.sleep(wait)\n';
      },
      look: function (c) {
        var m = myMatch(c.T), me = m ? (m.home.teamId === c.T ? m.home : m.away) : { points: 0 }, them = m ? (m.home.teamId === c.T ? m.away : m.home) : { points: 0 };
        return LOOK.term([['ok', 'Me   ' + me.points.toFixed(2)], 'Them ' + them.points.toFixed(2), ['dim', m ? m.state.toUpperCase() : 'PRE']], 'Three lines on a 128 × 64 OLED.');
      },
      stop: 'On <code>too_fast</code> it shows that the Site API stopped it and stops asking until the board is restarted with a fixed program. On <code>pace_changed</code> it waits the seconds the site gives. Checked as Python and against a mock of the API; not tried on a real board.', _runs: 'At the site’s pace' },
  ];
  PLATFORMS.push({ key: 'display', name: 'Desk and TV displays', glyph: GL.display,
    stops: 'Each stops asking on too_fast and says so on its own screen', jobs: DISPLAY });
  runsFor('display', DISPLAY);

  /* ---- dashboards and SQL ---- */
  var DATA = [
    { key: 'duckdb', title: 'Ask the league anything in SQL (DuckDB)', have: 'The standings, this week’s scoreboard, every roster, all league activity and this season’s records as tables in one DuckDB file, ready for any question in SQL.',
      steps: ['Install Python 3.9+ and two packages: <code>pip install requests duckdb</code>.',
        'Save the script below as <code>league_sql.py</code> and run it: <code>python league_sql.py</code>. It asks for the five CSV answers in one round (the fifth is Season Statistics’ records) and writes <code>league.duckdb</code> beside itself.',
        'Ask your own questions: <code>duckdb league.duckdb</code> (the DuckDB command line), or any tool that opens DuckDB files. Run the script again whenever you want fresh tables.'],
      file: 'league_sql.py', lang: 'py',
      code: function (c) {
        return '# league_sql.py: the league as tables in league.duckdb, for questions in SQL.\nimport pathlib, sys, time, requests, duckdb\n\n' +
          'BASE = "' + U('', {}).replace(/\/$/, '') + '"\nKEY = {"Authorization": "Bearer ' + c.K + '"}\nHERE = pathlib.Path(__file__).parent\nSTOP = HERE / "SITE_API_STOPPED"\n' +
          'if STOP.exists():\n    sys.exit(f"Stopped earlier: {STOP.read_text()}")\n\n' +
          'db = duckdb.connect(str(HERE / "league.duckdb"))\nASK = {"standings": "standings.csv", "scoreboard": "scoreboard.csv", "rosters": "rosters.csv",\n       "activity": "activity.csv", "records": "season.csv?table=records&"}   # five answers: one round\n' +
          'for table, path in ASK.items():\n    sep = "" if path.endswith("&") else "?"\n' +
          '    r = requests.get(f"{BASE}/{path}{sep}name=league-sql", headers=KEY, timeout=60)\n    if r.status_code == 429:\n        err = r.json()["error"]\n' +
          '        if err["stop"] == "exit":\n            STOP.write_text(err["message"])\n        sys.exit(err["message"])      # pace_changed: the message says when to try again\n' +
          '    r.raise_for_status()\n    path = HERE / f"{table}.csv"\n    path.write_bytes(r.content)\n' +
          '    db.execute(f"CREATE OR REPLACE TABLE {table} AS SELECT * FROM read_csv_auto(\'{path.as_posix()}\', header=true)")\n\n' +
          'print(db.sql("SELECT team, wins, losses, pointsFor, luck, power FROM standings ORDER BY seed"))\n' +
          'print(db.sql("SELECT record, holder, value FROM records WHERE id LIKE \'S21.%\' OR id = \'S59\'"))\n' +
          'print(db.sql("""SELECT team, position, ROUND(SUM(seasonPoints), 2) AS points FROM rosters\n                 WHERE slot NOT IN (\'BE\', \'IR\') GROUP BY ALL ORDER BY points DESC LIMIT 5"""))\n' +
          'print("Saved league.duckdb: open it with  duckdb league.duckdb")\n';
      },
      look: function () {
        var s = standingsNow().slice(0, 4);
        var f = function (x, n) { return x == null ? new Array(n + 1).join(' ') : String(x).padStart(n); };
        return LOOK.term([['pr', '$ python league_sql.py'], '┌────────────────────────┬──────┬────────┬───────────┬───────┬───────┐', '│ team                   │ wins │ losses │ pointsFor │  luck │ power │']
          .concat(s.map(function (t) { var n = String(t.team).slice(0, 22); return '│ ' + n + new Array(23 - n.length + 1).join(' ') + '│ ' + String(t.wins).padStart(4) + ' │ ' + String(t.losses).padStart(6) + ' │ ' + Number(t.pointsFor).toFixed(2).padStart(9) + ' │ ' + f(t.luck == null ? null : Number(t.luck).toFixed(2), 5) + ' │ ' + f(t.power == null ? null : Number(t.power).toFixed(1), 5) + ' │'; }))
          .concat(['└────────────────────────┴──────┴────────┴───────────┴───────┴───────┘', 'Saved league.duckdb: open it with  duckdb league.duckdb']));
      },
      stop: STOPFILE(), _runs: 'When you run it' },
    { key: 'grafana', title: 'A season dashboard in Grafana', have: 'A Grafana dashboard of the season: the standings with both playoff odds, all-play, luck and power, points by week, and every team’s odds after each week.',
      steps: ['In Grafana (Cloud’s free tier, or your own), install the <b>Infinity</b> data source: <b>Connections → Add new connection → Infinity</b>.',
        'In the data source’s <b>Authentication</b>, choose <b>Bearer token</b> and paste the league’s key. Under <b>Allowed hosts</b>, add the site’s address. Save it as <code>Site API</code>.',
        '<b>Dashboards → New → Import</b>, paste the JSON below and pick the <code>Site API</code> data source.',
        'It refreshes every 15 minutes, which Grafana can’t read from the site’s pace, so it is given room for the busiest day.'],
      file: 'season-dashboard.json', lang: 'js',
      code: function () {
        var q = function (ref, path, root, cols) {
          return { refId: ref, datasource: { type: 'yesoreyeram-infinity-datasource', uid: '${DS}' }, type: 'json', source: 'url', format: 'table',
            url: U(path, { name: 'grafana-season' }), url_options: { method: 'GET' }, root_selector: root, columns: cols };
        };
        var col = function (sel, text, type) { return { selector: sel, text: text, type: type || 'string' }; };
        var dash = { title: LEAGUE + ': season', refresh: '15m', time: { from: 'now-120d', to: 'now' }, schemaVersion: 39,
          templating: { list: [{ name: 'DS', type: 'datasource', query: 'yesoreyeram-infinity-datasource' }] },
          panels: [
            { type: 'table', title: 'Standings', gridPos: { x: 0, y: 0, w: 12, h: 10 },
              targets: [q('A', 'standings', 'data', [col('seed', 'Seed', 'number'), col('team', 'Team'), col('wins', 'W', 'number'), col('losses', 'L', 'number'),
                col('pointsFor', 'PF', 'number'), col('playoffOdds', 'Playoff %', 'number'), col('simPlayoffOdds', 'Sim %', 'number'),
                col('allPlay.wins', 'All-play W', 'number'), col('allPlay.losses', 'All-play L', 'number'), col('luck', 'Luck', 'number'), col('power', 'Power', 'number')])],
              fieldConfig: { defaults: { decimals: 2 }, overrides: [{ matcher: { id: 'byRegexp', options: '.*%' }, properties: [{ id: 'unit', value: 'percentunit' }, { id: 'decimals', value: 1 }] }] } },
            { type: 'barchart', title: 'Points by week', gridPos: { x: 12, y: 0, w: 12, h: 10 },
              targets: [q('A', 'full', 'data.schedule', [col('week', 'Week', 'string'), col('home.team', 'Home'), col('home.points', 'Home points', 'number'), col('away.team', 'Away'), col('away.points', 'Away points', 'number')])] },
            { type: 'table', title: 'Playoff odds after each week', gridPos: { x: 0, y: 10, w: 24, h: 12 },
              targets: [q('A', 'full', 'data.fortuneOdds', [col('week', 'Week', 'number'), col('team', 'Team'), col('espnPlayoffOdds', 'ESPN', 'number'), col('simPlayoffOdds', 'Simulated', 'number')])],
              fieldConfig: { defaults: { unit: 'percentunit', decimals: 1 } } },
          ] };
        return JSON.stringify(dash, null, 2) + '\n';
      },
      look: function () {
        var s = standingsNow().slice(0, 5);
        return LOOK.sheet('Standings · Grafana', [['Seed', 'Team', 'W', 'L', 'PF', 'Playoff %']].concat(s.map(function (t) {
          return [t.seed, t.team, t.wins, t.losses, Number(t.pointsFor).toFixed(2), t.playoffOdds == null ? '' : (Math.round(t.playoffOdds * 1000 + 1e-6) / 10).toFixed(1) + '%'];
        })), 'One of the three panels. Points by week and the odds after each week sit beside it.');
      },
      stop: 'Grafana can’t read the site’s pace or stop itself, so the dashboard refreshes every 15 minutes, never too fast even on the busiest day. A refusal shows the site’s message in the panel until the next refresh. To stop it, set the refresh to Off.', _runs: 'Every 15 minutes' },
  ];
  PLATFORMS.push({ key: 'data', name: 'Dashboards and SQL', glyph: GL.data, schedule: true,
    stops: 'Scripts use the stop file; a dashboard refreshes no more than every 15 minutes', jobs: DATA });
  runsFor('data', DATA);

  Object.assign(PLAT_KIND, { ntfy: 'Phone alerts', telegram: 'Chat bot', groupme: 'Chat bot', display: 'Display', data: 'Analysis' });

  /* ======================================================================== jobs on the existing platforms */

  /* Discord or Slack: the drop alert, the trade breakdown, the race, the awards. */
  var chatNew = jobsFor('chat', ['drop', 'decided', 'awards']);
  chatNew.splice(1, 0, { key: 'trade', title: 'Post a breakdown of each trade offer', have: 'When an offer appears, a post with what each side sends, Trade Analyzer’s verdict at the league’s weighting, and the rows that decide it. Only what every member already sees in Trade Analyzer.',
    steps: PREP.chat.setup.concat(['Save the script below as <code>trade_breakdown.py</code> (<code>pip install requests</code>).',
      'Run it once by hand: the first run only remembers the offers already on the table.',
      'Schedule it every 20 minutes: <code>*/20 * * * * python3 /path/to/trade_breakdown.py</code> (cron), or Task Scheduler on Windows.']),
    file: 'trade_breakdown.py', lang: 'py',
    code: function (c) {
      return pyScheduled({ c: c, via: 'chat', file: 'trade_breakdown.py', desc: 'a post breaking down each new trade offer.', when: 'Run it every 20 minutes', state: 'offers',
        urls: 'URL = "' + U('full', { name: 'trade-breakdown' }) + '"\n',
        body: 'offers = ask(URL)["tradeAnalysis"]\nseen = set(json.loads(STATE.read_text())) if STATE.exists() else None\n' +
          'for o in offers:\n    if seen is None or o["offerId"] in seen:     # the first run only remembers\n        continue\n' +
          '    a, b = o["teamA"], o["teamB"]\n    rows = sorted(o["rows"], key=lambda r: abs(r["pointsA"] - r["pointsB"]), reverse=True)[:5]\n' +
          '    lines = [f"{a[\'team\']} sends {\', \'.join(a[\'sends\'])}", f"{b[\'team\']} sends {\', \'.join(b[\'sends\'])}",\n' +
          '             f"Verdict: {o[\'verdict\']}" + (f", favouring {o[\'favors\']}" if o["favors"] else "") + f" (balance {o[\'balance\']:+.2f})"]\n' +
          '    lines += [f"· {r[\'name\']}: {r[\'pointsA\']:.2f} v {r[\'pointsB\']:.2f}" for r in rows]\n' +
          '    send("🤝 Trade offer", "\\n".join(lines))\nSTATE.write_text(json.dumps([o["offerId"] for o in offers]))\n' });
    },
    look: function () {
      return LOOK.chat('League Bot', ['<b>🤝 Trade offer</b><br>Blitz Brigade sends a running back<br>The other side sends a receiver<br>Verdict: even (balance +1.20)<br>· Rest-of-season projection: 84.10 v 81.30']);
    },
    stop: STOPFILE() + ' A run refused with <code>pace_changed</code> skips; the next is 20 minutes away.', _runs: 'Every 20 minutes' });
  addJobs('chat', chatNew);
  runsFor('chat', chatNew);

  /* Python: the bye-week planner, the odds tracker, and two alerts by email. */
  var pyNew = [
    { key: 'bye', title: 'Plan around bye weeks', have: 'Your roster against every remaining week, with each player’s bye marked, and how many starters each week loses: printed, and saved as <code>bye-planner.csv</code>.',
      steps: ['Save the script below as <code>bye_planner.py</code> (<code>pip install requests</code>). Your team (<code>TEAM = %T%</code>) is filled in.',
        'Run it: <code>python bye_planner.py</code>. Open <code>bye-planner.csv</code> in any spreadsheet.'],
      file: 'bye_planner.py', lang: 'py',
      code: function (c) {
        return '# bye_planner.py: my roster against every remaining week, byes marked.\nimport csv, pathlib, sys, requests\n\n' +
          'URL = "' + U('full', { name: 'bye-planner' }) + '"\nKEY = {"Authorization": "Bearer ' + c.K + '"}\nTEAM = ' + c.T + '\n' +
          'HERE = pathlib.Path(__file__).parent\nSTOP = HERE / "SITE_API_STOPPED"\nif STOP.exists():\n    sys.exit(f"Stopped earlier: {STOP.read_text()}")\n\n' +
          'r = requests.get(URL, headers=KEY, timeout=60)\nif r.status_code == 429:\n    err = r.json()["error"]\n    if err["stop"] == "exit":\n        STOP.write_text(err["message"])\n' +
          '    sys.exit(err["message"])      # pace_changed: the message says when to try again\nr.raise_for_status()\nleague = r.json()["data"]\n\n' +
          'week = league["about"]["week"]\nlast = max(m["week"] for m in league["schedule"] if not m["postseasonRound"])\nweeks = list(range(week, last + 1))\n' +
          'mine = [p for p in league["rosters"] if p["teamId"] == TEAM and p["slot"] != "IR"]\n' +
          'rows = [[p["player"], p["position"], p["slot"]] + ["BYE" if p["bye"] == w else "" for w in weeks] for p in mine]\n' +
          'with open(HERE / "bye-planner.csv", "w", newline="") as f:\n    csv.writer(f).writerows([["Player", "Pos", "Slot"] + [f"Wk {w}" for w in weeks]] + rows)\n' +
          'for w in weeks:\n    out = [p["player"] for p in mine if p["bye"] == w and p["slot"] != "BE"]\n    print(f"Week {w:>2}: " + (", ".join(out) + " on bye" if out else "every starter plays"))\n' +
          'print("Saved bye-planner.csv")\n';
      },
      look: function (c) {
        var mine = rosterOf(c.T).filter(function (r) { return r.slot !== 'IR' && r.slot !== 'BE'; }), out = [['pr', '$ python bye_planner.py']];
        for (var w = WEEK; w < WEEK + 5; w++) {
          var on = mine.filter(function (r) { return r.bye === w; }).map(function (r) { return r.player; });
          out.push('Week ' + (w < 10 ? ' ' : '') + w + ': ' + (on.length ? on.join(', ') + ' on bye' : 'every starter plays'));
        }
        return LOOK.term(out.concat(['Saved bye-planner.csv']));
      },
      stop: STOPFILE(), _runs: 'When you run it' },
    { key: 'odds', title: 'Chart the playoff race', have: 'A chart of every team’s playoff odds after each week, ESPN’s as solid lines and Fortune Teller’s exact simulation as dashed ones once it has run.',
      steps: ['Install <code>requests</code> and <code>matplotlib</code>: <code>pip install requests matplotlib</code>.',
        'Save the script below as <code>playoff_odds.py</code> and run it each week: <code>python playoff_odds.py</code>. It writes <code>playoff-odds.png</code>.',
        'The odds by week come from Fortune Teller, so the chart needs that tool visible to the league.'],
      file: 'playoff_odds.py', lang: 'py',
      code: function (c) {
        return '# playoff_odds.py: every team\'s playoff odds after each week, as a chart.\nimport pathlib, sys, requests\nimport matplotlib.pyplot as plt\n\n' +
          'URL = "' + U('full', { name: 'odds-chart' }) + '"\nKEY = {"Authorization": "Bearer ' + c.K + '"}\nTEAM = ' + c.T + '\n' +
          'STOP = pathlib.Path(__file__).with_name("SITE_API_STOPPED")\nif STOP.exists():\n    sys.exit(f"Stopped earlier: {STOP.read_text()}")\n\n' +
          'r = requests.get(URL, headers=KEY, timeout=60)\nif r.status_code == 429:\n    err = r.json()["error"]\n    if err["stop"] == "exit":\n        STOP.write_text(err["message"])\n' +
          '    sys.exit(err["message"])      # pace_changed: the message says when to try again\nr.raise_for_status()\nrows = r.json()["data"].get("fortuneOdds") or []\n' +
          'if not rows:\n    sys.exit("No odds by week yet: Fortune Teller has to be visible to the league.")\n\n' +
          'for team in sorted({x["team"] for x in rows}):\n    mine = [x for x in rows if x["team"] == team]\n    width = 2.6 if mine[0]["teamId"] == TEAM else 1.1\n' +
          '    line, = plt.plot([x["week"] for x in mine], [x["espnPlayoffOdds"] for x in mine], lw=width, label=team)\n' +
          '    sim = [x for x in mine if x["simPlayoffOdds"] is not None]\n    if sim:\n        plt.plot([x["week"] for x in sim], [x["simPlayoffOdds"] for x in sim], "--", lw=width, color=line.get_color())\n' +
          'plt.ylim(0, 1); plt.xlabel("After week"); plt.ylabel("Playoff odds")\nplt.gca().yaxis.set_major_formatter(lambda v, _: f"{v:.0%}")\n' +
          'plt.legend(fontsize=7); plt.tight_layout(); plt.savefig("playoff-odds.png", dpi=160)\nprint("Saved playoff-odds.png")\n';
      },
      look: function () { return LOOK.files([['playoff-odds.png', '120 KB'], ['playoff_odds.py', '2 KB']], 'One line per team after each week: solid for ESPN’s odds, dashed for the simulation once it has run; yours drawn heavier.'); },
      stop: STOPFILE(), _runs: 'Weekly, when you run it' },
  ].concat(jobsFor('email', ['injury', 'awards']).map(function (j) { j.key = j.key + 'mail'; return j; }));
  addJobs('python', pyNew);
  runsFor('python', pyNew);

  /* Home Assistant: the close game and injury changes, on top of the live-score sensor. */
  var haNew = [
    { key: 'close', title: 'A notification when my game is close late', have: 'A phone notification when your matchup is within 10 points with two or fewer starters left to play.',
      steps: ['Set up <b>My live score as a sensor</b> first, and add <code>data</code> to its attributes: <code>json_attributes: [ok, error, meta, data]</code>. It keeps asking at the site’s pace.',
        'Add the configuration below. The template sensor reads your matchup from the score sensor and asks the site nothing itself.',
        'Replace <code>notify.notify</code> with your phone’s notify service if you have several.'],
      file: 'configuration.yaml (add)', lang: 'yaml',
      code: function (c) {
        return '# A notification when my matchup is close late. Reads the live-score sensor; asks the site nothing.\ntemplate:\n  - sensor:\n      - name: My fantasy margin\n        unique_id: site_api_my_margin\n' +
          "        state: >-\n          {% set d = state_attr('sensor.my_fantasy_score', 'data') %}\n          {% if d %}{% set m = d[0] %}{{ (m.home.points - m.away.points) | abs | round(2) }}{% else %}unknown{% endif %}\n" +
          "        attributes:\n          left: >-\n            {% set d = state_attr('sensor.my_fantasy_score', 'data') %}\n" +
          "            {% if d %}{% set m = d[0] %}{{ m.home.yetToPlay + m.home.playing + m.away.yetToPlay + m.away.playing }}{% else %}99{% endif %}\n" +
          "          live: \"{{ (state_attr('sensor.my_fantasy_score', 'data') or [{}])[0].get('state') == 'live' }}\"\n\n" +
          'automation:\n  - alias: Site API - close game\n    trigger:\n      - platform: template\n' +
          "        value_template: >-\n          {{ is_state_attr('sensor.my_fantasy_margin', 'live', true)\n             and states('sensor.my_fantasy_margin') | float(99) <= 10\n             and state_attr('sensor.my_fantasy_margin', 'left') | int(99) <= 2 }}\n" +
          '    action:\n      - service: notify.notify\n        data:\n          title: Close game\n' +
          "          message: \"{{ states('sensor.my_fantasy_margin') }} apart, {{ state_attr('sensor.my_fantasy_margin', 'left') }} still to play\"\n";
      },
      look: function () { return phoneAlert('Home Assistant', 'Close game', '6.40 apart, 1 still to play'); },
      _asks: false,
      stop: 'It asks the site nothing itself: the live-score sensor does, and that sensor’s automation stops on <code>too_fast</code> and pauses on <code>pace_changed</code>. A template trigger fires once each time the game becomes close, not on every update.', _runs: 'With the live score' },
    { key: 'injury', title: 'A notification when a player’s injury status changes', have: 'A phone notification when anyone on your roster is newly listed, changes status, or comes off the injury report.',
      steps: ['Set up the helpers and the key from <b>My live score as a sensor</b> first.',
        'Add the configuration below. Its sensor asks for your roster every 20 minutes, less often than the site ever asks for, and only while <b>Site API stopped</b> is off.',
        'Replace <code>notify.notify</code> with your phone’s notify service if you have several.'],
      file: 'configuration.yaml (add)', lang: 'yaml',
      code: function (c) {
        return '# A notification when a player on my roster changes injury status, checked every 20 minutes.\nrest:\n  - resource: ' + U('rosters', { team: c.T, name: 'ha-injuries' }) + '\n' +
          '    headers:\n      Authorization: !secret site_api_key\n    scan_interval: 1200\n    sensor:\n      - name: My injury report\n        unique_id: site_api_my_injuries\n' +
          "        value_template: >-\n          {% if value_json.ok %}\n          {{ value_json.data | selectattr('injuryStatus') | map(attribute='player') | list | length }}\n          {% else %}{{ states('sensor.my_injury_report') }}{% endif %}\n" +
          "        json_attributes: [ok, error, data]\n\ntemplate:\n  - sensor:\n      - name: My injury list\n        unique_id: site_api_my_injury_list\n" +
          "        state: >-\n          {% set d = state_attr('sensor.my_injury_report', 'data') or [] %}\n          {% for p in d | selectattr('injuryStatus') | sort(attribute='player') %}{{ p.player }}: {{ p.injuryStatus }}{% if not loop.last %}; {% endif %}{% endfor %}\n\n" +
          'automation:\n  - alias: Site API - injury changes\n    trigger:\n      - platform: state\n        entity_id: sensor.my_injury_list\n' +
          "    condition:\n      - condition: state\n        entity_id: input_boolean.site_api_stopped\n        state: \"off\"\n      - \"{{ trigger.from_state.state not in ['unknown', 'unavailable'] }}\"\n" +
          "    action:\n      - variables:\n          old: \"{{ trigger.from_state.state.split('; ') }}\"\n          new: \"{{ trigger.to_state.state.split('; ') }}\"\n" +
          '      - service: notify.notify\n        data:\n          title: Injury update\n' +
          "          message: >-\n            {% set added = new | reject('in', old) | reject('eq', '') | list %}{% set gone = old | reject('in', new) | reject('eq', '') | list %}\n" +
          "            {% if added %}Now: {{ added | join(', ') }}. {% endif %}{% if gone %}No longer: {{ gone | join(', ') }}.{% endif %}\n" +
          "  - alias: Site API - stop the injury check on too_fast\n    trigger:\n      - platform: template\n        value_template: \"{{ (state_attr('sensor.my_injury_report', 'error') or {}).get('stop') == 'exit' }}\"\n" +
          '    action:\n      - service: input_boolean.turn_on\n        target:\n          entity_id: input_boolean.site_api_stopped\n';
      },
      look: function (c) { return phoneAlert('Home Assistant', 'Injury update', 'Now: ' + injuryText(c).split(': ')[0] + ': out.'); },
      stop: 'It asks every 20 minutes, never too fast for the site. If the site ever answers <code>too_fast</code>, the second automation turns on <b>Site API stopped</b>, which also stops the live-score sensor’s asking. Home Assistant can’t pause a REST sensor, so on <code>pace_changed</code> the sensor keeps its last reading until the next ask.', _runs: 'Every 20 minutes' },
  ];
  addJobs('ha', haNew);
  runsFor('ha', haNew);

  /* Android: the close game with Tasker. */
  var andNew = [{ key: 'close', title: 'A close-game alert with Tasker', have: 'A notification when your matchup is within 10 points with two or fewer starters left, checked every 10 minutes during games.',
    steps: ['You need Tasker 5.12 or later. Add a <b>Profile → Time</b>: Sunday and Monday from 12:00 to 23:59, <b>Repeat every 10 minutes</b>. Name it <b>Close game</b>.',
      'Give it a new task with the actions below. In <b>HTTP Request</b>, turn on <b>Structure Output</b> and tick <b>Continue Task After Error</b>: a refusal counts as an error, and the task has to carry on to read it.',
      'The task remembers the matchup it has told you about in <code>%CloseTold</code>, so it tells you once.'],
    file: 'Tasker task · Close game', lang: 'actions',
    actions: function (c) {
      return g.actions([
        ['', '<b>HTTP Request</b> · GET <code>' + esc(U('scoreboard', { team: c.T, name: 'tasker-close' })) + '</code> · Headers <code>Authorization:Bearer ' + esc(c.K) + '</code> · Timeout 30 · Structure Output <b>on</b> · Continue Task After Error <b>on</b>'],
        ['cond', '<b>If</b> <code>%http_response_code</code> neq <code>200</code>'],
        ['stop ind', '<b>If</b> <code>%http_data.error.stop</code> eq <code>exit</code>: <b>Profile Status</b> Close game → <b>Off</b> · <b>Notify</b> “Site API stopped” with <code>%http_data.error.message</code> · <b>End If</b>'],
        ['cond ind', '<b>Stop</b> (after too_fast the profile is off; after pace_changed, the next check is 10 minutes away)'],
        ['cond', '<b>End If</b>'],
        ['ok', '<b>Variable Set</b> <code>%gap</code> to <code>abs(%http_data.data.home.points(1) - %http_data.data.away.points(1))</code> · Do Maths <b>on</b>'],
        ['ok', '<b>Variable Set</b> <code>%left</code> to <code>%http_data.data.home.yetToPlay(1) + %http_data.data.home.playing(1) + %http_data.data.away.yetToPlay(1) + %http_data.data.away.playing(1)</code> · Do Maths <b>on</b>'],
        ['cond', '<b>If</b> <code>%http_data.data.state(1)</code> eq <code>live</code> AND <code>%gap</code> ≤ <code>10</code> AND <code>%left</code> ≤ <code>2</code> AND <code>%CloseTold</code> neq <code>%http_data.data.matchupId(1)</code>'],
        ['ok ind', '<b>Notify</b> “Close game” · <code>%gap apart, %left still to play</code> · <b>Variable Set</b> <code>%CloseTold</code> to <code>%http_data.data.matchupId(1)</code>'],
        ['cond', '<b>End If</b>'],
      ]);
    },
    look: function () { return phoneAlert('Tasker', 'Close game', '6.40 apart, 1 still to play'); },
    stop: 'On <code>too_fast</code> the task switches its own profile off and tells you why. Every 10 minutes is never too fast for the site; on <code>pace_changed</code> the task stops and the next check is 10 minutes away.', _runs: 'Every 10 minutes on Sundays and Mondays' }];
  addJobs('android', andNew);
  runsFor('android', andNew);

  /* Google Sheets: the bye grid, the odds tracker, and the feed for a Looker Studio season dashboard. */
  function appsHead(c, desc, name, when, trigger) {
    return '// ' + desc + '\nconst URL = \'' + U('full', { name: name }) + '\';\n\n' +
      'function start() {\n  stop();\n  ' + trigger + '\n  update();\n}\n\nfunction stop() {\n  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));\n}\n\n' +
      'function league() {\n  const key = PropertiesService.getScriptProperties().getProperty(\'SITE_API_KEY\');\n' +
      '  const res = UrlFetchApp.fetch(URL, { headers: { Authorization: \'Bearer \' + key }, muteHttpExceptions: true });\n  const body = JSON.parse(res.getContentText());\n' +
      '  if (res.getResponseCode() === 429) {\n    if (body.error.stop === \'exit\') {            // too_fast: switch the schedule off for good\n      stop();\n' +
      '      MailApp.sendEmail(Session.getEffectiveUser().getEmail(), \'Site API stopped your sheet\', body.error.message);\n    }\n' +
      '    return null;                                  // pace_changed: the next run tries again (' + when + ')\n  }\n  if (!body.ok) throw new Error(body.error.message);\n  return body.data;\n}\n\n' +
      'function tab(name, rows) {\n  const book = SpreadsheetApp.getActive();\n  const sheet = book.getSheetByName(name) || book.insertSheet(name);\n  sheet.clearContents();\n' +
      '  if (rows.length) sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);\n  return sheet;\n}\n\n';
  }
  var appsSteps = function (what, when) {
    return ['In your sheet, open <b>Extensions → Apps Script</b> and replace everything in <code>Code.gs</code> with the script below.',
      'Open <b>Project Settings → Script properties</b> and add <code>SITE_API_KEY</code> with the league’s key as its value.',
      'Choose <code>start</code> in the toolbar and press Run, and allow access when Google asks. It ' + what + ' now, then ' + when + '. Run <code>stop</code> to end it.'];
  };
  var sheetsNew = [
    { key: 'bye', title: 'A bye-week grid for my roster', have: 'A Byes tab: your roster down the side, every remaining week across, each player’s bye marked, and a count of starters lost each week.',
      steps: appsSteps('fills the Byes tab', 'refreshes it every Wednesday'), file: 'Code.gs', lang: 'js',
      code: function (c) {
        return appsHead(c, 'My roster against every remaining week, byes marked. Updated every Wednesday.', 'sheets-byes', 'next Wednesday',
          "ScriptApp.newTrigger('update').timeBased().onWeekDay(ScriptApp.WeekDay.WEDNESDAY).atHour(9).create();") +
          'const TEAM = ' + c.T + ';\n\nfunction update() {\n  const d = league();\n  if (!d) return;\n  const week = d.about.week;\n' +
          '  const last = Math.max(...d.schedule.filter((m) => !m.postseasonRound).map((m) => m.week));\n  const weeks = [];\n  for (let w = week; w <= last; w++) weeks.push(w);\n' +
          "  const mine = d.rosters.filter((p) => p.teamId === TEAM && p.slot !== 'IR');\n" +
          "  const rows = [['Player', 'Pos', 'Slot', ...weeks.map((w) => 'Wk ' + w)]]\n    .concat(mine.map((p) => [p.player, p.position, p.slot, ...weeks.map((w) => (p.bye === w ? 'BYE' : ''))]));\n" +
          "  rows.push(['Starters lost', '', '', ...weeks.map((w) => mine.filter((p) => p.bye === w && p.slot !== 'BE').length)]);\n  tab('Byes', rows);\n}\n";
      },
      look: function (c) {
        var mine = rosterOf(c.T).filter(function (r) { return r.slot !== 'IR'; }).slice(0, 6), weeks = [WEEK, WEEK + 1, WEEK + 2, WEEK + 3];
        return LOOK.sheet('Byes', [['Player', 'Pos', 'Slot'].concat(weeks.map(function (w) { return 'Wk ' + w; }))].concat(mine.map(function (r) {
          return [r.player, r.position, r.slot].concat(weeks.map(function (w) { return r.bye === w ? 'BYE' : ''; }));
        })), 'The last row counts the starters each week loses to byes.');
      },
      stop: 'On <code>too_fast</code> the script deletes its own schedule and emails you the site’s message. On <code>pace_changed</code> it skips; next Wednesday tries again.', _runs: 'Wednesdays at about 9' },
    { key: 'odds', title: 'Track the playoff odds week by week', have: 'An Odds tab with every team’s ESPN and simulated playoff odds after each week, and a line chart of ESPN’s that grows through the season.',
      steps: appsSteps('fills the Odds tab and draws the chart', 'refreshes every Wednesday').concat(['The odds by week come from Fortune Teller, so it needs that tool visible to the league.']), file: 'Code.gs', lang: 'js',
      code: function (c) {
        return appsHead(c, 'Every team\'s playoff odds after each week, with a chart. Updated every Wednesday.', 'sheets-odds', 'next Wednesday',
          "ScriptApp.newTrigger('update').timeBased().onWeekDay(ScriptApp.WeekDay.WEDNESDAY).atHour(9).create();") +
          'function update() {\n  const d = league();\n  if (!d || !d.fortuneOdds) return;\n  const teams = [...new Set(d.fortuneOdds.map((x) => x.team))];\n' +
          '  const weeks = [...new Set(d.fortuneOdds.map((x) => x.week))].sort((a, b) => a - b);\n' +
          '  const at = (w, t, f) => { const x = d.fortuneOdds.find((y) => y.week === w && y.team === t); return x && x[f] != null ? x[f] : \'\'; };\n' +
          "  const sheet = tab('Odds', [['Week', ...teams, ...teams.map((t) => t + ' (sim)')]]\n    .concat(weeks.map((w) => [w, ...teams.map((t) => at(w, t, 'espnPlayoffOdds')), ...teams.map((t) => at(w, t, 'simPlayoffOdds'))])));\n" +
          "  sheet.getRange(2, 2, Math.max(1, weeks.length), teams.length * 2).setNumberFormat('0.0%');\n" +
          '  sheet.getCharts().forEach((ch) => sheet.removeChart(ch));\n' +
          '  sheet.insertChart(sheet.newChart().setChartType(Charts.ChartType.LINE)\n    .addRange(sheet.getRange(1, 1, weeks.length + 1, teams.length + 1)).setPosition(2, teams.length * 2 + 3, 0, 0)\n' +
          "    .setOption('title', 'Playoff odds (ESPN)').setOption('vAxis', { format: 'percent', viewWindow: { min: 0, max: 1 } }).build());\n}\n";
      },
      look: function () {
        var s = standingsNow().slice(0, 4);
        return LOOK.sheet('Odds', [['Week'].concat(s.map(function (t) { return t.team; }))].concat([1, 2, 3].map(function (w) {
          return [w].concat(s.map(function (t) { return t.playoffOdds == null ? '' : (Math.round(Math.min(1, Math.max(0, t.playoffOdds + (w - 3) * 0.05)) * 1000 + 1e-6) / 10).toFixed(1) + '%'; }));
        })), 'One row per week, ESPN’s odds first and the simulation’s beside them; the chart sits to the right.');
      },
      stop: 'On <code>too_fast</code> the script deletes its own schedule and emails you the site’s message. On <code>pace_changed</code> it skips; next Wednesday tries again.', _runs: 'Wednesdays at about 9' },
    { key: 'dashboard', title: 'A season dashboard in Looker Studio', have: 'Three tabs kept current every morning (Standings, Weekly points and Odds) and a free Looker Studio dashboard built on them: points, odds, form and luck.',
      steps: appsSteps('fills the three tabs', 'refreshes them every morning at about 7').concat([
        'At <b>lookerstudio.google.com</b>, choose <b>Create → Report → Google Sheets</b>, pick this sheet and the <b>Weekly points</b> tab, then add the other two as data sources.',
        'Add charts: a time series of <b>points</b> by <b>week</b> broken down by <b>team</b>; a table of Standings with <b>luck</b> (points against minus the league’s average); a line chart of Odds. Looker Studio re-reads the sheet on its own.']),
      file: 'Code.gs', lang: 'js',
      code: function (c) {
        return appsHead(c, 'Three tabs for a Looker Studio season dashboard, refreshed every morning.', 'looker-season', 'tomorrow morning',
          "ScriptApp.newTrigger('update').timeBased().everyDays(1).atHour(7).create();") +
          'function update() {\n  const d = league();\n  if (!d) return;\n  const done = d.schedule.filter((m) => m.state === \'final\');\n' +
          '  const avgAgainst = d.standings.reduce((a, t) => a + t.pointsAgainst, 0) / Math.max(1, d.standings.length);\n' +
          "  tab('Standings', [['seed', 'team', 'wins', 'losses', 'pointsFor', 'pointsAgainst', 'luck', 'playoffOdds', 'simPlayoffOdds']]\n" +
          '    .concat(d.standings.map((t) => [t.seed, t.team, t.wins, t.losses, t.pointsFor, t.pointsAgainst,\n      Math.round((t.pointsAgainst - avgAgainst) * 100) / 100, t.playoffOdds, t.simPlayoffOdds === null ? \'\' : t.simPlayoffOdds])));\n' +
          "  tab('Weekly points', [['week', 'team', 'points', 'opponent', 'won']]\n    .concat(done.flatMap((m) => [[m.week, m.home.team, m.home.points, m.away.team, m.winnerTeamId === m.home.teamId],\n" +
          '      [m.week, m.away.team, m.away.points, m.home.team, m.winnerTeamId === m.away.teamId]])));\n' +
          "  tab('Odds', [['week', 'team', 'espnPlayoffOdds', 'simPlayoffOdds']]\n    .concat((d.fortuneOdds || []).map((x) => [x.week, x.team, x.espnPlayoffOdds === null ? '' : x.espnPlayoffOdds, x.simPlayoffOdds === null ? '' : x.simPlayoffOdds])));\n}\n";
      },
      look: function () {
        var rows = [['week', 'team', 'points', 'opponent', 'won']];
        D.schedule.filter(function (m) { return m.state === 'final'; }).slice(0, 5).forEach(function (m) { rows.push([m.week, m.home.team, m.home.points.toFixed(2), m.away.team, m.winnerTeamId === m.home.teamId ? 'TRUE' : 'FALSE']); });
        return LOOK.sheet('Weekly points', rows, 'One of the three tabs Looker Studio reads. A positive luck figure means more points were scored against a team than the league’s average.');
      },
      stop: 'On <code>too_fast</code> the script deletes its own schedule and emails you the site’s message. On <code>pace_changed</code> it skips; tomorrow morning tries again. Looker Studio reads only the sheet, never the site.', _runs: 'Daily at about 7' },
  ];
  addJobs('sheets', sheetsNew);
  runsFor('sheets', sheetsNew);

  /* Excel: the bye grid from the rosters CSV. */
  var excelNew = [{ key: 'bye', title: 'A bye-week grid for my roster', have: 'Your roster with a column for each of the next six weeks, each player’s bye marked, refreshing with the rest of the workbook.',
    steps: ['Create a Blank Query (<b>Data → Get Data → From Other Sources → Blank Query</b>), open <b>Advanced Editor</b> and paste the query below. Your team (<code>team=%T%</code>) is filled in.',
      'Name it <b>Byes</b>, then <b>Close &amp; Load</b>. Set <b>Refresh every</b> to 15 minutes or more, as for the standings, or refresh it by hand once a week.',
      'Keep the <code>ManualStatusHandling</code> line, so a refusal shows the site’s message.'],
    file: 'Power Query · Advanced Editor', lang: 'm',
    code: function (c) {
      return '// My roster against the next six weeks, byes marked. Refresh every 15 minutes or more.\nlet\n' +
        '    // Asks the site once per address, and shows the site\'s message if it refuses.\n' +
        '    Get = (address) => let\n' +
        '        Response = Web.Contents(address, [Headers = [Authorization = "Bearer ' + c.K + '"], ManualStatusHandling = {429}]),\n' +
        '        Refused = Value.Metadata(Response)[Response.Status] = 429\n' +
        '    in\n        if Refused then error Json.Document(Response)[error][message]\n' +
        '        else Table.PromoteHeaders(Csv.Document(Response, [Delimiter = ",", Encoding = 65001])),\n' +
        '    Week = Number.From(Get("' + U('scoreboard.csv', { name: 'excel-byes' }) + '"){0}[week]),\n' +
        '    Roster = Table.SelectRows(Table.SelectColumns(Get("' + U('rosters.csv', { team: c.T, name: 'excel-byes' }) + '"),\n' +
        '        {"player", "position", "slot", "bye"}), each [slot] <> "IR"),\n' +
        '    Typed = Table.TransformColumnTypes(Roster, {{"bye", Int64.Type}}),\n' +
        '    Grid = List.Accumulate(List.Numbers(Week, 6), Typed,\n' +
        '        (t, w) => Table.AddColumn(t, "Wk " & Text.From(w), each if [bye] = w then "BYE" else ""))\n' +
        'in\n    Table.RemoveColumns(Grid, {"bye"})\n';
    },
    look: function (c) {
      var mine = rosterOf(c.T).filter(function (r) { return r.slot !== 'IR'; }).slice(0, 6), weeks = [WEEK, WEEK + 1, WEEK + 2];
      return LOOK.sheet('Byes', [['player', 'position', 'slot'].concat(weeks.map(function (w) { return 'Wk ' + w; }))].concat(mine.map(function (r) {
        return [r.player, r.position, r.slot].concat(weeks.map(function (w) { return r.bye === w ? 'BYE' : ''; }));
      })), 'This week and the five after it, the week read from the scoreboard.');
    },
    stop: 'Excel asks only when the workbook refreshes. Every 15 minutes is never too fast, even on the busiest day. A refusal shows the site’s message in place of the refresh.', _runs: 'Every 15 minutes, or by hand' }];
  addJobs('excel', excelNew);
  runsFor('excel', excelNew);
}
