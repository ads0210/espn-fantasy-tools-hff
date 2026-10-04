/**
 * Site API page: every section as the design sample drew it.
 *
 * The page's words, layout and interactions are the design sample's (the authority on look and words), carried
 * over as they were reviewed. The sample's own state and scenario menu are replaced by the live payload from
 * /apps/site-api/api; Try it, previews, the description file and downloads ask that route. SiteApi.jsx builds
 * the header, the endpoint card and the team pickers in React (the site's shared components) and hands every
 * other section to the renderers here, which draw into their own containers and answer clicks through one
 * delegated handler.
 */
/* eslint-disable */
import { SECTIONS, ENDPOINTS as REG_ENDPOINTS, SECTION_TOOL, MEANING, NULLTYPE, ALWAYS_NULLABLE, typeOf, fieldGuide, flatten, describe, rowsOf, toCsv, refreshOf as regRefreshOf } from "../../src/apisections.js";
import { rateDecide, RW } from "../../src/pacerecord.js";
import { attachVScroll, ensureVScroll } from "../../src/vscroll.js";
import { wireScrollers, xyScrollHtml, hScrollHtml } from "../../src/hscroll.js";
import { logEvent } from "../shared/sitelog.js";
import { makeGuides } from "./guides.js";

var DAY = 86400000, MIN = 60000;
var P = null;                 // the payload from /apps/site-api/api
var BASE = '', API = '', LEAGUE = '', SEASON = null, WEEK = null;
var D = {};
var TEAMS = [];
var PLATFORMS = [], PLAT_KIND = {}, RUNS = {}, GL = {}, jobText = null, hlCode = null, gctx = null, jobNames = null;
var TOOLS = { live: 'Live Matchups', timeline: 'Live Matchups', history: 'Hall of Fame', records: 'Hall of Fame', teamHistory: 'Hall of Fame',
  headToHead: 'Hall of Fame', fortuneTeller: 'Fortune Teller', fortuneOdds: 'Fortune Teller', fortuneFinishes: 'Fortune Teller',
  fortuneGames: 'Fortune Teller', fortunePaths: 'Fortune Teller', tradeAnalysis: 'Trade Analyzer', draftOrder: 'Draft Helper' };
var HOOKS = { onChange: function () {}, toast: function () {} };

function readCookie(name) {
  try { var m = new RegExp('(?:^|; )' + name + '=([^;]*)').exec(document.cookie); return m ? decodeURIComponent(m[1]) : ''; } catch (e) { return ''; }
}

/* ---- the page's state: what the reader has opened, and the payload behind it ------------------------------- */
export var S = {
  keyShown: false, ep: 'scoreboard', epTeam: {}, epFormat: {}, logos: false, tryRound: null, tries: {}, view3: {},
  guideTeam: Number(readCookie('eft_team')) || null, openPlats: {}, openJobs: {}, openField: {}, openErr: {}, schemaOpen: false, schemaText: null,
  dlWeek: {}, dlOpen: null, previews: {}, sim: { prog: 'reads', site: 'busy' }, trying: false,
};
Object.defineProperties(S, {
  apiOn: { get: function () { return Boolean(P && P.api && P.api.on); } },
  dataReady: { get: function () { return Boolean(P && P.ready); } },
  games: { get: function () { return Boolean(P && P.pace && P.pace.games); } },
  load: { get: function () { return (P && P.pace && P.pace.level) || 'normal'; } },
  inAddress: { get: function () { return !P || !P.api || P.api.inAddress !== false; } },
  interval: { get: function () { return (P && P.api && P.api.interval) || 90; } },
  tz: { get: function () { var z = readCookie('eft_tz'); return z && z !== 'device' ? z : ''; } },
});

/** Take a payload from the page's route: the key, the pace, the rows the field guides and pictures read. */
export function setPayload(p, hooks) {
  P = p;
  if (hooks) HOOKS = Object.assign(HOOKS, hooks);
  BASE = p.origin; API = BASE + '/api/v1';
  LEAGUE = (p.league && p.league.name) || 'League'; SEASON = p.league && p.league.season; WEEK = p.league && p.league.matchupPeriod;
  var d = p.data || {};
  D = { scoreboard: d.scoreboard || [], _rosterRows: d.rosterRows || [], _activity: d.activity || [], standings: d.standings || [],
    schedule: d.schedule || [], freeAgents: d.freeAgents || [], headToHead: d.headToHead || [] };
  TEAMS = (p.teams || []).map(function (t) { return { teamId: t.teamId, name: t.name, logo: '/api/logo/' + t.teamId }; });
  if (!S.guideTeam || !TEAMS.some(function (t) { return t.teamId === S.guideTeam; })) S.guideTeam = TEAMS.length ? TEAMS[0].teamId : null;
  if (WEEK) { if (!S.dlWeek.live) S.dlWeek.live = WEEK; if (!S.dlWeek.timeline) S.dlWeek.timeline = WEEK; }
  var G = makeGuides({ API: API, D: D, S: S, LEAGUE: LEAGUE, WEEK: WEEK, esc: esc, iso: iso, stamp: stamp, dayOf: dayOf, timeOf: timeOf, dateOf: dateOf,
    durWords: durWords, keyInExamples: keyInExamples, pace: pace, teamName: teamName, standingsNow: standingsNow, toCsv: toCsv, num: num });
  PLATFORMS = G.PLATFORMS; PLAT_KIND = G.PLAT_KIND; RUNS = G.RUNS; GL = G.GL; jobText = G.jobText; hlCode = G.hlCode; gctx = G.gctx; jobNames = G.jobNames;
  return G;
}
export function payload() { return P; }
/** An endpoint's answer size as the snapshot has it now, or null before the data is pulled. */
export function epSize(key) { var n = P && P.epSizes && P.epSizes[key]; return n ? fmtBytes(n) : null; }

function teamName(id) { var t = TEAMS.filter(function (x) { return x.teamId === +id; })[0]; return t ? t.name : ''; }
function teamLogo(id) { var t = TEAMS.filter(function (x) { return x.teamId === +id; })[0]; return t ? t.logo : null; }
export function teams() { return TEAMS; }
function standingsNow() { return D.standings; }
function deviceTz() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; } }
function zone() { return S.tz || deviceTz(); }

/* ---- the key ------------------------------------------------------------------------------------------------ */
function keyInfo() {
  var a = (P && P.api) || {};
  var k = a.key || 'eft_' + '•'.repeat(36) + (a.short || '····');
  return {
    key: k, short: a.short || k.slice(-4), started: a.startedAt ? Date.parse(a.startedAt) : Date.now(),
    changes: a.changesAt ? Date.parse(a.changesAt) : Date.now(), soon: Boolean(a.soon),
    prev: a.prev ? { short: a.prev.short, stops: Date.parse(a.prev.stopsAt), replacedAt: a.prev.replacedAt ? Date.parse(a.prev.replacedAt) : Date.now() } : null,
  };
}
export function keyInExamples() { return S.keyShown && P && P.api && P.api.key ? P.api.key : 'eft_…'; }
export function realKey() { return P && P.api ? P.api.key : null; }

/* ---- the pace, as the page words it ---------------------------------------------------------------------------- */
function level() { return LEVELS.filter(function (l) { return l.key === S.load; })[0] || LEVELS[1]; }
function pace() {
  var L = level();
  var secs = L.key === 'resting' ? null : (S.games ? L.games : L.other);
  var until = (P && P.pace && P.pace.until) || nextMidnightUtc();
  var siteWords = L.key === 'resting' ? 'resting until ' + timeOf(until) : L.site;
  var figure, sentence, short;
  if (secs == null) { figure = 'Pause'; short = 'none until ' + timeOf(until); sentence = 'Please don’t ask until ' + timeOf(until) + '. The site is resting.'; }
  else if (secs < 60) { figure = secs + 's'; short = 'every ' + secs + ' seconds'; sentence = 'Four rounds a minute while games are on. The site is quiet.'; }
  else if (secs === 60) { figure = '1 min'; short = 'once a minute'; sentence = 'One round a minute. The site is ' + (L.key === 'quiet' ? 'quiet.' : 'running normally.'); }
  else { figure = (secs / 60) + ' min'; short = 'once every ' + (secs / 60) + ' minutes'; sentence = 'One round every ' + (secs / 60) + ' minutes. The site is ' + L.site + ' today' + (L.key === 'busy' ? ', so it has slowed everyone down.' : '.'); }
  return {
    level: L, secs: secs, figure: figure, short: short, sentence: sentence, site: siteWords, until: until,
    color: 'var(--' + L.pc + ')', amber: L.pc !== 'accent',
    header: secs == null ? Math.round((until - Date.now()) / 1000) : secs,
    note: secs == null ? 'Please don’t ask until 00:00 UTC.' : secs < 60 ? 'You may ask every ' + secs + ' seconds while games are on.' :
      secs === 60 ? 'Please ask at most once a minute.' : 'Please ask at most once every ' + (secs / 60) + ' minutes.',
  };
}
export function paceNow() { return pace(); }

/* ---- the snapshot ------------------------------------------------------------------------------------------------ */
function buildEvery() { return (P && P.buildEvery) || 300; }
function builtAt() { return P && P.builtAt ? Date.parse(P.builtAt) : Date.now(); }
function liveRefresh() { return S.games ? (S.load === 'quiet' ? 15 : 60) : 300; }
function refreshOf(s) { return regRefreshOf(s, S.load === 'quiet'); }
function section(key) { return SECTIONS.filter(function (s) { return s.key === key; })[0]; }
function leftOut(key) {
  var hit = ((P && P.leftOut) || []).filter(function (x) { return x.section === key; })[0];
  if (key === 'logos') return null;   // downloads always carry logos
  return hit ? hit.why : null;
}

/* ---- the five endpoints ------------------------------------------------------------------------------------------ */
var ENDPOINTS = REG_ENDPOINTS.map(function (e) {
  return Object.assign({}, e, {
    refreshWords: function () { return e.refreshWords({ games: S.games, quiet: S.load === 'quiet' }); },
    refresh: function () { return e.refresh({ games: S.games, quiet: S.load === 'quiet' }); },
  });
});
export function endpoints() { return ENDPOINTS; }
function endpoint(key) { return ENDPOINTS.filter(function (e) { return e.key === key; })[0]; }
function endpointRows(key, team) {
  var t = team ? +team : null;
  if (key === 'scoreboard') return D.scoreboard.filter(function (m) { return !t || m.home.teamId === t || m.away.teamId === t; });
  if (key === 'standings') return standingsNow();
  if (key === 'rosters') return D._rosterRows.filter(function (r) { return !t || r.teamId === t; });
  if (key === 'activity') return D._activity;
  return null;
}
function endpointUrl(key, o) {
  o = o || {};
  var ep = endpoint(key), q = [];
  if (ep.team && o.team) q.push('team=' + o.team);
  if (o.format === 'csv') q.push('format=csv');
  if (key === 'full' && o.logos) q.push('logos=true');
  if (o.name) q.push('name=' + o.name);
  if (o.key) q.push('key=' + o.key);
  return API + ep.path + (q.length ? '?' + q.join('&') : '');
}
export { endpointUrl, endpointRows, endpoint, tryState, tryNote, tryOut, fieldsHtml, hlUrl, esc, ICON, fmtBytes, guideTable };

/* ---- a toast, the page's own ---------------------------------------------------------------------------------------- */
function toast(text) { HOOKS.toast(text); }


