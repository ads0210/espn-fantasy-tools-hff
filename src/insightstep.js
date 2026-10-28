/**
 * Matchup Insights' backend step (plan "Implementation plan", push 2).
 *
 * Runs inside the dataset coordinator's 'matchup_insights' instance (src/coordinator.js, route /insights), asked by
 * the minute's work (src/index.js runMinute) and, at most every five minutes per isolate, by a page visit. Reads
 * stored copies only (no ESPN request here: the sources are kept fresh by the minute's work and page visits) and
 * writes under R2 matchup-insights/<season>/:
 *
 *   w<N>.json        a week's rows: every game's Pre rows (frozen per team at its first kickoff, D23; rows about a
 *                    player who has not played keep updating), After-the-final rows and outcomes (D13), and the
 *                    week's "Across the league" rows (D15). A played week the site did not watch is rebuilt from
 *                    settled data only (D25).
 *   w<N>.live.json   the current week's Live rows, rewritten each minute while games are on and never kept (D24).
 *   banners.json     the home matchup card's banner for every team this week (D30, D57), from all of the above.
 *   depth/w<N>.json  the NFL depth chart as it stood that week (D52), kept once a week.
 *   index.json, state.json.
 *
 * Work per call is bounded: at most one played week rebuilt, the current week's Pre rows at most every five minutes
 * (or at once when a source changed), Live rows once a minute while a game is on. Nothing runs until setup is
 * finished, and nothing at the brake's Protect level or above.
 */
import { loadConfig, isSetupFinished } from './config.js';
import { getPart, headPart } from './store.js';
import { historySeasons } from './datasets.js';
import { timelineRead } from './timeline.js';
import { FT_ESPN_ODDS_KEY, FT_SUMMARY_KEY } from './fortuneteller.js';
import { timelineFacts } from './seasonstats.js';
import { ssKey, readSeasonIndex, readSeasonState, fingerprint } from './seasonstep.js';
import { buildInsightModel, bracketOf, teamWeekFromLive, provisionalAfter, allTimeBefore } from './insightmodel.js';
import { TYPES, baseWeight, playerLabel, rescaleRow, RULES_VERSION, preRows, lineupRows, postRows, liveRows, leagueRows, bracketRows, stakesRows, judge, byOrder, bannerFor } from './insights.js';

export const MI_PREFIX = 'matchup-insights/';
export const miKey = (season, rest) => `${MI_PREFIX}${season}/${rest}`;
export const PRE_EVERY_MS = 5 * 60000;
/* The digests and datasets the rules read, as stored (heads fingerprint them; the step never fetches). */
export const MI_SOURCES = [
  ['league_settings', 'main'], ['season_schedule', 'main'], ['standings_digest', 'main'], ['transaction_digest', 'main'],
  ['h2h_full_digest', 'main'], ['injuries_digest', 'main'], ['bye_weeks', 'main'], ['depth_digest', 'main'],
  ['league_history_digest', 'main'], ['positional_ratings', 'main'], ['nfl_scoreboard', 'main'],
];
const STATE_OF = (g) => (g.state === 'final' ? 'final' : g.state === 'live' ? 'live' : 'pre');

const readJson = async (env, key) => {
  try { const o = await env.DATA.get(key); return o ? await o.json() : null; } catch { return null; }
};
const partJson = async (env, ds, part = 'main') => {
  try { const o = await getPart(env, ds, part); return o ? await o.json() : null; } catch { return null; }
};
const putJson = (env, key, value) => env.DATA.put(key, JSON.stringify(value), { httpMetadata: { contentType: 'application/json; charset=utf-8' } });
const r2 = (x) => Math.round(Number(x) * 100 + 1e-9) / 100;

