/**
 * Durable Object duration (W5, r278): the one free limit the site did not count until now. Cloudflare bills an
 * object for wall-clock time while it runs or waits on I/O, at 128 MB: 13,000 GB-s a day is about 104,000
 * object-seconds. The site cannot read Cloudflare's own figure, so it estimates it from what it records itself:
 * the backend clock's minutes, the four tools' steps (each in its own coordinator object) and Fortune Teller's
 * build meter. A page's own object time (a coordinator answering a visit, the site log) is not counted: the
 * estimate says so wherever it is shown.
 */

export const DO_GBS_FREE = 13000;
export const DO_GB = 0.125;
/** The steps that run side by side in the minute's work, each in its own object. */
export const PARALLEL_STEPS = ['season', 'insights', 'frontoffice', 'postmortem'];
/** Where the site log keeps today's estimate for Fortune Teller's governor. */
export const DO_TIME_KEY = 'meta/do-time.json';
/** The share of the day's allowance Fortune Teller leaves untouched whatever the rest of the site does. */
export const DO_SAFE_SHARE = 0.85;

const msOf = (j) => (j && typeof j === 'object' && Number.isFinite(j.ms) ? j.ms : 0);

/**
 * One minute's object time, in milliseconds, from its tick's jobs: the clock is busy for the jobs it runs in turn
 * plus the slowest of the four steps; each step's coordinator for its own time.
 */
export function tickObjectMs(jobs) {
  if (!jobs || typeof jobs !== 'object') return { clock: 0, steps: {}, total: 0 };
  let seq = 0, par = 0;
  const steps = {};
  for (const [k, v] of Object.entries(jobs)) {
    if (k === 'clock') continue;
    const ms = msOf(v);
    if (PARALLEL_STEPS.includes(k)) { steps[k] = ms; par = Math.max(par, ms); } else seq += ms;
  }
  const clock = jobs.clock ? seq + par : 0;   // the cron alone (no clock object) bills no object
  const total = clock + Object.values(steps).reduce((a, b) => a + b, 0);
  return { clock, steps, total };
}

/** A day's object time from its ticks and Fortune Teller's meter: seconds per part and GB-s. */
export function objectTime(ticks, ftWallMs = 0) {
  const steps = Object.fromEntries(PARALLEL_STEPS.map((k) => [k, 0]));
  let clock = 0;
  for (const t of Object.values(ticks || {})) {
    const o = tickObjectMs(t);
    clock += o.clock;
    for (const [k, v] of Object.entries(o.steps)) steps[k] = (steps[k] || 0) + v;
  }
  const secs = { clock: clock / 1000, ...Object.fromEntries(Object.entries(steps).map(([k, v]) => [k, v / 1000])), ft: (ftWallMs || 0) / 1000 };
  const total = Object.values(secs).reduce((a, b) => a + b, 0);
  return { secs, total, gbs: total * DO_GB };
}

/**
 * Fortune Teller's share of the day's object time (W5): its own setting (50% by default), but never more than what
 * the rest of the site leaves. The rest of the site's use so far is projected to the end of the day by the share
 * of the day gone (at least a tenth of a day, so an early-morning figure is not blown up), and Fortune Teller may
 * have what is left of DO_SAFE_SHARE of the free allowance.
 */
export function ftGbsAllowance({ pct = 0.5, othersSec = 0, now = Date.now(), free = DO_GBS_FREE } = {}) {
  const d = new Date(now);
  const gone = Math.max(0.1, (d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds()) / 86400);
  const projected = (othersSec / gone) * DO_GB;
  return Math.max(0, Math.min(free * pct, free * DO_SAFE_SHARE - projected));
}
