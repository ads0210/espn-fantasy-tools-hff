/**
 * Which page reads what.
 *
 * The declared map behind Site Backend's page tabs: each page's routes, what
 * polls and how often, and the datasets it reads directly (everything those are
 * built from is worked out from the registry). A test checks it against the
 * routes' own reads, so a page that starts reading something new cannot drift
 * out of it unnoticed.
 *
 * Tool pages come from src/tools.js, so a new tool gets its tab here by
 * appearing there; only its routes and datasets need declaring.
 */

import { TOOLS } from './tools.js';

/** The server-rendered pages, in the order a member meets them. */
const FIXED = [
  {
    key: 'home', name: 'Home', path: '/',
    routes: [
      ['GET', '/', 'document'], ['GET', '/api/dashboard/status', 'every 15 s, with the board every 90 s', 15],
      ['GET', '/api/dashboard/board', 'on load and on a team change'], ['GET', '/api/logo/:team', 'on load'],
      ['GET', '/api/img', 'on load'], ['GET', '/favicon.svg', 'on load'], ['POST', '/api/auth/logout', 'on sign out'],
    ],
    datasets: ['scoreboard_digest', 'matchup_digest', 'live_scoring_digest', 'bye_weeks', 'standings_digest',
      'roster_digest', 'injuries_digest', 'transaction_digest', 'nfl_news', 'league_teams', 'league_settings'],
  },
  {
    key: 'signin', name: 'Sign-in', path: '(any page while signed out)',
    routes: [
      ['POST', '/api/auth/login', 'on sign in'], ['POST', '/api/auth/logout', 'on sign out'],
      ['GET', '/api/auth/status', 'on load'], ['GET', '/api/health', 'public'], ['GET', '/favicon.svg', 'public'],
    ],
    datasets: ['league_settings'],
  },
  {
    key: 'wizard', name: 'Setup wizard', path: '/ (before setup)',
    routes: [
      ['GET', '/api/setup/status', 'on load'], ['POST', '/api/setup/check-code', '01 Access'],
      ['POST', '/api/setup/passwords', '02 Passwords'], ['POST', '/api/setup/league', '03 League'],
      ['GET', '/api/setup/tools', '04 Tools, on load'], ['POST', '/api/setup/tools', '04 Tools'],
      ['POST', '/api/setup/prime-batch', 'while league data loads'], ['POST', '/api/setup/history-batch', '05 History'],
      ['POST', '/api/setup/finish', 'at the end'],
    ],
    datasets: ['league_history'],
  },
  {
    key: 'config', name: 'Site Configuration', path: '/config',
    routes: [
      ['GET', '/config', 'document'], ['POST', '/api/admin/verify', 'on unlock'], ['POST', '/api/admin/config', 'on load'],
      ['POST', '/api/admin/cookies', 'on save'], ['POST', '/api/admin/passwords', 'on save'],
      ['POST', '/api/admin/tool-visibility', 'on change'], ['POST', '/api/admin/tool-order', 'on a move'], ['POST', '/api/admin/trade-weights', 'on save'],
      ['POST', '/api/admin/fortune-teller', 'on switch, check or rebuild'], ['POST', '/api/admin/prime-batch', 'while re-pulling'],
      ['POST', '/api/admin/history-batch', 'while re-pulling'], ['GET', '/api/meta', 'on load'],
    ],
    datasets: ['league_settings'],
  },
];