/** The slow inputs (everything but the live digest), from stored copies. */
export async function gatherInsightInputs(env, cfg, season) {
  const get = (ds) => partJson(env, ds);
  const [settings, schedule, digest, tx, h2hFull, injuries, byes, depth, history, posratings, scoreboard, odds, ssIndex, ssState] = await Promise.all([
    get('league_settings'), get('season_schedule'), get('standings_digest'), get('transaction_digest'), get('h2h_full_digest'),
    get('injuries_digest'), get('bye_weeks'), get('depth_digest'), get('league_history_digest'), get('positional_ratings'),
    get('nfl_scoreboard'), readJson(env, FT_ESPN_ODDS_KEY), readSeasonIndex(env, season), readSeasonState(env, season),
  ]);
  if (!settings || !schedule) return null;
  const teams = ((digest && digest.rows) || []).map((r) => ({ id: r.teamId, name: r.name, logo: r.logo || null, owner: r.owner || '' }));
  const ss = {};
  for (const p of (ssIndex && ssIndex.periods) || []) {
    if (p.key !== 'whole' && p.key !== 'regular' && !/^w\d+$/.test(p.key)) continue;
    const doc = await readJson(env, ssKey(season, `stats/${p.key}.json`));
    if (doc) ss[p.key] = { standings: doc.standings || [], records: doc.records || [] };
  }
  const weeks = {};
  for (const p of Object.keys((ssState && ssState.periods) || {})) {
    const w = await readJson(env, ssKey(season, `weeks/p${p}.json`));
    if (w) weeks[p] = w;
  }
  const past = {};
  for (const yr of historySeasons(cfg)) {
    if (Number(yr) >= season) continue;
    const d0 = await partJson(env, 'league_history', String(yr));
    const d = Array.isArray(d0) ? d0[0] : d0;
    if (!d || !d.schedule) continue;
    const reg = (d.settings && d.settings.scheduleSettings && d.settings.scheduleSettings.matchupPeriodCount) || 13;
    past[yr] = d.schedule.filter((m) => m.home && m.away && m.matchupPeriodId <= reg)
      .map((m) => ({ week: m.matchupPeriodId, home: m.home.teamId, away: m.away.teamId, winner: m.winner === 'HOME' ? m.home.teamId : m.winner === 'AWAY' ? m.away.teamId : 0 }));
  }
  // The depth charts the step has kept, one a week (D52), so I98 can say a player slipped since the last one.
  const depthWeeks = {};
  const mi = await readJson(env, miKey(season, 'state.json'));
  for (const w of Object.keys((mi && mi.depth) || {})) {
    const d = await readJson(env, miKey(season, `depth/w${w}.json`));
    if (d && d.players) depthWeeks[w] = d.players;
  }
  const ft = await readJson(env, FT_SUMMARY_KEY);
  const swingTable = ft && Array.isArray(ft.trims) && ft.trims.length ? (ft.trims[Math.max(0, Math.min(ft.trims.length - 1, ft.activeTrim ?? ft.trims.length - 1))] || {}).swing || null : null;
  return { season, settings, schedule, teams, weeks, ss, tx, h2hFull, injuries, byes, depth, depthWeeks, history, posratings, scoreboard, espnOdds: odds, past,
    ftSwing: swingTable && Number(ft.season) === season ? { ...swingTable, games: swingTable.games, summaryGames: ft.games } : null };
}

/**
 * Fortune Teller's swing table for the coming week (D33), in the shape the Stakes rules read, keyed by fixture:
 * { odds {team: p}, game {fixtureId: {home {team: p}, away {team: p}}}, winOut {team: p}, critical {team: fixtureId},
 * bigGame, bigSwing }. Null unless the table is for this very week (it is counted at each update).
 */
export function swingFor(M, t) {
  if (!t || !M.now.week || t.week !== M.now.week) return null;
  const fxOf = (g) => M.fixtures.find((f) => f.week === g.week && ((f.home === g.a && f.away === g.b) || (f.home === g.b && f.away === g.a)));
  const byTeam = (arr) => Object.fromEntries(t.teams.map((id, k) => [id, arr[k]]).filter(([, v]) => v != null));
  const game = {};
  let bigGame = null, bigSwing = -1;
  for (const g of t.games) {
    const f = fxOf({ week: t.week, a: g.a, b: g.b });
    if (!f) continue;
    const flip = f.home !== g.a;
    const home = byTeam(flip ? g.away : g.home), away = byTeam(flip ? g.home : g.away);
    game[f.id] = { home, away };
    const sw = Object.keys(home).reduce((x, id) => x + Math.abs(home[id] - (away[id] ?? home[id])), 0);
    if (sw > bigSwing) { bigSwing = sw; bigGame = f.id; }
  }
  const critical = {};
  t.teams.forEach((id, k) => { const j = t.critical[k]; const sg = j != null && t.summaryGames && t.summaryGames[j]; const f = sg && fxOf(sg); if (f) critical[id] = f.id; });
  return { odds: byTeam(t.odds), game, winOut: byTeam(t.winOut), critical, bigGame, bigSwing };
}

/* What a played week's rows are built from: Season Statistics' parts, the schedule and the league's history. */
const PAST_SOURCES = new Set(['season_schedule', 'league_settings', 'h2h_full_digest', 'league_history_digest', 'standings_digest']);

/**
 * Fingerprints of what the slow inputs were built from (one head each): `all` for every source, so an unchanged set
 * is reused, and `past` for what a played week reads, so a played week is rebuilt only when one of those changed.
 */
