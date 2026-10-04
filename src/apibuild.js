/**
 * Site API: the snapshot.
 *
 * Every section of /full, every refined endpoint (with its per-team slices) and every CSV, shaped
 * from what the site already keeps (digests, Fortune Teller's summary, the score timeline and the
 * logo store) and written as one R2 object with an index of where each part starts. Built inside
 * the dataset coordinator, never on a request; an answer is a slice of bytes.
 *
 * The shaping functions are plain: they take parsed documents and return plain values, so they are
 * tested by behaviour against real captured digests. Field lists are named here, never copied from
 * a source object, so nothing a member could not see can ride along.
 */
import { SECTIONS, rowsOf, toCsv } from './apisections.js';
import { applyLiveScoring, STAT } from './llmexport.js';
import { playoffRoundLabel } from './derive.js';
import { draftPlan } from '../app/draft-helper/draftPlan.js';
import { rosterShape } from '../app/draft-helper/rosterShape.js';
import { finalPlaces } from '../app/fortune-teller/final.js';
import { schemaDoc, ORIGIN_MARK } from './apischema.js';
import { getPart, headPart } from './store.js';
import { getDataset } from './datasets.js';
import { coordinatorRefresh } from './dedupe.js';
import { timelineRead } from './timeline.js';
import { simOdds, FT_SUMMARY_KEY, FT_PIPELINE_STATUS_KEY, FT_ESPN_ODDS_KEY } from './fortuneteller.js';
import { logoObjectKey } from './logos.js';
import { createEngine } from '../app/trade-analyzer/engine.js';
import { loadConfig } from './config.js';

export const SNAPSHOT_KEY = 'site-api/snapshot.bin';
const MAGIC = 'EFTSNAP1';

/* ---- conventions ------------------------------------------------------------------------ */
const r1 = (n) => (typeof n === 'number' && isFinite(n) ? Math.round(n * 10) / 10 : null);
const r2 = (n) => (typeof n === 'number' && isFinite(n) ? Math.round(n * 100) / 100 : null);
const frac = (n, dp = 4) => (typeof n === 'number' && isFinite(n) ? Math.round(n * 10 ** dp) / 10 ** dp : null);
const num = (v) => (v === null || v === undefined || v === '' ? null : (isFinite(Number(v)) ? Number(v) : null));
/** An instant as ISO 8601 UTC with seconds and a Z. */
export function isoOf(v) {
  if (v === null || v === undefined || v === '') return null;
  const d = typeof v === 'number' ? new Date(v) : new Date(String(v));
  if (isNaN(d.getTime())) return null;
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}
/** '@ DAL' reads 'at DAL', so no answer or CSV cell ever starts with @. */
export function oppWords(o) {
  if (!o) return o == null ? null : o;
  return String(o).startsWith('@ ') ? 'at ' + String(o).slice(2) : String(o);
}
const SLOT_WORD = { Bench: 'BE', BE: 'BE', IR: 'IR' };
const slotOf = (s) => (s == null ? null : SLOT_WORD[s] || String(s));

/* ESPN's injury codes and the export's words, in the API's camelCase. */
const INJURY = {
  ACTIVE: null, NORMAL: null, QUESTIONABLE: 'questionable', DOUBTFUL: 'doubtful', OUT: 'out', INJURY_RESERVE: 'injuredReserve',
  SUSPENSION: 'suspended', DAY_TO_DAY: 'dayToDay', PROBABLE: 'probable',
  questionable: 'questionable', doubtful: 'doubtful', out: 'out', 'injured reserve': 'injuredReserve', suspended: 'suspended',
  suspension: 'suspended', 'day-to-day': 'dayToDay', probable: 'probable',
};
export function injuryOf(v) {
  if (v == null || v === '') return null;
  const s = String(v);
  if (s in INJURY) return INJURY[s];
  const k = s.toLowerCase();
  if (k in INJURY) return INJURY[k];
  return k.replace(/[^a-z]+([a-z])/g, (m, c) => c.toUpperCase());
}
const gameStateOf = (g) => (g === 'final' ? 'final' : g === 'live' || g === 'in progress' ? 'live' : 'pre');
const pointsIf = (state, v) => (state === 'pre' ? null : (typeof v === 'number' ? r1(v) : (state ? 0 : null)));

/* ---- league --------------------------------------------------------------------------------- */
const SLOT_DEFS = [
  [0, 'QB', ['QB']], [2, 'RB', ['RB']], [4, 'WR', ['WR']], [6, 'TE', ['TE']], [3, 'RB/WR', ['RB', 'WR']],
  [5, 'WR/TE', ['WR', 'TE']], [23, 'FLEX', ['RB', 'WR', 'TE']], [7, 'OP', ['QB', 'RB', 'WR', 'TE']],
  [16, 'D/ST', ['D/ST']], [17, 'K', ['K']],
];
const POSN = { 1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'D/ST' };
const DAYS = [['MONDAY', 'Mon'], ['TUESDAY', 'Tue'], ['WEDNESDAY', 'Wed'], ['THURSDAY', 'Thu'], ['FRIDAY', 'Fri'], ['SATURDAY', 'Sat'], ['SUNDAY', 'Sun']];
const SEEDING = { TOTAL_POINTS_SCORED: 'total points scored', H2H_RECORD: 'head-to-head record', INTRA_DIVISION_RECORD: 'division record', TOTAL_POINTS_AGAINST: 'total points against' };
const camel = (s) => String(s || '').toLowerCase().replace(/[_\s]+([a-z0-9])/g, (m, c) => c.toUpperCase());

function lineupSlots(settings) {
  const counts = (settings && settings.rosterSettings && settings.rosterSettings.lineupSlotCounts) || {};
  const out = [];
  for (const [id, slot, positions] of SLOT_DEFS) {
    const n = Number(counts[id] ?? counts[String(id)] ?? 0);
    if (n > 0) out.push({ slot, count: n, positions });
  }
  return out;
}
function draftType(t) { const s = String(t || '').toUpperCase(); return s === 'SNAKE' ? 'snake' : s === 'LINEAR' ? 'linear' : s === 'AUCTION' ? 'auction' : (s ? camel(s) : null); }

export function phaseOf(status, schedule) {
  const st = status || {};
  const regular = Number((schedule || {}).matchupPeriodCount) || 0;
  const latest = Number(st.latestScoringPeriod || st.currentMatchupPeriod || 0);
  const final = Number(st.finalScoringPeriod || 0);
  if (final && latest > final) return 'complete';
  if (regular && Number(st.currentMatchupPeriod || 0) > regular) return 'postseason';
  return 'regularSeason';
}

