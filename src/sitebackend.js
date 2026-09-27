/**
 * Site Backend: one tab's payload, the hourly status reports, the storage census,
 * and a dataset's detail. Everything runs inside the site log object (30 s of CPU)
 * and reads every other store as it is: nothing here refreshes a dataset, sets an
 * alarm or writes outside the log. A test holds the imports to reads only.
 *
 * Every payload passes through one redaction pass before it leaves: whatever the
 * panels were written to show, no credential can appear in what is sent.
 */

import { isSetupFinished } from './config.js';
import { getDataset } from './datasets.js';
import { visibilityOf } from './tools.js';
import { timelineSize } from './timeline.js';
import { BYTE_BUDGET } from './scoretimeline.js';
import { LOG_BUDGET_REF } from './sblimits.js';
import {
  makeSources, datasetRows, datasetRow, C, B, worst, hourOf, utcMidnight, median, sumReq, ticksOf,
  eventsSince, PAGES, pageOf, DAY_MS, upstream,
} from './sbcore.js';
import {
  OVERVIEW, reasons, verdictOf, gameWindow, strip, pageState, timelineWeeks, feedRows, usage, ftSev, fmtB, tickState, CRON_MISS_WARN,
} from './sbover.js';
import { pagePanels } from './sbpages.js';
import { pageForRoute } from './readers.js';

const FEED_PAGE = 100;

// ---------------------------------------------------------------- context shared by every panel

async function context(src) {
  const now = src.now;
  const cfg = await src.cfg();
  const finished = isSetupFinished(cfg);
  const [espn, rows, hours, ftp, teams, board, lsd] = await Promise.all([
    src.espnAuth(), datasetRows(src), src.hours(48), src.ftPipeline(), src.teams(),
    src.digest('scoreboard_digest'), src.digest('live_scoring_digest'),
  ]);
  const rowByKey = Object.fromEntries(rows.map((r) => [r.key, r]));
  const ticks = ticksOf(hours.filter((h) => h.hour >= hourOf(now) - 3600000));
  const tickKeys = Object.keys(ticks).map(Number);
  const lastTickMeta = src.deps.meta('lastTick', null);
  const lastTick = tickKeys.length ? Math.max(...tickKeys) : lastTickMeta ? lastTickMeta.minute : null;
  const firstTick = src.deps.meta('firstTick', null);
  const minute = Math.floor(now / 60000) * 60000;
  let cronMissed = 0, cronCounted = 0;
  if (lastTick != null) {
    // Only minutes since the log's first tick count: a log that started ten minutes ago has ten to judge.
    for (let i = 1; i <= 60; i++) {
      const m = minute - i * 60000;
      const st = tickState({ ticks, firstTick }, m, now);
      if (st === 'none') break;
      if (st === 'pending') continue;
      cronCounted += 1;
      if (st === 'miss') cronMissed += 1;
    }
  }
  const logoState = src.deps.meta('logoState', {}) || {};
  const logosFailing = Object.entries(logoState).filter(([, s]) => s === 'failed').map(([id]) => ({ id: Number(id), name: (teams[id] || {}).name || `Team ${id}` }));
  const window = gameWindow(board, now);
  const lastHour = hours.filter((h) => h.hour >= hourOf(now) - 3600000);
  const errorsOf = (list) => list.reduce((a, h) => a + sumReq([h]).e + (h.d.exc || 0), 0);
  const errorsHour = errorsOf(lastHour);
  const errors24 = errorsOf(hours.filter((h) => h.hour >= now - DAY_MS));
  const week = (lsd && lsd.matchupPeriod) || null;
  const weeks = await timelineWeeks(src, cfg.season, week, window.open);
  const cur = weeks.find((w) => w.week === week);
  const ctx = {
    cfg, finished, espn, rows, rowByKey, hours, ticks, lastTick, firstTick, cronMissed, cronCounted, ftp, teams,
    logoState, logosFailing, window, errorsHour, errors24, timelineWeeks: weeks,
    timelinePct: cur ? (cur.bytes || 0) / BYTE_BUDGET : 0,
  };
  ctx.pageStates = Object.fromEntries(PAGES.map((p) => [p.key, pageState(p, ctx)]));
  ctx.reasons = await reasons(src, ctx);
  ctx.verdict = verdictOf(ctx.reasons);
  return ctx;
}

