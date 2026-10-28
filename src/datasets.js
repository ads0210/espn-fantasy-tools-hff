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

/* Regular season plus the postseason weeks. The league's own last scoring
   period is not knowable here — this runs before any payload is read — and a
   period that does not exist simply answers with nothing. */
const SCORING_PERIODS = 18;

export function historySeasons(cfg) {
  if (Array.isArray(cfg.historySeasons) && cfg.historySeasons.length) {
    return cfg.historySeasons;
  }
  return fallbackHistorySeasons(cfg.season);
}

const FANTASY_HOST = 'https://lm-api-reads.fantasy.espn.com';
// Which of ESPN's two site edges answers Cloudflare Workers has flipped more
// than once. Until October 2026 site.api.espn.com refused Workers and
// site.web.api.espn.com answered; since then it is the other way round
// (measured through /api/_dev/probe). The registry points at the edge that
// answers so a request costs one subrequest, not two: the 32-part per-team
// datasets broke the ~50-subrequest limit while every part paid for a refusal
// first. espn.js keeps the bidirectional fallback so a future flip self-heals.
const SITE_HOST = 'https://site.api.espn.com';
const WEB_HOST = 'https://site.api.espn.com'; // common/v3 answers on the same edge

/**
 * Fetch budgets for payloads that a flat 15 seconds does not cover.
 *
 * The default suits a 35KB league view; it does not suit a 17MB player pool
 * when ESPN is under load. Measured on 2026-09-04, days before week one, a
 * 35KB view answered in 212ms on the same host and with the same cookies that
 * a 1.7MB view could not finish inside 30 seconds.
 *
 * That mattered far more than it should have. An aborted fetch is a failure, a
 * failure is retried three times, and six datasets share one prime call — so a
 * slow upstream turned into roughly two minutes per request and a pull that ran
 * past half an hour. Sizes below are the real stored sizes of a single part.
 */
const TIMEOUT = {
  LARGE: 45000,   // ~1-4MB
  HUGE: 90000,    // 8MB and up
};

const leagueBase = (cfg) =>
  `${FANTASY_HOST}/apis/v3/games/ffl/seasons/${cfg.season}/segments/0/leagues/${cfg.leagueId}`;

const siteBase = () => `${SITE_HOST}/apis/site/v2/sports/football/nfl`;

// X-Fantasy-Filter is REQUIRED on the bulk player endpoints, not optional.
const playerFilter = (limit) =>
  JSON.stringify({
    players: {
      limit,
      sortPercOwned: { sortPriority: 1, sortAsc: false },
    },
  });

/* The LLM Data Export's free-agent shortlist: how deep it goes at each
   position, and the lineup slot ESPN filters that position on. */
export const FREE_AGENT_DEPTH = { QB: 15, RB: 25, WR: 25, TE: 15, 'D/ST': 15, K: 15 };
const FREE_AGENT_SLOTS = [
  { part: 'QB', slot: 0, pos: 'QB' },
  { part: 'RB', slot: 2, pos: 'RB' },
  { part: 'WR', slot: 4, pos: 'WR' },
  { part: 'TE', slot: 6, pos: 'TE' },
  { part: 'DST', slot: 16, pos: 'D/ST' },
  { part: 'K', slot: 17, pos: 'K' },
];

/* Available players at one position, best first by ESPN's rest-of-season
   projection. No scoring period is named, so ESPN answers for the current one
   and each player carries this week's projection as well as the season's. The
   sort key names the season: "12" is a projection over the rest of it. */
const freeAgentFilter = (season, slot, limit) =>
  JSON.stringify({
    players: {
      filterStatus: { value: ['FREEAGENT', 'WAIVERS'] },
      filterSlotIds: { value: [slot] },
      limit,
      sortAppliedStatTotal: { sortAsc: false, sortPriority: 1, value: `12${season}` },
    },
  });

/* Every rostered player with his last seventeen scored games (this season's weeks and, early on, last season's),
   and the best free agents by ESPN's updated projection. Two reads carry what one read per played week would. */
const rosteredFormFilter = (season) =>
  JSON.stringify({
    players: {
      filterStatus: { value: ['ONTEAM'] },
      limit: 600,
      sortPercOwned: { sortPriority: 1, sortAsc: false },
      filterStatsForTopScoringPeriodIds: { value: 17, additionalValue: [`00${season}`, `10${season}`, `12${season}`, `00${season - 1}`] },
    },
  });
