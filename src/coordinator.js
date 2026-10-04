/**
 * Per-dataset-key request de-duplication.
 *
 * One Durable Object instance per dataset key (idFromName(key)). Concurrent
 * callers that all find the same dataset stale coalesce onto a single in-flight
 * ESPN sweep instead of each firing their own.
 *
 * Correctness note: a Durable Object is single-threaded but still async, so
 * separate fetch() invocations interleave at every await point. `inFlight` must
 * therefore be assigned in the same synchronous tick as the check that guards
 * it — any await between the two reopens the race and every caller starts its
 * own sweep. Nothing may be awaited between the guard and the assignment below.
 *
 * Counters are persisted so the behaviour is externally observable:
 * `requests` exceeds `sweeps` whenever coalescing actually happened.
 */

import { getDataset } from './datasets.js';
import { loadConfig } from './config.js';
import { refreshDataset } from './refresh.js';
import { sendTally, sendEvents, meteredEnv } from './sitelog.js';
import { buildSnapshot } from './apibuild.js';

const EMPTY_COUNTERS = { requests: 0, sweeps: 0, coalesced: 0, lastSweepAt: null };
const hourOf = (ms) => Math.floor(ms / 3600000) * 3600000;
const MAX_TALLY_SAMPLES = 16;

/**
 * This hour's figures for the site log, kept inside the counters that are saved
 * anyway, and handed over on the first request after the hour turns: at most one
 * small request per dataset per hour, and only for datasets that refreshed.
 */
function emptyTally(hour) {
  return { hour, req: 0, sweeps: 0, coalesced: 0, fetched: 0, failed: 0, bytes: 0, ms: 0, hosts: {}, ops: {} };
}

/** A refresh report's contribution to the tally: parts fetched and failed, per ESPN host. */
export function tallyReport(t, report) {
  if (!report) return t;
  const c = report.counts || {};
  t.fetched += c.fetched || 0;
  t.failed += c.failed || 0;
  t.ms += report.ms || 0;
  for (const p of report.parts || []) {
    if (!['fetched', 'failed', 'empty'].includes(p.action)) continue;
    if (p.action === 'fetched') t.bytes += p.bytes || 0;
    let host = null;
    try { host = p.url ? new URL(p.url).host : null; } catch { host = null; }
    if (!host) continue;
    const h = t.hosts[host] || (t.hosts[host] = { n: 0, f: 0, ms: [], fb: 0, last: null });
    h.n += 1;
    if (p.action === 'failed') h.f += 1;
    if (p.viaFallback) h.fb += 1;
    if (Number.isFinite(p.ms)) { if (h.ms.length < MAX_TALLY_SAMPLES) h.ms.push(p.ms); else h.ms[Math.floor(Math.random() * MAX_TALLY_SAMPLES)] = p.ms; }
    h.last = { at: new Date().toISOString(), status: p.status || null };
  }
  return t;
}

/** Datasets and digests that started failing or recovered with this report, as statements. */
export function healthChanges(was, report, dataset) {
  const now = { ...(was || {}) };
  const out = [];
  const check = (key, ok, error, tier) => {
    const before = now[key];
    now[key] = ok;
    if (before === undefined || before === ok) return;
    if (ok) out.push({ sev: 'ok', text: `${key} refreshing again` });
    else {
      const kept = (report.parts || []).some((p) => p.keptStale);
      const sev = tier === 'probe' ? 'info' : tier === 'core' && !kept ? 'bad' : 'warn';
      out.push({ sev, text: `${key} started failing${kept ? ' (its stored copy is being served)' : ''}: ${String(error || 'refresh failed').slice(0, 90)}` });
    }
  };
  const bad = (report.parts || []).find((p) => p.action === 'failed');
  check(dataset.key, report.ok !== false, report.error || (bad && (bad.error || (bad.status ? `HTTP ${bad.status}` : null))), dataset.tier);
  for (const d of [report.derived, ...(report.derivedAll || [])].filter(Boolean)) {
    if (d.target) check(d.target, !d.error, d.error, dataset.tier);
  }
  return { now, events: out };
}

