/**
 * Front Office's model: the facts its rules (src/frontoffice.js) read, gathered from the site's stored copies by the
 * backend step (src/frontofficestep.js). Plain function, no I/O, so it is tested by behaviour.
 *
 * Inputs (each the stored JSON; any may be missing and the model says less):
 *   settings    league_settings (roster shape, position caps, schedule settings)
 *   rosters     rosters (mTeam + mRoster: lineup slots, waiver order, records, seeds)
 *   schedule    season_schedule (every matchup and its bracket)
 *   weekly      weekly_projections_digest (projection and points by week, ownership, status)
 *   byes        bye_weeks (NFL byes, fixtures and kickoffs by week)
 *   scoreboard  nfl_scoreboard (this NFL week's games: state, line, over/under, weather)
 *   posratings  positional_ratings (each defence's rank against each position)
 *   depth       depth_digest; depthPrev, the depth chart as kept a week earlier (Matchup Insights' depth/w<N>.json)
 *   injuries    injuries_digest; tx, transaction_digest; standings, standings_digest (names and logos)
 *   live        live_scoring_digest (this week's points and game states, per player)
 *   projFirst   { playerId: the first projection seen for him this week } (kept by the step)
 *   now         the clock, in milliseconds
 */
import { oneDecimal } from './round.js';
import { PRO_TEAM_MAP as PRO } from './derive.js';

const r2 = (x) => Math.round(Number(x) * 100 + 1e-9) / 100;
const GAME_HOURS = 3.5;

/** The league's calendar: last regular-season scoring period, first and last postseason period, and each matchup period's weeks. */
export function calendarOf(settings, rosters) {
  const ss = (settings && settings.settings && settings.settings.scheduleSettings) || {};
  const regLast = Number(ss.matchupPeriodCount) || 13;
  const mp = ss.matchupPeriods || {};
  let postLast = regLast;
  for (const ws of Object.values(mp)) for (const w of ws || []) postLast = Math.max(postLast, Number(w));
  const fin = rosters && rosters.status && Number(rosters.status.finalScoringPeriod);
  if (fin) postLast = Math.max(postLast, fin);
  return { regLast, postFirst: regLast + 1, postLast, matchupPeriods: mp, playoffTeams: Number(ss.playoffTeamCount) || 4 };
}

