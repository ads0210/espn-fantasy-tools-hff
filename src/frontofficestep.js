/**
 * Front Office's backend step (plan "How it would be built").
 *
 * Runs inside the dataset coordinator's 'front_office' instance (src/coordinator.js, route /front-office), asked by
 * the minute's work (src/index.js runMinute) and, at most every five minutes per isolate, by a page visit. Reads
 * stored copies only (the sources are kept fresh by the minute's work and page visits) and writes under R2
 * front-office/<season>/:
 *
 *   team-<id>.json   one team's page: This week (slots, alternatives, notes, checklist), Pickups, Weeks ahead.
 *   proj-w<N>.json   the first projection seen for each player in week N (the "projection moved" note).
 *   index.json       the week, the teams and when each page was built.  state.json  the step's own record.
 *
 * Every team's page is worked out at most every five minutes while a game is on or near and every fifteen otherwise,
 * and written only when its content changed (a fingerprint of the page, with RULES_VERSION in it), never on a
 * refetch of identical data. Nothing runs until setup is finished, nor at the brake's Protect level or above.
 */
import { loadConfig, isSetupFinished } from './config.js';
import { getPart } from './store.js';
import { fingerprint } from './seasonstep.js';
import { miKey } from './insightstep.js';
import { FT_SUMMARY_KEY } from './fortuneteller.js';
import { visibilityOf, VISIBILITY } from './tools.js';
import { buildFoModel } from './fomodel.js';
import { thisWeek, pickups, weeksAhead, RULES_VERSION, POS, SLOT_NAME } from './frontoffice.js';

export const FO_PREFIX = 'front-office/';
export const foKey = (season, rest) => `${FO_PREFIX}${season}/${rest}`;
export const FO_SOURCES = ['league_settings', 'rosters', 'season_schedule', 'weekly_projections_digest', 'bye_weeks', 'nfl_scoreboard',
  'positional_ratings', 'depth_digest', 'injuries_digest', 'transaction_digest', 'standings_digest', 'live_scoring_digest'];
export const FAST_MS = 5 * 60000, SLOW_MS = 15 * 60000;
export const PICKUPS_KEPT = 60;

const readJson = async (env, key) => { try { const o = await env.DATA.get(key); return o ? await o.json() : null; } catch { return null; } };
const partJson = async (env, ds, part = 'main') => { try { const o = await getPart(env, ds, part); return o ? await o.json() : null; } catch { return null; } };
const putJson = (env, key, value) => env.DATA.put(key, JSON.stringify(value), { httpMetadata: { contentType: 'application/json; charset=utf-8' } });

/** Every input the model reads, from stored copies (no ESPN request here). */
export async function gatherFoInputs(env, season) {
  const keys = ['settings', 'rosters', 'schedule', 'weekly', 'byes', 'scoreboard', 'posratings', 'depth', 'injuries', 'tx', 'standings', 'live'];
  const got = await Promise.all(FO_SOURCES.map((ds) => partJson(env, ds)));
  const I = Object.fromEntries(keys.map((k, i) => [k, got[i]]));
  const week = I.rosters && Number(I.rosters.scoringPeriodId);
  if (week) {
    const prev = await readJson(env, miKey(season, `depth/w${week - 1}.json`));
    I.depthPrev = (prev && prev.players) || null;
    I.projFirstDoc = await readJson(env, foKey(season, `proj-w${week}.json`));
  }
  // Fortune Teller's swing table for the coming week (written at each of its updates), for Weeks ahead's race.
  const ft = await readJson(env, FT_SUMMARY_KEY);
  const tr = ft && Array.isArray(ft.trims) && ft.trims.length ? ft.trims[Math.max(0, Math.min(ft.trims.length - 1, ft.activeTrim ?? ft.trims.length - 1))] : null;
  I.ftSwing = tr && tr.swing && Number(ft.season) === Number(season) ? { ...tr.swing, summaryGames: ft.games } : null;
  return I;
}

