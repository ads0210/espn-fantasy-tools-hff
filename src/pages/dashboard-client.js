/**
 * Everything the dashboard does once it reaches the browser.
 *
 * Emitted inside a template literal: a backtick in a comment here breaks the
 * page, and a backslash escape is consumed before the browser sees it. The
 * values the server injects arrive as arguments rather than as free variables,
 * so what crosses that boundary is visible in one place.
 */
import { TEAM_COOKIE, LOGO_FALLBACK_SVG } from '../ui.js';
import { idleAwarePoller } from './poller.js';
import { pollSecsFor } from '../budget.js';

/* The brake's poll rates (C5), from the one rule in budget.js: [nothing live, something live] in seconds. */
const BRAKE_SECS = Object.fromEntries(['economy', 'protect', 'limit'].map((b) => [b, [pollSecsFor(b, { live: false }), pollSecsFor(b, { live: true })]]));

export function dashboardClientJs({ version = '', initial = null, board = null } = {}) {
  return `
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

/* Each fixture reserves only the room its own state needs.
 *
 * One width for the whole strip meant every item reserved what the longest one
 * needed — an upcoming kickoff time runs to about eighteen characters — so a
 * game reading FINAL carried a dozen blank characters after it. The reservation
 * exists to stop a label resizing mid-scroll, and a game only changes state a
 * couple of times a day, at which point the strip rebuilds once anyway.
 *
 * A little headroom on top, because a running clock grows by a character when
 * the quarter ticks over and that should not nudge the loop. */
function stateCell(state) {
  var n = Math.max(4, String(state || '').length + 1);
  return '<span class="tkstate j-s" style="--sw:' + n + 'ch"></span>';
}

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
      '<span class="tkvs">AT</span>' + home + stateCell(state) + '</div>',
    vals: { a: g.started ? g.awayScore : '', h: g.started ? g.homeScore : '',
            s: state, live: !!g.inProgress, win: null } };
}

function fantasyItem(m, i) {
  function side(s, cls) {
    return '<span class="tkside ' + cls + '">' + logo(s.logo, s.name) +
      '<b class="tkab">' + esc(s.name) + '</b>' +
      ((m.started || m.state === 'final' || m.state === 'live')
        ? '<b class="tkpts j-' + cls + '"></b>' : '') + '</span>';
  }
  /* Same reading as the card and as Live Matchups: a fixture is over when its
     games are over, whether or not ESPN has written a winner yet. */
  var fin = m.state === 'final' || !!m.winner;
  var running = !fin && (m.state === 'live' || m.started);
  var played = fin || running;
  var state = fin ? 'Final' : (running ? 'Live' : 'Week ' + m.period);
  return { key: 'f' + i,
    html: '<div class="tk" data-k="f' + i + '">' + side(m.away, 'a') +
      '<span class="tkvs">VS</span>' + side(m.home, 'h') + stateCell(state) + '</div>',
    vals: { a: played ? pts2(m.away.points) : '',
            h: played ? pts2(m.home.points) : '',
            s: state, live: running, win: fin } };
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

  runEl.style.animation = 'none';
  runEl.innerHTML = structure;
  patch(runEl, items);
  var copyWidth = Math.max(1, runEl.scrollWidth);
  var stripWidth = stripEl.clientWidth || copyWidth;

  var copies = Math.max(3, Math.ceil((stripWidth * 2) / copyWidth) + 2);
  var perCopy = runEl.children.length;
  var out = '';
  for (var i = 0; i < copies; i++) out += structure;
  runEl.innerHTML = out;
  /* Week 6 (A7): the loop's extra copies are for the eye only; a screen reader reads the strip once. */
  for (var k = perCopy; k < runEl.children.length; k++) runEl.children[k].setAttribute('aria-hidden', 'true');

  runEl.style.setProperty('--shift', (-copyWidth) + 'px');
  runEl.style.setProperty('--dur', Math.max(8, copyWidth / 42).toFixed(2) + 's');
  void runEl.offsetWidth;
  runEl.style.animation = '';
  patch(runEl, items);
}

/* ---------------------------------------------------------------- team card */
var KICKOFF = null, cdTimer = null;

/* The win split as one dial rather than two.
 *
 * A matchup has exactly two outcomes, so a single ring divided between them
 * says more than a lone percentage: the reader sees both shares and which way
 * it leans in one glance. The reader's own side is drawn in the accent green
 * from the top of the arc, the opponent's in blue for the remainder, and the
 * centre carries whichever side is ahead in that side's colour. */
function winGauge(m) {
  if (m.final || m.winner || typeof m.myWinProb !== 'number') return '';
  var mine = Math.max(0, Math.min(100, m.myWinProb));
  var theirs = 100 - mine;
  var R = 42, C = 2 * Math.PI * R;
  var lead = mine >= theirs;
  var pct = (lead ? mine : theirs).toFixed(0);
  return '<div class="wgauge" role="img" aria-label="' +
      mine.toFixed(0) + ' percent to win">' +
    '<svg viewBox="0 0 100 100">' +
      '<circle class="wgtrack" cx="50" cy="50" r="' + R + '"/>' +
      '<circle class="wgtheirs" cx="50" cy="50" r="' + R + '" ' +
        'stroke-dasharray="' + C + '" stroke-dashoffset="' + (C * (1 - theirs / 100)) + '" ' +
        'transform="rotate(' + (-90 + 360 * (mine / 100)) + ' 50 50)"/>' +
      '<circle class="wgmine" cx="50" cy="50" r="' + R + '" ' +
        'stroke-dasharray="' + C + '" stroke-dashoffset="' + (C * (1 - mine / 100)) + '" ' +
        'transform="rotate(-90 50 50)"/>' +
    '</svg>' +
    '<span class="wgmid ' + (lead ? 'smine' : 'stheirs') + '">' + pct + '<i>%</i></span>' +
  '</div>';
}

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
   read as "Gridiron Ghosts" in one place and "GG" in another, which is a
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
    (sl.pointsFor != null ? '<span class="stat"><b>' + pts2(sl.pointsFor) + '</b><span>PF</span></span>' : '') +
    '</div>';
}

/* Week 6 (N6): the card's banner, a ribbon across its top edge with a one-line reason; one at a time. */
function setBanner(panel, bn) {
  var old = panel.querySelector('.mbanner');
  if (old) old.remove();
  if (!bn) { panel.classList.remove('hasbanner'); panel.removeAttribute('data-tone'); return; }
  var d = document.createElement('div');
  d.className = 'mbanner t-' + bn.tone;
  d.setAttribute('data-banner', bn.key);
  d.innerHTML = '<div class="mbline"><span class="mbglyph">' + bn.svg + '</span><span class="mblabel">' + esc(bn.label) +
    '</span></div><p class="mbreason">' + esc(bn.reason) + '</p>';
  panel.insertBefore(d, panel.firstChild);
  panel.classList.add('hasbanner');
  panel.setAttribute('data-tone', bn.tone);
}

function renderCard(t, identified) {
  var panel = document.getElementById('cardPanel');
  setBanner(panel, null);
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
    var m = t.matchup;
    /* A matchup that has kicked off shows what it is worth, not how long until
       something that already happened. The countdown is for a fixture where
       nobody has taken the field yet. */
    if (m.inPlay || m.started) {
      var done = !!(m.final || m.winner);
      /* Home or away is not on this payload and does not need to be: the two
         scores already say who won. */
      var diff = m.myPoints - m.oppPoints;
      var iWon = diff > 0, tied = Math.abs(diff) < 0.005;
      /* A projection on a finished game is a guess about something that has
         already happened, so it comes off once the result is in. */
      var projMe = (!done && m.myProjected != null)
        ? '<span class="sproj">' + pts2(m.myProjected) + '</span>' : '';
      var projOpp = (!done && m.oppProjected != null)
        ? '<span class="sproj">' + pts2(m.oppProjected) + '</span>' : '';
      var centre = done
        ? '<div class="vsmargin ' + (tied ? 'tied' : iWon ? 'won' : 'lost') + '">' +
            (tied ? 'Tied'
              : (iWon ? 'Won by ' : 'Lost by ') + pts2(Math.abs(diff))) +
          '</div>'
        : winGauge(m);
      mid = '<div class="vsgrid' + (done ? ' isdone' : '') + '">' +
        '<div class="vslabel' + (done ? ' isfinal' : '') + '">' +
          (done ? 'Final' : 'Live') + '</div>' +
        '<div class="vsscore mine' + (done && iWon ? ' won' : '') + '">' +
          '<b class="smine">' + pts2(m.myPoints) + '</b>' + projMe + '</div>' +
        centre +
        '<div class="vsscore theirs' + (done && !iWon && !tied ? ' won' : '') + '">' +
          '<b class="stheirs">' + pts2(m.oppPoints) + '</b>' + projOpp + '</div>' +
      '</div>';
    } else if (t.kickoff && Date.parse(t.kickoff) > Date.now()) {
      mid = '<div class="countdown" id="cdown">--</div><div class="vslabel">Until kickoff</div>';
    } else if (t.kickoff) {
      /* A kickoff already in the past with the matchup not under way: the
         scoring period has rolled but the NFL schedule on hand is still last
         week's, so there is nothing ahead to count down to. Counting down to a
         time that has been and gone read as "Kickoff / until kickoff" and sat
         there. The week is the honest thing to say until a schedule arrives. */
      mid = '<div class="vslabel">Week ' + m.period + '</div>' +
        '<div class="cdnote">Schedule not posted yet</div>';
    } else {
      mid = '<div class="vslabel">Week ' + m.period + '</div>';
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
  setBanner(panel, (t.matchup && t.matchup.banner) || null);

  KICKOFF = (t.matchup && !t.matchup.started && !t.matchup.inPlay) ? t.kickoff : null;
  if (cdTimer) clearInterval(cdTimer);
  if (KICKOFF) { renderCountdown(); cdTimer = setInterval(renderCountdown, 1000); }
}

/* ---------------------------------------------------------------- board */
/* Two weeks of waiver noise buried the useful part of this list, and the panel
   is a glance rather than an archive. The wider ranges are one click away. */
var TX = [], RANGE = 7;

/* Fortune Teller's simulated odds, or why there are none yet; set by every status poll. */
var stSim = null;

/* One rounding for a percentage everywhere on the site: half up, at one decimal. The same rule lives in Fortune
   Teller's pct(), Site Backend's and the standings table's (src/standingstable.js). */
function pct1(x) { return (Math.round(x * 1000 + 1e-6) / 10).toFixed(1) + '%'; }

/* The standings: the league's one table (src/standingstable.js, Season Statistics' too), with the chosen team's row
   highlighted here only (Season Statistics plan D69). Absent when Site Configuration keeps the standings to
   Season Statistics. */
var stTable = null;
function renderStandings(t) {
  var host = document.getElementById('standings');
  if (!host) return;
  if (t) stTable = t;
  t = stTable;
  if (!t || !window.EFTStandings) {
    host.innerHTML = '<div class="placeholder"><b>Standings unavailable</b><span>They appear once the league is set up.</span></div>';
    return;
  }
  window.EFTStandings.render(host, Object.assign({}, t, { mine: teamValue() ? Number(teamValue()) : null }));
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

/* What each state is called on the page. ESPN's own vocabulary describes its
   pipeline; a member wants to know whether the deal is waiting on them, waiting
   on the clock, done, or dead. */
var TX_STATUS = {
  completed: 'Completed',
  on_the_table: 'On the table',
  pending_approval: 'Pending approval',
  rejected: 'Rejected',
  cancelled: 'Withdrawn',
  expired: 'Expired'
};
var TX_KIND = { trade: 'Trade', waiver: 'Waiver', swap: 'Move', add: 'Add', drop: 'Drop' };

function txPlayer(p, sign) {
  return '<span class="txp' + (sign ? ' ' + sign : '') + '">' +
    (sign === 'add' ? '<span class="txsign">+</span>'
      : sign === 'drop' ? '<span class="txsign">&minus;</span>' : '') +
    // Week 6 (A6): a defence's name already says D/ST, so its tag is not repeated.
    esc(p.name) + (p.pos && !(p.pos === 'D/ST' && String(p.name || '').slice(-4) === 'D/ST') ? '<em>' + esc(p.pos) + '</em>' : '') + '</span>';
}

function txTeam(t) {
  return '<span class="txteam">' + logo(t.logo, t.name, 'tklogo') +
    '<b>' + esc(t.name) + '</b></span>';
}

function txRow(t) {
  var when = (t.date && typeof window.fmtDate === 'function') ? window.fmtDate(t.date) : '';
  var who, body;

  if (t.kind === 'trade') {
    // Both teams, and what each of them is sending. The deal, not its parts.
    who = (t.teams || []).map(txTeam).join('<span class="txswap">&#8644;</span>');
    body = (t.sides || []).map(function (side) {
      return '<span class="txgroup">' +
        side.players.map(function (p) { return txPlayer(p, null); }).join('') + '</span>';
    }).join('<span class="txswap">&#8644;</span>');
  } else {
    who = (t.teams || []).map(txTeam).join('');
    body = '<span class="txgroup">' +
      (t.adds || []).map(function (p) { return txPlayer(p, 'add'); }).join('') +
      (t.drops || []).map(function (p) { return txPlayer(p, 'drop'); }).join('') +
      '</span>';
  }

  var tags = '<span class="txkind ' + esc(t.kind) + '">' +
    esc(TX_KIND[t.kind] || t.kind) + '</span>';
  // A status is the point of a trade row and noise on anything else: an add
  // that happened is not news about its own completion.
  if (t.kind === 'trade' && TX_STATUS[t.status]) {
    tags += '<span class="txstat ' + esc(t.status) + '">' + esc(TX_STATUS[t.status]) + '</span>';
  }
  if (t.bid) tags += '<span class="txbid">$' + esc(String(t.bid)) + '</span>';

  return '<div class="txrow">' +
    '<span class="txwho">' + who + '</span>' +
    '<span class="txbody">' + body + '</span>' +
    '<span class="txtags">' + tags + '</span>' +
    '<span class="txwhen">' + esc(when) + '</span></div>';
}

function renderTransactions() {
  var host = document.getElementById('transactions');
  var cutoff = RANGE ? Date.now() - RANGE * 86400000 : 0;
  var rows = TX.filter(function (t) {
    if (!cutoff) return true;
    if (!t.date) return false;
    return Date.parse(t.date) >= cutoff;
  });

  if (!rows.length) {
    host.innerHTML = '<div class="placeholder"><b>No activity</b>' +
      '<span>Nothing moved in this window.</span></div>';
    return;
  }
  host.innerHTML = rows.map(txRow).join('');
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
  stSim = d.sim || null;
  renderStandings(d.table);
  renderCard(d.myTeam, d.identified);
  renderInjuries(d.injuries || [], !!d.myTeam);
  TX = d.transactions || [];
  renderTransactions();
}

/* The board (your matchup, standings, injuries, league activity) is asked for on its own only when the page opens
   without one or the team changes. Otherwise it rides along with the status poll once every 90 seconds, so the
   page makes one request where it used to make two, and the board pauses with the status poll in a hidden tab
   and after four idle hours. */
var BOARD_EVERY = 90000, lastBoardAt = 0;
async function loadBoard() {
  try {
    var q = teamValue() ? ('?team=' + encodeURIComponent(teamValue())) : '';
    var res = await fetch('/api/dashboard/board' + q);
    if (!res.ok) throw new Error(res.status);
    paintBoard(await res.json());
    lastBoardAt = Date.now();
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

/* The site's notices about its free limits (C6): a warning before Cloudflare's daily limit, a limit the site runs
   past, and for a day afterwards a dismissible note about a cutoff pages saw. Times in the reader's chosen zone. */
var NOTICE_ICON = '<span class="alerticon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg></span>';
function noticeClock(iso) { try { return new Date(iso).toLocaleTimeString(undefined, { timeZone: (typeof window.siteTz === 'function' ? window.siteTz() : undefined), hour: 'numeric', minute: '2-digit' }); } catch (e) { return new Date(iso).toISOString().slice(11, 16) + ' UTC'; } }
function paintNotice(n) {
  var host = document.getElementById('sitenotice');
  if (!host) return;
  var parts = [];
  var midnight = new Date(Math.floor(Date.now() / 86400000) * 86400000 + 86400000).toISOString();
  if (n && n.text) {
    parts.push('<div class="alertbar" role="status">' + NOTICE_ICON + '<span><b>' + (n.kind === 'busy' ? 'A very busy day' : 'Resting until midnight UTC') + '</b><p>'
      + esc(n.text.split('{until}').join(noticeClock(midnight))) + '</p></span></div>');
  }
  if (n && n.outage) {
    var key = 'eftOutage:' + n.outage.seenAt, gone = false;
    try { gone = localStorage.getItem(key) === '1'; } catch (e) { gone = false; }
    if (!gone) {
      parts.push('<div class="alertbar" role="status">' + NOTICE_ICON + '<span><b>Earlier today</b><p>The site reached Cloudflare\u2019s free daily limit, so pages could not load from '
        + esc(noticeClock(n.outage.seenAt)) + ' until ' + esc(noticeClock(n.outage.until)) + ' (00:00 UTC).' + (n.outage.clockOn ? ' Live scores kept being recorded.' : '')
        + ' <button type="button" class="linkbtn" id="noticeOk" data-key="' + esc(key) + '">Dismiss</button></p></span></div>');
    }
  }
  var markup = parts.join('');
  if (host.innerHTML !== markup) host.innerHTML = markup;
  host.hidden = !markup;
  var ok = document.getElementById('noticeOk');
  if (ok && !ok.dataset.wired) {
    ok.dataset.wired = '1';
    ok.addEventListener('click', function () { try { localStorage.setItem(ok.dataset.key, '1'); } catch (e) { /* hidden for this view only */ } paintNotice({ text: n && n.text, kind: n && n.kind }); });
  }
}

function paint(d) {
    LAST = d;
    paintNotice(d.siteNotice);
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

/* The brake (C5): every answer says whether the site is saving its daily allowance, and the poll waits longer
   while it is: every minute while a game is on and every 5 minutes otherwise at Economy, every 5 at Protect. */
var BRAKE = 'normal', BRAKE_SECS = ${JSON.stringify(BRAKE_SECS)};
function noteBrake(res) { try { var b = res.headers.get('x-brake'); BRAKE = BRAKE_SECS[b] ? b : 'normal'; } catch (e) { BRAKE = 'normal'; } }
window.__eftPollDelay = function (base) {
  var t = BRAKE_SECS[BRAKE];
  if (!t) return base;
  var live = Boolean(LAST_STATUS && ((LAST_STATUS.nfl && LAST_STATUS.nfl.live) || (LAST_STATUS.fantasy && LAST_STATUS.fantasy.live)));
  return Math.max(base, (live ? t[1] : t[0]) * 1000);
};

async function loadStatus() {
  try {
    // A second short of the interval, so a poll that lands a moment early still brings the board.
    var withBoard = Date.now() - lastBoardAt >= BOARD_EVERY - 1000;
    var q = withBoard ? ('?board=1' + (teamValue() ? '&team=' + encodeURIComponent(teamValue()) : '')) : '';
    var res = await fetch('/api/dashboard/status' + q);
    noteBrake(res);
    // Cloudflare's own limit page (C6): keep what is shown, put the site's notice up, and rest until midnight UTC.
    if (window.__eftLimit && await window.__eftLimit.check(res)) return;
    if (!res.ok) throw new Error(res.status);
    var d = await res.json();
    if (d.board) { var b = d.board; delete d.board; if (b.ok !== false) { paintBoard(b); lastBoardAt = Date.now(); } }
    LAST_STATUS = d;
    paint(LAST_STATUS);
  } catch (e) {
    document.getElementById('nmeta').textContent = 'Unavailable';
    document.getElementById('fmeta').textContent = 'Unavailable';
  }
}

if (INITIAL) { LAST_STATUS = INITIAL; paint(INITIAL); } else loadStatus();
if (BOARD) { paintBoard(BOARD); lastBoardAt = Date.now(); } else loadBoard();
${idleAwarePoller('loadStatus', 15000)}

/* Week 6 (F2, PD21): the data banner's times in the reader's zone, and Dismiss with the Admin Password. */
(function () {
  var bar = document.getElementById('databanner');
  if (!bar) return;
  function stampText(iso) {
    return (typeof window.fmtDateTime === 'function' && window.fmtDateTime(iso)) || new Date(iso).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  }

  function paint() {
    var ts = bar.querySelectorAll('time.dbtime');
    for (var i = 0; i < ts.length; i++) ts[i].textContent = stampText(ts[i].getAttribute('datetime'));
  }
  paint();
  window.addEventListener('tzchange', paint);
  var pop = document.getElementById('dbpop'), btn = document.getElementById('dbDismiss');
  if (!pop || !btn) return;
  var pw = document.getElementById('dbPw'), err = document.getElementById('dbErr'), go = document.getElementById('dbGo');
  function say(t) { err.textContent = t; err.hidden = !t; }
  function open() { pop.hidden = false; say(''); pw.value = ''; pw.focus({ preventScroll: true }); }
  function close() { pop.hidden = true; btn.focus({ preventScroll: true }); }
  btn.addEventListener('click', open);
  document.getElementById('dbCancel').addEventListener('click', close);
  pop.addEventListener('click', function (e) { if (e.target === pop) close(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !pop.hidden) close(); });
  pw.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
  go.addEventListener('click', submit);
  function submit() {
    if (!pw.value) { say('Type the Admin Password first.'); return; }
    go.disabled = true;
    fetch('/api/admin/data-banner-dismiss', { method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json', 'x-admin-password': pw.value }, body: '{}' })
      .then(function (r) {
        go.disabled = false;
        if (r.ok) { pop.hidden = true; bar.remove(); return; }
        if (r.status === 403) { say('That password isn’t right. Nothing was changed.'); pw.select(); return; }
        if (r.status === 429) { say('Too many attempts. Try again in a few minutes.'); return; }
        say('That didn’t go through. Nothing was changed; try again in a minute.');
      })
      .catch(function () { go.disabled = false; say('That didn’t go through. Nothing was changed; try again in a minute.'); });
  }
})();

/* The update notice, shown once per browser per version.
 *
 * There is no per-member identity on this site — one shared League Password —
 * so there is no server-side record of who has read what, and localStorage is
 * the only thing that can answer "has this browser seen this version". A
 * browser with nothing stored is treated as a first visit and told nothing:
 * it has not been updated from anything.
 *
 * Every storage access is guarded. Private browsing and locked-down profiles
 * throw on access rather than returning null, and a changelog is never worth
 * taking the dashboard down over. */
(function () {
  var VERSION = ${JSON.stringify(version || '')};
  if (!VERSION) return;
  var pop = document.getElementById('updatepop');
  if (!pop) return;

  var KEY = 'eft_seen_version';

  function remember() {
    try { window.localStorage.setItem(KEY, VERSION); } catch (e) {}
  }
  function close() {
    pop.hidden = true;
    remember();
  }
  function open() {
    pop.hidden = false;
    // The drawn bar cannot measure a hidden pane; it sizes itself on the resize.
    window.dispatchEvent(new Event('resize'));
  }

  /* Dismissal is wired before anything decides whether to open, so a dialog
     that arrives already open — which diagnostics can render — can still be
     closed. Wiring it after the checks below left those buttons inert. */
  var done = document.getElementById('updateDone');
  if (done) done.addEventListener('click', close);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !pop.hidden) close();
  });
  // Clicking the page behind the notice dismisses it too, the way a small
  // overlay is expected to behave. Clicks inside the box are not dismissals.
  pop.addEventListener('click', function (e) { if (e.target === pop) close(); });

  var seen = null;
  try { seen = window.localStorage.getItem(KEY); } catch (e) { return; }

  if (seen === null || seen === undefined) { remember(); return; }
  if (seen === VERSION) return;
  open();
})();

/* Week 6 (P9): the note from the Site Admin, once per browser per note. Unlike the update notice, a first visit sees
   it too: a note is news for everyone. It waits while the update notice is open, then shows. Dismissal is wired
   before anything decides whether to open. */
(function () {
  var pop = document.getElementById('notepop');
  if (!pop) return;
  var ID = pop.getAttribute('data-note') || '';
  var KEY = 'eft_seen_note';
  var back = null;
  function close() {
    pop.hidden = true;
    try { window.localStorage.setItem(KEY, ID); } catch (e) {}
    if (back && back.focus) back.focus({ preventScroll: true });
  }
  var done = document.getElementById('noteDone');
  if (done) done.addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !pop.hidden) close(); });
  pop.addEventListener('click', function (e) { if (e.target === pop) close(); });
  var seen = null;
  try { seen = window.localStorage.getItem(KEY); } catch (e) { return; }
  if (seen === ID) return;
  function show() {
    var up = document.getElementById('updatepop');
    if (up && !up.hidden) { setTimeout(show, 400); return; }
    back = document.activeElement;
    pop.hidden = false;
    var pane = pop.querySelector('.vscroll'); if (pane) pane.scrollTop = 0;
    window.dispatchEvent(new Event('resize'));
    if (done) done.focus({ preventScroll: true });
  }
  setTimeout(show, 0);
})();`;
}
