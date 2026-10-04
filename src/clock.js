/**
 * The backend clock (C5): one Durable Object that does the site's minute of backend work, driven by two clocks.
 *
 *   - Its own alarm, set a few seconds into every minute: the first clock.
 *   - The cron's knock: the minute cron fires as it always has and knocks on this object: the second clock.
 *
 * Whichever arrives first does the minute's work (runMinute in src/index.js); the other finds it done. If the alarm
 * is ever lost, the next knock sets it again; if the cron stops, the alarm carries on. C4 showed why both are
 * needed: on an ordinary evening the cron missed 4 minutes in an hour while an alarm kept its minute.
 *
 * Why an object: the work gets 30 seconds of CPU instead of a cron run's 10 ms, it reaches the coordinators, the
 * timeline and the site log by object-to-object calls, which are not Worker requests, and it keeps its settings for
 * 5 minutes, so the backend barely reads KV.
 *
 * Exactly once: the minute is claimed in memory and in storage before any work starts, so two arrivals in the same
 * minute (or a restart part-way through one) never run it twice. What each minute did, which clock did it and how
 * late it began travel with the minute's tick to the site log, which Site Backend reads.
 *
 * Whether the clock or the cron does the work is the deployment's choice (BACKEND_CLOCK = "on"); see clockIsOn().
 */
import { runMinute } from './index.js';

/** The alarm fires this far into each minute, so the cron (which usually arrives in the first second) knocks first. */
export const ALARM_OFFSET_MS = 4000;
/** The settings the minute's work reads are held this long inside the object (the backend barely touches KV). */
export const CLOCK_SETTINGS_HOLD_MS = 5 * 60 * 1000;

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const minuteOf = (ms) => Math.floor(ms / 60000);

export class BackendClockDO {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.last = null;        // the last minute whose work was claimed
    this.busy = false;
    this.lastVia = null;     // which clock did that minute's work
    this.recent = [];        // what the last minutes did, in memory only (the site log keeps the record)
    this.now = () => Date.now();
    this.work = (env, opts) => runMinute(env, opts);   // replaced in tests
  }

  async lastMinute() {
    if (this.last === null) {
      // Stored as { m, via }; a bare number is the form before the clock recorded which one did the work.
      const v = await this.ctx.storage.get('lastMinute');
      if (v && typeof v === 'object') { this.last = Number(v.m); this.lastVia = v.via || null; } else this.last = v ?? -1;
    }
    return this.last;
  }

  /**
   * Set the alarm for the next minute, unless one is already set for it. An alarm whose time has passed (the one
   * firing now, or one that was lost) is set again.
   */
  async arm() {
    const now = this.now();
    const next = (minuteOf(now) + 1) * 60000 + ALARM_OFFSET_MS;
    const cur = await this.ctx.storage.getAlarm();
    if (cur == null || cur <= now || cur > next) await this.ctx.storage.setAlarm(next);
  }

  /** Do this minute's work, once. `via` is "alarm" or "knock". */
  async run(via, at = null) {
    const now = this.now();
    const m = minuteOf(now);
    const last = await this.lastMinute();
    /* The clock that arrives second does no work. It leaves a note that it came, kept in storage because the
       object does not stay in memory between minutes, so Site Backend can tell "second" from "stopped". */
    if (!this.busy && last === m && this.lastVia && via !== this.lastVia) {
      try { await this.ctx.storage.put('second', { m, via }); } catch { /* a note, never the work */ }
    }
    if (this.busy || last >= m) return { done: false, minute: m, by: this.recent.length ? this.recent[this.recent.length - 1].via : null };
    this.busy = true;
    const prevVia = this.lastVia;
    this.last = m; this.lastVia = via;
    try {
      await this.ctx.storage.put('lastMinute', { m, via });
      const t0 = this.now();
      let ok = true;
      try {
        // The settings the work reads are held 5 minutes in here rather than 5 seconds.
        // Whether each clock was heard in the minute before this one: a clock that arrives second does no work,
        // and without this Site Backend could not tell it from one that has stopped.
        let second = null;
        try { second = await this.ctx.storage.get('second'); } catch { second = null; }
        const was = (k) => prevVia === k || Boolean(second && second.m === m - 1 && second.via === k);
        await this.work(this.workEnv(), { at: at && minuteOf(at) === m ? at : m * 60000, via, heard: last === m - 1 && prevVia ? { alarm: was('alarm'), knock: was('knock') } : null });
      } catch (err) {
        ok = false;
        console.log('clock: the minute\'s work failed:', String((err && err.stack) || err));
      }
      const entry = { minute: m, via, late: now - m * 60000, ms: this.now() - t0, ok };
      this.recent.push(entry);
      if (this.recent.length > 60) this.recent.splice(0, this.recent.length - 60);
      return { done: true, ...entry };
    } finally {
      this.busy = false;
    }
  }

  workEnv() {
    if (!this.envHeld) this.envHeld = { ...this.env, CONFIG_HOLD_MS: CLOCK_SETTINGS_HOLD_MS };
    return this.envHeld;
  }

  async alarm() {
    try { await this.run('alarm'); } finally { await this.arm(); }
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/knock') {
      const at = Number(url.searchParams.get('at')) || this.now();
      const r = await this.run('knock', at);
      await this.arm();
      return json({ ok: true, ...r });
    }
    // Side-effect free: what Site Backend shows. Never sets an alarm or does work.
    if (url.pathname === '/peek') {
      return json({ ok: true, lastMinute: await this.lastMinute(), alarm: await this.ctx.storage.getAlarm(), recent: this.recent.slice(-30) });
    }
    return json({ ok: false, error: 'no such clock route' }, 404);
  }
}
