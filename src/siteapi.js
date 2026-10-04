/**
 * Site API: the /api/v1/ router.
 *
 * Five endpoints, opened by the league's key alone; cookies are never read. Answered first in line, before the
 * League Password gate, with the site's settings held 60 seconds per isolate. Every answer is a slice of the
 * prebuilt snapshot plus a small meta block; nothing is built on a request. Each program gets one round of
 * requests per suggested interval, kept by its pace record; a request sooner is refused with too_soon.
 *
 * Read-only: GET, HEAD and OPTIONS are answered and nothing else. The only writes it can cause are the key's
 * generation moving on when due (one KV write) and the pace record's windows.
 */
import { loadConfig, saveConfig, isSetupFinished } from './config.js';
import { visibilityOf, VISIBILITY } from './tools.js';
import { SECTIONS, SECTION_TOOL, ENDPOINTS, endpoint, paramsOf, CONVENTIONS } from './apisections.js';
import { SNAPSHOT_KEY, openSnapshot, snapshotEvery, gamesOn } from './apibuild.js';
import { keyRing, matchKey, keyState, dueChange, shortOf, dateWords, dayIso, normaliseSiteApi } from './apikey.js';
import { levelFrom, paceOf } from './budget.js';
import { decideFor, refusalWords, RW } from './pacerecord.js';
import { fingerprint, programKind } from './sources.js';
import { paceUsage, paceCheckIn, countApi, countSourceNow, traceOf } from './sitelog.js';

export const API_TOOL = 'site-api';
export const EXPOSE = 'ETag, Retry-After, X-Stop, X-Suggested-Interval, X-Updated-At, X-Refresh-Every';
const HOLD_MS = RW.HOLD * 1000;
const MAX_HELD = 200;
const WAIT_STALE_MS = 15 * 60000;
const WAIT_LIMIT_MS = 15000;
const SETTINGS_HOLD_MS = 60000;

/* ---- what each isolate keeps -------------------------------------------------------------------- */
const MEM = {
  holdMs: HOLD_MS,
  settings: null, settingsAt: 0,
  snap: null, snapEtag: null, snapCheckedAt: 0, askedAt: 0,
  held: 0,
  badKey: new Map(),      // fingerprint -> the minute of its last bad-key answer
  local: new Map(),       // program id -> { state } while it is inside a refused window
};
/** Test hook: how long a hold lasts (20 seconds in service), so tests can observe holds without waiting. */
export function setHoldMs(ms) { MEM.holdMs = ms; }
export function heldNow() { return MEM.held; }
/** Test hook: forget everything this isolate holds. */
export function resetSiteApiMemory() {
  MEM.settings = null; MEM.settingsAt = 0; MEM.snap = null; MEM.snapEtag = null; MEM.snapCheckedAt = 0; MEM.askedAt = 0;
  MEM.held = 0; MEM.badKey.clear(); MEM.local.clear();
}

/** The site's settings, held 60 seconds per isolate. A key due to move on moves on here (one KV write). */
export async function apiSettings(env, now = Date.now(), { fresh = false } = {}) {
  if (!fresh && MEM.settings && now - MEM.settingsAt < SETTINGS_HOLD_MS) return MEM.settings;
  let cfg = await loadConfig(env);
  if (isSetupFinished(cfg) && cfg.sessionSecret) {
    const change = dueChange(cfg.siteApi, now);
    if (change) {
      try { cfg = await saveConfig(env, { siteApi: change }); } catch { /* the next request tries again */ }
    }
  }
  MEM.settings = cfg; MEM.settingsAt = now;
  return cfg;
}
export function forgetApiSettings() { MEM.settings = null; MEM.settingsAt = 0; }

/* ---- the snapshot, held in memory ------------------------------------------------------------------- */
async function readSnapshot(env) {
  const o = await env.DATA.get(SNAPSHOT_KEY, MEM.snapEtag ? { onlyIf: { etagDoesNotMatch: MEM.snapEtag } } : undefined);
  if (o && 'body' in o) {
    MEM.snap = openSnapshot(new Uint8Array(await o.arrayBuffer()));
    MEM.snapEtag = o.etag;
  } else if (!o) { MEM.snap = null; MEM.snapEtag = null; }
}

