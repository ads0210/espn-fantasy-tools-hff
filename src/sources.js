/**
 * Sources: every address the site sees, named without ever being shown.
 *
 * An address is kept only as a keyed fingerprint (HMAC with the site's secret, inside the Worker), so nobody,
 * the administrator included, can turn it back into the address. IPv6 is fingerprinted by its /64 block, since a
 * single home or phone moves around inside one. A request's user agent is reduced on arrival to one word; the
 * string is never kept. Counts are made in each isolate's memory and sent with its minute report. A plain module.
 */
import { sign } from './auth.js';

/** The address family and the part of it that names a source (IPv6: its /64). */
export function canonicalAddress(ip) {
  const s = String(ip || '').trim();
  if (!s) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(s)) return { family: 'IPv4', key: s };
  if (s.includes(':')) {
    let head = s.split('%')[0];
    if (head.includes('.')) return { family: 'IPv6', key: head.toLowerCase() };   // an embedded IPv4: keep whole
    const [a, b = ''] = head.split('::');
    const left = a ? a.split(':') : [], right = b ? b.split(':') : [];
    const fill = head.includes('::') ? new Array(Math.max(0, 8 - left.length - right.length)).fill('0') : [];
    const full = [...left, ...fill, ...right].map((x) => x.toLowerCase().replace(/^0+(?=.)/, ''));
    return { family: 'IPv6', key: full.slice(0, 4).join(':') + '::/64' };
  }
  return { family: 'other', key: s };
}

const FP = new Map();
/** A keyed fingerprint of an address: 16 hex characters, stable for the site's secret. */
export async function fingerprint(secret, ip) {
  const c = canonicalAddress(ip);
  if (!c || !secret) return null;
  const hit = FP.get(c.key);
  if (hit) return hit;
  const mac = await sign(secret, `addr:${c.key}`);
  const fp = { id: mac.slice(0, 16), family: c.family };
  if (FP.size > 2000) FP.clear();
  FP.set(c.key, fp);
  return fp;
}