export class DatasetCoordinator {
  constructor(state, env) {
    this.state = state;
    this.rawEnv = env;
    // R2 and KV calls made during a refresh count toward the site's usage, through the tally.
    this.env = meteredEnv(env, (k) => { const t = this.tallyNow(); t.ops[k] = (t.ops[k] || 0) + 1; });
    this.inFlight = null; // Promise<report> | null
    this.inFlightForced = false;
    this.counters = { ...EMPTY_COUNTERS };

    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get('counters');
      if (stored) this.counters = stored;
    });
  }

  persist() {
    return this.state.storage.put('counters', this.counters);
  }

  tallyNow() {
    const hour = hourOf(Date.now());
    let t = this.counters.tally;
    if (!t || t.hour !== hour) {
      if (t && t.hour < hour && (t.req || t.sweeps)) this.pendingTally = t;
      t = this.counters.tally = emptyTally(hour);
    }
    return t;
  }

  /** Hand the finished hour to the site log, and any change of state with it. Never throws. */
  async report(key, events) {
    try {
      if (this.pendingTally) { const t = this.pendingTally; this.pendingTally = null; await sendTally(this.rawEnv, key, t); }
      if (events && events.length) await sendEvents(this.rawEnv, events.map((e) => ({ ...e, kind: 'change' })));
    } catch { /* recording must never matter */ }
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/counters') {
      return json({ ok: true, counters: this.counters });
    }

    if (url.pathname === '/reset') {
      this.counters = { ...EMPTY_COUNTERS };
      await this.persist();
      return json({ ok: true, counters: this.counters });
    }

    if (url.pathname === '/api-snapshot') return this.apiSnapshot(url);

    if (url.pathname !== '/refresh') {
      return json({ ok: false, error: 'unknown coordinator route' }, 404);
    }

    const key = url.searchParams.get('key');
    const force = url.searchParams.get('force') === '1';
    const dataset = getDataset(key);
    if (!dataset) return json({ ok: false, error: `unknown dataset "${key}"` }, 404);

    this.counters.requests += 1;
    this.tallyNow().req += 1;

    // Coalesce onto an in-flight sweep whenever that sweep satisfies this
    // request. A forced request cannot reuse a non-forced sweep (that sweep
    // may skip parts it considers fresh), so it waits and then runs its own.
    while (this.inFlight) {
      if (!force || this.inFlightForced) {
        this.counters.coalesced += 1;
        this.tallyNow().coalesced += 1;
        const report = await this.inFlight;
        await this.persist();
        return json({ ok: report.ok, coalesced: true, report, counters: this.counters });
      }
      await this.inFlight;
    }

    // --- no awaits between here and the inFlight assignment ---
    this.counters.sweeps += 1;
    this.counters.lastSweepAt = new Date().toISOString();

    const run = (async () => {
      try {
        const cfg = await loadConfig(this.env);
        return await refreshDataset(this.env, cfg, dataset, { force });
      } catch (err) {
        return {
          key,
          label: dataset.label,
          tier: dataset.tier,
          ok: false,
          error: `sweep threw: ${String((err && err.stack) || err)}`,
          parts: [],
          counts: { fetched: 0, skipped: 0, failed: 0 },
        };
      }
    })();
    this.inFlight = run;
    this.inFlightForced = force;
    // --- race window closed ---

    let report;
    try {
      report = await run;
    } finally {
      this.inFlight = null;
      this.inFlightForced = false;
    }

    const t = this.tallyNow();
    t.sweeps += 1;
    tallyReport(t, report);
    const health = healthChanges(this.counters.health, report, dataset);
    this.counters.health = health.now;
    await this.persist();
    await this.report(key, health.events);
    return json({ ok: report.ok, coalesced: false, report, counters: this.counters });
  }
}

/**
 * Site API's snapshot, built in its own coordinator instance ('site_api_snapshot'). Isolates ask when theirs is
 * due; a build already running is shared, and one built within the interval is not repeated. The day's source
 * refreshes are kept in storage, so an evicted object cannot run past its daily allowance.
 */
DatasetCoordinator.prototype.apiSnapshot = async function apiSnapshot(url) {
  const q = url.searchParams;
  const every = Math.max(10, Number(q.get('every')) || 300);
  const force = q.get('force') === '1';
  const snap = this.snap || (this.snap = { mem: {}, inFlight: null, failedAt: 0 });
  if (snap.inFlight) return json({ ...(await snap.inFlight), coalesced: true });
  if (!force && snap.mem.builtAt && Date.now() - snap.mem.builtAt < (every - 2) * 1000) {
    return json({ ok: true, skipped: true, builtAt: new Date(snap.mem.builtAt).toISOString() });
  }
  // --- no awaits between the check above and the assignment below ---
  const run = (async () => {
    try {
      if (snap.mem.day === undefined) {
        const kept = await this.state.storage.get('apiRefreshes');
        if (kept) { snap.mem.day = kept.day; snap.mem.refreshes = kept.n; }
      }
      const was = snap.mem.refreshes || 0;
      const r = await buildSnapshot(this.env, snap.mem, { games: q.get('games') === '1', quiet: q.get('quiet') === '1', brake: q.get('brake') === '1' });
      if ((snap.mem.refreshes || 0) !== was) await this.state.storage.put('apiRefreshes', { day: snap.mem.day, n: snap.mem.refreshes });
      return r;
    } catch (err) {
      const r = { ok: false, error: String((err && err.message) || err).slice(0, 200) };
      if (Date.now() - snap.failedAt > 3600000) {
        snap.failedAt = Date.now();
        try { await sendEvents(this.rawEnv, [{ kind: 'change', sev: 'bad', page: 'site-api', text: `Site API's snapshot failed to build: ${r.error}` }]); } catch { /* recording must never matter */ }
      }
      return r;
    }
  })();
  snap.inFlight = run;
  let r;
  try { r = await run; } finally { snap.inFlight = null; }
  return json(r);
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

// ---------------------------------------------------------------- client side

// The client half lives in dedupe.js so that refresh.js can use it without
// importing this module (which imports refresh.js in turn).
export { coordinatorRefresh, coordinatorCounters, coordinatorReset } from './dedupe.js';