const freeFormFilter = (season) =>
  JSON.stringify({
    players: {
      filterStatus: { value: ['FREEAGENT', 'WAIVERS'] },
      limit: 150,
      sortAppliedStatTotal: { sortAsc: false, sortPriority: 1, value: `12${season}` },
      filterStatsForTopScoringPeriodIds: { value: 2, additionalValue: [`00${season}`, `12${season}`] },
    },
  });

/* Season Statistics' leaderboards: the 400 players with the most points this season, rostered or not, each with
   every week's points (D23). */
const leadersFilter = (season) =>
  JSON.stringify({
    players: {
      limit: 400,
      sortAppliedStatTotal: { sortAsc: false, sortPriority: 1, value: `00${season}` },
      filterStatsForTopScoringPeriodIds: { value: 18, additionalValue: [`00${season}`] },
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
    timeoutMs: TIMEOUT.LARGE,
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
    // Matchup Insights: how many fantasy points each NFL defence gives up to each position in this league's own
    // scoring, with its rank (32 gives up the most). About 9 KB; ESPN updates it as weeks are played.
    key: 'positional_ratings',
    label: 'Points allowed by each NFL defence, per position',
    group: 'fantasy',
    ttl: TTL.HOUR_6,
    auth: true,
    tier: 'aux',
    parts: (cfg) => [{ part: 'main', url: `${leagueBase(cfg)}?view=mPositionalRatings` }],
    expect: 'positionAgainstOpponent',
  },
  {
    key: 'matchups',
    timeoutMs: TIMEOUT.LARGE,
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
    // mTeam as well as mStandings: the win-loss record is on the team, not in
    // the standings view, and reading it from mStandings alone left every row
    // at nil and the panel claiming the season had not started.
    parts: (cfg) => [{
      part: 'main',
      url: `${leagueBase(cfg)}?view=mStandings&view=mTeam`,
    }],
    expect: 'teams',
  },
  {
    key: 'live_scoring',
    timeoutMs: TIMEOUT.LARGE,
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
    /* One part per scoring period, because mTransactions2 answers for exactly
       the period asked for and for no other. Fetched without one it returns
       whatever period the league is currently in — which is empty for most of
       a week, so the whole activity log silently vanished the moment week one
       rolled over. A past period cannot change, so the repeat fetches cost
       little and the full season stays readable however far into it a fork
       arrives. */
    parts: (cfg) => Array.from({ length: SCORING_PERIODS }, (unused, i) => ({
      part: `sp${i + 1}`,
      url: `${leagueBase(cfg)}?view=mTransactions2&scoringPeriodId=${i + 1}`,
    })),
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
    key: 'free_agent_pool',
    label: 'Best available players by position (this week)',
    group: 'fantasy',
    ttl: TTL.MIN_30,
    auth: true,
    tier: 'core',
    parts: (cfg) => FREE_AGENT_SLOTS.map((s) => ({
      part: s.part,
      url: `${leagueBase(cfg)}?view=kona_player_info`,
      headers: { 'X-Fantasy-Filter': freeAgentFilter(cfg.season, s.slot, FREE_AGENT_DEPTH[s.pos]) },
    })),
    expect: 'players',
    notes: 'Feeds the LLM Data Export. One part per position, so every position gets its full depth.',
  },
  {
    key: 'player_weeks',
    label: 'Every rostered player, week by week',
    group: 'fantasy',
    timeoutMs: TIMEOUT.LARGE,
    ttl: TTL.MIN_30,
    auth: true,
    tier: 'core',
    parts: (cfg) => [
      { part: 'rostered', url: `${leagueBase(cfg)}?view=kona_player_info`, headers: { 'X-Fantasy-Filter': rosteredFormFilter(cfg.season) } },
      { part: 'free', url: `${leagueBase(cfg)}?view=kona_player_info`, headers: { 'X-Fantasy-Filter': freeFormFilter(cfg.season) } },
      // Season Statistics (D23): every player by season points, free agents included, with weekly points.
      { part: 'leaders', url: `${leagueBase(cfg)}?view=kona_player_info`, headers: { 'X-Fantasy-Filter': leadersFilter(cfg.season) } },
    ],
    expect: 'players',
    notes: 'Feeds the Trade Analyzer. Past weeks come from ESPN whenever asked, so a site set up mid-season has them all.',
  },
  {
    key: 'season_schedule',
    label: 'Season schedule & results (lightweight)',
    group: 'fantasy',
    ttl: TTL.MIN_30,
    auth: true,
    tier: 'core',
    /* The matchup view without rosters: a tenth the size of `matchups`, which
       is what the export needs when all it wants is who plays whom and the
       final scores. */
    parts: (cfg) => [{ part: 'main', url: `${leagueBase(cfg)}?view=mMatchupScore` }],
    expect: 'schedule',
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
    key: 'league_players',
    timeoutMs: TIMEOUT.LARGE,
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
    key: 'h2h_full_digest',
    label: 'Every meeting between two teams, uncapped',
    group: 'derived',
    // Same reasoning as h2h_digest: the historical source is immutable, so
    // without a TTL of its own this would be built once and frozen, and this
    // season's meetings would never appear.
    ttl: TTL.MIN_30,
    auth: true,
    tier: 'core',
    derivedFrom: 'league_history',
    parts: () => [{ part: 'main', url: null }],
    notes: 'Deliberately separate from h2h_digest, which caps each pair at 24 games for Live Matchups.',
  },
  {
    key: 'trade_digest',
    label: 'Trade Analyzer board (teams, rosters, odds, offers)',
    group: 'derived',
    // Follows its source. Pending offers are the part that changes the minute
    // somebody proposes something, and the rosters and odds ride along with it.
    ttl: TTL.MIN_5,
    auth: true,
    // Core because a shipped tool is empty without it, which is exactly what
    // the cold-start check is for.
    tier: 'core',
    derivedFrom: 'pending_transactions',
    parts: () => [{ part: 'main', url: null }],
  },
  {
    key: 'llm_export_digest',
    label: 'LLM Data Export (whole league, one document)',
    group: 'derived',
    ttl: TTL.MIN_5,
    auth: true,
    // Core: the tool is empty without it.
    tier: 'core',
    derivedFrom: 'free_agent_pool',
    parts: () => [{ part: 'main', url: null }],
  },
  {
    key: 'league_history_digest',
    label: 'League record book',
    group: 'derived',
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
    key: 'player_form_digest',
    label: 'Player form: projections, weeks played, market',
    group: 'derived',
    ttl: TTL.MIN_30,
    auth: true,
    tier: 'core',
    derivedFrom: 'player_weeks',
    parts: () => [{ part: 'main', url: null }],
    notes: 'Built from player_weeks for the Trade Analyzer\'s rows.',
  },
  {
    key: 'depth_digest',
    label: 'Depth charts, reduced to each skill player\'s place',
    group: 'derived',
    ttl: TTL.HOUR_6,
    auth: false,
    tier: 'core',
    derivedFrom: 'nfl_depth_charts',
    parts: () => [{ part: 'main', url: null }],
    notes: 'Built from nfl_depth_charts for the Trade Analyzer\'s Role security row.',
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
    timeoutMs: TIMEOUT.HUGE,
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
    label: 'Season calendar (phases and week dates)',
    group: 'nfl_site',
    ttl: TTL.DAY,
    auth: false,
    tier: 'aux',
    // Week 6 (F1): the Core API's calendar refuses Workers. Any week's scoreboard carries the
    // whole season's calendar in leagues[0].calendar (every phase, every week's dates); week 1
    // keeps the payload the same size all season.
    parts: (cfg) => [{ part: 'main', url: `${siteBase()}/scoreboard?seasontype=2&week=1&dates=${cfg.season}` }],
    expect: 'leagues',
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
    timeoutMs: TIMEOUT.LARGE,
    label: 'Full NFL team rosters (per team)',
    group: 'nfl_site',
    ttl: TTL.MIN_30,
    auth: false,
    tier: 'core',
    parts: perTeam((id) => `${siteBase()}/teams/${id}?enable=roster`),
  },
  {
    key: 'nfl_depth_charts',
    timeoutMs: TIMEOUT.LARGE,
    label: 'Depth charts (per team)',
    group: 'nfl_site',
    ttl: TTL.HOUR_6,
    auth: false,
    tier: 'aux',
    parts: perTeam((id) => `${siteBase()}/teams/${id}/depthcharts`),
  },
  {
    key: 'nfl_team_schedules',
    timeoutMs: TIMEOUT.LARGE,
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
  // NFL data once fetched from the Core API, now from the site edge (week 6, F1)
  // ==========================================================
  {
    key: 'nfl_weekly_events',
    label: 'Every regular-season week\u2019s NFL games',
    group: 'nfl_site',
    ttl: TTL.HOUR_6,
    auth: false,
    tier: 'core',
    // Week 6 (F1): one scoreboard per week, each game with its teams, score, state, venue and odds
    // (the Core API's version held only links to the games).
    parts: (cfg) =>
      Array.from({ length: REGULAR_SEASON_WEEKS }, (_, i) => ({
        part: String(i + 1),
        url: `${siteBase()}/scoreboard?seasontype=2&week=${i + 1}&dates=${cfg.season}`,
      })),
    expect: 'events',
  },
  {
    key: 'nfl_team_season_stats',
    label: 'Team season aggregate stats (per team)',
    group: 'nfl_site',
    ttl: TTL.HOUR_6,
    auth: false,
    tier: 'aux',
    allowEmpty: true,
    timeoutMs: TIMEOUT.LARGE,
    // Week 6 (F1): the same 11 stat categories as the Core API's, from the site edge.
    parts: (cfg) =>
      NFL_TEAM_IDS.map((id) => ({
        part: String(id),
        url: `${siteBase()}/teams/${id}/statistics?season=${cfg.season}&seasontype=2`,
      })),
    expect: 'results',
  },
  {
    key: 'nfl_powerindex',
    label: 'ESPN Power Index (season)',
    group: 'nfl_site',
    ttl: TTL.HOUR_6,
    auth: false,
    tier: 'aux',
    // Week 6 (F1): FPI for all 32 teams, predictive and efficiency ratings.
    parts: (cfg) => [
      { part: 'main', url: `${SITE_HOST}/apis/fitt/v3/sports/football/nfl/powerindex?season=${cfg.season}` },
    ],
    expect: 'teams',
  },
  {
    key: 'nfl_leaders',
    label: 'Statistical leaders',
    group: 'nfl_site',
    ttl: TTL.HOUR_6,
    auth: false,
    tier: 'aux',
    allowEmpty: true,
    timeoutMs: TIMEOUT.LARGE,
    // Week 6 (F1): 16 categories, the top 10 in each. The answer is ~2.4 MB of athlete detail,
    // so nfl_leaders_digest keeps only what a page would show.
    parts: (cfg) => [
      { part: 'main', url: `${SITE_HOST}/apis/site/v3/sports/football/nfl/leaders?season=${cfg.season}&seasontype=2` },
    ],
    expect: 'leaders',
  },
  {
    key: 'nfl_leaders_digest',
    label: 'Statistical leaders, reduced (top 10 per category)',
    group: 'derived',
    ttl: TTL.HOUR_6,
    auth: false,
    tier: 'aux',
    derivedFrom: 'nfl_leaders',
    parts: () => [{ part: 'main', url: null }],
    notes: 'Built from nfl_leaders, about 50x smaller. Never fetched directly from ESPN.',
  },
  {
    key: 'nfl_qbr_weekly',
    label: 'Weekly QBR (every regular-season week)',
    group: 'nfl_site',
    ttl: TTL.HOUR_6,
    auth: false,
    tier: 'aux',
    allowEmpty: true,
    // Week 6 (F1): every week, not the four the Core API version hard-coded. A week not yet
    // played answers with an empty list, which is expected.
    parts: (cfg) =>
      Array.from({ length: REGULAR_SEASON_WEEKS }, (_, i) => ({
        part: String(i + 1),
        url: `${SITE_HOST}/apis/fitt/v3/sports/football/nfl/qbr?qbrType=weeks&week=${i + 1}&season=${cfg.season}&seasontype=2`,
      })),
    expect: 'pagination',
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
      `${siteBase()}/scoreboard?seasontype=2&week=${encodeURIComponent(week)}&dates=${cfg.season}`,
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
