/**
 * Site API: the registry.
 *
 * One list of sections and one of endpoints, each with what it answers, how often its answer can
 * change, and whether it downloads as CSV. The API, the downloads, the page's field guides and
 * the JSON Schema are all drawn from here, so none of them can describe something the tool does
 * not serve. A plain module: the Worker and the Site API page both import it.
 */

/* The tools a section follows. A section is served only while its tool is visible to members. */
export const SECTION_TOOL = {
  live: 'live-matchups', timeline: 'live-matchups',
  history: 'hall-of-fame', records: 'hall-of-fame', teamHistory: 'hall-of-fame', headToHead: 'hall-of-fame',
  fortuneTeller: 'fortune-teller', fortuneOdds: 'fortune-teller', fortuneFinishes: 'fortune-teller',
  fortuneGames: 'fortune-teller', fortunePaths: 'fortune-teller',
  tradeAnalysis: 'trade-analyzer', draftOrder: 'draft-helper',
};

/* Every section of /full, in the order an answer carries them (about first). `sec` is how often
   the site refreshes the data behind it; `live` marks the parts that follow the snapshot's own
   rebuild. `{live}` in a refresh figure reads 15 s only while the site is quiet during games. */
export const SECTIONS = [
  { key: 'about', group: 'about', what: 'League, season, week and phase; the API’s version; the key’s replacement date; the suggested pace right now; when each section was last updated; which sections are left out and why', refresh: 'Every build', sec: 60, csv: false },
  { key: 'league', group: 'league', what: 'Name, season, week and phase, the scoring format and every scoring rule, lineup slots, roster size, position limits, playoff and seeding rules, waiver and trade rules, the trade deadline, the draft', refresh: '6 h', sec: 21600, csv: false },
  { key: 'teams', group: 'league', what: 'Every team: id, name, abbreviation, record, waiver priority, moves this season', refresh: '30 min', sec: 1800, csv: true },
  { key: 'rosters', group: 'league', what: 'Every rostered player (as /rosters), plus points by week, position rank, rest-of-season projection, % owned and how acquired', refresh: '{live} in games, else 5 min', sec: 300, live: true, csv: true, rowWord: 'a row per player' },
  { key: 'standings', group: 'league', what: 'As /standings: seed, record, points for and against, streak, ESPN’s playoff odds and Fortune Teller’s', refresh: '5 min', sec: 300, csv: true },
  { key: 'schedule', group: 'league', what: 'Every matchup of the season: week, home and away team, scores, winner, state, postseason round', refresh: '30 min', sec: 1800, csv: true },
  { key: 'scoreboard', group: 'league', what: 'As /scoreboard: this week’s matchups as they stand', refresh: '{live} in games', sec: 60, live: true, csv: true },
  { key: 'players', group: 'league', what: 'The league’s player pool: id, name, position, NFL team, bye, ADP, rank, % owned, injury status, and the team that has him', refresh: '1 min', sec: 60, csv: true },
  { key: 'freeAgents', group: 'league', what: 'The best available players by position (25 RB and WR, 15 of each other), with projections and waiver status', refresh: '30 min', sec: 1800, csv: true },
  { key: 'transactions', group: 'league', what: 'Every completed add, drop and trade this season, one row per transaction', refresh: '5 min', sec: 300, csv: true },
  { key: 'trades', group: 'league', what: 'Every trade offer and its status through its life', refresh: '5 min', sec: 300, csv: true },
  { key: 'draft', group: 'league', what: 'Every pick: round, pick, overall, the team holding it, the player, keeper; draft type and date', refresh: '1 min during a draft', sec: 86400, csv: true },
  { key: 'logos', group: 'league', what: 'Each team’s logo as a small image inside the answer; the site’s shield when there is none. In /full only with ?logos=true', refresh: '5 min', sec: 300, csv: false },
  { key: 'nflTeams', group: 'nfl', what: 'All 32 NFL teams: name, record, division standing, bye week', refresh: 'Daily', sec: 86400, csv: true },
  { key: 'nflSchedule', group: 'nfl', what: 'Every NFL game’s kickoff, by week and team', refresh: 'Daily', sec: 86400, csv: true },
  { key: 'nflScoreboard', group: 'nfl', what: 'This NFL week’s games: teams, scores, state, kickoff', refresh: '{live} in games', sec: 60, live: true, csv: true },
  { key: 'injuries', group: 'nfl', what: 'The injury report for the last 30 days: player, team, status, type, date, note', refresh: '5 min', sec: 300, csv: true },
  { key: 'news', group: 'nfl', what: 'Headlines: title, time, type, link', refresh: '5 min', sec: 300, csv: true },
  { key: 'pointsAllowed', group: 'nfl', what: 'ESPN’s rating of each NFL team against each position: its rank and the average fantasy points it allows', refresh: '5 min', sec: 300, csv: true },
  { key: 'live', group: 'site', what: 'This week’s matchups in full: every lineup, each player’s points, projection and game state, and the boom and bust calls', refresh: '{live} in games; past weeks fixed', sec: 60, live: true, csv: true, weeks: true, rowWord: 'a row per player' },
  { key: 'timeline', group: 'site', what: 'How each matchup moved through the week: the score and win probability each time either changed. ESPN keeps no history of win probability', refresh: 'Each minute during games', sec: 60, live: true, csv: true, weeks: true, rowWord: 'a row per change' },
  { key: 'history', group: 'site', what: 'Champions by season and the all-time table: record, points, titles, runner-up finishes, postseason appearances, best, worst and average finish, streaks', refresh: '30 min', sec: 1800, csv: true },
  { key: 'records', group: 'site', what: 'The record book, every holder listed when tied', refresh: '30 min', sec: 1800, csv: true },
  { key: 'teamHistory', group: 'site', what: 'Every team’s history, season by season', refresh: '30 min', sec: 1800, csv: true },
  { key: 'headToHead', group: 'site', what: 'Every pair’s all-time meetings, with every game', refresh: '30 min', sec: 1800, csv: true, rowWord: 'a row per game' },
  { key: 'fortuneTeller', group: 'site', what: 'Where the simulation stands, the weeks it covers, and each team’s simulated playoff odds now', refresh: 'Weekly, after each week settles', sec: 604800, csv: true },
  { key: 'fortuneOdds', group: 'site', what: 'Each team’s simulated playoff odds after every settled week, beside ESPN’s own figure for the same week', refresh: 'Weekly', sec: 604800, csv: true, rowWord: 'a row per team per week' },
  { key: 'fortuneFinishes', group: 'site', what: 'Each team’s chance of finishing in every place after every settled week', refresh: 'Weekly', sec: 604800, csv: true, rowWord: 'a row per team per place per week' },
  { key: 'fortuneGames', group: 'site', what: 'Every remaining regular-season game, with each side’s win chance and projected score as the simulation reads them', refresh: 'Weekly', sec: 604800, csv: true },
  { key: 'fortunePaths', group: 'site', what: 'For each team: its best path, its simplest path to the playoffs, and the path where every game goes to ESPN’s projected winner', refresh: 'Weekly', sec: 604800, csv: false },
  { key: 'tradeAnalysis', group: 'site', what: 'Each offer on the table broken down row by row for both sides, at the league’s weighting, with the balance and the verdict', refresh: '5 min', sec: 300, csv: true, rowWord: 'a row per offer per row' },
  { key: 'draftOrder', group: 'site', what: 'The draft’s shape: rounds, snake or linear, pick order, every slot with the team holding it, and the league’s roster shape', refresh: '1 min during a draft', sec: 86400, csv: true },
];