async function slowSignature(env, season) {
  const tags = [], past = [];
  for (const [ds, part] of MI_SOURCES) {
    const h = await headPart(env, ds, part);
    const t = h ? h.etag || String(h.uploaded) : '-';
    tags.push(t);
    if (PAST_SOURCES.has(ds)) past.push(t);
  }
  const i = await env.DATA.head(ssKey(season, 'index.json')).catch(() => null); tags.push(i ? i.etag || '' : '-'); past.push(i ? i.etag || '' : '-');
  const o = await env.DATA.head(FT_ESPN_ODDS_KEY).catch(() => null); tags.push(o ? o.etag || '' : '-');
  const f = await env.DATA.head(FT_SUMMARY_KEY).catch(() => null); tags.push(f ? f.etag || '' : '-');
  return { all: fingerprint(tags.join('|')), past: fingerprint(past.join('|')) };
}

/**
 * The fingerprint of what a played week's rows are built from: the settled results, the teams, Season Statistics'
 * stored parts and box scores, head to head, the record book and the rules. Nothing that moves during a game.
 */
export function pastSignature(M) {
  // Only the played weeks' parts: Season Statistics' Whole and Regular parts are rebuilt during games.
  const played = new Set(M.settled.map((f) => f.week));
  const wk = (k) => Number(String(k).split(':').pop());
  return fingerprint(JSON.stringify([
    M.settled.map((f) => [f.id, f.week, f.home, f.away, f.hp, f.ap, f.winner, f.tier]),
    M.ids.map((id) => [id, M.teams[id].name, M.teams[id].logo]),
    Object.keys(M.ss).filter((k) => /^w\d+$/.test(k)).sort().map((k) => [k, M.ss[k]]),
    Object.keys(M.teamWeeks).filter((k) => played.has(wk(k))).sort().map((k) => [k, M.teamWeeks[k]]),
    M.ids.flatMap((a) => M.ids.filter((b) => b > a).map((b) => M.h2h(a, b).filter((g) => g.season !== M.season || played.has(g.week)))),
    M.hof, M.champions, M.regWeeks, M.places, M.seedByPoints, M.startSlots, RULES_VERSION,
  ]));
}

/** A week's score timeline as series per matchup id: [time ms, home, away, home win %]. */
export async function timelineSeries(env, season, week) {
  const read = await timelineRead(env, String(season), week).catch(() => null);
  const series = {};
  for (const r of (read && read.rows) || []) for (const [id, v] of Object.entries(r.m || {})) (series[id] = series[id] || []).push([Date.parse(r.t), v[0], v[1], v[2]]);
  return series;
}

/** The predictions' outcomes once a game is final (D13), with the standings moves read from "after week N". */
function judgeRows(M, week, fx, rows, tw) {
  const after = M.partAfter(week);
  const seedAfter = Object.fromEntries(((after && after.standings) || []).map((s) => [s.team, s]));
  const wk = M.settled.filter((f) => f.week === week);
  // Seeds and the points lead are judged only once every game of the week is over (round 8: before ESPN settles the
  // week the standings are the insights' own count, and other games may still move them).
  const weekDone = wk.length === M.fixtures.filter((f) => f.week === week).length;
  const pfLeader = weekDone && after && after.standings && after.standings.length ? [...after.standings].sort((x, y) => y.pf - x.pf)[0].team : null;
  return rows.map((r0) => {
    if (!r0.predict) return r0;
    const r = { ...r0, predict: { ...r0.predict } };
    const p = r.predict;
    if (weekDone && (p.kind === 'into' || p.kind === 'out') && seedAfter[p.team]) p.result = (p.kind === 'into') === (seedAfter[p.team].seed <= M.places) ? 'held' : 'broke';
    if (p.kind === 'pfLead' && pfLeader) p.result = pfLeader === p.team ? 'held' : 'broke';
    r.outcome = judge(r, fx, tw) || (wk.length ? 'pending' : null);
    return r;
  });
}

function predictionsRow(fx, judged) {
  const done = judged.filter((r) => r.outcome === 'held' || r.outcome === 'broke');
  if (done.length < 2) return null;
  const held = done.filter((r) => r.outcome === 'held').length;
  return { type: 'I190', cat: 'after', label: TYPES.I190[1], weight: baseWeight('I190'), when: 'post', teams: [fx.home, fx.away], about: 'matchup', predict: null, outcome: null,
    parts: [`Predictions: ${held} of ${done.length} held${held < done.length ? `, ${done.length - held} broke` : ''}.`] };
}

/** The upset of the week: the winner with the lowest win chance at its first recorded tick (below 40%). */
function upsetOf(fixtures, series) {
  let upsetId = null, upsetWp = 101, upsets = 0;
  for (const f of fixtures) {
    const s = series[f.id] || [];
    const zero = s.filter((r) => r[1] + r[2] === 0);
    const first = zero.length ? zero[zero.length - 1] : (s[0] || null);
    if (!first || f.winner == null) continue;
    const wwp = f.winner === f.home ? first[3] : 100 - first[3];
    if (wwp < 50) upsets++;
    if (wwp < upsetWp && wwp < 40) { upsetWp = wwp; upsetId = f.id; }
  }
  return { upsetId, upsetWp, upsets };
}