async function askRebuild(env, { games, quiet, every, force = false }) {
  const stub = env.COORDINATOR.get(env.COORDINATOR.idFromName('site_api_snapshot'));
  const q = new URLSearchParams({ every: String(every), games: games ? '1' : '0', quiet: quiet ? '1' : '0' });
  if (force) q.set('force', '1');
  const r = await stub.fetch(`https://coordinator/api-snapshot?${q}`);
  try { return await r.json(); } catch { return { ok: false }; }
}

/**
 * The snapshot as this isolate holds it, checked for a newer one at most once a minute (every 15 seconds while
 * the site is quiet during games). The first request that finds it due starts a rebuild behind the answer; one
 * over 15 minutes old (or none at all) waits for the rebuild, up to 15 seconds.
 */
export async function currentSnapshot(env, ctx, { now = Date.now(), quiet = false, wait = true } = {}) {
  const games0 = MEM.snap ? gamesOn(MEM.snap.index.windows, now) : false;
  const checkMs = games0 && quiet ? 15000 : 60000;
  if (!MEM.snap || now - MEM.snapCheckedAt >= checkMs) {
    MEM.snapCheckedAt = now;
    try { await readSnapshot(env); } catch { /* keep what is held */ }
  }
  const games = MEM.snap ? gamesOn(MEM.snap.index.windows, now) : false;
  // The brake (C5): at Economy the snapshot is rebuilt every 15 minutes outside games; at Protect not at all (a
  // rebuild runs in the dataset coordinator, and the frontend calls no object), so answers come from what is held.
  const brake = env.BRAKE || 'normal';
  const every0 = snapshotEvery({ games, quiet, draftLive: MEM.snap && MEM.snap.index.draftLive });
  const every = brake === 'economy' && !games ? Math.max(every0, 900) : every0;
  const age = MEM.snap ? now - Date.parse(MEM.snap.index.builtAt) : Infinity;
  const mayRebuild = brake !== 'protect' && brake !== 'limit';
  if (mayRebuild && age >= every * 1000 && now - MEM.askedAt >= Math.min(every, 15) * 1000) {
    MEM.askedAt = now;
    const task = askRebuild(env, { games, quiet, every }).catch(() => null);
    // A program waits (up to 15 s) for a snapshot over 15 minutes old; the Site API page never waits: it answers at
    // once and catches up when the rebuild lands.
    if (age > WAIT_STALE_MS && wait) {
      await Promise.race([task, new Promise((r) => setTimeout(r, WAIT_LIMIT_MS))]);
      MEM.snapCheckedAt = Date.now();
      try { await readSnapshot(env); } catch { /* answer from what is held */ }
    } else if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(task);
  }
  const due = MEM.snap ? now - Date.parse(MEM.snap.index.builtAt) >= every * 1000 : true;
  return { snap: MEM.snap, games: MEM.snap ? gamesOn(MEM.snap.index.windows, now) : games, due };
}

/* ---- the pace -------------------------------------------------------------------------------------- */
/** The level and pace this isolate reads now, from the site log's reply (checked in once when new or stale). */
export async function currentPace(env, ctx, { now = Date.now(), games = false } = {}) {
  let usage = paceUsage();
  if (env.SITE_LOG && (!usage || now - usage.heardAt > 10 * 60000)) {
    const task = paceCheckIn(env, now);
    if (!usage) { await task; usage = paceUsage(); } else if (ctx && ctx.waitUntil) ctx.waitUntil(task);
  }
  let lvl;
  if (!env.SITE_LOG || !usage) lvl = { key: 'normal', limit: null };
  else if (now - usage.heardAt > 10 * 60000) lvl = { key: 'busy', limit: null, blind: true };   // no counts for 10 minutes: Economy until heard again
  else lvl = levelFrom(usage, now);
  return { ...paceOf(lvl.key, games, now), limit: lvl.limit || null };
}

