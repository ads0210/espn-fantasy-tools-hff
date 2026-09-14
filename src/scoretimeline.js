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
/* A Durable Object value is capped at 128KB per key, and a row's size depends
 * on how many matchups the league runs — a ten-team league and a fourteen-team
 * one fill at very different rates. A fixed row count therefore cannot be right
 * for both: 2000 rows was about 246KB for this league, comfortably past the cap
 * and set where a write would simply start being refused.
 *
 * The real budget is bytes, so that is what gets enforced. The count below is
 * only a coarse upper guard; BYTE_BUDGET is the one that decides. */
const MAX_ROWS = 2000;
const BYTE_BUDGET = Math.floor(128 * 1024 * 0.75);

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

/**
 * Drop the oldest entries until a list encodes within the byte budget.
 *
 * Measured rather than counted, because the only thing the platform enforces is
 * bytes. Halving the excess each pass keeps this to a handful of encodes even
 * when a list arrives far over budget, rather than re-encoding once per dropped
 * row.
 */
function trimToBudget(list) {
  const enc = new TextEncoder();
  let out = list;
  let size = enc.encode(JSON.stringify(out)).length;
  while (size > BYTE_BUDGET && out.length > 1) {
    const over = size - BYTE_BUDGET;
    const perItem = Math.max(1, Math.floor(size / out.length));
    const drop = Math.max(1, Math.min(out.length - 1, Math.ceil(over / perItem)));
    out = out.slice(drop);
    size = enc.encode(JSON.stringify(out)).length;
  }
  return out;
}

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
      // The last recorded triple per matchup, so a tick that changes nothing
      // can be recognised without walking the rows.
      const lastM = await this.state.storage.get('lastM');
      this.lastM = lastM && typeof lastM === 'object' ? lastM : {};
      // The most recent tick, recorded even when it produced no row. Charts
      // need it to know a flat line runs to now rather than stopping at the
      // last change.
      this.lastTick = (await this.state.storage.get('lastTick')) || null;
      this.schema = (await this.state.storage.get('schema')) || 1;
    });
  }

  /**
   * Collapse runs where a matchup's values did not move.
   *
   * Walks the stored rows in order and keeps a matchup's entry only where its
   * triple differs from the last kept entry for that same matchup. A row left
   * with no matchups is dropped entirely. The result is exactly what the append
   * path would have written had it always been dropping repeats, so pruned and
   * freshly recorded weeks are indistinguishable.
   *
   * The final value per matchup is preserved by construction: the last change
   * is always a change, so it is always kept.
   */
  async pruneUnchanged() {
    // Captured before anything is dropped: the newest row is evidence of when
    // sampling last ran, and after a collapse the last surviving row is only
    // the last time something changed. Those are different questions, and using
    // the second for the first would end every flat line early.
    const newest = this.rows.length ? this.rows[this.rows.length - 1].t : null;
    const seen = {};
    const kept = [];
    for (const row of this.rows) {
      const m = row && row.m && typeof row.m === 'object' ? row.m : {};
      const keep = {};
      for (const id of Object.keys(m)) {
        const v = m[id];
        if (!Array.isArray(v)) continue;
        const prev = seen[id];
        const same = Array.isArray(prev) && prev.length === v.length &&
          prev.every((x, i) => x === v[i]);
        if (same) continue;
        keep[id] = v;
        seen[id] = v;
      }
      if (Object.keys(keep).length) kept.push({ t: row.t, m: keep });
    }
    const before = this.rows.length;
    this.rows = kept;
    this.lastM = seen;
    this.schema = 2;
    if (!this.lastTick && newest) {
      // Nothing recorded a tick before this scheme existed, so the newest row
      // as it stood before the collapse is the best evidence available.
      this.lastTick = newest;
    }
    await Promise.all([
      this.state.storage.put('rows', this.rows),
      this.state.storage.put('lastM', this.lastM),
      this.state.storage.put('schema', 2),
      this.lastTick ? this.state.storage.put('lastTick', this.lastTick) : null,
    ]);
    return { before, after: this.rows.length };
  }

  async fetch(request) {
    const url = new URL(request.url);

    // Runs automatically on the next append; exposed so a week that is not
    // being appended to any more can still be collapsed on demand.
    if (url.pathname === '/prune') {
      return json({ ok: true, ...(await this.pruneUnchanged()) });
    }

    if (url.pathname === '/read') {
      return json({
        ok: true, count: this.rows.length, rows: this.rows,
        events: this.events, eventCount: this.events.length,
        lastTick: this.lastTick,
      });
    }

    /* What each stored key actually costs, measured rather than estimated.
     *
     * A Durable Object value is capped at 128KB per key, and this is the only
     * store on the site that grows without anybody pruning it: rows accrue about
     * one a minute for every minute of every game window in a week. Counting
     * rows says nothing useful about how close that is to the ceiling, because
     * a row's size depends on how many matchups the league runs.
     *
     * Measured the same way the platform will: the byte length of the encoded
     * value, which is what the cap applies to. `last` is included because it is
     * a third key under the same limit and grows with the roster.
     */
    if (url.pathname === '/size') {
      const bytesOf = (v) => new TextEncoder().encode(JSON.stringify(v ?? null)).length;
      const rowBytes = bytesOf(this.rows);
      const eventBytes = bytesOf(this.events);
      const lastBytes = bytesOf(this.last);
      const CAP = 128 * 1024;
      const pct = (n) => Math.round((n / CAP) * 1000) / 10;
      return json({
        ok: true,
        cap: CAP,
        keys: {
          rows: { count: this.rows.length, bytes: rowBytes, pctOfCap: pct(rowBytes),
            perRow: this.rows.length ? Math.round(rowBytes / this.rows.length) : 0 },
          events: { count: this.events.length, bytes: eventBytes, pctOfCap: pct(eventBytes),
            perEvent: this.events.length ? Math.round(eventBytes / this.events.length) : 0 },
          last: { count: Object.keys(this.last).length, bytes: lastBytes, pctOfCap: pct(lastBytes) },
        },
        // The cap is per key, so the largest key is what actually decides
        // whether anything is about to be refused — not the sum.
        worstKey: [['rows', rowBytes], ['events', eventBytes], ['last', lastBytes]]
          .sort((a, b) => b[1] - a[1])[0][0],
        headroomBytes: CAP - Math.max(rowBytes, eventBytes, lastBytes),
        caps: { maxRows: MAX_ROWS, maxEvents: MAX_EVENTS },
      });
    }

    if (url.pathname === '/reset') {
      this.rows = [];
      this.events = [];
      this.last = {};
      this.lastM = {};
      this.lastTick = null;
      await this.state.storage.put('rows', this.rows);
      await this.state.storage.put('events', this.events);
      await this.state.storage.put('last', this.last);
      await this.state.storage.put('lastM', this.lastM);
      await this.state.storage.delete('lastTick');
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

    /* Existing weeks were written before repeats were dropped, so they carry
       long runs of identical values. Collapsing them once, in place, means a
       fork that updates mid-season gets the readable charts too rather than
       only for weeks recorded after the update. Guarded by a schema marker so
       it runs once per week and never again. */
    if (this.schema < 2) await this.pruneUnchanged();

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

    /* Only what moved is stored.
     *
     * A sample a minute from Thursday to Monday is mostly the same numbers
     * repeated: nothing changes overnight, or during a bye, or once a matchup's
     * players are all done. Those runs cost storage and, worse, flatten the
     * charts — a week of real scoring gets squeezed into a sliver between long
     * horizontal stretches.
     *
     * A matchup is written only when one of its three tracked values differs
     * from the last value written for that matchup. The three move together by
     * design: a change in any one records all three, so the score and win
     * probability charts always share their x positions. Matchups are judged
     * independently, so one still scoring does not keep writing rows for nine
     * that have finished.
     *
     * The line between two stored points is drawn as a hold rather than a
     * slope, so dropping the repeats changes what is stored and not what is
     * shown. */
    const incoming = body.m && typeof body.m === 'object' ? body.m : {};
    const changed = {};
    for (const id of Object.keys(incoming)) {
      const v = incoming[id];
      if (!Array.isArray(v)) continue;
      const prev = this.lastM[id];
      const same = Array.isArray(prev) && prev.length === v.length &&
        prev.every((x, i) => x === v[i]);
      if (same) continue;
      changed[id] = v;
      this.lastM[id] = v;
    }

    // One stamp for this tick, shared by the row and any events it produces, so
    // a scoring event and the row recording it cannot disagree by a millisecond.
    const stamp = new Date(now).toISOString();

    const movedRow = Object.keys(changed).length > 0;
    if (movedRow) {
      const row = {
        t: stamp,
        // { matchupId: [homePoints, awayPoints, homeWinProbability] }. An array
        // rather than named keys because this is written all season and the key
        // names would outweigh the numbers several times over.
        m: changed,
      };
      const next = this.rows.concat([row]);
      // Trim from the front: the recent shape of a matchup matters more than its
      // opening minutes if something has gone wrong enough to reach the cap.
      this.rows = trimToBudget(next.length > MAX_ROWS
        ? next.slice(next.length - MAX_ROWS) : next);
    }
    // Recorded whether or not anything moved: this is what tells a chart that a
    // flat line runs all the way to now instead of stopping at the last change.
    this.lastTick = stamp;

    /* Turn the player snapshot into events. Only what moved is recorded, and
       only against a baseline this object already held — the first sighting of
       a player establishes their baseline rather than reporting their whole
       score so far as one enormous play. */
    const players = body.p && typeof body.p === 'object' ? body.p : {};
    const fresh = [];
    for (const pid of Object.keys(players)) {
      // Named `val` rather than `now`: the outer `now` is this append's
      // timestamp, and shadowing it here read as a clock value rather than a
      // score every time this loop was skimmed.
      const val = Number(players[pid]);
      if (!Number.isFinite(val)) continue;
      const before = this.last[pid];
      if (before === undefined) { this.last[pid] = val; continue; }
      const delta = Math.round((val - before) * 10) / 10;
      if (Math.abs(delta) < MIN_DELTA) continue;
      this.last[pid] = val;
      fresh.push({
        t: stamp,
        p: pid,                                   // ESPN player id
        d: delta,                                 // what they just scored
        v: Math.round(val * 10) / 10,             // their total after it
        m: (body.pm && body.pm[pid]) || null,     // which matchup it belongs to
      });
    }
    if (fresh.length) {
      const all = this.events.concat(fresh);
      this.events = trimToBudget(all.length > MAX_EVENTS
        ? all.slice(all.length - MAX_EVENTS) : all);
    }

    this.pending = Promise.all([
      // Rows and the per-matchup baseline only move together, so neither is
      // written when nothing changed.
      movedRow ? this.state.storage.put('rows', this.rows) : null,
      movedRow ? this.state.storage.put('lastM', this.lastM) : null,
      fresh.length ? this.state.storage.put('events', this.events) : null,
      this.state.storage.put('last', this.last),
      this.state.storage.put('lastTick', this.lastTick),
    ]);
    // --- race window closed ---

    try {
      await this.pending;
    } finally {
      this.pending = null;
    }
    return json({ ok: true, appended: movedRow, count: this.rows.length,
                  unchanged: !movedRow,
                  events: fresh.length, eventTotal: this.events.length });
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