const gameRow = (fx, extra) => ({ id: fx.id, home: fx.home, away: fx.away, ...extra });
const withBracket = (M, fx) => { const b = bracketOf(M, fx); return b ? { round: b.round, place: b.place || null, best: b.best, periods: b.periods } : {}; };

/**
 * A played week from settled data (D25): Pre rows the standings and history could have told before the week,
 * judged, plus every After-the-final row. A week the site watched keeps the Pre rows it froze then (`kept`).
 */
export function settledWeekDoc(M, week, series, kept, { now = new Date().toISOString() } = {}) {
  const wk = M.settled.filter((f) => f.week === week);
  const up = upsetOf(wk, series);
  // A document stored before round 8 holds weights on the 1-5 scale: its kept rows are put on the 1-10 scale.
  const old = kept && kept.scale !== 10;
  const keptGames = Object.fromEntries(((kept && kept.games) || []).map((g) => [g.id, old ? { ...g, rows: (g.rows || []).map(rescaleRow) } : g]));
  const games = [];
  for (const f of wk) {
    const tw = { [f.home]: M.teamWeeks[`${f.home}:${week}`], [f.away]: M.teamWeeks[`${f.away}:${week}`] };
    const had = keptGames[f.id];
    const preSource = had && had.watched ? had.rows.filter((r) => r.when === 'pre') : [
      ...preRows(M, week, f), ...(week > M.regWeeks ? bracketRows(M, f, bracketOf(M, f) || {}) : []),
    ].map((r) => ({ ...r, when: 'pre' }));
    const pre = tw[f.home] && tw[f.away] ? judgeRows(M, week, f, preSource, tw) : preSource;
    const facts = series[f.id] && series[f.id].length ? timelineFacts(series[f.id], f.winner === f.home) : null;
    const post = postRows(M, week, f, facts, up);
    const pr = predictionsRow(f, pre);
    if (pr) post.push(pr);
    games.push(gameRow(f, { state: 'final', settled: true, watched: Boolean(had && had.watched), hp: f.hp, ap: f.ap, ...withBracket(M, f), rows: [...pre, ...post].sort(byOrder) }));
  }
  const high = wk.flatMap((f) => [{ team: f.home, pts: f.hp }, { team: f.away, pts: f.ap }]).sort((x, y) => y.pts - x.pts)[0];
  const close = wk.map((f) => ({ w: f.winner, m: r2(Math.abs(f.hp - f.ap)) })).sort((x, y) => x.m - y.m)[0];
  const field = week === M.regWeeks ? fieldSet(M, week) : null;
  return { season: M.season, week, kind: 'past', scale: 10, label: labelOf(M, week), post: week > M.regWeeks, builtAt: now, games,
    league: [...(high && close ? leagueRows(M, week, 'post', { review: { high, close, upsets: up.upsets }, fieldSet: field }) : []), ...recordsOfWeek(games)].sort(byOrder) };
}

/**
 * Across the league after the final (round 8): one row for every record a game of the week broke or matched, Hall of
 * Fame's first, outside the six-row cap of the week's other rows.
 */
export function recordsOfWeek(games) {
  const seen = new Set(), out = [];
  for (const g of games) for (const r of g.rows) {
    if (r.type !== 'I191' && r.type !== 'I229') continue;
    const key = JSON.stringify(r.parts);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...r, about: 'league', predict: null, outcome: null });
  }
  return out.sort(byOrder);
}

/**
 * The model with this week's finished games counted (round 8), for the rows written once a game is final and ESPN has
 * not yet settled the week: the games as settled fixtures, their team-weeks, the head to head with them, and the
 * standings after the week as the insights count them. Nothing here is stored anywhere another tool reads.
 */
export function withFinals(M, week, finals, teamWeeks = {}) {
  const settled = [...M.settled.filter((f) => f.week !== week), ...finals];
  const after = M.partAfter(week) || provisionalAfter(M, week, finals);
  return { ...M, settled, teamWeeks: { ...M.teamWeeks, ...teamWeeks }, h2h: (a, b) => M.h2h(a, b, finals), partAfter: (w) => (w === week ? after : M.partAfter(w)) };
}

function fieldSet(M, week) {
  const after = M.partAfter(week);
  if (!after || !after.standings) return null;
  return [...after.standings].sort((x, y) => x.seed - y.seed).slice(0, M.places).map((s) => s.team);
}

export function labelOf(M, week) {
  if (week <= M.regWeeks) return `Week ${week}`;
  const k = week - M.regWeeks, rounds = Math.ceil(Math.log2(Math.max(2, M.places)));
  return k >= rounds ? 'The final week' : `Postseason round ${k}`;
}

/* -------------------------------------------------- the current week */

