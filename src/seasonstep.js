/**
 * Season Statistics' backend step (plan "The new backend step: pull every settled week once").
 *
 * Runs inside the dataset coordinator's 'season_stats' instance (src/coordinator.js, route /season-stats), asked by
 * the minute's work (src/index.js runMinute) and, at most every five minutes per isolate, by a page that reads the
 * figures. Each call does at most one ESPN request, so it fits any minute:
 *
 *   1. Pull one settled scoring period's box score that is not stored yet (the request Live Matchups uses for a past
 *      week, fetchScoringPeriod below) and keep it compacted (compactWeek): season-stats/<season>/weeks/p<N>.json.
 *   2. Otherwise re-check one period 7 days after it was first pulled, for ESPN's stat corrections (D18).
 *   3. Build one settled week's score-timeline facts (timelineFacts), once: season-stats/<season>/timeline/w<N>.json.
 *      One read of that week's timeline object (a single stored key, a handful of rows read).
 *   4. When anything the records read has changed (checked every 5 minutes, or at once after 1-3), rebuild the
 *      periods: Whole season, Regular season and Postseason every time, an "After week N" part only when it is
 *      missing or a week it covers was corrected. One part per period: season-stats/<season>/stats/<key>.json,
 *      and an index: season-stats/<season>/index.json.
 *
 * Nothing runs until setup is finished, no ESPN request is made while the brake is on, and nothing is rebuilt at
 * the brake's Protect level or above. Every stored figure is a settled one; the live overlay is the page's (D33).
 */
import { loadConfig, isSetupFinished, canCallEspn } from './config.js';
import { getPart, headPart } from './store.js';
import { fetchPart } from './espn.js';
import { PARAM_DATASETS, historySeasons } from './datasets.js';
import { coordinatorRefresh } from './dedupe.js';
import { timelineRead } from './timeline.js';
import { FT_ESPN_ODDS_KEY } from './fortuneteller.js';
import { buildSeasonModel, compactWeek, timelineFacts, periods, compute, SECTIONS } from './seasonstats.js';
import { liveBase } from './seasonlive.js';

export const SS_PREFIX = 'season-stats/';
export const ssKey = (season, rest) => `${SS_PREFIX}${season}/${rest}`;
export const RECHECK_AFTER_MS = 7 * 86400000;
export const SIGNATURE_EVERY_MS = 5 * 60000;
/** Frozen "After week N" parts built in one call at most: a cold start mid-season spreads its builds out. */
export const FROZEN_PER_CALL = 6;
const SCHEDULE_TTL_MS = 30 * 60000;
const SOURCE_PARTS = [
  ['season_schedule', 'main'], ['league_settings', 'main'], ['standings', 'main'], ['standings_digest', 'main'],
  ['player_weeks', 'leaders'], ['player_weeks', 'rostered'], ['draft_results', 'main'], ['league_history_digest', 'main'],
];
const TX_PARTS = 18;

/** One scoring period's box score from ESPN (Live Matchups' past-week request; one shared function). */
export async function fetchScoringPeriod(cfg, period) {
  const spec = PARAM_DATASETS.live_scoring_week;
  return fetchPart(cfg, { url: spec.url(cfg, period) }, { auth: true });
}