/** The first projection seen this week for every player the model knows; returns the record and whether it grew. */
export function firstSeen(M, prev) {
  const doc = prev && prev.week === M.week ? { ...prev, players: { ...prev.players } } : { week: M.week, players: {} };
  let grew = false;
  for (const p of Object.values(M.players)) {
    const v = (p.proj || {})[M.week];
    if (v == null || doc.players[p.pid] != null) continue;
    doc.players[p.pid] = v; grew = true;
  }
  return { doc, grew };
}

/** One team's page, as stored. Names of the players it mentions by id ride along, so the page never looks them up. */
export function teamDoc(M, teamId, { now = new Date().toISOString() } = {}) {
  const tw = thisWeek(M, teamId);
  const pk = pickups(M, teamId);
  const wa = weeksAhead(M, teamId);
  const ids = new Set();
  for (const c of [...tw.starters, ...tw.bench, ...tw.ir]) { ids.add(c.pid); if (c.alt) ids.add(c.alt.b); }
  const players = {};
  for (const id of ids) { const p = M.players[id]; if (p) players[id] = { name: p.name, pos: POS[p.posId] || '', nfl: p.nfl }; }
  const teams = Object.fromEntries(Object.values(M.teams).map((t) => [t.id, { name: t.name, logo: t.logo }]));
  return {
    v: RULES_VERSION, season: M.season || null, week: M.week, builtAt: now, team: M.teams[teamId], teams, players,
    calendar: { regLast: M.regLast, postFirst: M.postFirst, postLast: M.postLast },
    tw, pk: { ...pk, list: pk.list.slice(0, PICKUPS_KEPT) }, wa,
  };
}
/** What a page's fingerprint covers: everything but the time it was built. */
export const docSignature = (doc) => fingerprint(JSON.stringify({ ...doc, builtAt: null }));

/** How long a built set of pages stands: five minutes while a game is on or kicks off within three hours. */
export function intervalFor(M, now) {
  for (const g of Object.values((M && M.games) || {})) {
    if (g.state === 'live') return FAST_MS;
    const k = g.kickoff ? Date.parse(g.kickoff) : NaN;
    if (g.state === 'pre' && Number.isFinite(k) && k - now <= 3 * 3600e3 && k + 4 * 3600e3 >= now) return FAST_MS;
  }
  return SLOW_MS;
}

export async function frontOfficeStep(env, mem, { now = Date.now(), brake = 'normal', reason = 'minute', force = false } = {}) {
  const cfg = await loadConfig(env);
  if (!isSetupFinished(cfg)) return { ok: true, skipped: 'setup' };
  if (brake === 'protect' || brake === 'limit') return { ok: true, skipped: 'brake' };
  const season = Number(cfg.season);
  const state = (await readJson(env, foKey(season, 'state.json'))) || { hashes: {}, writes: 0, builds: 0 };
  if (!force && state.builtAt && now - Date.parse(state.builtAt) < (state.every || SLOW_MS)) return { ok: true, skipped: 'interval', next: new Date(Date.parse(state.builtAt) + (state.every || SLOW_MS)).toISOString() };
  const t0 = Date.now();
  const I = await gatherFoInputs(env, season);
  // Fortune Teller's odds appear only while Fortune Teller itself is visible to members.
  if (visibilityOf(cfg, 'fortune-teller') !== VISIBILITY.VISIBLE) I.ftSwing = null;
  const M0 = buildFoModel(I, { now });
  if (!M0) {
    await putJson(env, foKey(season, 'state.json'), { ...state, builtAt: new Date(now).toISOString(), every: SLOW_MS, lastError: 'Rosters are not stored yet.' });
    return { ok: true, skipped: 'no-rosters' };
  }
  M0.season = season;
  const fs = firstSeen(M0, I.projFirstDoc);
  if (fs.grew) await putJson(env, foKey(season, `proj-w${M0.week}.json`), fs.doc);
  const M = { ...M0, projFirst: fs.doc.players };
  const did = [];
  const hashes = { ...(state.hashes || {}) };
  const iso = new Date(now).toISOString();
  const built = {};
  for (const id of Object.keys(M.teams).map(Number)) {
    let doc;
    try { doc = teamDoc(M, id, { now: iso }); } catch (err) { did.push(`team ${id}: ${String((err && err.message) || err).slice(0, 80)}`); continue; }
    const sig = docSignature(doc);
    built[id] = iso;
    if (!force && hashes[id] === sig) continue;
    await putJson(env, foKey(season, `team-${id}.json`), doc);
    hashes[id] = sig;
    did.push(`team ${id}`);
  }
  const index = { season, week: M.week, v: RULES_VERSION, builtAt: iso,
    teams: Object.fromEntries(Object.values(M.teams).map((t) => [t.id, { name: t.name, logo: t.logo }])) };
  await putJson(env, foKey(season, 'index.json'), index);
  const every = intervalFor(M, now);
  const ms = Date.now() - t0;
  await putJson(env, foKey(season, 'state.json'), { builtAt: iso, every, hashes, week: M.week, v: RULES_VERSION, reason, ms,
    writes: (state.writes || 0) + did.filter((d) => /^team \d+$/.test(d)).length, builds: (state.builds || 0) + 1, lastError: null,
    sources: Object.fromEntries(Object.entries({ weekly: I.weekly, rosters: I.rosters, scoreboard: I.scoreboard }).map(([k, v]) => [k, Boolean(v)])) });
  return { ok: true, did, week: M.week, every, ms };
}