export function buildFoModel(I, { now = Date.now() } = {}) {
  const R = I.rosters;
  if (!R || !Array.isArray(R.teams)) return null;
  const cal = calendarOf(I.settings, R);
  const week = Number(R.scoringPeriodId) || 1;
  const WP = (I.weekly && I.weekly.players) || {};
  const players = {};
  const fromDigest = (id, x) => ({
    pid: Number(id), name: x.n, posId: x.p, nfl: PRO[x.t] || 'FA', inj: x.i || 'ACTIVE', droppable: x.d !== 0,
    own: x.o || 0, chg: x.c || 0, proj: { ...(x.pr || {}) }, act: { ...(x.ac || {}) }, tgt: x.tg || {}, car: x.ca || {},
    status: x.s, onTeam: x.tm || 0,
  });
  for (const [id, x] of Object.entries(WP)) players[id] = fromDigest(id, x);

  // Rosters: lineup slots, and every rostered player the weekly digest does not hold (from his roster entry).
  const rosters = {}, teams = {};
  const names = Object.fromEntries((((I.standings && I.standings.rows) || [])).map((r) => [r.teamId, r]));
  for (const t of R.teams) {
    const entries = (t.roster && t.roster.entries) || [];
    rosters[t.id] = entries.map((e) => ({ pid: e.playerId, slot: e.lineupSlotId }));
    for (const e of entries) {
      const pe = e.playerPoolEntry || {}, p = pe.player || {};
      const known = players[e.playerId];
      if (known) {
        known.status = 'ONTEAM'; known.onTeam = t.id;
        if (p.injuryStatus) known.inj = I.injuryPick ? I.injuryPick(e.playerId, p.injuryStatus) : p.injuryStatus;
        if (p.droppable === false) known.droppable = false;
        continue;
      }
      const proj = {}, act = {};
      for (const st of p.stats || []) {
        if (st.statSplitTypeId !== 1 || !st.scoringPeriodId) continue;
        if (st.statSourceId === 1) proj[st.scoringPeriodId] = r2(st.appliedTotal);
        if (st.statSourceId === 0) act[st.scoringPeriodId] = r2(st.appliedTotal);
      }
      players[e.playerId] = { pid: e.playerId, name: p.fullName || 'A player', posId: p.defaultPositionId, nfl: PRO[p.proTeamId] || 'FA',
        inj: p.injuryStatus || 'ACTIVE', droppable: p.droppable !== false, own: oneDecimal((p.ownership || {}).percentOwned),
        chg: oneDecimal((p.ownership || {}).percentChange), proj, act, tgt: {}, car: {}, status: 'ONTEAM', onTeam: t.id };
    }
    const rec = (t.record && t.record.overall) || {};
    const st = names[t.id] || {};
    const seed = Number(t.playoffSeed) || Number(st.seed) || null;
    teams[t.id] = {
      id: t.id, name: st.name || t.name || `Team ${t.id}`, logo: st.logo || null,
      record: `${rec.wins || 0}-${rec.losses || 0}-${rec.ties || 0}`, seed, waiverRank: Number(t.waiverRank) || null,
      inRace: !t.eliminated && (seed == null || seed <= cal.playoffTeams + 2 || week <= cal.regLast - 3),
    };
  }

  const rs = (I.settings && I.settings.settings && I.settings.settings.rosterSettings) || {};
  const slots = Object.entries(rs.lineupSlotCounts || {}).filter(([k, n]) => n > 0 && k !== '20' && k !== '21').map(([k, n]) => [Number(k), n]);
  const acq = (I.settings && I.settings.settings && I.settings.settings.acquisitionSettings) || {};
  const waiver = { hours: Number(acq.waiverHours) || null, days: Array.isArray(acq.waiverProcessDays) ? acq.waiverProcessDays : null };
  const caps = Object.fromEntries(Object.entries(rs.positionLimits || {}).filter(([, n]) => n > 0).map(([k, n]) => [Number(k), n]));

  // Fantasy schedule by scoring week (a two-week postseason matchup is in both its weeks), each fixture's bracket,
  // and each team's round label in the postseason.
  const schedule = {}, rounds = {}, brackets = {};
  const sched = (I.schedule && I.schedule.schedule) || [];
  const postPeriods = Object.keys(cal.matchupPeriods).map(Number).filter((m) => m > cal.regLast).sort((a, b) => a - b);
  const firstPost = postPeriods[0], lastPost = postPeriods[postPeriods.length - 1];
  for (const m of sched) {
    const ws = cal.matchupPeriods[m.matchupPeriodId] || [m.matchupPeriodId];
    const home = m.home && m.home.teamId, away = m.away && m.away.teamId;
    const tier = m.playoffTierType && m.playoffTierType !== 'NONE' ? m.playoffTierType : null;
    for (const w of ws) {
      (schedule[w] = schedule[w] || []).push({ home, away, tier });
      if (!tier) continue;
      const label = roundLabel(tier, m.matchupPeriodId, firstPost, lastPost);
      for (const id of [home, away]) if (id) { (rounds[w] = rounds[w] || {})[id] = label; if (!brackets[id]) brackets[id] = /WINNERS_BRACKET/.test(tier) ? 'winners' : 'consolation'; }
    }
  }

  // NFL: byes, opponents and kickoffs by week.
  const BW = I.byes || {};
  const nfl = {};
  for (const [abbr, bye] of Object.entries(BW.byes || {})) nfl[abbr] = { bye, opp: {}, home: {}, kick: (BW.kickoffs || {})[abbr] || {} };
  for (const [w, list] of Object.entries(BW.fixtures || {})) for (const f of list || []) {
    if (nfl[f.home]) { nfl[f.home].opp[w] = f.away; nfl[f.home].home[w] = true; }
    if (nfl[f.away]) { nfl[f.away].opp[w] = f.home; nfl[f.away].home[w] = false; }
  }

  // This week's games: kickoff and state from the fixtures (and the live digest's player states), with the line,
  // over/under and weather from the NFL scoreboard when it describes this very week.
  const games = {};
  for (const f of ((BW.fixtures || {})[week] || [])) {
    const k = f.kickoff || null;
    const state = f.final ? 'final' : f.inProgress ? 'live' : k && Date.parse(k) + GAME_HOURS * 3600e3 <= now ? 'final' : k && Date.parse(k) <= now ? 'live' : 'pre';
    const base = { kickoff: k, state, ou: null, fav: null, spread: null, lineText: null, indoor: null, weatherText: null, windy: false };
    games[f.home] = { ...base, opp: f.away, home: true };
    games[f.away] = { ...base, opp: f.home, home: false };
  }
  const sb = I.scoreboard;
  if (sb && sb.week && Number(sb.week.number) === week) {
    for (const e of sb.events || []) {
      const c = (e.competitions || [])[0];
      if (!c) continue;
      const side = Object.fromEntries((c.competitors || []).map((x) => [x.homeAway, x.team && x.team.abbreviation]));
      const o = (c.odds || [])[0] || {};
      let fav = null, spread = null;
      const m = /^([A-Z]{2,3})\s+-([\d.]+)/.exec(o.details || '');
      if (m) { fav = m[1]; spread = Number(m[2]); }
      const wx = e.weather || c.weather || null;
      const wtext = wx ? [wx.displayValue, wx.temperature != null ? `${wx.temperature}°F` : null].filter(Boolean).join(', ') : null;
      const st = e.status && e.status.type && e.status.type.state;
      for (const [me, them, home] of [[side.home, side.away, true], [side.away, side.home, false]]) {
        if (!me) continue;
        games[me] = { ...(games[me] || {}), opp: them, home, kickoff: e.date || (games[me] || {}).kickoff || null,
          state: st === 'in' ? 'live' : st === 'post' ? 'final' : (games[me] || {}).state || 'pre',
          ou: o.overUnder != null ? Number(o.overUnder) : null, fav, spread, lineText: o.details || null,
          indoor: Boolean(c.venue && c.venue.indoor), weatherText: wtext, windy: /wind|snow/i.test(wtext || '') };
      }
    }
  }

  // Live points this week, from the live digest (a locked player's points as the game goes).
  const live = {};
  const lg = I.live;
  if (lg && Number(lg.scoringPeriod || lg.matchupPeriod) === week) {
    for (const g of lg.games || []) for (const side of [g.home, g.away]) for (const p of [...((side && side.starters) || []), ...((side && side.bench) || [])]) {
      if (!p || p.id == null) continue;
      const gs = p.gameStatus; // pre | live | final (gameState is the display text)
      if (gs === 'live' || gs === 'final' || gs === 'post' || gs === 'in') {
        live[p.id] = r2(p.points || 0);
        const pl = players[p.id];
        if (pl && games[pl.nfl] && games[pl.nfl].state === 'pre') games[pl.nfl].state = gs === 'final' || gs === 'post' ? 'final' : 'live';
      }
    }
  }

  const ratings = {};
  const pr = I.posratings && I.posratings.positionAgainstOpponent && I.posratings.positionAgainstOpponent.positionalRatings;
  for (const [pos, r] of Object.entries(pr || {})) ratings[pos] = Object.fromEntries(Object.entries(r.ratingsByOpponent || {}).map(([tid, x]) => [PRO[tid], x.rank]));

  const depth = {};
  for (const [id, d] of Object.entries((I.depth && I.depth.players) || {})) depth[id] = { s: d.s, d: d.d };
  // Promoted (lineup note): a player who stands higher at his place than in the depth chart kept a week earlier.
  let promoted = null;
  if (I.depthPrev) {
    promoted = {};
    for (const [id, d] of Object.entries(depth)) {
      const was = I.depthPrev[id];
      if (was && was.s === d.s && d.d < was.d && d.d <= 2) promoted[id] = d.d === 1 ? `first at ${d.s.toUpperCase()}` : `second at ${d.s.toUpperCase()}`;
    }
  }
  const injuries = ((I.injuries && I.injuries.players) || []).map((x) => ({ id: Number(x.id), name: x.name, pos: x.pos, team: PRO[x.teamId] || null, status: x.status }));
  const added = {};
  for (const t of ((I.tx && I.tx.items) || [])) {
    if (t.status !== 'completed' || Number(t.scoringPeriod) !== week) continue;
    const to = (t.teams && t.teams[0] && t.teams[0].id) || null;
    if (!to || t.kind === 'trade') continue;
    for (const a of t.adds || []) (added[to] = added[to] || new Set()).add(a.id);
  }
  return {
    week, now, waiver, regLast: cal.regLast, postFirst: cal.postFirst, postLast: cal.postLast,
    // TD: the league's trade deadline (ms), or null when it has none.
    deadline: Number(((I.settings && I.settings.settings && I.settings.settings.tradeSettings) || {}).deadlineDate) || null,
    teams, rosters, players, slots, caps, schedule, rounds, brackets, nfl, games, ratings, depth, promoted, injuries, added, live,
    projFirst: I.projFirst || {}, swing: swingOf(I.ftSwing, week),
  };
}

