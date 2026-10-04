/**
 * Site Backend: the Site API tab's own panels.
 *
 * Everything here reads: the log's hours (the API's counters and each source's counts), its aliases and daily
 * source totals, the config, and the snapshot's index (a ranged read of its head, shared for 30 seconds). No
 * address, user agent, key or likely member is ever in a payload: sources are named by alias, the key by its last
 * four characters, and a likely member is only ever marked as locked (the Admin Password popup's route answers it).
 */
import { C, B, utcMidnight, sumReq, servedReq, countEvents, latestEvents, hourOf } from './sbcore.js';
import { normaliseSiteApi, keyState, keyRing, shortOf } from './apikey.js';
import { levelFrom, paceOf, LEVELS, LIMIT_WORDS } from './budget.js';
import { hotSources, noMemberWhy, HOT } from './sources.js';
import { SNAPSHOT_KEY, gamesOn, snapshotEvery } from './apibuild.js';
import { ENDPOINTS, SECTIONS } from './apisections.js';
import { JOBS, JOB_NAMES } from './apijobs.js';

const DAY = 86400000;
const P = (id, title, def) => ({ id, title, ...def });
const MAGIC_LEN = 8;
const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10);
const plural = (n, one, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

/* ---- reads, shared within a request ------------------------------------------------------------------ */

function once(src, k, fn) {
  const m = src._api || (src._api = new Map());
  if (!m.has(k)) m.set(k, Promise.resolve().then(fn).catch(() => null));
  return m.get(k);
}

/** The snapshot's index: two ranged reads of the object's head, shared between viewers for 30 seconds. */
export function snapIndex(src) {
  return once(src, 'index', async () => {
    const env = src.env;
    const head = await env.DATA.head(SNAPSHOT_KEY);
    if (!head) return null;
    const hit = src.deps.cache.get('apiIndex');
    if (hit && hit.etag === head.etag) return { ...hit.v, size: head.size };
    const a = await env.DATA.get(SNAPSHOT_KEY, { range: { offset: 0, length: MAGIC_LEN + 4 } });
    if (!a) return null;
    const u = new Uint8Array(await a.arrayBuffer());
    const len = new DataView(u.buffer, u.byteOffset, u.byteLength).getUint32(MAGIC_LEN);
    const b = await env.DATA.get(SNAPSHOT_KEY, { range: { offset: MAGIC_LEN + 4, length: len } });
    if (!b) return null;
    const idx = JSON.parse(new TextDecoder().decode(new Uint8Array(await b.arrayBuffer())));
    const v = { builtAt: idx.builtAt, buildMs: idx.buildMs, read: idx.read || [], refreshed: idx.refreshed || [], refreshesToday: idx.refreshesToday || 0,
      ready: idx.ready, windows: idx.windows || [], draftLive: Boolean(idx.draftLive), parts: Object.keys(idx.at || {}).length, sections: Object.keys(idx.sections || {}).length };
    src.deps.cache.set('apiIndex', { etag: head.etag, v });
    return { ...v, size: head.size };
  });
}

/** The pace now: the level from the day's counts, and whether games are on. */
export function paceNow(src) {
  return once(src, 'pace', async () => {
    const usage = src.deps.pace ? src.deps.pace() : null;
    const lv = levelFrom(usage, src.now);
    const idx = await snapIndex(src);
    const games = Boolean(idx && gamesOn(idx.windows, src.now));
    return { ...paceOf(lv.key, games, src.now), limit: lv.limit, frac: lv.frac, usage };
  });
}

const hoursOf = (src) => src.hours(48);
const todayRows = (rows, now) => rows.filter((r) => r.hour >= utcMidnight(now));
const hourRows = (rows, now) => rows.filter((r) => r.hour === hourOf(now));

/** One API counter group (answered, tooSoon, bad, held, …) summed over rows. */
export function apiSum(rows, kind) {
  const out = {};
  for (const { d } of rows) for (const [k, n] of Object.entries(((d && d.api) || {})[kind] || {})) out[k] = (out[k] || 0) + n;
  return out;
}
const total = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);

