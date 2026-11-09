/**
 * Trade Analyzer's Postmortem: the backend step (Week 10 plan, push 4), in the dataset coordinator's
 * 'trade_postmortem' instance, run by the minute's work like every other tool's step (no new binding, no migration).
 *
 * Backfill: every season ESPN still serves for the league (this one and the history seasons), a few ESPN reads a call:
 * the season's settings, teams and schedule, every scoring period's trade records, every scoring period's rosters
 * (reduced at once to player, slot, position, points and projection), each NFL team's kickoffs, and the weekly figures
 * of every player named in an offer. Past seasons are read once and never change. This season is kept up to date:
 * trade records of the last two periods every half hour, rosters for weeks not yet settled twice a day (ESPN's weekly
 * projections), a settled week once more after it settles.
 *
 * Stored in R2 under postmortem/<season>/: raw/… (the reduced reads), season.json (every decided offer with its
 * weekly figures, src/postmortem.js), verdicts.json (this season: Trade Analyzer's verdict on an offer the first time
 * the site sees it on the table, D6). postmortem/state.json holds the progress.
 */
import { loadConfig, isSetupFinished, canCallEspn } from './config.js';
import { fetchPart } from './espn.js';
import { historySeasons } from './datasets.js';
import { getPart } from './store.js';
import { postmortemSeason, offersOf, PM_VERSION } from './postmortem.js';
import { createEngine } from '../app/trade-analyzer/engine.js';
import { ENGINE_VERSION } from '../app/trade-analyzer/constants.js';

const HOST = 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl';
export const pmKey = (season, name) => `postmortem/${season}/${name}`;
export const PM_STATE_KEY = 'postmortem/state.json';
export const FETCHES_PER_CALL = 3;
const HOUR = 3600e3;
const BASE_EVERY = 6 * HOUR, TX_EVERY = 0.5 * HOUR, OPEN_ROSTERS_EVERY = 12 * HOUR, KICK_EVERY = 24 * HOUR, PLAYERS_EVERY = 12 * HOUR;
const BUILD_EVERY_MS = 5 * 60e3, VERDICT_EVERY_MS = 5 * 60e3;

const readJson = async (env, key) => {
  try { const o = await env.DATA.get(key); return o ? await o.json() : null; } catch { return null; }
};
const partJson = async (env, ds, part = 'main') => {
  try { const o = await getPart(env, ds, part); return o ? await o.json() : null; } catch { return null; }
};
const putJson = (env, key, value) => env.DATA.put(key, JSON.stringify(value), { httpMetadata: { contentType: 'application/json; charset=utf-8' } });
const r2 = (x) => (x == null ? null : Math.round(Number(x) * 100 + 1e-9) / 100);
function fingerprint(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16);
}

