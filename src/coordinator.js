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

const EMPTY_COUNTERS = { requests: 0, sweeps: 0, coalesced: 0, lastSweepAt: null };

export class DatasetCoordinator {
  constructor(state, env) {
    this.state = state;
    this.env = env;
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

    if (url.pathname !== '/refresh') {
      return json({ ok: false, error: 'unknown coordinator route' }, 404);
    }

    const key = url.searchParams.get('key');
    const force = url.searchParams.get('force') === '1';
    const dataset = getDataset(key);
    if (!dataset) return json({ ok: false, error: `unknown dataset "${key}"` }, 404);

    this.counters.requests += 1;

    // Coalesce onto an in-flight sweep whenever that sweep satisfies this
    // request. A forced request cannot reuse a non-forced sweep (that sweep
    // may skip parts it considers fresh), so it waits and then runs its own.
    while (this.inFlight) {
      if (!force || this.inFlightForced) {
        this.counters.coalesced += 1;
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

    await this.persist();
    return json({ ok: report.ok, coalesced: false, report, counters: this.counters });
  }
}

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