/** Every alias by fingerprint, as the log numbered them. */
async function aliasMap(src) {
  return once(src, 'aliases', () => {
    const a = src.deps.meta('aliases', {}) || {};
    const out = {};
    for (const [id, x] of Object.entries(a)) out[id] = { name: `${x.f}:${x.n}`, family: x.f, first: x.first, last: x.last, days: x.days, kind: x.k || null };
    return out;
  });
}
const matchesOf = (src) => once(src, 'matches', () => src.deps.meta('matches', {}) || {});
const srcDays = (src) => once(src, 'srcdays', () => src.deps.meta('srcdays', {}) || {});

/** The day's Worker requests (every request served, recorded or not), for shares of the day. */
const dayTotal = (rows, now) => servedReq(todayRows(rows, now));

/** High activity, as the panel and Needs attention show it: alias, figures, and the likely member locked. */
export async function hotList(src) {
  return once(src, 'hot', async () => {
    const rows = await hoursOf(src);
    const pace = await paceNow(src);
    const list = hotSources({ hours: rows, dayTotal: dayTotal(rows, src.now), paceSecs: pace.secs, now: src.now });
    const aliases = await aliasMap(src);
    const matches = await matchesOf(src);
    const you = src.facts.you || null;
    return list.map((h) => {
      const a = aliases[h.id] || {};
      const kind = h.kind || a.kind || 'unknown';
      const has = Object.keys(matches[h.id] || {}).length > 0;
      return { ...h, alias: a.name || `${h.family}:?`, you: Boolean(you && you === h.id), kind, member: has ? 'locked' : null, memberWhy: has ? null : noMemberWhy(kind) };
    });
  });
}

/* ---- words ---------------------------------------------------------------------------------------------- */

const KIND_WORD = { 'Google Sheets': 'a Google Sheet', 'Apps Script': 'an Apps Script project', Excel: 'an Excel workbook', 'Home Assistant': 'a Home Assistant setup',
  Python: 'a Python script', PowerShell: 'a PowerShell script', curl: 'a curl script', 'iPhone Shortcuts': 'an iPhone shortcut', 'an Android app': 'an Android app',
  JavaScript: 'a JavaScript program', 'a chat bot': 'a chat bot', 'a browser': 'a browser', unknown: 'an unknown program' };
export const kindWord = (k) => KIND_WORD[k] || KIND_WORD.unknown;
const EP_PATH = Object.fromEntries(ENDPOINTS.map((e) => [e.key, e.path]));
function asksWords(ep, pages) {
  const list = Object.entries(ep || {}).sort((a, b) => b[1] - a[1]);
  const n = list.reduce((a, [, v]) => a + v, 0);
  const parts = list.slice(0, 3).map(([k, v], i) => `${EP_PATH[k] || `/${k}`}${i === 0 && n && list.length > 1 ? ` (${Math.round((v / n) * 100)}%)` : ''}`);
  if (pages) parts.push(`${plural(pages, 'page visit')}`);
  return parts.join(', ') || 'the site’s pages';
}
function keyWords(keys, short) {
  const k = Object.entries(keys || {}).sort((a, b) => b[1] - a[1]).map(([x]) => x);
  if (!k.length) return 'none sent';
  const w = { current: `current (ending ${short || '····'})`, old: 'an old key', none: 'none', wrong: 'a wrong key' };
  return k.map((x) => w[x] || x).join(', ');
}
function paceWhy(p) {
  if (p.level === 'resting') return `${LIMIT_WORDS[p.limit] || 'A daily limit'} reached the day’s limit`;
  if (p.level === 'busy' || p.level === 'verybusy') return `${LIMIT_WORDS[p.limit] || 'A daily limit'} at ${Math.round((p.frac || 0) * 100)}% of the day (the ${p.level === 'busy' ? 'Economy' : 'Protect'} line)`;
  if (p.level === 'quiet') return 'Every daily limit under 30% and on course to stay under 60%';
  return `Every limit under 60%${p.limit ? `; the busiest, ${LIMIT_WORDS[p.limit] || p.limit}, at ${Math.round((p.frac || 0) * 100)}%` : ''}`;
}
const paceShort = (p) => (p.secs == null ? 'resting until 00:00 UTC' : p.secs < 60 ? `every ${p.secs} seconds` : p.secs === 60 ? 'once a minute' : `once every ${p.secs / 60} minutes`);

/* ---- the panels -------------------------------------------------------------------------------------------- */