export const SECTION_KEYS = SECTIONS.map((s) => s.key);
export function section(key) { return SECTIONS.find((s) => s.key === key) || null; }

/** A section's refresh figure as the reader receives it: the live parts follow the snapshot's rebuild. */
export function refreshOf(s, quiet) { return s.refresh.split('{live}').join(quiet ? '15 s' : '1 min'); }

/* The five endpoints. The refresh words and figures depend on whether games are on and whether the
   site is quiet (st = { games, quiet }). */
export const ENDPOINTS = [
  { key: 'scoreboard', path: '/scoreboard', team: true, csv: true, size: 'About 5 to 10 KB',
    sentence: 'This week’s matchups as they stand: each side’s team, score, projection and win probability, the matchup’s state and first kickoff, and how many players are yet to play, playing or done.',
    madeFor: 'Phone widgets and shortcuts, bots and smart displays during games: the job asked most often',
    refreshWords: (st) => (st.games ? (st.quiet ? 'Every 15 seconds during games' : 'Every minute during games') : 'As the week changes'),
    refresh: (st) => (st.games ? (st.quiet ? 15 : 60) : 300) },
  { key: 'standings', path: '/standings', csv: true, size: 'About 3 KB',
    sentence: 'Seed, record, points for and against, streak, ESPN’s playoff odds and Fortune Teller’s simulated odds, and clinched or eliminated once decided.',
    madeFor: 'Spreadsheets and weekly bot posts',
    refreshWords: () => 'Every 5 minutes', refresh: () => 300 },
  { key: 'rosters', path: '/rosters', team: true, csv: true, size: 'About 60 to 90 KB',
    sentence: 'Every rostered player: fantasy team, slot, position, NFL team, this week’s opponent and game state, points and projection this week, season points and average, injury status, bye.',
    madeFor: 'Lineup checks, “who’s left to play” scripts, sheets',
    refreshWords: (st) => (st.games ? 'As the scoreboard during games' : 'Every 5 minutes'),
    refresh: (st) => (st.games ? (st.quiet ? 15 : 60) : 300) },
  { key: 'activity', path: '/activity', csv: true, size: 'About 25 to 40 KB',
    sentence: 'League activity, newest first: every completed add, drop and trade this season, and every trade offer with its status through its life. Every row has a stable id and a time, so a bot can post only what is new.',
    madeFor: 'Bots and alerts: “a trade was offered”, “waivers ran”',
    refreshWords: () => 'Every 5 minutes', refresh: () => 300 },
  { key: 'full', path: '/full', csv: false, logos: true, size: 'About 0.8 to 1.2 MB of JSON; about 120 to 180 KB sent',
    sentence: 'Everything: all thirty-one sections below, plus about, in one answer.',
    madeFor: 'Scripts that keep their own copy, analysis, an assistant given one file',
    refreshWords: () => 'Each part as its section; the whole is rebuilt at most once a minute',
    refresh: (st) => (st.games ? 60 : 300) },
];
export const ENDPOINT_KEYS = ENDPOINTS.map((e) => e.key);
export function endpoint(key) { return ENDPOINTS.find((e) => e.key === key) || null; }

