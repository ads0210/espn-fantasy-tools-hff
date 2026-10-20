/**
 * Week 6 (plan N7, PD25): Visits over time, on Site Backend's Activity tab.
 *
 * The site log keeps a small rollup beside its events: one row per (hour, page, team) with a count, condensed into
 * one row per (UTC day, page, team) once an hour is more than 8 days old. The chart reads only that rollup, never
 * the events table. This module is the plain part both sides share: which buckets a range covers, and turning the
 * rows the log hands over into one line per team. Tested by behaviour in test/run.js.
 */
export const HOUR_MS = 3600000;
export const DAY_MS = 86400000;
/** Hourly rows older than this are condensed into daily rows. */
export const VISIT_HOURLY_DAYS = 8;
export const VISIT_RANGES = [["24h", "24 hours"], ["7d", "7 days"], ["30d", "30 days"], ["season", "Season"]];
/** Team id used for a visit with no team chosen on that browser. */
export const NO_TEAM = 0;

const hourOf = (ms) => Math.floor(ms / HOUR_MS) * HOUR_MS;
const dayOf = (ms) => Math.floor(ms / DAY_MS) * DAY_MS;

/**
 * The buckets a range covers, ending with the bucket that holds `now`. Hourly for 24 hours and 7 days (always inside
 * the hourly rows' 8 days), daily (UTC days) for 30 days and the season. `first` is the oldest bucket the log holds,
 * which is where the season's range starts.
 */
export function visitWindow(range, now, first = null) {
  const r = VISIT_RANGES.some(([k]) => k === range) ? range : "7d";
  if (r === "24h" || r === "7d") {
    const to = hourOf(now), n = r === "24h" ? 24 : 168;
    return { range: r, hourly: true, step: HOUR_MS, from: to - (n - 1) * HOUR_MS, to };
  }
  const to = dayOf(now);
  let from = r === "30d" ? to - 29 * DAY_MS : first != null ? dayOf(first) : to;
  if (from > to) from = to;
  return { range: r, hourly: false, step: DAY_MS, from, to };
}

/**
 * One line per team from the rows [bucket, page, team, n]: every bucket of the window in order, zero where nothing
 * was recorded, filtered to one page when `page` is set. `teams` lists the league's team ids; the "no team chosen"
 * line (NO_TEAM) always comes last. A row from a team no longer in the league counts in nobody's line.
 */
export function visitLines(data, { page = "", teams = [] } = {}) {
  const { from, to, step } = data;
  const times = [];
  for (let t = from; t <= to; t += step) times.push(t);
  const at = new Map(times.map((t, i) => [t, i]));
  const keys = [...teams.map(Number), NO_TEAM];
  const lines = new Map(keys.map((k) => [k, new Array(times.length).fill(0)]));
  for (const [b, pg, team, n] of data.rows || []) {
    if (page && pg !== page) continue;
    const i = at.get(step === DAY_MS ? dayOf(b) : hourOf(b));
    const line = lines.get(team == null ? NO_TEAM : Number(team));
    if (i == null || !line) continue;
    line[i] += Number(n) || 0;
  }
  return { times, lines };
}

/** Every page the rows mention with its total, for the page picker (most visited first). */
export function visitPages(rows) {
  const m = new Map();
  for (const [, pg, , n] of rows || []) m.set(pg, (m.get(pg) || 0) + (Number(n) || 0));
  return [...m].sort((a, b) => b[1] - a[1]).map(([k]) => k);
}
