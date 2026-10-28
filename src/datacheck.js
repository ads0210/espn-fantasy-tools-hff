/**
 * The hourly reachability check of every dataset ESPN serves (week 6, plan F2, PD9, PD21).
 *
 * Each source dataset is asked for its first part once an hour: dataset i at minute i of the hour,
 * so the 31 checks are spread one a minute and no single run piles up requests. A dataset that fails
 * three checks in a row raises the home page's "Some league data can't be reached" banner; whoever
 * administers the site can dismiss it for everyone with the Admin Password, and it stays dismissed
 * until a check fails three times in a row again. It clears itself once every listed dataset answers.
 *
 * Results live in one small R2 record (KV allows 1,000 writes a day; this writes about 744), each
 * dataset keeping its last 24 results. Recording never throws into the minute work.
 *
 * What counts as unreachable: no answer, a timeout, a 403 or 5xx, or an answer that is not JSON.
 * Not unreachable: an expected empty answer, or a 404 from a dataset the registry marks allowEmpty
 * (one ESPN gives out of season). A refused ESPN sign-in (401) is the "ESPN sign-in has expired"
 * banner's business, so it is recorded as "sign-in" and never counts toward a streak.
 */
import { DATASETS, getDataset } from './datasets.js';
import { fetchPart, inspectBody } from './espn.js';
import { sendEvents } from './sitelog.js';

export const CHECK_KEY = 'meta/datacheck.json';
export const DEV_FORCE_KEY = 'dev/datacheck-force.json';
export const KEEP = 24;
export const STREAK = 3;
const CHECK_TIMEOUT_MS = 20000;

/** Each checked dataset in members' words, for the home page's banner. */
export const MEMBER_NAMES = {
  draft_results: 'the league\u2019s draft', free_agent_pool: 'free agents', league_history: 'past seasons',
  league_players: 'the league\u2019s player pool', league_settings: 'league settings', league_status: 'league status',
  league_teams: 'league teams', live_scoring: 'live fantasy scoring', matchups: 'matchups and scores',
  nfl_calendar: 'the NFL calendar', nfl_depth_charts: 'NFL depth charts', nfl_groups: 'NFL divisions',
  nfl_injuries: 'NFL injuries', nfl_leaders: 'NFL statistical leaders', nfl_news: 'NFL news', nfl_powerindex: 'ESPN\u2019s NFL power index',
  nfl_qbr_weekly: 'NFL quarterback ratings', nfl_scoreboard: 'the NFL scoreboard', nfl_standings: 'NFL standings',
  nfl_team_rosters: 'NFL team rosters', nfl_team_schedules: 'NFL team schedules', nfl_team_season_stats: 'NFL team statistics',
  nfl_teams: 'NFL teams', nfl_transactions: 'NFL transactions', nfl_weekly_events: 'NFL games by week',
  pending_transactions: 'open trade offers', positional_ratings: 'points allowed by each NFL defence', player_weeks: 'players\u2019 weekly scoring', rosters: 'rosters',
  season_schedule: 'the season schedule', standings: 'standings', transactions: 'league activity',
};

export function memberName(key) {
  const d = getDataset(key);
  return MEMBER_NAMES[key] || (d ? d.label : key);
}

/** The datasets the check covers, in a fixed order: every source dataset (a digest is covered by its source). */
export function checkPlan() {
  return DATASETS.filter((d) => !d.derivedFrom).map((d) => d.key).sort();
}

/** Which dataset the check asks about in a given minute, or null for a quiet minute. */
export function dueAt(at, plan = checkPlan()) {
  const m = new Date(at).getUTCMinutes();
  return m < plan.length ? plan[m] : null;
}

/** One answer, classified. */
export function classify(res, ds) {
  if (!res) return { ok: false, kind: 'no answer' };
  if (res.status === 401) return { ok: null, kind: 'sign-in' };
  if (res.ok) {
    if (!res.buffer || !res.buffer.byteLength) return ds && ds.allowEmpty ? { ok: true, kind: 'empty' } : { ok: false, kind: 'empty answer' };
    const ins = inspectBody(res.buffer, null);
    return ins.looksJson ? { ok: true, kind: 'ok' } : { ok: false, kind: 'not JSON' };
  }
  if (res.status === 404 && ds && ds.allowEmpty) return { ok: true, kind: 'out of season' };
  if (res.error === 'timeout') return { ok: false, kind: 'timeout' };
  if (!res.status) return { ok: false, kind: 'no answer' };
  return { ok: false, kind: `HTTP ${res.status}` };
}

export function emptyRecord() {
  return { v: 1, datasets: {}, dismissedAt: null };
}

export async function readCheck(env) {
  try {
    const obj = await env.DATA.get(CHECK_KEY);
    if (!obj) return emptyRecord();
    const r = await obj.json();
    return r && r.v === 1 ? { ...emptyRecord(), ...r } : emptyRecord();
  } catch {
    return emptyRecord();
  }
}

/**
 * Fold one result into a dataset's history. A sign-in refusal is kept in the history but neither
 * extends nor breaks a streak. Returns what changed: raised (a streak just reached three) or
 * recovered (a raised dataset answered).
 */