async function keyFacts(src) {
  return once(src, 'key', async () => {
    const cfg = await src.cfg();
    const sa = normaliseSiteApi(cfg.siteApi);
    const st = keyState(sa, src.now);
    const ring = cfg.sessionSecret && sa.gen ? await keyRing(cfg.sessionSecret, sa) : null;
    return { sa, st, short: ring ? shortOf(ring.current) : null, prevShort: ring && ring.prev ? shortOf(ring.prev.key) : null };
  });
}

export const SITE_API_PANELS = [
  P('a-hot', 'High activity', {
    live: true,
    sub: 'Every address asking far more than the pace allows, by alias only. Likely members are locked behind the Admin Password.',
    sum: async (src) => {
      const list = await hotList(src);
      const heavy = list.filter((h) => h.level === 'heavy').length;
      return [list.length ? (heavy ? 'bad' : 'warn') : 'ok', list.length ? `${plural(list.length, 'source')}: ${heavy} heavy, ${list.length - heavy} watch` : 'no source over the thresholds'];
    },
    body: async (src) => {
      const list = await hotList(src);
      const { short } = await keyFacts(src);
      const pace = await paceNow(src);
      const items = list.map((h) => ({
        alias: h.alias, family: h.family, you: h.you, level: h.level, kind: kindWord(h.kind), names: Object.keys(h.names || {}).slice(0, 6),
        h1: h.h1, d1: h.d1, share: h.share, overPace: h.overPace, refused: h.refused, kept: h.kept > 0,
        asks: asksWords(h.ep, h.pages), key: keyWords(h.keys, short), started: h.started ? new Date(h.started).toISOString() : null,
        member: h.member, memberWhy: h.memberWhy, bars: h.bars, refusedBars: h.refusedBars,
      }));
      return [items.length ? { t: 'hot', items } : B.empty('No address is asking far more than the pace allows. Scripts built from the Site API page’s guides keep to it.'),
        B.note(`Thresholds: over twice the pace for an hour (now ${paceShort(pace)}), over ${HOT.DAY_N.toLocaleString('en-US')} requests in 24 hours, over 5% of the day, or asking on after too_soon. Heavy above ${HOT.HEAVY_N.toLocaleString('en-US')} or 10%. A browser’s own page traffic is the site’s polling and is counted on the Overview instead. Likely members are shown for this visit only; leaving the page locks them again.`)];
    },
  }),
  P('a-status', 'API status', {
    sum: async (src) => { const { sa, short } = await keyFacts(src); return [sa.on ? 'ok' : 'idle', sa.on ? `on${short ? ` · key ending ${short}` : ''}` : 'off']; },
    body: async (src) => {
      const { sa, st, short, prevShort } = await keyFacts(src);
      const iso = (ms) => (ms == null ? null : new Date(ms).toISOString());
      return [B.kv([['API', C.pill(sa.on ? 'ok' : 'idle', sa.on ? 'on' : 'off')],
        ['Key', short ? C.txt(`ending ${short}`, 'short name only') : C.txt('starts on the first request')],
        ['Started', sa.startedAt ? C.at(sa.startedAt) : '—'],
        ['Changes', st.changesAt ? C.at(iso(st.changesAt), st.soon ? 'within 14 days: every answer says so' : null) : '—'],
        ['Grace period', st.prev ? C.mix(C.txt(`old key ending ${prevShort || '····'} until`), C.at(iso(st.prev.stopsAt))) : C.txt('none')],
        ['Replaced', C.txt(sa.interval === 'season' ? 'at Season End (1 August, UTC)' : `every ${sa.interval} days`)],
        ['Key in the address', C.txt(sa.inAddress ? 'allowed' : 'refused: header only')],
        sa.replacedAt ? ['Last replaced', C.mix(C.at(sa.replacedAt), C.txt({ auto: 'automatically', manual: 'by hand', stop: 'by hand, old key stopped', season: 'at Season End', password: 'with the League Password' }[sa.replacedHow] || ''))] : null]),
      B.note('Never the key: it is shown only on the Site API page.')];
    },
  }),
  P('a-pace', 'Pace', {
    live: true,
    sub: 'The suggested pace, as programs receive it in X-Suggested-Interval',
    sum: async (src) => { const p = await paceNow(src); return [p.level === 'quiet' || p.level === 'normal' ? 'ok' : p.level === 'resting' ? 'bad' : 'warn', `${paceShort(p)} · ${p.name.toLowerCase()}`]; },
    body: async (src) => {
      const p = await paceNow(src);
      const rows = await hoursOf(src);
      const today = todayRows(rows, src.now);
      const told = apiSum(today, 'tooSoon');
      const levels = [];
      const h0 = hourOf(src.now) - 23 * 3600000;
      for (let i = 0; i < 24; i++) { const r = rows.find((x) => x.hour === h0 + i * 3600000); levels.push(r && r.d && r.d.lv ? r.d.lv : null); }
      return [B.kv([['Now', C.txt(paceShort(p))], ['Why', C.txt(paceWhy(p))], ['Games', C.txt(p.games ? 'on now' : 'none on')],
        ['Told pace_changed today', (() => {
          const all = (told.pace_changed || 0) + (told['pace_changed.address'] || 0), addr = told['pace_changed.address'] || 0;
          return C.n(all, !addr ? (all ? 'when the site slowed' : null) : addr === all ? 'all for their address’s four rounds' : `${addr} of them for their address’s four rounds`);
        })()]]),
      B.sub('The pace through the last 24 hours'), { t: 'pacechart', levels, names: LEVELS.map((l) => [l.key, l.name]) },
      B.note('Each hour shows the slowest level it reached. The level follows the site’s own counts of each free daily limit, as the Overview’s usage panel shows them.')];
    },
  }),
  P('a-snap', 'Snapshot', {
    live: true,
    sub: 'One stored object per build; every answer is a slice of it',
    sum: async (src) => {
      const i = await snapIndex(src);
      const fails = countEvents(src, utcMidnight(src.now), "AND kind = 'change' AND text LIKE 'Site API''s snapshot failed%'").n;
      return i ? [fails ? 'warn' : 'ok', `built ${agoWords(src.now - Date.parse(i.builtAt))}`] : ['idle', 'not built yet'];
    },
    body: async (src) => {
      const i = await snapIndex(src);
      if (!i) return [B.empty('Not built yet. The first API request, or the first visit to the Site API page, builds it.')];
      const p = await paceNow(src);
      const every = snapshotEvery({ games: p.games, quiet: p.level === 'quiet' && p.games, draftLive: i.draftLive });
      const due = Date.parse(i.builtAt) + every * 1000;
      const fails = latestEvents(src, "AND kind = 'change' AND text LIKE 'Site API''s snapshot failed%'", 1);
      const failsToday = countEvents(src, utcMidnight(src.now), "AND kind = 'change' AND text LIKE 'Site API''s snapshot failed%'").n;
      return [B.kv([['Built', C.time(i.builtAt)], ['Took', C.dur(i.buildMs || 0, 'inside the dataset coordinator')], ['Size', C.bytes(i.size, `${i.parts} parts, ${i.sections} sections`)],
        ['Last rebuild read', i.read.length ? C.txt(plural(i.read.length, 'source'), i.read.slice(0, 5).join(', ') + (i.read.length > 5 ? `, and ${i.read.length - 5} more` : '')) : C.txt('nothing new: every section carried over')],
        ['Refreshed for it', i.refreshed.length ? C.txt(i.refreshed.join(', ')) : C.txt('nothing')],
        ['Source refreshes today', C.n(i.refreshesToday, 'of 500 a day')],
        ['Next can be due', due > src.now ? C.time(new Date(due).toISOString(), `every ${every >= 60 ? `${every / 60} min` : `${every} s`} now`) : C.txt('now: the next request asks for it')],
        ['Failures', failsToday ? C.mix(C.txt(`${failsToday} today`, null, 'bad'), fails[0] ? C.time(new Date(fails[0].at).toISOString()) : null) : C.txt('none today')]])];
    },
  }),
  P('a-window', 'Rate window', {
    live: true,
    sub: 'One round of up to 5 requests within 10 s per interval, opening 5 s early; kept per program by its pace record',
    sum: async (src) => {
      const hr = hourRows(await hoursOf(src), src.now);
      return [null, `${total(apiSum(hr, 'answered')).toLocaleString('en-US')} answers this hour · ${total(apiSum(hr, 'tooSoon')).toLocaleString('en-US')} too_soon`];
    },
    body: async (src) => {
      const rows = await hoursOf(src);
      const hr = hourRows(rows, src.now), today = todayRows(rows, src.now);
      const ts = apiSum(hr, 'tooSoon');
      const fast = ts.too_fast || 0, changed = (ts.pace_changed || 0) + (ts['pace_changed.address'] || 0);
      const heldToday = apiSum(today, 'held'), heldHour = apiSum(hr, 'held');
      const open = apiSum(today, 'open');
      return [B.kv([['Answers, this hour', C.n(total(apiSum(hr, 'answered')))], ['too_soon, this hour', C.n(fast + changed, `${fast} too_fast, ${changed} pace_changed`)],
        ['Answered inside the 5 s grace', C.n(total(apiSum(hr, 'grace')), 'this hour')], ['Sheets refusals sent as a cell', C.n(total(apiSum(today, 'sheets')), 'today')],
        ['Held, this hour', C.n(total(heldHour))], ['Held today', C.n(total(heldToday), `about ${Math.round((total(heldToday) * 20) / 60)} minutes in all`)],
        ['Pace records', total(open) ? C.mix(C.dot('warn'), C.txt(`${total(open)} decided from memory today`, 'the pace record could not be reached; answered, never refused')) : C.mix(C.dot('ok'), C.txt('answering'))]])];
    },
  }),
  P('a-sources', 'Sources', {
    sub: 'Every address the API has seen, by alias only. Yours is marked You.',
    sum: async (src) => { const t = await sourceRows(src); return [null, `${plural(t.rows.length, 'address', 'addresses')} seen this week`]; },
    body: async (src) => {
      const t = await sourceRows(src);
      if (!t.rows.length) return [B.empty('No program has asked the API this week.')];
      return [B.table([['Alias'], ['First seen'], ['Last seen'], ['Names'], ['Kind'], ['Answers today', 'n'], ['Refusals', 'n'], ['Held', 'n'], ['This week', 'n']],
        t.rows.map((r) => B.row([r.you ? C.mix(C.code(r.alias), C.pill('ok', 'You')) : C.code(r.alias), r.first ? C.at(r.first) : '—', r.last ? C.time(r.last) : '—',
          r.names.length ? C.txt(r.names.join(', ')) : '—', C.txt(r.kind), C.n(r.today), C.n(r.refused), C.n(r.held), C.n(r.week)], r.hot ? 'warn' : null))),
      B.note('Aliases are keyed fingerprints of each address, numbered in the order first seen this season. Nobody, whoever administers this site included, can turn one back into an address.')];
    },
  }),
  P('a-use', 'Use', {
    sum: async (src) => [null, `${total(apiSum(todayRows(await hoursOf(src), src.now), 'answered')).toLocaleString('en-US')} answers today`],
    body: async (src) => {
      const rows = await hoursOf(src);
      const today = todayRows(rows, src.now);
      const ans = apiSum(today, 'answered');
      const h0 = hourOf(src.now) - 23 * 3600000;
      const byHour = [];
      for (let i = 0; i < 24; i++) { const r = rows.find((x) => x.hour === h0 + i * 3600000); byHour.push(r ? total(((r.d || {}).api || {}).answered) : 0); }
      const eps = ENDPOINTS.map((e) => ({ e, json: ans[e.key] || 0, csv: ans[`${e.key}.csv`] || 0 })).map((x) => ({ ...x, n: x.json + x.csv })).sort((a, b) => b.n - a.n);
      const max = Math.max(1, ...eps.map((x) => x.n));
      const by = apiSum(today, 'by');
      const dl = apiSum(today, 'download');
      const tried = apiSum(today, 'tried');
      const dlWords = Object.entries(dl).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => `${k === '*' ? 'everything' : k} ${n}`).join(', ');
      return [B.sub('Answers by hour, last 24 hours'), { t: 'hbars', v: byHour },
        B.sub('By endpoint, today'), B.bars(eps.map((x) => ({ l: C.mix(C.code(x.e.path), C.txt(x.e.csv ? `JSON ${x.json} · CSV ${x.csv}` : 'JSON')), v: x.n, max, r: C.n(x.n) }))),
        B.kv([['Header or address', total(by) ? C.txt(`${Math.round(((by.header || 0) / total(by)) * 100)}% header · ${Math.round(((by.address || 0) / total(by)) * 100)}% address`) : '—'],
          ['304 Not Modified', C.n(total(apiSum(today, 'notModified')))], ['Downloads', C.n(total(dl), dlWords || null)], ['Tried on the page', C.n(total(tried), 'never uses a program’s turn')]])];
    },
  }),
  P('a-jobs', 'Jobs', {
    sub: 'Every job seen in the last 7 days, read from the name each example sends, with its requests today. Programs that send no name, or a name the page never gave out, count as Unknown, with the name beneath for reference.',
    sum: async (src) => { const j = await jobRows(src); return [null, `${j.activeJobs} of ${JOBS.length} jobs asked today · Unknown ${j.unknownToday.toLocaleString('en-US')}`]; },
    body: async (src) => {
      const j = await jobRows(src);
      const out = [];
      if (!j.rows.length) out.push(B.empty('No program has asked the API in the last 7 days.'));
      else {
        out.push(B.table([['Job'], ['Name'], ['Programs', 'n'], ['Requests today', 'n'], ['Refused', 'n'], ['Last seen']], j.rows.map((r) => B.row([
          r.unknown ? C.txt('Unknown', r.name ? `named ${r.name}, not one of the page’s jobs` : 'no name sent') : C.txt(r.title, r.where),
          r.unknown ? '—' : C.code(r.name), C.n(r.programs), C.n(r.today), C.n(r.refused), r.last ? C.time(new Date(r.last).toISOString()) : '—'], r.today ? null : 'dim'))));
      }
      out.push(B.sub(`Not seen in the last 7 days: ${plural(j.idle.length, 'job')}`));
      if (j.idle.length) out.push(B.list(j.idle));
      out.push(B.note('Two jobs that make one shared request (the activity bot on Python and on Discord or Slack; Home Assistant’s two sensors) count once, under the name they send.'));
      return out;
    },
  }),
  P('a-refusals', 'Refusals', {
    sub: 'Bad-key refusals by reason each hour. A rising key_invalid count points to an old script or someone guessing.',
    sum: async (src) => { const b = apiSum(todayRows(await hoursOf(src), src.now), 'bad'); const n = (b.key_missing || 0) + (b.key_invalid || 0) + (b.key_replaced || 0); return [null, `${plural(n, 'bad-key refusal')} today`]; },
    body: async (src) => {
      const rows = (await hoursOf(src)).filter((r) => r.hour >= hourOf(src.now) - 23 * 3600000).slice().reverse();
      const aliases = await aliasMap(src);
      const out = [];
      for (const { hour, d } of rows) {
        const b = ((d || {}).api || {}).bad || {};
        const n = (b.key_missing || 0) + (b.key_invalid || 0) + (b.key_replaced || 0);
        if (!n) continue;
        let most = null, mostN = 0;
        for (const [id, s] of Object.entries((d || {}).src || {})) {
          const k = s.key || {}; const m = (k.none || 0) + (k.wrong || 0) + (k.old || 0);
          if (m > mostN && aliases[id]) { most = aliases[id].name; mostN = m; }
        }
        out.push(B.row([C.at(new Date(hour).toISOString()), C.n(b.key_missing || 0), C.n(b.key_invalid || 0), C.n(b.key_replaced || 0), most ? C.code(most) : '—']));
      }
      return out.length ? [B.table([['Hour'], ['key_missing', 'n'], ['key_invalid', 'n'], ['key_replaced', 'n'], ['Most from']], out)] : [B.empty('No bad-key refusals in the last 24 hours.')];
    },
  }),
  P('a-oldkey', 'Old key still in use', {
    sub: 'During a grace period: whether scripts were updated',
    sum: async (src) => {
      const { st } = await keyFacts(src);
      if (!st.prev) return [null, 'no replaced key in its grace period'];
      const n = total(apiSum(todayRows(await hoursOf(src), src.now), 'oldKey'));
      return [n ? 'warn' : 'ok', `${plural(n, 'answer')} to it today`];
    },
    body: async (src) => {
      const { st, prevShort } = await keyFacts(src);
      if (!st.prev) return [B.empty('No replaced key is in its grace period.')];
      const rows = await hoursOf(src);
      const n = total(apiSum(todayRows(rows, src.now), 'oldKey'));
      const aliases = await aliasMap(src);
      let last = null, from = null;
      for (const { hour, d } of rows) for (const [id, s] of Object.entries((d || {}).src || {})) if ((s.key || {}).old && (!last || hour >= last)) { last = hour; from = aliases[id] ? aliases[id].name : null; }
      return [B.kv([['Old key', C.txt(`ending ${prevShort || '····'}`)], ['Stops', C.at(new Date(st.prev.stopsAt).toISOString())], ['Answers to it today', C.n(n)],
        ['Last', last ? C.mix(C.time(new Date(last).toISOString(), 'that hour'), from ? C.code(from) : null) : C.txt('not used since it was replaced')]])];
    },
  }),
  P('a-cost', 'Cost', {
    sub: 'What the API and the downloads caused today, counted by the site',
    sum: async () => [null, 'what the API and the downloads caused today'],
    body: async (src) => {
      const rows = todayRows(await hoursOf(src), src.now);
      const api = sumReq(rows, (k) => / \/api\/v1(\/|$)/.test(k)).n;
      const page = sumReq(rows, (k) => / \/apps\/site-api\//.test(k)).n;
      const answered = total(apiSum(rows, 'answered'));
      const i = await snapIndex(src);
      return [B.table([['Limit'], ['Today', 'n'], ['From']], [
        B.row([C.txt('Worker requests'), C.n(api + page), C.txt(`the API ${api.toLocaleString('en-US')} · the page, its downloads and Try it ${page.toLocaleString('en-US')}`)]),
        B.row([C.txt('Object requests'), C.n(answered), C.txt('one per answered request (the pace record); none for a refusal inside a known window')]),
        B.row([C.txt('Rows written'), C.n(answered), C.txt('the pace record')]),
        B.row([C.txt('KV reads'), C.n(0), C.txt('settings held 60 s per isolate, read with the site’s own')]),
        B.row([C.txt('R2 reads'), C.txt('a few', 'estimate'), C.txt('one per isolate per minute while asked, and each rebuild’s changed sources')]),
        B.row([C.txt('R2 writes'), C.txt(i ? 'one per rebuild' : '—'), C.txt('the snapshot')]),
      ]), B.note('Worker requests and answers are counted; the storage figures follow from them. Every request counts the moment it arrives, answered or refused.')];
    },
  }),
];