// ---------------------------------------------------------------- panels

async function runPanels(src, ctx, defs, open) {
  const out = [];
  for (const def of defs) {
    const p = { id: def.id, title: def.title, sub: def.sub || null, live: Boolean(def.live), asof: def.asof || null };
    try { p.sum = await def.sum(src, ctx); } catch (err) { p.sum = ['warn', 'could not be read just now']; p.error = String((err && err.message) || err).slice(0, 160); }
    if (open.has(def.id) || open.has('*')) {
      try { p.body = await def.body(src, ctx); } catch (err) { p.body = [B.empty('This panel could not be read just now. It tries again on the next refresh.')]; p.error = String((err && err.message) || err).slice(0, 160); }
    }
    out.push(p);
  }
  return out;
}

function bundleFor(src, page) {
  const list = (src.facts.buildInfo && src.facts.buildInfo.bundles) || [];
  return list.find((b) => b.name === `${page.key}/bundle.js` || b.name === page.key) || null;
}

function pageStrip(src, ctx, page) {
  const tool = page.tool ? visibilityOf(ctx.cfg, page.tool) : null;
  const b = bundleFor(src, page);
  const gate = !page.tool ? (page.key === 'signin' || page.key === 'wizard' ? 'public while signed out' : page.key === 'config' ? 'League Password, then Admin Password' : 'League Password')
    : tool === 'admin' ? 'League Password, then Admin Password' : tool === 'hidden' ? 'hidden: answers 403' : 'League Password';
  return {
    kv: [
      ['Page', C.txt(page.name)],
      ['Address', C.code(page.path)],
      ['Visibility', page.tool ? C.pill(tool === 'visible' ? 'ok' : tool === 'admin' ? 'warn' : 'idle', tool === 'admin' ? 'admin-only' : tool) : C.txt('always on')],
      ['Gate', C.txt(gate)],
      ['Bundle', b ? C.bytes(b.bytes, b.gzip ? `${fmtB(b.gzip)} compressed` : null) : C.txt(page.tool ? '—' : 'server-rendered')],
      ['State', C.dot(ctx.pageStates[page.key], ctx.pageStates[page.key] === 'ok' ? 'healthy' : ctx.pageStates[page.key] === 'run' ? 'working' : ctx.pageStates[page.key] === 'bad' ? 'failing' : ctx.pageStates[page.key] === 'warn' ? 'needs attention' : 'idle')],
    ],
  };
}

// ---------------------------------------------------------------- the Activity tab

/** A search term made safe for LIKE: its own wildcards are dropped. */
const likeTerm = (q) => `%${String(q || '').replace(/[%_]/g, ' ').trim().slice(0, 60)}%`;

function feedFilter(params) {
  const parts = [], binds = [];
  const kind = params.kind || '';
  if (kind && kind !== 'status') { parts.push('AND kind = ?'); binds.push(kind); }
  if (params.page) { parts.push('AND page = ?'); binds.push(params.page); }
  if (params.sev === 'problems') parts.push("AND sev IN ('warn','bad')");
  else if (params.sev === 'bad') parts.push("AND sev = 'bad'");
  if (params.team === 'none') parts.push('AND team IS NULL');
  else if (params.team && Number(params.team) > 0) { parts.push('AND team = ?'); binds.push(Number(params.team)); }
  if (params.q && String(params.q).trim()) { parts.push('AND text LIKE ?'); binds.push(likeTerm(params.q)); }
  return { where: parts.join(' '), binds, kind };
}

function rangeStart(params, now) {
  const r = params.range || '7d';
  if (r === '24h') return now - DAY_MS;
  if (r === '30d') return now - 30 * DAY_MS;
  if (r === 'season') return 0;
  return now - 7 * DAY_MS;
}

