/**
 * Per-week score and win-probability history.
 *
 * Every other dataset on this platform is a snapshot: it answers "what is true
 * now", and an old copy has no value once a new one arrives. A score
 * progression chart is the opposite — its value is precisely the record of what
 * was true at every earlier point, and a gap cannot be reconstructed after the
 * fact. That is why this is the one thing on the site backed by a Cron Trigger
 * rather than by on-demand refresh: nobody watching at 2pm is what makes the
 * 2pm row missing at 6pm.
 *
 * One Durable Object instance per (season, matchup period), addressed by
 * idFromName. A week's rows live under a single storage key so the whole
 * timeline is one read and one write, which keeps this well inside the storage
 * limits and means the harness mock needs only get/put.
 *
 * Correctness note, identical in kind to the one in coordinator.js: a Durable
 * Object is single-threaded but still async, so two /append calls interleave at
 * every await. The rate-limit decision and the write that satisfies it must
 * therefore happen in the same synchronous tick — otherwise both callers read
 * the same "last row was 61s ago", both decide to append, and the cap does
 * nothing. Nothing may be awaited between the guard and the assignment below.
 */

/**
 * Minimum spacing between stored rows. A minute is fine resolution for a chart
 * that spans four days, and it bounds a week at well under the row cap even if
 * the cron fires every minute for the entire span.
 */
const MIN_GAP_MS = 60 * 1000;

/**
 * Defensive backstop only. At a 60-second floor a full Thursday-to-Monday week
 * is roughly 6,000 minutes, but only the windows where something is actually
 * live ever produce a row, so real weeks land far below this. It exists so a
 * clock problem or a stuck "live" flag cannot grow one object without bound.
 */
const MAX_ROWS = 2000;

/**
 * Scoring events kept per week.
 *
 * Events are sparse where snapshots are not: a starter's score changes perhaps
 * a dozen times across a game, so storing what changed rather than storing
 * everything every minute is the difference between a few tens of kilobytes and
 * far more than a Durable Object value is allowed to hold. Ninety starters
 * across five matchups produce well under this in a full week.
 */
const MAX_EVENTS = 1500;

/** Ignore scoring noise below this, so a stat correction is not an event. */
const MIN_DELTA = 0.05;

export class ScoreTimelineDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.rows = null;
    this.events = null;
    this.last = null; // playerId -> points, for computing deltas
    this.pending = null; // in-flight write, held for the same-tick guard

    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get('rows');
      this.rows = Array.isArray(stored) ? stored : [];
      const ev = await this.state.storage.get('events');
      this.events = Array.isArray(ev) ? ev : [];
      const last = await this.state.storage.get('last');
      this.last = last && typeof last === 'object' ? last : {};
    });
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/read') {
      return json({
        ok: true, count: this.rows.length, rows: this.rows,
        events: this.events, eventCount: this.events.length,
      });
    }

    if (url.pathname === '/reset') {
      this.rows = [];
      this.events = [];
      this.last = {};
      await this.state.storage.put('rows', this.rows);
      await this.state.storage.put('events', this.events);
      await this.state.storage.put('last', this.last);
      return json({ ok: true, count: 0 });
    }

    if (url.pathname !== '/append') {
      return json({ ok: false, error: 'unknown timeline route' }, 404);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: 'malformed row' }, 400);
    }

    const now = Number(body.at) || Date.now();
    const last = this.rows.length ? this.rows[this.rows.length - 1] : null;

    // --- no awaits between here and the assignment below ---
    if (this.pending) {
      // Another append is already committing this tick's row.
      await this.pending;
      return json({ ok: true, skipped: 'in flight', count: this.rows.length });
    }
    if (last && now - Date.parse(last.t) < MIN_GAP_MS) {
      return json({ ok: true, skipped: 'too soon', count: this.rows.length });
    }

    const row = {
      t: new Date(now).toISOString(),
      // { matchupId: [homePoints, awayPoints, homeWinProbability] }. An array
      // rather than named keys because this is written once a minute all season
      // and the key names would outweigh the numbers several times over.
      m: body.m && typeof body.m === 'object' ? body.m : {},
    };
    const next = this.rows.concat([row]);
    // Trim from the front: the recent shape of a matchup matters more than its
    // opening minutes if something has gone wrong enough to reach the cap.
    this.rows = next.length > MAX_ROWS ? next.slice(next.length - MAX_ROWS) : next;

    /* Turn the player snapshot into events. Only what moved is recorded, and
       only against a baseline this object already held — the first sighting of
       a player establishes their baseline rather than reporting their whole
       score so far as one enormous play. */
    const players = body.p && typeof body.p === 'object' ? body.p : {};
    const fresh = [];
    for (const pid of Object.keys(players)) {
      const now = Number(players[pid]);
      if (!Number.isFinite(now)) continue;
      const before = this.last[pid];
      if (before === undefined) { this.last[pid] = now; continue; }
      const delta = Math.round((now - before) * 10) / 10;
      if (Math.abs(delta) < MIN_DELTA) continue;
      this.last[pid] = now;
      fresh.push({
        t: row.t,
        p: pid,                                   // ESPN player id
        d: delta,                                 // what they just scored
        v: Math.round(now * 10) / 10,             // their total after it
        m: (body.pm && body.pm[pid]) || null,     // which matchup it belongs to
      });
    }
    if (fresh.length) {
      const all = this.events.concat(fresh);
      this.events = all.length > MAX_EVENTS ? all.slice(all.length - MAX_EVENTS) : all;
    }

    this.pending = Promise.all([
      this.state.storage.put('rows', this.rows),
      fresh.length ? this.state.storage.put('events', this.events) : null,
      this.state.storage.put('last', this.last),
    ]);
    // --- race window closed ---

    try {
      await this.pending;
    } finally {
      this.pending = null;
    }
    return json({ ok: true, appended: true, count: this.rows.length,
                  events: fresh.length, eventTotal: this.events.length });
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