/* ==== carried from the design sample's src/10-core.js ==== */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function $(s, r) { return (r || document).querySelector(s); }
function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
function bytesOf(s) { try { return new TextEncoder().encode(s).length; } catch (e) { return s.length; } }
function fmtBytes(n) {
  if (n >= 1048576) return (n / 1048576).toFixed(n >= 10485760 ? 0 : 2) + ' MB';
  if (n >= 1024) return (n / 1024).toFixed(n >= 102400 ? 0 : 1) + ' KB';
  return n + ' B';
}
function num(n) { return Number(n).toLocaleString('en-US'); }
function reduceMotion() {
  return document.documentElement.classList.contains('stillness') ||
    (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
}
function fmtAt(ms, o) {
  try { return new Intl.DateTimeFormat('en-US', Object.assign({ timeZone: zone() }, o)).format(new Date(ms)); }
  catch (e) { return new Date(ms).toISOString(); }
}
function timeOf(ms) { return fmtAt(ms, { hour: 'numeric', minute: '2-digit' }); }
function dateOf(ms) { return fmtAt(ms, { month: 'short', day: 'numeric', year: 'numeric' }); }
function dayOf(ms) { return fmtAt(ms, { weekday: 'short', month: 'short', day: 'numeric' }); }
function stamp(ms) { return fmtAt(ms, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short' }); }
function iso(ms) { return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z'); }
function ago(ms) {
  var s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}
function inDays(ms) {
  var d = Math.round((ms - Date.now()) / DAY);
  if (d <= 0) return 'today';
  return d === 1 ? 'tomorrow' : 'in ' + d + ' days';
}
function clock(secs) {
  secs = Math.max(0, Math.ceil(secs));
  var m = Math.floor(secs / 60), s = secs % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}
function durWords(sec) {
  if (sec == null) return '—';
  if (sec < 60) return sec + ' seconds';
  if (sec === 60) return '1 minute';
  if (sec % 3600 === 0) return (sec / 3600) + (sec === 3600 ? ' hour' : ' hours');
  return Math.round(sec / 60) + ' minutes';
}
function nextMidnightUtc() { return Math.ceil(Date.now() / DAY) * DAY; }
function maskedKey(k, shown) {
  if (shown) return '<span class="pre">eft_</span>' + esc(k.slice(4));
  return '<span class="pre">eft_</span><span class="dots">' + '•'.repeat(36) + '</span><span class="tail">' + esc(k.slice(-4)) + '</span>';
}
var LEVELS = [
  { key: 'quiet', name: 'Quiet', games: 15, other: 60, site: 'quiet', when: 'Every daily limit under 30%, and on course to stay under 60%', pc: 'accent' },
  { key: 'normal', name: 'Normal', games: 60, other: 60, site: 'running normally', when: 'Every limit under 60%', pc: 'accent' },
  { key: 'busy', name: 'Busy', games: 300, other: 300, site: 'busy', when: 'Any limit at 60% (the Economy level)', pc: 'signal' },
  { key: 'verybusy', name: 'Very busy', games: 900, other: 900, site: 'very busy', when: 'Any limit at 80% (the Protect level)', pc: 'signal' },
  { key: 'resting', name: 'Resting', games: null, other: null, site: 'resting', when: 'A limit reached', pc: 'flag' },
];
function parseCsv(text) {
  var rows = [], row = [], cur = '', q = false;
  for (var i = 0; i < text.length; i++) {
    var c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

/* ==== carried from the design sample's src/20-ui.js ==== */
var ICON = {
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="8" width="12" height="12"/><path d="M4 16V4h12"/></svg>',
  done: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M4 12.5l5 5L20 6.5"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12M6.5 9.5 12 15l5.5-5.5M4 20h16"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M1.8 12S5.5 5.2 12 5.2 22.2 12 22.2 12 18.5 18.8 12 18.8 1.8 12 1.8 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeoff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18M10.6 5.3A10 10 0 0 1 12 5.2c6.5 0 10.2 6.8 10.2 6.8a17 17 0 0 1-3.1 3.9M6.3 6.4C3.4 8.3 1.8 12 1.8 12s3.7 6.8 10.2 6.8c1.6 0 3-.4 4.3-1"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2 20h20z"/><path d="M12 10v4"/><circle cx="12" cy="17" r=".6" fill="currentColor"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9.4"/><path d="M12 11v6"/><circle cx="12" cy="7.6" r=".7" fill="currentColor"/></svg>',
  stop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M8 2.8h8L21.2 8v8L16 21.2H8L2.8 16V8z"/><path d="M8.5 12h7"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>',
  key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="14.5" r="4"/><path d="M10.4 11.6 20 2M16 6l3 3M13.5 8.5l2.5 2.5"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4L12 5.6"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/></svg>',
  server: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="7"/><rect x="3" y="13" width="18" height="7"/><path d="M7 7.5h.01M7 16.5h.01"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="10.5" width="16" height="11"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/><circle cx="12" cy="16" r="1.4"/></svg>',
  help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.4"/><path d="M9.2 9.3a2.8 2.8 0 1 1 3.9 2.9c-.9.5-1.4 1-1.4 2.1"/><circle cx="12" cy="17.2" r=".55" fill="currentColor" stroke="none"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.1"/><path d="M19.1 14.6a1.5 1.5 0 0 0 .3 1.7l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.5 1.5 0 0 0-1.7-.3 1.5 1.5 0 0 0-.9 1.4v.2a2 2 0 1 1-4 0v-.1a1.5 1.5 0 0 0-1-1.4 1.5 1.5 0 0 0-1.7.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.5 1.5 0 0 0 .3-1.7 1.5 1.5 0 0 0-1.4-.9H3a2 2 0 1 1 0-4h.1a1.5 1.5 0 0 0 1.4-1 1.5 1.5 0 0 0-.3-1.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.5 1.5 0 0 0 1.7.3H9a1.5 1.5 0 0 0 .9-1.4V3a2 2 0 1 1 4 0v.1a1.5 1.5 0 0 0 .9 1.4 1.5 1.5 0 0 0 1.7-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.5 1.5 0 0 0-.3 1.7V9a1.5 1.5 0 0 0 1.4.9h.2a2 2 0 1 1 0 4h-.1a1.5 1.5 0 0 0-1.4.9z"/></svg>',
};
var SHIELD = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3 33 8v12c0 8-5.6 14.3-13 17-7.4-2.7-13-9-13-17V8z" fill="none" stroke="currentColor" stroke-width="2" opacity=".6"/><path d="M20 12v14M13 19h14" stroke="currentColor" stroke-width="2" opacity=".6"/></svg>';
function logoHtml(src, cls) {
  return '<span class="lgo' + (src ? '' : ' lgofail') + (cls ? ' ' + cls : '') + '">' + (src ? '<img src="' + src + '" alt="">' : '') + SHIELD + '</span>';
}
var WIDTH = 100, RECORD_WIDTH = 480;
var INL = new WeakMap();
function isRecord(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  return Object.keys(v).every(function (k) {
    var x = v[k];
    return x === null || typeof x !== 'object' || (Array.isArray(x) ? x : Object.keys(x).map(function (q) { return x[q]; }))
      .every(function (y) { return y === null || typeof y !== 'object'; });
  });
}
function inline(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  var hit = INL.get(v); if (hit !== undefined) return hit;
  var out;
  if (Array.isArray(v)) out = v.length ? '[' + v.map(inline).join(', ') + ']' : '[]';
  else { var ks = Object.keys(v); out = ks.length ? '{' + ks.map(function (k) { return JSON.stringify(k) + ': ' + inline(v[k]); }).join(', ') + '}' : '{}'; }
  INL.set(v, out); return out;
}
function fmtJ(v, indent, inList) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  var one = inline(v);
  if (indent.length + one.length <= WIDTH || (inList && isRecord(v) && one.length <= RECORD_WIDTH)) return one;
  var next = indent + '  ';
  if (Array.isArray(v)) return '[\n' + v.map(function (x) { return next + fmtJ(x, next, true); }).join(',\n') + '\n' + indent + ']';
  return '{\n' + Object.keys(v).map(function (k) { return next + JSON.stringify(k) + ': ' + fmtJ(v[k], next, false); }).join(',\n') + '\n' + indent + '}';
}
function formatJson(v) { return fmtJ(v, '', false) + '\n'; }
var TOK = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}\[\],:])/g;
function hlJson(s) {
  var out = '', last = 0, m;
  TOK.lastIndex = 0;
  while ((m = TOK.exec(s))) {
    out += esc(s.slice(last, m.index));
    if (m[1]) out += m[2] ? '<span class="jk">' + esc(m[1]) + '</span><span class="jp">' + esc(m[2]) + '</span>' : '<span class="js">' + esc(m[1]) + '</span>';
    else if (m[3]) out += '<span class="jn">' + m[3] + '</span>';
    else if (m[4]) out += '<span class="jl">' + m[4] + '</span>';
    else out += '<span class="jp">' + esc(m[5]) + '</span>';
    last = TOK.lastIndex;
  }
  return out + esc(s.slice(last));
}
function linesHtml(lines, from, to, kind) {
  var h = '';
  for (var i = from; i < to && i < lines.length; i++) {
    var l = lines[i], d = 0;
    if (kind === 'json') { var m = /^ */.exec(l)[0].length; d = m / 2; l = l.slice(m); }
    var body = kind === 'json' ? hlJson(l) : (kind === 'csvhead' && i === 0 ? '<span class="jk">' + esc(l) + '</span>' : esc(l));
    h += '<div class="jline" style="--d:' + d + '"><span class="jnum">' + (i + 1) + '</span>' + (body || ' ') + '</div>';
  }
  return h;
}
var VIEWS = {};
function viewerHtml(id, text, kind, max) {
  var lines = text.replace(/\n$/, '').split('\n');
  max = max || 400;
  VIEWS[id] = { lines: lines, kind: kind, shown: Math.min(max, lines.length), text: text };
  return '<div class="viewer vwrap" data-viewer="' + id + '"><div class="jsonview vscroll scrollpane" tabindex="0" aria-label="Answer">' +
    linesHtml(lines, 0, VIEWS[id].shown, kind) + '</div><div class="vbar" hidden><div class="vbar-thumb"></div></div></div>' +
    (lines.length > VIEWS[id].shown ? '<button type="button" class="more inline" data-act="viewmore" data-id="' + id + '">Show all ' + num(lines.length) + ' lines<i></i></button>' : '');
}
function attachViewers(root) {
  $$('[data-viewer]', root).forEach(function (w) {
    if (w._vs) return;
    w._vs = attachVScroll($('.vscroll', w), $('.vbar', w));
  });
  // Every preview, block of code and picture that can outgrow its space scrolls inside it with the site's drawn bars.
  ensureVScroll();
  wireScrollers(root);
}
function viewMore(id, btn) {
  var v = VIEWS[id]; if (!v) return;
  var pane = $('[data-viewer="' + id + '"] .jsonview');
  var step = 4000;
  pane.insertAdjacentHTML('beforeend', linesHtml(v.lines, v.shown, v.shown + step, v.kind));
  v.shown = Math.min(v.lines.length, v.shown + step);
  window.dispatchEvent(new Event('resize'));
  if (v.shown >= v.lines.length) btn.remove(); else btn.firstChild.nodeValue = 'Show all ' + num(v.lines.length) + ' lines';
}
function tableHtml(rows, limit) {
  if (!rows || !rows.length) return '<div class="placeholder"><b>Nothing here yet</b><span>This section has no rows right now.</span></div>';
  var flat = rows.slice(0, limit || 60).map(function (r) { return flatten(r); });
  var cols = [];
  flat.forEach(function (r) { Object.keys(r).forEach(function (k) { if (cols.indexOf(k) < 0) cols.push(k); }); });
  var h = '<table><thead><tr>' + cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
  flat.forEach(function (r) {
    h += '<tr>' + cols.map(function (c) {
      var v = r[c];
      if (v == null) return '<td class="nul">null</td>';
      if (typeof v === 'number') return '<td class="num">' + esc(v) + '</td>';
      if (typeof v === 'string' && v.indexOf('data:image') === 0) return '<td><img src="' + v + '" alt="" style="width:20px;height:20px;object-fit:contain;vertical-align:middle"></td>';
      return '<td class="txt">' + esc(v) + '</td>';
    }).join('') + '</tr>';
  });
  return xyScrollHtml(h + '</tbody></table>', 'tview') + (rows.length > (limit || 60) ? '<p class="small" style="margin-top:6px">First ' + (limit || 60) + ' of ' + num(rows.length) + ' rows.</p>' : '');
}
function guideTable(rows, compact) {
  var g = fieldGuide(rows);
  return '<table class="fgtable"><thead><tr><th>Field</th><th>Meaning</th><th>Type</th>' + (compact ? '' : '<th>Example</th>') + '</tr></thead><tbody>' +
    g.map(function (f) {
      var ex = f.example == null ? 'null' : typeof f.example === 'string' ? (f.example.indexOf('data:') === 0 ? '"data:image/…"' : JSON.stringify(f.example.length > 60 ? f.example.slice(0, 58) + '…' : f.example)) : JSON.stringify(f.example);
      return '<tr><td>' + esc(f.field) + '</td><td class="me">' + esc(f.meaning) + '</td><td class="ty">' + esc(f.type) + '</td>' +
        (compact ? '' : '<td class="ex' + (typeof f.example === 'string' ? ' t' : '') + '">' + esc(ex) + '</td>') + '</tr>';
    }).join('') + '</tbody></table>';
}
function markCopied(btn, ok) {
  if (!btn) return;
  var old = btn.getAttribute('data-label') || btn.innerHTML;
  btn.setAttribute('data-label', old);
  btn.classList.add(ok ? 'done' : 'fail');
  btn.innerHTML = (ok ? ICON.done + 'Copied' : 'Copy blocked');
  setTimeout(function () { btn.classList.remove('done', 'fail'); btn.innerHTML = btn.getAttribute('data-label'); }, 1600);
}
function copyText(text, btn) {
  function fallback() {
    try {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; ta.style.top = '0';
      document.body.appendChild(ta); ta.select();
      var ok = document.execCommand('copy'); document.body.removeChild(ta);
      markCopied(btn, ok);
      if (!ok) toast('Copying is blocked here. Select the text and copy it by hand.');
    } catch (e) { markCopied(btn, false); toast('Copying is blocked here. Select the text and copy it by hand.'); }
  }
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { markCopied(btn, true); }, fallback);
    } else fallback();
  } catch (e) { fallback(); }
}
function disclose(body, open, done) {
  var coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  if (reduceMotion() || coarse || !body.animate) { body.hidden = !open; if (done) done(); return; }
  body.hidden = false;
  var h = body.scrollHeight;
  body.style.overflow = 'hidden';
  var a = body.animate(open ? [{ height: '0px' }, { height: h + 'px' }] : [{ height: h + 'px' }, { height: '0px' }],
    { duration: Math.min(900, Math.max(120, h / 0.7)), easing: 'cubic-bezier(.22,.7,.3,1)' });
  a.onfinish = function () { body.style.overflow = ''; if (!open) body.hidden = true; if (done) done(); };
}
var FLIP = { RATE: 1.05, MIN: 460, MAX: 1150, EASE: 'cubic-bezier(.25,.9,.25,1)' };
function flipRow(row, mutate, onDone) {
  var cards = Array.prototype.slice.call(row.children);
  var first = cards.map(function (el) { return el.getBoundingClientRect(); });
  mutate();
  var coarse = false;
  try { coarse = matchMedia('(pointer: coarse)').matches || innerWidth < 860; } catch (e) { coarse = innerWidth < 860; }
  if (reduceMotion() || coarse || !row.animate) { if (onDone) onDone(); return; }
  var moved = [], maxDelta = 0;
  cards.forEach(function (el, i) {
    var f = first[i], l = el.getBoundingClientRect();
    if (!l.width || !l.height || !f.width || !f.height) return;
    var dx = f.left - l.left, dy = f.top - l.top, sx = f.width / l.width, sy = f.height / l.height;
    if (Math.abs(dx) < .5 && Math.abs(dy) < .5 && Math.abs(sx - 1) < .004 && Math.abs(sy - 1) < .004) return;
    maxDelta = Math.max(maxDelta, Math.abs(dx), Math.abs(dy), Math.abs(f.width - l.width), Math.abs(f.height - l.height));
    var inner = el.firstElementChild, tr = 'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ',' + sy + ')';
    el.style.transformOrigin = 'top left'; el.style.transform = tr; el.style.willChange = 'transform';
    if (inner) { inner.style.transformOrigin = 'top left'; inner.style.transform = 'scale(' + 1 / sx + ',' + 1 / sy + ')'; }
    moved.push({ el: el, inner: inner, tr: tr });
  });
  if (!moved.length) { if (onDone) onDone(); return; }
  var dur = Math.max(FLIP.MIN, Math.min(FLIP.MAX, maxDelta / FLIP.RATE)), done = 0;
  void row.offsetWidth;
  moved.forEach(function (m) {
    var a = m.el.animate([{ transform: m.tr }, { transform: 'none' }], { duration: dur, easing: FLIP.EASE });
    if (m.inner) m.inner.animate([{ transform: m.inner.style.transform }, { transform: 'none' }], { duration: dur, easing: FLIP.EASE });
    a.onfinish = function () {
      m.el.style.transform = ''; m.el.style.willChange = '';
      if (m.inner) m.inner.style.transform = '';
      if (++done >= moved.length && onDone) onDone();
    };
  });
}

