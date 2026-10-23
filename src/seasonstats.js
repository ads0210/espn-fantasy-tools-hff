/**
 * Season Statistics: every record of the season in progress, worked out from stored figures (no ESPN call here).
 *
 * One plain module shared by the backend (src/seasonstep.js, which stores one part per period) and the page
 * (app/season-stats, which lays live figures over the stored ones during games). Ported from the approved design
 * sample; the planning document "Season Statistics — Planning Document" holds every decision (D1–D74) and the
 * record catalogue (S numbers are permanent).
 *
 * A record = { id, sec, title, kind, unit, better, headline, live, info, entries, empty, tone, since }.
 * entries are sorted best first; the record's holders are every entry level with the first (ties list all).
 * kind: 'team' (one entry per team), 'teamweek' (a team in one week), 'match' (a matchup),
 *       'player' (a player, labelled with his fantasy team or free agent), 'pair' (two teams).
 *
 * Rules carried from the plan: a two-week postseason matchup counts each scoring week as its own meeting for every
 * points or margin record and once for results (D8, D74); PPG is points per scoring week (D74); after the regular
 * season a view that includes the postseason keeps the final regular-season seed and reads Clinched / Eliminated
 * (D72); a record from the score timeline says "since week N" when the site did not record every week (D16).
 */

export const POS = { 1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'D/ST' };
export const SLOT_POS = { 0: [1], 2: [2], 4: [3], 6: [4], 23: [2, 3, 4], 16: [16], 17: [5] };

const statOf = (player, src, period, season) => {
  const s = (player.stats || []).find((x) => x.statSourceId === src && x.statSplitTypeId === 1 &&
    x.scoringPeriodId === period && (season == null || x.seasonId == null || x.seasonId === season));
  return s ? Number(s.appliedTotal) || 0 : 0;
};

/**
 * One settled scoring period's box score (ESPN's mBoxscore view for that period), reduced to what the records use:
 * per team its points that period and every rostered player as [id, name, position id, slot, points, projection,
 * injury status]. Stored once per period (src/seasonstep.js).
 */
export function compactWeek(doc, period, season) {
  const teams = [];
  for (const m of (doc && doc.schedule) || []) {
    for (const side of ['home', 'away']) {
      const s = m[side];
      if (!s || !s.rosterForCurrentScoringPeriod) continue;
      const other = m[side === 'home' ? 'away' : 'home'];
      const pts = s.pointsByScoringPeriod && s.pointsByScoringPeriod[period] != null ? s.pointsByScoringPeriod[period] : s.totalPoints;
      teams.push({
        team: s.teamId, opp: other ? other.teamId : 0, matchupId: m.id, matchupPeriod: m.matchupPeriodId, pts: Number(pts) || 0,
        players: (s.rosterForCurrentScoringPeriod.entries || []).map((e) => {
          const pl = (e.playerPoolEntry && e.playerPoolEntry.player) || {};
          return [pl.id || e.playerId || 0, pl.fullName || '', pl.defaultPositionId || 0, e.lineupSlotId,
            statOf(pl, 0, period, season), statOf(pl, 1, period, season), e.injuryStatus || pl.injuryStatus || 'ACTIVE'];
        }),
      });
    }
  }
  return { period, season, teams };
}

/** The best lineup a roster could have started: fixed slots first, then the flexible ones. */
export function bestLineup(roster, startSlots) {
  const pool = roster.filter((x) => x.pid).map((x) => ({ ...x }));
  const used = new Set();
  let total = 0;
  const take = (slot, n) => {
    for (let i = 0; i < n; i++) {
      const ok = pool.filter((x) => !used.has(x.pid) && (SLOT_POS[slot] || []).includes(x.posId))
        .sort((a, b) => b.pts - a.pts)[0];
      if (!ok) continue;
      used.add(ok.pid);
      total += ok.pts;
    }
  };
  for (const [s, n] of startSlots.filter(([s]) => (SLOT_POS[s] || []).length === 1)) take(s, n);
  for (const [s, n] of startSlots.filter(([s]) => (SLOT_POS[s] || []).length > 1)) take(s, n);
  return { total };
}

const ET_DAY = (() => {
  let f = null;
  try { f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }); } catch { f = null; }
  return (t) => (f ? f.format(new Date(t)) : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(t - 5 * 3600e3).getUTCDay()]);
})();

/**
 * One settled matchup's facts from its score timeline (rows [time ms, home, away, home win %], in order). Built
 * once when the week settles (src/seasonstep.js) and stored per week, about a hundred bytes a matchup; Monday is
 * judged in Eastern time (America/New_York, so daylight saving is followed).
 */
export function timelineFacts(s, winnerIsHome) {
  const sign = (r) => Math.sign(r[1] - r[2]);
  let changes = 0, prev = 0, maxHomeLead = 0, maxAwayLead = 0, minWinWp = 100, homeLeadMs = 0, awayLeadMs = 0, swing = 0;
  let trailed = false, decidedAt = null, garbH = 0, garbA = 0;
  for (let i = 0; i < s.length; i++) {
    const r = s[i];
    const sg = sign(r);
    if (sg !== 0) { if (prev !== 0 && sg !== prev) changes++; prev = sg; }
    maxHomeLead = Math.max(maxHomeLead, r[1] - r[2]); maxAwayLead = Math.max(maxAwayLead, r[2] - r[1]);
    const wwp = winnerIsHome ? r[3] : 100 - r[3];
    if (r[1] + r[2] > 0) minWinWp = Math.min(minWinWp, wwp);
    if (r[1] + r[2] > 0 && (winnerIsHome ? r[1] < r[2] : r[2] < r[1])) trailed = true;
    const next = s[i + 1];
    if (next && next[0] - r[0] <= 15 * 60e3) { if (sg > 0) homeLeadMs += next[0] - r[0]; if (sg < 0) awayLeadMs += next[0] - r[0]; }
    for (let j = i + 1; j < s.length && s[j][0] - r[0] <= 3600e3; j++) swing = Math.max(swing, Math.abs(s[j][3] - r[3]));
    if (decidedAt == null && wwp >= 99) decidedAt = i;
  }
  if (decidedAt != null) { const d = s[decidedAt], e = s[s.length - 1]; garbH = e[1] - d[1]; garbA = e[2] - d[2]; }
  let lastFlip = null;
  for (let i = s.length - 1; i >= 0; i--) { if (winnerIsHome ? s[i][1] <= s[i][2] : s[i][2] <= s[i][1]) { lastFlip = s[Math.min(i + 1, s.length - 1)][0]; break; } }
  let monH = 0, monA = 0;
  if (s.length && s.some((r) => ET_DAY(r[0]) === 'Mon')) {
    const startMon = [...s].reverse().find((r) => ET_DAY(r[0]) === 'Sun') || s[0];
    const end = s[s.length - 1];
    monH = end[1] - startMon[1]; monA = end[2] - startMon[2];
  }
  const r2 = (x) => Math.round(x * 100) / 100;
  return { changes, maxHomeLead: r2(maxHomeLead), maxAwayLead: r2(maxAwayLead), minWinWp, homeLeadMs, awayLeadMs, swing,
    wire: !trailed, garbH: r2(garbH), garbA: r2(garbA), monday: Boolean(lastFlip && ET_DAY(lastFlip) === 'Mon'), monH: r2(monH), monA: r2(monA) };
}

/** The week after which each team was out of the playoff race, from ESPN's eliminationMatchupPeriod (0: still in). */
export function eliminationsOf(teams) {
  const out = {};
  for (const t of teams) if (Number(t.eliminatedAt) > 0) out[t.id] = Number(t.eliminatedAt);
  return out;
}

/**
 * The model every period is computed from. `inp` is what src/seasonstep.js gathers from stored copies:
 *   season, regWeeks, playoffTeams, startSlots [[slot, n]],
 *   teams [{ id, name, logo, owner, playoffPct, eliminatedAt }],
 *   schedule [ESPN mMatchupScore fixtures], weeks { period: compactWeek(...) },
 *   players [{ pid, name, posId, onTeam, weekly { period: points } }], draft [ESPN picks],
 *   txs [{ id, period, type, status, team, items }], tl { matchupId: timelineFacts }, tlWeeks [matchup periods],
 *   past { year: [{ week, winner }] }, hof (league_history_digest), espnOdds ({ season, weeks }).
 */