/* ---- tables built from the log's hours and daily totals ----------------------------------------------------- */

async function sourceRows(src) {
  return once(src, 'sources', async () => {
    const days = await srcDays(src);
    const aliases = await aliasMap(src);
    const hot = new Set((await hotList(src)).map((h) => h.id));
    const today = dayKey(src.now);
    const weekFrom = dayKey(src.now - 6 * DAY);
    const by = new Map();
    for (const [dk, day] of Object.entries(days)) {
      if (dk < weekFrom) continue;
      for (const [id, t] of Object.entries(day)) {
        if (!(t.api > 0)) continue;   // Sources lists addresses the API has seen
        const r = by.get(id) || { id, week: 0, today: 0, refused: 0, held: 0, names: new Set(), kind: null, last: 0 };
        r.week += t.api || 0;
        if (dk === today) { r.today += t.api || 0; r.refused += Object.values(t.rf || {}).reduce((a, b) => a + b, 0); r.held += t.hd || 0; }
        for (const nm of Object.keys(t.nm || {})) r.names.add(nm);
        if (t.k) r.kind = t.k;
        r.last = Math.max(r.last, t.last || 0);
        by.set(id, r);
      }
    }
    const you = src.facts.you || null;
    const rows = [...by.values()].map((r) => {
      const a = aliases[r.id] || {};
      return { alias: a.name || '?', you: Boolean(you && you === r.id), first: a.first ? new Date(a.first).toISOString() : null, last: r.last ? new Date(r.last).toISOString() : null,
        names: [...r.names].slice(0, 6), kind: kindWord(r.kind || a.kind || 'unknown').replace(/^an? /, ''), today: r.today, refused: r.refused, held: r.held, week: r.week, hot: hot.has(r.id) };
    }).sort((a, b) => b.today - a.today || b.week - a.week);
    return { rows };
  });
}