export function shapeLeague(settingsDoc, { week, draftDoc } = {}) {
  const s = (settingsDoc && settingsDoc.settings) || {};
  const status = settingsDoc.status || {};
  const roster = s.rosterSettings || {};
  const counts = roster.lineupSlotCounts || {};
  const slots = lineupSlots(s);
  const bench = Number(counts[20] || 0), ir = Number(counts[21] || 0);
  const starters = slots.reduce((a, x) => a + x.count, 0);
  const limits = {};
  for (const [id, pos] of Object.entries(POSN)) { const v = Number((roster.positionLimits || {})[id]); if (Number.isFinite(v) && v > 0) limits[pos] = v; }
  const sc = s.scoringSettings || {};
  const scoring = [];
  for (const it of sc.scoringItems || []) {
    const meta = STAT[it.statId] || ['offense', `stat ${it.statId}`];
    const dst = it.pointsOverrides && it.pointsOverrides['16'];
    const onlyDst = it.points === 0 && dst != null;
    const group = meta[0] === 'defense' || onlyDst ? 'defenseAndSpecialTeams' : meta[0] === 'returns' ? 'returnTouchdowns' : meta[0];
    const row = { group, stat: meta[1], points: onlyDst ? dst : it.points };
    if (meta[2]) row.per = meta[2];
    if (!onlyDst && dst != null && dst !== it.points) row.dstPoints = dst;
    scoring.push(row);
  }
  scoring.sort((a, b) => (a.group === b.group ? a.stat.localeCompare(b.stat) : 0));
  const sch = s.scheduleSettings || {};
  const periods = sch.matchupPeriods || {};
  const regular = Number(sch.matchupPeriodCount) || 0;
  const post = Object.keys(periods).map(Number).filter((k) => k > regular).sort((a, b) => a - b);
  const names = post.length === 1 ? ['Final'] : post.length === 2 ? ['Semifinals', 'Final']
    : post.length === 3 ? ['Quarterfinals', 'Semifinals', 'Final'] : post.map((_, i) => `Round ${i + 1}`);
  const acq = s.acquisitionSettings || {};
  const trade = s.tradeSettings || {};
  const ds = s.draftSettings || {};
  const rankType = sc.playerRankType;
  const fmt = rankType === 'PPR' ? 'full PPR' : rankType === 'PPR_HALF' ? 'half PPR' : rankType === 'STANDARD' ? 'standard scoring' : String(rankType || 'custom scoring');
  const scoringType = sc.scoringType === 'H2H_POINTS' ? 'headToHeadPoints' : sc.scoringType === 'H2H_CATEGORY' ? 'headToHeadCategories'
    : sc.scoringType === 'TOTAL_POINTS' ? 'totalPoints' : (sc.scoringType ? camel(sc.scoringType) : null);
  const tie = (r) => (!r || r === 'NONE' ? 'tiesStand' : camel(r));
  const detail = (draftDoc && draftDoc.draftDetail) || {};
  const picks = Array.isArray(detail.picks) ? detail.picks : [];
  return {
    name: s.name || '',
    season: settingsDoc.seasonId || null,
    week: week ?? (status.latestScoringPeriod || null),
    phase: phaseOf(status, sch),
    teams: Number(s.size) || null,
    scoringType,
    scoringFormat: (sc.scoringType === 'H2H_POINTS' ? 'Head-to-head points, ' : '') + fmt,
    scoring,
    lineupSlots: slots,
    benchSlots: bench,
    irSlots: ir,
    rosterSize: starters + bench,
    positionLimits: limits,
    lineupLock: roster.lineupLocktimeType === 'INDIVIDUAL_GAME' ? 'eachGame' : 'weekly',
    regularSeasonWeeks: regular || null,
    postseasonTeams: Number(sch.playoffTeamCount) || null,
    postseasonWeeksPerRound: Number(sch.playoffMatchupPeriodLength) || null,
    postseasonRounds: post.map((k, i) => ({ round: names[i], weeks: periods[k] })),
    seeding: `record, then ${SEEDING[sch.playoffSeedingRule] || (sch.playoffSeedingRule ? String(sch.playoffSeedingRule).toLowerCase().replace(/_/g, ' ') : 'league rules')}`,
    divisions: Array.isArray(sch.divisions) && sch.divisions.length > 1 ? sch.divisions.map((d) => ({ id: d.id, name: d.name, size: d.size })) : null,
    consolationBracket: !sch.consolationLadderDisabled,
    tieRule: tie(sc.matchupTieRule),
    postseasonTieRule: tie(sc.playoffMatchupTieRule),
    waivers: {
      system: acq.isUsingAcquisitionBudget ? 'faab' : 'order',
      faabBudget: acq.isUsingAcquisitionBudget ? num(acq.acquisitionBudget) : null,
      minimumBid: acq.isUsingAcquisitionBudget ? num(acq.minimumBid) : null,
      hoursOnWaivers: num(acq.waiverHours),
      orderResets: acq.waiverOrderReset ? 'weekly' : 'rolling',
      processDays: DAYS.filter(([d]) => (acq.waiverProcessDays || []).includes(d)).map(([, w]) => w),
      acquisitionLimit: acq.acquisitionLimit == null || acq.acquisitionLimit < 0 ? null : acq.acquisitionLimit,
    },
    trades: {
      deadline: isoOf(trade.deadlineDate),
      reviewHours: num(trade.revisionHours),
      vetoVotesToReject: num(trade.vetoVotesRequired),
      limit: trade.max == null || trade.max < 0 ? null : trade.max,
    },
    draft: {
      type: draftType(ds.type),
      date: isoOf(ds.date),
      rounds: picks.length ? Math.max(...picks.map((p) => p.roundId || 0)) : null,
      keepers: Number(ds.keeperCount) || 0,
    },
  };
}

/* ---- the export's rosters, free agents and teams ------------------------------------------------ */
function rosterRow(t, p) {
  const tw = p.thisWeek || {};
  const bye = tw.opponent === 'BYE';
  const state = p.thisWeek && !bye ? gameStateOf(tw.game) : null;
  return {
    teamId: t.teamId, team: t.name, slot: slotOf(p.slot), playerId: p.id, player: p.name, position: p.pos, nflTeam: p.nflTeam,
    opponent: bye ? 'BYE' : oppWords(tw.opponent), gameState: state, kickoff: isoOf(tw.kickoff),
    points: state ? pointsIf(state, tw.points) : null, projected: tw.projected ?? null,
    seasonPoints: p.seasonPts ?? null, seasonAverage: p.seasonAvg ?? null, injuryStatus: injuryOf(p.injury), bye: p.bye ?? null,
  };
}
export function shapeRosters(exportDoc) {
  const base = [], full = [];
  for (const t of (exportDoc && exportDoc.teams) || []) {
    for (const p of t.roster || []) {
      const row = rosterRow(t, p);
      base.push(row);
      const weekly = p.weekly || {};
      full.push({
        ...row,
        pointsByWeek: Object.fromEntries(Object.keys(weekly).map(Number).sort((a, b) => a - b).map((k) => [String(k), weekly[k]])),
        positionRank: p.posRank ?? null, restOfSeasonProjection: p.rosProj ?? null,
        percentOwned: p.owned != null ? frac(p.owned / 100) : null, acquired: p.acquired ?? null,
      });
    }
  }
  return { base, full };
}
export function shapeFreeAgents(exportDoc) {
  return (((exportDoc && exportDoc.freeAgents) || {}).players || []).map((p) => {
    const tw = p.thisWeek || {};
    const bye = tw.opponent === 'BYE';
    const state = p.thisWeek && !bye ? gameStateOf(tw.game) : null;
    return {
      playerId: p.id, player: p.name, position: p.pos, nflTeam: p.nflTeam, bye: p.bye ?? null,
      opponent: bye ? 'BYE' : oppWords(tw.opponent), kickoff: isoOf(tw.kickoff), gameState: state,
      projected: tw.projected ?? null, seasonPoints: p.seasonPts ?? null, seasonAverage: p.seasonAvg ?? null,
      positionRank: p.posRank ?? null, restOfSeasonProjection: p.rosProj ?? null,
      percentOwned: p.owned != null ? frac(p.owned / 100) : null,
      status: p.availability === 'on waivers' ? 'onWaivers' : 'freeAgent', waiversClear: isoOf(p.waiversClear),
    };
  });
}
export function shapeTeams(exportDoc, standingsRows) {
  const byId = new Map((standingsRows || []).map((r) => [r.teamId, r]));
  return ((exportDoc && exportDoc.teams) || []).map((t) => {
    const s = byId.get(t.teamId) || {};
    const m = t.seasonMoves || {};
    return { teamId: t.teamId, name: t.name, abbreviation: s.abbrev ?? null, wins: s.wins ?? null, losses: s.losses ?? null, ties: s.ties ?? null,
      waiverPriority: t.waiverPriority ?? null, acquisitions: m.acquisitions ?? 0, drops: m.drops ?? 0, trades: m.trades ?? 0 };
  });
}

/* ---- standings ------------------------------------------------------------------------------------ */
/**
 * Standings by seed. `sim` is Fortune Teller's reading (simOdds()), or null to leave its odds out
 * (the tool not visible to members). After the regular season every team is clinched or eliminated.
 */
export function shapeStandings(standingsDoc, sim) {
  const rows = ((standingsDoc && standingsDoc.rows) || []).slice().sort((a, b) => (a.rank || a.seed || 99) - (b.rank || b.seed || 99));
  const fin = sim && sim.final && sim.final.seasonOver ? sim.final.inByTeam : null;
  return rows.map((r) => {
    const s = sim && sim.byTeam && typeof sim.byTeam[r.teamId] === 'number' ? sim.byTeam[r.teamId] : null;
    let decided = null;
    if (fin && fin[r.teamId] != null) decided = fin[r.teamId] ? 'clinched' : 'eliminated';
    else if (s != null && s >= 0.9995) decided = 'clinched';
    else if (s != null && s <= 0.0005) decided = 'eliminated';
    return {
      seed: r.rank ?? r.seed ?? null, teamId: r.teamId, team: r.name, wins: r.wins ?? 0, losses: r.losses ?? 0, ties: r.ties ?? 0,
      pointsFor: r2(r.pointsFor), pointsAgainst: r2(r.pointsAgainst), streak: r.streak || null,
      playoffOdds: fin && fin[r.teamId] != null ? (fin[r.teamId] ? 1 : 0) : frac(r.playoffPct),
      simPlayoffOdds: s != null ? frac(s) : null, decided,
    };
  });
}

