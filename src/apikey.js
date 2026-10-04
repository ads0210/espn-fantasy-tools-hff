/**
 * Site API: the league's key.
 *
 * One key per league, worked out whenever it is needed and never stored: key number g is 'eft_' and the
 * first 40 base64url characters of HMAC-SHA-256(session secret, 'api-key:' + g). Config keeps only the
 * switch, the generation and when it started, the replacement interval, the previous generation and when
 * its grace ends, and whether the key may travel in the address. Two parts of the site replacing the key at
 * once work out the same key; the page can always show it; nothing at rest can be stolen beyond what the
 * config already holds.
 */
import { sign, timingSafeEqual } from './auth.js';

export const KEY_PREFIX = 'eft_';
export const INTERVALS = [30, 60, 90, 180, 'season'];
export const DEFAULT_INTERVAL = 90;
export const GRACE_MS = 7 * 86400000;
export const WARN_MS = 14 * 86400000;
const KEEP_STARTS = 12;

/** Config's siteApi field, made whole. A site set up before Site API has no generation until its first request. */
export function normaliseSiteApi(raw) {
  const c = raw && typeof raw === 'object' ? raw : {};
  const gen = Number.isInteger(c.gen) && c.gen > 0 ? c.gen : null;
  const starts = {};
  if (c.starts && typeof c.starts === 'object') {
    for (const [g, at] of Object.entries(c.starts)) if (/^\d+$/.test(g) && typeof at === 'string') starts[g] = at;
  }
  return {
    on: c.on !== false,
    gen,
    startedAt: gen && typeof c.startedAt === 'string' ? c.startedAt : null,
    interval: INTERVALS.includes(c.interval) ? c.interval : DEFAULT_INTERVAL,
    prevGen: Number.isInteger(c.prevGen) && gen && c.prevGen < gen ? c.prevGen : null,
    prevStopsAt: typeof c.prevStopsAt === 'string' ? c.prevStopsAt : null,
    replacedAt: typeof c.replacedAt === 'string' ? c.replacedAt : null,
    replacedHow: typeof c.replacedHow === 'string' ? c.replacedHow : null,
    inAddress: c.inAddress !== false,
    starts,
  };
}

/** The next 1 August UTC after a moment: the site's own season change. */
export function seasonTurnAfter(ms) {
  const y = new Date(ms).getUTCFullYear();
  const t = Date.UTC(y, 7, 1);
  return t > ms ? t : Date.UTC(y + 1, 7, 1);
}

/** When the current key is due to be replaced. */
export function changesAt(sa) {
  if (!sa || !sa.gen || !sa.startedAt) return null;
  const start = Date.parse(sa.startedAt);
  return sa.interval === 'season' ? seasonTurnAfter(start) : start + Number(sa.interval) * 86400000;
}

/** Where the key stands at a moment: the current generation, when it changes, and a previous key still in its grace. */
export function keyState(sa, now = Date.now()) {
  const changes = changesAt(sa);
  const stops = sa && sa.prevStopsAt ? Date.parse(sa.prevStopsAt) : null;
  return {
    on: Boolean(sa && sa.on),
    gen: sa ? sa.gen : null,
    startedAt: sa ? sa.startedAt : null,
    changesAt: changes,
    due: changes != null && now >= changes,
    soon: changes != null && changes - now < WARN_MS,
    prev: sa && sa.prevGen && stops && stops > now ? { gen: sa.prevGen, stopsAt: stops } : null,
  };
}

/**
 * The siteApi field after a replacement. With grace, the old key keeps working 7 days; without (a leak, or a
 * League Password change), it stops at once. `how` is recorded for the log: auto, manual, stop, season, password.
 */
export function replaced(sa, now = Date.now(), { grace = true, how = 'manual' } = {}) {
  const gen = (sa.gen || 0) + 1;
  const starts = { ...(sa.starts || {}) };
  if (sa.gen && sa.startedAt) starts[String(sa.gen)] = sa.startedAt;
  starts[String(gen)] = new Date(now).toISOString();
  const keep = Object.keys(starts).map(Number).sort((a, b) => b - a).slice(0, KEEP_STARTS);
  return {
    ...sa,
    gen,
    startedAt: new Date(now).toISOString(),
    prevGen: grace && sa.gen ? sa.gen : null,
    prevStopsAt: grace && sa.gen ? new Date(now + GRACE_MS).toISOString() : null,
    replacedAt: new Date(now).toISOString(),
    replacedHow: how,
    starts: Object.fromEntries(keep.map((g) => [String(g), starts[String(g)]])),
  };
}