/** Which subject a row is about, for freezing: a team, the matchup, or a player by the name its text carries. */
const subjectOf = (r) => (r.about === 'player' ? `p:${((r.parts || []).find((x) => x && typeof x === 'object' && x.p) || {}).p || ''}` : r.about === 'matchup' ? 'm' : `t:${r.teams[0]}`);
/* A row that describes a game in progress, never frozen (points banked by starters whose games are over). */
const NEVER_FREEZE = new Set(['I176']);
const keyOf = (r) => `${r.type}|${(r.teams || []).join(',')}|${subjectOf(r)}`;

/**
 * Merge this build's Pre rows with the stored ones (D23): a row about a team freezes at that team's first kickoff, a
 * matchup row at the game's, a player row once that player's game has started. Frozen rows are kept as they were;
 * every other row is this build's.
 */
export function mergeFrozen(prev, fresh, { started }) {
  // With no earlier build of this game (the first build after a kickoff), this build's rows are the best there are.
  if (!prev || !prev.length) return fresh;
  const frozen = (r) => !NEVER_FREEZE.has(r.type) && (r.about === 'matchup' ? started.matchup : r.about === 'player' ? started.players.has(subjectOf(r).slice(2)) : started.teams.has(r.teams[0]));
  const keep = (prev || []).filter((r) => r.when === 'pre' && frozen(r)).map((r) => ({ ...r, frozen: true }));
  const have = new Set(keep.map(keyOf));
  const add = fresh.filter((r) => !frozen(r) && !have.has(keyOf(r)));
  return [...keep, ...add];
}

/** What has kicked off in a game, from the live digest's lineups. */
export function startedOf(game) {
  const teams = new Set(), players = new Set();
  let any = false;
  for (const s of ['home', 'away']) {
    const side = game.sides[s];
    for (const p of side.starters || []) {
      if (p.gameStatus && p.gameStatus !== 'pre') { teams.add(side.team); players.add(playerLabel(p.name, p.pos)); if (p.pos) players.add(`${p.name} · ${p.pos}`); any = true; }
    }
  }
  return { matchup: any, teams, players };
}

/** The Live rows' facts for one game: the series so far, and what each side has done and still has to play. */
export function liveFacts(game, series) {
  const etDay = (iso) => { try { return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(new Date(iso)); } catch { return ''; } };
  const sides = {};
  for (const s of ['home', 'away']) {
    const side = game.sides[s];
    const st = (side.starters || []).filter((p) => p.id != null);
    const left = st.filter((p) => p.gameStatus !== 'final');
    const done = st.filter((p) => p.gameStatus === 'final').map((p) => ({ name: p.name, pos: p.pos, pts: Number(p.points) || 0, proj: Number(p.proj) || 0 }));
    const monday = left.filter((p) => p.kickoff && etDay(p.kickoff) === 'Mon').map((p) => ({ name: p.name, pos: p.pos }));
    sides[side.team] = { left, done, monday, projLeft: r2(Math.max(0, (Number(side.projected) || 0) - (Number(side.points) || 0))) };
  }
  return { series: series || [], sides };
}

/**
 * The current week's document: Pre rows for every game (merged with the frozen ones), provisional After-the-final
 * rows for a game whose players have all finished (rebuilt from settled data once ESPN settles the week), and the
 * week's Pre rows across the league. Live rows are built separately (liveDoc).
 */