/* ---- this week: the scoreboard and every lineup ------------------------------------------------ */
function sideOf(s) {
  const c = s.counts || {};
  return { teamId: s.teamId, team: s.name, points: r2(s.points), projected: r2(s.projected),
    winProbability: s.winProb != null ? frac(s.winProb / 100, 3) : null, yetToPlay: c.upcoming || 0, playing: c.live || 0, done: c.final || 0 };
}
export function currentGames(liveDoc) {
  const mp = Number(liveDoc && liveDoc.matchupPeriod);
  return ((liveDoc && liveDoc.games) || []).filter((g) => g && g.home && g.away && (!mp || Number(g.period) === mp));
}
export function shapeScoreboard(liveDoc, games = currentGames(liveDoc)) {
  return games.map((g) => {
    const h = sideOf(g.home), a = sideOf(g.away);
    const left = h.yetToPlay + h.playing + a.yetToPlay + a.playing;
    const state = left === 0 && h.done + a.done > 0 ? 'final' : (g.state === 'live' ? 'live' : g.state === 'final' ? 'final' : 'pre');
    return { matchupId: g.id, week: g.period, state, firstKickoff: isoOf(g.firstKickoff), home: h, away: a };
  });
}
function lineupOf(s, g) {
  const boom = new Set((g.boom || []).map((p) => p.id)), bust = new Set((g.bust || []).map((p) => p.id));
  return [...(s.starters || []), ...(s.bench || [])].map((p) => {
    const state = gameStateOf(p.gameStatus);
    return { slot: slotOf(p.slot), playerId: p.id, player: p.name, position: p.pos, nflTeam: p.nfl, game: p.game || null,
      gameState: p.game ? state : null, kickoff: isoOf(p.kickoff), points: p.game ? pointsIf(state, p.points) : null, projected: r1(p.proj),
      starter: Boolean(p.starter), call: boom.has(p.id) ? 'boom' : bust.has(p.id) ? 'bust' : null, injuryStatus: injuryOf(p.injury) };
  });
}
export function shapeLive(liveDoc, games = currentGames(liveDoc)) {
  const board = shapeScoreboard(liveDoc, games);
  return games.map((g, i) => ({ ...board[i], home: { ...board[i].home, lineup: lineupOf(g.home, g) }, away: { ...board[i].away, lineup: lineupOf(g.away, g) } }));
}

/** One row per matchup per change. `rows` are the timeline's own: { t, m: { id: [home, away, winPct] } }. */
export function shapeTimeline(rows, week) {
  const out = [];
  for (const r of rows || []) {
    for (const mid of Object.keys(r.m || {}).sort((a, b) => Number(a) - Number(b))) {
      const v = r.m[mid] || [];
      out.push({ week, matchupId: Number(mid), at: isoOf(r.t), homePoints: r2(v[0]), awayPoints: r2(v[1]),
        homeWinProbability: v[2] != null ? frac(v[2] / 100, 3) : null });
    }
  }
  return out;
}

/* ---- the season's schedule ---------------------------------------------------------------------- */
export function shapeSchedule(scheduleDoc, settingsDoc, names, scoreboard, current) {
  const sch = ((settingsDoc && settingsDoc.settings) || {}).scheduleSettings || {};
  const periods = sch.matchupPeriods || {};
  const regular = Number(sch.matchupPeriodCount) || 0;
  const postKeys = Object.keys(periods).map(Number).filter((k) => k > regular);
  const bounds = { firstPlayoffWeek: postKeys.length ? Math.min(...postKeys) : regular + 1, lastPlayoffWeek: postKeys.length ? Math.max(...postKeys) : regular + 1 };
  const board = new Map((scoreboard || []).map((m) => [m.matchupId, m]));
  const list = ((scheduleDoc && scheduleDoc.schedule) || []).slice().sort((a, b) => (a.matchupPeriodId - b.matchupPeriodId) || (a.id - b.id));
  return list.map((m) => {
    const wk = m.matchupPeriodId;
    const now = board.get(m.id);
    const state = wk < current ? 'final' : wk > current ? 'pre' : (now ? now.state : 'pre');
    const pts = (x, sideNow) => {
      if (!x) return null;
      if (wk > current) return null;
      if (wk === current) return sideNow ? sideNow.points : r2(x.totalPointsLive ?? x.totalPoints);
      return r2(x.totalPoints);
    };
    const side = (x, sideNow) => (x ? { teamId: x.teamId, team: names[x.teamId] || null, points: pts(x, sideNow) } : null);
    let winner = null;
    if (state === 'final') {
      if (m.winner === 'HOME' && m.home) winner = m.home.teamId;
      else if (m.winner === 'AWAY' && m.away) winner = m.away.teamId;
      else if (wk === current && now && now.home.points !== now.away.points) winner = now.home.points > now.away.points ? now.home.teamId : now.away.teamId;
    }
    return { week: wk, matchupId: m.id, home: side(m.home, now && now.home), away: side(m.away, now && now.away), winnerTeamId: winner, state,
      postseasonRound: playoffRoundLabel(m.playoffTierType, wk, bounds) };
  });
}

/* ---- players, the draft ---------------------------------------------------------------------------- */
export function shapePlayers(playerDoc, names) {
  return ((playerDoc && playerDoc.players) || []).map((p) => ({
    playerId: p.id, player: p.name, position: p.pos, nflTeam: p.nfl, bye: p.bye ?? null, adp: p.adp ?? null, rank: p.rank ?? null,
    percentOwned: p.percentOwned != null ? frac(p.percentOwned / 100) : null, injuryStatus: injuryOf(p.injuryStatus),
    teamId: p.onTeamId || null, team: p.onTeamId ? names[p.onTeamId] || null : null,
  }));
}
export function shapeDraft(draftDoc, playerDoc, names) {
  const detail = (draftDoc && draftDoc.draftDetail) || {};
  const ds = ((draftDoc && draftDoc.settings) || {}).draftSettings || {};
  const byId = new Map(((playerDoc && playerDoc.players) || []).map((p) => [p.id, p]));
  return {
    type: draftType(ds.type), date: isoOf(ds.date),
    picks: (detail.picks || []).slice().sort((a, b) => a.overallPickNumber - b.overallPickNumber).map((k) => {
      const p = byId.get(k.playerId) || {};
      return { overall: k.overallPickNumber, round: k.roundId, pick: k.roundPickNumber, teamId: k.teamId, team: names[k.teamId] || null,
        playerId: k.playerId, player: p.name || null, position: p.pos || null, nflTeam: p.nfl || null, keeper: Boolean(k.keeper) };
    }),
  };
}
export function shapeDraftOrder(draftDoc, names) {
  const settings = (draftDoc && draftDoc.settings) || {};
  const picks = ((draftDoc && draftDoc.draftDetail) || {}).picks || [];
  const plan = draftPlan(settings, picks);
  const shape = rosterShape(settings);
  const counts = (settings.rosterSettings && settings.rosterSettings.lineupSlotCounts) || {};
  const n = plan.order.length;
  const slots = [];
  for (let r = 0; r < plan.rounds; r++) {
    for (let c = 0; c < n; c++) {
      const cell = plan.slotAt(r, c);
      const original = plan.order[c];
      const holder = cell.pick ? cell.pick.teamId : original;
      const within = plan.snake && r % 2 === 1 ? n - c : c + 1;
      slots.push({ round: r + 1, pick: within, overall: cell.overall, teamId: holder, team: names[holder] || null, originalTeamId: original, traded: holder !== original });
    }
  }
  slots.sort((a, b) => a.overall - b.overall);
  return {
    type: draftType(plan.type) || (plan.snake ? 'snake' : 'linear'), rounds: plan.rounds,
    pickOrder: plan.order.map((t) => ({ teamId: t, team: names[t] || null })),
    slots,
    rosterShape: { lineupSlots: lineupSlots(settings), benchSlots: shape.bench, irSlots: Number(counts[21] || 0) },
  };
}