function reportsBetween(src, from, to, params) {
  if (params.page || params.team || (params.kind && params.kind !== 'status')) return [];
  let q = 'SELECT hour, sub, sev, text FROM reports WHERE hour >= ? AND hour < ?';
  const b = [from, to];
  if (params.sev === 'problems') q += " AND sev IN ('warn','bad')";
  else if (params.sev === 'bad') q += " AND sev = 'bad'";
  if (params.q && String(params.q).trim()) { q += ' AND text LIKE ?'; b.push(likeTerm(params.q)); }
  return src.deps.q(`${q} ORDER BY hour DESC LIMIT 2000`, ...b);
}

export function activityFeed(src, params) {
  const now = src.now;
  const since = rangeStart(params, now);
  const f = feedFilter(params);
  const statusOnly = f.kind === 'status';
  const after = Number(params.after) || 0;
  const before = Number(params.before) || 0;
  let events = [];
  if (!statusOnly) {
    let where = f.where; const binds = [...f.binds];
    if (after) { where += ' AND id > ?'; binds.push(after); }
    if (before) { where += ' AND id < ?'; binds.push(before); }
    events = eventsSince(src, since, where, ...binds).slice(0, FEED_PAGE + 1);
  }
  const more = events.length > FEED_PAGE;
  if (more) events = events.slice(0, FEED_PAGE);
  let reports;
  if (after) reports = reportsBetween(src, (Number(params.afterHour) || 0) + 1, now + 1, params);
  else {
    const top = before ? (Number(params.beforeAt) || now) : now + 1;
    const floor = more ? events[events.length - 1].at : since;
    reports = reportsBetween(src, Math.max(since, floor - 3600000), top, params);
    if (statusOnly) reports = reports.slice(0, 9 * 48);
  }
  const items = feedRows(events, reports);
  const hours = reports.map((r) => r.hour);
  return {
    items,
    newestId: events.length ? Math.max(...events.map((e) => e.id)) : after || null,
    newestHour: hours.length ? Math.max(...hours) : Number(params.afterHour) || null,
    oldestId: events.length ? Math.min(...events.map((e) => e.id)) : before || null,
    oldestAt: items.length ? Math.min(...items.map((i) => i.at)) : null,
    more: statusOnly ? false : more,
    since: new Date(since).toISOString(),
  };
}

function activityStrip(src) {
  const r = src.deps.q('SELECT MIN(at) AS first FROM events')[0] || {};
  r.n = Object.values(src.deps.meta('kinds', {}) || {}).reduce((a, n) => a + (n || 0), 0);
  const m = src.meter();
  return {
    kv: [
      ['Season', C.txt(String(src.facts.season || '—'), 'each season is its own store')],
      ['Entries', C.n(r.n || 0)],
      ['First entry', r.first ? C.time(r.first) : '—'],
      ['Store', C.bytes(src.deps.size(), 'of 1 GB')],
      ['Budget today', C.pct(Math.max(m.rows / LOG_BUDGET_REF.rows, m.req / LOG_BUDGET_REF.requests), m.paused ? 'reached: counters paused until 00:00 UTC' : null)],
    ],
  };
}

// ---------------------------------------------------------------- redaction

/** Every value a payload must never carry, from the stored config and the Worker's secrets. */
function secretsOf(cfg, env) {
  const out = [];
  const add = (v) => { if (typeof v === 'string' && v.length >= 6) out.push(v); };
  for (const k of ['espnS2', 'swid', 'leaguePasswordHash', 'adminPasswordHash', 'sessionSecret']) {
    const v = cfg && cfg[k];
    add(v);
    // A hash is stored as algorithm$iterations$salt$hash: each long piece is a secret on its own.
    if (typeof v === 'string') for (const piece of v.split(/[$:.]/)) if (piece.length >= 12) add(piece);
  }
  if (cfg && typeof cfg.swid === 'string') add(cfg.swid.replace(/[{}]/g, ''));
  if (env) add(env.DEV_TOKEN);
  return [...new Set(out)].sort((a, b) => b.length - a.length);
}

export function redact(payload, cfg, env) {
  let text = JSON.stringify(payload);
  const found = [];
  for (const s of secretsOf(cfg, env)) {
    if (text.includes(s)) { found.push(s.length); text = text.split(s).join('[hidden]'); }
    const esc = JSON.stringify(s).slice(1, -1);
    if (esc !== s && text.includes(esc)) { found.push(s.length); text = text.split(esc).join('[hidden]'); }
  }
  const out = JSON.parse(text);
  if (found.length) out.redacted = found.length;
  return out;
}

