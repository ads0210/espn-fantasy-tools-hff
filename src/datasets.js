/**
 * Dataset registry.
 *
 * Every ESPN endpoint the platform can pull is declared here, declaratively.
 * Nothing else in the codebase hardcodes an ESPN URL.
 *
 * A dataset descriptor:
 *   key       unique id, also the R2 path prefix
 *   label     human readable
 *   group     grouping for the diagnostics UI
 *   ttl       freshness threshold in seconds. 0 = never auto-refresh (manual/admin only)
 *   auth      true if the ESPN private-league cookies must be sent
 *   parts(cfg) -> [{ part, url, headers? }]
 *   tier      'core'  = required for the platform to function
 *             'aux'   = useful, expected to work
 *             'probe' = exploratory; may legitimately fail, never blocks a green build
 */

// ---- freshness constants (see platform_architecture_plan.md §2) ----
export const TTL = {
  LIVE: 15, // scoreboard + live fantasy scoring floor, cross-tool
  MIN_1: 60,
  MIN_5: 300,
  MIN_30: 1800,
  HOUR_6: 21600,
  DAY: 86400,
  MANUAL: 0,
};

// ESPN's NFL team ids. 31 and 32 are genuinely unused in ESPN's numbering.
export const NFL_TEAM_IDS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
  21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 33, 34,
];

export const REGULAR_SEASON_WEEKS = 18;

/**
 * Fallback history range, used only until discovery has run.
 *
 * A league's real history is whatever ESPN reports in `status.previousSeasons`
 * — this league started in 2023, so a hardcoded range 404s on seasons that
 * never existed. /api/admin/discover writes the true list into KV and
 * `cfg.historySeasons` then drives the parts list. Keeping this generic (rather
 * than pinned to one league's years) is also what makes the registry portable.
 */
export function fallbackHistorySeasons(season) {
  const end = Number(season) - 1;
  return [end - 2, end - 1, end].filter((y) => Number.isFinite(y) && y > 2000);
}

export function historySeasons(cfg) {
  if (Array.isArray(cfg.historySeasons) && cfg.historySeasons.length) {
    return cfg.historySeasons;
  }
  return fallbackHistorySeasons(cfg.season);
}

const FANTASY_HOST = 'https://lm-api-reads.fantasy.espn.com';
// site.api.espn.com is behind Akamai bot protection that 403s all Cloudflare
// Worker traffic. site.web.api.espn.com serves the identical /apis/site/v2/
// namespace unprotected — verified live. espn.js keeps a bidirectional
// fallback so a future flip of which edge is protected self-heals.
const SITE_HOST = 'https://site.web.api.espn.com';
const CORE_HOST = 'https://sports.core.api.espn.com';
const CDN_HOST = 'https://cdn.espn.com';
const NOW_HOST = 'https://now.core.api.espn.com';
const WEB_HOST = 'https://site.web.api.espn.com';

const leagueBase = (cfg) =>
  `${FANTASY_HOST}/apis/v3/games/ffl/seasons/${cfg.season}/segments/0/leagues/${cfg.leagueId}`;

const coreBase = () => `${CORE_HOST}/v2/sports/football/leagues/nfl`;
const siteBase = () => `${SITE_HOST}/apis/site/v2/sports/football/nfl`;

// X-Fantasy-Filter is REQUIRED on the bulk player endpoints, not optional.
const playerFilter = (limit) =>
  JSON.stringify({
    players: {
      limit,
      sortPercOwned: { sortPriority: 1, sortAsc: false },
    },
  });

/** Convenience: a dataset that is one single call. */
const one = (url, headers) => () => [{ part: 'main', url, headers }];

/** Convenience: a dataset whose parts are per NFL team. */
const perTeam = (fn) => () =>
  NFL_TEAM_IDS.map((id) => ({ part: String(id), url: fn(id) }));