/* ------------------------------------------------------------------ reductions (pure, tested) */
const statOf = (pl, yr, period, src) => {
  for (const s of pl.stats || []) if (s.seasonId === yr && s.scoringPeriodId === period && s.statSourceId === src && s.statSplitTypeId === 1) return r2(s.appliedTotal || 0);
  return null;
};
/** The season's frame from one league read (settings, teams, schedule, status). */
export function reduceBase(d, yr) {
  const st = d.settings || {};
  const ss = st.scheduleSettings || {};
  const final = Number((d.status || {}).finalScoringPeriod) || 17;
  return {
    season: yr, mpc: Number(ss.matchupPeriodCount) || 13, final, current: Number(d.scoringPeriodId) || final,
    slots: (st.rosterSettings || {}).lineupSlotCounts || {}, trade: { revisionHours: (st.tradeSettings || {}).revisionHours ?? null, deadlineDate: (st.tradeSettings || {}).deadlineDate ?? null },
    teams: (d.teams || []).map((t) => ({ id: t.id, name: t.name || `${t.location || ''} ${t.nickname || ''}`.trim() || `Team ${t.id}`, abbrev: t.abbrev || null })),
    members: Object.fromEntries((d.teams || []).flatMap((t) => (t.owners || []).map((o) => [String(o), t.id]))),
    schedule: (d.schedule || []).map((m) => ({ week: m.matchupPeriodId, home: (m.home || {}).teamId ?? null, away: (m.away || {}).teamId ?? null,
      hby: (m.home || {}).pointsByScoringPeriod || null, aby: (m.away || {}).pointsByScoringPeriod || null })),
  };
}
/** A scoring period's trade records, only the fields the offer grouping reads. */
export function reduceTx(d) {
  return ((d && d.transactions) || []).filter((x) => String(x.type || '').toUpperCase().startsWith('TRADE')).map((x) => ({
    id: x.id, type: x.type, status: x.status, teamId: x.teamId, memberId: x.memberId, proposedDate: x.proposedDate, processDate: x.processDate,
    expirationDate: x.expirationDate, relatedTransactionId: x.relatedTransactionId, scoringPeriodId: x.scoringPeriodId,
    items: (x.items || []).map((i) => ({ type: i.type, playerId: i.playerId, fromTeamId: i.fromTeamId, toTeamId: i.toTeamId })),
  }));
}
/** A scoring period's rosters: per team [pid, slot, position, points, projection, name, NFL team]. */
export function reduceRosters(d, yr, p) {
  const out = {};
  for (const t of (d && d.teams) || []) {
    out[t.id] = ((t.roster && t.roster.entries) || []).map((e) => {
      const pl = (e.playerPoolEntry && e.playerPoolEntry.player) || {};
      return [e.playerId, e.lineupSlotId, pl.defaultPositionId ?? null, statOf(pl, yr, p, 0), statOf(pl, yr, p, 1), pl.fullName || null, pl.proTeamId ?? null];
    });
  }
  return out;
}
/** Each NFL team's kickoff per scoring period (ms). */
export function reduceKick(d) {
  const kick = {};
  for (const t of ((d && d.settings) || {}).proTeams || []) {
    for (const [w, games] of Object.entries(t.proGamesByScoringPeriod || {})) for (const g of games || []) (kick[t.id] = kick[t.id] || {})[w] = g.date ?? null;
  }
  return kick;
}
export function reducePlayers(d, yr, final) {
  const out = {};
  for (const e of (d && d.players) || []) {
    const pl = e.player || {};
    const act = {}, proj = {};
    for (let w = 1; w <= final; w++) { const a = statOf(pl, yr, w, 0), b = statOf(pl, yr, w, 1); if (a != null) act[w] = a; if (b != null) proj[w] = b; }
    out[pl.id] = { name: pl.fullName || null, posId: pl.defaultPositionId ?? null, pro: pl.proTeamId ?? null, act, proj };
  }
  return out;
}

/* ------------------------------------------------------------------ what to read next */
/**
 * The next reads for one season, given its progress `s` and frame `base`, most useful first. Pure: the step and the
 * tests share it. Each job is { kind, period?, ids? }.
 */
export function jobsFor(yr, s, { live, now, base, txIds }) {
  const jobs = [];
  const age = (at) => (at ? now - Date.parse(at) : Infinity);
  if (s.absent) return jobs;
  if (!base || (live && age(s.base) >= BASE_EVERY)) jobs.push({ kind: 'base' });
  if (!base) return jobs;
  const last = live ? Math.min(base.current, base.final) : base.final;
  for (let p = 1; p <= last; p++) {
    const t = (s.tx || {})[p];
    if (!t || (live && p >= base.current - 1 && age(t) >= TX_EVERY)) jobs.push({ kind: 'tx', period: p });
  }
  if (!s.kick || (live && age(s.kick) >= KICK_EVERY)) jobs.push({ kind: 'kick' });
  for (let p = 1; p <= base.final; p++) {
    const r = (s.r || {})[p];
    const settled = !live || p < base.current;
    if (!r) jobs.push({ kind: 'roster', period: p });
    else if (settled && !r.final) jobs.push({ kind: 'roster', period: p });
    else if (!settled && age(r.at) >= OPEN_ROSTERS_EVERY) jobs.push({ kind: 'roster', period: p });
  }
  const want = fingerprint((txIds || []).join(','));
  if (txIds && txIds.length && (s.playersFor !== want || (live && age(s.players) >= PLAYERS_EVERY))) {
    for (let k = 0; k < txIds.length; k += 50) jobs.push({ kind: 'players', batch: k / 50, ids: txIds.slice(k, k + 50), want });
  }
  return jobs;
}