// ---------------------------------------------------------------- one tab

export async function assembleTab(deps, params = {}) {
  const src = makeSources(deps);
  src.params = params;
  const tab = params.tab || 'overview';
  const open = new Set(String(params.open || '').split(',').filter(Boolean));
  const ctx = await context(src);
  const settings = await src.settings();
  const base = {
    ok: true,
    at: new Date(src.now).toISOString(),
    tab,
    season: src.facts.season || null,
    seasons: src.facts.seasons || [],
    league: settings && settings.s && settings.s.name ? settings.s.name : null,
    teams: ctx.teams,
    verdict: { s: ctx.verdict.s, word: ctx.verdict.word, n: ctx.reasons.length },
    tabs: [
      { key: 'overview', name: 'Overview', s: ctx.verdict.s },
      { key: 'activity', name: 'Activity', s: null },
      ...PAGES.map((p) => ({ key: p.key, name: p.name, s: ctx.pageStates[p.key] })),
    ],
    pages: PAGES.map((p) => [p.key, p.name]),
    budget: src.meter().paused ? 'paused' : null,
  };
  let payload;
  if (tab === 'overview') {
    payload = { ...base, strip: await strip(src, ctx), panels: await runPanels(src, ctx, OVERVIEW, open) };
  } else if (tab === 'activity') {
    payload = { ...base, strip: activityStrip(src), panels: [], feed: activityFeed(src, params) };
  } else {
    const page = pageOf(tab);
    if (!page) return { ...base, ok: false, error: 'unknown tab' };
    payload = { ...base, page: { key: page.key, name: page.name, path: page.path }, strip: pageStrip(src, ctx, page), panels: await runPanels(src, ctx, pagePanels(page), open) };
  }
  return redact(payload, ctx.cfg, deps.env);
}

// ---------------------------------------------------------------- a dataset's detail

function cleanPart(p) {
  const { head, url, ...rest } = p || {};
  void head; void url;
  return rest;
}

export async function datasetDetail(deps, key) {
  const d = getDataset(key);
  if (!d) return { ok: false, error: 'unknown dataset' };
  const src = makeSources(deps);
  const [cfg, list, statuses] = await Promise.all([src.cfg(), src.dataList(), src.statuses()]);
  const row = datasetRow(d, cfg, list || {}, statuses || {}, src.now);
  const st = statuses && statuses[d.derivedFrom || d.key] ? statuses[d.derivedFrom || d.key].doc : null;
  let counters = null;
  if (deps.env.COORDINATOR) {
    try {
      const r = await deps.env.COORDINATOR.get(deps.env.COORDINATOR.idFromName(d.derivedFrom || d.key)).fetch('https://coordinator/counters');
      const j = await r.json();
      counters = j && j.counters ? j.counters : null;
    } catch { counters = null; }
  }
  const parts = ((list || {})[d.key] || []).map((o) => ({ part: o.part, size: o.size, uploaded: o.uploaded }));
  const report = st ? {
    startedAt: st.startedAt || null, ms: st.ms || 0, ok: st.ok !== false, forced: Boolean(st.forced),
    counts: st.counts || null, parts: (st.parts || []).map(cleanPart),
    derived: [st.derived, ...(st.derivedAll || [])].filter(Boolean).map((x) => ({ target: x.target, bytes: x.bytes || 0, error: x.error || null })),
  } : null;
  const readers = PAGES.filter((p) => upstream(p.datasets).has(key)).map((p) => p.key);
  return redact({ ok: true, key, row, parts, report, counters, readers }, cfg, deps.env);
}

// ---------------------------------------------------------------- storage census

/**
 * Counts every object in R2 by its top-level prefix, with Fortune Teller's maps
 * and library broken out. Listing costs a Class A operation per thousand objects,
 * which is why this runs every ten minutes rather than on each refresh.
 */