/** What an endpoint takes after its address, and nothing else. */
export function paramsOf(key) {
  const ep = endpoint(key);
  if (!ep) return [];
  return ['name', 'pretty'].concat(ep.csv ? ['format'] : [], ep.team ? ['team'] : [], ep.logos ? ['logos'] : []);
}

export const CONVENTIONS = ['Times are ISO 8601 in UTC.', 'Odds are fractions from 0 to 1.', 'Ids are ESPN’s own.', 'A missing value is null.'];

/* ---- CSV: the same rules for the API and the downloads -------------------------------------- */

/** A list item in a CSV cell. `names` turns a team id into its name where an item carries only ids. */
export function describe(o, names) {
  if (o == null) return '';
  if (typeof o !== 'object') return String(o);
  if (o.player) return o.player + (o.position ? ' (' + o.position + (o.nflTeam ? ', ' + o.nflTeam : '') + ')' : '');
  if (o.sends) return (o.team || '') + ': ' + o.sends.map((x) => describe(x, names)).join(', ');
  if (o.team) return o.team;
  if (o.week != null && 'winnerTeamId' in o) return 'week ' + o.week + ': ' + (o.winnerTeamId ? ((names && names[o.winnerTeamId]) || String(o.winnerTeamId)) : 'any result');
  return JSON.stringify(o);
}

/** Nested fields flatten with dots; a list becomes one cell of its items joined by '; '. */
export function flatten(o, pre, out, names) {
  out = out || {};
  for (const k of Object.keys(o)) {
    const v = o[k], name = pre ? pre + '.' + k : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, name, out, names);
    else if (Array.isArray(v)) out[name] = v.map((x) => describe(x, names)).join('; ');
    else out[name] = v;
  }
  return out;
}

/* Sections whose CSV has one row per something inside them. */
export const CSV_ROWS = {
  live: (v) => {
    const rows = [];
    for (const m of v || []) for (const side of ['home', 'away']) {
      for (const p of (m[side] && m[side].lineup) || []) {
        rows.push({ week: m.week, matchupId: m.matchupId, side, teamId: m[side].teamId, team: m[side].team, ...p });
      }
    }
    return rows;
  },
  history: (v) => (v && v.allTime) || [],
  draft: (v) => (v && v.picks) || [],
  draftOrder: (v) => (v && v.slots) || [],
  fortuneTeller: (v) => ((v && v.teams) || []).map((t) => ({ state: v.state, simulatedThroughWeek: v.simulatedThroughWeek, ...t })),
  headToHead: (v) => {
    const rows = [];
    for (const p of v || []) for (const g of p.games || []) rows.push({ teamA: p.teamA, teamAName: p.teamAName, teamB: p.teamB, teamBName: p.teamBName, ...g });
    return rows;
  },
  tradeAnalysis: (v) => {
    const rows = [];
    for (const o of v || []) for (const r of o.rows || []) rows.push({ offerId: o.offerId, teamA: o.teamA.team, teamB: o.teamB.team, ...r });
    return rows;
  },
};