/* ---- league activity -------------------------------------------------------------------------------- */
const KIND = { add: 'add', drop: 'drop', swap: 'addDrop', waiver: 'waiver', trade: 'trade' };
const TSTATUS = { completed: 'completed', on_the_table: 'onTheTable', pending_approval: 'pendingApproval', rejected: 'rejected', cancelled: 'withdrawn', withdrawn: 'withdrawn', expired: 'expired' };
const pl = (p) => ({ playerId: p.id, player: p.name, position: p.pos, nflTeam: p.nfl });
export function shapeActivity(txDoc) {
  const transactions = [], trades = [], activity = [];
  for (const t of (txDoc && txDoc.items) || []) {
    if (t.kind !== 'trade' && t.status !== 'completed') continue;   // a failed claim is not a move; pending claims are never listed
    const row = { id: String(t.id), at: isoOf(t.date), week: t.scoringPeriod ?? null, kind: KIND[t.kind] || t.kind,
      status: TSTATUS[t.status] || t.status, teams: (t.teams || []).map((x) => ({ teamId: x.id, team: x.name })) };
    if (t.kind === 'trade') {
      row.sides = (t.sides || []).map((s) => ({ teamId: s.team && s.team.id, team: s.team && s.team.name, sends: (s.players || []).map(pl) }));
      row.added = []; row.dropped = []; row.bid = null;
      trades.push({ id: row.id, at: row.at, week: row.week, status: row.status, teams: row.teams, sides: row.sides });
    } else {
      row.added = (t.adds || []).map(pl); row.dropped = (t.drops || []).map(pl); row.sides = []; row.bid = t.bid ?? null;
      transactions.push({ id: row.id, at: row.at, week: row.week, kind: row.kind, teams: row.teams, added: row.added, dropped: row.dropped, bid: row.bid });
    }
    activity.push({ id: row.id, at: row.at, week: row.week, kind: row.kind, status: row.status, teams: row.teams, added: row.added, dropped: row.dropped, sides: row.sides, bid: row.bid });
  }
  const newest = (a, b) => String(b.at || '').localeCompare(String(a.at || ''));
  transactions.sort(newest); trades.sort(newest); activity.sort(newest);
  return { transactions, trades, activity };
}

/* ---- the NFL ------------------------------------------------------------------------------------------ */
export function shapeNfl(byeDoc, boardDoc, exportDoc, currentNflWeek) {
  const byes = (byeDoc && byeDoc.byes) || {};
  const info = (byeDoc && byeDoc.teams) || {};
  const teams = Object.keys(byes).sort().map((abbr) => {
    const t = info[abbr] || {};
    const [w, l, tie] = String(t.record || '0-0').split('-').map((x) => Number(x) || 0);
    const m = /^(\d+)\w*\s+in\s+(.+)$/.exec(t.standing || '');
    return { nflTeam: abbr, name: t.name || null, wins: w, losses: l, ties: tie || 0, division: m ? m[2] : null, divisionRank: m ? Number(m[1]) : null, bye: byes[abbr] || null };
  });
  const scoreOf = (v) => (v === null || v === undefined || v === '' ? null : num(v));
  const stateOf = (g) => (g.final ? 'final' : g.inProgress ? 'live' : 'pre');
  const boardWeek = boardDoc && Number(boardDoc.week);
  const board = (boardDoc && boardDoc.games) || [];
  const schedule = [];
  const weeks = Object.keys((byeDoc && byeDoc.fixtures) || {}).map(Number).sort((a, b) => a - b);
  for (const wk of weeks) {
    const list = wk === boardWeek && board.length ? board : byeDoc.fixtures[wk] || [];
    for (const g of list) schedule.push({ week: wk, away: g.away, home: g.home, kickoff: isoOf(g.kickoff), awayScore: scoreOf(g.awayScore), homeScore: scoreOf(g.homeScore), state: stateOf(g) });
  }
  const scoreboard = board.map((g) => ({ away: g.away, home: g.home, kickoff: isoOf(g.kickoff), awayScore: scoreOf(g.awayScore), homeScore: scoreOf(g.homeScore), state: stateOf(g) }));
  const pointsAllowed = [];
  const dvp = ((exportDoc && exportDoc.nfl) || {}).pointsAllowedByPosition || {};
  for (const pos of Object.keys(dvp)) for (const [team, v] of Object.entries(dvp[pos] || {})) pointsAllowed.push({ nflTeam: team, position: pos, rank: v.rank ?? null, averagePointsAllowed: v.avg ?? null });
  return { teams, schedule, scoreboard, pointsAllowed, week: currentNflWeek ?? boardWeek ?? null };
}
export function shapeInjuries(injDoc, byeDoc) {
  const abbrOf = {};
  for (const [abbr, t] of Object.entries((byeDoc && byeDoc.teams) || {})) if (t && t.name) abbrOf[t.name] = abbr;
  return ((injDoc && injDoc.players) || []).map((p) => ({
    playerId: num(p.id), player: p.name, position: p.pos || null, nflTeam: abbrOf[p.team] || null,
    status: injuryOf(p.status), type: p.type || null, date: isoOf(p.date), note: p.note || null,
  }));
}
export function shapeNews(newsDoc) {
  return ((newsDoc && newsDoc.articles) || []).map((a) => ({
    id: a.id, headline: a.headline || null, description: a.description || null, published: isoOf(a.published), type: a.type || null,
    link: (((a.links || {}).web) || {}).href || null,
  }));
}

/* ---- Hall of Fame -------------------------------------------------------------------------------------- */
const REC = { mostChampionships: 'Most championships', highestWinPct: 'Highest win percentage', bestAvgFinish: 'Best average finish',
  mostPoints: 'Most points, all time', bestDiff: 'Best points difference', mostPlayoffApps: 'Most postseason appearances',
  longestWinStreak: 'Longest winning streak', longestLossStreak: 'Longest losing streak', highestSingleGame: 'Highest single game',
  lowestSingleGame: 'Lowest single game', biggestBlowout: 'Biggest blowout', closestGame: 'Closest game',
  mostLopsidedMatchup: 'Most lopsided rivalry', closestMatchup: 'Closest rivalry', mostTransactions: 'Most transactions', mostTrades: 'Most trades' };
export function shapeHallOfFame(book, pairs, names) {
  const nm = (id) => names[id] || ((book.rows || []).find((r) => r.teamId === id) || {}).name || null;
  const history = {
    champions: (book.champions || []).filter((c) => !c.placeholder && c.teamId != null).map((c) => ({ season: c.year, teamId: c.teamId, team: nm(c.teamId) })),
    allTime: (book.rows || []).map((r) => ({
      teamId: r.teamId, team: nm(r.teamId), seasons: (r.seasons || []).length, wins: r.record.wins, losses: r.record.losses, ties: r.record.ties,
      winPct: frac(r.record.winPct), pointsFor: r2(r.points.for), pointsAgainst: r2(r.points.against), pointsPerGame: r2(r.points.perGame),
      championships: (r.championships || {}).count || 0, runnerUp: (r.runnerUp || {}).count || 0, postseasonAppearances: (r.postseason || {}).appearances || 0,
      bestFinish: r.bestFinish ? r.bestFinish.rank : null, worstFinish: r.worstFinish ? r.worstFinish.rank : null, averageFinish: r.avgFinish ?? null,
      longestWinStreak: r.bestWinStreak ? r.bestWinStreak.length : null, longestLossStreak: r.worstLossStreak ? r.worstLossStreak.length : null,
    })),
  };
  const records = [];
  for (const [k, holders] of Object.entries(book.records || {})) {
    for (const h of holders || []) {
      const tid = h.teamId ?? h.winner ?? h.dominantTeam ?? null;
      const other = h.opponent ?? h.loser ?? (h.teamA != null ? (h.teamA === tid ? h.teamB : h.teamA) : null);
      const value = h.value ?? h.points ?? h.margin ?? h.winPct ?? null;
      records.push({ record: k, label: REC[k] || k, teamId: tid, team: nm(tid), value: typeof value === 'number' ? (k === 'highestWinPct' || k === 'mostLopsidedMatchup' || k === 'closestMatchup' ? frac(value) : r2(value)) : value,
        season: h.season ?? (h.at || {}).season ?? null, week: h.week ?? (h.at || {}).week ?? null, opponentTeamId: other ?? null, tied: holders.length > 1 });
    }
  }
  const teamHistory = [];
  for (const r of book.rows || []) {
    for (const s of r.seasonLog || []) {
      teamHistory.push({ teamId: r.teamId, team: nm(r.teamId), season: s.year, wins: s.wins, losses: s.losses, ties: s.ties,
        pointsFor: r2(s.pf), pointsAgainst: r2(s.pa), finish: s.rank ?? null, teams: s.size ?? null, champion: s.rank === 1 });
    }
  }
  const headToHead = Object.entries(pairs || {}).map(([key, p]) => {
    const [a, b] = key.split(':').map(Number);
    return { teamA: a, teamAName: nm(a), teamB: b, teamBName: nm(b), winsA: p.lowWins, winsB: p.highWins, ties: p.ties,
      pointsA: r2(p.lowPoints), pointsB: r2(p.highPoints),
      games: (p.games || []).map((g) => ({ season: g.season, week: g.week, pointsA: r2(g.lowPts), pointsB: r2(g.highPts), postseason: Boolean(g.postseason), round: g.round || null })) };
  }).sort((x, y) => (x.teamA - y.teamA) || (x.teamB - y.teamB));
  return { history, records, teamHistory, headToHead };
}

