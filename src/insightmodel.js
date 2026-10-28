/**
 * Matchup Insights: the model every rule reads (src/insights.js), built from what the insights step gathers from
 * stored copies (src/insightstep.js gatherInsightInputs). A plain module: no storage, no clock, no ESPN call, so
 * the tests build it from fixtures exactly as the step does from R2.
 *
 * inputs = {
 *   season, now (ISO), settings (league_settings), schedule (season_schedule), teams [{ id, name, logo, owner }],
 *   weeks { scoringPeriod: Season Statistics' compact week (src/seasonstats.js compactWeek) },
 *   ss { whole, regular, w1 … wN: Season Statistics' stored parts },
 *   live (live_scoring_digest), scoreboard (nfl_scoreboard), tx (transaction_digest), h2hFull (h2h_full_digest),
 *   injuries (injuries_digest), byes (bye_weeks), depth (depth_digest), history (league_history_digest),
 *   posratings (positional_ratings), espnOdds ({ season, weeks }), past { year: [{ week, home, away, winner }] },
 * }
 * Any input may be missing: the rules that need it simply do not fire.
 */

export const POS = { 1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'D/ST' };
export const POS_ID = { QB: 1, RB: 2, WR: 3, TE: 4, K: 5, 'D/ST': 16 };
export const SLOT_POS = { 0: [1], 2: [2], 4: [3], 6: [4], 23: [2, 3, 4], 16: [16], 17: [5] };
/* ESPN's pro team ids (the same table as src/derive.js's pro team map). */
export const PRO_ABBREV = { 1: 'ATL', 2: 'BUF', 3: 'CHI', 4: 'CIN', 5: 'CLE', 6: 'DAL', 7: 'DEN', 8: 'DET', 9: 'GB', 10: 'TEN', 11: 'IND', 12: 'KC',
  13: 'LV', 14: 'LAR', 15: 'MIA', 16: 'MIN', 17: 'NE', 18: 'NO', 19: 'NYG', 20: 'NYJ', 21: 'PHI', 22: 'ARI', 23: 'PIT', 24: 'LAC', 25: 'SF',
  26: 'SEA', 27: 'TB', 28: 'WSH', 29: 'CAR', 30: 'JAX', 33: 'BAL', 34: 'HOU' };

const r2 = (x) => Math.round(Number(x) * 100 + 1e-9) / 100;

/** The best lineup a roster could field, by `key` (pts, proj or v): fixed slots first, then the flexible ones. */
export function bestLineup(roster, startSlots, key) {
  // D/ST ids are negative, so a missing id is null, never "not positive".
  const pool = roster.filter((x) => x.pid != null);
  const used = new Set();
  let total = 0;
  const take = (slot, n) => {
    for (let i = 0; i < n; i++) {
      const ok = pool.filter((x) => !used.has(x.pid) && (SLOT_POS[slot] || []).includes(x.posId)).sort((a, b) => b[key] - a[key])[0];
      if (!ok) continue;
      used.add(ok.pid);
      total += Number(ok[key]) || 0;
    }
  };
  for (const [s, n] of startSlots.filter(([s]) => (SLOT_POS[s] || []).length === 1)) take(s, n);
  for (const [s, n] of startSlots.filter(([s]) => (SLOT_POS[s] || []).length > 1)) take(s, n);
  return total;
}

/** The starting lineup's slots from the league's roster settings, as [slot id, count]. */
export function startSlotsOf(settings) {
  const counts = (settings && settings.settings && settings.settings.rosterSettings && settings.settings.rosterSettings.lineupSlotCounts) || {};
  return Object.entries(counts).filter(([k, n]) => n > 0 && k !== '20' && k !== '21').map(([k, n]) => [Number(k), n]);
}

/** The scoring periods a matchup period covers (a postseason matchup can span two). */
export function periodsOfWeek(settings, week) {
  const map = (settings && settings.settings && settings.settings.scheduleSettings && settings.settings.scheduleSettings.matchupPeriods) || {};
  const p = map[week] || map[String(week)];
  return Array.isArray(p) && p.length ? p.map(Number) : [Number(week)];
}

/**
 * The postseason bracket facts of one fixture: round, the place it decides (when known), the highest place its winner
 * can still finish (the order games are listed in, D49) and its scoring periods. Null in the regular season.
 */