/** Per tool: what its page calls and reads. */
const TOOL_READS = {
  'draft-helper': {
    routes: [
      ['GET', '/apps/draft-helper/', 'document'],
      ['GET', '/api/data', 'every 15 s: the draft and rosters each time, the player pool, injuries and news every minute', 15],
      ['GET', '/api/meta', 'on load'],
    ],
    // The draft payload carries the league's settings, roster shape included.
    datasets: ['draft_results', 'rosters', 'player_digest', 'injuries_digest', 'nfl_news'],
  },
  'live-matchups': {
    routes: [
      ['GET', '/apps/live-matchups/', 'document'], ['GET', '/api/live/week', 'every 15 s, with the score history every minute', 15],
      ['GET', '/api/live/timeline', 'once for a past week'], ['GET', '/api/live/h2h', 'on load'],
      ['GET', '/api/meta', 'on load'], ['GET', '/api/logo/:team', 'on load'],
    ],
    datasets: ['live_scoring_digest', 'h2h_digest', 'season_schedule'],
  },
  'hall-of-fame': {
    routes: [['GET', '/apps/hall-of-fame/', 'document'], ['GET', '/api/hof', 'on load'], ['GET', '/api/meta', 'on load']],
    datasets: ['league_history_digest', 'h2h_full_digest'],
  },
  'trade-analyzer': {
    routes: [['GET', '/apps/trade-analyzer/', 'document'], ['GET', '/api/trade', 'on load'],
      ['POST', '/api/site-log/event', 'on share']],
    datasets: ['trade_digest'],
  },
  'fortune-teller': {
    routes: [
      ['GET', '/apps/fortune-teller/', 'document'], ['GET', '/api/fortune-teller', 'every 30 s while a build runs', 30],
      ['GET', '/api/fortune-teller/map/:team', 'on team change'], ['GET', '/apps/fortune-teller/*', 'worker and assets'],
      ['POST', '/api/site-log/event', 'on share'],
    ],
    datasets: ['standings_digest', 'league_settings', 'season_schedule'],
  },
  'llm-export': {
    routes: [['GET', '/apps/llm-export/', 'document'], ['GET', '/api/llm-export', 'on load and before a copy or download'],
      ['POST', '/api/site-log/event', 'on copy or download']],
    datasets: ['llm_export_digest', 'live_scoring_digest'],
  },
  'site-api': {
    routes: [['GET', '/apps/site-api/', 'document'], ['POST', '/api/tools/unlock', 'on unlock'],
      ['GET', '/apps/site-api/api', 'on load, on return to the tab, Try it, previews and downloads'],
      ['GET', '/api/v1/*', 'programs holding the league\u2019s key'], ['POST', '/api/site-log/event', 'on a key copy or download']],
    // Everything it serves comes from Site API's snapshot, built from these.
    datasets: ['league_settings', 'llm_export_digest', 'standings_digest', 'live_scoring_digest', 'season_schedule', 'player_digest',
      'transaction_digest', 'draft_results', 'bye_weeks', 'scoreboard_digest', 'injuries_digest', 'nfl_news', 'league_history_digest', 'h2h_full_digest'],
  },
  'site-backend': {
    routes: [['GET', '/apps/site-backend/', 'document'], ['POST', '/api/tools/unlock', 'on unlock'],
      ['GET', '/apps/site-backend/api', 'every 15 s while open', 15]],
    datasets: [],
  },
};

/** Every page Site Backend has a tab for, in order. */
export const PAGES = [
  ...FIXED,
  ...TOOLS.map((t) => ({
    key: t.key, name: t.name, path: t.href, tool: t.key,
    routes: (TOOL_READS[t.key] || { routes: [['GET', t.href, 'document']] }).routes,
    datasets: (TOOL_READS[t.key] || { datasets: [] }).datasets,
  })),
];

/** Whether a tool's routes and datasets are declared here rather than guessed: every tool's must be. */
export function declaresReads(key) {
  return Object.prototype.hasOwnProperty.call(TOOL_READS, key);
}

export function pageOf(key) {
  return PAGES.find((p) => p.key === key) || null;
}

/**
 * Which page a counted route belongs to. A route several pages call (the meta
 * route, logos) counts once, toward the page that owns it.
 */
export function pageForRoute(routeKey) {
  const path = routeKey.slice(routeKey.indexOf(' ') + 1);
  const m = /^\/apps\/([^/]+)\//.exec(path);
  if (m) return pageOf(m[1]) ? m[1] : null;
  if (path === '/' || path.startsWith('/api/dashboard/') || path === '/api/logo/:team' || path === '/api/img' || path.startsWith('/favicon')) return 'home';
  if (path.startsWith('/api/auth/') || path === '/api/health') return 'signin';
  if (path.startsWith('/api/setup/')) return 'wizard';
  if (path === '/config' || path.startsWith('/api/admin/') || path === '/api/meta') return path === '/api/admin/fortune-teller' ? 'fortune-teller' : 'config';
  if (path === '/api/data' || path.startsWith('/api/data/')) return 'draft-helper';
  if (path.startsWith('/api/live/')) return 'live-matchups';
  if (path === '/api/hof') return 'hall-of-fame';
  if (path === '/api/trade') return 'trade-analyzer';
  if (path.startsWith('/api/fortune-teller')) return 'fortune-teller';
  if (path === '/api/llm-export') return 'llm-export';
  if (path === '/api/tools/unlock') return 'site-backend';
  if (path === '/api/v1' || path.startsWith('/api/v1/')) return 'site-api';
  return null;
}

/**
 * The datasets the member-facing data route serves: exactly what Draft Helper polls,
 * and nothing else. Raw payloads (pending waiver claims among them) are never served.
 */
export const DATA_ROUTE_DATASETS = new Set(TOOL_READS['draft-helper'].datasets);

/**
 * The tool an API route belongs to, so a hidden tool's data is blocked with its page.
 * Admin routes, the unlock and the site log's event route belong to no tool.
 */
export function apiTool(path) {
  if (!path.startsWith('/api/') || path.startsWith('/api/admin/') || path === '/api/tools/unlock' || path === '/api/site-log/event') return null;
  const key = pageForRoute(`GET ${path}`);
  return key && TOOLS.some((t) => t.key === key) ? key : null;
}

/** The share-link parameters each tool's links carry, for noticing a shared link being opened. */
export const SHARE_PARAMS = {
  'trade-analyzer': ['offer', 'a'],
  'fortune-teller': ['path'],
};