/** The first generation, when setup finishes or on a set-up site's first request after the update. */
export function started(sa, now = Date.now()) {
  const at = new Date(now).toISOString();
  return { ...sa, on: sa.on !== false, gen: 1, startedAt: at, starts: { 1: at } };
}

/**
 * What a replacement due now would write, or null. An automatic replacement keeps the usual grace; at Season End
 * it is recorded as such. A changed interval whose date has passed lands here too.
 */
export function dueChange(sa, now = Date.now()) {
  if (!sa || !sa.gen) return started(sa || normaliseSiteApi(null), now);
  const st = keyState(sa, now);
  if (!st.due) return null;
  return replaced(sa, now, { grace: true, how: sa.interval === 'season' ? 'season' : 'auto' });
}

/** Key number g, worked out from the session secret. */
export async function keyFor(secret, gen) {
  if (!secret || !gen) return null;
  const mac = await sign(secret, `api-key:${gen}`);
  return KEY_PREFIX + mac.slice(0, 40);
}

/** The last four characters: the key's short name everywhere but the Site API page. */
export const shortOf = (key) => (key ? String(key).slice(-4) : null);

/* Each isolate works the keys out once per config change. */
const KEYS = new Map();

/** The keys a request can be checked against: current, the previous one in grace, and older ones (to say replaced). */
export async function keyRing(secret, sa) {
  if (!secret || !sa || !sa.gen) return null;
  const id = `${sa.gen}|${sa.prevGen}|${sa.prevStopsAt}|${secret.length}|${secret.slice(0, 6)}`;
  const hit = KEYS.get(id);
  if (hit) return hit;
  const current = await keyFor(secret, sa.gen);
  const old = [];
  for (let g = sa.gen - 1; g >= Math.max(1, sa.gen - KEEP_STARTS); g--) old.push({ gen: g, key: await keyFor(secret, g) });
  const ring = { gen: sa.gen, current, prev: sa.prevGen ? old.find((o) => o.gen === sa.prevGen) || null : null, old };
  if (KEYS.size > 8) KEYS.clear();
  KEYS.set(id, ring);
  return ring;
}

/**
 * Which key a request brought: 'current', 'grace' (the previous one, still working), 'replaced' (with the date
 * its generation was replaced) or 'invalid'. Every comparison is timing-safe, and a wrong key of any length
 * gets the same answer.
 */
export function matchKey(ring, sa, supplied, now = Date.now()) {
  const k = String(supplied || '');
  if (!ring) return { state: 'invalid' };
  if (timingSafeEqual(k, ring.current)) return { state: 'current', gen: ring.gen };
  const st = keyState(sa, now);
  let hit = null;
  for (const o of ring.old) if (timingSafeEqual(k, o.key)) hit = o;
  if (!hit) return { state: 'invalid' };
  if (st.prev && hit.gen === st.prev.gen) return { state: 'grace', gen: hit.gen, stopsAt: st.prev.stopsAt };
  const next = sa.starts && sa.starts[String(hit.gen + 1)];
  return { state: 'replaced', gen: hit.gen, replacedAt: next ? Date.parse(next) : (sa.replacedAt ? Date.parse(sa.replacedAt) : null) };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** A date in words, in UTC: 26 Dec 2026. */
export function dateWords(ms) {
  if (ms == null || !isFinite(ms)) return '';
  const d = new Date(ms);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
export const dayIso = (ms) => (ms == null ? null : new Date(ms).toISOString().slice(0, 10));

/**
 * What Site Configuration's panel shows: the switch, the key's short name, when it started and when it changes,
 * a previous key still in its grace, the interval and whether the key may travel in the address. Never the key
 * itself (that is on the Site API page only), and nothing that could rebuild one.
 */
export async function adminFacts(secret, sa, now = Date.now()) {
  const s = normaliseSiteApi(sa);
  const st = keyState(s, now);
  const ring = await keyRing(secret, s);
  const iso = (ms) => (ms == null ? null : new Date(ms).toISOString());
  return {
    on: s.on, started: Boolean(ring), interval: s.interval, inAddress: s.inAddress,
    short: ring ? shortOf(ring.current) : null, startedAt: s.startedAt, changesAt: iso(st.changesAt), soon: st.soon,
    prev: st.prev ? { short: shortOf(ring && ring.prev && ring.prev.key), stopsAt: iso(st.prev.stopsAt) } : null,
    replacedAt: s.replacedAt, replacedHow: s.replacedHow,
  };
}