export const DATASETS = [
  // ==========================================================
  // Fantasy league (private — requires espn_s2 + SWID)
  // ==========================================================
  {
    key: 'league_settings',
    label: 'League settings & scoring rules',
    group: 'fantasy',
    // Scoring rules and the league name change rarely but they do change, and a
    // day-long window meant a mid-season rule edit could sit stale until the
    // next morning. Six hours is still low-traffic — the dashboard revalidates
    // this behind the response, never in front of it.
    ttl: TTL.HOUR_6,
    auth: true,
    tier: 'core',
    parts: (cfg) => [{ part: 'main', url: `${leagueBase(cfg)}?view=mSettings` }],
    expect: 'settings',
  },
  {
    key: 'league_teams',
    label: 'Teams, names, owners',
    group: 'fantasy',
    ttl: TTL.MIN_30,
    auth: true,
    tier: 'core',
    parts: (cfg) => [{ part: 'main', url: `${leagueBase(cfg)}?view=mTeam` }],
    expect: 'teams',
  },
  {
    key: 'rosters',
    label: 'Rosters (teams + roster contents)',
    group: 'fantasy',
    ttl: TTL.LIVE,
    auth: true,
    tier: 'core',
    parts: (cfg) => [
      { part: 'main', url: `${leagueBase(cfg)}?view=mTeam&view=mRoster` },
    ],
    expect: 'teams',
  },
  {
    key: 'draft_results',
    label: 'Draft pick history',
    group: 'fantasy',
    ttl: TTL.LIVE,
    auth: true,
    tier: 'core',
    parts: (cfg) => [
      { part: 'main', url: `${leagueBase(cfg)}?view=mDraftDetail&view=mSettings` },
    ],
    expect: 'draftDetail',
  },
  {
    key: 'matchups',
    label: 'Matchup schedule & scores',
    group: 'fantasy',
    ttl: TTL.LIVE,
    auth: true,
    tier: 'core',
    parts: (cfg) => [
      { part: 'main', url: `${leagueBase(cfg)}?view=mMatchup&view=mMatchupScore` },
    ],
    expect: 'schedule',
  },
  {
    key: 'standings',
    label: 'Standings',
    group: 'fantasy',
    ttl: TTL.MIN_5,
    auth: true,
    tier: 'core',
    parts: (cfg) => [{ part: 'main', url: `${leagueBase(cfg)}?view=mStandings` }],
    expect: 'teams',
  },
  {
    key: 'live_scoring',
    label: 'Live in-game fantasy scoring',
    group: 'fantasy',
    ttl: TTL.LIVE,
    auth: true,
    tier: 'core',
    parts: (cfg) => [
      {
        part: 'main',
        url:
          `${leagueBase(cfg)}?view=mScoreboard&view=mMatchupScore` +
          `&view=mBoxscore&view=mLiveScoring`,
      },
    ],
    expect: 'schedule',
  },
  {
    key: 'transactions',
    label: 'Transaction log (waivers/trades)',
    group: 'fantasy',
    ttl: TTL.MIN_5,
    auth: true,
    tier: 'core',
    parts: (cfg) => [
      { part: 'main', url: `${leagueBase(cfg)}?view=mTransactions2` },
    ],
    expect: 'status',
  },
  {
    key: 'pending_transactions',
    label: 'Pending waiver claims',
    group: 'fantasy',
    ttl: TTL.MIN_5,
    auth: true,
    tier: 'aux',
    parts: (cfg) => [
      { part: 'main', url: `${leagueBase(cfg)}?view=mPendingTransactions` },
    ],
  },
  {
    key: 'league_status',
    label: 'League status metadata',
    group: 'fantasy',
    ttl: TTL.MIN_30,
    auth: true,
    tier: 'aux',
    parts: (cfg) => [{ part: 'main', url: `${leagueBase(cfg)}?view=mStatus` }],
  },
  {
    key: 'league_nav',
    label: 'League nav metadata',
    group: 'fantasy',
    ttl: TTL.DAY,
    auth: true,
    tier: 'probe',
    parts: (cfg) => [{ part: 'main', url: `${leagueBase(cfg)}?view=mNav` }],
  },
  {
    key: 'player_watchlist',
    label: 'Player watch-list / waiver-locked state',
    group: 'fantasy',
    ttl: TTL.MIN_5,
    auth: true,
    tier: 'probe',
    parts: (cfg) => [{ part: 'main', url: `${leagueBase(cfg)}?view=player_wl` }],
  },
  {
    key: 'league_players',
    label: 'League-scoped player pool (with onTeamId)',
    group: 'fantasy',
    ttl: TTL.MIN_1,
    auth: true,
    tier: 'core',
    parts: (cfg) => [
      {
        part: 'main',
        url: `${leagueBase(cfg)}?scoringPeriodId=0&view=kona_player_info`,
        headers: { 'X-Fantasy-Filter': playerFilter(3000) },
      },
    ],
    expect: 'players',
  },
  {
    key: 'player_pool',
    label: 'Bulk player pool (league defaults, ADP/ranks)',
    group: 'fantasy',
    ttl: TTL.MIN_1,
    auth: false,
    tier: 'core',
    large: true,
    parts: (cfg) => [
      {
        part: 'main',
        url:
          `${FANTASY_HOST}/apis/v3/games/ffl/seasons/${cfg.season}` +
          `/segments/1/leaguedefaults/3?scoringPeriodId=0&view=kona_player_info`,
        headers: { 'X-Fantasy-Filter': playerFilter(3000) },
      },
    ],
    expect: 'players',
  },
  {
    key: 'scoreboard_digest',
    label: 'NFL scoreboard, reduced for the ticker',
    group: 'derived',
    ttl: TTL.LIVE,
    auth: false,
    tier: 'core',
    derivedFrom: 'nfl_scoreboard',
    parts: () => [{ part: 'main', url: null }],
  },
  {
    key: 'matchup_digest',
    label: 'This week\'s fantasy matchups',
    group: 'derived',
    ttl: TTL.LIVE,
    auth: true,
    tier: 'core',
    derivedFrom: 'matchups',
    parts: () => [{ part: 'main', url: null }],
  },
  {
    key: 'standings_digest',
    label: 'Standings, reduced for display',
    group: 'derived',
    ttl: TTL.MIN_5,
    auth: true,
    tier: 'core',
    derivedFrom: 'standings',
    parts: () => [{ part: 'main', url: null }],
  },
  {
    key: 'roster_digest',
    label: 'Rosters, reduced to lineup identity',
    group: 'derived',
    ttl: TTL.LIVE,
    auth: true,
    tier: 'core',
    derivedFrom: 'rosters',
    parts: () => [{ part: 'main', url: null }],
  },
  {
    key: 'h2h_digest',
    label: 'All-time meetings between teams',
    group: 'derived',
    // Past seasons are immutable, but this season's meetings are not: two teams
    // who played in week one and meet again in week ten must show that first
    // result. So it revalidates on the slow poll rather than being built once
    // when the history pull runs and then frozen for the year.
    ttl: TTL.MIN_30,
    auth: true,
    tier: 'core',
    derivedFrom: 'league_history',
    parts: () => [{ part: 'main', url: null }],
  },
  {
    key: 'live_scoring_digest',
    label: 'Live matchup detail, reduced',
    group: 'derived',
    ttl: TTL.LIVE,
    auth: true,
    tier: 'core',
    derivedFrom: 'live_scoring',
    // Only the current week is declared here. Completed weeks are stored
    // alongside it under a `w<N>` part by the on-demand path in index.js —
    // they are immutable once played, so they are fetched once and never swept.
    parts: () => [{ part: 'main', url: null }],
  },
  {
    key: 'transaction_digest',
    label: 'Recent adds, drops and trades',
    group: 'derived',
    ttl: TTL.MIN_5,
    auth: true,
    tier: 'core',
    derivedFrom: 'transactions',
    parts: () => [{ part: 'main', url: null }],
  },
  {
    key: 'bye_weeks',
    label: 'NFL bye weeks by team',
    group: 'derived',
    ttl: TTL.DAY,
    auth: false,
    tier: 'core',
    derivedFrom: 'nfl_team_schedules',
    parts: () => [{ part: 'main', url: null }],
    notes: 'A team\'s bye is the regular-season week missing from its schedule.',
  },
  {
    key: 'player_digest',
    label: 'Player pool, reduced for display',
    group: 'derived',
    ttl: TTL.MIN_1,
    auth: false,
    tier: 'core',
    derivedFrom: 'league_players',
    parts: () => [{ part: 'main', url: null }],
    notes: 'Built from league_players. Bye weeks are derived server-side so the stat splits never reach a browser.',
  },
  {
    key: 'league_history',
    label: 'Prior seasons (teams, schedule, settings)',
    group: 'fantasy',
    ttl: TTL.MANUAL,
    auth: true,
    tier: 'core',
    parts: (cfg) =>
      historySeasons(cfg).map((yr) => ({
        part: String(yr),
        url:
          `${FANTASY_HOST}/apis/v3/games/ffl/leagueHistory/${cfg.leagueId}` +
          `?seasonId=${yr}&view=mTeam&view=mSettings&view=mMatchupScore&view=mStandings`,
      })),
  },

  // ==========================================================
  // NFL Site API (public)
  // ==========================================================
  {
    key: 'nfl_scoreboard',
    label: 'NFL scoreboard (live)',
    group: 'nfl_site',
    ttl: TTL.LIVE,
    auth: false,
    tier: 'core',
    parts: one(`${siteBase()}/scoreboard`),
    expect: 'events',
  },
  {
    key: 'nfl_injuries',
    label: 'League-wide injury report',
    group: 'nfl_site',
    ttl: TTL.MIN_5,
    auth: false,
    tier: 'core',
    parts: one(`${siteBase()}/injuries`),
    expect: 'injuries',
  },
  {
    key: 'injuries_digest',
    label: 'Injury report, reduced for display',
    group: 'derived',
    ttl: TTL.MIN_5,
    auth: false,
    tier: 'core',
    derivedFrom: 'nfl_injuries',
    parts: () => [{ part: 'main', url: null }],
    notes: 'Built from nfl_injuries, ~42x smaller. Never fetched directly from ESPN.',
  },
  {
    key: 'nfl_news',
    label: 'NFL headline feed',
    group: 'nfl_site',
    ttl: TTL.MIN_5,
    auth: false,
    tier: 'core',
    parts: one(`${siteBase()}/news`),
    expect: 'articles',
  },
  {
    key: 'nfl_teams',
    label: 'All 32 NFL teams',
    group: 'nfl_site',
    ttl: TTL.DAY,
    auth: false,
    tier: 'core',
    parts: one(`${siteBase()}/teams`),
    expect: 'sports',
  },
  {
    key: 'nfl_transactions',
    label: 'NFL transactions (signings/trades)',
    group: 'nfl_site',
    ttl: TTL.MIN_30,
    auth: false,
    tier: 'aux',
    parts: one(`${siteBase()}/transactions`),
  },
  {
    key: 'nfl_groups',
    label: 'Conferences & divisions',
    group: 'nfl_site',
    ttl: TTL.DAY,
    auth: false,
    tier: 'aux',
    parts: one(`${siteBase()}/groups`),
  },
  {
    key: 'nfl_calendar',
    label: 'Season game-date calendar',
    group: 'nfl_core',
    ttl: TTL.DAY,
    auth: false,
    tier: 'aux',
    // The site API's bare /calendar resource 404s; the Core API's calendar/ondays
    // is the working equivalent and returns the season's actual game dates.
    parts: one(`${coreBase()}/calendar/ondays`),
  },
  {
    key: 'nfl_weeks',
    label: 'Regular-season week index',
    group: 'nfl_core',
    ttl: TTL.DAY,
    auth: false,
    tier: 'probe',
    parts: (cfg) => [
      { part: 'main', url: `${coreBase()}/seasons/${cfg.season}/types/2/weeks?limit=25` },
    ],
  },
  {
    key: 'nfl_standings',
    label: 'NFL standings (v2 path)',
    group: 'nfl_site',
    ttl: TTL.MIN_30,
    auth: false,
    tier: 'aux',
    parts: one(`${SITE_HOST}/apis/v2/sports/football/nfl/standings`),
  },
  {
    key: 'nfl_team_rosters',
    label: 'Full NFL team rosters (per team)',
    group: 'nfl_site',
    ttl: TTL.MIN_30,
    auth: false,
    tier: 'core',
    parts: perTeam((id) => `${siteBase()}/teams/${id}?enable=roster`),
  },
  {
    key: 'nfl_depth_charts',
    label: 'Depth charts (per team)',
    group: 'nfl_site',
    ttl: TTL.MIN_30,
    auth: false,
    tier: 'aux',
    parts: perTeam((id) => `${siteBase()}/teams/${id}/depthcharts`),
  },
  {
    key: 'nfl_team_schedules',
    label: 'Team schedules (per team)',
    group: 'nfl_site',
    ttl: TTL.HOUR_6,
    auth: false,
    tier: 'core',
    // Without an explicit season and seasontype this returns only the current
    // phase — in August that means preseason games and no regular season at
    // all, which silently produced an empty bye-week map.
    parts: (cfg) =>
      NFL_TEAM_IDS.map((id) => ({
        part: String(id),
        url: `${siteBase()}/teams/${id}/schedule?season=${cfg.season}&seasontype=2`,
      })),
  },

  // ==========================================================
  // NFL Core API (public)
  // ==========================================================
  {
    key: 'nfl_weekly_events',
    label: 'Weekly event index (regular season)',
    group: 'nfl_core',
    ttl: TTL.HOUR_6,
    auth: false,
    tier: 'core',
    parts: (cfg) =>
      Array.from({ length: REGULAR_SEASON_WEEKS }, (_, i) => ({
        part: String(i + 1),
        url: `${coreBase()}/seasons/${cfg.season}/types/2/weeks/${i + 1}/events?limit=100`,
      })),
  },
  {
    key: 'nfl_team_season_stats',
    label: 'Team season aggregate stats (per team)',
    group: 'nfl_core',
    ttl: TTL.HOUR_6,
    auth: false,
    tier: 'aux',
    allowEmpty: true,
    parts: (cfg) =>
      NFL_TEAM_IDS.map((id) => ({
        part: String(id),
        url: `${coreBase()}/seasons/${cfg.season}/types/2/teams/${id}/statistics`,
      })),
    notes:
      'pointsAllowed/yardsAllowed are permanent placeholder zeros here — derive from box scores. ' +
      'Returns 404 "No stats found" until the regular season is under way.',
  },
  {
    key: 'nfl_athletes_index',
    label: 'Athlete index (paginated)',
    group: 'nfl_core',
    ttl: TTL.DAY,
    auth: false,
    tier: 'aux',
    parts: (cfg) =>
      [1, 2, 3, 4].map((page) => ({
        part: String(page),
        url: `${coreBase()}/seasons/${cfg.season}/athletes?limit=1000&page=${page}`,
      })),
  },
  {
    key: 'nfl_powerindex',
    label: 'ESPN Power Index (season)',
    group: 'nfl_core',
    ttl: TTL.HOUR_6,
    auth: false,
    tier: 'probe',
    parts: (cfg) => [
      { part: 'main', url: `${coreBase()}/seasons/${cfg.season}/powerindex` },
    ],
  },
  {
    key: 'nfl_leaders',
    label: 'Statistical leaders',
    group: 'nfl_core',
    ttl: TTL.HOUR_6,
    auth: false,
    tier: 'aux',
    allowEmpty: true,
    parts: (cfg) => [
      { part: 'main', url: `${coreBase()}/seasons/${cfg.season}/types/2/leaders` },
    ],
  },
  {
    key: 'nfl_venues',
    label: 'Stadiums',
    group: 'nfl_core',
    ttl: TTL.DAY,
    auth: false,
    tier: 'probe',
    parts: one(`${coreBase()}/venues?limit=200`),
  },
  {
    key: 'nfl_franchises',
    label: 'Franchise history index',
    group: 'nfl_core',
    ttl: TTL.DAY,
    auth: false,
    tier: 'probe',
    parts: one(`${coreBase()}/franchises?limit=50`),
  },
  {
    key: 'nfl_coaches',
    label: 'Coaching staff',
    group: 'nfl_core',
    ttl: TTL.DAY,
    auth: false,
    tier: 'probe',
    parts: (cfg) => [
      { part: 'main', url: `${coreBase()}/seasons/${cfg.season}/coaches?limit=100` },
    ],
  },
  {
    key: 'nfl_draft',
    label: 'NFL draft (not fantasy)',
    group: 'nfl_core',
    ttl: TTL.DAY,
    auth: false,
    tier: 'probe',
    parts: (cfg) => [
      { part: 'main', url: `${coreBase()}/seasons/${cfg.season}/draft` },
    ],
  },
  {
    key: 'nfl_futures',
    label: 'Futures odds',
    group: 'nfl_core',
    ttl: TTL.DAY,
    auth: false,
    tier: 'probe',
    parts: (cfg) => [
      { part: 'main', url: `${coreBase()}/seasons/${cfg.season}/futures` },
    ],
  },
  {
    key: 'nfl_qbr_weekly',
    label: 'Weekly QBR (totals split)',
    group: 'nfl_core',
    ttl: TTL.HOUR_6,
    auth: false,
    tier: 'probe',
    parts: (cfg) =>
      [1, 2, 3, 4].map((w) => ({
        part: String(w),
        url: `${coreBase()}/seasons/${cfg.season}/types/2/weeks/${w}/qbr/0`,
      })),
  },

  // ==========================================================
  // CDN + real-time news
  // ==========================================================
  {
    key: 'cdn_scoreboard',
    label: 'CDN-optimized live scoreboard',
    group: 'realtime',
    ttl: TTL.LIVE,
    auth: false,
    tier: 'aux',
    parts: one(`${CDN_HOST}/core/nfl/scoreboard?xhr=1`),
  },
  {
    key: 'espn_news_nfl',
    label: 'Real-time NFL news feed',
    group: 'realtime',
    ttl: TTL.MIN_5,
    auth: false,
    tier: 'aux',
    parts: one(`${NOW_HOST}/v1/sports/news?leagues=nfl&limit=50`),
  },
  {
    key: 'espn_news_all',
    label: 'Real-time general sports news feed',
    group: 'realtime',
    ttl: TTL.MIN_5,
    auth: false,
    tier: 'probe',
    parts: one(`${NOW_HOST}/v1/sports/news?sport=football&limit=50`),
  },
  {
    key: 'nfl_athlete_stats_probe',
    label: 'Web API athlete stats shape probe',
    group: 'realtime',
    ttl: TTL.DAY,
    auth: false,
    tier: 'probe',
    parts: one(
      `${WEB_HOST}/apis/common/v3/sports/football/nfl/statistics/byathlete?limit=50`
    ),
  },
];