/* ------------------------------------------------------------------ the step */
export function seasonsOf(cfg) {
  const now = Number(cfg.season);
  return [now, ...historySeasons(cfg).map(Number).filter((y) => y < now).sort((a, b) => b - a)];
}

async function readSeasonInput(env, yr, s, base) {
  const tx = [];
  const seen = new Set();
  for (const p of Object.keys(s.tx || {})) for (const x of (await readJson(env, pmKey(yr, `raw/tx-p${p}.json`))) || []) if (!seen.has(x.id)) { seen.add(x.id); tx.push(x); }
  const rosters = {};
  for (const p of Object.keys(s.r || {})) rosters[p] = (await readJson(env, pmKey(yr, `raw/r${p}.json`))) || {};
  const players = (await readJson(env, pmKey(yr, 'raw/players.json'))) || {};
  const kick = (await readJson(env, pmKey(yr, 'raw/kick.json'))) || {};
  return { ...base, tx, rosters, players, kick };
}
const txPlayerIds = (tx) => [...new Set(tx.flatMap((x) => (x.items || []).map((i) => i.playerId)).filter((x) => x != null))].sort((a, b) => a - b);

/** One call: a few ESPN reads, then at most one season rebuilt, then Trade Analyzer's verdicts on new offers. */
export async function postmortemStep(env, mem, { now = Date.now(), brake = 'normal', reason = 'minute', force = false, fetchImpl = null, verdictsOf = null } = {}) {
  const cfg = await loadConfig(env);
  if (!isSetupFinished(cfg)) return { ok: true, skipped: 'site not ready' };
  if (brake === 'protect' || brake === 'limit') return { ok: true, skipped: `brake ${brake}` };
  const iso = new Date(now).toISOString();
  const state = (await readJson(env, PM_STATE_KEY)) || { v: PM_VERSION, seasons: {} };
  state.seasons = state.seasons || {};
  const out = { ok: true, did: [] };
  const live = Number(cfg.season);
  const get = fetchImpl || ((url, opts = {}) => fetchPart(cfg, { url, headers: opts.headers }, { auth: true }));
  const espnOk = canCallEspn(cfg) && brake === 'normal';
  let budget = espnOk ? FETCHES_PER_CALL : 0;
  let stateChanged = false;

  for (const yr of seasonsOf(cfg)) {
    if (budget <= 0) break;
    const s = state.seasons[yr] || (state.seasons[yr] = {});
    const base = s.base ? await readJson(env, pmKey(yr, 'raw/base.json')) : null;
    let txIds = null;
    if (base && Object.keys(s.tx || {}).length >= (yr === live ? Math.min(base.current, base.final) : base.final)) {
      const tx = [];
      for (const p of Object.keys(s.tx || {})) tx.push(...((await readJson(env, pmKey(yr, `raw/tx-p${p}.json`))) || []));
      txIds = txPlayerIds(tx);
    }
    const jobs = jobsFor(yr, s, { live: yr === live, now, base, txIds });
    for (const job of jobs) {
      if (budget <= 0) break;
      budget--;
      const lg = (q) => `${HOST}/seasons/${yr}/segments/0/leagues/${cfg.leagueId}?${q}`;
      let res;
      try {
        if (job.kind === 'base') res = await get(lg('view=mSettings&view=mTeam&view=mMatchupScore&view=mStatus'));
        else if (job.kind === 'tx') res = await get(lg(`view=mTransactions2&scoringPeriodId=${job.period}`));
        else if (job.kind === 'roster') res = await get(lg(`view=mRoster&scoringPeriodId=${job.period}`));
        else if (job.kind === 'kick') res = await get(`${HOST}/seasons/${yr}?view=proTeamSchedules_wl`);
        else if (job.kind === 'players') {
          const final = base ? base.final : 17;
          const filt = { players: { filterIds: { value: job.ids }, filterStatsForScoringPeriodIds: { value: Array.from({ length: final }, (_, i) => i + 1) },
            sortPercOwned: { sortPriority: 1, sortAsc: false }, limit: job.ids.length + 10 } };
          res = await get(lg('view=kona_player_info'), { headers: { 'X-Fantasy-Filter': JSON.stringify(filt) } });
        }
      } catch (e) { res = { ok: false, status: String((e && e.message) || e).slice(0, 60) }; }
      if (!res || !res.ok || !res.buffer) {
        if (job.kind === 'base' && res && (res.status === 404 || res.status === 400)) { s.absent = true; stateChanged = true; out.did.push(`${yr}: not served by ESPN`); }
        else out.did.push(`${yr} ${job.kind}${job.period ? ` p${job.period}` : ''} failed (${(res && res.status) || 'no answer'})`);
        break;
      }
      let d;
      try { d = JSON.parse(new TextDecoder().decode(res.buffer)); } catch { out.did.push(`${yr} ${job.kind} unreadable`); break; }
      if (job.kind === 'base') { await putJson(env, pmKey(yr, 'raw/base.json'), reduceBase(d, yr)); s.base = iso; }
      else if (job.kind === 'tx') { await putJson(env, pmKey(yr, `raw/tx-p${job.period}.json`), reduceTx(d)); (s.tx = s.tx || {})[job.period] = iso; }
      else if (job.kind === 'roster') {
        await putJson(env, pmKey(yr, `raw/r${job.period}.json`), reduceRosters(d, yr, job.period));
        (s.r = s.r || {})[job.period] = { at: iso, final: yr !== live || (base && job.period < base.current) };
      } else if (job.kind === 'kick') { await putJson(env, pmKey(yr, 'raw/kick.json'), reduceKick(d)); s.kick = iso; }
      else if (job.kind === 'players') {
        const had = job.batch === 0 ? {} : ((await readJson(env, pmKey(yr, 'raw/players.json'))) || {});
        await putJson(env, pmKey(yr, 'raw/players.json'), { ...had, ...reducePlayers(d, yr, base ? base.final : 17) });
        if ((job.batch + 1) * 50 >= txIds.length) { s.playersFor = job.want; s.players = iso; }
      }
      s.changedAt = iso;
      stateChanged = true;
      out.did.push(`${yr} ${job.kind}${job.period ? ` p${job.period}` : ''}${job.kind === 'players' ? ` ${job.batch + 1}` : ''}`);
    }
    if (jobs.length) break;   // a season's reads finish before the next season's start
  }

  // At most one season rebuilt a call: one whose reads are complete and changed since it was last built.
  for (const yr of seasonsOf(cfg)) {
    const s = state.seasons[yr];
    if (!s || s.absent || !s.base) continue;
    const base = await readJson(env, pmKey(yr, 'raw/base.json'));
    if (!base) continue;
    const complete = s.kick && Object.keys(s.tx || {}).length >= (yr === live ? Math.min(base.current, base.final) : base.final)
      && Object.keys(s.r || {}).length >= base.final && s.players;
    if (!complete) continue;
    const sig = `${PM_VERSION}:${s.changedAt}`;
    if (s.sig === sig && !force) continue;
    if (yr === live && s.builtAt && now - Date.parse(s.builtAt) < BUILD_EVERY_MS && !force) continue;
    const S = { ...(await readSeasonInput(env, yr, s, base)), liveSeason: live, now };
    const doc = seasonDoc(S, await readJson(env, pmKey(yr, 'verdicts.json')), iso);
    await putJson(env, pmKey(yr, 'season.json'), doc);
    s.sig = sig; s.builtAt = iso; s.offers = doc.offers.length;
    stateChanged = true;
    out.did.push(`${yr} built (${doc.offers.length} offers)`);
    break;
  }

  // D6: Trade Analyzer's verdict on every offer on the table, stored the first time the site sees it.
  if (!verdictsOf && mem.verdictAt && now - mem.verdictAt < VERDICT_EVERY_MS) return finish();
  mem.verdictAt = now;
  try {
    const got = verdictsOf ? await verdictsOf(env, cfg) : await taVerdicts(env, cfg);
    if (got && got.length) {
      const key = pmKey(live, 'verdicts.json');
      const had = (await readJson(env, key)) || {};
      let added = 0;
      for (const v of got) if (v && v.id != null && !had[v.id]) { had[v.id] = { ...v, at: iso }; added++; }
      if (added) { await putJson(env, key, had); out.did.push(`${added} verdict${added === 1 ? '' : 's'} kept`); const s = state.seasons[live]; if (s) { s.changedAt = iso; stateChanged = true; } }
    }
  } catch (e) { out.verdictError = String((e && e.message) || e).slice(0, 120); }

  return finish();
  async function finish() {
    if (stateChanged) { state.v = PM_VERSION; state.at = iso; await putJson(env, PM_STATE_KEY, state); }
    out.seasons = Object.fromEntries(Object.entries(state.seasons).map(([y, s]) => [y, s.absent ? 'absent' : s.builtAt ? `built ${s.offers}` : 'reading']));
    return out;
  }
}