export function bracketOf(M, fx) {
  if (fx.week <= M.regWeeks) return null;
  const k = fx.week - M.regWeeks;
  const rounds = Math.ceil(Math.log2(Math.max(2, M.places)));
  const tier = String(fx.tier || '');
  const periods = periodsOfWeek(M.settings, fx.week);
  if (tier === 'WINNERS_BRACKET') {
    if (k >= rounds) return { round: 'championship', best: 1, place: 1, periods };
    if (k === rounds - 1) return { round: 'semi', best: 1, periods };
    return { round: 'quarter', best: 1, periods };
  }
  if (tier === 'WINNERS_CONSOLATION_LADDER') return k >= rounds ? { round: 'third', place: 3, best: 3, periods } : { round: 'consolation', best: M.places + 1, periods };
  return { round: 'consolation', best: M.places + 1, periods };
}

/** A team's week from the live digest's side (a game played this week, before ESPN settles it). */
export function teamWeekFromLive(side, startSlots, week, gameId, opp) {
  const conv = (p) => ({ pid: p.id, name: p.name || '', pos: p.pos, posId: POS_ID[p.pos] || 0, slot: p.slotId, pts: r2(p.points || 0), proj: r2(p.proj || 0) });
  const starters = (side.starters || []).filter((p) => p.id != null).map(conv);
  const bench = (side.bench || []).filter((p) => p.id != null && p.slotId !== 21).map(conv);
  const ir = (side.bench || []).filter((p) => p.id != null && p.slotId === 21).map(conv);
  return { team: side.teamId, opp, week, gameId, pts: r2(side.points || 0), starters, bench, ir,
    proj: r2(starters.reduce((a, x) => a + x.proj, 0)), optimal: r2(bestLineup([...starters, ...bench], startSlots, 'pts')) };
}

/** The last depth chart the step kept before `week` (its players by id), or null. */
export function depthBefore(depthWeeks, week) {
  const ws = Object.keys(depthWeeks || {}).map(Number).filter((w) => week && w < week).sort((a, b) => b - a);
  return ws.length ? depthWeeks[ws[0]] : null;
}