export function buildSeasonModel(inp) {
  const season = Number(inp.season);
  const regWeeks = Number(inp.regWeeks) || 13;
  const playoffTeams = Number(inp.playoffTeams) || 4;
  const startSlots = inp.startSlots || [];
  const teams = {};
  for (const t of inp.teams || []) teams[t.id] = { ...t };
  const games = [];
  for (const m of inp.schedule || []) {
    if (!m.home || !m.away || !m.winner || m.winner === 'UNDECIDED') continue;
    if (!teams[m.home.teamId] || !teams[m.away.teamId]) continue;
    games.push({
      id: m.id, week: m.matchupPeriodId, post: m.matchupPeriodId > regWeeks, tier: m.playoffTierType || 'NONE',
      home: m.home.teamId, away: m.away.teamId, hp: Number(m.home.totalPoints) || 0, ap: Number(m.away.totalPoints) || 0,
      hpp: m.home.pointsByScoringPeriod || {}, app: m.away.pointsByScoringPeriod || {},
      winner: m.winner === 'HOME' ? m.home.teamId : m.winner === 'AWAY' ? m.away.teamId : 0,
    });
  }
  const settledWeeks = [...new Set(games.map((g) => g.week))].sort((a, b) => a - b);
  const teamWeeks = [];
  for (const [p, wk] of Object.entries(inp.weeks || {})) {
    const period = Number(p);
    for (const e of (wk && wk.teams) || []) {
      const g = games.find((x) => x.id === e.matchupId);
      if (!g) continue;
      const players = (e.players || []).map(([pid, name, posId, slot, pts, proj, inj]) => ({ pid, name, posId, pos: POS[posId] || '?', slot, pts, proj, inj }));
      teamWeeks.push({
        team: e.team, opp: e.opp, period, week: g.week, post: g.post, gameId: g.id, pts: e.pts,
        starters: players.filter((x) => x.slot !== 20 && x.slot !== 21),
        bench: players.filter((x) => x.slot === 20),
        ir: players.filter((x) => x.slot === 21),
      });
    }
  }
  for (const tw of teamWeeks) {
    tw.proj = tw.starters.reduce((a, x) => a + x.proj, 0);
    tw.benchPts = tw.bench.reduce((a, x) => a + x.pts, 0);
    tw.optimal = bestLineup([...tw.starters, ...tw.bench], startSlots).total;
    tw.empty = startSlots.reduce((a, [, n]) => a + n, 0) - tw.starters.filter((x) => x.pid).length;
  }
  const players = {};
  for (const p of inp.players || []) players[p.pid] = { pid: p.pid, name: p.name || '', pos: POS[p.posId] || '?', onTeam: p.onTeam || 0, weekly: p.weekly || {} };
  for (const tw of teamWeeks) for (const x of [...tw.starters, ...tw.bench, ...tw.ir]) {
    const p = players[x.pid];
    if (p && !p.name) p.name = x.name;
  }
  for (const p of Object.values(players)) if (!p.name && p.pos === 'D/ST') p.name = 'D/ST';
  const heldBy = {};
  for (const tw of teamWeeks) for (const x of [...tw.starters, ...tw.bench, ...tw.ir]) (heldBy[x.pid] = heldBy[x.pid] || {})[tw.period] = tw.team;
  const draft = (inp.draft || []).map((p) => ({ pid: p.playerId, team: p.teamId, round: p.roundId, pick: p.roundPickNumber, overall: p.overallPickNumber }));
  const rounds = draft.length ? Math.max(...draft.map((d) => d.round)) : 0;
  const seenTx = new Set();
  const txs = (inp.txs || []).filter((x) => (seenTx.has(x.id) ? false : (seenTx.add(x.id), true)));
  const oddsWeeks = (inp.espnOdds && Number(inp.espnOdds.season) === season && inp.espnOdds.weeks) || {};
  const espnOddsAfter = (week, id) => { const w = oddsWeeks[String(week)]; return w && typeof w[id] === 'number' ? w[id] : null; };
  return {
    season, regWeeks, playoffTeams, startSlots, teams, games, settledWeeks, teamWeeks, players, heldBy, draft, rounds, txs,
    tl: inp.tl || {}, tlWeeks: new Set((inp.tlWeeks || []).map(Number)), past: inp.past || {}, hof: inp.hof || null,
    espnOddsAfter, elimAfter: eliminationsOf(inp.teams || []),
  };
}

const sum = (a) => a.reduce((x, y) => x + y, 0);
const mean = (a) => (a.length ? sum(a) / a.length : 0);
const sd = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(mean(a.map((x) => (x - m) ** 2))) : 0; };
const median = (a) => { const s = [...a].sort((x, y) => x - y); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; };
const r2 = (x) => Math.round(x * 100 + 1e-9) / 100;
const recText = (w, l, t) => `${w}-${l}${t ? `-${t}` : ''}`;
const share = (w, l, t) => (w + l + t ? (w + 0.5 * t) / (w + l + t) : 0);

export const SECTIONS = [
  ['standings', 'Standings'], ['scoring', 'Scoring'], ['lineups', 'Lineups and projections'], ['games', 'Games'],
  ['players', 'Players'], ['moves', 'Moves, trades and the draft'], ['history', 'History and pace'], ['fun', 'Fun'],
  ['holders', 'Record Holders'],
];

/* Which way a record counts in Record Holders: +1 to a team that holds a good one, -1 for a bad one, nothing for a
   record that is neither (closest game, most moves). Ids not listed count nothing. A player record counts for the
   fantasy team named on it; a free agent counts for nobody. */
const GOOD = ['S1a.most', 'S30.fewest', 'S2.best', 'S139.best', 'S3.best', 'S1b.best', 'S19', 'S4.best', 'S6',
  'S21.high', 'S22.best', 'S23', 'S25', 'S31.best', 'S32.boom', 'S35.*', 'S39',
  'S42.best', 'S53', 'S43', 'S44', 'S46', 'S49.over', 'S50.beat',
  'S59', 'S60', 'S11.win', 'S8.wins', 'S62', 'S64.most', 'S65',
  'S70', 'S71', 'S75', 'S78', 'S70.*', 'S72.*', 'S74', 'S76', 'S77', 'S80',
  'S95.best', 'S94.pickups', 'S94.drafted', 'S96', 'S110', 'S129', 'S123', 'S130'];
const BAD = ['S1a.fewest', 'S30.most', 'S2.worst', 'S139.worst', 'S3.worst', 'S1b.worst', 'S4.worst',
  'S21.low', 'S22.worst', 'S24', 'S31.worst', 'S32.bust', 'S40',
  'S41.most', 'S42.worst', 'S47', 'S45', 'S48', 'S49.under', 'S50.miss', 'S54', 'S55',
  'S11.loss', 'S8.losses', 'S64.least', 'S79', 'S82', 'S84', 'S86', 'S95.worst', 'S121', 'S122', 'S128'];
const matches = (list, id) => list.some((x) => (x.endsWith('.*') ? id.startsWith(x.slice(0, -1)) : id === x));
export const toneOf = (id) => (matches(GOOD, id) ? 1 : matches(BAD, id) ? -1 : 0);
const COUNT_UNITS = new Set(['n', 'wks', 'teams']);
/** The teams holding a record: every entry level with the first, none when the record is empty or a count at zero. */
export function holdersOf(rec) {
  if (rec.empty || !rec.entries.length) return [];
  const top = rec.entries[0].value;
  // A count still at zero holds nothing (no team has the most of something yet), unless fewest is the point.
  if (COUNT_UNITS.has(rec.unit) && top === 0 && rec.better !== 'low') return [];
  return rec.entries.filter((e) => e.value === top);
}

/** The views the period selector offers, in order. */
export function periods(model) {
  const reg = model.settledWeeks.filter((w) => w <= model.regWeeks);
  const post = model.settledWeeks.filter((w) => w > model.regWeeks);
  const out = [{ key: 'whole', label: 'Whole season', weeks: model.settledWeeks, live: true, txTo: Infinity }];
  out.push({ key: 'regular', label: 'Regular season', weeks: reg, live: !post.length, txTo: Infinity });
  if (post.length) out.push({ key: 'post', label: 'Postseason', weeks: post, live: true, txTo: Infinity });
  const rounds = Math.ceil(Math.log2(Math.max(2, model.playoffTeams)));
  for (const w of model.settledWeeks) {
    const k = w - model.regWeeks;
    const label = k <= 0 ? `After week ${w}` : k === rounds ? 'After the final' : `After postseason round ${k}`;
    out.push({ key: `w${w}`, label, weeks: model.settledWeeks.filter((x) => x <= w), live: false, txTo: w });
  }
  return out;
}