/* ---- Fortune Teller -------------------------------------------------------------------------------------- */
const FT_STATE = { early: 'early', available: 'available', building: 'building', updating: 'updating', ready: 'ready',
  'season-over': 'seasonOver', failed: 'failed', 'no-data': 'noData' };
function words(list) { return list.length <= 1 ? list.join('') : list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1]; }
/** The simplest path in words: "win out", or the results it needs. */
export function simplestWords(summary, ti, set, fixed) {
  if (!set) return null;
  if (!set.length) return 'already in';
  const id = summary.teams[ti].id, nm = (x) => (summary.teams.find((t) => t.id === x) || {}).name || String(x);
  const own = summary.games.map((g, j) => j).filter((j) => j >= fixed && (summary.games[j].a === id || summary.games[j].b === id));
  const wins = [], others = [];
  for (const [j, d] of set) {
    const g = summary.games[j], winner = d === 1 ? g.a : g.b, loser = d === 1 ? g.b : g.a;
    if (winner === id) wins.push(g.week); else if (loser === id) others.push(`a loss in week ${g.week}`); else others.push(`${nm(winner)} to beat ${nm(loser)} in week ${g.week}`);
  }
  if (!others.length && wins.length === own.length && own.length) return 'win out';
  const parts = [];
  if (wins.length) parts.push(`win${wins.length > 1 ? 's' : ''} in week${wins.length > 1 ? 's' : ''} ${words(wins.map(String))}`);
  return words(parts.concat(others));
}
export function shapeFortune({ summary, pipeline, espnOdds, sim, standings }) {
  const order = (standings || []).map((s) => s.teamId);
  const name = (id) => ((standings || []).find((s) => s.teamId === id) || {}).team || ((summary && summary.teams) || []).find((t) => t.id === id)?.name || null;
  const st = sim && sim.state ? sim.state : pipeline && pipeline.state;
  const ids = order.length ? order : ((summary && summary.teams) || []).map((t) => t.id);
  const active = summary && Array.isArray(summary.trims) && summary.trims.length
    ? Math.max(0, Math.min(summary.trims.length - 1, summary.activeTrim ?? summary.trims.length - 1)) : null;
  const tr = active != null ? summary.trims[active] : null;
  const ixOf = new Map(((summary && summary.teams) || []).map((t, i) => [t.id, i]));
  const byTeam = (sim && sim.byTeam) || {};
  const windowWeeks = summary ? [...new Set(summary.games.map((g) => g.week))].sort((a, b) => a - b) : null;
  const fortuneTeller = {
    state: FT_STATE[st] || (st ? camel(st) : null),
    opensAfterWeek: pipeline && pipeline.opensAfterWeek != null ? pipeline.opensAfterWeek : (sim && sim.opensAfterWeek) ?? null,
    weeksCovered: windowWeeks,
    lastSettledWeek: pipeline && pipeline.lastSettled != null ? pipeline.lastSettled : null,
    simulatedThroughWeek: tr ? tr.thru : null,
    paths: summary ? summary.paths ?? null : null,
    teams: ids.map((id) => ({ teamId: id, team: name(id), simPlayoffOdds: typeof byTeam[id] === 'number' ? frac(byTeam[id]) : null })),
  };
  const fortuneOdds = [];
  const espnWeeks = ((espnOdds && espnOdds.weeks) || {});
  const simByWeek = new Map();
  if (summary) for (const t of summary.trims || []) if (Array.isArray(t.odds)) simByWeek.set(t.thru, t.odds);
  const weeks = [...new Set([...Object.keys(espnWeeks).map(Number), ...simByWeek.keys()])].sort((a, b) => a - b);
  for (const w of weeks) {
    const e = espnWeeks[String(w)] || {};
    const so = simByWeek.get(w);
    for (const id of ids) {
      const i = ixOf.get(id);
      fortuneOdds.push({ week: w, teamId: id, team: name(id), espnPlayoffOdds: typeof e[id] === 'number' ? frac(e[id]) : null,
        simPlayoffOdds: so && i != null && typeof so[i] === 'number' ? frac(so[i]) : null });
    }
  }
  const fortuneFinishes = [];
  if (summary) for (const t0 of summary.trims || []) {
    // Once every game is played each team's place is exact, however the map shares out level teams.
    const exact = finalPlaces(summary, t0), t = exact ? { ...t0, places: exact } : t0;
    if (!Array.isArray(t.places)) continue;
    for (const id of ids) {
      const i = ixOf.get(id); const spread = i != null ? t.places[i] : null;
      if (!Array.isArray(spread)) continue;
      spread.forEach((c, p) => fortuneFinishes.push({ week: t.thru, teamId: id, team: name(id), place: p + 1, chance: frac(c) }));
    }
  }
  const fortuneGames = [], fortunePaths = [];
  if (summary && tr) {
    const fixed = tr.fixed || 0;
    summary.games.forEach((g, j) => {
      if (j < fixed) return;
      fortuneGames.push({ week: g.week, home: { teamId: g.a, team: name(g.a), winChance: frac(g.pA, 3), projected: r1(g.projA) },
        away: { teamId: g.b, team: name(g.b), winChance: frac(g.pB, 3), projected: r1(g.projB) }, tieChance: frac(g.pT, 3) });
    });
    const res = (digit, g) => (digit === 1 ? g.a : digit === 2 ? g.b : null);
    for (const id of ids) {
      const i = ixOf.get(id); if (i == null) continue;
      const digits = String((tr.defaultPath || [])[i] || '');
      const best = digits ? summary.games.map((g, j) => ({ j, g })).filter(({ j }) => j >= fixed).map(({ j, g }) => ({ week: g.week, home: g.a, away: g.b, winnerTeamId: res(Number(digits[j]), g) })) : null;
      const sp = (tr.simplest || [])[i];
      const pinned = new Map(sp && sp.set ? sp.set.map(([j, d]) => [j, d]) : []);
      const simplest = sp && sp.set ? summary.games.map((g, j) => ({ j, g })).filter(({ j }) => j >= fixed).map(({ j, g }) => ({ week: g.week, home: g.a, away: g.b, winnerTeamId: pinned.has(j) ? res(pinned.get(j), g) : null })) : null;
      const espn = summary.games.map((g, j) => ({ j, g })).filter(({ j }) => j >= fixed).map(({ g }) => ({ week: g.week, home: g.a, away: g.b, winnerTeamId: (g.projA ?? 0) >= (g.projB ?? 0) ? g.a : g.b }));
      fortunePaths.push({ teamId: id, team: name(id), bestPath: best, simplestPath: simplest, espnProjectedPath: espn,
        simplestNeeds: sp && sp.set ? simplestWords(summary, i, sp.set, fixed) : null });
    }
  }
  return { fortuneTeller, fortuneOdds, fortuneFinishes, fortuneGames, fortunePaths, hasSim: Boolean(tr), hasPlaces: fortuneFinishes.length > 0 };
}