export const readFoIndex = (env, season) => readJson(env, foKey(season, 'index.json'));
export const readFoState = (env, season) => readJson(env, foKey(season, 'state.json'));
export const readFoTeam = (env, season, id) => env.DATA.get(foKey(season, `team-${id}.json`));

/**
 * The live overlay, laid over a stored page at request time from the live digest: each player's lock, game state and
 * points as they stand now, this week's lineup total, and the late-swap line. A stored page never shows a stale lock.
 */
export function overlayLive(doc, digest, now = Date.now()) {
  if (!doc || !doc.tw || !digest || Number(digest.scoringPeriod || digest.matchupPeriod) !== doc.week) return doc;
  const by = {};
  for (const g of digest.games || []) for (const side of [g.home, g.away]) for (const p of [...((side && side.starters) || []), ...((side && side.bench) || [])]) if (p && p.id != null) by[p.id] = p;
  const tw = { ...doc.tw };
  const fix = (c) => {
    const p = by[c.pid];
    if (!p || c.bye) return c;
    const k = p.kickoff || c.kickoff;
    const state = p.gameStatus === 'final' ? 'final' : p.gameStatus === 'live' ? 'live' : 'pre';
    const locked = state !== 'pre' || (k ? Date.parse(k) <= now : c.locked);
    return { ...c, state, locked: Boolean(locked), live: state !== 'pre' ? Math.round((Number(p.points) || 0) * 100) / 100 : c.live };
  };
  tw.starters = tw.starters.map(fix); tw.bench = tw.bench.map(fix); tw.ir = tw.ir.map(fix);
  const val = (c) => (c.locked && c.live != null ? c.live : c.bye || ['OUT', 'INJURY_RESERVE', 'SUSPENSION'].includes(c.inj) ? 0 : c.proj);
  tw.totals = { ...tw.totals, lineup: Math.round(tw.starters.reduce((s, c) => s + val(c), 0) * 100) / 100 };
  if (tw.totals.best < tw.totals.lineup) tw.totals.best = tw.totals.lineup;
  const open = tw.starters.filter((c) => !c.locked);
  const anyLocked = tw.starters.some((c) => c.locked);
  tw.lateSwap = anyLocked && open.length ? { open: open.map((c) => SLOT_NAME[c.slot]), nextLock: open.map((c) => c.kickoff).filter(Boolean).sort()[0] || null } : null;
  tw.over = anyLocked && tw.starters.every((c) => c.state === 'final' || c.bye);
  // Alternatives for a slot that has locked no longer apply; the checklist's open-slot items wait for the next build.
  tw.starters = tw.starters.map((c) => (c.locked ? { ...c, alt: null } : c));
  const gen = Date.parse(digest.generatedAt || '') || 0;
  return { ...doc, tw, asOf: gen > Date.parse(doc.builtAt || '') ? digest.generatedAt : doc.builtAt };
}