async function jobRows(src) {
  return once(src, 'jobs', async () => {
    const days = await srcDays(src);
    const today = dayKey(src.now);
    const weekFrom = dayKey(src.now - 6 * DAY);
    const jobs = Object.fromEntries(JOBS.map(([pk, pn, jk, jt]) => [`${pk}.${jk}`, { platform: pn, title: jt }]));
    const by = new Map();
    let unknownToday = 0;
    for (const [dk, day] of Object.entries(days)) {
      if (dk < weekFrom) continue;
      for (const [id, t] of Object.entries(day)) {
        if (!(t.api > 0)) continue;
        const named = Object.values(t.nm || {}).reduce((a, b) => a + b, 0);
        const entries = Object.entries(t.nm || {});
        if ((t.api || 0) > named) entries.push(['', (t.api || 0) - named]);
        for (const [name, n] of entries) {
          const known = Boolean(name && JOB_NAMES[name]);
          const key = known ? name : `?${name}`;
          const r = by.get(key) || { name, known, programs: new Set(), today: 0, refused: 0, last: 0 };
          r.programs.add(id);
          if (dk === today) { r.today += n; r.refused += (t.nr || {})[name] || 0; if (!known) unknownToday += n; }
          r.last = Math.max(r.last, t.last || 0);
          by.set(key, r);
        }
      }
    }
    const inUse = new Set();
    const rows = [...by.values()].map((r) => {
      if (!r.known) return { unknown: true, name: r.name || null, programs: r.programs.size, today: r.today, refused: r.refused, last: r.last };
      const uses = JOB_NAMES[r.name].map((k) => jobs[k]).filter(Boolean);
      if (r.today) for (const k of JOB_NAMES[r.name]) inUse.add(k);
      for (const k of JOB_NAMES[r.name]) inUse.add(`seen:${k}`);
      return { unknown: false, name: r.name, title: [...new Set(uses.map((u) => u.title))].join(' · '), where: [...new Set(uses.map((u) => u.platform))].join(' · '),
        programs: r.programs.size, today: r.today, refused: r.refused, last: r.last };
    }).sort((a, b) => (a.unknown === b.unknown ? b.today - a.today || b.last - a.last : a.unknown ? 1 : -1));
    const activeJobs = JOBS.filter(([pk, , jk]) => inUse.has(`${pk}.${jk}`)).length;
    const idle = JOBS.filter(([pk, , jk]) => !inUse.has(`seen:${pk}.${jk}`)).map(([, pn, , jt]) => `${pn}: ${jt}`);
    return { rows, activeJobs, idle, unknownToday };
  });
}