export function buildInsightModel(inp) {
  const settings = inp.settings || {};
  const ss0 = (settings.settings && settings.settings.scheduleSettings) || {};
  const season = Number(inp.season);
  const startSlots = startSlotsOf(settings);
  const regWeeks = Number(ss0.matchupPeriodCount) || 13;
  const places = Number(ss0.playoffTeamCount) || 4;
  // The rules that work out seeds (into / out of a place, tiebreaks, rise or fall) know this one rule: wins, then points for.
  const seedByPoints = !ss0.playoffSeedingRule || ss0.playoffSeedingRule === 'TOTAL_POINTS_SCORED';
  const teams = {};
  for (const t of inp.teams || []) teams[t.id] = { id: t.id, name: t.name, logo: t.logo || null, owner: t.owner || '' };
  const ids = Object.keys(teams).map(Number);

  const fixtures = (((inp.schedule && inp.schedule.schedule) || [])).filter((m) => m.home && m.away).map((m) => ({
    id: m.id, week: m.matchupPeriodId, home: m.home.teamId, away: m.away.teamId, tier: m.playoffTierType || 'NONE',
    hp: Number(m.home.totalPoints) || 0, ap: Number(m.away.totalPoints) || 0,
    winner: m.winner === 'HOME' ? m.home.teamId : m.winner === 'AWAY' ? m.away.teamId : m.winner === 'TIE' ? 0 : null,
  }));
  const settled = fixtures.filter((f) => f.winner != null);

  // Team-weeks keyed by matchup period (a two-week postseason matchup sums its periods), player-weeks by scoring period.
  const teamWeeks = {};
  const heldBy = {};
  const playerWeeks = {};
  const fxById = Object.fromEntries(fixtures.map((f) => [f.id, f]));
  for (const [p, wk] of Object.entries(inp.weeks || {})) {
    const period = Number(p);
    for (const e of (wk && wk.teams) || []) {
      const fx = fxById[e.matchupId];
      const week = fx ? fx.week : (e.matchupPeriod || period);
      const players = (e.players || []).map(([pid, name, posId, slot, pts, proj, inj]) => ({ pid, name, pos: POS[posId] || '?', posId, slot, pts: r2(pts), proj: r2(proj), inj }));
      const part = {
        team: e.team, opp: e.opp, week, gameId: e.matchupId, pts: r2(e.pts),
        starters: players.filter((x) => x.slot !== 20 && x.slot !== 21), bench: players.filter((x) => x.slot === 20), ir: players.filter((x) => x.slot === 21),
      };
      part.proj = r2(part.starters.reduce((a, x) => a + x.proj, 0));
      part.optimal = r2(bestLineup([...part.starters, ...part.bench], startSlots, 'pts'));
      const key = `${e.team}:${week}`;
      const had = teamWeeks[key];
      teamWeeks[key] = had && had.periods && !had.periods.includes(period) ? {
        ...had, pts: r2(had.pts + part.pts), proj: r2(had.proj + part.proj), optimal: r2(had.optimal + part.optimal),
        starters: [...had.starters, ...part.starters], bench: [...had.bench, ...part.bench], ir: [...had.ir, ...part.ir], periods: [...had.periods, period],
      } : { ...part, periods: [period] };
      for (const x of players) {
        (heldBy[x.pid] = heldBy[x.pid] || {})[period] = e.team;
        (playerWeeks[x.pid] = playerWeeks[x.pid] || { pid: x.pid, name: x.name, pos: x.pos, weeks: {} }).weeks[period] = { pts: x.pts, proj: x.proj, team: e.team, opp: e.opp, slot: x.slot };
      }
    }
  }

  // This week's lineups, as the live digest has them.
  const live = inp.live || null;
  const now = live && Array.isArray(live.games) ? {
    week: Number(live.matchupPeriod) || null,
    games: live.games.map((g) => ({
      id: g.id, state: g.state, firstKickoff: g.firstKickoff, playoff: g.playoff || null,
      sides: Object.fromEntries(['home', 'away'].map((s) => [s, { team: g[s].teamId, points: Number(g[s].points) || 0, projected: Number(g[s].projected) || 0,
        winProb: g[s].winProb == null ? 50 : Number(g[s].winProb), starters: g[s].starters || [], bench: g[s].bench || [] }])),
    })),
  } : { week: null, games: [] };

  // NFL games of the scoreboard's week: opponent, kickoff, line, over/under and weather (D-list: kept in the model).
  const nfl = {};
  for (const e of (inp.scoreboard && inp.scoreboard.events) || []) {
    const c = (e.competitions || [])[0];
    if (!c) continue;
    const home = (c.competitors || []).find((x) => x.homeAway === 'home'), away = (c.competitors || []).find((x) => x.homeAway === 'away');
    if (!home || !away || !home.team || !away.team) continue;
    const o = (c.odds || [])[0] || null;
    const g = { key: `${away.team.abbreviation}@${home.team.abbreviation}`, home: home.team.abbreviation, away: away.team.abbreviation,
      kickoff: e.date, state: e.status && e.status.type && e.status.type.state, overUnder: o && o.overUnder != null ? Number(o.overUnder) : null, line: o ? o.details || null : null,
      weather: e.weather || null, indoor: Boolean(c.venue && c.venue.indoor), neutral: Boolean(c.neutralSite) };
    nfl[g.home] = { ...g, opp: g.away, isHome: true };
    nfl[g.away] = { ...g, opp: g.home, isHome: false };
  }

  // Positional ratings: rank 1 allows the fewest points to that position (toughest), the highest rank the most.
  const posr = {};
  const PR = inp.posratings && inp.posratings.positionAgainstOpponent && inp.posratings.positionAgainstOpponent.positionalRatings;
  for (const [posId, v] of Object.entries(PR || {})) {
    for (const [pro, r] of Object.entries((v && v.ratingsByOpponent) || {})) (posr[POS[posId]] = posr[POS[posId]] || {})[PRO_ABBREV[pro] || pro] = { avg: Number(r.average) || 0, rank: Number(r.rank) || 0 };
  }

  const tx = ((inp.tx && inp.tx.items) || []).filter((x) => x.status === 'completed' || (x.kind === 'trade' && String(x.status).toLowerCase() === 'completed'))
    .map((x) => (x.kind === 'trade' ? { ...x, status: 'completed' } : x));

  // Season Statistics: the stored part for "after week N" is the season as it stood before week N + 1.
  const ss = inp.ss || {};
  const partBefore = (w) => (w <= 1 ? null : ss[`w${w - 1}`] || null);
  const partAfter = (w) => ss[`w${w}`] || null;

  // Head to head: every meeting of a pair, oldest first, each side's points keyed by team id, with each scoring
  // period's points (`periods`; a two-week postseason matchup has two). This season's settled results that the stored
  // head-to-head digest has not caught up with yet are added from the schedule (round 8: the digest follows ESPN's
  // weekly settlement, and the insights must not say "now 4-0" about a meeting it has not counted).
  const pairs = (inp.h2hFull && inp.h2hFull.pairs) || {};
  const h2h = (a, b, extra = []) => {
    const lo = Math.min(a, b), hi = Math.max(a, b);
    const p = pairs[`${lo}:${hi}`];
    const games = ((p && p.games) || []).map((g) => ({ season: g.season, week: g.week, post: Boolean(g.postseason), round: g.round || null, [lo]: g.lowPts, [hi]: g.highPts,
      periods: (g.weeks || [{ period: g.week, lowPts: g.lowPts, highPts: g.highPts }]).map((w) => ({ period: w.period, [lo]: w.lowPts, [hi]: w.highPts })) }));
    const have = new Set(games.filter((g) => g.season === season).map((g) => g.week));
    for (const f of [...settled, ...extra]) {
      if (have.has(f.week) || !((f.home === lo && f.away === hi) || (f.home === hi && f.away === lo))) continue;
      have.add(f.week);
      games.push({ season, week: f.week, post: f.week > regWeeks, round: null, [f.home]: f.hp, [f.away]: f.ap, periods: [{ period: f.week, [f.home]: f.hp, [f.away]: f.ap }], provisional: true });
    }
    return games.sort((x, y) => x.season - y.season || x.week - y.week);
  };

  const injuries = {};
  for (const p of (inp.injuries && inp.injuries.players) || []) injuries[p.id] = p;
  const history = inp.history || { records: {}, champions: [] };
  const oddsWeeks = inp.espnOdds && Number(inp.espnOdds.season) === season ? inp.espnOdds.weeks || {} : {};

  return {
    season, regWeeks, places, seedByPoints, startSlots, settings, teams, ids, fixtures, settled, teamWeeks, heldBy, playerWeeks, now, nfl, posr, tx,
    proAbbrev: PRO_ABBREV, ss, partBefore, partAfter, h2h, injuries, pairs,
    byes: inp.byes || { byes: {}, kickoffs: {} }, depth: (inp.depth && inp.depth.players) || {},
    depthBefore: depthBefore(inp.depthWeeks, now.week),
    hof: { records: history.records || {} }, champions: history.champions || [], oddsWeeks, past: inp.past || {},
    capturedAt: inp.now || new Date(0).toISOString(),
  };
}