export function rowsOf(key, v) {
  if (CSV_ROWS[key]) return CSV_ROWS[key](v);
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/** Formula-safe CSV: a text cell starting = + - or @ gets a leading apostrophe. */
export function csvCell(v) {
  if (v == null) return '';
  if (typeof v === 'string') {
    let s = v;
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  return String(v);
}

export function toCsv(rows, names) {
  const flat = (rows || []).map((r) => flatten(r, '', null, names));
  const cols = [];
  const seen = new Set();
  for (const r of flat) for (const k of Object.keys(r)) if (!seen.has(k)) { seen.add(k); cols.push(k); }
  return [cols.join(',')].concat(flat.map((r) => cols.map((c) => csvCell(r[c])).join(','))).join('\n') + '\n';
}

/* ---- field guides, from the data itself plus one dictionary of meanings ---------------------- */
export const MEANING = {
  matchupId: 'The matchup’s id, stable for the week', week: 'The fantasy week (scoring period)', state: 'pre, live or final',
  firstKickoff: 'When the first player in the matchup kicks off', home: 'The home side', away: 'The away side',
  teamId: 'The fantasy team’s ESPN id; names can change, ids do not', team: 'The fantasy team’s name', points: 'Fantasy points scored',
  projected: 'ESPN’s projection for the whole game or week', winProbability: 'ESPN’s chance this side wins, 0 to 1',
  yetToPlay: 'Starters whose game has not kicked off', playing: 'Starters in a game now', done: 'Starters whose game is over',
  seed: 'Playoff seed today (after the regular season, the final seed)', wins: 'Wins', losses: 'Losses', ties: 'Ties',
  pointsFor: 'Points scored this season', pointsAgainst: 'Points scored against this team', streak: 'Current run, W or L and its length',
  playoffOdds: 'ESPN’s playoff chance, 0 to 1', simPlayoffOdds: 'Fortune Teller’s exact simulated playoff chance, 0 to 1; null until a simulation has run',
  decided: '"clinched" or "eliminated" once decided, otherwise null', slot: 'Lineup slot: QB, RB, WR, TE, FLEX, D/ST, K, BE (bench) or IR',
  playerId: 'The player’s ESPN id', player: 'The player’s name', position: 'The player’s position', nflTeam: 'The NFL team, by abbreviation',
  opponent: 'This week’s opponent: “vs” at home, “at” away', gameState: 'pre, live or final', kickoff: 'Kickoff time',
  seasonPoints: 'Fantasy points this season', seasonAverage: 'Average points per game this season',
  injuryStatus: 'questionable, doubtful, out, injuredReserve, dayToDay or suspended; null when healthy', bye: 'The NFL bye week',
  id: 'A stable id: the same row keeps it for good', at: 'When it happened', kind: 'add, drop, addDrop, waiver or trade',
  status: 'completed, onTheTable, pendingApproval, rejected, withdrawn or expired', teams: 'The teams involved',
  added: 'Players added', dropped: 'Players dropped', bid: 'The FAAB bid, when the league uses a budget', sides: 'For a trade: what each side sends',
  sends: 'The players this side sends', name: 'Name', abbreviation: 'ESPN’s abbreviation', waiverPriority: 'Place in the waiver order',
  acquisitions: 'Players added this season', drops: 'Players dropped this season', trades: 'Trades completed this season',
  pointsByWeek: 'Points by week, keyed by week number', positionRank: 'Rank at his position this season', restOfSeasonProjection: 'ESPN’s rest-of-season projection',
  percentOwned: 'Share of ESPN leagues rostering him, 0 to 1', acquired: 'draft, pickup or trade', adp: 'Average draft position', rank: 'Rank',
  winnerTeamId: 'The winning team’s id; null for a tie or a game not yet final', postseasonRound: 'The postseason round, or null in the regular season',
  homePoints: 'The home side’s score at that moment', awayPoints: 'The away side’s score at that moment',
  homeWinProbability: 'The home side’s chance to win at that moment, 0 to 1', lineup: 'Every player in the lineup, in lineup order', starter: 'true for a starter',
  call: '"boom" or "bust" when the site called it, otherwise null', game: 'The NFL game, away@home', availability: 'freeAgent or onWaivers',
  waiversClear: 'When waivers clear for him', overall: 'Overall pick number', round: 'Round', pick: 'Pick within the round', keeper: 'true for a keeper',
  division: 'NFL division', divisionRank: 'Place in the division', awayScore: 'Away score', homeScore: 'Home score',
  date: 'Date', note: 'Note', type: 'Type', headline: 'The headline', description: 'The summary line', published: 'When it was published', link: 'The story’s address',
  averagePointsAllowed: 'Average fantasy points allowed to the position', season: 'The season', finish: 'Final place', champion: 'true for the champion',
  winPct: 'Winning percentage, 0 to 1', pointsPerGame: 'Points per game', championships: 'Titles', runnerUp: 'Runner-up finishes',
  postseasonAppearances: 'Seasons in the postseason', bestFinish: 'Best final place', worstFinish: 'Worst final place', averageFinish: 'Average final place',
  longestWinStreak: 'Longest winning run', longestLossStreak: 'Longest losing run', seasons: 'Seasons played', record: 'The record’s id', label: 'The record’s name',
  value: 'The record’s value', tied: 'true when several teams share it', opponentTeamId: 'The other team, where there is one',
  teamA: 'The lower team id of the pair', teamB: 'The higher team id of the pair', teamAName: 'Team A’s name', teamBName: 'Team B’s name',
  winsA: 'Team A’s wins', winsB: 'Team B’s wins', pointsA: 'Team A’s points', pointsB: 'Team B’s points', postseason: 'true for a postseason game',
  espnPlayoffOdds: 'ESPN’s playoff chance recorded that week, 0 to 1', chance: 'Chance of finishing in that place, 0 to 1', place: 'Finishing place, 1 is first',
  winChance: 'Chance this side wins, 0 to 1', tieChance: 'Chance of a tie', paths: 'Every possible set of results the simulation counted',
  weeksCovered: 'The weeks the simulation covers', simulatedThroughWeek: 'The last settled week the simulation reflects', opensAfterWeek: 'The week after which a simulation fits',
  lastSettledWeek: 'The last week whose results are final', bestPath: 'The results that give this team its best chance', simplestPath: 'The fewest results it needs',
  espnProjectedPath: 'Every game to ESPN’s projected winner', simplestNeeds: 'The simplest path in words', offerId: 'The offer’s id', proposedAt: 'When it was offered',
  weight: 'The site’s default weight for the row', leagueWeight: 'The league’s weight for the row', balance: 'The weighted balance: positive favours team A',
  verdict: 'The verdict band', rows: 'Each row of the breakdown', group: 'The row’s group', traded: 'true when the pick changed hands', originalTeamId: 'The team the pick began with',
  image: 'The logo as a small image inside the answer', builtAt: 'When this snapshot was built', apiVersion: 'The API’s version',
  updatedAt: 'When the data was last updated', refreshEverySeconds: 'How often the site refreshes it', pace: 'How often it is sensible to ask right now',
  leftOut: 'Sections not in this answer, and why', sections: 'Each section’s last update and refresh interval', side: 'home or away',
};
export const NULLTYPE = { decided: 'text or null', simPlayoffOdds: 'number or null', injuryStatus: 'text or null', winnerTeamId: 'number or null',
  bid: 'number or null', postseasonRound: 'text or null', call: 'text or null', points: 'number or null', opponent: 'text or null',
  winProbability: 'number or null', warning: 'text or null', waiversClear: 'time or null', kickoff: 'time or null', teamId: 'number or null',
  team: 'text or null', opponentTeamId: 'number or null', round: 'text or null', faabBudget: 'number or null', description: 'text or null' };
export const ALWAYS_NULLABLE = ['decided', 'simPlayoffOdds', 'injuryStatus', 'winnerTeamId', 'bid', 'postseasonRound', 'call', 'warning', 'waiversClear', 'faabBudget', 'opponentTeamId'];

export function typeOf(v) {
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) return 'list';
  if (typeof v === 'object') return 'object';
  if (typeof v === 'number') return 'number';
  if (typeof v === 'boolean') return 'true/false';
  if (/^\d{4}-\d\d-\d\dT/.test(v)) return 'time';
  return 'text';
}

/** Field, meaning, type and an example for every field of a list of rows. */
export function fieldGuide(rows) {
  const sample = {};
  const list = rows || [];
  for (const r of list.slice(0, 40)) {
    const f = flatten(r);
    for (const k of Object.keys(f)) if (!(k in sample) || sample[k] == null) sample[k] = f[k];
  }
  return Object.keys(sample).map((k) => {
    const last = k.split('.').pop();
    const v = sample[k];
    let ty = typeOf(v);
    const raw = list[0] ? k.split('.').reduce((o, p) => (o == null ? o : o[p]), list[0]) : v;
    if (Array.isArray(raw)) ty = 'list';
    if (ty === 'null') ty = NULLTYPE[last] || 'null';
    else if (NULLTYPE[last] && ALWAYS_NULLABLE.includes(last)) ty = NULLTYPE[last];
    return { field: k, meaning: MEANING[last] || '—', type: ty, example: v };
  });
}