/**
 * Fortune Teller's swing table (app/fortune-teller/findings.js assembleSwing), keyed by team: each team's playoff odds
 * now and if it wins out, every game of the coming week with every team's odds if its team A (home) or team B wins,
 * and each team's biggest game left. Null unless the table is for this very week (it is counted at each update).
 */
export function swingOf(t, week) {
  if (!t || !Array.isArray(t.teams) || Number(t.week) !== Number(week)) return null;
  const by = (arr) => Object.fromEntries(t.teams.map((id, k) => [id, arr ? arr[k] : null]).filter(([, v]) => v != null));
  const critical = {};
  t.teams.forEach((id, k) => {
    const j = (t.critical || [])[k];
    const g = j != null && t.summaryGames ? t.summaryGames[j] : null;
    if (g) critical[id] = { week: g.week, a: g.a, b: g.b };
  });
  return { week: Number(t.week), odds: by(t.odds), winOut: by(t.winOut), critical,
    games: (t.games || []).map((g) => ({ a: g.a, b: g.b, home: by(g.home), away: by(g.away) })) };
}

function roundLabel(tier, period, firstPost, lastPost) {
  const fromEnd = Number(lastPost) - Number(period);
  const n = Number(period) - Number(firstPost) + 1;
  if (/WINNERS_CONSOLATION/.test(tier)) return fromEnd <= 0 ? 'Third place game' : `Consolation round ${n}`;
  if (/WINNERS/.test(tier)) return fromEnd <= 0 ? 'Championship' : fromEnd === 1 ? 'Semifinal' : fromEnd === 2 ? 'Quarterfinal' : `Playoff round ${n}`;
  return fromEnd <= 0 ? 'Consolation final' : fromEnd === 1 ? 'Consolation semifinal' : `Consolation round ${n}`;
}