/**
 * The standings after `week` as the insights count them (round 8), from Season Statistics' "after week N - 1" part with
 * `finals` (this week's games that are over, as settled fixtures { home, away, hp, ap, winner }) added: wins, losses,
 * ties, points for and against, the streak and, in a league that seeds by wins then points for, the seed. Used only
 * by Matchup Insights, between a game ending and ESPN settling the week; every other tool keeps ESPN's standings.
 */
export function provisionalAfter(M, week, finals) {
  const before = M.partBefore(week);
  const base = Object.fromEntries(((before && before.standings) || []).map((s) => [s.team, { ...s, streak: s.streak ? { ...s.streak } : null }]));
  for (const id of M.ids) if (!base[id]) base[id] = { team: id, w: 0, l: 0, t: 0, pf: 0, pa: 0, seed: null, streak: null };
  for (const f of finals) {
    for (const [id, mine, theirs] of [[f.home, f.hp, f.ap], [f.away, f.ap, f.hp]]) {
      const s = base[id];
      if (!s) continue;
      const r = f.winner === id ? 'W' : f.winner === 0 ? 'T' : 'L';
      if (r === 'W') s.w++; else if (r === 'L') s.l++; else s.t++;
      s.pf = r2((s.pf || 0) + mine); s.pa = r2((s.pa || 0) + theirs);
      s.streak = s.streak && s.streak.type === r ? { type: r, n: s.streak.n + 1 } : { type: r, n: 1 };
    }
  }
  const rows = Object.values(base);
  if (M.seedByPoints !== false) {
    const pctOf = (s) => { const g = s.w + s.l + s.t; return g ? (s.w + s.t / 2) / g : 0; };
    rows.sort((x, y) => pctOf(y) - pctOf(x) || y.pf - x.pf).forEach((s, i) => { s.seed = i + 1; });
  }
  return { standings: rows, provisional: true };
}

/**
 * Hall of Fame's single-game records (round 8) as they stood before `week` of this season: every scoring period of
 * every meeting in the league's history (head to head), this season's from before `week` only. Hall of Fame counts
 * them per scoring period, so a two-week postseason matchup is two games here too.
 */
export function allTimeBefore(M, week) {
  let high = null, low = null, blow = null, close = null;
  for (const key of Object.keys(M.pairs || {})) {
    const [a, b] = key.split(':').map(Number);
    for (const g of M.h2h(a, b)) {
      if (g.season > M.season || (g.season === M.season && g.week >= week)) continue;
      for (const p of g.periods) {
        const at = { season: g.season, week: p.period };
        for (const id of [a, b]) {
          if (!high || p[id] > high.value) high = { value: p[id], team: id, ...at };
          if (!low || p[id] < low.value) low = { value: p[id], team: id, ...at };
        }
        const m = Math.abs(p[a] - p[b]);
        const w = p[a] > p[b] ? a : b;
        if (!blow || m > blow.value) blow = { value: r2(m), team: w, ...at };
        if (m > 0 && (!close || m < close.value)) close = { value: r2(m), team: w, ...at };
      }
    }
  }
  return { high, low, blow, close };
}