export async function runCensus(env, { maxPages = 60 } = {}) {
  const by = new Map();
  const lib = new Map();
  const maps = { objects: 0, bytes: 0 };
  let total = { objects: 0, bytes: 0 }, cursor, pages = 0, truncated = false;
  for (;;) {
    const res = await env.DATA.list({ cursor, limit: 1000 });
    pages += 1;
    for (const o of res.objects || []) {
      const top = o.key.includes('/') ? `${o.key.split('/')[0]}/` : o.key;
      const g = by.get(top) || { prefix: top, objects: 0, bytes: 0, newest: null };
      g.objects += 1; g.bytes += o.size || 0;
      const up = o.uploaded instanceof Date ? o.uploaded.toISOString() : String(o.uploaded || '');
      if (up && (!g.newest || up > g.newest)) g.newest = up;
      by.set(top, g);
      total.objects += 1; total.bytes += o.size || 0;
      if (o.key.startsWith('fortune-teller/maps/')) { maps.objects += 1; maps.bytes += o.size || 0; }
      const m = /^fortune-teller\/library\/([^/]+)\//.exec(o.key);
      if (m) lib.set(m[1], (lib.get(m[1]) || 0) + (o.size || 0));
    }
    if (!res.truncated) break;
    if (pages >= maxPages) { truncated = true; break; }
    cursor = res.cursor;
  }
  return {
    at: new Date().toISOString(),
    prefixes: [...by.values()].sort((a, b) => b.bytes - a.bytes),
    total,
    ft: { maps, library: { datasets: lib.size, bytes: [...lib.values()].reduce((a, n) => a + n, 0) } },
    truncated,
    ops: pages,
  };
}

// ---------------------------------------------------------------- hourly reports

/**
 * One status line per subsystem for a finished hour, and the small records the
 * log keeps for its charts (the score timeline's size per week, each day's usage).
 */