export function currentWeekDoc(M, prevDoc, { now = new Date().toISOString(), series = {}, swing = null } = {}) {
  const week = M.now.week;
  const oldScale = prevDoc && prevDoc.scale !== 10;
  const prevGames = Object.fromEntries(((prevDoc && prevDoc.games) || []).map((g) => [g.id, oldScale ? { ...g, rows: (g.rows || []).map(rescaleRow) } : g]));
  // ESPN drops a game's over/under once it kicks off: keep the last one seen, so "the week's highest" stays true.
  const lines = { ...((prevDoc && prevDoc.lines) || {}) };
  for (const g of Object.values(M.nfl)) if (g.overUnder) lines[g.key] = g.overUnder;
  for (const g of Object.values(M.nfl)) if (!g.overUnder && lines[g.key]) g.overUnder = lines[g.key];
  const games = [];
  const margins = [];
  for (const g of M.now.games) {
    const fx = M.fixtures.find((f) => f.id === g.id);
    if (!fx) continue;
    const H = g.sides.home, A = g.sides.away;
    margins.push(Math.abs(H.projected - A.projected));
    const b = bracketOf(M, fx);
    const fresh = [...preRows(M, week, fx), ...lineupRows(M, g), ...(b ? bracketRows(M, fx, b) : []), ...(swing ? stakesRows(M, week, fx, swing) : [])]
      .map((r) => ({ ...r, when: r.when === 'live' ? 'live' : 'pre', outcome: r.predict ? 'pending' : null }));
    const prev = prevGames[g.id];
    const started = startedOf(g);
    let rows = mergeFrozen(prev ? prev.rows : [], fresh, { started });
    const state = STATE_OF(g);
    if (state === 'final') {
      const tw = { [H.team]: teamWeekFromLive({ ...H, teamId: H.team }, M.startSlots, week, g.id, A.team), [A.team]: teamWeekFromLive({ ...A, teamId: A.team }, M.startSlots, week, g.id, H.team) };
      const winner = H.points > A.points ? H.team : A.points > H.points ? A.team : 0;
      const fxLive = { ...fx, hp: H.points, ap: A.points, winner };
      const Ml = withFinals(M, week, liveFinals(M), { [`${H.team}:${week}`]: tw[H.team], [`${A.team}:${week}`]: tw[A.team] });
      const pre = judgeRows(Ml, week, fxLive, rows.filter((r) => r.when === 'pre'), tw);
      const s = series[g.id] || [];
      const facts = s.length && winner ? timelineFacts(s, winner === H.team) : null;
      const post = winner ? postRows(Ml, week, fxLive, facts, null) : [];
      const pr = predictionsRow(fxLive, pre);
      if (pr) post.push(pr);
      rows = [...pre, ...post];
    }
    games.push(gameRow(fx, { state, watched: true, hp: r2(H.points), ap: r2(A.points), hproj: r2(H.projected), aproj: r2(A.projected), hwp: H.winProb,
      firstKickoff: g.firstKickoff || null, ...withBracket(M, fx), rows: rows.sort(byOrder) }));
  }
  const allFinal = games.length && games.every((x) => x.state === 'final');
  // The cards of finished games show each team's record with the result counted (round 8), before ESPN settles it.
  const finals = liveFinals(M);
  const afterNow = finals.length ? provisionalAfter(M, week, finals) : null;
  const after = {};
  for (const st of (afterNow && afterNow.standings) || []) if (finals.some((f) => f.home === st.team || f.away === st.team)) after[st.team] = { w: st.w, l: st.l, t: st.t, seed: st.seed, pf: r2(st.pf) };
  const clinch = swing ? [...new Set(games.flatMap((x) => x.rows.filter((r) => r.type === 'I1').map((r) => r.teams[0])))] : null;
  const bg = swing && swing.bigGame ? games.find((x) => x.id === swing.bigGame) : null;
  let league = leagueRows(M, week, 'pre', { margins, odds: M.oddsWeeks[String(week - 1)], clinch, bigGame: bg ? { teams: [bg.home, bg.away], swing: swing.bigSwing } : null });
  if (allFinal) {
    const fin = liveFinals(M);
    const high = fin.flatMap((f) => [{ team: f.home, pts: f.hp }, { team: f.away, pts: f.ap }]).sort((x, y) => y.pts - x.pts)[0];
    const close = fin.map((f) => ({ w: f.winner, m: r2(Math.abs(f.hp - f.ap)) })).sort((x, y) => x.m - y.m)[0];
    const up = upsetOf(fin, series);
    const prevLeague = ((prevDoc && prevDoc.league) || []).filter((r) => r.when !== 'post').map((r) => (oldScale ? rescaleRow(r) : r));
    league = [...prevLeague.length ? prevLeague : league, ...leagueRows(M, week, 'post', { review: { high, close, upsets: up.upsets } })].sort(byOrder).slice(0, 6);
    league = [...league, ...recordsOfWeek(games)].sort(byOrder);
  } else if (prevDoc && prevDoc.week === week && games.some((x) => x.state !== 'pre')) {
    // Once games are under way the week's Pre rows across the league stay as they were at the first kickoff.
    const pl = (prevDoc.league || []).filter((r) => r.when !== 'post' && r.type !== 'I191' && r.type !== 'I229').map((r) => (oldScale ? rescaleRow(r) : r));
    if (pl.length) league = pl;
    league = [...league, ...recordsOfWeek(games)].sort(byOrder);
  }
  league = league.map((r) => ({ ...r, when: r.when || 'pre' }));
  return { season: M.season, week, kind: 'current', scale: 10, label: labelOf(M, week), post: week > M.regWeeks, builtAt: now, games, league, lines, after };
}

/** This week's games whose lineups have all finished, as settled fixtures (for the after-the-final rows). */
function liveFinals(M) {
  return M.now.games.filter((g) => STATE_OF(g) === 'final').map((g) => {
    const fx = M.fixtures.find((f) => f.id === g.id) || {};
    const H = g.sides.home, A = g.sides.away;
    return { ...fx, id: g.id, week: M.now.week, home: H.team, away: A.team, hp: H.points, ap: A.points, winner: H.points > A.points ? H.team : A.points > H.points ? A.team : 0 };
  });
}