/**
 * Parameterised datasets — not part of the standard refresh sweep because
 * they take a runtime argument. Used by the historical game-log pull.
 */
export const PARAM_DATASETS = {
  game_summary: {
    key: 'game_summary',
    label: 'Game box score',
    ttl: TTL.MANUAL,
    auth: false,
    url: (cfg, id) => `${siteBase()}/summary?event=${encodeURIComponent(id)}`,
  },
  athlete_gamelog: {
    key: 'athlete_gamelog',
    label: 'Player game log',
    ttl: TTL.MANUAL,
    auth: false,
    url: (cfg, id) =>
      `${WEB_HOST}/apis/common/v3/sports/football/nfl/athletes/${encodeURIComponent(id)}/gamelog`,
  },
  athlete_overview: {
    key: 'athlete_overview',
    label: 'Player overview',
    ttl: TTL.MANUAL,
    auth: false,
    url: (cfg, id) =>
      `${WEB_HOST}/apis/common/v3/sports/football/nfl/athletes/${encodeURIComponent(id)}/overview`,
  },
  weekly_events: {
    key: 'weekly_events',
    label: 'Events for one week',
    ttl: TTL.MANUAL,
    auth: false,
    url: (cfg, week) =>
      `${coreBase()}/seasons/${cfg.season}/types/2/weeks/${encodeURIComponent(week)}/events?limit=100`,
  },
  /**
   * One completed scoring period of fantasy scoring.
   *
   * ESPN honours `scoringPeriodId` on the combined boxscore view — verified
   * against the live API, not assumed — so a past week comes back with its own
   * rosters, per-player applied totals and win probabilities intact. It is not
   * part of the standard sweep because a future week would answer with a valid
   * but empty payload, and caching that under a manual TTL would freeze the
   * week as permanently unplayed. Weeks are therefore pulled once each, on the
   * request that first asks for one, and only ever for weeks already played.
   */
  live_scoring_week: {
    key: 'live_scoring_week',
    label: 'One week of fantasy scoring',
    ttl: TTL.MANUAL,
    auth: true,
    url: (cfg, week) =>
      `${leagueBase(cfg)}?scoringPeriodId=${encodeURIComponent(week)}` +
      `&view=mScoreboard&view=mMatchupScore&view=mBoxscore&view=mLiveScoring`,
  },
};

const BY_KEY = new Map(DATASETS.map((d) => [d.key, d]));

export function getDataset(key) {
  return BY_KEY.get(key) || null;
}

export function allKeys() {
  return DATASETS.map((d) => d.key);
}

/**
 * Group dataset keys into batches whose total external subrequest count stays
 * under the Workers Free per-invocation ceiling of 50 external subrequests.
 */
export function planBatches(cfg, maxCalls = 30) {
  const batches = [];
  let current = [];
  let count = 0;
  for (const d of DATASETS) {
    if (d.derivedFrom) continue; // produced by its source, never fetched
    const n = d.parts(cfg).length;
    if (n >= maxCalls) {
      if (current.length) {
        batches.push(current);
        current = [];
        count = 0;
      }
      batches.push([d.key]);
      continue;
    }
    if (count + n > maxCalls) {
      batches.push(current);
      current = [];
      count = 0;
    }
    current.push(d.key);
    count += n;
  }
  if (current.length) batches.push(current);
  return batches;
}