/* The kind of program, from its user agent, in one word. Order matters: the most specific first. */
const KINDS = [
  [/apps-spreadsheets|GoogleDocs|Google-Sheets/i, 'Google Sheets'],
  [/Google-Apps-Script/i, 'Apps Script'],
  [/Microsoft\.Data\.Mashup|PowerQuery|Excel/i, 'Excel'],
  [/HomeAssistant|home-assistant|aiohttp/i, 'Home Assistant'],
  [/python|urllib|httpx/i, 'Python'],
  [/PowerShell/i, 'PowerShell'],
  [/^curl\//i, 'curl'],
  [/Shortcuts|WorkflowKit|CFNetwork/i, 'iPhone Shortcuts'],
  [/HttpShortcuts|Tasker|okhttp|Dalvik|Android/i, 'an Android app'],
  [/node|undici|axios|deno|bun/i, 'JavaScript'],
  [/Discordbot|Slackbot/i, 'a chat bot'],
  [/Mozilla\/|Chrome\/|Safari\/|Firefox\//i, 'a browser'],
];
export function programKind(ua) {
  const s = String(ua || '');
  if (!s) return 'unknown';
  for (const [re, word] of KINDS) if (re.test(s)) return word;
  return 'unknown';
}
export const PROGRAM_KINDS = [...new Set(KINDS.map((k) => k[1]))].concat('unknown');

/* ---- per-isolate counts ------------------------------------------------------------------------ */

const TOP = 20;
/**
 * One hour's counts for the sources this isolate saw. `bucket.src[fp]` holds what High activity and Sources show;
 * `bucket.visits[fp][team]` counts page visits by the team chosen on that browser, for the likely member.
 */
export function countSource(bucket, fp, fields) {
  if (!bucket || !fp) return;
  const src = bucket.src || (bucket.src = {});
  let s = src[fp.id];
  if (!s) {
    if (Object.keys(src).length >= 400) return;
    s = src[fp.id] = { f: fp.family, n: 0 };
  }
  s.n += 1;
  if (fields.kind) s.k = fields.kind;
  if (fields.api) { s.api = (s.api || 0) + 1; if (fields.kind) s.ak = fields.kind; }
  // A browser's own requests to the site's pages and their polls: the site's work, not a program's.
  else if (fields.kind === 'a browser') s.bp = (s.bp || 0) + 1;
  if (fields.page) s.pg = (s.pg || 0) + 1;
  if (fields.ep) { s.ep = s.ep || {}; s.ep[fields.ep] = (s.ep[fields.ep] || 0) + 1; }
  if (fields.key) { s.key = s.key || {}; s.key[fields.key] = (s.key[fields.key] || 0) + 1; }
  if (fields.name) { s.nm = s.nm || {}; if (s.nm[fields.name] || Object.keys(s.nm).length < 12) s.nm[fields.name] = (s.nm[fields.name] || 0) + 1; }
  if (fields.refused) { s.rf = s.rf || {}; s.rf[fields.refused] = (s.rf[fields.refused] || 0) + 1; }
  if (fields.refused && fields.name) { s.nr = s.nr || {}; if (s.nr[fields.name] || Object.keys(s.nr).length < 12) s.nr[fields.name] = (s.nr[fields.name] || 0) + 1; }
  if (fields.held) s.hd = (s.hd || 0) + 1;
  if (fields.after) s.af = (s.af || 0) + 1;   // asked again after a too_soon
  if (fields.team != null) {
    const v = bucket.visits || (bucket.visits = {});
    const t = v[fp.id] || (v[fp.id] = {});
    t[fields.team] = (t[fields.team] || 0) + 1;
  }
}

/** The busiest sources of an hour, at most `top`, with the rest summed as other sources. */
export function busiest(src, top = TOP) {
  const list = Object.entries(src || {}).sort((a, b) => b[1].n - a[1].n);
  const keep = Object.fromEntries(list.slice(0, top));
  const rest = list.slice(top);
  if (rest.length) keep.other = { f: 'other', n: rest.reduce((a, [, s]) => a + s.n, 0), srcs: rest.length };
  return keep;
}

/* ---- High activity ------------------------------------------------------------------------------ */

/**
 * The thresholds (decision D39): over twice the suggested pace for the last hour, over 1,500 requests in 24 hours,
 * over 5% of the day's Worker requests, or asking on after too_soon. Heavy above 10,000 in 24 hours or 10% of the
 * day. A share of the day is judged only once a source has made 100 requests today, so the first minutes after
 * midnight UTC flag nobody.
 */
export const HOT = { PACE_X: 2, DAY_N: 1500, SHARE: 0.05, HEAVY_N: 10000, HEAVY_SHARE: 0.10, SHARE_FLOOR: 100 };

/**
 * The requests of a source that count toward High activity: every request, except a browser's own traffic to the
 * site's pages (its polls), which is the site's own work and is judged by Site Backend's usage panels instead.
 */
export function countedOf(s) {
  if (!s) return 0;
  return Math.max(0, (s.n || 0) - (s.bp || 0));
}

const add = (into, from) => { for (const [k, n] of Object.entries(from || {})) into[k] = (into[k] || 0) + n; };

/**
 * Every source over a threshold, busiest first. `hours` are the log's hour rows ({ hour, d }), `dayTotal` the day's
 * recorded requests, `paceSecs` the suggested interval now (null while the site rests). Plain data in, plain data
 * out: no address, no likely member.
 */
export function hotSources({ hours, dayTotal = 0, paceSecs = 60, now = Date.now() }) {
  const hourNow = Math.floor(now / 3600000) * 3600000;
  const mid = Math.floor(now / 86400000) * 86400000;
  const from = hourNow - 23 * 3600000;
  const into = (1 - (now - hourNow) / 3600000);
  const by = new Map();
  for (const { hour, d } of hours || []) {
    if (hour < from || hour > hourNow) continue;
    for (const [id, s] of Object.entries((d && d.src) || {})) {
      if (id === 'other') continue;
      let a = by.get(id);
      if (!a) by.set(id, a = { id, family: s.f === 'IPv6' ? 'IPv6' : 'IPv4', d1: 0, today: 0, h1: 0, apiH1: 0, api: 0, refused: 0, kept: 0, held: 0,
        ep: {}, keys: {}, names: {}, pages: 0, kind: null, bars: new Array(24).fill(0), refusedBars: new Array(24).fill(0), first: null });
      const c = countedOf(s);
      a.d1 += c;
      if (hour >= mid) a.today += c;
      const w = hour === hourNow ? 1 : hour === hourNow - 3600000 ? into : 0;
      a.h1 += c * w;
      a.apiH1 += (s.api || 0) * w;
      a.api += s.api || 0;
      const rf = Object.values(s.rf || {}).reduce((x, y) => x + y, 0);
      a.refused += rf;
      a.kept += s.af || 0;
      a.held += s.hd || 0;
      a.pages += s.pg || 0;
      add(a.ep, s.ep); add(a.keys, s.key); add(a.names, s.nm);
      const k = s.ak || s.k;
      if (k && k !== 'unknown' && (s.ak || !a.kind)) a.kind = k;
      const i = Math.round((hour - from) / 3600000);
      if (i >= 0 && i < 24) { a.bars[i] += c; a.refusedBars[i] += rf; }
      if (c && (a.first == null || hour < a.first)) a.first = hour;
    }
  }
  const perHour = paceSecs ? 3600 / paceSecs : 4;
  const out = [];
  for (const a of by.values()) {
    const share = dayTotal > 0 && a.today >= HOT.SHARE_FLOOR ? a.today / dayTotal : 0;
    const why = [];
    if (a.apiH1 > HOT.PACE_X * perHour) why.push('pace');
    if (a.d1 > HOT.DAY_N) why.push('day');
    if (share > HOT.SHARE) why.push('share');
    if (a.kept > 0) why.push('kept');
    if (!why.length) continue;
    const level = a.d1 > HOT.HEAVY_N || share > HOT.HEAVY_SHARE ? 'heavy' : 'watch';
    out.push({ ...a, h1: Math.round(a.h1), apiH1: Math.round(a.apiH1), share, why, level, overPace: a.apiH1 > HOT.PACE_X * perHour, started: a.first != null && a.first > from ? a.first : null });
  }
  return out.sort((x, y) => (x.level === y.level ? y.d1 - x.d1 : x.level === 'heavy' ? -1 : 1));
}

/**
 * The likely member behind a source, from page visits by the same fingerprint in the last 14 days: every team that
 * browsed from it, most visits first. Only the Admin Password popup's route ever answers with this.
 */
export function likelyTeams(matches, now = Date.now()) {
  const cutoff = new Date(now - 14 * 86400000).toISOString().slice(0, 10);
  const out = [];
  for (const [team, days] of Object.entries(matches || {})) {
    let n = 0; for (const [d, v] of Object.entries(days || {})) if (d >= cutoff) n += v;
    if (n) out.push({ teamId: Number(team), visits: n });
  }
  return out.sort((a, b) => b.visits - a.visits);
}

/** Why no member matches a source: Google's servers for a sheet or a script there, or simply no visits. */
export function noMemberWhy(kind) {
  if (kind === 'Google Sheets') return 'Google’s servers: a Google Sheet. No member’s pages come from these addresses';
  if (kind === 'Apps Script') return 'Google’s servers: an Apps Script project. No member’s pages come from these addresses';
  return 'No member’s pages came from this address in the last 14 days';
}

/** The sentence under a likely member, given team names. */
export function memberWhy(teams, names) {
  const nm = (t) => (names && names[t.teamId]) || `Team ${t.teamId}`;
  if (!teams || !teams.length) return null;
  if (teams.length === 1) return `this address opened the site as ${nm(teams[0])} ${teams[0].visits} time${teams[0].visits === 1 ? '' : 's'} in the last 14 days`;
  return `this address opened the site as ${teams.length === 2 ? 'both' : `all ${teams.length}`} in the last 14 days: a shared household`;
}