/* ---- games on: kickoff windows for this NFL week ------------------------------------------------------ */
const GAME_MS = 4 * 3600000;
/** The week's kickoff windows as [start, end] in ms, merged; games are on while now is inside one. */
export function gameWindows(boardDoc) {
  const ks = ((boardDoc && boardDoc.games) || []).map((g) => Date.parse(g.kickoff)).filter((t) => isFinite(t)).sort((a, b) => a - b);
  const out = [];
  for (const k of ks) {
    const last = out[out.length - 1];
    if (last && k <= last[1]) last[1] = Math.max(last[1], k + GAME_MS); else out.push([k, k + GAME_MS]);
  }
  return out;
}
export function gamesOn(windows, now) { return (windows || []).some(([a, b]) => now >= a && now < b); }

/* ---- the whole shape --------------------------------------------------------------------------------- */
/**
 * Every section from parsed sources. `src` holds the documents by dataset key, plus `timeline`
 * (the timeline's rows), `ft` ({ summary, pipeline, espnOdds, sim }) and `logos` ({ teamId: image }).
 */
export function shapeAll(src, { now = Date.now() } = {}) {
  const settingsDoc = src.league_settings;
  const exportDigest = src.llm_export_digest && src.live_scoring_digest ? applyLiveScoring(src.llm_export_digest, src.live_scoring_digest, now) : src.llm_export_digest;
  const exportDoc = exportDigest && exportDigest.export;
  const standingsDoc = src.standings_digest;
  const liveDoc = src.live_scoring_digest;
  const ready = Boolean(settingsDoc && settingsDoc.settings && exportDoc && Array.isArray(exportDoc.teams) && exportDoc.teams.length
    && standingsDoc && Array.isArray(standingsDoc.rows) && standingsDoc.rows.length);
  if (!ready) return { ready: false };
  const names = {};
  for (const t of exportDoc.teams) names[t.teamId] = t.name;
  for (const r of standingsDoc.rows) if (!names[r.teamId]) names[r.teamId] = r.name;
  const status = settingsDoc.status || {};
  const week = Number(status.latestScoringPeriod || (liveDoc && liveDoc.scoringPeriod) || 0) || null;
  const matchupPeriod = Number((liveDoc && liveDoc.matchupPeriod) || status.currentMatchupPeriod || week || 0);
  const games = currentGames(liveDoc);
  const scoreboard = shapeScoreboard(liveDoc, games);
  const rosters = shapeRosters(exportDoc);
  const fortune = shapeFortune({ ...(src.ft || {}), standings: shapeStandings(standingsDoc, null) });
  const standings = shapeStandings(standingsDoc, src.ft && src.ft.sim);
  const standingsNoSim = shapeStandings(standingsDoc, src.ft && src.ft.sim && src.ft.sim.final ? { final: src.ft.sim.final } : null);
  const act = shapeActivity(src.transaction_digest);
  const nfl = shapeNfl(src.bye_weeks, src.scoreboard_digest, exportDoc, src.scoreboard_digest && src.scoreboard_digest.week);
  const hof = src.league_history_digest && Array.isArray(src.league_history_digest.rows)
    ? shapeHallOfFame(src.league_history_digest, (src.h2h_full_digest && src.h2h_full_digest.pairs) || {}, names)
    : { history: { champions: [], allTime: [] }, records: [], teamHistory: [], headToHead: [] };
  const draftDoc = src.draft_results;
  const sections = {
    league: shapeLeague(settingsDoc, { week, draftDoc }),
    teams: shapeTeams(exportDoc, standingsDoc.rows),
    rosters: rosters.full,
    standings,
    schedule: shapeSchedule(src.season_schedule, settingsDoc, names, scoreboard, matchupPeriod),
    scoreboard,
    players: shapePlayers(src.player_digest, names),
    freeAgents: shapeFreeAgents(exportDoc),
    transactions: act.transactions,
    trades: act.trades,
    draft: draftDoc ? shapeDraft(draftDoc, src.player_digest, names) : { type: null, date: null, picks: [] },
    logos: Object.keys(names).map(Number).sort((a, b) => a - b).map((id) => ({ teamId: id, team: names[id], image: (src.logos || {})[id] || null })),
    nflTeams: nfl.teams,
    nflSchedule: nfl.schedule,
    nflScoreboard: nfl.scoreboard,
    injuries: shapeInjuries(src.injuries_digest, src.bye_weeks),
    news: shapeNews(src.nfl_news),
    pointsAllowed: nfl.pointsAllowed,
    live: shapeLive(liveDoc, games),
    timeline: shapeTimeline(src.timeline, matchupPeriod),
    history: hof.history,
    records: hof.records,
    teamHistory: hof.teamHistory,
    headToHead: hof.headToHead,
    fortuneTeller: fortune.fortuneTeller,
    fortuneOdds: fortune.fortuneOdds,
    fortuneFinishes: fortune.fortuneFinishes,
    fortuneGames: fortune.fortuneGames,
    fortunePaths: fortune.fortunePaths,
    tradeAnalysis: shapeTradeAnalysis(src.trade_digest, src.tradeWeights),
    draftOrder: draftDoc ? shapeDraftOrder(draftDoc, names) : null,
  };
  const leftOut = {
    ...(fortune.hasSim ? {} : {
      fortuneFinishes: 'Appears once Fortune Teller’s first simulation has run' + (fortune.fortuneTeller.opensAfterWeek ? ` (after week ${fortune.fortuneTeller.opensAfterWeek} settles).` : '.'),
      fortuneGames: 'Appears once Fortune Teller’s first simulation has run' + (fortune.fortuneTeller.opensAfterWeek ? ` (after week ${fortune.fortuneTeller.opensAfterWeek} settles).` : '.'),
      fortunePaths: 'Appears once Fortune Teller’s first simulation has run' + (fortune.fortuneTeller.opensAfterWeek ? ` (after week ${fortune.fortuneTeller.opensAfterWeek} settles).` : '.'),
    }),
    ...(fortune.hasSim && !fortune.hasPlaces ? { fortuneFinishes: 'Appears once Fortune Teller next builds or moves its simulation on a week.' } : {}),
  };
  const detail = (draftDoc && draftDoc.draftDetail) || {};
  return {
    ready: true,
    leagueName: sections.league.name, season: sections.league.season, week, matchupPeriod, phase: sections.league.phase,
    teams: Object.keys(names).map(Number).sort((a, b) => a - b), names,
    sections, standingsNoSim, rosterRows: rosters.base, activity: act.activity, leftOut,
    windows: gameWindows(src.scoreboard_digest), draftLive: Boolean(detail.inProgress),
  };
}

/* ---- the one object: bodies and their index ------------------------------------------------------------ */
const enc = new TextEncoder();
const dec = new TextDecoder();

/** FNV-1a over bytes, as 8 hex digits: each part's own fingerprint, for ETags. */
export function fnv(bytes) {
  let x = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) { x ^= bytes[i]; x = Math.imul(x, 0x01000193); }
  return (x >>> 0).toString(16).padStart(8, '0');
}

/**
 * Lays every part out once. Each entry of `parts` is [name, text]; the index says where each starts
 * and how long it is, so an answer is a slice of the object and nothing is parsed on a request.
 */
export function packSnapshot(index, parts) {
  const bodies = parts.map(([n, t]) => [n, enc.encode(t)]);
  let off = 0;
  const at = {}, h = {};
  for (const [n, b] of bodies) { at[n] = [off, b.length]; h[n] = fnv(b); off += b.length; }
  const head = enc.encode(JSON.stringify({ ...index, at, h }));
  const out = new Uint8Array(MAGIC.length + 4 + head.length + off);
  out.set(enc.encode(MAGIC), 0);
  new DataView(out.buffer).setUint32(MAGIC.length, head.length);
  out.set(head, MAGIC.length + 4);
  let p = MAGIC.length + 4 + head.length;
  for (const [, b] of bodies) { out.set(b, p); p += b.length; }
  return out;
}

/** An object read back: its index, and a way to take any part as bytes or text. */
export function openSnapshot(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (dec.decode(u8.subarray(0, MAGIC.length)) !== MAGIC) throw new Error('not a Site API snapshot');
  const len = new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getUint32(MAGIC.length);
  const index = JSON.parse(dec.decode(u8.subarray(MAGIC.length + 4, MAGIC.length + 4 + len)));
  const base = MAGIC.length + 4 + len;
  const bytesOf = (name) => { const a = index.at[name]; return a ? u8.subarray(base + a[0], base + a[0] + a[1]) : null; };
  return { index, bytes: bytesOf, text: (name) => { const b = bytesOf(name); return b ? dec.decode(b) : null; }, size: u8.length };
}