/** The Live rows of every game under way, and the league's scoring pace (D24: rewritten, never kept). */
export function liveDoc(M, series, { now = new Date().toISOString() } = {}) {
  const week = M.now.week;
  const games = {};
  let paceNow = 0, n = 0;
  const allTime = allTimeBefore(M, week);
  for (const g of M.now.games) {
    if (STATE_OF(g) !== 'live') continue;
    const fx = M.fixtures.find((f) => f.id === g.id);
    if (!fx) continue;
    const lv = { ...liveFacts(g, series[g.id] || []), allTime };
    games[g.id] = liveRows(M, week, fx, lv).map((r) => ({ ...r, when: 'live', outcome: r.predict ? 'pending' : null })).sort(byOrder);
  }
  for (const g of M.now.games) for (const s of ['home', 'away']) { paceNow += g.sides[s].projected; n++; }
  const before = M.partBefore(week);
  const played = before && before.standings ? before.standings.reduce((x, st) => x + st.w + st.l + st.t, 0) : 0;
  const avg = played ? before.standings.reduce((x, st) => x + st.pf, 0) / played : 0;
  const anyLive = Object.keys(games).length > 0;
  const league = anyLive && n && avg ? leagueRows(M, week, 'live', { pace: { now: r2(paceNow / n), avg: r2(avg) } }).map((r) => ({ ...r, when: 'live' })) : [];
  return { season: M.season, week, builtAt: now, on: anyLive, games, league };
}

/** Every team's home banner this week, from the week's rows and the Live rows (D30, D48, D57). */
export function bannersOf(doc, live) {
  const out = {};
  for (const g of (doc && doc.games) || []) {
    const rows = [...g.rows, ...((live && live.games && live.games[g.id]) || [])];
    for (const id of [g.home, g.away]) {
      const b = bannerFor(rows, id, g.round || null, g.state);
      out[id] = b ? { tier: b.tier, label: b.label, tone: b.tone, glyph: b.glyph, row: b.row ? { type: b.row.type, cat: b.row.cat, weight: b.row.weight, parts: b.row.parts } : null } : null;
    }
  }
  return out;
}

/* -------------------------------------------------- the step */

/**
 * One call. `mem` lives in the object between calls (the slow inputs and their fingerprint, when the Pre rows were
 * last built); `state` is stored at matchup-insights/<season>/state.json.
 */