/* ==== carried from the design sample's src/40-api.js ==== */
export var HELP_API = [
  ['01', 'Find the league’s key', 'It sits under Your league’s key, hidden until you press Show. There is one key for the whole league; Copy puts it on your clipboard, and every program you build sends it.'],
  ['02', 'Pick what to ask for', 'Five addresses answer everything: the scoreboard, the standings, the rosters, league activity, and /full for all of it. Try it shows exactly what a program gets.'],
  ['03', 'Open your platform’s guide', 'Google Sheets, Excel, Python, JavaScript, PowerShell, a shell, iPhone, Android, Home Assistant, Discord or Slack. Each job has the steps and the code, with the league’s key and your team filled in.'],
  ['04', 'Keep to the pace', 'Each program may ask as often as How often to ask says: once a minute on a normal day. A program that asks sooner gets a too_soon error instead of data, and every example here pauses or stops when it sees one.'],
  ['05', 'Keep the key private', 'Anyone with the key can read the league’s data. Keep it out of shared sheets and public code. Whoever administers this site can replace it at any time.'],
  ['06', 'When the key changes', 'The key is replaced on a schedule. From 14 days before, this page shows the date; after a change the old key keeps working for 7 more days, so there is time to update your programs.'],
  ['07', 'Troubleshooting', 'Every error the API can give, grouped by what it is about, with the message your program receives and what to do. Open The whole answer to see exactly what arrives. Below them: what you might see on each platform, and what it means.'],
  ['08', 'Download the data', 'Under Dataset Downloads, every section comes as JSON or CSV, with no key needed. Preview first to see what is in it.'],
];
function head(t, count, id) {
  return '<div class="sechead"' + (id ? ' id="' + id + '"' : '') + '><span class="t">' + t + '</span><span class="rule"></span>' + (count ? '<span class="count">' + count + '</span>' : '') + '</div>';
}
function hlUrl(u) {
  var i = u.indexOf('/api/v1');
  var q = u.indexOf('?');
  var h = '<span class="h">' + esc(u.slice(0, i)) + '</span><span class="pth">' + esc(u.slice(i, q < 0 ? u.length : q)) + '</span>';
  if (q >= 0) {
    h += '?' + u.slice(q + 1).split('&').map(function (kv) {
      var p = kv.split('=');
      return '<span class="q">' + esc(p[0]) + '</span>=' + (p[0] === 'key' ? '<span class="kk">' + esc(p[1]) + '</span>' : esc(p[1]));
    }).join('&amp;');
  }
  return h;
}
function tryState() {
  var p = pace(), r = S.tryRound, now = Date.now();
  if (!S.apiOn) return { ok: false, why: 'The API is switched off, so Try it rests with it.' };
  if (!S.dataReady) return { ok: false, why: 'Nothing to show until the league’s data has been pulled.' };
  if (!p.secs) return { ok: false, why: 'The site is resting until ' + timeOf(p.until) + ', so Try it waits too.' };
  if (!r) return { ok: true, left: 5 };
  if (now - r.start < 10000 && r.used < 5) return { ok: true, left: 5 - r.used, inRound: true };
  var opens = r.start + p.secs * 1000;
  if (now >= opens) return { ok: true, left: 5 };
  return { ok: false, wait: (opens - now) / 1000 };
}
function tryNote() {
  var t = tryState(), p = pace();
  if (t.why) return '<span class="trynote wait"><b>' + esc(t.why) + '</b></span>';
  if (!t.ok) return '<span class="trynote wait" data-trywait="1">Next round in <b>' + clock(t.wait) + '</b>. Try it keeps to the pace like a script: one round of up to 5 within 10 seconds.</span>';
  if (t.inRound) return '<span class="trynote"><b>' + t.left + ' of 5</b> left in this round.</span>';
  return '<span class="trynote">Through this page, not the league’s key, so it never uses up a program’s turn. Keeps to the pace: <b>' + esc(p.short) + '</b>.</span>';
}
function tryOut() {
  var r = S.tries[S.ep];
  if (!r) return '';
  var v = S.view3[S.ep] || (r.csv ? 'csv' : 'json');
  var ok = r.a.status === 200;
  var h = '<div class="tryout"><div class="tryhead"><span class="status' + (r.a.status >= 500 ? ' e5' : r.a.status >= 400 ? ' e4' : '') + '">' + r.a.status + ' ' + esc(r.a.statusText) + '</span>' +
    '<span class="meta">' + (ok ? fmtBytes(r.a.bytes) + ' · about ' + fmtBytes(r.a.sent) + ' sent · ' : '') + esc(timeOf(r.at)) + '</span><span class="grow"></span>' +
    '<div class="seg" role="group" aria-label="View">' + (r.csv ? [['csv', 'CSV']] : [['json', 'JSON']]).concat(ok && S.ep !== 'full' ? [['table', 'Table']] : []).concat([['headers', 'Headers']]).map(function (x) {
      return '<button type="button" data-act="v3" data-v="' + x[0] + '" aria-pressed="' + (v === x[0]) + '">' + x[1] + '</button>';
    }).join('') + '</div>' + (ok ? '<button type="button" class="minibtn" data-act="copyans">' + ICON.copy + 'Copy</button>' : '') + '</div>';
  if (v === 'headers') {
    h += '<div class="hdrs"><span class="st">HTTP/2 ' + r.a.status + '</span><br>' + r.a.headers.map(function (x) { return '<b>' + esc(x[0].toLowerCase()) + '</b>: ' + esc(x[1]); }).join('<br>') + '</div>';
  } else if (v === 'table') {
    h += tableHtml(r.csv ? csvRowsToObjects(r.a.text) : r.a.body.data, 80);
  } else if (v === 'csv') {
    h += viewerHtml('try-' + S.ep, r.a.text, 'csvhead', 400);
  } else {
    h += viewerHtml('try-' + S.ep, formatJson(r.a.body), 'json', S.ep === 'full' ? 600 : 800);
  }
  return h + (ok && v === 'json' && S.ep !== 'full' ? '<p class="small" style="margin-top:8px">Shown one record per line to read easily; your program gets the same data without the spacing (add <code>pretty=true</code> to see it indented in a browser).</p>' : '') + '</div>';
}
function csvRowsToObjects(text) {
  var rows = parseCsv(text.replace(/\n$/, ''));
  var cols = rows[0];
  return rows.slice(1).map(function (r) { var o = {}; cols.forEach(function (c, i) { var v = r[i]; o[c] = v === '' ? null : isFinite(v) && v !== '' ? +v : v; }); return o; });
}
function fieldsHtml(key) {
  if (key === 'full') {
    return '<table class="fgtable"><thead><tr><th>Section</th><th>What you get</th><th>Refreshes</th></tr></thead><tbody>' + SECTIONS.map(function (s) {
      return '<tr><td>' + s.key + '</td><td class="me">' + esc(s.what) + (TOOLS[s.key] ? ' <span class="small">Follows ' + TOOLS[s.key] + '.</span>' : '') + '</td><td class="ty">' + esc(refreshOf(s)) + '</td></tr>';
    }).join('') + '</tbody></table><p class="small" style="margin-top:8px">Refreshes is how often each section can change. An answer brings it within a minute during games and within 5 minutes otherwise, because the API serves the site’s last build. Every answer also carries <code>meta</code>: when the data was built, how often it refreshes, the suggested pace, and the key’s short name and replacement date.</p>';
  }
  return guideTable(endpointRows(key, S.epTeam[key]));
}
function platHtml(p) {
  var open = !!S.openPlats[p.key];
  return '<section class="plat' + (open ? ' open' : '') + '" id="plat-' + p.key + '"><button type="button" class="plathead" data-act="plat" data-k="' + p.key + '" aria-expanded="' + open + '">' +
    '<span class="gl">' + p.glyph + '</span><span class="pk">' + esc(PLAT_KIND[p.key]) + '</span><span class="nm valg">' + esc(p.name) + '</span>' +
    '<span class="cnt"><span class="jc">' + p.jobs.length + ' jobs</span><span class="chev"></span></span></button>' +
    '<div class="platbody disc"' + (open ? '' : ' hidden') + '>' + (open ? platBody(p) : '') + '</div></section>';
}
function platBody(p) {
  var pc = pace();
  var note = p.schedule ? 'These run on a schedule, never more often than every 15 minutes: the slowest pace the site ever sets, even on its busiest days. So none is ever stopped for asking too fast; while the site rests, a run is told to wait and the next one tries again.' :
    'The examples that loop read how often they may ask from every answer and wait exactly that long. The scheduled ones run every 20 minutes or less often, never more often than the site asks for even on its busiest days.';
  return '<div class="platnote" style="--pc:' + pc.color + '"><span class="pacechip">Now: ' + esc(pc.secs ? pc.short : 'resting') + '</span><span>' + note + '</span></div>' +
    '<div class="jobs">' + p.jobs.map(function (j, i) {
      var id = p.key + '.' + j.key, open = !!S.openJobs[id];
      return '<div class="job' + (open ? ' open' : '') + '" id="job-' + p.key + '-' + j.key + '"><button type="button" class="jobhead' + (j.keyInAddress && !S.inAddress ? ' flagged' : '') + '" data-act="job" data-k="' + id + '" aria-expanded="' + open + '">' +
        '<span class="ix">' + (i < 9 ? '0' : '') + (i + 1) + '</span><span class="jt">' + esc(j.title) + '</span><span class="jh">' + esc(j.have) + '</span>' +
        (j.keyInAddress && !S.inAddress ? '<span class="jflag">' + ICON.stop + 'Needs key in the address</span>' : '') +
        '<span class="jrun">' + ICON.clock + esc(RUNS[id] || '') + '</span><span class="chev own"></span></button>' +
        '<div class="jobbody disc"' + (open ? '' : ' hidden') + '>' + (open ? jobBody(p, j) : '') + '</div></div>';
    }).join('') + '</div>';
}
function jobBody(p, j) {
  var c = gctx();
  var sub = function (s) { return s.replace(/%T%/g, c.T).replace(/%K%/g, esc(c.K)); };
  var warn = j.keyInAddress && !S.inAddress ? '<div class="infonote bad" style="margin:14px 0 0">' + ICON.stop + '<span><b>This job won’t work with this site’s settings</b>It needs the key in the address, and this site takes the key in a header only. If you’d like to use it, ask whoever administers this site to allow “Key in the address” in Site Configuration. The Apps Script jobs send the key in a header and work either way.</span></div>' : '';
  var code = j.actions ? j.actions(c) :
    '<div class="codebox"><div class="codebar"><span class="fn">' + esc(j.file) + '</span><button type="button" class="minibtn" data-act="copycode" data-k="' + p.key + '.' + j.key + '">' + ICON.copy + 'Copy</button></div>' +
    xyScrollHtml('<pre class="code' + (j.lang === 'formula' ? ' wrapcode' : '') + '">' + hlCode(jobText(j, c), j.lang) + '</pre>', 'codepane', 'tabindex="0"') + '</div>' +
    (j.extra ? '<div class="codebox"><div class="codebar"><span class="fn">' + esc(j.extra.file) + '</span><button type="button" class="minibtn" data-act="copycode" data-k="' + p.key + '.' + j.key + '" data-extra="1">' + ICON.copy + 'Copy</button></div>' +
      xyScrollHtml('<pre class="code">' + hlCode(jobText(j, c, true), j.extra.lang) + '</pre>', 'codepane', 'tabindex="0"') + '</div>' : '');
  return warn + '<div class="jobgrid"><div class="jcol">' +
    '<section class="jsec"><p class="jlab">Steps</p><ol class="steps">' + j.steps.map(function (s) { return '<li>' + sub(s) + '</li>'; }).join('') + '</ol></section>' +
    '<section class="jsec"><p class="jlab">' + (j.actions ? 'The actions' : 'The code') + '</p>' + code + '</section></div>' +
    '<div class="jcol"><section class="jsec"><p class="jlab">What it looks like working</p>' + j.look(c) + '</section>' +
    '<section class="jsec"><p class="jlab stoplab">How it stops</p><div class="stopbox"><div class="sbh">' + ICON.stop + '<b>When the site says too soon</b></div>' +
    '<p>' + j.stop + '</p></div></section></div></div>';
}
function findJob(id) {
  var parts = id.split('.'), p = PLATFORMS.filter(function (x) { return x.key === parts[0]; })[0];
  return { p: p, j: p.jobs.filter(function (x) { return x.key === parts[1]; })[0] };
}
var PACE_ROWS = {
  quiet: ['Quiet', 'Well inside its free daily allowance: under 30% of every limit, and on course to stay under 60%'],
  normal: ['Normal', 'Under 60% of every daily limit, but not quiet enough for Quiet'],
  busy: ['Busy', 'Any daily limit 60% used'],
  verybusy: ['Very busy', 'Any daily limit 80% used'],
  resting: ['Resting', 'A daily limit used up; the site wakes at 00:00 UTC'],
};
function paceWords(secs) {
  if (secs == null) return 'Not at all until 00:00 UTC';
  if (secs < 60) return 'Every ' + secs + ' seconds';
  if (secs === 60) return 'Once a minute';
  return 'Once every ' + secs / 60 + ' minutes';
}
function paceHtml() {
  var p = pace(), L = p.level;
  var why = L.key === 'resting' ? 'The site has used up one of its free daily limits, so programs wait until it wakes at 00:00 UTC.' :
    L.key === 'quiet' && S.games ? 'NFL games are on and the site is quiet, so programs may ask faster than usual while scores are changing.' :
    L.key === 'quiet' ? 'The site is quiet, but no NFL games are on, so once a minute is enough: nothing changes faster than that.' :
    L.key === 'normal' ? 'The site is running normally' + (S.games ? ' and games are on.' : '.') :
    'The site is ' + PACE_ROWS[L.key][0].toLowerCase() + ': ' + PACE_ROWS[L.key][1].charAt(0).toLowerCase() + PACE_ROWS[L.key][1].slice(1) + ', so every program is slowed down until it recovers.';
  var rows = LEVELS.map(function (l) {
    var cur = l.key === L.key;
    var g = paceWords(l.games), o = paceWords(l.other);
    return '<tr class="' + (cur ? 'now' : '') + '" style="--pc:var(--' + l.pc + ')"><td><b>' + PACE_ROWS[l.key][0] + '</b>' + (cur ? '<span class="nowtag">Now</span>' : '') +
      '<br><span class="small">' + esc(PACE_ROWS[l.key][1]) + '</span></td><td' + (cur && S.games ? ' class="on"' : '') + '>' + g + '</td><td' + (cur && !S.games ? ' class="on"' : '') + '>' + o + '</td></tr>';
  }).join('');
  var rules = [
    ['One round per interval', 'A round is up to five requests within ten seconds: enough for a sheet refreshing several imports, or a script reading the scoreboard and the activity together. Then the program waits for the interval above.'],
    ['Five seconds’ grace', 'A program’s next round opens five seconds before its interval is up, so a schedule that fires a little early (a phone, a Google trigger) is still answered.'],
    ['One program', 'A program is the key, the address it asks from, and its <code>name</code> if it sends one: each of up to ten names at one address has its own interval. Every example on this page sends a name.'],
    ['Four rounds per address', 'However many programs run at one address, together they begin at most four rounds per interval. A fifth is told to pause, never to stop, and is answered in turn.'],
    ['Held when ignored', 'The first refusal in a window comes back at once. Each request after it, inside the same window, waits 20 seconds for its refusal, which slows a loop that never reads its answers.'],
  ];
  return head('How often to ask', '', 'pace') +
    '<div class="panel pacepanel" style="--pc:' + p.color + '">' +
    '<div class="pacehero"><div class="phfig"><span class="k">Each of your programs may ask, right now</span><span class="v valg">' + esc(paceWords(p.secs)) + '</span>' +
    '<span class="pacechip">' + esc(L.name) + (S.games ? ' · games on' : ' · no games on') + '</span></div>' +
    '<div class="phtext"><p>' + esc(why) + '</p><p>This is how often each program may ask the API: one round of requests, then a wait. The site sets it for everyone, from how much of its free daily allowance has been used and whether NFL games are on. ' +
    'Every answer carries it in the <code>X-Suggested-Interval</code> header (in seconds), so a program that reads it never needs changing by hand.</p>' +
    '<p class="small">It is not how often the data changes: each endpoint’s card says how often the site refreshes it, and asking more often than that brings back the same data.</p></div></div>' +
    '<p class="tabhead">How often each program may ask</p>' +
    '<table class="levels"><thead><tr><th>How the site is doing</th><th>While NFL games are on</th><th>At other times</th></tr></thead><tbody>' + rows + '</tbody></table>' +
    '<p class="small" style="margin-top:10px">The daily allowance is Cloudflare’s free limit on the site’s work each day: every page view and every API request counts toward it, which is why the pace follows it. Faster than once a minute is only ever allowed while games are on and the site is quiet, because only then does the site rebuild the live scores every 15 seconds. At every other time the data changes at most once a minute, so asking faster would bring back the same answer.</p></div>' +
    '<div class="panel rwbox"><div class="panelhead"><span class="t">The rate window</span></div>' +
    '<p class="lede">The site keeps each program to the interval above. The rules:</p>' +
    '<div class="rwrules">' + rules.map(function (r, i) { return '<div class="rwrule"><span class="n">0' + (i + 1) + '</span><b>' + r[0] + '</b><p>' + r[1] + '</p></div>'; }).join('') + '</div>' +
    '<p class="rwsub">Asked too soon: two kinds of <code>429 too_soon</code></p>' +
    '<div class="rwkinds">' +
    '<div class="rwkind pc"><div class="kh"><span class="kn">pace_changed</span><span class="xs pause">X-Stop: pause</span></div><p><b>The program did nothing wrong; it has to wait.</b> It asked no sooner than its last answered round allowed, but the site has since slowed everyone down, or other programs at its address have used this interval’s four rounds.</p><p class="kd"><span>Do</span>Pause until <code>Retry-After</code>, then carry on at the pace the next answer gives.</p></div>' +
    '<div class="rwkind tf"><div class="kh"><span class="kn">too_fast</span><span class="xs exit">X-Stop: exit</span></div><p><b>The program asks faster than it was ever allowed.</b> It came sooner than the interval of its last answered round, less the five seconds’ grace.</p><p class="kd"><span>Do</span>Stop for good and tell its owner to fix the interval. Scheduled programs switch themselves off.</p></div></div>' +
    '<div class="rwcallouts"><div class="infonote">' + ICON.clock + '<span><b>Once a minute is never too fast</b>A refusal’s own figure never counts: <code>too_fast</code> is judged against the interval the program was last answered with, and never more strictly than once a minute. ' +
    'So a program on a fixed one-minute timer that can’t read the pace is paused while the site is busy, not stopped, and is answered again when the site calms.</span></div>' +
    '<div class="infonote">' + GL.sheets.replace('<svg ', '<svg class="gls" ') + '<span><b>Google Sheets is answered differently</b>Sheets shows only <code>#N/A</code> for a refusal, so a request from Sheets that is refused gets a <code>200</code> whose one cell says why: <code>Site API: This sheet asked too soon…</code>. It fills in again at the sheet’s next refresh.</span></div></div>' +
    '<p class="rwsub">Watch it happen: one program, ten minutes</p>' + simHtml() + '</div>' +
    '<div class="twocol"><div class="panel"><div class="panelhead"><span class="t">Ask less, get the same</span></div><p class="lede">Every answer carries an <code>ETag</code>. Send it back as <code>If-None-Match</code> and, when nothing has changed, the site answers <code>304 Not Modified</code> with no body. ' +
    'It still counts as the program’s round, but there is nothing to download. The live score examples do this.</p></div>' +
    '<div class="panel"><div class="panelhead"><span class="t">Never post the key</span></div><p class="lede">A key in a public repository, a shared sheet or a screenshot opens the league’s data to anyone. If that happens, whoever administers this site can replace it at once, which stops every program using it.</p></div></div>';
}
export var TROUBLE = [
  { key: 'key', title: 'The league’s key', icon: 'key', lead: 'A <code>401</code> means the key is missing, wrong or replaced. After the first in any minute, these answers are held 20 seconds, so a script stuck on a bad key slows down.' },
  { key: 'soon', title: 'Asking too soon', icon: 'clock', lead: 'A <code>429</code> means the request came before the program’s interval was up, or its address had used this interval’s four rounds. <code>X-Stop</code> and <code>stop</code> say what to do; <code>Retry-After</code> says how many seconds to wait.' },
  { key: 'addr', title: 'The address', icon: 'link', lead: 'A <code>400</code>, <code>404</code> or <code>405</code> means the request itself is wrong: an unknown parameter, a misspelt address, or a method other than reading.' },
  { key: 'site', title: 'The site', icon: 'server', lead: 'A <code>403</code> or <code>5xx</code> is nothing your program did. Try again later, or ask whoever administers this site.' },
];
var ERRORS = [
  { g: 'key', s: 401, code: 'key_missing', when: 'No key was sent', msg: 'This needs your league’s API key. Find it on the Site API page.', fix: 'Add the header <code>Authorization: Bearer eft_…</code>, or <code>key=</code> in the address.' },
  { g: 'key', s: 401, code: 'key_invalid', when: 'The key isn’t this league’s', msg: 'That key isn’t right. Copy it again from the Site API page.', fix: 'Copy the key again from <b>Your league’s key</b>. Every wrong key gets the same answer.' },
  { g: 'key', s: 401, code: 'key_replaced', when: 'An old key once its 7 days of grace are over, or one stopped at once (Replace now, or a League Password change)', msg: 'This key was replaced on %REPLACED%. Get the new one from the Site API page.', fix: 'Copy the new key into every program that used the old one.' },
  { g: 'soon', s: 429, code: 'too_soon', kind: 'pace_changed', when: 'The program kept its pace, but the site has since slowed it', msg: 'The site is busy, so it now allows one round every 5 minutes. Your program asked after 1 minute. Pause it and ask again in 4 minutes.', fix: 'Wait <code>Retry-After</code> seconds, then carry on at the new pace.', stop: 'pause' },
  { g: 'soon', s: 429, code: 'too_soon', kind: 'pace_changed', v: 'address', when: 'Four programs at this address already asked in this interval', msg: 'Four programs at this address have already asked in this minute, the most one address may. Pause this program and ask again in 20 seconds.', fix: 'Wait <code>Retry-After</code> seconds, then carry on. Programs at one address take turns.', stop: 'pause' },
  { g: 'soon', s: 429, code: 'too_soon', kind: 'too_fast', when: 'The program asked sooner than it was ever allowed', msg: 'This program asked after 12 seconds, but the site allows one round a minute. It should stop until its interval is fixed.', fix: 'Stop, and fix the program’s interval before running it again.', stop: 'exit' },
  { g: 'addr', s: 400, code: 'bad_request', when: 'Something after the address is wrong or unknown', msg: 'team must be one of this league’s team ids: 1 to 10.', fix: 'Check the address against the endpoint’s card above; every card lists what it takes.' },
  { g: 'addr', s: 404, code: 'not_found', when: 'Any other address under /api/v1/', msg: 'There’s no endpoint here. The five are /full, /scoreboard, /standings, /rosters and /activity.', fix: 'Check the spelling of the address.' },
  { g: 'addr', s: 405, code: 'method_not_allowed', when: 'Anything but GET, HEAD or OPTIONS', msg: 'The API only reads.', fix: 'Use <code>GET</code>.' },
  { g: 'site', s: 403, code: 'api_off', when: 'The API is switched off, or the tool is hidden', msg: 'The API is switched off for this league.', fix: 'Nothing on your side: ask whoever administers this site.' },
  { g: 'site', s: 503, code: 'not_ready', when: 'Nothing pulled yet (a site mid-setup)', msg: 'The league’s data hasn’t been pulled yet.', fix: 'Try again once whoever administers this site has finished setting it up.' },
  { g: 'site', s: 500, code: 'server_error', when: 'Something broke on the site', msg: 'Something went wrong on the site. Try again shortly.', fix: 'Wait a minute and try again.' },
];
var SYMPTOMS = [
  { see: 'A cell shows “Site API: …”', where: 'Google Sheets', g: 'soon', means: 'The site refused the sheet’s request and put the reason in the cell, since Sheets can’t show an error’s message.', act: 'If it says the sheet asked too soon, leave it: it fills in again at the next refresh. If it names the key, paste the new key into the formula.' },
  { see: '#N/A · “Could not fetch url”', where: 'Google Sheets', g: 'addr', means: 'Sheets never got an answer from the site: the address in the formula is wrong, or the site couldn’t be reached.', act: 'Copy the formula again from its guide. Any answer from the site, even a refusal, shows as text in the cell instead.' },
  { see: 'A SITE_API_STOPPED file appeared', where: 'Scripts', g: 'soon', means: 'The site answered <code>too_fast</code>: the script asked sooner than it was ever allowed, so it stopped itself.', act: 'Read the message in the file, make the script wait the interval the site sends (once a minute is always safe), then delete the file.' },
  { see: 'A script pauses for a while', where: 'Scripts', g: 'soon', means: 'The site got busy and slowed everyone, or other programs at your address used this interval’s four rounds (<code>pace_changed</code>). The script is waiting its turn.', act: 'Nothing: it carries on by itself.' },
  { see: 'Every program gets 401 at once', where: 'Anywhere', g: 'key', means: 'The league’s key was replaced and the old one’s 7 days are over, or it was stopped at once.', act: 'Copy the new key from <b>Your league’s key</b> into each program.' },
  { see: 'Answers take about 20 seconds', where: 'Anywhere', g: 'soon', means: 'The program keeps asking inside a refused window, or keeps sending a wrong key, so its refusals are held.', act: 'Make it read the error and wait <code>Retry-After</code>, or fix the key.' },
  { see: 'A refresh fails with the site’s message', where: 'Excel', g: 'soon', means: 'The refresh was refused; the table keeps its last good rows.', act: 'Set <b>Refresh every</b> to 15 minutes or more.' },
  { see: '“The API is switched off for this league”', where: 'Anywhere', g: 'site', means: 'Whoever administers this site switched the API off, or hid the tool.', act: 'Nothing on your side: ask them.' },
];
var ERR_FIGS = { 'pace_changed': [235, 300, 300, 60], 'pace_changed.address': [20, 60, 60, 60], 'too_fast': [43, 60, 60, 12] };
function errFigs(e) { return ERR_FIGS[e.kind + (e.v ? '.' + e.v : '')]; }
function errBody(e) {
  if (typeof e === 'string') e = ERRORS.filter(function (x) { return !x.v && x.kind === (e === 'pc' ? 'pace_changed' : 'too_fast'); })[0];
  var err = { code: e.code, message: e.msg.replace('%REPLACED%', dateOf(keyInfo().started)) };
  if (e.kind) {
    var f = errFigs(e);
    Object.assign(err, { kind: e.kind, stop: e.stop, askEverySeconds: f[2], askedAfterSeconds: f[3], retryAfterSeconds: f[0] });
  }
  err.docs = BASE + '/apps/site-api/#errors';
  return { ok: false, error: err };
}
function errWhole(e) {
  var st = { 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed', 429: 'Too Many Requests', 500: 'Internal Server Error', 503: 'Service Unavailable' }[e.s];
  var hd = [['content-type', 'application/json; charset=utf-8']];
  if (e.s === 429) { var f = errFigs(e); hd.push(['retry-after', String(f[0])], ['x-stop', e.stop], ['x-suggested-interval', String(f[1])]); }
  if (e.s === 405) hd.push(['allow', 'GET, HEAD, OPTIONS']);
  hd.push(['access-control-allow-origin', '*'], ['access-control-expose-headers', 'ETag, Retry-After, X-Stop, X-Suggested-Interval, X-Updated-At, X-Refresh-Every']);
  return '<div class="hdrs"><span class="st">HTTP/2 ' + e.s + ' ' + st + '</span><br>' + hd.map(function (x) { return '<b>' + x[0] + '</b>: ' + esc(x[1]); }).join('<br>') + '</div>' +
    viewerHtml('err-' + errId(e).replace(/\./g, '-'), formatJson(errBody(e)), 'json');
}
function errorsHtml() {
  var h = head('Troubleshooting', '', 'errors');
  TROUBLE.forEach(function (g) {
    var list = ERRORS.filter(function (e) { return e.g === g.key; });
    h += '<section class="tgroup" id="tg-' + g.key + '"><div class="tgh"><span class="tgi">' + ICON[g.icon] + '</span><div><b>' + g.title + '</b><p>' + g.lead + '</p></div></div>' +
      '<div class="tcards n' + list.length + '">' + list.map(function (e) {
        var id = errId(e), open = !!S.openErr[id];
        var cls = e.s === 429 ? 'e429' : e.s >= 500 || e.s === 403 ? 'e5' : 'e4';
        return '<div class="tcard ' + cls + (open ? ' expanded' : '') + '" id="err-' + id.replace(/\./g, '-') + '"><div class="tcin">' +
          '<div class="tch"><span class="c3">' + e.s + '</span><span class="cn"><code>' + e.code + '</code>' + (e.kind ? '<small>' + e.kind + '</small>' : '') + '</span>' +
          (e.stop ? '<span class="xs ' + e.stop + '">X-Stop: ' + e.stop + '</span>' : '') + '</div>' +
          '<p class="wh">' + esc(e.when) + '</p><p class="msgq"><span class="ml">message</span>' + esc(e.msg.replace('%REPLACED%', dateOf(keyInfo().started))) + '</p>' +
          '<p class="fix">' + ICON.done + '<span>' + e.fix + '</span></p>' +
          '<button type="button" class="helpbtn' + (open ? ' open' : '') + '" data-act="errbody" data-i="' + id + '" aria-expanded="' + open + '">The whole answer</button>' +
          '<div class="errbody"' + (open ? '' : ' hidden') + '>' + (open ? errWhole(e) : '') + '</div></div></div>';
      }).join('') + '</div></section>';
  });
  return h + '<div class="symgrid">' + SYMPTOMS.map(function (x) {
    return '<div class="sym"><div class="symh"><span class="where">' + esc(x.where) + '</span><b>' + x.see + '</b></div>' +
      '<p><span class="lab">Means</span><span>' + x.means + '</span></p><p><span class="lab do">Do</span><span>' + x.act + '</span></p></div>';
  }).join('') + '</div>';
}
function errId(e) { return e.s + '.' + e.code + (e.kind ? '.' + e.kind : '') + (e.v ? '.' + e.v : ''); }
function stripHtml() {
  var p = pace(), k = keyInfo(), b = builtAt(), L = p.level;
  var paceS = p.sentence;
  var extra = p.amber && L.key !== 'resting' ? '<span class="s">Programs keeping the old pace are told <b>too_soon</b> and pause until their next window.</span>' : '';
  var keyCell;
  if (!S.apiOn) keyCell = '<span class="v">—</span><span class="s">No key while the API is off</span>';
  else if (k.prev) keyCell = '<span class="v"><span class="dot" style="--c:var(--signal)"></span><span class="valg">ending ' + esc(k.short) + '</span></span><span class="s">New. The old key ending <b>' + esc(k.prev.short) + '</b> stops ' + esc(dateOf(k.prev.stops)) + '</span>';
  else keyCell = '<span class="v"><span class="dot"></span><span class="valg">ending ' + esc(k.short) + '</span></span><span class="s">Changes ' + esc(dateOf(k.changes)) + ' · ' + esc(inDays(k.changes)) + '</span>';
  return '<div class="apistrip" style="--pc:' + p.color + '">' +
    '<div class="scell pacecell"><span class="k">How often to ask right now</span>' + paceMeter() +
    '<div class="pacetext"><span class="v"><span class="valg">' + esc(p.secs == null ? 'Not until ' + timeOf(p.until) : p.short[0].toUpperCase() + p.short.slice(1)) + '</span>' +
    ' <span class="pacechip">' + esc(L.name) + (S.games ? ' · games on' : '') + '</span></span><span class="s">' + esc(paceS) + '</span>' + extra + '</div></div>' +
    '<div class="scell"><span class="k">API</span><span class="v"><span class="dot" style="--c:var(--' + (S.apiOn ? 'accent' : 'flag') + ')"></span><span class="valg">' + (S.apiOn ? 'On' : 'Off') + '</span></span>' +
    '<span class="s">' + (S.apiOn ? 'Five endpoints, read-only' : 'Switched off in Site Configuration') + '</span></div>' +
    '<div class="scell' + (k.soon || k.prev ? ' warn' : '') + '"><span class="k">Key</span>' + keyCell + '</div>' +
    '<div class="scell"><span class="k">Data</span><span class="v"><span class="valg">' + (S.dataReady ? 'Built <span data-ago="' + b + '">' + ago(b) + '</span>' : 'Not pulled yet') + '</span></span>' +
    '<span class="s">' + (!S.dataReady ? 'See League data in Site Configuration' : P && P.refreshing ? 'Updating to the latest now' :
      'Rebuilt when asked for, at most ' + (buildEvery() < 60 ? 'every 15 seconds' : buildEvery() === 60 ? 'once a minute' : 'every ' + buildEvery() / 60 + ' minutes') + (S.games ? ' during games' : '')) + '</span></div></div>';
}
function paceMeter() {
  var p = pace(), C = 2 * Math.PI * 29;
  var round = p.secs ? Math.min(1, 10 / p.secs) : 0;
  return '<div class="pacemeter" data-pace="' + (p.secs || 0) + '"><svg viewBox="0 0 66 66" aria-hidden="true"><circle class="ring" cx="33" cy="33" r="29"/>' +
    (p.secs ? '<circle class="round" cx="33" cy="33" r="29" stroke-dasharray="' + (round * C).toFixed(1) + ' ' + C.toFixed(1) + '"/>' +
      '<circle class="sweep" cx="33" cy="33" r="29" stroke-dasharray="0 ' + C.toFixed(1) + '"/>' : '') + '</svg>' +
    '<span class="lbl"><b>' + esc(p.figure) + '</b><small>' + (p.secs ? 'a round' : 'resting') + '</small></span></div>';
}
function tickMeters() {
  var p = pace(), C = 2 * Math.PI * 29;
  $$('.pacemeter .sweep').forEach(function (s) {
    if (!p.secs) return;
    var f = reduceMotion() ? 1 : ((Date.now() / 1000) % p.secs) / p.secs;
    s.setAttribute('stroke-dasharray', (f * C).toFixed(1) + ' ' + C.toFixed(1));
  });
}
function keyHtml() {
  if (!S.apiOn) {
    return '<div class="panel"><div class="placeholder"><b>The API is switched off</b><span>Whoever administers this site can switch it on in Site Configuration. ' +
      'Downloads below keep working without it.</span></div></div>';
  }
  var k = keyInfo(), notes = '';
  if (k.prev) notes += '<div class="infonote warn">' + ICON.alert + '<span><b>The key was replaced ' + esc(ago(k.prev.replacedAt)) + '</b>The old key ending <code>' + esc(k.prev.short) +
    '</code> keeps working until ' + esc(dateOf(k.prev.stops)) + ', so there is time to update your programs. Every answer to it says so.</span></div>';
  else if (k.soon) notes += '<div class="infonote warn">' + ICON.alert + '<span><b>This key changes ' + esc(inDays(k.changes)) + '</b>A new key replaces it on ' + esc(dateOf(k.changes)) +
    '. The old one keeps working for 7 days after that. Every answer already carries the date.</span></div>';
  return '<div class="panel"><div class="keygrid">' +
    '<div class="keyrow"><span class="kl">Key</span><span class="kv2' + (S.keyShown ? '' : ' masked') + '" id="keyText">' + maskedKey(k.key, S.keyShown) + '</span><span class="kact">' +
    '<button type="button" class="minibtn" data-act="keyshow" aria-pressed="' + S.keyShown + '">' + (S.keyShown ? ICON.eyeoff + 'Hide' : ICON.eye + 'Show') + '</button>' +
    '<button type="button" class="minibtn go" data-act="copykey">' + ICON.copy + 'Copy</button></span></div>' +
    '<div class="keyrow base"><span class="kl">Address</span><span class="kv2">' + esc(API) + '/</span><span class="kact"><button type="button" class="minibtn" data-act="copy" data-text="' + esc(API + '/') + '">' + ICON.copy + 'Copy</button></span></div>' +
    notes +
    '<div class="keyfacts">' +
    '<div class="fact"><span class="k">Short name</span><span class="v"><span class="valg">ending ' + esc(k.short) + '</span></span></div>' +
    '<div class="fact"><span class="k">Started</span><span class="v"><span class="valg">' + esc(dateOf(k.started)) + '</span></span></div>' +
    '<div class="fact"><span class="k">Changes</span><span class="v' + (k.soon ? ' warn' : '') + '"><span class="valg">' + esc(dateOf(k.changes)) + ' · ' + esc(inDays(k.changes)) + '</span></span></div>' +
    '<div class="fact"><span class="k">Replaced</span><span class="v"><span class="valg">' + (S.interval === 'season' ? 'At Season End' : 'Every ' + S.interval + ' days') + '</span></span></div>' +
    '<div class="fact"><span class="k">In the address</span><span class="v"><span class="valg">' + (S.inAddress ? 'Allowed' : 'Header only') + '</span></span></div></div>' +
    '<div class="infonote">' + ICON.info + '<span><b>Keep it private</b>Anyone with this key can read the league’s data through the API. Keep it out of shared sheets, screenshots and public code. ' +
    'Send it in a header where you can: <code>Authorization: Bearer eft_…</code>. It opens nothing else on the site.</span></div>' +
    '</div></div>';
}
var GROUPS = [['about', 'About'], ['league', 'League (from ESPN, cleaned)'], ['nfl', 'NFL'], ['site', 'Only on this site']];

/* ==== carried from the design sample's src/50-sim.js ==== */
var SIM_PROGS = [
  ['reads', 'Reads the pace', 'The guides’ loops: waits the interval each answer gives'],
  ['fixed60', 'Every minute, can’t read it', 'An automation on a fixed one-minute timer'],
  ['fixed15', 'Every 15 s, follows the guides', 'Its own fixed interval, but it obeys the error'],
  ['ignores', 'Every 15 s, ignores errors', 'A hand-written loop that never reads its answers'],
];
var SIM_BUSY = [180, 420];
function simRun(prog, site) {
  var END = 600, events = [], rec = { start: null, used: 0, given: null, refused: 0 };
  var sitePace = function (t) { return site === 'busy' && t >= SIM_BUSY[0] && t < SIM_BUSY[1] ? 300 : 60; };
  var t = 0, stopped = null, guard = 0;
  while (t < END && guard++ < 200) {
    var d = rateDecide(rec, t, sitePace(t));
    var ev = { t: t, kind: d.kind, pace: d.pace, retry: d.retry, held: !!d.held, gap: d.gap, judged: d.judged, start: rec.start };
    ev.arrives = t + (ev.held ? RW.HOLD : 0);
    events.push(ev);
    if (prog === 'reads') {
      if (ev.kind === 'ok') t = ev.arrives + ev.pace;
      else if (ev.kind === 'pc') t = ev.arrives + ev.retry;
      else { stopped = ev.arrives; break; }
    } else if (prog === 'fixed60') {
      if (ev.kind === 'tf') { stopped = ev.arrives; break; }
      t = ev.arrives + 60;
    } else if (prog === 'fixed15') {
      if (ev.kind === 'tf') { stopped = ev.arrives; break; }
      t = ev.kind === 'pc' ? ev.arrives + ev.retry : ev.arrives + 15;
    } else {
      t = ev.arrives + 15;
    }
  }
  return { events: events, stopped: stopped, sitePace: sitePace, site: site };
}
function simHtml() {
  var s = S.sim;
  return '<div class="simctl"><div class="sf"><span>The program</span><div class="seg" role="group" aria-label="The program">' + SIM_PROGS.map(function (p) {
    return '<button type="button" data-act="simprog" data-v="' + p[0] + '" aria-pressed="' + (s.prog === p[0]) + '" title="' + esc(p[2]) + '">' + esc(p[1]) + '</button>';
  }).join('') + '</div></div><div class="sf"><span>The site</span><div class="seg" role="group" aria-label="The site"><button type="button" data-act="simsite" data-v="normal" aria-pressed="' + (s.site === 'normal') + '">Stays normal</button>' +
    '<button type="button" data-act="simsite" data-v="busy" aria-pressed="' + (s.site === 'busy') + '">Busy from 3:00 to 7:00</button></div></div></div>' +
    '<div id="simBox"></div>';
}
function simDraw() {
  var box = $('#simBox'); if (!box) return;
  var r = simRun(S.sim.prog, S.sim.site);
  var W = 1000, H = 150, L = 34, R = 26, x = function (t) { return L + Math.min(600, t) / 600 * (W - L - R); };
  var y0 = 78;
  var anim = !reduceMotion();
  var delay = function (t) { return anim ? ' style="animation:simin .35s ease-out both;animation-delay:' + Math.round(t / 600 * 5200) + 'ms"' : ''; };
  var h = '<svg class="rwdiag" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Ten minutes of requests">';
  if (r.site === 'busy') h += '<rect class="busy" x="' + x(SIM_BUSY[0]) + '" y="8" width="' + (x(SIM_BUSY[1]) - x(SIM_BUSY[0])) + '" height="' + (H - 36) + '"/>' +
    '<line class="busyl" x1="' + x(SIM_BUSY[0]) + '" x2="' + x(SIM_BUSY[0]) + '" y1="8" y2="' + (H - 28) + '"/><line class="busyl" x1="' + x(SIM_BUSY[1]) + '" x2="' + x(SIM_BUSY[1]) + '" y1="8" y2="' + (H - 28) + '"/>' +
    '<text class="lbl sig" x="' + (x(SIM_BUSY[0]) + 6) + '" y="20">Busy · one round every 5 minutes</text>' +
    '<text class="lbl acc" x="' + (x(SIM_BUSY[1]) + 6) + '" y="20">Normal again</text>';
  h += '<text class="lbl acc" x="' + (x(0) + 2) + '" y="20">Normal · one round a minute</text>';
  // Each answered round opens a window that stays shut until its pace (less 5 seconds) has passed.
  r.events.forEach(function (e) {
    if (e.kind !== 'ok') return;
    var nextOpen = e.t + r.sitePace(e.t) - RW.EARLY;
    for (var tt = e.t; tt < nextOpen && tt < 600; tt += 5) nextOpen = Math.max(nextOpen, e.t + r.sitePace(tt) - RW.EARLY);
    h += '<rect class="rnd" x="' + x(e.t) + '" y="' + (y0 - 22) + '" width="' + Math.max(2, x(e.t + RW.ROUND) - x(e.t)) + '" height="44"/>' +
      '<rect class="shut" x="' + x(e.t + RW.ROUND) + '" y="' + (y0 - 22) + '" width="' + Math.max(0, x(Math.min(600, nextOpen)) - x(e.t + RW.ROUND)) + '" height="44"/>';
  });
  h += '<line class="axis" x1="' + L + '" x2="' + (W - R) + '" y1="' + y0 + '" y2="' + y0 + '"/>';
  for (var m = 0; m <= 10; m++) h += '<line class="tk" x1="' + x(m * 60) + '" x2="' + x(m * 60) + '" y1="' + (y0 + 26) + '" y2="' + (y0 + 31) + '"/><text x="' + x(m * 60) + '" y="' + (y0 + 44) + '" text-anchor="middle">' + m + ':00</text>';
  r.events.forEach(function (e) {
    var cx = x(e.t);
    if (e.held) h += '<line class="held" x1="' + cx + '" x2="' + x(e.arrives) + '" y1="' + (y0 + 16) + '" y2="' + (y0 + 16) + '"' + delay(e.t) + '/>';
    if (e.kind === 'ok') h += '<circle class="ok" cx="' + cx + '" cy="' + y0 + '" r="6"' + delay(e.t) + '/>';
    else if (e.kind === 'pc') h += '<rect class="pc" x="' + (cx - 5.5) + '" y="' + (y0 - 5.5) + '" width="11" height="11" transform="rotate(45 ' + cx + ' ' + y0 + ')"' + delay(e.t) + '/>';
    else h += '<path class="tf" d="M' + (cx - 5) + ' ' + (y0 - 5) + 'l10 10m0 -10l-10 10" stroke="var(--flag)" stroke-width="3"' + delay(e.t) + '/>';
  });
  if (r.stopped != null) h += '<line class="stopline" x1="' + x(r.stopped) + '" x2="' + x(r.stopped) + '" y1="30" y2="' + (y0 + 22) + '"' + delay(r.stopped) + '/><text class="lbl flag" x="' + (x(r.stopped) + 6) + '" y="40"' + delay(r.stopped) + '>Stopped: SITE_API_STOPPED written</text>';
  h += '</svg>';
  var ok = r.events.filter(function (e) { return e.kind === 'ok'; }).length;
  var pc = r.events.filter(function (e) { return e.kind === 'pc'; }).length;
  var tf = r.events.filter(function (e) { return e.kind === 'tf'; }).length;
  var held = r.events.filter(function (e) { return e.held; }).length;
  var n = r.events.length + ' request' + (r.events.length === 1 ? '' : 's');
  var sum, prog = S.sim.prog;
  if (prog === 'reads') sum = '<b>' + n + ', ' + ok + ' answered.</b> ' + (pc ? 'When the site slowed, its next request was told <b>pace_changed</b>; it paused until the window opened and carried on at the new pace. ' : 'It never asked too soon. ') + 'This is how every loop on this page behaves.';
  else if (prog === 'fixed60') sum = '<b>' + n + ', ' + ok + ' answered, ' + pc + ' told pace_changed.</b> ' + (pc ? 'It can’t read the new pace, so it kept asking every minute while the site was busy and was refused each time' + (held ? ', ' + held + ' of them held 20 seconds' : '') + '. Once a minute is never too fast, so it was paused, not stopped, and picked up again when the site calmed.' : 'Once a minute is the site’s normal pace, so every round was answered.');
  else if (prog === 'fixed15') sum = '<b>' + n + ', ' + ok + ' answered.</b> Its second request came 15 seconds after the first, sooner than the minute it was last answered with, so it got <b>too_fast</b> and stopped itself. It stays stopped until its owner fixes the interval and deletes the stop file.';
  else sum = '<b>' + n + ' in ten minutes: ' + ok + ' answered, ' + (pc + tf) + ' refused, ' + held + ' of those held 20 seconds.</b> It still gets data about once per window, but every refused request counts against the site’s daily limit. Within minutes it shows up in <b>High activity</b> for whoever administers this site.';
  box.innerHTML = hScrollHtml(h, 'rwscroll') + '<div class="simlegend"><span><b style="color:var(--accent)">●</b> answered</span><span><b style="color:var(--signal)">◆</b> too_soon · pace_changed</span>' +
    '<span><b style="color:var(--flag)">✕</b> too_soon · too_fast</span><span><b style="color:var(--flag)">—</b> held 20 s</span><span><i class="lg rnd"></i> a round (10 s)</span><span><i class="lg shut"></i> window shut</span></div>' +
    '<p class="simsum">' + sum + '</p>' + xyScrollHtml(r.events.map(function (e) {
      var st = e.kind === 'ok' ? '<span class="ok">200</span>' : '<span class="' + e.kind + '">429</span>';
      var txt = e.kind === 'ok' ? 'Answered. X-Suggested-Interval: ' + e.pace :
        e.kind === 'pc' ? 'too_soon (pace_changed), X-Stop: pause. Retry-After: ' + e.retry :
        'too_soon (too_fast), X-Stop: exit' + (prog === 'ignores' ? ' (ignored)' : '');
      return '<div><span class="t">' + clock(e.t) + '</span>' + st + '<span>' + esc(txt) + (e.held ? ' · held 20 s' : '') + '</span></div>';
    }).join('') + (r.stopped != null ? '<div><span class="t">' + clock(r.stopped) + '</span><span class="tf">stop</span><span>Wrote SITE_API_STOPPED and exited. No more requests.</span></div>' : ''), 'simlog');
}

/* ==== what differs from the sample: the live page asks its own route ============================================ */
var ROUTE = '/apps/site-api/api';
function get(q) { return fetch(ROUTE + '?' + q, { credentials: 'same-origin', cache: 'no-store' }); }

function limitAlert() {
  if (S.load !== 'resting') return '';
  var until = pace().until;
  return '<div class="alertbar" style="margin-top:22px"><span class="alerticon">' + ICON.alert + '</span><div><b>The site is resting</b>' +
    '<p>The site has used up one of its free daily limits and is resting until ' + esc(timeOf(until)) + ' (00:00 UTC). What you see was current at ' +
    esc(timeOf(builtAt())) + '. This page will pick up again by itself.</p></div></div>';
}
export { limitAlert };

/** Try it: through this page's route, never the key, keeping to the pace like a script. */
export function doTry(done) {
  var t = tryState();
  if (!t.ok || S.trying) return;
  var now = Date.now();
  if (!S.tryRound || !t.inRound) S.tryRound = { start: now, used: 0 };
  S.tryRound.used++;
  var ep = S.ep, fmt = S.epFormat[ep] || 'json';
  var q = 'try=' + ep + (S.epTeam[ep] ? '&team=' + S.epTeam[ep] : '') + (fmt === 'csv' ? '&format=csv' : '') + (ep === 'full' && S.logos ? '&logos=true' : '');
  S.trying = true;
  get(q).then(function (r) { return r.json(); }).then(function (j) {
    S.trying = false;
    if (!j || !j.ok) { toast((j && j.error) || 'Try it could not ask just now.'); if (done) done(); return; }
    var a = { status: j.status, statusText: j.statusText, headers: j.headers, text: j.text, bytes: j.bytes || bytesOf(j.text) };
    a.sent = Math.round(a.bytes * (ep === 'full' ? 0.15 : 0.22));
    if (fmt !== 'csv') { try { a.body = JSON.parse(j.text); } catch (e) { a.body = null; } }
    S.tries[ep] = { at: Date.now(), a: a, csv: fmt === 'csv' };
    S.view3[ep] = fmt === 'csv' ? 'csv' : 'json';
    if (done) done();
  }).catch(function () { S.trying = false; toast('Try it could not reach the site just now.'); if (done) done(); });
}

/* ---- description file ------------------------------------------------------------------------------------------- */
function schemaHtml() {
  var txt = S.schemaOpen && S.schemaText ? S.schemaText : '';
  var size = P && P.schemaBytes ? fmtBytes(P.schemaBytes) : '';
  return head('Description file', 'JSON Schema', 'schema') +
    '<div class="panel"><p class="lede">A JSON Schema describing every answer, drawn from the same list as the field guides, for tools and assistants that read one. It covers the endpoints and sections this league has right now.</p>' +
    '<div class="ctlrow" style="margin:14px 0 0"><button type="button" class="minibtn" data-act="schema" aria-expanded="' + S.schemaOpen + '"' + (S.dataReady ? '' : ' disabled') + '>' + (S.schemaOpen ? 'Hide the schema' : 'Show the schema') + '</button>' +
    '<button type="button" class="minibtn go" data-act="copyschema"' + (S.dataReady ? '' : ' disabled') + '>' + ICON.copy + 'Copy</button><span class="small valg">' + size + '</span></div>' +
    (S.schemaOpen && txt ? '<div style="margin-top:12px">' + viewerHtml('schema', txt, 'json', 500) + '</div>' : '') + '</div>';
}
function loadSchema(then) {
  if (S.schemaText) { then(S.schemaText); return; }
  get('schema=1').then(function (r) { return r.text(); }).then(function (t) {
    try { S.schemaText = JSON.stringify(JSON.parse(t), null, 2) + '\n'; } catch (e) { S.schemaText = t; }
    then(S.schemaText);
  }).catch(function () { toast('The description file could not be fetched just now.'); });
}

/* ---- downloads ------------------------------------------------------------------------------------------------------------ */
function sizeOf(key) {
  var z = (P && P.sizes) || {};
  if (key === '*') return SECTIONS.reduce(function (a, s) { return a + (s.key === 'logos' || (P.visible || []).indexOf(s.key) < 0 ? 0 : (z[s.key] || 0)); }, 0);
  return z[key] || 0;
}
function weeksOf() { var w = []; for (var i = 1; i <= (WEEK || 0); i++) w.push(i); return w; }
function downloadsHtml() {
  var ready = S.dataReady;
  var h = head('Dataset Downloads', 'No key needed · signed-in members', 'downloads') + '<div class="panel">';
  if (!ready) return h + '<div class="placeholder"><b>No league data yet</b><span>The downloads come from the league pull. If that has not run yet, whoever administers this site can start it from Site Configuration.</span></div></div>';
  h += '<div class="dlall"><div class="t"><b>Everything</b><span>Every section in one JSON file, the same as <code>/full</code>: <span class="valg">' + fmtBytes(sizeOf('*')) + '</span>. Downloads keep working while the API is off, and never use a program’s turn.</span></div>' +
    '<button type="button" class="minibtn go" data-act="dl" data-k="*" data-f="json">' + ICON.down + 'Everything (JSON)</button></div>';
  var vis = (P && P.visible) || [];
  GROUPS.forEach(function (g) {
    h += '<div class="dlgrp"><p class="jlab">' + g[1] + '</p>';
    SECTIONS.filter(function (s) { return s.group === g[0] && (s.key === 'about' || vis.indexOf(s.key) >= 0); }).forEach(function (s) {
      var why = leftOut(s.key);
      var off = !!why;
      var open = S.dlOpen === s.key;
      h += '<div class="dlrow' + (off ? ' off' : '') + '"><span class="sn">' + s.key + '</span><span class="sd2">' + esc(s.what) +
        (s.weeks ? '<br><span class="seg wk" role="group" aria-label="Week">' + weeksOf().map(function (w) {
          return '<button type="button" data-act="dlweek" data-k="' + s.key + '" data-w="' + w + '" aria-pressed="' + (S.dlWeek[s.key] === w) + '">Week ' + w + '</button>';
        }).join('') + '</span>' : '') +
        (off ? '<small>' + esc(why) + '</small>' : TOOLS[s.key] ? '<small>Follows ' + TOOLS[s.key] + ': served while it is visible to members.</small>' : '') + '</span>' +
        '<span class="sz">' + (off ? '—' : s.key === 'about' ? '<span class="valg">' + fmtBytes(2600) + '</span>' : '<span class="valg">' + fmtBytes(sizeOf(s.key)) + '</span>') + '</span><span class="rf">' + esc(refreshOf(s)) + '</span><span class="ba">' +
        '<button type="button" class="minibtn" data-act="dl" data-k="' + s.key + '" data-f="json"' + (off ? ' disabled' : '') + '>JSON</button>' +
        (s.csv ? '<button type="button" class="minibtn" data-act="dl" data-k="' + s.key + '" data-f="csv"' + (off ? ' disabled' : '') + '>CSV</button>' : '') +
        '<button type="button" class="minibtn' + (open ? ' done' : '') + '" data-act="dlprev" data-k="' + s.key + '"' + (off ? ' disabled' : '') + ' aria-expanded="' + open + '">Preview</button></span>' +
        (open ? '<div class="dlprev">' + previewHtml(s.key) + '</div>' : '') + '</div>';
    });
    h += '</div>';
  });
  return h + '</div>';
}
function prevKey(key) { return key + (S.dlWeek[key] && section(key).weeks ? ':' + S.dlWeek[key] : ''); }
function previewHtml(key) {
  var pv = S.previews[prevKey(key)];
  if (!pv) return '<div class="loadbox"><i></i>Reading</div>';
  if (pv.error) return '<div class="placeholder"><b>Not available</b><span>' + esc(pv.error) + '</span></div>';
  if (pv.value != null) return viewerHtml('prev-' + key, formatJson(pv.value).split('\n').slice(0, 60).join('\n') + '\n', 'json', 60);
  return '<div class="pg"><div>' + tableHtml(pv.rows, 8) + '</div><div>' + xyScrollHtml(guideTable(pv.rows, true), 'fglist') + '</div></div>';
}
function loadPreview(key, then) {
  var id = prevKey(key);
  if (S.previews[id]) { then(); return; }
  var w = S.dlWeek[key] && section(key).weeks ? '&week=' + S.dlWeek[key] : '';
  get('preview=' + encodeURIComponent(key) + w).then(function (r) { return r.json(); }).then(function (j) {
    S.previews[id] = j && j.ok ? { rows: j.rows || [], value: j.value } : { error: (j && j.error) || 'Not available.' };
    then();
  }).catch(function () { S.previews[id] = { error: 'The preview could not be fetched just now.' }; then(); });
}
function fileName(key, fmt) {
  var n = LEAGUE.replace(/[^A-Za-z0-9 ]/g, '').trim().replace(/\s+/g, '_');
  var d = fmtAt(Date.now(), { day: '2-digit', month: '2-digit', year: '2-digit' }).split('/');
  return n + '-' + key + '-' + d[1] + '-' + d[0] + '-' + d[2] + '.' + fmt;
}
/** A download: the file from the page's route, saved in the browser. No key, and it never uses a program's turn. */
function openFile(key, fmt, btn) {
  var name = key === '*' ? fileName('data', 'json') : fileName(key, fmt);
  var w = key !== '*' && S.dlWeek[key] && section(key).weeks ? '&week=' + S.dlWeek[key] : '';
  if (btn) btn.disabled = true;
  get('download=' + encodeURIComponent(key) + '&format=' + fmt + w + '&name=' + encodeURIComponent(name)).then(function (r) {
    if (!r.ok) throw new Error('refused');
    return r.blob();
  }).then(function (blob) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    logEvent('api-download');
    if (btn) btn.disabled = false;
  }).catch(function () { if (btn) btn.disabled = false; toast('That download could not be fetched just now.'); });
}