export function fold(entry, result, at) {
  const e = entry ? { ...entry, results: [...(entry.results || [])] } : { results: [], streak: 0, since: null, raisedAt: null, lastOk: null };
  e.results.push({ at, ok: result.ok, kind: result.kind, status: result.status ?? null, ms: result.ms ?? null });
  if (e.results.length > KEEP) e.results = e.results.slice(-KEEP);
  let change = null;
  if (result.ok === true) {
    if (e.raisedAt) change = 'recovered';
    e.streak = 0; e.since = null; e.raisedAt = null; e.lastOk = at;
  } else if (result.ok === false) {
    if (!e.streak) e.since = at;
    e.streak += 1;
    if (e.streak === STREAK) { e.raisedAt = at; change = 'raised'; }
  }
  return { entry: e, change };
}

/** The datasets the banner names now: raised, and raised after the last dismissal. */
export function raised(record) {
  const out = [];
  for (const [key, e] of Object.entries((record && record.datasets) || {})) {
    if (!e || !e.raisedAt || e.streak < STREAK) continue;
    if (!getDataset(key)) continue;
    if (record.dismissedAt && e.raisedAt <= record.dismissedAt) continue;
    out.push({ key, since: e.since, raisedAt: e.raisedAt, lastOk: e.lastOk });
  }
  return out.sort((a, b) => a.since - b.since || a.key.localeCompare(b.key));
}

/** Every dataset with a streak of three or more, dismissed or not: what Site Backend shows. */
export function failing(record) {
  return Object.entries((record && record.datasets) || {}).filter(([k, e]) => e && e.streak >= STREAK && getDataset(k)).map(([k]) => k).sort();
}

async function devForced(env, key, at) {
  if (!env.DEV_TOKEN) return false;
  try {
    const obj = await env.DATA.get(DEV_FORCE_KEY);
    if (!obj) return false;
    const f = await obj.json();
    return Boolean(f && f.key === key && Number(f.until) > at);
  } catch {
    return false;
  }
}

/**
 * Check one dataset now and record it. `brake` is the site's current brake; at Protect (or past a
 * limit) the check rests, inside the backend's reserve like every other recurring job.
 */
export async function checkOne(env, cfg, key, { at = Date.now(), brake = 'normal' } = {}) {
  const ds = getDataset(key);
  if (!ds || ds.derivedFrom) return null;
  if (brake === 'protect' || brake === 'limit') return { key, rested: true };
  const part = ds.parts(cfg)[0];
  if (!part || !part.url) return null;
  let result;
  if (await devForced(env, key, at)) {
    result = { ok: false, kind: 'forced (dev)', status: 0, ms: 0 };
  } else {
    const t0 = Date.now();
    const res = await fetchPart(cfg, part, { auth: Boolean(ds.auth), timeoutMs: Math.min(ds.timeoutMs || CHECK_TIMEOUT_MS, CHECK_TIMEOUT_MS) });
    result = { ...classify(res, ds), status: res ? res.status : 0, ms: Date.now() - t0 };
  }
  const record = await readCheck(env);
  const { entry, change } = fold(record.datasets[key], result, at);
  record.datasets[key] = entry;
  // A dataset the registry no longer carries is dropped from the record.
  for (const k of Object.keys(record.datasets)) if (!getDataset(k)) delete record.datasets[k];
  await env.DATA.put(CHECK_KEY, JSON.stringify(record), { httpMetadata: { contentType: 'application/json; charset=utf-8' } });
  if (change) {
    try {
      await sendEvents(env, [{
        kind: 'change', page: 'home', sev: change === 'raised' ? 'bad' : 'ok',
        text: change === 'raised' ? `ESPN has not answered for ${ds.label} three checks in a row` : `ESPN answers for ${ds.label} again`,
      }]);
    } catch { /* the log is never load-bearing */ }
  }
  return { key, ...result, streak: entry.streak, change };
}

/** The minute's check: whichever dataset is due this minute. */
export async function checkDue(env, cfg, { at = Date.now(), brake = 'normal' } = {}) {
  const key = dueAt(at);
  if (!key) return null;
  return checkOne(env, cfg, key, { at, brake });
}

/** Dismiss the banner for everyone (Admin Password checked by the route). */
export async function dismiss(env, at = Date.now()) {
  const record = await readCheck(env);
  const shown = raised(record).map((r) => r.key);
  record.dismissedAt = at;
  await env.DATA.put(CHECK_KEY, JSON.stringify(record), { httpMetadata: { contentType: 'application/json; charset=utf-8' } });
  return { dismissedAt: at, keys: shown };
}

/**
 * What the home page's banner says, or null when nothing is raised: each dataset in members' words, the pages that
 * use it, when ESPN last answered for it, and when its stored copy was made (the copy pages are showing).
 */
export async function bannerFacts(env, { record = null, usedBy = null } = {}) {
  const rec = record || (await readCheck(env));
  const list = raised(rec);
  if (!list.length) return null;
  const out = [];
  for (const r of list) {
    let lastGood = null;
    try {
      const page = await env.DATA.list({ prefix: `data/${r.key}/`, limit: 100 });
      for (const o of page.objects || []) {
        const t = o.uploaded instanceof Date ? o.uploaded.getTime() : Date.parse(o.uploaded);
        if (Number.isFinite(t) && (!lastGood || t > lastGood)) lastGood = t;
      }
    } catch { /* the banner still says what is missing */ }
    out.push({
      key: r.key, name: memberName(r.key), since: r.since, lastOk: r.lastOk, lastGood,
      tools: usedBy ? usedBy(r.key).map((p) => p.name) : [],
    });
  }
  return out;
}