export async function insightStep(env, mem, { now = Date.now(), brake = 'normal', reason = 'minute', force = false, swing = null } = {}) {
  const cfg = await loadConfig(env);
  if (!isSetupFinished(cfg)) return { ok: true, skipped: 'site not ready' };
  if (brake === 'protect' || brake === 'limit') return { ok: true, skipped: `brake ${brake}` };
  const season = Number(cfg.season);
  const iso = new Date(now).toISOString();
  const stateKey = miKey(season, 'state.json');
  const state = (await readJson(env, stateKey)) || { season, weeks: {}, depth: {} };
  state.weeks = state.weeks || {}; state.depth = state.depth || {};
  const out = { ok: true, season, did: [] };
  let changed = false;

  const sigs = await slowSignature(env, season);
  if (!mem.inputs || mem.sig !== sigs.all || force) {
    mem.inputs = await gatherInsightInputs(env, cfg, season);
    mem.sig = sigs.all;
    mem.preAt = 0;
  }
  if (!mem.inputs) { out.skipped = 'no schedule or settings stored yet'; return out; }
  const live = await partJson(env, 'live_scoring_digest');
  const liveTag = live ? fingerprint(JSON.stringify(live.games || []).slice(0, 200000)) : '-';
  const M = buildInsightModel({ ...mem.inputs, live, now: iso });
  const current = M.now.week;
  out.current = current;
  // What a played week reads, by content: its sources' copies are rewritten all through a game window (live scores
  // in the schedule, a refreshed standings digest) with nothing a played week reads changed.
  if (mem.pastSigOf !== mem.sig) { mem.pastSig = pastSignature(M); mem.pastSigOf = mem.sig; }

  // 1. One played week rebuilt from settled data: missing, or what a played week reads has changed since.
  const settledAll = (w) => { const all = M.fixtures.filter((f) => f.week === w); return all.length > 0 && all.every((f) => f.winner != null); };
  const curSettled = current ? settledAll(current) : true;
  const playedWeeks = [...new Set(M.settled.map((f) => f.week))].filter(settledAll).sort((a, b) => a - b);
  const due = playedWeeks.find((w) => {
    const s = state.weeks[w];
    const ready = M.ss[`w${w}`] && M.settled.filter((f) => f.week === w).every((f) => M.teamWeeks[`${f.home}:${w}`] && M.teamWeeks[`${f.away}:${w}`]);
    return ready && (!s || s.kind !== 'past' || s.sig !== mem.pastSig || force === 'full');
  });
  if (due) {
    const kept = await readJson(env, miKey(season, `w${due}.json`));
    const series = await timelineSeries(env, season, due);
    const doc = settledWeekDoc(M, due, series, kept, { now: iso });
    await putJson(env, miKey(season, `w${due}.json`), doc);
    state.weeks[due] = { kind: 'past', at: iso, sig: mem.pastSig, games: doc.games.length, rows: doc.games.reduce((x, g) => x + g.rows.length, 0) };
    out.did.push(`built week ${due}${kept && kept.kind === 'current' ? ' (kept its watched Pre rows)' : ''}`);
    changed = true;
  }

  // 2. The current week: Pre rows at most every five minutes (or at once when a source changed), Live rows each minute.
  if (current && M.now.games.length && !curSettled) {
    const anyOn = M.now.games.some((g) => STATE_OF(g) === 'live');
    const anyFinal = M.now.games.some((g) => STATE_OF(g) === 'final');
    const cur = state.weeks[current];
    const preDue = force || !cur || cur.kind !== 'current' || mem.preWeek !== current || !mem.preAt || now - mem.preAt >= PRE_EVERY_MS
      || (mem.liveTag !== liveTag && (anyOn || anyFinal));
    let series = null;
    if (anyOn || anyFinal) series = await timelineSeries(env, season, current);
    if (preDue && !(cur && cur.kind === 'past')) {
      const prev = await readJson(env, miKey(season, `w${current}.json`));
      const doc = currentWeekDoc(M, prev && prev.week === current ? prev : null, { now: iso, series: series || {}, swing: swing || swingFor(M, mem.inputs.ftSwing) });
      await putJson(env, miKey(season, `w${current}.json`), doc);
      state.weeks[current] = { kind: 'current', at: iso, games: doc.games.length, rows: doc.games.reduce((x, g) => x + g.rows.length, 0) };
      mem.preAt = now; mem.preWeek = current; mem.liveTag = liveTag;
      mem.doc = doc;
      out.did.push(`week ${current}: ${state.weeks[current].rows} rows`);
      changed = true;
    }
    let ldoc = null;
    if (anyOn) {
      ldoc = liveDoc(M, series || {}, { now: iso });
      await putJson(env, miKey(season, `w${current}.live.json`), ldoc);
      out.did.push(`live: ${Object.keys(ldoc.games).length} game${Object.keys(ldoc.games).length === 1 ? '' : 's'}`);
    } else if (mem.liveOn) {
      await env.DATA.delete(miKey(season, `w${current}.live.json`)).catch(() => {});
    }
    mem.liveOn = anyOn;
    // The home banners: whenever the week's rows or its Live rows were rewritten.
    if (changed || anyOn || mem.bannerWeek !== current) {
      const doc = mem.doc && mem.doc.week === current ? mem.doc : await readJson(env, miKey(season, `w${current}.json`));
      if (doc) {
        const banners = bannersOf(doc, ldoc);
        const tag = fingerprint(JSON.stringify(banners));
        if (tag !== mem.bannerTag) {
          await putJson(env, miKey(season, 'banners.json'), { season, week: current, builtAt: iso, byTeam: banners });
          mem.bannerTag = tag;
        }
        mem.bannerWeek = current;
      }
    }
    // 3. The depth chart as it stood this week (D52), once.
    if (!state.depth[current] && mem.inputs.depth && mem.inputs.depth.players) {
      const players = Object.fromEntries(Object.entries(mem.inputs.depth.players).map(([id, d]) => [id, { d: d.d, p: d.p }]));
      await putJson(env, miKey(season, `depth/w${current}.json`), { season, week: current, at: iso, players });
      state.depth[current] = iso;
      out.did.push(`depth chart kept for week ${current}`);
      changed = true;
    }
  }

  if (changed) {
    state.sig = mem.sig;
    await putJson(env, stateKey, state);
    const weeks = Object.entries(state.weeks).map(([w, s]) => ({ week: Number(w), kind: s.kind, label: labelOf(M, Number(w)) })).sort((a, b) => a.week - b.week);
    await putJson(env, miKey(season, 'index.json'), { season, builtAt: iso, current, regWeeks: M.regWeeks, places: M.places, weeks,
      teams: Object.fromEntries(Object.values(M.teams).map((t) => [t.id, { id: t.id, name: t.name, logo: t.logo }])) });
  }
  out.state = { weeks: Object.keys(state.weeks).length, depth: Object.keys(state.depth).length };
  return out;
}

export async function readInsightIndex(env, season) { return readJson(env, miKey(season, 'index.json')); }
export async function readInsightWeek(env, season, week) { return env.DATA.get(miKey(season, `w${week}.json`)); }
export async function readInsightLive(env, season, week) { return readJson(env, miKey(season, `w${week}.live.json`)); }
export async function readInsightBanners(env, season) { return readJson(env, miKey(season, 'banners.json')); }
export async function readInsightState(env, season) { return readJson(env, miKey(season, 'state.json')); }