/** The stored document for one season: every decided offer with its postmortem, names for every player and team. */
export function seasonDoc(S, verdicts, iso) {
  const list = postmortemSeason(S);
  const names = {};
  const POS = { 1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'D/ST' };
  const nameOf = (pid) => {
    for (const w of Object.keys(S.rosters).sort((a, b) => b - a)) for (const l of Object.values(S.rosters[w])) for (const e of l) if (e[0] === pid) return { n: e[5], pos: POS[e[2]] || '' };
    const p = S.players[pid];
    return p ? { n: p.name, pos: POS[p.posId] || '' } : { n: `Player ${pid}`, pos: '' };
  };
  for (const o of list) for (const pid of [...o.sides.flatMap((x) => x.sends), ...o.drops.map((d) => d.pid)]) if (!names[pid]) names[pid] = nameOf(pid);
  const all = offersOf(S);
  return {
    v: PM_VERSION, season: S.season, builtAt: iso, live: S.season === S.liveSeason, current: S.current, mpc: S.mpc, final: S.final,
    teams: S.teams, players: names, counts: { offers: all.length, decided: list.length, open: all.length - list.length },
    offers: list.map((o) => ({ ...o, verdict: (verdicts || {})[o.id] || null })),
  };
}

/* ------------------------------------------------------------------ Trade Analyzer's verdict at first sight (D6) */
async function taVerdicts(env, cfg) {
  const digest = await partJson(env, 'trade_digest');
  if (!digest || !(digest.pending || []).length) return [];
  const eng = createEngine(digest, cfg.tradeWeights || {});
  const out = [];
  for (const t of eng.DATA.pending) {
    if ((t.teams || 2) > 2 || t.b == null) continue;
    try {
      const res = eng.analyzeTrade({ ...t, overlaps: [] });
      const v = eng.verdictFor(res, eng.totalsFor(res));
      out.push({ id: t.id, key: v.key, label: v.plain || v.label, favors: v.beneficiary ? v.beneficiary.id : null, imbalance: Math.round(v.imbalance * 1000) / 1000, engine: ENGINE_VERSION });
    } catch { /* an offer the engine cannot read is skipped, and tried again next call */ }
  }
  return out;
}

/** Readers: one season's document, and the list of seasons with a document. */
export async function readPostmortem(env, season) { return readJson(env, pmKey(season, 'season.json')); }
export async function readPostmortemState(env) { return readJson(env, PM_STATE_KEY); }