function agoWords(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/* ---- the Overview ---------------------------------------------------------------------------------------------- */

/** Needs attention: sources in High activity (likely member locked), an old key on its grace's last day, a snapshot failing. */
export async function apiReasons(src) {
  const out = [];
  try {
    const rows = await hoursOf(src);
    const total = dayTotal(rows, src.now);
    // Only a Heavy source needs whoever administers the site; a Watch one waits on the Site API tab.
    for (const h of (await hotList(src)).filter((x) => x.level === 'heavy').slice(0, 3)) {
      const share = total ? Math.round((h.today / total) * 100) : 0;
      out.push({ s: 'warn', text: `${h.alias} ${share >= 5 ? `made ${share}% of today’s requests` : `asked ${h.d1.toLocaleString('en-US')} times in 24 hours`}: ${kindWord(h.kind)}${h.member ? ',' : `, ${h.memberWhy.split(':')[0].toLowerCase()}`}`,
        lock: h.member ? h.alias : null, tab: 'site-api' });
    }
    const { st, prevShort } = await keyFacts(src);
    if (st.prev && st.prev.stopsAt - src.now < DAY) {
      const used = apiSum(todayRows(rows, src.now), 'oldKey').answered || 0;
      if (used) out.push({ s: 'warn', text: `The old Site API key ending ${prevShort || '····'} stops within a day and still answered ${plural(used, 'request')} today`, tab: 'site-api' });
    }
    const fails = countEvents(src, src.now - 3 * 3600000, "AND kind = 'change' AND text LIKE 'Site API''s snapshot failed%'").n;
    if (fails) out.push({ s: 'bad', text: 'Site API’s snapshot failed to build in the last 3 hours: the API is answering from the last good one', tab: 'site-api' });
  } catch { /* the Overview shows what it can */ }
  return out;
}