/* ---- the platforms (the section's introduction and team picker are drawn by SiteApi.jsx) ---------------------------------- */
function platsHtml() { return PLATFORMS.map(platHtml).join(''); }
/** How many fields an endpoint's rows carry, for the field guide's heading. */
export function fieldCount(rows) { return fieldGuide(rows || []).length; }
export function guideCounts() { return { platforms: PLATFORMS.length, jobs: PLATFORMS.reduce(function (a, p) { return a + p.jobs.length; }, 0) }; }

/* ---- drawing and answering ------------------------------------------------------------------------------------------------ */
var PARTS = { strip: stripHtml, alert: limitAlert, key: keyHtml, plats: platsHtml, pace: paceHtml, err: errorsHtml, schema: schemaHtml, dl: downloadsHtml };
var ROOTS = {};
/** Where each section draws: SiteApi.jsx hands over its containers once. */
export function mount(roots) { ROOTS = roots; }
export function renderPart(name) {
  var el = ROOTS[name];
  if (!el) return;
  el.innerHTML = PARTS[name]();
  attachViewers(el);
  if (name === 'pace') simDraw();
}
export function renderAll() { Object.keys(PARTS).forEach(renderPart); }

/** One handler for every click inside the drawn sections. */
export function handleClick(e) {
  var t = e.target.closest('[data-act]');
  if (!t) return;
  var act = t.getAttribute('data-act'), k = t.getAttribute('data-k'), v = t.getAttribute('data-v');
  if (t.tagName === 'A') e.preventDefault();
  switch (act) {
    case 'copy': copyText(t.getAttribute('data-text'), t); break;
    case 'viewmore': viewMore(t.getAttribute('data-id'), t); break;
    case 'keyshow': S.keyShown = !S.keyShown; renderPart('key'); renderPart('plats'); HOOKS.onChange('key'); break;
    case 'copykey': { var rk = realKey(); if (rk) { copyText(rk, t); logEvent('api-key-copy'); } break; }
    case 'plat': {
      var p = PLATFORMS.filter(function (x) { return x.key === k; })[0];
      var sec = t.closest('.plat'), body = sec.querySelector('.platbody'), openP = !S.openPlats[k];
      S.openPlats[k] = openP; t.setAttribute('aria-expanded', String(openP)); sec.classList.toggle('open', openP);
      if (openP) body.innerHTML = platBody(p);
      disclose(body, openP);
      break;
    }
    case 'job': {
      var f = findJob(k), jb = t.nextElementSibling, openJ = !S.openJobs[k];
      S.openJobs[k] = openJ; t.setAttribute('aria-expanded', String(openJ)); t.parentNode.classList.toggle('open', openJ);
      if (openJ) jb.innerHTML = jobBody(f.p, f.j);
      disclose(jb, openJ);
      break;
    }
    case 'copycode': {
      var fj = findJob(k), real = { K: realKey() || 'eft_…', T: S.guideTeam, TN: teamName(S.guideTeam), p: pace() };
      copyText(jobText(fj.j, real, !!t.getAttribute('data-extra')), t);
      break;
    }
    case 'simprog': S.sim.prog = v; renderPart('pace'); break;
    case 'simsite': S.sim.site = v; renderPart('pace'); break;
    case 'errbody': {
      var i = t.getAttribute('data-i'), card = t.closest('.tcard'), row = card.parentNode, openE = !S.openErr[i];
      var er = ERRORS.filter(function (x) { return errId(x) === i; })[0];
      var prev = openE ? $$('.tcard.expanded', row).filter(function (c) { return c !== card; })[0] : null;
      flipRow(row, function () {
        if (prev) {
          var pb = $('.helpbtn', prev); S.openErr[pb.getAttribute('data-i')] = false;
          prev.classList.remove('expanded'); pb.classList.remove('open'); pb.setAttribute('aria-expanded', 'false'); $('.errbody', prev).hidden = true;
        }
        S.openErr[i] = openE; card.classList.toggle('expanded', openE); t.classList.toggle('open', openE); t.setAttribute('aria-expanded', String(openE));
        var eb = $('.errbody', card);
        if (openE) { eb.innerHTML = errWhole(er); attachViewers(eb); }
        eb.hidden = !openE;
      });
      break;
    }
    case 'schema':
      if (S.schemaOpen) { S.schemaOpen = false; renderPart('schema'); }
      else loadSchema(function () { S.schemaOpen = true; renderPart('schema'); });
      break;
    case 'copyschema': loadSchema(function (txt) { copyText(txt, t); }); break;
    case 'dl': openFile(k, t.getAttribute('data-f'), t); break;
    case 'dlprev':
      if (S.dlOpen === k) { S.dlOpen = null; renderPart('dl'); }
      else { S.dlOpen = k; renderPart('dl'); loadPreview(k, function () { if (S.dlOpen === k) renderPart('dl'); }); }
      break;
    case 'dlweek': S.dlWeek[k] = +t.getAttribute('data-w'); renderPart('dl'); if (S.dlOpen === k) loadPreview(k, function () { if (S.dlOpen === k) renderPart('dl'); }); break;
    case 'v3': S.view3[S.ep] = v; HOOKS.onChange('try'); break;
    case 'copyans': { var r = S.tries[S.ep]; copyText(r.csv ? r.a.text : JSON.stringify(r.a.body), t); break; }
  }
}

/** The clock: ages, the Try it note, and the pace meter's sweep. */
export function tick() {
  $$('[data-ago]').forEach(function (el) { el.textContent = ago(+el.getAttribute('data-ago')); });
}
export { tickMeters, attachViewers, disclose };
