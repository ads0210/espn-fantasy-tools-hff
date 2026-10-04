/**
 * The site's load levels and the suggested pace.
 *
 * The site counts its own use of every daily free limit (Site Backend's gauges); each isolate receives the day's
 * figures in the site log's once-a-minute reply. From them comes a level, and from the level and whether NFL games
 * are on comes the pace: how often each program may ask the API. A plain module, tested with an explicit clock.
 * The brake's actions and the backend's reserves arrive with C5; the levels are here now for the pace.
 */

export const LEVELS = [
  { key: 'quiet', name: 'Quiet', games: 15, other: 60 },
  { key: 'normal', name: 'Normal', games: 60, other: 60 },
  { key: 'busy', name: 'Busy', games: 300, other: 300 },
  { key: 'verybusy', name: 'Very busy', games: 900, other: 900 },
  { key: 'resting', name: 'Resting', games: null, other: null },
];
export const LEVEL_KEYS = LEVELS.map((l) => l.key);
export const levelOf = (key) => LEVELS.find((l) => l.key === key) || LEVELS[1];

/* The daily limits the level watches (Worker requests are the whole account's; the site sees only itself). */
export const DAILY = { worker: 100000, doReq: 100000, rowsW: 100000, kvR: 100000, kvW: 1000 };
export const LIMIT_WORDS = { worker: 'Worker requests', doReq: 'Durable Object requests', rowsW: 'rows written', kvR: 'KV reads', kvW: 'KV writes' };

export const nextMidnightUtc = (now) => Math.floor(now / 86400000) * 86400000 + 86400000;

/**
 * The level from the day's counts. `usage` = { counts: {worker, doReq, ...} today, rate: {…} per hour lately }.
 * Resting once a limit is reached; Very busy from 80% (the brake's Protect); Busy from 60% (Economy); Quiet when
 * every limit is under 30% and, carrying the last hour's rate forward to midnight UTC, on course to stay under 60%.
 */
export function levelFrom(usage, now = Date.now()) {
  if (!usage || !usage.counts) return { key: 'normal', limit: null, frac: 0 };
  let worst = 0, limit = null, quiet = true;
  const hoursLeft = Math.max(0, (nextMidnightUtc(now) - now) / 3600000);
  for (const [k, cap] of Object.entries(DAILY)) {
    const used = Number(usage.counts[k]) || 0;
    const f = used / cap;
    if (f > worst) { worst = f; limit = k; }
    const perHour = Number((usage.rate || {})[k]) || 0;
    if (f >= 0.3 || (used + perHour * hoursLeft) / cap >= 0.6) quiet = false;
  }
  const key = worst >= 1 ? 'resting' : worst >= 0.8 ? 'verybusy' : worst >= 0.6 ? 'busy' : quiet ? 'quiet' : 'normal';
  return { key, limit, frac: worst };
}

const minutes = (s) => s / 60;
/** The pace in every form the API and the page carry it. */
export function paceOf(levelKey, games, now = Date.now()) {
  const L = levelOf(levelKey);
  const secs = L.key === 'resting' ? null : (games ? L.games : L.other);
  const until = nextMidnightUtc(now);
  const header = secs == null ? Math.max(1, Math.round((until - now) / 1000)) : secs;
  const note = secs == null ? 'Please don’t ask until 00:00 UTC.'
    : secs < 60 ? `You may ask every ${secs} seconds while games are on.`
      : secs === 60 ? 'Please ask at most once a minute.'
        : `Please ask at most once every ${minutes(secs)} minutes.`;
  return { level: L.key, name: L.name, secs, header, note, until, games: Boolean(games) };
}

/* ---- the brake (C5) ---------------------------------------------------------------------------------------------
   The backend (the clock's minute of work, dataset refreshes it asks for, Fortune Teller) never reads the brake. The
   frontend (every page, Site Backend, downloads and the API) slows down as a daily limit fills, so the backend keeps
   its reserve: at 80% of any limit at least 20,000 object requests and rows written, 20,000 KV reads and 200 KV
   writes are left for it. */

/** The backend's reserve of each daily limit it uses. */
export const RESERVE = { doReq: 20000, rowsW: 20000, kvR: 10000, kvW: 200 };
/** The brake's level for each load level. */
export const BRAKE_OF = { quiet: 'normal', normal: 'normal', busy: 'economy', verybusy: 'protect', resting: 'limit' };
export const BRAKE_WORDS = { normal: 'Normal', economy: 'Economy', protect: 'Protect', limit: 'Limit reached' };
/** With no counts heard for this long, an isolate drops to Economy until it hears again. */
export const BLIND_AFTER_MS = 10 * 60 * 1000;

/**
 * The brake from the day's counts as the site log last replied with them. An isolate that has never heard runs
 * normally while it checks in (once, at most once a minute); one that has heard nothing for 10 minutes keeps to
 * Economy until it hears again: the brake fails toward Economy, never toward Normal.
 */
export function brakeFrom(usage, now = Date.now()) {
  if (!usage || !usage.counts) return { brake: 'normal', limit: null, frac: 0, blind: false, heard: false };
  if (now - (usage.heardAt || 0) > BLIND_AFTER_MS) return { brake: 'economy', limit: null, frac: null, blind: true, heard: true };
  const lvl = levelFrom(usage, now);
  return { brake: BRAKE_OF[lvl.key] || 'normal', limit: lvl.limit, frac: lvl.frac, blind: false, heard: true };
}

/**
 * How often a page polls under the brake, in seconds, or null for the page's own rate. Economy: every minute while
 * something is live (a game, the league's draft) or on Site Backend, every 5 minutes otherwise. Protect and a limit
 * reached: every 5 minutes.
 */
export function pollSecsFor(brake, { live = false, backstage = false } = {}) {
  if (brake === 'economy') return live || backstage ? 60 : 300;
  if (brake === 'protect' || brake === 'limit') return 300;
  return null;
}

/** Whether a page view may refresh a dataset under the brake: at Economy only live data (or one never stored). */
export function refreshAllowed(brake, { live = false, stored = true } = {}) {
  if (!brake || brake === 'normal') return true;
  if (brake === 'economy') return live || !stored;
  return false;
}

/** Whether the frontend may call a Durable Object for this purpose: at Protect only sign-in and the log's report. */
export function objectCallAllowed(brake, purpose) {
  if (brake !== 'protect' && brake !== 'limit') return true;
  return purpose === 'sign-in' || purpose === 'report';
}