/* ---- answers ---------------------------------------------------------------------------------------- */
function baseHeaders(extra = {}) {
  return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': EXPOSE, 'X-Content-Type-Options': 'nosniff', ...extra };
}
const isCsvReq = (m, url) => Boolean(m && m.csv) || url.searchParams.get('format') === 'csv';
const sheetsCell = (text) => '"' + ('Site API: ' + text).replace(/"/g, '""') + '"\r\n';

/** An error in the one shape every error has, or for CSV as plain text, or for Google Sheets as one cell. */
function fail(ctxReq, status, code, message, extra = {}, headers = {}, sheetsText = message) {
  const { csv, sheets, origin, head } = ctxReq;
  ctxReq.outcome = { status, code, kind: extra.kind || null };
  if (csv && sheets) return new Response(head ? null : sheetsCell(sheetsText), { status: 200, headers: baseHeaders({ 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store', ...headers }) });
  if (csv) return new Response(head ? null : message + '\n', { status, headers: baseHeaders({ 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...headers }) });
  const body = { ok: false, error: { code, message, ...extra, docs: `${origin}/apps/site-api/#errors` } };
  return new Response(head ? null : JSON.stringify(body), { status, headers: baseHeaders({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }) });
}

async function hold(ms = MEM.holdMs) {
  if (MEM.held >= MAX_HELD) return false;
  MEM.held += 1;
  try { await new Promise((r) => setTimeout(r, ms)); } finally { MEM.held -= 1; }
  return true;
}

const NAME_RE = /^[A-Za-z0-9-]{1,32}$/;
function parsePath(pathname) {
  const m = /^\/api\/v1\/([A-Za-z]+)(\.csv)?\/?$/.exec(pathname);
  if (!m) return null;
  const ep = endpoint(m[1]);
  if (!ep) return null;
  if (m[2] && !ep.csv) return null;
  return { ep, csv: Boolean(m[2]) };
}

/** Which sections a build may carry now: a section follows its tool, and a tool's data is served only while it is visible. */
export function visibleSections(cfg) {
  const out = new Set();
  for (const s of SECTIONS) {
    const tool = SECTION_TOOL[s.key];
    if (!tool || visibilityOf(cfg, tool) === VISIBILITY.VISIBLE) out.add(s.key);
  }
  return out;
}
const TOOL_NAMES = { 'live-matchups': 'Live Matchups', 'hall-of-fame': 'Hall of Fame', 'fortune-teller': 'Fortune Teller', 'trade-analyzer': 'Trade Analyzer', 'draft-helper': 'Draft Helper' };

/** Every section's reason for being left out of this answer, in order. */
export function leftOutList(cfg, index, { logos = false } = {}) {
  const vis = visibleSections(cfg);
  const out = [];
  for (const s of SECTIONS) {
    if (s.key === 'about') continue;
    const tool = SECTION_TOOL[s.key];
    if (tool && !vis.has(s.key)) { out.push({ section: s.key, why: `${TOOL_NAMES[tool] || tool} isn’t visible to members, so its data is left out.` }); continue; }
    if (s.key === 'logos' && !logos) { out.push({ section: s.key, why: 'Left out by default: add ?logos=true to include it.' }); continue; }
    const why = index.leftOut && index.leftOut[s.key];
    if (why) out.push({ section: s.key, why });
  }
  return out;
}

const iso = (ms) => (ms == null ? null : new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z'));
function liveRefresh(games, quiet) { return games ? (quiet ? 15 : 60) : 300; }

/** The key's part of meta: its short name, its replacement date, and a warning when it matters. */
export function keyMeta(sa, ring, match, now) {
  const st = keyState(sa, now);
  let warning = null;
  if (match && match.state === 'grace') warning = `This key was replaced; it stops working on ${dateWords(match.stopsAt)}. Get the new one from the Site API page.`;
  else if (st.soon && st.changesAt) warning = `This key changes on ${dateWords(st.changesAt)}. Get the new one from the Site API page then.`;
  const endsIn = match && match.state === 'grace' ? shortOf(ring.prev && ring.prev.key) : shortOf(ring.current);
  return { endsIn, replacedOn: dayIso(match && match.state === 'grace' ? match.stopsAt : st.changesAt), warning };
}

/** about: the league, the API's version, the key, the pace, each section's freshness and what is left out. */
export function aboutBlock(index, { pace, games, quiet, keyInfo, cfg, logos }) {
  const sections = {};
  for (const s of SECTIONS) {
    if (s.key === 'about') continue;
    const u = (index.sections || {})[s.key] || {};
    sections[s.key] = { updatedAt: u.updatedAt || null, refreshEverySeconds: s.live ? liveRefresh(games, quiet) : s.sec };
  }
  return {
    league: index.leagueName, season: index.season, week: index.week, phase: index.phase, apiVersion: 1,
    builtAt: index.builtAt,
    key: { endsIn: keyInfo.endsIn, replacedOn: keyInfo.replacedOn },
    pace: { askEverySeconds: pace.header, site: pace.level, note: pace.note },
    sections,
    leftOut: leftOutList(cfg, index, { logos }),
    conventions: CONVENTIONS,
  };
}

/** Which snapshot parts an endpoint's answer is made of, and when its data was last updated. */
export function answerParts(epKey, { csv, team, logos, cfg, index }) {
  const vis = visibleSections(cfg);
  const sim = vis.has('fortuneTeller') ? '' : '~nosim';
  const sec = (k) => ((index.sections || {})[k] || {}).updatedAt || null;
  const latest = (...ks) => ks.map(sec).filter(Boolean).sort().pop() || index.builtAt;
  if (epKey === 'standings') return { parts: [(csv ? 'c:standings' : 's:standings') + sim], updatedAt: latest('standings') };
  if (epKey === 'scoreboard') return { parts: [(csv ? 'ec:scoreboard' : 'e:scoreboard') + (team ? ':' + team : '')], updatedAt: latest('scoreboard') };
  if (epKey === 'rosters') return { parts: [(csv ? 'ec:rosters' : 'e:rosters') + (team ? ':' + team : '')], updatedAt: latest('rosters') };
  if (epKey === 'activity') return { parts: [csv ? 'ec:activity' : 'e:activity'], updatedAt: latest('transactions', 'trades') };
  // /full: every section its tools allow, in registry order.
  const keys = SECTIONS.filter((s) => s.key !== 'about' && vis.has(s.key) && (s.key !== 'logos' || logos)).map((s) => s.key);
  return { parts: keys.map((k) => (k === 'standings' ? 's:standings' + sim : 's:' + k)), keys, updatedAt: index.builtAt };
}

const enc = new TextEncoder();
function concatBytes(chunks) {
  let n = 0; for (const c of chunks) n += c.length;
  const out = new Uint8Array(n); let p = 0;
  for (const c of chunks) { out.set(c, p); p += c.length; }
  return out;
}

/**
 * The body of an answer from snapshot slices: the data as stored, meta (and about) made for this request.
 * Nothing is parsed unless ?pretty=true asks for it.
 */
export function answerBody(snap, epKey, { csv, team, logos, cfg, meta, about, pretty }) {
  const { parts, keys } = answerParts(epKey, { csv, team, logos, cfg, index: snap.index });
  if (csv) return snap.bytes(parts[0]) || enc.encode('');
  let data;
  if (epKey === 'full') {
    const chunks = [enc.encode('{"about":' + JSON.stringify(about))];
    keys.forEach((k, i) => { const b = snap.bytes(parts[i]); if (b) { chunks.push(enc.encode(',"' + k + '":')); chunks.push(b); } });
    chunks.push(enc.encode('}'));
    data = concatBytes(chunks);
  } else data = snap.bytes(parts[0]) || enc.encode('[]');
  const body = concatBytes([enc.encode('{"ok":true,"data":'), data, enc.encode(',"meta":' + JSON.stringify(meta) + '}')]);
  if (!pretty) return body;
  return enc.encode(JSON.stringify(JSON.parse(new TextDecoder().decode(body)), null, 2) + '\n');
}

function etagOf(snap, epKey, opts, extra) {
  const { parts } = answerParts(epKey, { ...opts, index: snap.index });
  const h = snap.index.h || {};
  let x = 0x811c9dc5;
  const s = parts.map((p) => h[p] || p).join('|') + '|' + extra;
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193); }
  return '"' + (x >>> 0).toString(16).padStart(8, '0') + '"';
}

/**
 * One answer, exactly as a program receives it: its headers and (made on demand) its body. The API and the
 * page's Try it both come here, so Try it shows what a script gets without using a script's window.
 */
export function buildAnswer({ snap, cfg, epKey, team = '', csv = false, logos = false, pretty = false, pace, games, quiet, keyInfo, origin }) {
  const ep = endpoint(epKey);
  const opts = { csv, team, logos, cfg };
  const { updatedAt } = answerParts(epKey, { ...opts, index: snap.index });
  const refreshEvery = ep.refresh({ games, quiet });
  const meta = {
    endpoint: epKey, apiVersion: 1, league: snap.index.leagueName, season: snap.index.season, week: snap.index.week,
    updatedAt, refreshEverySeconds: refreshEvery,
    pace: { askEverySeconds: pace.header, site: pace.level, note: pace.note },
    docs: `${origin}/apps/site-api/#${epKey}`,
    key: keyInfo,
  };
  const etag = etagOf(snap, epKey, opts, `${pace.header}|${keyInfo.endsIn}|${keyInfo.warning ? 'w' : ''}|${pretty ? 'p' : ''}|${csv ? 'c' : ''}`);
  const headers = {
    'Content-Type': csv ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
    'X-Suggested-Interval': String(pace.header),
    'X-Updated-At': updatedAt || '',
    'X-Refresh-Every': String(refreshEvery),
    ETag: etag,
    'Last-Modified': new Date(Date.parse(updatedAt || snap.index.builtAt)).toUTCString(),
    'Cache-Control': `private, max-age=${pace.secs || 0}`,
  };
  const body = () => {
    const about = epKey === 'full' ? aboutBlock(snap.index, { pace, games, quiet, keyInfo, cfg, logos }) : null;
    return answerBody(snap, epKey, { ...opts, meta, about, pretty });
  };
  return { headers, body, meta };
}

/** The client's address, as Cloudflare's edge gives it. */
export function clientAddress(request) {
  return request.headers.get('cf-connecting-ip') || (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || '0.0.0.0';
}

/**
 * Keeps one program's window: from this isolate's memory while it is inside a refused window, otherwise from the
 * pace record. If the pace record cannot be reached, the isolate decides from its own memory and, when unsure,
 * answers: a program is never stopped by the site's own fault.
 */
export async function rateCheck(env, { id, name, now, P, restUntil }) {
  const t = now / 1000;
  const local = MEM.local.get(id);
  if (local) {
    const probe = JSON.parse(JSON.stringify(local.state));
    const d = decideFor(probe, name, t, P, restUntil);
    if (d.kind !== 'ok') { local.state = probe; return { ...d, from: 'memory' }; }
  }
  try {
    // At Protect the frontend calls no object, so the isolate decides from its own memory (C5).
    if (env.BRAKE === 'protect' || env.BRAKE === 'limit') throw new Error('the brake holds object calls');
    const stub = env.SOURCE_PACE.get(env.SOURCE_PACE.idFromName(id));
    const r = await stub.fetch('https://pace/decide', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, t, P, restUntil }) });
    const j = await r.json();
    if (!j || !j.ok) throw new Error('pace record answered badly');
    const d = j.d;
    // Remember a refused window, so the requests inside it are refused without asking again.
    if (d.kind !== 'ok') {
      const st = { addr: { starts: [], names: name ? [name] : [] }, progs: { [d.prog]: { ...d.rec } } };
      if (MEM.local.size > 5000) MEM.local.clear();
      MEM.local.set(id, { state: st });
    } else MEM.local.delete(id);
    return { ...d, from: 'record' };
  } catch {
    const st = local ? local.state : {};
    const d = decideFor(st, name, t, P, restUntil);
    if (d.kind === 'ok') MEM.local.delete(id);
    return d.kind === 'ok' ? { ...d, from: 'open' } : { kind: 'ok', pace: P, from: 'open' };
  }
}

/** The whole route. */
export async function handleSiteApi(request, env, ctx, { now = Date.now() } = {}) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const m = parsePath(url.pathname);
  const ua = request.headers.get('user-agent') || '';
  const cr = { csv: isCsvReq(m, url), sheets: /apps-spreadsheets/i.test(ua), origin: url.origin, head: method === 'HEAD' };
  const counted = (fields) => { try { countSourceNow(cr.fp, fields); } catch { /* counting never matters */ } };
  const tally = (kind, key) => { try { countApi(kind, key); } catch { /* nothing */ } };

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: baseHeaders({ 'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, If-None-Match, X-Script-Name', 'Access-Control-Max-Age': '86400' }) });
  }
  if (method !== 'GET' && method !== 'HEAD') return fail(cr, 405, 'method_not_allowed', 'The API only reads.', {}, { Allow: 'GET, HEAD, OPTIONS' });
  if (!m) return fail(cr, 404, 'not_found', 'There’s no endpoint here. The five are /full, /scoreboard, /standings, /rosters and /activity.');

  let cfg;
  try { cfg = await apiSettings(env, now); } catch { return fail(cr, 500, 'server_error', 'Something went wrong on the site. Try again shortly.'); }
  // Recorded like any other request once setup has finished: counted, never logged one by one.
  const trace = traceOf(request);
  if (trace) trace.record = isSetupFinished(cfg);
  if (cfg.sessionSecret) { try { cr.fp = await fingerprint(cfg.sessionSecret, clientAddress(request)); } catch { cr.fp = null; } }
  const kind = programKind(ua);

  // What may follow the address, and nothing else.
  const allowed = paramsOf(m.ep.key).concat('key');
  for (const k of url.searchParams.keys()) {
    if (!allowed.includes(k)) {
      tally('bad', 'bad_request');
      return fail(cr, 400, 'bad_request', `${m.ep.path} takes ${paramsOf(m.ep.key).join(', ')}; not “${k}”.`);
    }
  }
  const name = url.searchParams.get('name') || request.headers.get('x-script-name') || '';
  if (name && !NAME_RE.test(name)) return fail(cr, 400, 'bad_request', 'name must be up to 32 letters, digits and dashes.');
  const format = url.searchParams.get('format');
  if (format && format !== 'csv' && format !== 'json') return fail(cr, 400, 'bad_request', 'format must be csv or json.');
  const pretty = url.searchParams.get('pretty');
  if (pretty && pretty !== 'true' && pretty !== 'false') return fail(cr, 400, 'bad_request', 'pretty must be true or false.');
  const logosQ = url.searchParams.get('logos');
  if (logosQ && logosQ !== 'true' && logosQ !== 'false') return fail(cr, 400, 'bad_request', 'logos must be true or false.');
  if (format === 'json' && m.csv) return fail(cr, 400, 'bad_request', 'A .csv address answers in CSV; leave out format=json.');

  // The switch, and the tool: hiding it turns the API off along with the downloads.
  const sa = normaliseSiteApi(cfg.siteApi);
  if (!isSetupFinished(cfg) || !cfg.sessionSecret) return fail(cr, 503, 'not_ready', 'The league’s data hasn’t been pulled yet.');
  if (!sa.on || visibilityOf(cfg, API_TOOL) === VISIBILITY.HIDDEN) {
    tally('bad', 'api_off');
    return fail(cr, 403, 'api_off', 'The API is switched off for this league.');
  }

  // The key: a header, or the address where the site allows it. Cookies are never read.
  const auth = request.headers.get('authorization') || '';
  const fromHeader = /^Bearer\s+/i.test(auth) ? auth.replace(/^Bearer\s+/i, '').trim() : '';
  const fromAddress = url.searchParams.get('key') || '';
  const supplied = fromHeader || fromAddress;
  const minute = Math.floor(now / 60000);
  const badKey = async (status, code, message) => {
    // The first bad-key answer from a source in any minute goes at once; later ones are held 20 seconds.
    const fpId = cr.fp ? cr.fp.id : 'unknown';
    const first = MEM.badKey.get(fpId) !== minute;
    if (MEM.badKey.size > 5000) MEM.badKey.clear();
    MEM.badKey.set(fpId, minute);
    tally('bad', code);
    counted({ api: true, kind, key: code === 'key_missing' ? 'none' : code === 'key_replaced' ? 'old' : 'wrong', ep: m.ep.key, held: !first });
    if (!first) { const held = await hold(); if (held) tally('held', 'badKey'); }
    return fail(cr, status, code, message);
  };
  if (!fromHeader && fromAddress && !sa.inAddress) {
    return badKey(401, 'key_missing', 'This site takes the key in a header only. Send it as Authorization: Bearer eft_…, not in the address.');
  }
  if (!supplied) return badKey(401, 'key_missing', 'This needs your league’s API key. Find it on the Site API page.');
  const ring = await keyRing(cfg.sessionSecret, sa);
  const match = matchKey(ring, sa, supplied, now);
  if (match.state === 'invalid') return badKey(401, 'key_invalid', 'That key isn’t right. Copy it again from the Site API page.');
  if (match.state === 'replaced') return badKey(401, 'key_replaced', `This key was replaced on ${dateWords(match.replacedAt)}. Get the new one from the Site API page.`);

  // The snapshot and the pace.
  const usageQuiet = await currentPace(env, ctx, { now, games: false });
  const { snap, games } = await currentSnapshot(env, ctx, { now, quiet: usageQuiet.level === 'quiet' });
  const pace = paceOf(usageQuiet.level, games, now);
  const quiet = pace.level === 'quiet' && games;

  // The rate window: the key, the address and the program's name.
  const id = `${sa.gen}|${cr.fp ? cr.fp.id : 'unknown'}`;
  const restUntil = pace.secs == null ? pace.until / 1000 : null;
  const d = await rateCheck(env, { id, name, now, P: pace.secs, restUntil });
  if (d.kind !== 'ok') {
    const kindWord = d.kind === 'tf' ? 'too_fast' : 'pace_changed';
    const stop = d.kind === 'tf' ? 'exit' : 'pause';
    tally('tooSoon', kindWord + (d.address ? '.address' : ''));
    counted({ api: true, kind, key: match.state === 'grace' ? 'old' : 'current', ep: m.ep.key, name, refused: kindWord, held: d.held, after: d.held });
    if (d.held) { const held = await hold(); if (held) tally('held', 'tooSoon'); }
    if (cr.csv && cr.sheets) tally('sheets', 'cell');
    const retry = Math.max(1, Math.round(d.retry));
    const extra = { kind: kindWord, stop, askEverySeconds: d.pace == null ? null : d.pace,
      askedAfterSeconds: isFinite(d.gap) ? Math.round(d.gap) : null, retryAfterSeconds: retry, ...(d.address ? { address: true } : {}) };
    return fail(cr, 429, 'too_soon', refusalWords(d, false), extra,
      { 'Retry-After': String(retry), 'X-Stop': stop, 'X-Suggested-Interval': String(pace.header) }, refusalWords(d, true));
  }

  if (!snap || !snap.index.ready) return fail(cr, 503, 'not_ready', 'The league’s data hasn’t been pulled yet.');
  const team = url.searchParams.get('team') || '';
  if (team) {
    const ids = snap.index.teams || [];
    if (!/^\d+$/.test(team) || !ids.includes(Number(team))) {
      const lo = Math.min(...ids), hi = Math.max(...ids);
      return fail(cr, 400, 'bad_request', `team must be one of this league’s team ids: ${ids.length && hi - lo + 1 === ids.length ? `${lo} to ${hi}` : ids.join(', ')}.`);
    }
  }

  const csv = cr.csv;
  const logos = logosQ === 'true';
  const keyInfo = keyMeta(sa, ring, match, now);
  const built = buildAnswer({ snap, cfg, epKey: m.ep.key, team, csv, logos, pretty: pretty === 'true', pace, games, quiet, keyInfo, origin: cr.origin });
  const headers = baseHeaders(built.headers);
  const etag = headers.ETag;
  counted({ api: true, kind, key: match.state === 'grace' ? 'old' : 'current', ep: m.ep.key, name });
  tally('answered', m.ep.key + (csv ? '.csv' : ''));
  if (d.early) tally('grace', 'answered');
  if (d.from === 'open') tally('open', 'decided');
  if (match.state === 'grace') tally('oldKey', 'answered');
  tally('by', fromHeader ? 'header' : 'address');
  const inm = request.headers.get('if-none-match');
  if (inm && inm.split(',').map((x) => x.trim()).includes(etag)) {
    tally('notModified', m.ep.key);
    const h = { ...headers }; delete h['Content-Type'];
    cr.outcome = { status: 304 };
    return new Response(null, { status: 304, headers: h });
  }
  cr.outcome = { status: 200 };
  return new Response(cr.head ? null : built.body(), { status: 200, headers });
}