/** Every part the API and the downloads serve, from one shape. */
export function snapshotParts(shape) {
  const parts = [];
  const put = (name, value) => parts.push([name, JSON.stringify(value)]);
  const csv = (name, rows) => parts.push([name, toCsv(rows, shape.names)]);
  for (const s of SECTIONS) {
    if (s.key === 'about') continue;
    const v = shape.sections[s.key];
    put('s:' + s.key, v);
    if (s.csv) csv('c:' + s.key, rowsOf(s.key, v));
  }
  put('s:standings~nosim', shape.standingsNoSim);
  csv('c:standings~nosim', shape.standingsNoSim);
  // The refined endpoints: the whole, and each team's slice.
  put('e:scoreboard', shape.sections.scoreboard); csv('ec:scoreboard', shape.sections.scoreboard);
  put('e:rosters', shape.rosterRows); csv('ec:rosters', shape.rosterRows);
  put('e:activity', shape.activity); csv('ec:activity', shape.activity);
  // The description file, from this league's own data; its address is filled in when handed over.
  const sampleMeta = { endpoint: 'standings', apiVersion: 1, league: shape.leagueName, season: shape.season, week: shape.week,
    updatedAt: '2026-09-28T14:15:08Z', refreshEverySeconds: 300, pace: { askEverySeconds: 60, site: 'normal', note: 'Please ask at most once a minute.' },
    docs: `${ORIGIN_MARK}/apps/site-api/#standings`, key: { endsIn: 'abcd', replacedOn: '2026-12-27', warning: null } };
  const sampleAbout = { league: shape.leagueName, season: shape.season, week: shape.week, phase: shape.phase, apiVersion: 1, builtAt: '2026-09-28T14:15:08Z',
    key: { endsIn: 'abcd', replacedOn: '2026-12-27' }, pace: { askEverySeconds: 60, site: 'normal', note: 'Please ask at most once a minute.' },
    sections: { standings: { updatedAt: '2026-09-28T14:15:08Z', refreshEverySeconds: 300 } }, leftOut: [{ section: 'logos', why: 'Left out by default: add ?logos=true to include it.' }],
    conventions: ['Times are ISO 8601 in UTC.'] };
  parts.push(['x:schema', JSON.stringify(schemaDoc({ leagueName: shape.leagueName, values: shape.sections, about: sampleAbout, meta: sampleMeta,
    rows: { scoreboard: shape.sections.scoreboard, standings: shape.sections.standings, rosters: shape.rosterRows, activity: shape.activity } }), null, 2) + '\n']);
  for (const id of shape.teams) {
    const sb = shape.sections.scoreboard.filter((m) => m.home.teamId === id || m.away.teamId === id);
    put('e:scoreboard:' + id, sb); csv('ec:scoreboard:' + id, sb);
    const rr = shape.rosterRows.filter((r) => r.teamId === id);
    put('e:rosters:' + id, rr); csv('ec:rosters:' + id, rr);
  }
  return parts;
}

/**
 * Trade Analyzer's breakdown of every offer on the table: the same engine the tool runs in the browser, at the
 * league's own weighting, so the API and the page cannot disagree about a deal. Two-team offers only; nothing
 * beyond what the tool itself shows a member.
 */
export function shapeTradeAnalysis(digest, weights) {
  if (!digest || !Array.isArray(digest.teams) || !Array.isArray(digest.pending) || !digest.pending.length) return [];
  let E;
  try { E = createEngine(digest, weights || {}); } catch { return []; }
  E.setWeights('admin', {});
  const iso = (ms) => (ms ? new Date(ms).toISOString() : null);
  const tag = (p) => `${p.n} (${p.pos}, ${p.tm})`;
  const r1 = (n) => Math.round((Number(n) || 0) * 10) / 10 + 0;
  const out = [];
  for (const offer of E.crossReference(E.DATA.pending)) {
    if ((offer.teams || 2) !== 2 || offer.b == null) continue;
    let res;
    try { res = E.analyzeTrade(offer); } catch { continue; }
    if (res.unsupported) continue;
    const tot = E.totalsFor(res); const v = E.verdictFor(res, tot);
    const side = (ctx, ids) => ({ teamId: ctx.team.id, team: ctx.team.n, sends: ids.map((id) => E.playerById(id)).filter(Boolean).map(tag) });
    out.push({
      offerId: String(offer.id), status: 'onTheTable', proposedAt: iso(offer.proposed), expiresAt: iso(offer.expires),
      teamA: side(res.ctxA, offer.aOut), teamB: side(res.ctxB, offer.bOut),
      rows: res.rows.map((r) => ({ row: r.id, name: r.label, group: E.GROUPS[r.group] || r.group, weight: r.defaultWeight, leagueWeight: r.adminWeight,
        pointsA: r1(r.sideA.points), pointsB: r1(r.sideB.points) })),
      totalA: r1(tot.a), totalB: r1(tot.b), balance: r1(tot.a - tot.b),
      verdict: v.key, favors: v.beneficiary ? v.beneficiary.n : null,
    });
  }
  return out;
}

/* ---- the build, inside the dataset coordinator ------------------------------------------------------------ */

/** The digests and payloads the snapshot is shaped from. */
export const SOURCE_KEYS = ['league_settings', 'llm_export_digest', 'standings_digest', 'live_scoring_digest', 'season_schedule', 'player_digest',
  'transaction_digest', 'draft_results', 'bye_weeks', 'scoreboard_digest', 'injuries_digest', 'nfl_news', 'league_history_digest', 'h2h_full_digest',
  'trade_digest'];
/* What each section is built from, for its updatedAt. 'ft' is Fortune Teller's summary and records; 'timeline' the score timeline. */
export const SECTION_SOURCES = {
  league: ['league_settings'], teams: ['llm_export_digest', 'standings_digest'], rosters: ['llm_export_digest', 'live_scoring_digest'],
  standings: ['standings_digest', 'ft'], schedule: ['season_schedule', 'live_scoring_digest'], scoreboard: ['live_scoring_digest'],
  players: ['player_digest'], freeAgents: ['llm_export_digest', 'live_scoring_digest'], transactions: ['transaction_digest'], trades: ['transaction_digest'],
  draft: ['draft_results', 'player_digest'], logos: ['logos'], nflTeams: ['bye_weeks'], nflSchedule: ['bye_weeks', 'scoreboard_digest'],
  nflScoreboard: ['scoreboard_digest'], injuries: ['injuries_digest'], news: ['nfl_news'], pointsAllowed: ['llm_export_digest'],
  live: ['live_scoring_digest'], timeline: ['timeline'], history: ['league_history_digest'], records: ['league_history_digest'],
  teamHistory: ['league_history_digest'], headToHead: ['h2h_full_digest'], fortuneTeller: ['ft'], fortuneOdds: ['ft'], fortuneFinishes: ['ft'],
  fortuneGames: ['ft'], fortunePaths: ['ft'], tradeAnalysis: ['trade_digest'], draftOrder: ['draft_results'],
};
const LIVE_SOURCES = new Set(['live_scoring_digest', 'scoreboard_digest']);
export const REFRESH_FLOOR_MS = 15 * 60000;
export const REFRESHES_PER_DAY = 500;
const LOGO_MAX = 512 * 1024;

/** How often the snapshot may be rebuilt: 15 s for the live parts while the site is quiet during games, a minute during games or a draft, else 5 minutes. */
export function snapshotEvery({ games = false, quiet = false, draftLive = false } = {}) {
  if (games && quiet) return 15;
  if (games || draftLive) return 60;
  return 300;
}

/**
 * Which sources a rebuild refreshes first. Outside games a source is refreshed only when it is older than both
 * its own interval and 15 minutes; live data during games is the backend's job, except that a quiet site
 * refreshes live scoring as a page view would; during the league's draft the draft is refreshed once it is a
 * minute old. Never while the brake is on, never past the day's allowance.
 */