const readJson = async (env, key) => {
  try { const o = await env.DATA.get(key); return o ? await o.json() : null; } catch { return null; }
};
const partJson = async (env, ds, part) => {
  try { const o = await getPart(env, ds, part); return o ? await o.json() : null; } catch { return null; }
};
const putJson = (env, key, value) => env.DATA.put(key, JSON.stringify(value), { httpMetadata: { contentType: 'application/json; charset=utf-8' } });
/** A short, stable fingerprint of a string (FNV-1a, 32-bit, hex). */
export function fingerprint(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

/**
 * The league's calendar from its settings and schedule: the regular weeks, each matchup period's scoring periods,
 * the scoring period ESPN is in, and which periods and matchup periods have settled. A scoring period has settled
 * once ESPN has moved past it, or once every matchup it belongs to has a winner (the season's last week).
 */
export function seasonCalendar(settings, schedule) {
  const ss = (settings && settings.settings && settings.settings.scheduleSettings) || {};
  const regWeeks = Number(ss.matchupPeriodCount) || 13;
  const playoffTeams = Number(ss.playoffTeamCount) || 4;
  const map = ss.matchupPeriods || {};
  const fixtures = (schedule && schedule.schedule) || [];
  const mps = [...new Set([...Object.keys(map).map(Number), ...fixtures.map((m) => m.matchupPeriodId)])].filter(Number.isFinite).sort((a, b) => a - b);
  const periodsOf = (mp) => (Array.isArray(map[mp]) && map[mp].length ? map[mp].map(Number) : [mp]);
  const current = Number((schedule && (schedule.scoringPeriodId || (schedule.status && schedule.status.currentMatchupPeriod))) || 1);
  const decided = (mp) => {
    const list = fixtures.filter((m) => m.matchupPeriodId === mp && m.home && m.away);
    return list.length > 0 && list.every((m) => m.winner && m.winner !== 'UNDECIDED');
  };
  const settledMps = mps.filter(decided);
  const settledPeriods = new Set();
  for (const mp of mps) for (const p of periodsOf(mp)) if (p < current || decided(mp)) settledPeriods.add(p);
  return { regWeeks, playoffTeams, mps, periodsOf, current, settledMps, settledPeriods: [...settledPeriods].sort((a, b) => a - b),
    totalWeeks: Math.max(regWeeks + Math.ceil(Math.log2(Math.max(2, playoffTeams))), ...mps, 0) };
}

/** The starting lineup's slots from the league's roster settings, as [slot id, count]. */
export function startSlotsOf(settings) {
  const counts = (settings && settings.settings && settings.settings.rosterSettings && settings.settings.rosterSettings.lineupSlotCounts) || {};
  return Object.entries(counts).filter(([k, n]) => n > 0 && k !== '20' && k !== '21').map(([k, n]) => [Number(k), n]);
}

/** Everything buildSeasonModel reads, gathered from stored copies (no ESPN request). */
export async function gatherInputs(env, cfg, season, state) {
  const [schedule, settings, standings, digest, leaders, rostered, draft, hof, odds] = await Promise.all([
    partJson(env, 'season_schedule', 'main'), partJson(env, 'league_settings', 'main'), partJson(env, 'standings', 'main'),
    partJson(env, 'standings_digest', 'main'), partJson(env, 'player_weeks', 'leaders'), partJson(env, 'player_weeks', 'rostered'),
    partJson(env, 'draft_results', 'main'), partJson(env, 'league_history_digest', 'main'), readJson(env, FT_ESPN_ODDS_KEY),
  ]);
  if (!schedule || !settings) return null;
  const cal = seasonCalendar(settings, schedule);
  const rows = (digest && digest.rows) || [];
  const raw = Object.fromEntries((((standings && standings.teams) || (schedule && schedule.teams)) || []).map((t) => [t.id, t]));
  const teams = rows.map((r) => {
    const t = raw[r.teamId] || {};
    return { id: r.teamId, name: r.name, logo: r.logo || null, owner: r.owner || '', playoffPct: typeof r.playoffPct === 'number' ? r.playoffPct : null,
      eliminatedAt: Number(t.eliminationMatchupPeriod) || 0 };
  });
  const weeks = {};
  for (const p of Object.keys(state.periods || {})) {
    const w = await readJson(env, ssKey(season, `weeks/p${p}.json`));
    if (w) weeks[p] = w;
  }
  const players = {};
  const addPlayers = (doc) => {
    for (const e of (doc && doc.players) || []) {
      const pl = e.player || {};
      if (!pl.id || players[pl.id]) continue;
      const weekly = {};
      for (const s of pl.stats || []) if (s.statSourceId === 0 && s.statSplitTypeId === 1 && Number(s.seasonId) === season && s.scoringPeriodId > 0) weekly[s.scoringPeriodId] = s.appliedTotal;
      players[pl.id] = { pid: pl.id, name: pl.fullName || '', posId: pl.defaultPositionId, onTeam: e.onTeamId || 0, weekly };
    }
  };
  addPlayers(leaders); addPlayers(rostered);
  const txs = [];
  for (let p = 1; p <= TX_PARTS; p++) {
    const doc = await partJson(env, 'transactions', `sp${p}`);
    for (const x of (doc && doc.transactions) || []) txs.push({ id: x.id, period: p, type: x.type, status: x.status, team: x.teamId, items: x.items || [] });
  }
  const tl = {}, tlWeeks = [];
  for (const [w, s] of Object.entries(state.tl || {})) {
    if (!s || !s.recorded) continue;
    const doc = await readJson(env, ssKey(season, `timeline/w${w}.json`));
    if (!doc) continue;
    tlWeeks.push(Number(w));
    Object.assign(tl, doc.facts || {});
  }
  const past = {};
  for (const yr of historySeasons(cfg)) {
    if (Number(yr) >= season) continue;
    const d0 = await partJson(env, 'league_history', String(yr));
    const d = Array.isArray(d0) ? d0[0] : d0;
    if (!d || !d.schedule) continue;
    const reg = (d.settings && d.settings.scheduleSettings && d.settings.scheduleSettings.matchupPeriodCount) || 13;
    past[yr] = d.schedule.filter((m) => m.home && m.away && m.winner && m.winner !== 'UNDECIDED' && m.matchupPeriodId <= reg)
      .map((m) => ({ week: m.matchupPeriodId, winner: m.winner === 'HOME' ? m.home.teamId : m.winner === 'AWAY' ? m.away.teamId : 0 }));
  }
  return {
    cal,
    inputs: {
      season, regWeeks: cal.regWeeks, playoffTeams: cal.playoffTeams, startSlots: startSlotsOf(settings), teams,
      schedule: schedule.schedule || [], weeks, players: Object.values(players),
      draft: (draft && draft.draftDetail && draft.draftDetail.picks) || [], txs, tl, tlWeeks, past,
      hof: hof ? { records: hof.records || {} } : null, espnOdds: odds,
    },
  };
}

/** What the records read, fingerprinted from stored objects' etags (one head each): unchanged means no rebuild. */
async function sourceSignature(env, state) {
  const tags = [];
  for (const [ds, part] of SOURCE_PARTS) { const h = await headPart(env, ds, part); tags.push(h ? h.etag || String(h.uploaded) : '-'); }
  for (let p = 1; p <= TX_PARTS; p++) { const h = await headPart(env, 'transactions', `sp${p}`); tags.push(h ? h.etag || '' : '-'); }
  const o = await env.DATA.head(FT_ESPN_ODDS_KEY).catch(() => null); tags.push(o ? o.etag || '' : '-');
  tags.push(JSON.stringify(state.periods || {}), JSON.stringify(state.tl || {}));
  return fingerprint(tags.join('|'));
}

/** The weeks' fingerprints an "After week N" part was built from, so a correction to any of them rebuilds it. */
const coverOf = (state, mpPeriods, mps) => fingerprint(mpPeriods.map((p) => (state.periods[p] && state.periods[p].hash) || '-').join(',')
  + '|' + mps.map((w) => (state.tl[w] ? `${w}:${state.tl[w].recorded ? 1 : 0}` : '-')).join(','));

/**
 * Rebuild the stored periods from stored copies. `full` rebuilds every period; otherwise the live ones and any
 * frozen part that is missing or whose weeks changed (at most FROZEN_PER_CALL of those).
 */
export async function rebuildParts(env, cfg, season, state, { now = Date.now(), full = false } = {}) {
  const t0 = Date.now();
  const g = await gatherInputs(env, cfg, season, state);
  if (!g) return { built: 0, skipped: 'no schedule or settings stored yet' };
  const model = buildSeasonModel(g.inputs);
  const views = periods(model);
  state.frozen = state.frozen || {};
  let built = 0, frozenBuilt = 0, pending = 0;
  const parts = [];
  for (const v of views) {
    const frozen = v.key.startsWith('w') && /^w\d+$/.test(v.key);
    if (frozen) {
      const mps = model.settledWeeks.filter((w) => w <= Number(v.key.slice(1)));
      const cover = coverOf(state, mps.flatMap((w) => g.cal.periodsOf(w)), mps);
      const have = state.frozen[v.key];
      if (!full && have && have.cover === cover) { parts.push(v); continue; }
      if (!full && frozenBuilt >= FROZEN_PER_CALL) { pending++; continue; }
      frozenBuilt++;
      state.frozen[v.key] = { cover, at: new Date(now).toISOString() };
    }
    const data = compute(model, v);
    // A period the current week belongs to carries every player's settled points, for the page's live figures.
    if (v.live) data.liveBase = liveBase(model, v);
    await putJson(env, ssKey(season, `stats/${v.key}.json`), { builtAt: new Date(now).toISOString(), season, period: { key: v.key, label: v.label, weeks: v.weeks, live: v.live }, ...data });
    built++;
    parts.push(v);
  }
  // Frozen parts whose period no longer exists (a week un-settled by a correction) are dropped from the index.
  const index = {
    builtAt: new Date(now).toISOString(), season,
    calendar: { regWeeks: model.regWeeks, totalWeeks: g.cal.totalWeeks, played: model.settledWeeks, playoffTeams: model.playoffTeams },
    periods: views.filter((v) => parts.includes(v)).map(({ key, label, live, weeks }) => ({ key, label, live, weeks })),
    sections: SECTIONS,
    teams: Object.fromEntries(g.inputs.teams.map((t) => [t.id, { id: t.id, name: t.name, logo: t.logo, owner: t.owner }])),
    timeline: { weeks: [...model.tlWeeks].sort((a, b) => a - b) },
    pending,
  };
  await putJson(env, ssKey(season, 'index.json'), index);
  state.lastBuild = { at: index.builtAt, ms: Date.now() - t0, built, pending };
  return { built, pending, ms: Date.now() - t0 };
}

/**
 * One call of the step. `mem` survives between calls in the object (the signature's last check); `state` is
 * stored at season-stats/<season>/state.json. Returns what it did, for the minute's tick and Site Backend.
 */
export async function seasonStep(env, mem, { now = Date.now(), brake = 'normal', reason = 'minute', force = false } = {}) {
  const cfg = await loadConfig(env);
  if (!isSetupFinished(cfg)) return { ok: true, skipped: 'site not ready' };
  if (brake === 'protect' || brake === 'limit') return { ok: true, skipped: `brake ${brake}` };
  const season = Number(cfg.season);
  const stateKey = ssKey(season, 'state.json');
  const state = (await readJson(env, stateKey)) || { season, periods: {}, tl: {}, frozen: {} };
  state.periods = state.periods || {}; state.tl = state.tl || {};
  const out = { ok: true, season, did: [] };
  let changed = false;

  // The schedule decides what has settled; it is kept within 30 minutes old here, so the step never waits on a page.
  const head = await headPart(env, 'season_schedule', 'main');
  const fetchedAt = head && head.uploaded ? new Date(head.uploaded).getTime() : 0;
  const espnOk = canCallEspn(cfg) && brake === 'normal';
  if (espnOk && (!fetchedAt || now - fetchedAt > SCHEDULE_TTL_MS)) {
    try { await coordinatorRefresh(env, 'season_schedule', false); out.did.push('schedule'); } catch { /* the next call tries again */ }
  }
  const [schedule, settings] = await Promise.all([partJson(env, 'season_schedule', 'main'), partJson(env, 'league_settings', 'main')]);
  if (!schedule || !settings) { out.skipped = 'no schedule or settings stored yet'; return out; }
  const cal = seasonCalendar(settings, schedule);
  out.current = cal.current;

  // 1. One missing settled period, or 2. one re-check due.
  if (espnOk) {
    const missing = cal.settledPeriods.find((p) => !state.periods[p]);
    const due = missing ? null : cal.settledPeriods.find((p) => {
      const s = state.periods[p];
      return s && !s.recheckedAt && now - Date.parse(s.at) >= RECHECK_AFTER_MS;
    });
    const p = missing || due;
    if (p) {
      const res = await fetchScoringPeriod(cfg, p);
      if (res.ok && res.buffer) {
        try {
          const wk = compactWeek(JSON.parse(new TextDecoder().decode(res.buffer)), p, season);
          if (wk.teams.length) {
            const hash = fingerprint(JSON.stringify(wk.teams));
            const prev = state.periods[p];
            if (!prev || prev.hash !== hash) { await putJson(env, ssKey(season, `weeks/p${p}.json`), wk); changed = true; }
            state.periods[p] = { at: prev ? prev.at : new Date(now).toISOString(), hash, ...(prev ? { recheckedAt: new Date(now).toISOString(), corrected: prev.hash !== hash } : {}) };
            out.did.push(prev ? `recheck p${p}${prev.hash !== hash ? ' (corrected)' : ''}` : `pulled p${p}`);
          } else {
            // Kept as read, so a period ESPN answers empty never holds the rebuild back; re-checked like any other.
            state.periods[p] = { at: new Date(now).toISOString(), hash: 'empty', empty: true };
            out.did.push(`p${p} came back empty`);
            changed = true;
          }
        } catch { out.did.push(`p${p} unreadable`); }
      } else out.did.push(`p${p} failed (${res.status || 'no answer'})`);
    }
  }

  // 3. One settled matchup period's timeline facts.
  const tlDue = cal.settledMps.find((w) => !state.tl[w]);
  if (tlDue) {
    const read = await timelineRead(env, String(season), tlDue).catch(() => null);
    const rows = (read && read.rows) || [];
    const series = {};
    for (const r of rows) for (const [id, v] of Object.entries(r.m || {})) (series[id] = series[id] || []).push([Date.parse(r.t), v[0], v[1], v[2]]);
    const facts = {};
    for (const m of (schedule.schedule || []).filter((x) => x.matchupPeriodId === tlDue && x.winner && x.winner !== 'UNDECIDED')) {
      if (series[m.id] && series[m.id].length) facts[m.id] = timelineFacts(series[m.id], m.winner === 'HOME');
    }
    const recorded = Object.keys(facts).length > 0;
    await putJson(env, ssKey(season, `timeline/w${tlDue}.json`), { week: tlDue, rows: rows.length, facts });
    state.tl[tlDue] = { at: new Date(now).toISOString(), recorded, rows: rows.length };
    out.did.push(`timeline w${tlDue}${recorded ? '' : ' (not recorded)'}`);
    changed = true;
  }

  // 4. Rebuild when anything read has changed (checked every 5 minutes, at once after a change or when asked).
  /* Nothing is rebuilt while a settled week is still to be read: a site set up mid-season would otherwise show
     partial figures for its first minutes. Asked for (force), it builds with what it has. */
  const missing = cal.settledPeriods.filter((p) => !state.periods[p]).length;
  if (missing && !force) out.did.push(`waiting for ${missing} more week${missing === 1 ? '' : 's'} before building`);
  const checkDue = (!missing || force) && (force || changed || reason === 'visit' || !mem.sigAt || now - mem.sigAt >= SIGNATURE_EVERY_MS);
  if (checkDue) {
    mem.sigAt = now;
    const sig = await sourceSignature(env, state);
    const pendingFrozen = state.lastBuild && state.lastBuild.pending > 0;
    if (force || sig !== state.sig || pendingFrozen) {
      const r = await rebuildParts(env, cfg, season, state, { now, full: force === 'full' });
      if (!r.skipped) state.sig = sig;
      out.did.push(r.skipped ? `rebuild skipped: ${r.skipped}` : `rebuilt ${r.built} part${r.built === 1 ? '' : 's'} in ${r.ms} ms${r.pending ? `, ${r.pending} to go` : ''}`);
      changed = true;
    }
  }
  if (changed) await putJson(env, stateKey, state);
  out.state = { periods: Object.keys(state.periods).length, timeline: Object.keys(state.tl).length, lastBuild: state.lastBuild || null };
  return out;
}

/** The stored index and one period's part, for the page and the other readers. */
export async function readSeasonIndex(env, season) { return readJson(env, ssKey(season, 'index.json')); }
export async function readSeasonPart(env, season, key) { return env.DATA.get(ssKey(season, `stats/${key}.json`)); }
export async function readSeasonState(env, season) { return readJson(env, ssKey(season, 'state.json')); }
