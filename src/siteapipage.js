/**
 * Site API: the page's own data route, /apps/site-api/api.
 *
 * Under the tool's own path, so the admin-only unlock cookie reaches it. It needs the league session (the gate
 * in src/index.js has already checked), answers 403 while the tool is hidden and 401 { locked: true } while it
 * is admin-only and locked, and sends no cross-origin permission, so no other website can read a download.
 * Everything comes from the same snapshot the API answers from; Try it goes through here, never through the key,
 * so trying an endpoint never uses up a program's turn.
 */
import { SECTIONS, endpoint, rowsOf, toCsv } from './apisections.js';
import { keyRing, keyState, shortOf, normaliseSiteApi } from './apikey.js';
import { currentSnapshot, currentPace, buildAnswer, keyMeta, aboutBlock, visibleSections, leftOutList, apiSettings, answerParts } from './siteapi.js';
import { paceOf } from './budget.js';
import { snapshotEvery, shapeLive, shapeTimeline, currentGames } from './apibuild.js';
import { ORIGIN_MARK } from './apischema.js';
import { timelineRead } from './timeline.js';
import { liveWeekPayload } from './index.js';
import { countApi } from './sitelog.js';

const NO_STORE = { 'cache-control': 'no-store' };
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...NO_STORE } });
}
const iso = (ms) => (ms == null ? null : new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z'));

/** The key's facts as the page shows them: the key itself only here and only while the API is on. */
async function keyFacts(cfg, now) {
  const sa = normaliseSiteApi(cfg.siteApi);
  const st = keyState(sa, now);
  const ring = await keyRing(cfg.sessionSecret, sa);
  if (!ring) return { on: sa.on, started: false, inAddress: sa.inAddress, interval: sa.interval };
  const prev = st.prev ? { short: shortOf(ring.prev && ring.prev.key), stopsAt: iso(st.prev.stopsAt), replacedAt: sa.replacedAt } : null;
  return {
    on: sa.on, started: true, inAddress: sa.inAddress, interval: sa.interval,
    key: sa.on ? ring.current : null, short: shortOf(ring.current),
    startedAt: sa.startedAt, changesAt: iso(st.changesAt), soon: st.soon, prev,
  };
}

async function sectionValue(snap, key, cfg) {
  if (key === 'standings') return JSON.parse(snap.text(visibleSections(cfg).has('fortuneTeller') ? 's:standings' : 's:standings~nosim') || '[]');
  const t = snap.text('s:' + key);
  return t == null ? null : JSON.parse(t);
}

/** A past week of live or timeline, for the downloads: built once when the week is complete and kept. */
async function pastWeek(env, cfg, ctx, key, week, season) {
  if (key === 'timeline') {
    const r = await timelineRead(env, season, week);
    return shapeTimeline(r.rows || [], week);
  }
  const p = await liveWeekPayload(env, cfg, week, ctx);
  if (!p || !p.body || !p.body.ok) return [];
  const d = p.body.digest;
  return shapeLive(d, currentGames({ ...d, matchupPeriod: week }));
}

function fileResponse(text, type, name) {
  return new Response(text, { headers: { 'content-type': type, 'content-disposition': `attachment; filename="${name.replace(/[^A-Za-z0-9._-]/g, '_')}"`, ...NO_STORE } });
}

/** The route. */
export async function siteApiPageRoute(request, env, cfg0, url, ctx) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return json({ ok: false, error: 'GET only' }, 405);
  const now = Date.now();
  // A page view counts as a request: a replacement that is due happens now, so the page never shows a key that has changed.
  let cfg = cfg0;
  try { cfg = await apiSettings(env, now, { fresh: true }); } catch { cfg = cfg0; }
  const q = url.searchParams;
  // The guides are written against the site's workers.dev address wherever the page is opened (a custom domain, say).
  const origin = cfg.workersOrigin || url.origin;
  const paceQ = await currentPace(env, ctx, { now, games: false });
  // Answered at once from what is stored; a due rebuild runs behind the answer and the page catches up (never a wait here).
  const { snap, games, due } = await currentSnapshot(env, ctx, { now, quiet: paceQ.level === 'quiet', wait: false });
  const pace = paceOf(paceQ.level, games, now);
  const quiet = pace.level === 'quiet' && games;
  const ready = Boolean(snap && snap.index.ready);
  const facts = await keyFacts(cfg, now);

  // Try it: what a program would get, answered from the snapshot through this page, never through the key.
  if (q.has('try')) {
    const ep = endpoint(q.get('try'));
    if (!ep) return json({ ok: false, error: 'unknown endpoint' }, 400);
    if (!facts.on) return json({ ok: false, error: 'The API is switched off.' }, 409);
    if (!ready) return json({ ok: true, status: 503, statusText: 'Service Unavailable', headers: [['content-type', 'application/json; charset=utf-8']],
      text: JSON.stringify({ ok: false, error: { code: 'not_ready', message: 'The league’s data hasn’t been pulled yet.', docs: `${origin}/apps/site-api/#errors` } }) });
    const team = ep.team && /^\d+$/.test(q.get('team') || '') && snap.index.teams.includes(Number(q.get('team'))) ? q.get('team') : '';
    const csv = ep.csv && q.get('format') === 'csv';
    const sa = normaliseSiteApi(cfg.siteApi);
    const ring = await keyRing(cfg.sessionSecret, sa);
    const built = buildAnswer({ snap, cfg, epKey: ep.key, team, csv, logos: q.get('logos') === 'true', pretty: false, pace, games, quiet,
      keyInfo: keyMeta(sa, ring, { state: 'current' }, now), origin });
    const text = new TextDecoder().decode(built.body());
    const headers = Object.entries({ ...built.headers, 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'ETag, Retry-After, X-Stop, X-Suggested-Interval, X-Updated-At, X-Refresh-Every' })
      .map(([k, v]) => [k.toLowerCase(), v]);
    countApi('tried', ep.key);
    return json({ ok: true, status: 200, statusText: 'OK', headers, text, bytes: new TextEncoder().encode(text).length });
  }

  // Downloads and previews: every section as JSON or CSV, no key needed, working while the API is off.
  if (q.has('download') || q.has('preview')) {
    if (!ready) return json({ ok: false, error: 'The league’s data hasn’t been pulled yet.' }, 503);
    const key = q.get('download') || q.get('preview');
    const vis = visibleSections(cfg);
    const sec = SECTIONS.find((s) => s.key === key);
    const out = (k) => Boolean((snap.index.leftOut || {})[k]);
    if (key !== '*' && (!sec || !vis.has(key) || out(key))) return json({ ok: false, error: 'That section isn’t available.' }, 404);
    const week = Number(q.get('week')) || null;
    let value;
    if (key === '*') {
      const about = aboutBlock(snap.index, { pace, games, quiet, keyInfo: { endsIn: facts.short, replacedOn: facts.changesAt ? facts.changesAt.slice(0, 10) : null }, cfg, logos: false });
      value = { about };
      for (const s of SECTIONS) if (s.key !== 'about' && s.key !== 'logos' && vis.has(s.key) && !out(s.key)) value[s.key] = await sectionValue(snap, s.key, cfg);
    } else if (key === 'about') {
      value = aboutBlock(snap.index, { pace, games, quiet, keyInfo: { endsIn: facts.short, replacedOn: facts.changesAt ? facts.changesAt.slice(0, 10) : null }, cfg, logos: true });
    } else if (sec.weeks && week && week !== snap.index.matchupPeriod) {
      if (week < 1 || week > snap.index.matchupPeriod) return json({ ok: false, error: 'That week hasn’t been played yet.' }, 400);
      value = await pastWeek(env, cfg, ctx, key, week, snap.index.season);
    } else value = await sectionValue(snap, key, cfg);
    if (q.has('preview')) {
      const rows = rowsOf(key, value);
      return json({ ok: true, key, value: ['league', 'about', 'fortunePaths'].includes(key) ? value : null, rows: Array.isArray(rows) ? rows.slice(0, 40) : [], total: Array.isArray(rows) ? rows.length : 0 });
    }
    const csv = q.get('format') === 'csv' && (key === '*' ? false : sec.csv);
    countApi('download', `${key}${csv ? '.csv' : ''}`);
    const name = q.get('name') || `${key}.${csv ? 'csv' : 'json'}`;
    return csv ? fileResponse(toCsv(rowsOf(key, value), snap.index.names), 'text/csv; charset=utf-8', name)
      : fileResponse(JSON.stringify(value, null, 2) + '\n', 'application/json; charset=utf-8', name);
  }

  // The description file, with this site's address filled in.
  if (q.has('schema')) {
    if (!ready) return json({ ok: false, error: 'The league’s data hasn’t been pulled yet.' }, 503);
    return new Response((snap.text('x:schema') || '{}').split(ORIGIN_MARK).join(origin), { headers: { 'content-type': 'application/json; charset=utf-8', ...NO_STORE } });
  }

  // The page itself: the key, the status strip's figures, the pace, and the rows its field guides and pictures use.
  const payload = {
    ok: true, ready, origin,
    league: ready ? { name: snap.index.leagueName, season: snap.index.season, week: snap.index.week, matchupPeriod: snap.index.matchupPeriod } : null,
    api: facts,
    pace: { level: pace.level, secs: pace.secs, header: pace.header, note: pace.note, until: pace.until, games, quiet, limit: paceQ.limit || null },
    builtAt: ready ? snap.index.builtAt : null,
    refreshing: Boolean(due),
    buildEvery: snapshotEvery({ games, quiet, draftLive: ready && snap.index.draftLive }),
    teams: ready ? snap.index.teams.map((id) => ({ teamId: id, name: snap.index.names[id] })) : [],
    visible: [...visibleSections(cfg)],
    leftOut: ready ? leftOutList(cfg, snap.index, { logos: true }) : [],
    sizes: {}, schemaBytes: 0, sections: {},
  };
  if (ready) {
    for (const s of SECTIONS) {
      if (s.key === 'about') continue;
      const a = snap.index.at['s:' + (s.key === 'standings' && !payload.visible.includes('fortuneTeller') ? 'standings~nosim' : s.key)];
      payload.sizes[s.key] = a ? a[1] : 0;
      payload.sections[s.key] = (snap.index.sections || {})[s.key] || {};
    }
    payload.schemaBytes = (snap.index.at['x:schema'] || [0, 0])[1];
    // Each endpoint's answer as it stands, measured from the snapshot (all teams; /full without logos).
    const partBytes = (names) => names.reduce((n, x) => n + ((snap.index.at[x] || [0, 0])[1]), 0);
    payload.epSizes = Object.fromEntries(['full', 'scoreboard', 'standings', 'rosters', 'activity'].map((k) => {
      const ap = answerParts(k, { csv: false, team: '', logos: false, cfg, index: snap.index });
      return [k, partBytes(ap.parts) + 600];
    }));
    const part = (n) => { const t = snap.text(n); return t == null ? [] : JSON.parse(t); };
    payload.data = {
      scoreboard: part('e:scoreboard'), rosterRows: part('e:rosters'), activity: part('e:activity'),
      standings: await sectionValue(snap, 'standings', cfg), schedule: part('s:schedule'), freeAgents: part('s:freeAgents'),
      headToHead: payload.visible.includes('headToHead') ? part('s:headToHead') : [],
    };
  }
  return json(payload);
}