export async function hourlyReports(deps, hour) {
  const src = makeSources(deps);
  src.params = {};
  const ctx = await context(src);
  const rows = (await src.hours(48)).filter((r) => r.hour === hour);
  const d = (rows[0] && rows[0].d) || {};
  const lines = [];
  const L = (sub, sev, text) => lines.push({ sub, sev, text: String(text).slice(0, 200) });

  // Datasets
  const c = { fresh: 0, resting: 0, manual: 0, kept: 0, failing: 0, missing: 0, empty: 0 };
  for (const r of ctx.rows) c[r.state] = (c[r.state] || 0) + 1;
  let sweeps = 0, failed = 0;
  for (const t of Object.values(d.ds || {})) { sweeps += t.sweeps || 0; failed += t.failed || 0; }
  const dsSev = worst(ctx.rows.map((r) => r.sev).filter((s) => s !== 'idle').concat(['ok']));
  L('datasets', dsSev, `${ctx.rows.length} datasets: ${c.fresh} fresh, ${c.resting + c.manual} resting or manual${c.kept ? `, ${c.kept} serving a kept copy` : ''}${c.failing ? `, ${c.failing} failing` : ''}${c.missing ? `, ${c.missing} never fetched` : ''}; ${sweeps} refreshes this hour${failed ? `, ${failed} parts failed` : ''}`);

  // ESPN
  let calls = 0, fails = 0; const ms = [];
  for (const h of Object.values(d.hosts || {})) { calls += h.n || 0; fails += h.f || 0; ms.push(...(h.ms || [])); }
  L('espn', ctx.espn.failing ? 'bad' : fails ? 'warn' : 'ok', `${ctx.espn.failing ? 'Cookies refused' : 'Cookies accepted'}; ${calls} calls${ms.length ? `, median ${median(ms)} ms` : ''}${fails ? `, ${fails} failed` : ''}`);

  // Cron
  const ticks = Object.keys(d.ticks || {}).length;
  // An hour the log started partway through is judged only on the minutes it was running.
  const expected = Math.max(1, Math.min(60, Math.round((hour + 3600000 - Math.max(hour, ctx.firstTick || hour)) / 60000)));
  L('cron', ticks === 0 ? 'bad' : expected - ticks >= CRON_MISS_WARN ? 'warn' : 'ok', `${ticks} of ${expected} ticks`);

  // Traffic
  const t = sumReq([{ d }]);
  const byPage = {};
  for (const [k, v] of Object.entries(d.req || {})) { const p = pageForRoute(k) || 'other'; byPage[p] = (byPage[p] || 0) + (v.n || 0); }
  const busiest = Object.entries(byPage).sort((a, b) => b[1] - a[1])[0];
  const errs = t.e + (d.exc || 0);
  L('traffic', errs > 10 ? 'bad' : errs ? 'warn' : 'ok', `${t.n.toLocaleString('en-US')} requests${t.med != null ? `, median ${t.med} ms` : ''}${errs ? `, ${errs} server errors` : ', no server errors'}${busiest && busiest[1] ? `; busiest: ${(pageOf(busiest[0]) || { name: busiest[0] }).name}` : ''}`);

  // Score timeline
  const lsd = await src.digest('live_scoring_digest');
  const week = lsd && lsd.matchupPeriod;
  const meta = {};
  let tl = null;
  if (week && ctx.cfg.season) {
    const r = await timelineSize(deps.env, ctx.cfg.season, week).catch(() => null);
    if (r && r.ok) {
      tl = { bytes: r.keys.rows.bytes, rows: r.keys.rows.count, events: r.keys.events.count };
      const cache = { ...(deps.meta('timelineWeeks', {}) || {}) };
      cache[`${ctx.cfg.season}:${week}`] = tl;
      meta.timelineWeeks = cache;
    }
  }
  const pct = tl ? tl.bytes / BYTE_BUDGET : 0;
  L('timeline', pct > 0.8 ? 'warn' : ctx.window.open ? 'run' : 'ok', `${ctx.window.open ? 'Game window open' : 'No game window'}${tl ? `; week ${week} at ${Math.round(pct * 100)}% of its budget (${fmtB(tl.bytes)})` : ''}`);

  // Fortune Teller
  const p = ctx.ftp;
  L('fortune-teller', p ? ftSev(p.state) : 'idle', p ? `Pipeline ${p.state}${p.state === 'early' && p.opensAfterWeek ? `: opens after week ${p.opensAfterWeek}` : ''}${p.build && p.build.n ? `; team ${Math.min((p.build.team || 0) + 1, p.build.n)} of ${p.build.n}` : ''}` : 'No pipeline check yet');

  // Logos
  const logoTotal = Object.keys(ctx.logoState).length;
  L('logos', ctx.logosFailing.length ? 'warn' : 'ok', logoTotal ? `${logoTotal - ctx.logosFailing.length} of ${logoTotal} current${ctx.logosFailing.length ? `; failing: ${ctx.logosFailing.map((x) => x.name).join(', ')}` : ''}` : 'No logo pass yet');

  // Storage
  const census = deps.meta('census', null);
  L('storage', 'ok', census ? `R2 holds ${fmtB(census.total.bytes)} in ${census.total.objects.toLocaleString('en-US')} objects` : 'No census yet');

  // The log itself
  const evN = deps.q('SELECT COALESCE(SUM(n), 0) AS n FROM events WHERE at >= ? AND at < ?', hour, hour + 3600000)[0].n;
  const m = deps.meter();
  L('log', m.paused ? 'warn' : 'ok', `${evN} entries this hour; store ${fmtB(deps.size())}; ${Math.round(Math.max(m.rows / LOG_BUDGET_REF.rows, m.req / LOG_BUDGET_REF.requests) * 100)}% of today's budget used`);

  // A day that has just ended joins the usage history (sparklines and the month's R2 operations).
  if ((hour + 3600000) % DAY_MS === 0) {
    const dayStart = hour + 3600000 - DAY_MS;
    const u = await usage(src, dayStart);
    const keep = ['worker', 'doReq', 'rowsW', 'kvR', 'kvW', 'r2A', 'r2B'];
    const days = (deps.meta('days', []) || []).filter((x) => x.day !== u.day);
    days.push({ day: u.day, ...Object.fromEntries(keep.map((k) => [k, u[k] || 0])) });
    meta.days = days.slice(-40);
  }
  return { lines, meta };
}

export { utcMidnight };