export function compute(model, view) {
  const ids = Object.keys(model.teams).map(Number);
  const inWeeks = new Set(view.weeks);
  const games = model.games.filter((g) => inWeeks.has(g.week));
  const tws = model.teamWeeks.filter((t) => inWeeks.has(t.week));
  const lastPeriod = Math.max(0, ...tws.map((t) => t.period));
  const txs = model.txs.filter((x) => x.period <= view.txTo);
  const weeksN = new Set(tws.map((t) => t.period)).size;
  const R = [];
  const add = (rec) => R.push(rec);

  // ------------------------------------------------------------- per-team season lines
  const line = Object.fromEntries(ids.map((id) => [id, {
    w: 0, l: 0, t: 0, pf: 0, pa: 0, g: 0, res: [], ap: [0, 0, 0], md: [0, 0, 0], top: [0, 0, 0], scores: [],
  }]));
  for (const g of [...games].sort((a, b) => a.week - b.week)) {
    for (const [me, op, mp, opp] of [[g.home, g.away, g.hp, g.ap], [g.away, g.home, g.ap, g.hp]]) {
      const L = line[me];
      L.g++; L.pf += mp; L.pa += opp;
      const r = g.winner === 0 ? 'T' : g.winner === me ? 'W' : 'L';
      if (r === 'W') L.w++; else if (r === 'L') L.l++; else L.t++;
      L.res.push({ week: g.week, r, margin: mp - opp, mp, opp, op, gameId: g.id });
    }
  }
  const byPeriod = {};
  for (const tw of tws) (byPeriod[tw.period] = byPeriod[tw.period] || []).push(tw);
  for (const [p, list] of Object.entries(byPeriod)) {
    const med = median(list.map((x) => x.pts));
    for (const tw of list) {
      const L = line[tw.team];
      L.scores.push({ period: Number(p), pts: tw.pts });
      for (const o of list) {
        if (o.team === tw.team) continue;
        L.ap[tw.pts > o.pts ? 0 : tw.pts < o.pts ? 1 : 2]++;
      }
      L.md[tw.pts > med ? 0 : tw.pts < med ? 1 : 2]++;
    }
  }
  /* A meeting is one scoring period of a matchup. A two-week postseason matchup is two meetings, each won by
     whoever scored more that week (Hall of Fame's rule for its game records): every record
     made of a game's points or margin reads meetings; results (record, streaks, seed) count the matchup once. */
  const meetings = [];
  for (const g of games) {
    const ps = Object.keys(g.hpp || {}).map(Number).filter((p) => byPeriod[p]);
    if (ps.length > 1) {
      for (const p of ps.sort((a, b) => a - b)) {
        const hp = g.hpp[p], ap = g.app[p];
        meetings.push({ id: g.id, period: p, week: p, two: true, home: g.home, away: g.away, hp, ap, winner: hp > ap ? g.home : ap > hp ? g.away : 0 });
      }
    } else {
      const p = ps[0] || g.week;
      meetings.push({ id: g.id, period: p, week: p, two: false, home: g.home, away: g.away, hp: g.hp, ap: g.ap, winner: g.winner });
    }
  }
  const mres = Object.fromEntries(ids.map((id) => [id, []]));
  for (const m of meetings) {
    for (const [me, op, mp, opp] of [[m.home, m.away, m.hp, m.ap], [m.away, m.home, m.ap, m.hp]]) {
      mres[me].push({ period: m.period, r: m.winner === 0 ? 'T' : m.winner === me ? 'W' : 'L', margin: mp - opp, op });
    }
  }
  // Seed: win share, then points for (the league's tiebreak), over the regular season. Once the regular season is
  // over, a view that includes the postseason keeps the final regular-season seed (as the home page does).
  const rankBy = (lines) => [...ids].sort((a, b) => share(lines[b].w, lines[b].l, lines[b].t) - share(lines[a].w, lines[a].l, lines[a].t) || lines[b].pf - lines[a].pf);
  let order = rankBy(line);
  const regDone = model.settledWeeks.includes(model.regWeeks);
  if (games.some((g) => g.post) && regDone) {
    const regLine = Object.fromEntries(ids.map((id) => [id, { w: 0, l: 0, t: 0, pf: 0 }]));
    for (const g of model.games.filter((x) => !x.post)) {
      for (const [me, mp] of [[g.home, g.hp], [g.away, g.ap]]) {
        const L = regLine[me]; L.pf += mp;
        if (g.winner === 0) L.t++; else if (g.winner === me) L.w++; else L.l++;
      }
    }
    order = rankBy(regLine);
  }
  const seed = Object.fromEntries(order.map((id, i) => [id, i + 1]));
  const topHalf = new Set(order.slice(0, Math.floor(ids.length / 2)));
  for (const id of ids) {
    for (const r of line[id].res) if (topHalf.has(r.op)) line[id].top[r.r === 'W' ? 0 : r.r === 'L' ? 1 : 2]++;
  }
  const lastThree = [...new Set(tws.map((t) => t.period))].sort((a, b) => a - b).slice(-3);
  const apShare = (id, periodsSet) => {
    let w = 0, l = 0, t = 0;
    for (const p of periodsSet) {
      const list = byPeriod[p] || [];
      const me = list.find((x) => x.team === id);
      if (!me) continue;
      for (const o of list) { if (o.team === id) continue; if (me.pts > o.pts) w++; else if (me.pts < o.pts) l++; else t++; }
    }
    return share(w, l, t);
  };
  // After the regular season every team is in or out: its final seed decides, as on the home page.
  const viewRegDone = view.weeks.includes(model.regWeeks) || view.weeks.some((w) => w > model.regWeeks);
  const standings = ids.map((id) => {
    const L = line[id];
    const apS = share(...L.ap);
    const luck = L.w + 0.5 * L.t - apS * L.g;
    const power = 100 * (0.5 * apS + 0.25 * share(L.w, L.l, L.t) + 0.25 * apShare(id, lastThree));
    const res = [...L.res].sort((a, b) => b.week - a.week);
    let streak = null;
    if (res.length) { let n = 0; for (const r of res) { if (r.r === res[0].r) n++; else break; } streak = { type: res[0].r, n }; }
    return {
      team: id, seed: seed[id], w: L.w, l: L.l, t: L.t, winPct: share(L.w, L.l, L.t), pf: L.pf, pa: L.pa,
      diff: L.pf - L.pa, ppg: L.scores.length ? L.pf / L.scores.length : 0, /* per scoring week: a two-week matchup is two weeks of points */ streak, allPlay: { w: L.ap[0], l: L.ap[1], t: L.ap[2], share: apS },
      luck, power, playoffPct: viewRegDone ? (seed[id] <= model.playoffTeams ? 1 : 0) : /^w\d+$/.test(view.key) ? model.espnOddsAfter(Number(view.key.slice(1)), id) : model.teams[id].playoffPct,
    };
  }).sort((a, b) => a.seed - b.seed);
  const powerRank = Object.fromEntries([...standings].sort((a, b) => b.power - a.power).map((s, i) => [s.team, i + 1]));
  for (const s of standings) s.powerRank = powerRank[s.team];
  const st = Object.fromEntries(standings.map((s) => [s.team, s]));

  // ------------------------------------------------------------- builders
  const teamRec = (o, valueOf, textOf) => {
    const entries = ids.map((id) => ({ teams: [id], value: valueOf(id), text: textOf ? textOf(id) : undefined }))
      .filter((e) => e.value != null && !Number.isNaN(e.value));
    entries.sort((a, b) => (o.better === 'low' ? a.value - b.value : b.value - a.value));
    add({ kind: 'team', ...o, entries });
  };
  const listRec = (o, entries) => {
    entries.sort((a, b) => (o.better === 'low' ? a.value - b.value : b.value - a.value));
    add({ kind: o.kind || 'teamweek', ...o, entries: entries.slice(0, 10) });
  };
  const pair = (id, base) => [{ ...base, id: `${id}.best` }, { ...base, id: `${id}.worst` }];

  // ============================================================= 1. Standings
  const sec = 'standings';
  teamRec({ id: 'S1a.most', sec, title: 'Most points for', unit: 'pts', headline: true, info: 'Total points scored in every game of the period.' }, (id) => line[id].pf);
  teamRec({ id: 'S1a.fewest', sec, title: 'Fewest points for', unit: 'pts', better: 'low', info: 'Total points scored in every game of the period.' }, (id) => line[id].pf);
  teamRec({ id: 'S30.most', sec, title: 'Most points against', unit: 'pts', headline: true, info: 'Total points scored against the team.' }, (id) => line[id].pa);
  teamRec({ id: 'S30.fewest', sec, title: 'Fewest points against', unit: 'pts', better: 'low', info: 'Total points scored against the team.' }, (id) => line[id].pa);
  teamRec({ id: 'S2.best', sec, title: 'Best all-play record', unit: 'rec', headline: true, info: 'The record a team would have if it had played every other team every week.' }, (id) => st[id].allPlay.share, (id) => recText(st[id].allPlay.w, st[id].allPlay.l, st[id].allPlay.t));
  teamRec({ id: 'S2.worst', sec, title: 'Worst all-play record', unit: 'rec', better: 'low', info: 'The record a team would have if it had played every other team every week.' }, (id) => st[id].allPlay.share, (id) => recText(st[id].allPlay.w, st[id].allPlay.l, st[id].allPlay.t));
  teamRec({ id: 'S139.best', sec, title: 'Highest win percentage', unit: 'pct', headline: true, info: 'Share of games won; a tie counts as half a win.' }, (id) => st[id].winPct);
  teamRec({ id: 'S139.worst', sec, title: 'Lowest win percentage', unit: 'pct', better: 'low', info: 'Share of games won; a tie counts as half a win.' }, (id) => st[id].winPct);
  teamRec({ id: 'S3.best', sec, title: 'Luckiest team', unit: 'diff1', info: 'Actual wins minus the wins its scores earned against the whole league (all-play win share × games played).' }, (id) => st[id].luck);
  teamRec({ id: 'S3.worst', sec, title: 'Unluckiest team', unit: 'diff1', better: 'low', info: 'Actual wins minus the wins its scores earned against the whole league.' }, (id) => st[id].luck);
  teamRec({ id: 'S1b.best', sec, title: 'Best point differential', unit: 'diff', info: 'Points for minus points against.' }, (id) => st[id].diff);
  teamRec({ id: 'S1b.worst', sec, title: 'Worst point differential', unit: 'diff', better: 'low', info: 'Points for minus points against.' }, (id) => st[id].diff);
  teamRec({ id: 'S19', sec, title: 'Top of the power ranking', unit: 'power', info: 'Power score: 50% season all-play win share, 25% win share and 25% all-play win share over the last three weeks, × 100.' }, (id) => st[id].power);
  teamRec({ id: 'S4.best', sec, title: 'Best record against the weekly median', unit: 'rec', info: 'A win for every week above the league\'s median score, a loss for every week below.' }, (id) => share(...line[id].md), (id) => recText(...line[id].md));
  teamRec({ id: 'S4.worst', sec, title: 'Worst record against the weekly median', unit: 'rec', better: 'low', info: 'A win for every week above the league\'s median score, a loss for every week below.' }, (id) => share(...line[id].md), (id) => recText(...line[id].md));
  teamRec({ id: 'S6', sec, title: 'Best record against the top half', unit: 'rec', info: 'Record in games against the teams currently in the top half of the standings.' },
    (id) => (sum(line[id].top) ? share(...line[id].top) : null), (id) => recText(...line[id].top));

  // ============================================================= 2. Scoring
  const sc = 'scoring';
  const twEntries = (valueOf, filter) => tws.filter(filter || (() => true)).map((tw) => ({ teams: [tw.team], value: valueOf(tw), week: tw.period }));
  listRec({ id: 'S21.high', sec: sc, title: 'Highest weekly score', unit: 'pts', headline: true, live: true, info: 'The most points one team scored in a single week.' }, twEntries((t) => t.pts));
  listRec({ id: 'S21.low', sec: sc, title: 'Lowest weekly score', unit: 'pts', better: 'low', info: 'The fewest points one team scored in a single week.' }, twEntries((t) => t.pts));
  // A matchup's entry names the winner first (the page outlines it green, the loser red); a tie names both teams as
  // holders and neither as the winner.
  const matchEntries = (valueOf, filter) => meetings.filter(filter || (() => true))
    .map((g) => ({ vs: g.winner ? [g.winner, g.winner === g.home ? g.away : g.home] : [g.home, g.away], teams: g.winner ? [g.winner] : [g.home, g.away], value: valueOf(g), week: g.week }));
  listRec({ id: 'S26', kind: 'match', sec: sc, title: 'Highest combined matchup score', unit: 'pts', headline: true, live: true, info: 'Both teams\' points added together in one matchup.' }, matchEntries((g) => g.hp + g.ap));
  listRec({ id: 'S28', sec: sc, title: 'Highest score in a loss', unit: 'pts', headline: true, info: 'The most points scored by a team that still lost.' },
    meetings.filter((g) => g.winner).map((g) => { const loser = g.winner === g.home ? g.away : g.home; return { teams: [loser], value: loser === g.home ? g.hp : g.ap, week: g.week }; }));
  listRec({ id: 'S29', sec: sc, title: 'Lowest score in a win', unit: 'pts', better: 'low', headline: true, info: 'The fewest points scored by a team that still won.' },
    meetings.filter((g) => g.winner).map((g) => ({ teams: [g.winner], value: g.winner === g.home ? g.hp : g.ap, week: g.week })));
  listRec({ id: 'S27', kind: 'match', sec: sc, title: 'Lowest combined matchup score', unit: 'pts', better: 'low', info: 'Both teams\' points added together in one matchup.' }, matchEntries((g) => g.hp + g.ap));
  const sds = Object.fromEntries(ids.map((id) => [id, sd(line[id].scores.map((s) => s.pts))]));
  teamRec({ id: 'S22.best', sec: sc, title: 'Most consistent scorer', unit: 'pts', better: 'low', info: 'The smallest spread (standard deviation) of weekly scores.' }, (id) => sds[id]);
  teamRec({ id: 'S22.worst', sec: sc, title: 'Least consistent scorer', unit: 'pts', info: 'The largest spread (standard deviation) of weekly scores.' }, (id) => sds[id]);
  const topCount = Object.fromEntries(ids.map((id) => [id, 0])), botCount = { ...topCount }, aboveAvg = { ...topCount };
  for (const list of Object.values(byPeriod)) {
    const mx = Math.max(...list.map((x) => x.pts)), mn = Math.min(...list.map((x) => x.pts)), av = mean(list.map((x) => x.pts));
    for (const tw of list) { if (tw.pts === mx) topCount[tw.team]++; if (tw.pts === mn) botCount[tw.team]++; if (tw.pts > av) aboveAvg[tw.team]++; }
  }
  teamRec({ id: 'S23', sec: sc, title: 'Most weeks as the week\'s top scorer', unit: 'n', info: 'Weeks in which the team scored more than anyone else.' }, (id) => topCount[id]);
  teamRec({ id: 'S24', sec: sc, title: 'Most weeks as the week\'s lowest scorer', unit: 'n', info: 'Weeks in which the team scored less than anyone else.' }, (id) => botCount[id]);
  teamRec({ id: 'S25', sec: sc, title: 'Most weeks above the league average', unit: 'n', info: 'Weeks in which the team beat the league\'s average score.' }, (id) => aboveAvg[id]);
  const stretch = [];
  for (const id of ids) {
    const s = [...line[id].scores].sort((a, b) => a.period - b.period);
    for (let i = 0; i + 2 < s.length; i++) stretch.push({ teams: [id], value: s[i].pts + s[i + 1].pts + s[i + 2].pts, span: [s[i].period, s[i + 2].period] });
  }
  listRec({ id: 'S31.best', sec: sc, title: 'Best three-week stretch', unit: 'pts', info: 'The most points over three weeks in a row.' }, stretch.map((x) => ({ ...x })));
  listRec({ id: 'S31.worst', sec: sc, title: 'Worst three-week stretch', unit: 'pts', better: 'low', info: 'The fewest points over three weeks in a row.' }, stretch.map((x) => ({ ...x })));
  const boom = {}, bust = {};
  for (const id of ids) {
    const p = line[id].scores.map((s) => s.pts), m = mean(p), d = sd(p);
    boom[id] = p.filter((x) => x > m + d).length; bust[id] = p.filter((x) => x < m - d).length;
  }
  teamRec({ id: 'S32.boom', sec: sc, title: 'Most boom weeks', unit: 'n', info: 'Weeks more than one standard deviation above the team\'s own average.' }, (id) => boom[id]);
  teamRec({ id: 'S32.bust', sec: sc, title: 'Most bust weeks', unit: 'n', info: 'Weeks more than one standard deviation below the team\'s own average.' }, (id) => bust[id]);
  for (const [slot, label] of [[0, 'QBs'], [2, 'RBs'], [4, 'WRs'], [6, 'TEs'], [23, 'the FLEX'], [16, 'D/ST'], [17, 'kickers']]) {
    const v = Object.fromEntries(ids.map((id) => [id, 0]));
    for (const tw of tws) for (const x of tw.starters) if (x.slot === slot) v[tw.team] += x.pts;
    teamRec({ id: `S35.${slot}`, sec: sc, title: `Most points from ${label}`, unit: 'pts', info: `Points scored by the players started at ${label === 'the FLEX' ? 'FLEX' : label}.` }, (id) => v[id]);
  }
  // Monday-night points, from each week's stored timeline facts (Eastern time).
  const monday = Object.fromEntries(ids.map((id) => [id, 0]));
  const tlGames = games.filter((g) => model.tl[g.id]);
  for (const g of tlGames) { const f = model.tl[g.id]; monday[g.home] += f.monH; monday[g.away] += f.monA; }
  teamRec({ id: 'S39', sec: sc, title: 'Most Monday-night points', unit: 'pts', info: 'Points scored during Monday\'s games, read from the score timeline.' }, (id) => monday[id]);
  const zero = Object.fromEntries(ids.map((id) => [id, 0]));
  for (const tw of tws) for (const x of tw.starters) if (x.pid && x.pts <= 0) zero[tw.team]++;
  teamRec({ id: 'S40', sec: sc, title: 'Most zero-or-negative starters', unit: 'n', info: 'Starters who scored 0 or fewer points.' }, (id) => zero[id]);

  // ============================================================= 3. Lineups and projections
  const lu = 'lineups';
  const tsum = (f) => Object.fromEntries(ids.map((id) => [id, sum(tws.filter((t) => t.team === id).map(f))]));
  const bench = tsum((t) => t.benchPts), opt = tsum((t) => t.optimal), act = tsum((t) => t.pts), proj = tsum((t) => t.proj);
  teamRec({ id: 'S41.most', sec: lu, title: 'Most bench points', unit: 'pts', headline: true, info: 'Points scored by players left on the bench.' }, (id) => bench[id]);
  teamRec({ id: 'S41.fewest', sec: lu, title: 'Fewest bench points', unit: 'pts', better: 'low', info: 'Points scored by players left on the bench.' }, (id) => bench[id]);
  teamRec({ id: 'S42.best', sec: lu, title: 'Best optimal-lineup %', unit: 'pct', headline: true, info: 'Points scored as a share of the most the roster could have scored.' }, (id) => (opt[id] ? act[id] / opt[id] : null));
  teamRec({ id: 'S42.worst', sec: lu, title: 'Worst optimal-lineup %', unit: 'pct', better: 'low', info: 'Points scored as a share of the most the roster could have scored.' }, (id) => (opt[id] ? act[id] / opt[id] : null));
  listRec({ id: 'S47', sec: lu, title: 'Biggest bench blunder', unit: 'pts', headline: true, info: 'The most points one team left on the table in a single week: its best possible lineup minus what it started.' }, twEntries((t) => t.optimal - t.pts));
  const projOf = Object.fromEntries(tws.map((t) => [`${t.period}:${t.team}`, t.proj]));
  listRec({ id: 'S53', kind: 'match', sec: lu, title: 'Biggest upset by projection', unit: 'pts', headline: true, info: 'The largest projected margin overturned: how far ESPN\'s projections had the winner behind.' },
    meetings.filter((g) => g.winner).map((g) => {
      const loser = g.winner === g.home ? g.away : g.home;
      return { vs: [g.winner, loser], teams: [g.winner], value: (projOf[`${g.period}:${loser}`] || 0) - (projOf[`${g.period}:${g.winner}`] || 0), week: g.week };
    }).filter((e) => e.value > 0));
  teamRec({ id: 'S43', sec: lu, title: 'Highest points possible', unit: 'pts', info: 'Total points had the team started its best lineup every week.' }, (id) => opt[id]);
  teamRec({ id: 'S44', sec: lu, title: 'Most perfect-lineup weeks', unit: 'n', info: 'Weeks in which the team started its best possible lineup.' }, (id) => tws.filter((t) => t.team === id && t.optimal - t.pts < 0.005).length);
  const benchLoss = Object.fromEntries(ids.map((id) => [id, 0])), gifted = { ...benchLoss };
  for (const g of meetings) {
    if (!g.winner) continue;
    const loser = g.winner === g.home ? g.away : g.home;
    const lw = tws.find((t) => t.period === g.period && t.team === loser), ww = tws.find((t) => t.period === g.period && t.team === g.winner);
    if (lw && ww && lw.optimal > ww.pts) { benchLoss[loser]++; gifted[g.winner]++; }
  }
  teamRec({ id: 'S45', sec: lu, title: 'Most losses the bench could have won', unit: 'n', info: 'Losses in which the team\'s best possible lineup would have outscored the opponent.' }, (id) => benchLoss[id]);
  teamRec({ id: 'S46', sec: lu, title: 'Most wins handed over by the opponent\'s bench', unit: 'n', info: 'Wins in which the opponent\'s best possible lineup would have won.' }, (id) => gifted[id]);
  const benchWeeks = [];
  for (const tw of tws) for (const x of tw.bench) benchWeeks.push({ kind: 'player', player: { name: x.name, pos: x.pos }, team: tw.team, teams: [tw.team], value: x.pts, week: tw.period });
  listRec({ id: 'S48', kind: 'player', sec: lu, title: 'Best bench week by a player', unit: 'pts', info: 'The most points scored by a player sitting on a bench.' }, benchWeeks);
  teamRec({ id: 'S49.over', sec: lu, title: 'Most points over projection', unit: 'diff', info: 'Season points minus ESPN\'s projections for the players started.' }, (id) => act[id] - proj[id]);
  teamRec({ id: 'S49.under', sec: lu, title: 'Most points under projection', unit: 'diff', better: 'low', info: 'Season points minus ESPN\'s projections for the players started.' }, (id) => act[id] - proj[id]);
  listRec({ id: 'S50.beat', sec: lu, title: 'Biggest beat of projection in a week', unit: 'diff', info: 'Points scored minus ESPN\'s projection, one team in one week.' }, twEntries((t) => t.pts - t.proj));
  listRec({ id: 'S50.miss', sec: lu, title: 'Biggest miss of projection in a week', unit: 'diff', better: 'low', info: 'Points scored minus ESPN\'s projection, one team in one week.' }, twEntries((t) => t.pts - t.proj));
  const mae = Object.fromEntries(ids.map((id) => [id, mean(tws.filter((t) => t.team === id).map((t) => Math.abs(t.pts - t.proj)))]));
  teamRec({ id: 'S51.best', sec: lu, title: 'Most accurate projections', unit: 'pts', better: 'low', info: 'Average distance between the team\'s score and ESPN\'s projection.' }, (id) => mae[id]);
  teamRec({ id: 'S51.worst', sec: lu, title: 'Least accurate projections', unit: 'pts', info: 'Average distance between the team\'s score and ESPN\'s projection.' }, (id) => mae[id]);
  const INJ = new Set(['OUT', 'INJURY_RESERVE', 'SUSPENSION', 'DOUBTFUL']);
  teamRec({ id: 'S54', sec: lu, title: 'Most starts lost to injury', unit: 'n', info: 'Starters listed out, doubtful, suspended or on injured reserve who scored nothing.' },
    (id) => sum(tws.filter((t) => t.team === id).map((t) => t.starters.filter((x) => x.pid && INJ.has(x.inj) && x.pts === 0).length)));
  teamRec({ id: 'S55', sec: lu, title: 'Most empty starting slots', unit: 'n', info: 'Starting slots left with nobody in them.' }, (id) => sum(tws.filter((t) => t.team === id).map((t) => Math.max(0, t.empty))));
  const used = Object.fromEntries(ids.map((id) => [id, new Set(tws.filter((t) => t.team === id).flatMap((t) => t.starters.map((x) => x.pid)).filter(Boolean)).size]));
  teamRec({ id: 'S56.most', sec: lu, title: 'Most players used', unit: 'n', info: 'Different players started.' }, (id) => used[id]);
  teamRec({ id: 'S56.fewest', sec: lu, title: 'Fewest players used', unit: 'n', better: 'low', info: 'Different players started.' }, (id) => used[id]);
  const same = Object.fromEntries(ids.map((id) => [id, 0]));
  for (const id of ids) {
    const s = tws.filter((t) => t.team === id).sort((a, b) => a.period - b.period);
    for (let i = 1; i < s.length; i++) {
      const a = s[i - 1].starters.map((x) => x.pid).sort().join(), b = s[i].starters.map((x) => x.pid).sort().join();
      if (a === b) same[id]++;
    }
  }
  teamRec({ id: 'S57', sec: lu, title: 'Most weeks with an unchanged lineup', unit: 'n', info: 'Weeks the team started exactly the same players as the week before.' }, (id) => same[id]);

  // ============================================================= 4. Games
  const gm = 'games';
  const decided = games.filter((g) => g.winner);
  const decidedM = meetings.filter((g) => g.winner);
  const margin = (g) => Math.abs(g.hp - g.ap);
  listRec({ id: 'S59', kind: 'match', sec: gm, title: 'Biggest blowout', unit: 'pts', headline: true, info: 'The largest winning margin in a week. A two-week postseason matchup counts each week on its own.' },
    decidedM.map((g) => ({ vs: [g.winner, g.winner === g.home ? g.away : g.home], teams: [g.winner], value: margin(g), week: g.week })));
  listRec({ id: 'S58', kind: 'match', sec: gm, title: 'Closest game', unit: 'pts', better: 'low', headline: true, info: 'The smallest winning margin in a week. A two-week postseason matchup counts each week on its own.' },
    decidedM.map((g) => ({ vs: [g.winner, g.winner === g.home ? g.away : g.home], teams: [g.winner], value: margin(g), week: g.week })));
  // Timeline facts per matchup, as stored when each week settled (timelineFacts above).
  const tl = {};
  for (const g of tlGames) tl[g.id] = model.tl[g.id];
  const tlMatch = (valueOf) => decided.filter((g) => tl[g.id]).map((g) => ({ vs: [g.winner, g.winner === g.home ? g.away : g.home], teams: [g.winner], value: valueOf(g, tl[g.id]), week: g.week }));
  listRec({ id: 'S60', kind: 'match', sec: gm, title: 'Biggest comeback', unit: 'pts', headline: true, timeline: true, info: 'The largest deficit a winner came back from, read from the score timeline.' },
    tlMatch((g, f) => (g.winner === g.home ? f.maxAwayLead : f.maxHomeLead)).filter((e) => e.value > 0));
  const streaks = (want) => ids.map((id) => {
    const r = [...line[id].res].sort((a, b) => a.week - b.week);
    let best = 0, from = null, to = null, n = 0, start = null;
    for (const x of r) { if (x.r === want) { if (!n) start = x.week; n++; if (n > best) { best = n; from = start; to = x.week; } } else n = 0; }
    return { teams: [id], value: best, span: best ? [from, to] : null };
  });
  listRec({ id: 'S11.win', kind: 'team', sec: gm, title: 'Longest win streak', unit: 'n', headline: true, info: 'The most wins in a row.' }, streaks('W'));
  listRec({ id: 'S11.loss', kind: 'team', sec: gm, title: 'Longest losing streak', unit: 'n', info: 'The most losses in a row.' }, streaks('L'));
  teamRec({ id: 'S8.wins', sec: gm, title: 'Most blowout wins', unit: 'n', info: 'Wins by more than 30 points.' }, (id) => mres[id].filter((x) => x.r === 'W' && x.margin > 30).length);
  teamRec({ id: 'S8.losses', sec: gm, title: 'Most blowout losses', unit: 'n', info: 'Losses by more than 30 points.' }, (id) => mres[id].filter((x) => x.r === 'L' && -x.margin > 30).length);
  listRec({ id: 'S62', kind: 'match', sec: gm, title: 'Unlikeliest win', unit: 'wp', better: 'low', timeline: true, info: 'The lowest win chance a winner came back from, from ESPN\'s live win probability.' }, tlMatch((g, f) => f.minWinWp));
  listRec({ id: 'S63', kind: 'match', sec: gm, title: 'Most lead changes in a game', unit: 'n', live: true, timeline: true, info: 'Times the lead changed hands in one matchup.' }, tlMatch((g, f) => f.changes));
  const leadMs = Object.fromEntries(ids.map((id) => [id, 0])), gameMs = { ...leadMs }, wire = { ...leadMs }, garb = { ...leadMs }, mon = { ...leadMs };
  for (const g of decided.filter((x) => tl[x.id])) {
    const f = tl[g.id];
    leadMs[g.home] += f.homeLeadMs; leadMs[g.away] += f.awayLeadMs;
    gameMs[g.home] += f.homeLeadMs + f.awayLeadMs; gameMs[g.away] += f.homeLeadMs + f.awayLeadMs;
    if (f.wire) wire[g.winner]++;
    garb[g.home] += f.garbH; garb[g.away] += f.garbA;
    if (f.monday) mon[g.winner]++;
  }
  teamRec({ id: 'S64.most', sec: gm, title: 'Most time spent leading', unit: 'pct', timeline: true, info: 'Share of game time the team was ahead, read from the score timeline.' }, (id) => (gameMs[id] ? leadMs[id] / gameMs[id] : null));
  teamRec({ id: 'S64.least', sec: gm, title: 'Least time spent leading', unit: 'pct', better: 'low', timeline: true, info: 'Share of game time the team was ahead, read from the score timeline.' }, (id) => (gameMs[id] ? leadMs[id] / gameMs[id] : null));
  teamRec({ id: 'S65', sec: gm, title: 'Most wire-to-wire wins', unit: 'n', timeline: true, info: 'Wins in which the team never trailed once scoring began.' }, (id) => wire[id]);
  listRec({ id: 'S66', kind: 'match', sec: gm, title: 'Biggest win-chance swing in an hour', unit: 'wp', live: true, timeline: true, info: 'The largest change in ESPN\'s win probability within one hour.' }, tlMatch((g, f) => f.swing));
  teamRec({ id: 'S67', sec: gm, title: 'Most wins settled on Monday night', unit: 'n', timeline: true, info: 'Wins in which the team took the lead for good during Monday\'s games.' }, (id) => mon[id]);
  const kick = Object.fromEntries(ids.map((id) => [id, 0]));
  for (const g of decidedM) {
    const loser = g.winner === g.home ? g.away : g.home;
    const kp = (team) => sum(tws.filter((t) => t.period === g.period && t.team === team).flatMap((t) => t.starters.filter((x) => x.slot === 17).map((x) => x.pts)));
    if (kp(g.winner) - kp(loser) > margin(g)) kick[g.winner]++;
  }
  teamRec({ id: 'S68', sec: gm, title: 'Most wins decided by the kickers', unit: 'n', info: 'Wins in which the kickers\' difference was bigger than the final margin.' }, (id) => kick[id]);

  // ============================================================= 5. Players
  const pl = 'players';
  const inPeriods = new Set(tws.map((t) => t.period));
  const heldIn = (pid, p) => (model.heldBy[pid] || {})[p] || 0;
  const labelTeam = (pid) => heldIn(pid, lastPeriod) || 0;
  const seasonPts = (p) => sum(Object.entries(p.weekly).filter(([w]) => inPeriods.has(Number(w))).map(([, v]) => v));
  const P = Object.values(model.players);
  const playerTotals = P.map((p) => ({ kind: 'player', player: { name: p.name, pos: p.pos }, pid: p.pid, team: labelTeam(p.pid), teams: labelTeam(p.pid) ? [labelTeam(p.pid)] : [], value: seasonPts(p) }));
  listRec({ id: 'S70', kind: 'player', sec: pl, title: 'Top scorer', unit: 'pts', headline: true, live: true, info: 'The most points scored this season by any player, free agents included.' }, playerTotals.map((x) => ({ ...x })));
  const playerWeeks = [];
  for (const p of P) for (const [w, v] of Object.entries(p.weekly)) if (inPeriods.has(Number(w))) playerWeeks.push({ kind: 'player', player: { name: p.name, pos: p.pos }, team: heldIn(p.pid, Number(w)), teams: heldIn(p.pid, Number(w)) ? [heldIn(p.pid, Number(w))] : [], value: v, week: Number(w) });
  listRec({ id: 'S71', kind: 'player', sec: pl, title: 'Best single-week performance', unit: 'pts', headline: true, live: true, info: 'The most points any player scored in one week, labelled with the team that had him that week.' }, playerWeeks.map((x) => ({ ...x })));
  // Pickups: points started for the adding team since the add.
  const adds = [];
  for (const x of txs) {
    if (!['FREEAGENT', 'WAIVER'].includes(x.type) || x.status !== 'EXECUTED') continue;
    for (const it of x.items) if (it.type === 'ADD') adds.push({ pid: it.playerId, team: it.toTeamId, period: x.period });
  }
  const startedFor = (pid, team, fromPeriod) => sum(tws.filter((t) => t.team === team && t.period >= fromPeriod).flatMap((t) => t.starters.filter((s) => s.pid === pid).map((s) => s.pts)));
  const nameOf = (pid) => (model.players[pid] ? model.players[pid] : (() => { for (const t of model.teamWeeks) for (const s of [...t.starters, ...t.bench, ...t.ir]) if (s.pid === pid) return s; return { name: `Player ${pid}`, pos: '?' }; })());
  listRec({ id: 'S75', kind: 'player', sec: pl, title: 'Best waiver pickup', unit: 'pts', headline: true, info: 'Points a player scored while started for the team that added him, since the add.' },
    adds.map((a) => ({ kind: 'player', player: { name: nameOf(a.pid).name, pos: nameOf(a.pid).pos }, team: a.team, teams: [a.team], value: startedFor(a.pid, a.team, a.period) })).filter((e) => e.value > 0));
  // Draft value: positional finish against positional draft rank.
  const posRankDraft = {}, byPos = {};
  for (const d of [...model.draft].sort((a, b) => a.overall - b.overall)) {
    const pos = nameOf(d.pid).pos; byPos[pos] = (byPos[pos] || 0) + 1; posRankDraft[d.pid] = byPos[pos];
  }
  const finishRank = {};
  const posGroups = {};
  for (const p of P) (posGroups[p.pos] = posGroups[p.pos] || []).push(p);
  for (const list of Object.values(posGroups)) list.sort((a, b) => seasonPts(b) - seasonPts(a)).forEach((p, i) => { finishRank[p.pid] = i + 1; });
  const draftRows = model.draft.map((d) => ({ d, pos: nameOf(d.pid).pos, name: nameOf(d.pid).name, dr: posRankDraft[d.pid], fr: finishRank[d.pid] || 999 }));
  listRec({ id: 'S78', kind: 'player', sec: pl, title: 'Best draft value', unit: 'places', headline: true, info: 'Places a player has climbed at his position: where he was drafted among his position against where he ranks in points.' },
    draftRows.map((r) => ({ kind: 'player', player: { name: r.name, pos: r.pos }, team: r.d.team, teams: [r.d.team], value: r.dr - r.fr, sub: `Drafted ${r.pos}${r.dr} · now ${r.pos}${r.fr === 999 ? '—' : r.fr}` })));
  for (const pos of ['QB', 'RB', 'WR', 'TE', 'D/ST', 'K']) {
    listRec({ id: `S70.${pos}`, kind: 'player', sec: pl, title: `Top scorer at ${pos}`, unit: 'pts', live: true, info: `The most points scored this season by a ${pos}, free agents included.` }, playerTotals.filter((x) => x.player.pos === pos).map((x) => ({ ...x })));
  }
  for (const pos of ['QB', 'RB', 'WR', 'TE', 'D/ST', 'K']) {
    listRec({ id: `S72.${pos}`, kind: 'player', sec: pl, title: `Best single week at ${pos}`, unit: 'pts', live: true, info: `The most points a ${pos} scored in one week.` }, playerWeeks.filter((x) => x.player.pos === pos).map((x) => ({ ...x })));
  }
  const halfW = Math.ceil(weeksN / 2);
  const starts = {};
  for (const tw of tws) for (const x of tw.starters) if (x.pid) { const k = `${x.pid}:${tw.team}`; (starts[k] = starts[k] || { pid: x.pid, team: tw.team, name: x.name, pos: x.pos, pts: [] }).pts.push(x.pts); }
  const regulars = Object.values(starts).filter((s) => s.pts.length >= halfW);
  listRec({ id: 'S73', kind: 'player', sec: pl, title: 'Biggest share of a team\'s points', unit: 'pct', info: `A player's started points as a share of his team's points (started in at least half the weeks: ${halfW}).` },
    regulars.map((s) => ({ kind: 'player', player: { name: s.name, pos: s.pos }, team: s.team, teams: [s.team], value: act[s.team] ? sum(s.pts) / act[s.team] : 0 })));
  listRec({ id: 'S74', kind: 'player', sec: pl, title: 'Most consistent player', unit: 'pct', better: 'low', info: `The smallest spread of weekly points relative to his average, among regular starters (at least ${halfW} starts).` },
    regulars.filter((s) => mean(s.pts) > 5).map((s) => ({ kind: 'player', player: { name: s.name, pos: s.pos }, team: s.team, teams: [s.team], value: sd(s.pts) / mean(s.pts) })));
  // Trades.
  const trades = txs.filter((x) => x.type === 'TRADE_ACCEPT' && x.status === 'EXECUTED');
  const tradeIn = [];
  const ledger = [];
  for (const x of trades) {
    const got = {};
    for (const it of x.items) if (it.type === 'TRADE') { tradeIn.push({ pid: it.playerId, team: it.toTeamId, period: x.period }); got[it.toTeamId] = (got[it.toTeamId] || 0) + startedFor(it.playerId, it.toTeamId, x.period); }
    const sides = Object.keys(got).map(Number);
    if (sides.length === 2) { const [a, b] = sides.sort((p, q) => got[q] - got[p]); ledger.push({ kind: 'pair', vs: [a, b], teams: got[a] === got[b] ? [a, b] : [a], value: got[a] - got[b], week: x.period }); }
  }
  listRec({ id: 'S76', kind: 'player', sec: pl, title: 'Best trade acquisition', unit: 'pts', info: 'Points a player scored while started for the team that traded for him, since the trade.' },
    tradeIn.map((a) => ({ kind: 'player', player: { name: nameOf(a.pid).name, pos: nameOf(a.pid).pos }, team: a.team, teams: [a.team], value: startedFor(a.pid, a.team, a.period) })));
  listRec({ id: 'S77', kind: 'pair', sec: pl, title: 'Most lopsided trade', unit: 'pts', info: 'Started points each side has had from what it received; the record is the gap, held by the side ahead.' }, ledger);
  const early = draftRows.filter((r) => r.d.round <= 3);
  listRec({ id: 'S79', kind: 'player', sec: pl, title: 'Biggest draft bust', unit: 'places', info: 'Among picks from the first three rounds: places a player has fallen at his position since the draft.' },
    early.map((r) => ({ kind: 'player', player: { name: r.name, pos: r.pos }, team: r.d.team, teams: [r.d.team], value: (r.fr === 999 ? 99 : r.fr) - r.dr, sub: `Drafted ${r.pos}${r.dr} · now ${r.pos}${r.fr === 999 ? '—' : r.fr}` })));
  const lateFrom = Math.floor((model.rounds * 2) / 3) + 1;
  listRec({ id: 'S80', kind: 'player', sec: pl, title: 'Best late-round pick', unit: 'pts', info: `The most points from a player taken in round ${lateFrom} or later.` },
    draftRows.filter((r) => r.d.round >= lateFrom).map((r) => ({ kind: 'player', player: { name: r.name, pos: r.pos }, team: r.d.team, teams: [r.d.team], value: model.players[r.d.pid] ? seasonPts(model.players[r.d.pid]) : 0, sub: `Round ${r.d.round}, pick ${r.d.pick}` })));
  const benched = {};
  for (const tw of tws) for (const x of tw.bench) { const k = `${x.pid}:${tw.team}`; (benched[k] = benched[k] || { name: x.name, pos: x.pos, team: tw.team, v: 0 }).v += x.pts; }
  listRec({ id: 'S82', kind: 'player', sec: pl, title: 'Most points while benched', unit: 'pts', info: 'Points a player scored while on one team\'s bench.' },
    Object.values(benched).map((b) => ({ kind: 'player', player: { name: b.name, pos: b.pos }, team: b.team, teams: [b.team], value: b.v })));
  const travel = Object.entries(model.heldBy).map(([pid, m]) => {
    const t = new Set(Object.entries(m).filter(([p]) => inPeriods.has(Number(p))).map(([, team]) => team));
    return { kind: 'player', player: { name: nameOf(Number(pid)).name, pos: nameOf(Number(pid)).pos }, team: labelTeam(Number(pid)), teams: labelTeam(Number(pid)) ? [labelTeam(Number(pid))] : [], value: t.size };
  });
  listRec({ id: 'S83', kind: 'player', sec: pl, title: 'Most-traveled player', unit: 'teams', info: 'Different fantasy teams that have rostered a player this season.' }, travel);
  const drops = [];
  for (const x of txs) for (const it of x.items) if (it.type === 'DROP' && x.status === 'EXECUTED') drops.push({ pid: it.playerId, team: it.fromTeamId, period: x.period });
  listRec({ id: 'S84', kind: 'player', sec: pl, title: 'Biggest drop regret', unit: 'pts', info: 'Points a player scored after the team that dropped him let him go, wherever he played.' },
    drops.filter((d) => model.players[d.pid]).map((d) => ({ kind: 'player', player: { name: model.players[d.pid].name, pos: model.players[d.pid].pos }, team: d.team, teams: [d.team],
      value: sum(Object.entries(model.players[d.pid].weekly).filter(([w]) => Number(w) > d.period && inPeriods.has(Number(w))).map(([, v]) => v)) })).filter((e) => e.value > 0));
  const vsTeam = {};
  for (const tw of tws) for (const x of tw.starters) if (x.pid) { const k = `${x.pid}:${tw.opp}`; (vsTeam[k] = vsTeam[k] || { name: x.name, pos: x.pos, opp: tw.opp, own: tw.team, v: 0 }).v += x.pts; }
  listRec({ id: 'S86', kind: 'player', sec: pl, title: 'Most points by a player against one team', unit: 'pts', info: 'Started points a player has scored against one opponent this season. Labelled with the team on the receiving end.' },
    Object.values(vsTeam).map((v) => ({ kind: 'player', player: { name: v.name, pos: v.pos }, team: v.opp, teams: [v.opp], value: v.v, against: true })));

  // ============================================================= 6. Moves, trades and the draft
  const mv = 'moves';
  const moves = Object.fromEntries(ids.map((id) => [id, 0])), offers = { ...moves };
  for (const x of txs) {
    if (['FREEAGENT', 'WAIVER'].includes(x.type) && x.status === 'EXECUTED') moves[x.team]++;
    if (x.type === 'TRADE_ACCEPT' && x.status === 'EXECUTED') { const t = new Set(x.items.filter((i) => i.type === 'TRADE').flatMap((i) => [i.fromTeamId, i.toTeamId])); for (const id of t) moves[id]++; }
    if (x.type === 'TRADE_PROPOSAL') offers[x.team]++;
  }
  teamRec({ id: 'S89.most', sec: mv, title: 'Most moves', unit: 'n', headline: true, info: 'Adds (free agent and waiver claims) and completed trades.' }, (id) => moves[id]);
  teamRec({ id: 'S89.fewest', sec: mv, title: 'Fewest moves', unit: 'n', better: 'low', info: 'Adds (free agent and waiver claims) and completed trades.' }, (id) => moves[id]);
  teamRec({ id: 'S92', sec: mv, title: 'Most trade offers proposed', unit: 'n', headline: true, info: 'A count only: offers a team has proposed this season, whatever became of them.' }, (id) => offers[id]);
  const rosterNow = {};
  for (const tw of tws.filter((t) => t.period === lastPeriod)) rosterNow[tw.team] = [...tw.starters, ...tw.bench, ...tw.ir].map((x) => x.pid).filter(Boolean);
  const draftedBy = {};
  for (const d of model.draft) (draftedBy[d.team] = draftedBy[d.team] || new Set()).add(d.pid);
  const turnover = Object.fromEntries(ids.map((id) => { const r = rosterNow[id] || []; return [id, r.length ? r.filter((p) => !(draftedBy[id] || new Set()).has(p)).length / r.length : null]; }));
  teamRec({ id: 'S91.most', sec: mv, title: 'Most roster turnover', unit: 'pct', headline: true, info: 'Share of the current roster the team did not draft.' }, (id) => turnover[id]);
  teamRec({ id: 'S91.least', sec: mv, title: 'Least roster turnover', unit: 'pct', better: 'low', info: 'Share of the current roster the team did not draft.' }, (id) => turnover[id]);
  const draftPts = Object.fromEntries(ids.map((id) => [id, sum([...(draftedBy[id] || [])].map((pid) => (model.players[pid] ? seasonPts(model.players[pid]) : 0)))]));
  teamRec({ id: 'S95.best', sec: mv, title: 'Best draft', unit: 'pts', headline: true, info: 'Points scored this season by every player the team drafted, wherever they play now.' }, (id) => draftPts[id]);
  teamRec({ id: 'S95.worst', sec: mv, title: 'Worst draft', unit: 'pts', better: 'low', info: 'Points scored this season by every player the team drafted, wherever they play now.' }, (id) => draftPts[id]);
  const partners = {};
  for (const x of trades) { const t = [...new Set(x.items.filter((i) => i.type === 'TRADE').flatMap((i) => [i.fromTeamId, i.toTeamId]))].sort((a, b) => a - b); if (t.length === 2) partners[t.join(':')] = (partners[t.join(':')] || 0) + 1; }
  listRec({ id: 'S93', kind: 'pair', sec: mv, title: 'Most frequent trade partners', unit: 'n', info: 'Completed trades between the same two teams.' },
    Object.entries(partners).map(([k, n]) => { const [a, b] = k.split(':').map(Number); return { kind: 'pair', vs: [a, b], teams: [a, b], value: n }; }));
  const fromPick = Object.fromEntries(ids.map((id) => [id, 0])), fromDraft = { ...fromPick };
  for (const tw of tws) for (const x of tw.starters) { if (!x.pid) continue; if ((draftedBy[tw.team] || new Set()).has(x.pid)) fromDraft[tw.team] += x.pts; else fromPick[tw.team] += x.pts; }
  teamRec({ id: 'S94.pickups', sec: mv, title: 'Most points from pickups', unit: 'pts', info: 'Started points from players the team did not draft.' }, (id) => fromPick[id]);
  teamRec({ id: 'S94.drafted', sec: mv, title: 'Most points from drafted players', unit: 'pts', info: 'Started points from players the team drafted.' }, (id) => fromDraft[id]);
  const firstPick = Object.fromEntries(model.draft.filter((d) => d.round === 1).map((d) => [d.team, d.pick]));
  teamRec({ id: 'S96', sec: mv, title: 'Biggest climb from draft slot', unit: 'places', info: 'First-round draft position minus current place in the standings.' }, (id) => (firstPick[id] ? firstPick[id] - st[id].seed : null));

  // ============================================================= 7. History and pace
  const hi = 'history';
  const hof = (model.hof && model.hof.records) || {};
  const broken = Object.entries(hof).filter(([, v]) => (v || []).some((e) => e.season === model.season));
  const brokeBy = {};
  for (const [, v] of broken) for (const e of v.filter((x) => x.season === model.season)) for (const t of [e.teamId, e.winner].filter(Boolean)) brokeBy[t] = (brokeBy[t] || 0) + 1;
  add({ id: 'S113', sec: hi, kind: 'team', title: 'Hall of Fame records set this season', unit: 'n', headline: true,
    info: 'All-time records in Hall of Fame that a team set or matched this season.',
    entries: Object.entries(brokeBy).map(([t, n]) => ({ teams: [Number(t)], value: n })).sort((a, b) => b.value - a.value),
    empty: broken.length ? null : { title: 'None yet', note: 'No Hall of Fame record has fallen this season.' } });
  const n = Math.max(0, ...games.map((g) => g.week).filter((w) => w <= model.regWeeks));
  const bestAfter = (list) => { const w = {}; for (const g of list.filter((x) => x.week <= n)) if (g.winner) w[g.winner] = (w[g.winner] || 0) + 1; return Math.max(0, ...Object.values(w)); };
  const pastBest = Object.entries(model.past).map(([yr, list]) => ({ yr, best: bestAfter(list) })).sort((a, b) => b.best - a.best);
  const nowBest = Math.max(...ids.map((id) => line[id].res.filter((r) => r.week <= n && r.r === 'W').length));
  const leaders = ids.filter((id) => line[id].res.filter((r) => r.week <= n && r.r === 'W').length === nowBest);
  // Best start counts from week 4 (D73): after one or two weeks every season has unbeaten teams.
  if (n && n < BEST_START_FROM) {
    add({ id: 'S110', sec: hi, kind: 'team', title: 'Best start in league history', unit: 'rec', headline: true, entries: [],
      info: 'The best record after this many weeks in any season of the league.',
      empty: { title: `From week ${BEST_START_FROM}`, note: `Compared with past seasons from week ${BEST_START_FROM}, when a start has had time to mean something.` } });
  } else if (n && pastBest.length && nowBest >= pastBest[0].best) {
    add({ id: 'S110', sec: hi, kind: 'team', title: 'Best start in league history', unit: 'rec', headline: true,
      info: `The best record after ${n} weeks in any season. The previous best: ${pastBest[0].best} wins (${pastBest[0].yr}).`,
      entries: leaders.map((id) => ({ teams: [id], value: nowBest, text: `${nowBest}-${n - nowBest}` })) });
  } else {
    add({ id: 'S110', sec: hi, kind: 'team', title: 'Best start in league history', unit: 'rec', headline: true, entries: [],
      empty: { title: 'Not this season', note: pastBest.length ? `This season's best after ${n} weeks is ${nowBest}-${n - nowBest}; the league's best is ${pastBest[0].best}-${n - pastBest[0].best} (${pastBest[0].yr}).` : 'No past seasons to compare.' } });
  }

  // ============================================================= 8. Fun
  const fn = 'fun';
  const pfRank = Object.fromEntries([...ids].sort((a, b) => line[b].pf - line[a].pf).map((id, i) => [id, i + 1]));
  teamRec({ id: 'S121', sec: fn, title: 'Fraud watch', unit: 'places', headline: true, info: 'The team placed highest relative to its points: its points-for rank minus its place in the standings.' }, (id) => pfRank[id] - st[id].seed);
  teamRec({ id: 'S122', sec: fn, title: 'Most heartbreak losses', unit: 'n', headline: true, info: 'Losses by less than 1 point.' }, (id) => mres[id].filter((r) => r.r === 'L' && -r.margin < 1).length);
  const badBeat = Object.fromEntries(ids.map((id) => [id, 0])), lucky = { ...badBeat };
  for (const list of Object.values(byPeriod)) {
    const sorted = [...list].sort((a, b) => b.pts - a.pts), med = median(list.map((x) => x.pts));
    for (const tw of list) {
      const r = mres[tw.team].find((x) => x.period === tw.period);
      if (!r) continue;
      if (tw === sorted[1] && r.r === 'L') badBeat[tw.team]++;
      if (r.r === 'W' && tw.pts < med) lucky[tw.team]++;
    }
  }
  teamRec({ id: 'S128', sec: fn, title: 'Most bad beats', unit: 'n', headline: true, info: 'Weeks with the league\'s second-highest score, and a loss.' }, (id) => badBeat[id]);
  teamRec({ id: 'S129', sec: fn, title: 'Most lucky wins', unit: 'n', headline: true, info: 'Wins with a score below the week\'s median.' }, (id) => lucky[id]);
  // A spoiler win: a regular-season win by a team already out of the playoff race, against a team still in it.
  const elimAt = model.elimAfter || {};
  const outBy = (id, week) => elimAt[id] != null && week > elimAt[id];
  teamRec({ id: 'S123', sec: fn, title: 'Most spoiler wins', unit: 'n', info: 'Regular-season wins by a team already out of the playoff race, against a team still in it.' },
    (id) => line[id].res.filter((r) => r.r === 'W' && r.week <= model.regWeeks && outBy(id, r.week) && !outBy(r.op, r.week)).length);
  const survivor = Object.fromEntries(ids.map((id) => [id, { n: 0 }]));
  for (const id of ids) {
    let run = 0, best = 0;
    for (const p of Object.keys(byPeriod).map(Number).sort((a, b) => a - b)) {
      const sorted = [...byPeriod[p]].sort((a, b) => a.pts - b.pts).slice(0, 3).map((x) => x.team);
      if (sorted.includes(id)) run = 0; else { run++; best = Math.max(best, run); }
    }
    survivor[id] = best;
  }
  teamRec({ id: 'S130', sec: fn, title: 'Longest run without a bottom-three score', unit: 'wks', info: 'Weeks in a row without finishing among the league\'s three lowest scores.' }, (id) => survivor[id]);
  teamRec({ id: 'S132', sec: fn, title: 'Most garbage-time points', unit: 'pts', timeline: true, info: 'Points scored after the matchup was decided (once the winner\'s win chance reached 99%), read from the score timeline.' }, (id) => garb[id]);

  for (const r of R) r.entries = (r.entries || []).map((e) => ({ ...e, value: typeof e.value === 'number' ? r2Keep(e.value) : e.value }));
  // Records read from the score timeline say which weeks they cover when the site did not record every week (D16).
  const covered = view.weeks.filter((w) => model.tlWeeks.has(w));
  for (const r of R) {
    if (!r.timeline) continue;
    delete r.timeline;
    if (!covered.length) { r.entries = []; r.empty = { title: 'Not recorded', note: 'The site has no score timeline for these weeks.' }; }
    else if (covered.length < view.weeks.length) r.since = Math.min(...covered);
  }

  // ============================================================= 9. Record Holders (records about the records above)
  const tally = Object.fromEntries(ids.map((id) => [id, { good: 0, bad: 0 }]));
  for (const r of R) {
    const tone = toneOf(r.id);
    if (!tone) continue;
    r.tone = tone;
    const credited = new Set(holdersOf(r).flatMap((e) => (r.kind === 'player' ? (e.team ? [e.team] : []) : (e.teams || []))));
    for (const id of credited) if (tally[id]) tally[id][tone > 0 ? 'good' : 'bad']++;
    // A good matchup record is bad for the other side (D63): the beaten team in a blowout, a comeback, an upset,
    // an unlikeliest win, and the side behind in a lopsided trade each take a point off.
    if (tone > 0 && (r.kind === 'match' || r.kind === 'pair')) {
      const against = new Set(holdersOf(r).map((e) => e.vs && e.vs[1]).filter((id) => id != null && !credited.has(id)));
      for (const id of against) if (tally[id]) tally[id].bad++;
    }
  }
  const net = (id) => tally[id].good - tally[id].bad;
  const ofTally = (id) => ({ teams: [id], value: net(id), good: tally[id].good, bad: tally[id].bad });
  const counted = R.filter((r) => r.tone).length;
  const hInfo = `Every record on this page except these two, ${counted} in all: +1 for each good one a team holds, −1 for each bad one, and −1 to the team on the wrong end of a good matchup record (a shared record counts for everyone sharing it). Records that are neither, like Closest game or Most moves, count nothing.`;
  add({ id: 'S140', sec: 'holders', kind: 'team', title: 'Most records held', unit: 'net', headline: true, info: hInfo,
    entries: ids.map(ofTally).sort((a, b) => b.value - a.value || b.good - a.good) });
  add({ id: 'S141', sec: 'holders', kind: 'team', title: 'Least records held', unit: 'net', better: 'low', headline: true, info: hInfo,
    entries: ids.map(ofTally).sort((a, b) => a.value - b.value || b.bad - a.bad) });
  return { standings, records: R };
}
const r2Keep = (x) => Math.round(x * 10000) / 10000;
export const BEST_START_FROM = 4;