export function refreshPlan(heads, { now, games = false, quiet = false, draftLive = false, brake = false, left = REFRESHES_PER_DAY }) {
  if (brake || left <= 0) return [];
  const out = [];
  for (const key of SOURCE_KEYS) {
    const h = heads[key];
    const ds = getDataset(key);
    if (!ds) continue;
    const ttlMs = Math.max(0, Number(ds.ttl) || 0) * 1000;
    if (!h) { out.push(key); continue; }   // never stored: always fetched
    const age = now - new Date(h.uploaded).getTime();
    if (LIVE_SOURCES.has(key) && games) { if (quiet && key === 'live_scoring_digest' && age > ttlMs) out.push(key); continue; }
    if (key === 'draft_results' && draftLive) { if (age > 60000) out.push(key); continue; }
    if (ttlMs > 0 && age > Math.max(ttlMs, REFRESH_FLOOR_MS)) out.push(key);
  }
  return out.slice(0, left);
}

const b64 = (bytes) => { let s = ''; const u = new Uint8Array(bytes); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const SHIELD = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><path d="M20 3 6 8v10c0 9.5 6 16.8 14 19 8-2.2 14-9.5 14-19V8L20 3z" fill="#1f2a22" stroke="#63ff4a" stroke-width="2"/></svg>');

/**
 * One build. `mem` is the coordinator's memory between builds: the parsed sources by R2 etag, so a source
 * that has not changed is never read again, and the day's refresh count.
 */
export async function buildSnapshot(env, mem, opts = {}) {
  const now = opts.now || Date.now();
  const t0 = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  if (mem.day !== day) { mem.day = day; mem.refreshes = 0; }
  mem.docs = mem.docs || new Map();
  const heads = {};
  await Promise.all(SOURCE_KEYS.map(async (k) => { try { heads[k] = await headPart(env, k, 'main'); } catch { heads[k] = null; } }));
  const plan = refreshPlan(heads, { now, games: opts.games, quiet: opts.quiet, draftLive: mem.draftLive, brake: opts.brake, left: REFRESHES_PER_DAY - (mem.refreshes || 0) });
  const refreshed = [];
  if (plan.length) {
    mem.refreshes = (mem.refreshes || 0) + plan.length;
    const timeout = new Promise((r) => setTimeout(r, opts.refreshWaitMs ?? 20000));
    await Promise.race([Promise.all(plan.map(async (k) => {
      try { const r = await coordinatorRefresh(env, k); if (r && r.ok !== false) refreshed.push(k); } catch { /* read as stored */ }
      try { heads[k] = await headPart(env, k, 'main'); } catch { /* keep the old head */ }
    })), timeout]);
  }
  const read = [];
  const src = {};
  const at = {};
  await Promise.all(SOURCE_KEYS.map(async (k) => {
    const h = heads[k];
    if (!h) return;
    at[k] = new Date(h.uploaded).getTime();
    const hit = mem.docs.get(k);
    if (hit && hit.etag === h.etag) { src[k] = hit.doc; return; }
    try {
      const o = await getPart(env, k, 'main');
      if (!o) return;
      const doc = await o.json();
      mem.docs.set(k, { etag: h.etag, doc });
      src[k] = doc; read.push(k);
    } catch { if (hit) src[k] = hit.doc; }
  }));
  const readR2 = async (key) => {
    const hit = mem.docs.get(key);
    try {
      const o = await env.DATA.get(key, hit ? { onlyIf: { etagDoesNotMatch: hit.etag } } : undefined);
      if (o && typeof o.json === 'function' && 'body' in o) {
        const doc = await o.json(); mem.docs.set(key, { etag: o.etag, doc, at: o.uploaded ? new Date(o.uploaded).getTime() : now }); read.push(key); return doc;
      }
    } catch { /* keep the last copy */ }
    return hit ? hit.doc : null;
  };
  const [summary, pipeline, espnOdds] = await Promise.all([readR2(FT_SUMMARY_KEY), readR2(FT_PIPELINE_STATUS_KEY), readR2(FT_ESPN_ODDS_KEY)]);
  let sim = null;
  try { sim = await simOdds(env); } catch { sim = null; }
  src.ft = { summary, pipeline, espnOdds, sim };
  // The league's own weighting, for Trade Analyzer's breakdown.
  try { src.tradeWeights = (await loadConfig(env)).tradeWeights || {}; } catch { src.tradeWeights = {}; }
  at.ft = Math.max(0, ...[FT_SUMMARY_KEY, FT_PIPELINE_STATUS_KEY, FT_ESPN_ODDS_KEY].map((k) => (mem.docs.get(k) || {}).at || 0)) || null;
  // The score timeline: this week's, read during games and whenever the week changes, else at most every 5 minutes.
  const season = src.league_settings && src.league_settings.seasonId;
  const week = Number((src.live_scoring_digest && src.live_scoring_digest.matchupPeriod) || 0);
  const tl = mem.timeline;
  if (season && week && (!tl || tl.week !== week || opts.games || now - tl.at > 300000)) {
    try { const r = await timelineRead(env, season, week); mem.timeline = { week, at: now, rows: r.rows || [], lastTick: r.lastTick || null }; read.push('timeline'); }
    catch { /* keep the last copy */ }
  }
  src.timeline = mem.timeline && mem.timeline.week === week ? mem.timeline.rows : [];
  at.timeline = mem.timeline && mem.timeline.week === week ? (mem.timeline.lastTick ? Date.parse(mem.timeline.lastTick) || mem.timeline.at : mem.timeline.at) : null;
  // Logos, as small images inside the answer; the site's shield where there is none.
  const ids = ((src.standings_digest && src.standings_digest.rows) || []).map((r) => r.teamId);
  src.logos = {};
  mem.logos = mem.logos || new Map();
  let logoAt = 0;
  await Promise.all(ids.map(async (id) => {
    const key = logoObjectKey(id), hit = mem.logos.get(id);
    try {
      const o = await env.DATA.get(key, hit ? { onlyIf: { etagDoesNotMatch: hit.etag } } : undefined);
      if (o && typeof o.arrayBuffer === 'function' && 'body' in o) {
        const buf = await o.arrayBuffer();
        const type = (o.customMetadata && o.customMetadata.contentType) || (o.httpMetadata && o.httpMetadata.contentType) || 'image/png';
        const image = buf.byteLength && buf.byteLength <= LOGO_MAX ? `data:${String(type).replace('image/jpg', 'image/jpeg')};base64,${b64(buf)}` : SHIELD;
        mem.logos.set(id, { etag: o.etag, image, at: o.uploaded ? new Date(o.uploaded).getTime() : now });
      } else if (!o && !hit) mem.logos.set(id, { etag: null, image: SHIELD, at: now });
    } catch { /* keep the last copy */ }
    const got = mem.logos.get(id);
    src.logos[id] = got ? got.image : SHIELD;
    if (got && got.at > logoAt) logoAt = got.at;
  }));
  at.logos = logoAt || null;

  const shape = shapeAll(src, { now });
  mem.draftLive = Boolean(shape.draftLive);
  const iso = (ms) => (ms ? new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z') : null);
  const sections = {};
  for (const s of SECTIONS) {
    if (s.key === 'about') continue;
    const times = (SECTION_SOURCES[s.key] || []).map((k) => at[k]).filter(Boolean);
    sections[s.key] = { updatedAt: iso(times.length ? Math.max(...times) : null) };
  }
  const index = {
    v: 1, ready: Boolean(shape.ready), builtAt: iso(now), buildMs: 0,
    leagueName: shape.leagueName || null, season: shape.season || null, week: shape.week || null, matchupPeriod: shape.matchupPeriod || null,
    phase: shape.phase || null, teams: shape.teams || [], names: shape.names || {}, windows: shape.windows || [], draftLive: Boolean(shape.draftLive),
    leftOut: shape.leftOut || {}, sections, read, refreshed, refreshesToday: mem.refreshes || 0,
  };
  const parts = shape.ready ? snapshotParts(shape) : [];
  index.buildMs = Date.now() - t0;
  const bytes = packSnapshot(index, parts);
  await env.DATA.put(SNAPSHOT_KEY, bytes, { httpMetadata: { contentType: 'application/octet-stream' }, customMetadata: { builtAt: index.builtAt } });
  mem.builtAt = now;
  return { ok: true, ready: index.ready, builtAt: index.builtAt, ms: Date.now() - t0, bytes: bytes.length, read, refreshed, parts: parts.length };
}
