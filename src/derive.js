/**
 * Derived datasets.
 *
 * Some ESPN payloads are far larger than any tool needs and offer no
 * server-side filter. The league-wide injury report is the worst offender at
 * ~8.9MB: `limit` is ignored, the team-scoped resource returns `{}`, and the
 * Core API has no league-level equivalent. All three were tested against the
 * live API before concluding reduction had to happen here.
 *
 * So the raw payload is still stored byte-for-byte in R2 (cheap, and it keeps
 * the "store raw, derive later" principle intact), and a compact digest is
 * built alongside it for anything that ships to a browser.
 *
 * Measured on the deployed Free-plan Worker: 8.88MB parsed and reduced to
 * 210KB in 314ms wall, comfortably inside the CPU budget.
 */

/**
 * Team logos.
 *
 * ESPN's own CDN serves logos happily. Custom logos uploaded by league members
 * are hosted anywhere at all — image hosts, news sites, ESPN's own upload
 * service — and most of them refuse a cross-origin hotlink, which is why those
 * teams showed a blank space. Anything not on ESPN's CDN is routed through the
 * Worker, which fetches it server-side where hotlink rules do not apply and
 * substitutes a drawn placeholder if the fetch fails.
 */
function b64url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function logoUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const host = new URL(raw).hostname;
    if (/(^|\.)espncdn\.com$/.test(host)) return raw;
  } catch {
    return null;
  }
  return `/api/img?u=${b64url(raw)}`;
}

/**
 * Hosts the league's ESPN session may be attached to.
 *
 * Anchored on a label boundary so `notfantasy.espn.com` and
 * `fantasy.espn.com.example.test` do not match. Exported so the fetch path and
 * its tests share one definition rather than two that can drift apart.
 */
export function isEspnFantasyHost(host) {
  return /(^|\.)fantasy\.espn\.com$/.test(String(host || ''));
}

/**
 * A short, stable fingerprint of a logo's source URL (FNV-1a, 32-bit).
 *
 * Used as a cache-busting version, not as a security primitive. ESPN mints a
 * new UUID for every upload, so a changed source URL is a changed logo, and
 * hashing the URL gives a version that moves exactly when the image does.
 */
export function logoVersion(raw) {
  let h = 0x811c9dc5;
  const s = String(raw || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/**
 * Where a surface should load a fantasy team's logo from.
 *
 * Always the Worker's own store, never ESPN: a custom upload is behind ESPN's
 * session and a browser cannot fetch it. Null when the team has no logo, so the
 * caller renders the shield rather than requesting an image that cannot exist.
 *
 * The `v` parameter lets the response be cached immutably while still changing
 * the moment the team changes their logo.
 */
export function teamLogoUrl(teamId, raw) {
  if (teamId === null || teamId === undefined || teamId === '') return null;
  if (!raw || typeof raw !== 'string') return null;
  return `/api/logo/${encodeURIComponent(String(teamId))}?v=${logoVersion(raw)}`;
}

/** Entries older than this are dropped, bounding growth over a long season. */
const MAX_AGE_DAYS = 30;

/**
 * Reduce ESPN's full injury report to what a fantasy tool actually displays:
 * who, what position, what team, current status, and the latest note.
 * Per-player injury history is discarded — only the current entry is kept.
 */
/**
 * The ESPN athlete id for an injury entry.
 *
 * The league-wide injury report carries no `athlete.id` — verified against the
 * live payload, which is how this was found. Falling back to the injury
 * record's own id looked harmless and was not: every surface that joins an
 * injury to a roster does so on the athlete id, so the join silently matched
 * nothing and the dashboard's injury panel was empty for every team, for every
 * league, since it was written.
 *
 * The id is present twice in the payload regardless: in the headshot URL and in
 * every player link. Both are read rather than one, because a player with no
 * headshot is exactly the sort of edge case that would reintroduce the bug.
 */
function athleteIdFrom(athlete) {
  const head = athlete && athlete.headshot && athlete.headshot.href;
  if (typeof head === 'string') {
    const m = head.match(/\/(\d+)\.[a-z]+(?:\?|$)/i);
    if (m) return m[1];
  }
  for (const link of (athlete && athlete.links) || []) {
    if (typeof link.href !== 'string') continue;
    const m = link.href.match(/\/id\/(\d+)(?:\/|$)/);
    if (m) return m[1];
  }
  return null;
}

export function buildInjuryDigest(doc, { maxAgeDays = MAX_AGE_DAYS, now = Date.now() } = {}) {
  const cutoff = now - maxAgeDays * 86400000;
  const players = [];

  for (const team of (doc && doc.injuries) || []) {
    const teamName = team.displayName || '';
    const teamId = team.id || '';
    for (const inj of team.injuries || []) {
      const athlete = inj.athlete || {};
      const date = inj.date || null;

      if (date) {
        const t = Date.parse(date);
        if (Number.isFinite(t) && t < cutoff) continue;
      }

      players.push({
        id: athleteIdFrom(athlete) || athlete.id || null,
        // Kept apart from the athlete id so the two can never be confused again.
        injuryId: inj.id || null,
        name: athlete.displayName || '',
        pos: (athlete.position && (athlete.position.abbreviation || athlete.position.name)) || '',
        teamId,
        team: teamName,
        status: (inj.status || '').toUpperCase(),
        type: (inj.details && inj.details.type) || (inj.type && inj.type.description) || '',
        date,
        note: (inj.shortComment || '').slice(0, 280),
      });
    }
  }

  players.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  return {
    generatedAt: new Date(now).toISOString(),
    season: (doc && doc.season) || null,
    maxAgeDays,
    count: players.length,
    players,
  };
}

// ESPN's fixed position and NFL-team id conventions, validated against live data.
const POSITION_MAP = { 1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'D/ST' };
const PRO_TEAM_MAP = {
  1: 'ATL', 2: 'BUF', 3: 'CHI', 4: 'CIN', 5: 'CLE', 6: 'DAL', 7: 'DEN', 8: 'DET',
  9: 'GB', 10: 'TEN', 11: 'IND', 12: 'KC', 13: 'LV', 14: 'LAR', 15: 'MIA', 16: 'MIN',
  17: 'NE', 18: 'NO', 19: 'NYG', 20: 'NYJ', 21: 'PHI', 22: 'ARI', 23: 'PIT', 24: 'LAC',
  25: 'SF', 26: 'SEA', 27: 'TB', 28: 'WSH', 29: 'CAR', 30: 'JAX', 33: 'BAL', 34: 'HOU',
  0: 'FA',
};

/**
 * A player's bye week is the scoring period missing from their stat splits.
 * Derived here rather than in the browser because the stats array is the bulk
 * of the payload and exists only to answer this one question.
 */
function deriveBye(stats) {
  if (!Array.isArray(stats)) return 0;
  const counts = {};
  for (const s of stats) {
    if (s.scoringPeriodId > 0) counts[s.scoringPeriodId] = (counts[s.scoringPeriodId] || 0) + 1;
  }
  const entries = Object.entries(counts);
  if (!entries.length) return 0;
  const max = Math.max(...entries.map(([, c]) => c));
  const bye = entries.find(([, c]) => c < max);
  return bye ? Number(bye[0]) : 0;
}

/**
 * Reduce the bulk player pool to the fields a draft tool actually renders.
 *
 * The raw pool is ~3.5MB league-scoped and ~17MB from league defaults, almost
 * all of it per-week stat splits. Shipping that to a phone on every page load
 * is the difference between a tool that works at a draft and one that does not.
 */
export function buildPlayerDigest(doc, ctx = {}) {
  const byeMap = ctx.byeMap || {};
  const players = [];
  for (const entry of (doc && doc.players) || []) {
    const p = entry.player || {};
    const ranks = p.draftRanksByRankType || {};
    players.push({
      id: p.id,
      name: p.fullName || 'Unknown Player',
      pos: POSITION_MAP[p.defaultPositionId] || 'FLEX',
      nfl: PRO_TEAM_MAP[p.proTeamId] ?? 'FA',
      // Prefer the stat-split derivation; fall back to the team's scheduled bye.
      // Before a season starts ESPN publishes no weekly splits at all, so the
      // splits alone leave every bye blank right when a draft needs them most.
      bye: deriveBye(p.stats) || byeMap[PRO_TEAM_MAP[p.proTeamId]] || 0,
      adp: (p.ownership && p.ownership.averageDraftPosition) ?? 999,
      rank: (ranks.PPR && ranks.PPR.rank) ?? (ranks.STANDARD && ranks.STANDARD.rank) ?? 999,
      percentOwned: (p.ownership && p.ownership.percentOwned) ?? 0,
      injuryStatus: p.injuryStatus || 'ACTIVE',
      onTeamId: entry.onTeamId ?? 0,
    });
  }
  players.sort((a, b) => a.adp - b.adp);
  return { generatedAt: new Date().toISOString(), count: players.length, players };
}

/**
 * Work out each NFL team's bye week from its schedule: across the 18 regular
 * season weeks, a team's bye is simply the week it has no game.
 */
export async function buildByeWeeks(ctx) {
  const { env, teamIds, readPart } = ctx;
  const byes = {};
  const problems = [];

  for (const id of teamIds) {
    let doc;
    try {
      doc = await readPart(String(id));
    } catch {
      doc = null;
    }
    if (!doc) { problems.push(`team ${id}: not stored`); continue; }

    const abbrev = (doc.team && doc.team.abbreviation) || PRO_TEAM_MAP[id];
    const played = new Set();
    for (const ev of doc.events || []) {
      // ESPN is inconsistent here: seasonType.type comes back as a number in
      // some responses and a string in others, and `week` is sometimes an
      // object and sometimes a bare number. Normalise both rather than trust
      // one shape.
      const rawType = ev.seasonType && ev.seasonType.type;
      const type = rawType === undefined || rawType === null ? 2 : Number(rawType);
      const rawWeek = ev.week;
      const week = Number(rawWeek && typeof rawWeek === 'object' ? rawWeek.number : rawWeek);
      if (type === 2 && Number.isFinite(week) && week >= 1 && week <= 18) played.add(week);
    }
    if (!abbrev || played.size === 0) { problems.push(`team ${id}: no regular season games`); continue; }

    for (let week = 1; week <= 18; week++) {
      if (!played.has(week)) { byes[abbrev] = week; break; }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    count: Object.keys(byes).length,
    byes,
    problems,
  };
}

/**
 * Reduce the NFL scoreboard to what a ticker shows.
 *
 * Logos are taken from the payload rather than assembled from a guessed URL
 * pattern, so they keep working if ESPN reorganises its asset hosts. Scores are
 * omitted entirely before kickoff — a row of 0-0 reads as a result rather than
 * a fixture.
 */
export function buildScoreboardDigest(doc) {
  const games = (doc && doc.events || []).map((e) => {
    const comp = (e.competitions && e.competitions[0]) || {};
    const cs = comp.competitors || [];
    const home = cs.find((c) => c.homeAway === 'home') || {};
    const away = cs.find((c) => c.homeAway === 'away') || {};
    const st = (e.status && e.status.type) || {};
    const started = st.state !== 'pre';
    return {
      home: (home.team && home.team.abbreviation) || '?',
      away: (away.team && away.team.abbreviation) || '?',
      homeLogo: logoUrl((home.team && home.team.logo) || null),
      awayLogo: logoUrl((away.team && away.team.logo) || null),
      homeScore: started ? String(home.score ?? '0') : null,
      awayScore: started ? String(away.score ?? '0') : null,
      state: st.shortDetail || st.description || '',
      inProgress: st.state === 'in',
      final: st.state === 'post',
      started,
      kickoff: e.date || null,
    };
  });

  // Team abbreviation to kickoff, so a lineup can be resolved to its first game.
  const kickoffs = {};
  for (const g of games) {
    if (!g.kickoff) continue;
    for (const ab of [g.home, g.away]) {
      if (ab && ab !== '?' && !kickoffs[ab]) kickoffs[ab] = g.kickoff;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    count: games.length,
    live: games.filter((g) => g.inProgress).length,
    kickoffs,
    games,
  };
}

/**
 * Reduce the fantasy schedule to this week's matchups.
 *
 * The matchup payload carries team ids only, so names and logos are joined from
 * the much smaller teams payload. Scores are suppressed until at least one side
 * has scored, for the same reason as the NFL ticker.
 */
export function buildMatchupDigest(doc, ctx = {}) {
  const teamsDoc = (ctx.sources && ctx.sources.league_teams) || null;
  const teams = {};
  if (teamsDoc) {
    const members = {};
    for (const m of teamsDoc.members || []) members[m.id] = m;
    for (const t of teamsDoc.teams || []) {
      const o = members[(t.owners || [])[0]];
      teams[t.id] = {
        name: t.name || `Team ${t.id}`,
        abbrev: t.abbrev || '',
        logo: t.logo || null,
        owner: o ? (`${o.firstName || ''} ${o.lastName || ''}`.trim() || o.displayName || '') : '',
      };
    }
  }

  const period = (doc && doc.status && doc.status.currentMatchupPeriod)
    || (doc && doc.scoringPeriodId) || 1;

  const side = (s) => {
    const info = teams[s && s.teamId] || {};
    return {
      teamId: (s && s.teamId) || null,
      name: info.name || `Team ${(s && s.teamId) || '?'}`,
      abbrev: info.abbrev || '',
      owner: info.owner || '',
      logo: teamLogoUrl(s && s.teamId, info.logo),
      points: Number((s && s.totalPoints) || 0),
    };
  };

  const games = (doc && doc.schedule || [])
    .filter((m) => m.matchupPeriodId === period)
    .map((m) => {
      const home = side(m.home);
      const away = side(m.away);
      const started = home.points > 0 || away.points > 0;
      return {
        home, away, started,
        winner: m.winner && m.winner !== 'UNDECIDED' ? m.winner : null,
        period,
      };
    });

  return {
    generatedAt: new Date().toISOString(),
    matchupPeriod: period,
    // Whether the team identity payload was available to join against. A digest
    // built without it carries only numeric ids, and a surface that renders
    // "Team 1" reads as real data rather than as data that has not arrived.
    identified: Boolean(teamsDoc),
    count: games.length,
    games,
  };
}

// ESPN lineup slots. Anything outside bench and injured reserve is a starter.
const BENCH_SLOTS = new Set([20, 21]);
const SLOT_NAMES = {
  0: 'QB', 2: 'RB', 3: 'RB/WR', 4: 'WR', 5: 'WR/TE', 6: 'TE', 7: 'OP',
  16: 'D/ST', 17: 'K', 20: 'BE', 21: 'IR', 23: 'FLEX',
};

/** Records and points, joined to team identity. */
export function buildStandingsDigest(doc, ctx = {}) {
  const teamsDoc = (ctx.sources && ctx.sources.league_teams) || null;
  const identity = {};
  if (teamsDoc) {
    const members = {};
    for (const m of teamsDoc.members || []) members[m.id] = m;
    for (const t of teamsDoc.teams || []) {
      const o = members[(t.owners || [])[0]];
      identity[t.id] = {
        name: t.name || `Team ${t.id}`,
        abbrev: t.abbrev || '',
        logo: teamLogoUrl(t.id, t.logo),
        owner: o ? (`${o.firstName || ''} ${o.lastName || ''}`.trim() || o.displayName || '') : '',
      };
    }
  }

  const rows = (doc && doc.teams || []).map((t) => {
    const overall = (t.record && t.record.overall) || {};
    const info = identity[t.id] || {};
    return {
      teamId: t.id,
      name: info.name || t.name || `Team ${t.id}`,
      abbrev: info.abbrev || '',
      owner: info.owner || '',
      logo: info.logo || null,
      wins: overall.wins || 0,
      losses: overall.losses || 0,
      ties: overall.ties || 0,
      pointsFor: Math.round((overall.pointsFor || 0) * 10) / 10,
      pointsAgainst: Math.round((overall.pointsAgainst || 0) * 10) / 10,
      seed: t.playoffSeed || 0,
      streak: overall.streakLength && overall.streakType
        ? `${overall.streakType === 'WIN' ? 'W' : 'L'}${overall.streakLength}` : '',
    };
  });

  rows.sort((a, b) =>
    (b.wins - a.wins) || (a.losses - b.losses) || (b.pointsFor - a.pointsFor));
  rows.forEach((r, i) => { r.rank = i + 1; });

  // A table of 0-0 records is not standings, it is a season that has not begun.
  const played = rows.some((r) => r.wins + r.losses + r.ties > 0);

  return {
    generatedAt: new Date().toISOString(),
    started: played,
    identified: Boolean(teamsDoc),
    count: rows.length,
    rows,
  };
}

/** Per-team rosters, reduced to lineup identity. */
export function buildRosterDigest(doc) {
  const teams = {};
  for (const t of (doc && doc.teams) || []) {
    const entries = ((t.roster && t.roster.entries) || []).map((e) => {
      const p = (e.playerPoolEntry && e.playerPoolEntry.player) || {};
      const slot = e.lineupSlotId;
      return {
        id: p.id ?? e.playerId ?? null,
        name: p.fullName || 'Unknown Player',
        pos: POSITION_MAP[p.defaultPositionId] || 'FLEX',
        nfl: PRO_TEAM_MAP[p.proTeamId] ?? 'FA',
        slot: SLOT_NAMES[slot] || String(slot),
        starter: !BENCH_SLOTS.has(slot),
        injuryStatus: p.injuryStatus || 'ACTIVE',
      };
    });
    teams[t.id] = entries;
  }
  return { generatedAt: new Date().toISOString(), count: Object.keys(teams).length, teams };
}

/** Adds, drops and trades, resolved to readable names. */
export function buildTransactionDigest(doc, ctx = {}) {
  const teamsDoc = (ctx.sources && ctx.sources.league_teams) || null;
  const playersDoc = (ctx.sources && ctx.sources.player_digest) || null;

  const teamName = {};
  for (const t of (teamsDoc && teamsDoc.teams) || []) teamName[t.id] = t.name || `Team ${t.id}`;

  const playerName = {};
  for (const p of (playersDoc && playersDoc.players) || []) playerName[p.id] = p;

  const raw = (doc && (doc.transactions || doc.items)) || [];
  const out = [];

  for (const tx of raw) {
    const when = tx.proposedDate || tx.processDate || tx.date || null;
    for (const item of tx.items || []) {
      const kind = String(item.type || tx.type || '').toUpperCase();
      // Lineup shuffles are noise, and draft picks would bury genuine roster
      // moves under a whole draft's worth of rows. The draft has its own tool.
      if (kind === 'LINEUP' || kind === 'DRAFT') continue;
      const p = playerName[item.playerId] || null;
      out.push({
        id: `${tx.id || ''}-${item.playerId || ''}-${kind}`,
        kind: kind === 'ADD' ? 'ADD' : kind === 'DROP' ? 'DROP' : kind,
        player: p ? p.name : (item.playerId ? `Player ${item.playerId}` : 'Unknown'),
        pos: p ? p.pos : '',
        nfl: p ? p.nfl : '',
        team: teamName[item.toTeamId] || teamName[item.fromTeamId] || teamName[tx.teamId] || '',
        source: String(tx.type || '').replace(/_/g, ' ').toLowerCase(),
        date: when ? new Date(when).toISOString() : null,
      });
    }
  }

  out.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  return {
    generatedAt: new Date().toISOString(),
    identified: Boolean(teamsDoc) && Boolean(playersDoc),
    count: out.length,
    items: out.slice(0, 120),
  };
}

/**
 * Reduce the combined live-scoring view to everything Live Matchups renders.
 *
 * This is the largest reduction on the platform after the injury report, and it
 * is the one that most needs to happen at refresh time rather than on the
 * request path: the source is ~350KB at rest and every expansion in the tool
 * reads from it, several times a minute, for ten people at once.
 *
 * Field choices are grounded in a real authenticated payload rather than
 * inferred from the view names — every one of these was checked against a live
 * pull before being relied on:
 *
 *   - `winProbability` is real, sits on each side of a matchup, and is a
 *     fraction of 1 (0.51 / 0.49). It is ESPN's own number, used directly, as
 *     the plan requires — nothing here recomputes it.
 *   - A player's weekly numbers live in `player.stats[]`, keyed by
 *     `statSourceId` (0 actual, 1 projected) and `statSplitTypeId` (1 weekly).
 *     `playerPoolEntry.appliedStatTotal` carries the same actual figure and is
 *     preferred when present, because it is what ESPN itself scores the roster
 *     entry on.
 *   - `totalPointsLive` / `totalProjectedPointsLive` track in-flight scoring;
 *     they equal the settled figures once a week is over, so the live pair is
 *     used throughout and no branch on matchup state is needed.
 */

// ESPN scores a starting lineup by slot, so the position breakdown has to group
// by slot rather than by the player's nominal position — a running back in the
// flex counts toward FLEX, which is what the lineup table shows.
const POS_GROUPS = [
  ['QB', [0]],
  ['RB', [2, 3]],
  ['WR', [4, 5]],
  ['TE', [6]],
  ['FLX', [23, 7]],
  ['D/K', [16, 17]],
];

function weeklyStat(player, scoringPeriodId, sourceId) {
  for (const s of (player && player.stats) || []) {
    if (s.statSourceId !== sourceId) continue;
    if (s.statSplitTypeId !== 1) continue;
    if (scoringPeriodId && s.scoringPeriodId !== scoringPeriodId) continue;
    return Number(s.appliedTotal || 0);
  }
  return null;
}

const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;

/**
 * The best score this roster could have produced, given what everyone actually
 * scored. Slots are filled most-constrained-first: a flex can take almost
 * anybody, so filling it early would strand a player who had only one home.
 */
function optimalTotal(all, slotIds) {
  const pool = all.map((p) => ({ ...p }));
  const eligibleFor = (slot) => pool.filter((p) => !p.used && p.eligible.includes(slot));
  const order = slotIds
    .map((slot) => ({ slot, n: eligibleFor(slot).length }))
    .sort((a, b) => a.n - b.n);
  let total = 0;
  for (const { slot } of order) {
    const candidates = eligibleFor(slot).sort((a, b) => b.points - a.points);
    if (!candidates.length) continue;
    candidates[0].used = true;
    total += candidates[0].points;
  }
  return round1(total);
}

export function buildLiveScoringDigest(doc, ctx = {}) {
  const teamsDoc = (ctx.sources && ctx.sources.league_teams) || null;
  const standings = (ctx.sources && ctx.sources.standings_digest) || null;
  const board = (ctx.sources && ctx.sources.scoreboard_digest) || null;
  const week = Number(ctx.week || (doc && doc.scoringPeriodId) || 1);

  const identity = {};
  if (teamsDoc) {
    const members = {};
    for (const m of teamsDoc.members || []) members[m.id] = m;
    for (const t of teamsDoc.teams || []) {
      const o = members[(t.owners || [])[0]];
      identity[t.id] = {
        name: t.name || `Team ${t.id}`,
        abbrev: t.abbrev || '',
        logo: teamLogoUrl(t.id, t.logo),
        owner: o ? (`${o.firstName || ''} ${o.lastName || ''}`.trim() || o.displayName || '') : '',
      };
    }
  }

  const seasonRow = {};
  for (const r of (standings && standings.rows) || []) seasonRow[r.teamId] = r;

  // NFL game state, by team abbreviation. A player's live/final/upcoming dot and
  // the "NFL games in play" section both resolve through this one map.
  const gameByTeam = {};
  for (const g of (board && board.games) || []) {
    const entry = {
      key: `${g.away}@${g.home}`,
      away: g.away, home: g.home,
      awayScore: g.awayScore, homeScore: g.homeScore,
      state: g.state, kickoff: g.kickoff,
      status: g.final ? 'final' : (g.inProgress ? 'live' : 'pre'),
    };
    if (g.home && g.home !== '?') gameByTeam[g.home] = entry;
    if (g.away && g.away !== '?') gameByTeam[g.away] = entry;
  }

  const readSide = (s) => {
    const info = identity[s && s.teamId] || {};
    const row = seasonRow[s && s.teamId] || null;
    const roster =
      (s && s.rosterForCurrentScoringPeriod && s.rosterForCurrentScoringPeriod.entries) ||
      (s && s.rosterForMatchupPeriod && s.rosterForMatchupPeriod.entries) || [];

    const players = roster.map((e) => {
      const p = (e.playerPoolEntry && e.playerPoolEntry.player) || {};
      const slot = e.lineupSlotId;
      const nfl = PRO_TEAM_MAP[p.proTeamId] ?? 'FA';
      const game = gameByTeam[nfl] || null;
      const actual = e.playerPoolEntry && e.playerPoolEntry.appliedStatTotal !== undefined
        ? Number(e.playerPoolEntry.appliedStatTotal)
        : (weeklyStat(p, week, 0) || 0);
      return {
        id: p.id ?? e.playerId ?? null,
        name: p.fullName || 'Unknown Player',
        pos: POSITION_MAP[p.defaultPositionId] || 'FLEX',
        nfl,
        slot: SLOT_NAMES[slot] || String(slot),
        slotId: slot,
        eligible: Array.isArray(p.eligibleSlots) ? p.eligibleSlots : [],
        starter: !BENCH_SLOTS.has(slot),
        injury: p.injuryStatus && p.injuryStatus !== 'ACTIVE' ? p.injuryStatus : '',
        points: round1(actual),
        proj: round1(weeklyStat(p, week, 1) || 0),
        game: game ? game.key : null,
        gameStatus: game ? game.status : 'pre',
        gameState: game ? game.state : '',
        kickoff: game ? game.kickoff : null,
      };
    });

    const starters = players.filter((p) => p.starter);
    const bench = players.filter((p) => !p.starter);

    const byPos = {};
    for (const [label, slots] of POS_GROUPS) {
      const inGroup = starters.filter((p) => slots.includes(p.slotId));
      if (inGroup.length) byPos[label] = round1(inGroup.reduce((a, p) => a + p.points, 0));
    }
    byPos.BN = round1(bench.reduce((a, p) => a + p.points, 0));

    const scored = [...starters].sort((a, b) => b.points - a.points);
    const counts = {
      live: starters.filter((p) => p.gameStatus === 'live').length,
      final: starters.filter((p) => p.gameStatus === 'final').length,
      upcoming: starters.filter((p) => p.gameStatus === 'pre').length,
    };

    const points = round1(s && (s.totalPointsLive ?? s.totalPoints));
    byPos.SUM = round1(points + byPos.BN);

    return {
      teamId: (s && s.teamId) || null,
      name: info.name || `Team ${(s && s.teamId) || '?'}`,
      abbrev: info.abbrev || '',
      owner: info.owner || '',
      logo: info.logo || null,
      points,
      projected: round1(s && (s.totalProjectedPointsLive ?? s.totalProjectedPoints)),
      // ESPN's own metric, expressed as a percentage for display only.
      winProb: s && typeof s.winProbability === 'number'
        ? Math.round(s.winProbability * 1000) / 10 : null,
      record: row ? `${row.wins}-${row.losses}${row.ties ? '-' + row.ties : ''}` : '',
      streak: row ? row.streak : '',
      seed: row ? row.rank : null,
      pointsFor: row ? row.pointsFor : null,
      pointsAgainst: row ? row.pointsAgainst : null,
      starters,
      bench,
      benchPoints: byPos.BN,
      byPos,
      counts,
      optimal: optimalTotal(players, starters.map((p) => p.slotId)),
      top: scored[0] || null,
      bottom: scored.length > 1 ? scored[scored.length - 1] : null,
      avgPerStarter: starters.length ? round1(points / starters.length) : 0,
    };
  };

  const period = Number(
    (doc && doc.status && doc.status.currentMatchupPeriod) || (doc && doc.scoringPeriodId) || 1
  );
  const wantPeriod = Number(ctx.matchupPeriod || period);

  const games = (doc && doc.schedule || [])
    .filter((m) => m.matchupPeriodId === wantPeriod)
    .map((m) => {
      const home = readSide(m.home);
      const away = readSide(m.away);
      const anyLive = home.counts.live + away.counts.live > 0;
      const anyPlayed = home.counts.final + away.counts.final > 0;
      const decided = m.winner && m.winner !== 'UNDECIDED';
      const allDone = home.counts.upcoming + away.counts.upcoming === 0 &&
        home.counts.live + away.counts.live === 0 && anyPlayed;

      // Which NFL fixtures actually matter to this matchup, and who is in them.
      const involved = new Map();
      for (const [sideKey, side] of [['home', home], ['away', away]]) {
        for (const p of side.starters) {
          if (!p.game) continue;
          if (!involved.has(p.game)) {
            const g = gameByTeam[p.nfl];
            involved.set(p.game, {
              key: p.game, away: g.away, home: g.home,
              awayScore: g.awayScore, homeScore: g.homeScore,
              state: g.state, status: g.status, kickoff: g.kickoff,
              players: [],
            });
          }
          involved.get(p.game).players.push({
            name: p.name, points: p.points, proj: p.proj, side: sideKey, team: side.name,
          });
        }
      }
      const nflGames = [...involved.values()].sort((a, b) =>
        String(a.kickoff || '').localeCompare(String(b.kickoff || '')));
      for (const g of nflGames) g.players.sort((a, b) => b.points - a.points);

      // Boom and bust are measured against each player's own projection, so a
      // low-projection player who doubles it is as notable as a star who did.
      const swings = [...home.starters.map((p) => ({ ...p, team: home.name })),
                      ...away.starters.map((p) => ({ ...p, team: away.name }))]
        .filter((p) => p.proj >= 1 && p.gameStatus !== 'pre')
        .map((p) => ({ ...p, delta: Math.round(((p.points - p.proj) / p.proj) * 100) }));

      let firstKickoff = null;
      for (const p of [...home.starters, ...away.starters]) {
        if (!p.kickoff) continue;
        if (!firstKickoff || p.kickoff < firstKickoff) firstKickoff = p.kickoff;
      }

      return {
        id: m.id,
        period: wantPeriod,
        firstKickoff,
        playoff: m.playoffTierType && m.playoffTierType !== 'NONE' ? m.playoffTierType : null,
        winner: decided ? m.winner : null,
        state: decided || allDone ? 'final' : (anyLive || anyPlayed ? 'live' : 'pre'),
        home,
        away,
        nflGames,
        boom: swings.filter((p) => p.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 4),
        bust: swings.filter((p) => p.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 4),
      };
    });

  const status = (doc && doc.status) || {};
  return {
    generatedAt: new Date().toISOString(),
    season: (doc && doc.seasonId) || null,
    matchupPeriod: wantPeriod,
    scoringPeriod: week,
    weeks: {
      first: status.firstScoringPeriod || 1,
      latest: status.latestScoringPeriod || wantPeriod,
      final: status.finalScoringPeriod || null,
      current: status.currentMatchupPeriod || wantPeriod,
    },
    // Same contract as every other digest: false means identity has not
    // arrived, so a surface says so rather than rendering "Team 1".
    identified: Boolean(teamsDoc),
    seasonContext: Boolean(standings),
    count: games.length,
    games,
  };
}

/**
 * All-time meetings between every pair of teams.
 *
 * Built from the historical seasons rather than from the live week, because
 * that is the point of it: a head-to-head record is the one thing on the
 * matchup card that does not change when the scoreboard does. Each past season
 * arrives as its own part, so this reads the parts directly.
 *
 * Teams are keyed by ESPN's team id, which is stable across seasons within a
 * league. Names are recorded per season alongside the result, since a team that
 * renamed itself still played the games it played under the old name.
 */
export async function buildHeadToHeadHistory({ teamIds, readPart, readCurrent }) {
  const pairs = {};
  const names = {};
  let seasons = 0;

  const pairKey = (a, b) => (a < b ? `${a}:${b}` : `${b}:${a}`);

  for (const part of teamIds || []) {
    let doc = null;
    try { doc = await readPart(part); } catch { doc = null; }
    // leagueHistory answers with an array holding one season.
    const season = Array.isArray(doc) ? doc[0] : doc;
    if (!season || !Array.isArray(season.schedule)) continue;
    seasons += 1;

    const year = season.seasonId || Number(part) || null;
    for (const t of season.teams || []) {
      if (!names[t.id]) names[t.id] = {};
      names[t.id][year] = t.name ||
        `${t.location || ''} ${t.nickname || ''}`.trim() || `Team ${t.id}`;
    }

    for (const m of season.schedule) {
      const h = m.home, a = m.away;
      if (!h || !a || h.teamId == null || a.teamId == null) continue;
      const hp = Number(h.totalPoints || 0);
      const ap = Number(a.totalPoints || 0);
      // A fixture with no points on either side was never played.
      if (!hp && !ap) continue;

      const key = pairKey(h.teamId, a.teamId);
      const [lowId] = key.split(':').map(Number);
      // Stored low-id-first so a pair reads the same whoever asks for it.
      const lowIsHome = h.teamId === lowId;
      if (!pairs[key]) pairs[key] = { lowWins: 0, highWins: 0, ties: 0, lowPoints: 0, highPoints: 0, games: [] };
      const rec = pairs[key];
      const lowPts = lowIsHome ? hp : ap;
      const highPts = lowIsHome ? ap : hp;
      rec.lowPoints = Math.round((rec.lowPoints + lowPts) * 10) / 10;
      rec.highPoints = Math.round((rec.highPoints + highPts) * 10) / 10;
      if (lowPts > highPts) rec.lowWins += 1;
      else if (highPts > lowPts) rec.highWins += 1;
      else rec.ties += 1;
      rec.games.push({
        season: year, week: m.matchupPeriodId || null,
        lowPts: Math.round(lowPts * 10) / 10,
        highPts: Math.round(highPts * 10) / 10,
        playoff: m.playoffTierType && m.playoffTierType !== 'NONE' ? m.playoffTierType : null,
      });
    }
  }

  /*
   * This season's completed meetings, folded in on the same terms.
   *
   * The historical parts stop at last season, so without this two teams who met
   * in week one would show no record at all when they met again in week ten —
   * the meeting that matters most to anyone reading the card would be the one
   * missing from it. Only fixtures with points on the board are counted, which
   * is what keeps the rest of the season's empty schedule out.
   */
  let current = null;
  try { current = readCurrent ? await readCurrent() : null; } catch { current = null; }
  if (current && Array.isArray(current.schedule)) {
    const year = current.seasonId || null;
    for (const t of current.teams || []) {
      if (!names[t.id]) names[t.id] = {};
      names[t.id][year] = t.name ||
        `${t.location || ''} ${t.nickname || ''}`.trim() || `Team ${t.id}`;
    }
    for (const m of current.schedule) {
      const h = m.home, a = m.away;
      if (!h || !a || h.teamId == null || a.teamId == null) continue;
      const hp = Number(h.totalPoints || 0);
      const ap = Number(a.totalPoints || 0);
      if (!hp && !ap) continue;
      // A match still being played is not yet a head-to-head result.
      if (!m.winner || m.winner === 'UNDECIDED') continue;

      const key = pairKey(h.teamId, a.teamId);
      const [lowId] = key.split(':').map(Number);
      const lowIsHome = h.teamId === lowId;
      if (!pairs[key]) pairs[key] = { lowWins: 0, highWins: 0, ties: 0, lowPoints: 0, highPoints: 0, games: [] };
      const rec = pairs[key];
      const lowPts = lowIsHome ? hp : ap;
      const highPts = lowIsHome ? ap : hp;
      rec.lowPoints = Math.round((rec.lowPoints + lowPts) * 10) / 10;
      rec.highPoints = Math.round((rec.highPoints + highPts) * 10) / 10;
      if (lowPts > highPts) rec.lowWins += 1;
      else if (highPts > lowPts) rec.highWins += 1;
      else rec.ties += 1;
      rec.games.push({
        season: year, week: m.matchupPeriodId || null,
        lowPts: Math.round(lowPts * 10) / 10,
        highPts: Math.round(highPts * 10) / 10,
        playoff: m.playoffTierType && m.playoffTierType !== 'NONE' ? m.playoffTierType : null,
      });
    }
  }

  // Newest first, and capped: a card shows a handful, and an uncapped list
  // would grow without limit for a league that runs for years.
  for (const key of Object.keys(pairs)) {
    pairs[key].games.sort((x, y) =>
      (y.season - x.season) || ((y.week || 0) - (x.week || 0)));
    pairs[key].games = pairs[key].games.slice(0, 24);
  }

  return {
    generatedAt: new Date().toISOString(),
    seasons,
    currentSeasonIncluded: Boolean(current && Array.isArray(current.schedule)),
    names,
    pairCount: Object.keys(pairs).length,
    pairs,
  };
}

/* ============================================================================
 * Hall of Fame
 * ==========================================================================*/

/**
 * Turn ESPN's bracket type into the round a reader would name.
 *
 * `playoffTierType` says which bracket a fixture belongs to, never which round
 * of it — every game of the championship bracket, semifinal and final alike,
 * comes back as WINNERS_BRACKET. A game log that repeats that string for three
 * different rounds tells the reader nothing, so the round is reconstructed from
 * position instead: the winners bracket is counted back from the season's last
 * playoff week, and a consolation ladder is counted forward from its first.
 *
 * Deliberately not attempted: a placement-specific label such as "5th Place
 * Game". That needs the consolation bracket's real seeding, which is not
 * present in the payload, and a wrong placement reads as fact.
 */
export function playoffRoundLabel(tier, week, { firstPlayoffWeek, lastPlayoffWeek }) {
  if (!tier || tier === 'NONE') return null;
  const fromEnd = Number(lastPlayoffWeek) - Number(week);
  const isWinners = String(tier).toUpperCase().includes('WINNER');
  if (isWinners) {
    if (fromEnd <= 0) return 'Championship';
    if (fromEnd === 1) return 'Semifinal';
    if (fromEnd === 2) return 'Quarterfinal';
    return `Playoff Round ${Number(week) - Number(firstPlayoffWeek) + 1}`;
  }
  if (fromEnd <= 0) return 'Consolation Final';
  if (fromEnd === 1) return 'Consolation Semifinal';
  return `Consolation Round ${Number(week) - Number(firstPlayoffWeek) + 1}`;
}

const pairKeyOf = (a, b) => (a < b ? `${a}:${b}` : `${b}:${a}`);
const r1 = (n) => Math.round(Number(n || 0) * 10) / 10;

function displayName(t) {
  return t.name || `${t.location || ''} ${t.nickname || ''}`.trim() || `Team ${t.id}`;
}

/**
 * Walk every stored season plus the live one, yielding a normalised view of
 * each. Both Hall of Fame digests read history the same way, so the traversal
 * lives in one place rather than being written twice and drifting.
 */
async function eachSeason({ teamIds, readPart, readCurrent }, visit) {
  const parts = [...(teamIds || [])].sort();
  for (const part of parts) {
    let doc = null;
    try { doc = await readPart(part); } catch { doc = null; }
    const season = Array.isArray(doc) ? doc[0] : doc;
    if (!season || !Array.isArray(season.schedule)) continue;
    visit(season, season.seasonId || Number(part) || null, false);
  }
  let current = null;
  try { current = readCurrent ? await readCurrent() : null; } catch { current = null; }
  if (current && Array.isArray(current.schedule)) {
    visit(current, current.seasonId || null, true);
  }
  return Boolean(current && Array.isArray(current.schedule));
}

/**
 * Played fixtures only, with the round already named.
 *
 * Each matchup also carries `weeks`: its constituent scoring periods, taken
 * from `pointsByScoringPeriod`. This matters because a postseason matchup in
 * this league can span two NFL weeks, so ESPN's `totalPoints` for one is a
 * two-week sum. Comparing that against a one-week regular-season score
 * produced a "highest single-game score" no team ever actually scored. Any
 * record about scoring reads `weeks`; anything about a result reads the
 * matchup.
 *
 * `postseason` is true for every fixture outside the regular season, winners
 * bracket and consolation ladder alike. The bracket a game belongs to is still
 * named for display, but for splitting a stat into regular season and
 * postseason the only question is whether the regular season had ended.
 */
function playedGames(season, year) {
  const weeks = season.schedule
    .filter((m) => m.playoffTierType && m.playoffTierType !== 'NONE')
    .map((m) => Number(m.matchupPeriodId || 0))
    .filter((w) => w > 0);
  const bounds = {
    firstPlayoffWeek: weeks.length ? Math.min(...weeks) : 0,
    lastPlayoffWeek: weeks.length ? Math.max(...weeks) : 0,
  };
  const out = [];
  for (const m of season.schedule) {
    const h = m.home, a = m.away;
    if (!h || !a || h.teamId == null || a.teamId == null) continue;
    const hp = Number(h.totalPoints || 0);
    const ap = Number(a.totalPoints || 0);
    if (!hp && !ap) continue;                       // never played
    if (m.winner === 'UNDECIDED') continue;         // still in progress

    const hBy = h.pointsByScoringPeriod || {};
    const aBy = a.pointsByScoringPeriod || {};
    const periods = [...new Set([...Object.keys(hBy), ...Object.keys(aBy)])]
      .map(Number).filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
    const perWeek = periods
      .map((p) => ({ period: p, homePts: r1(hBy[p] || 0), awayPts: r1(aBy[p] || 0) }))
      .filter((w) => w.homePts || w.awayPts);

    const tier = m.playoffTierType;
    out.push({
      season: year,
      week: Number(m.matchupPeriodId || 0) || null,
      homeId: h.teamId, awayId: a.teamId,
      homePts: r1(hp), awayPts: r1(ap),
      round: playoffRoundLabel(tier, m.matchupPeriodId, bounds),
      postseason: Boolean(tier && tier !== 'NONE'),
      // A matchup with no per-period breakdown is treated as a single week, so
      // nothing silently drops out of the scoring pools.
      weeks: perWeek.length ? perWeek
        : [{ period: Number(m.matchupPeriodId || 0) || null, homePts: r1(hp), awayPts: r1(ap) }],
    });
  }
  return out;
}

/**
 * The uncapped pairwise history.
 *
 * Deliberately separate from `h2h_digest`, which caps each pair at 24 meetings
 * for Live Matchups' compact card. Capping here would silently truncate the
 * very thing the Hall of Fame exists to show, and widening the existing digest
 * would grow a payload Live Matchups reads on every page view.
 */
export async function buildHeadToHeadFull(ctx) {
  const pairs = {};
  let seasons = 0;
  const blank = () => ({
    lowWins: 0, highWins: 0, ties: 0, lowPoints: 0, highPoints: 0,
    // Kept separately so a head-to-head card can show the regular season and
    // the postseason as their own records rather than one blended number.
    regular: { lowWins: 0, highWins: 0, ties: 0, lowPoints: 0, highPoints: 0 },
    post: { lowWins: 0, highWins: 0, ties: 0, lowPoints: 0, highPoints: 0 },
    games: [],
  });
  const currentIncluded = await eachSeason(ctx, (season, year) => {
    seasons += 1;
    for (const g of playedGames(season, year)) {
      const key = pairKeyOf(g.homeId, g.awayId);
      const [lowId] = key.split(':').map(Number);
      const lowIsHome = g.homeId === lowId;
      const lowPts = lowIsHome ? g.homePts : g.awayPts;
      const highPts = lowIsHome ? g.awayPts : g.homePts;
      if (!pairs[key]) pairs[key] = blank();
      const rec = pairs[key];
      const phase = g.postseason ? rec.post : rec.regular;
      for (const bucket of [rec, phase]) {
        bucket.lowPoints = r1(bucket.lowPoints + lowPts);
        bucket.highPoints = r1(bucket.highPoints + highPts);
        if (lowPts > highPts) bucket.lowWins += 1;
        else if (highPts > lowPts) bucket.highWins += 1;
        else bucket.ties += 1;
      }
      rec.games.push({
        season: g.season, week: g.week, lowPts, highPts, round: g.round,
        postseason: g.postseason,
        // Per-week scoring for this fixture, low team first, so a two-week
        // postseason matchup contributes two values to any scoring pool
        // instead of one doubled one.
        weeks: g.weeks.map((w) => ({
          period: w.period,
          lowPts: lowIsHome ? w.homePts : w.awayPts,
          highPts: lowIsHome ? w.awayPts : w.homePts,
        })),
      });
    }
  });

  // Oldest first: this log is read as a chronology, not as a recent-form list.
  for (const key of Object.keys(pairs)) {
    pairs[key].games.sort((x, y) => (x.season - y.season) || ((x.week || 0) - (y.week || 0)));
  }

  return {
    generatedAt: new Date().toISOString(),
    seasons,
    currentSeasonIncluded: currentIncluded,
    pairCount: Object.keys(pairs).length,
    count: Object.keys(pairs).length,
    pairs,
  };
}

/** Every team tied at the extreme, never just the first one found. */
function topHolders(items, valueOf, { min = null, higherIsBetter = true } = {}) {
  const eligible = items.filter((it) => {
    const v = valueOf(it);
    return v != null && Number.isFinite(v) && (min == null || it._sample >= min);
  });
  if (!eligible.length) return [];
  let best = valueOf(eligible[0]);
  for (const it of eligible) {
    const v = valueOf(it);
    if (higherIsBetter ? v > best : v < best) best = v;
  }
  return eligible.filter((it) => Math.abs(valueOf(it) - best) < 1e-9);
}

/**
 * The league record book: one row per franchise, plus league-wide superlatives
 * and the champion of each completed season.
 */
export async function buildLeagueHistoryDigest(rawCtx) {
  // This build walks the archive twice — once for the record book, once for the
  // pairwise history it folds in — so part reads are memoised. Without this the
  // second pass would repeat every R2 get for no new information.
  const memo = new Map();
  const ctx = {
    ...rawCtx,
    readPart: async (part) => {
      if (!memo.has(part)) memo.set(part, await rawCtx.readPart(part));
      return memo.get(part);
    },
  };
  if (rawCtx.readCurrent) {
    let currentMemo;
    let haveCurrent = false;
    ctx.readCurrent = async () => {
      if (!haveCurrent) { currentMemo = await rawCtx.readCurrent(); haveCurrent = true; }
      return currentMemo;
    };
  }

  const teams = {};                       // id -> accumulating row
  const phases = {};                      // id -> { all, regular, post }
  const seasonMeta = {};                  // year -> { size, playoffTeamCount }
  const owners = {};                      // id -> owner display name
  const gamesByTeam = {};                 // id -> chronological matchup list
  const champions = [];
  let currentSeason = null;

  /** One phase's running totals for a team. */
  function newPhase() {
    return {
      wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0,
      // Scoring pools are per scoring period, never per matchup: a two-week
      // postseason matchup puts two values in, not one doubled one.
      weekScores: [], margins: [],
    };
  }

  const ensure = (id) => {
    if (!teams[id]) {
      teams[id] = {
        teamId: Number(id), name: `Team ${id}`, abbrev: '',
        seasons: [], championships: [], runnerUp: [], thirdPlace: [], lastPlace: [],
        finishes: [], playoffAppearances: 0, seasonsCompleted: 0,
        transactions: { acquisitions: 0, drops: 0, trades: 0 },
        seasonLog: [],
      };
      // Results are kept per phase and combined on the way out, so every stat
      // that can differ between the regular season and the postseason has both
      // without a second pass over the archive.
      phases[id] = {
        all: newPhase(), regular: newPhase(), post: newPhase(),
      };
      gamesByTeam[id] = [];
    }
    return teams[id];
  };

  const currentIncluded = await eachSeason(ctx, (season, year, isCurrent) => {
    if (isCurrent) currentSeason = year;
    const settings = season.settings || {};
    const sched = settings.scheduleSettings || {};
    seasonMeta[year] = {
      size: Number(settings.size || (season.teams || []).length || 0),
      playoffTeamCount: Number(sched.playoffTeamCount || 0),
      inProgress: Boolean(isCurrent),
    };

    // Owner names come from the season's own member list where present, so a
    // franchise that changed hands is credited to whoever held it that year.
    const memberName = {};
    for (const mem of season.members || []) {
      const id = mem.id || mem.displayName;
      const full = `${mem.firstName || ''} ${mem.lastName || ''}`.trim();
      if (id) memberName[id] = full || mem.displayName || '';
    }

    for (const t of season.teams || []) {
      const row = ensure(t.id);
      row.name = displayName(t);
      row.abbrev = t.abbrev || row.abbrev;
      if (!row.seasons.includes(year)) row.seasons.push(year);
      const own = memberName[t.primaryOwner] || (t.owners || []).map((o) => memberName[o]).find(Boolean);
      if (own) owners[t.id] = own;

      const tc = t.transactionCounter || {};
      // Counters are per-season totals, so they add across the archive.
      row.transactions.acquisitions += Number(tc.acquisitions || 0);
      row.transactions.drops += Number(tc.drops || 0);
      row.transactions.trades += Number(tc.trades || 0);

      const rank = Number(t.rankCalculatedFinal || 0);
      const rec = (t.record && t.record.overall) || {};
      if (!isCurrent) {
        row.seasonsCompleted += 1;
        if (rank > 0) {
          row.finishes.push({ year, rank });
          if (rank === 1) row.championships.push(year);
          else if (rank === 2) row.runnerUp.push(year);
          else if (rank === 3) row.thirdPlace.push(year);
          if (rank === seasonMeta[year].size) row.lastPlace.push(year);
        }
        const seed = Number(t.playoffSeed || 0);
        if (seed > 0 && seasonMeta[year].playoffTeamCount > 0 &&
            seed <= seasonMeta[year].playoffTeamCount) {
          row.playoffAppearances += 1;
        }
        row.seasonLog.push({
          year,
          wins: Number(rec.wins || 0), losses: Number(rec.losses || 0), ties: Number(rec.ties || 0),
          pf: r1(rec.pointsFor), pa: r1(rec.pointsAgainst),
          rank: rank || null, size: seasonMeta[year].size,
        });
      }
      if (rank === 1 && !isCurrent) {
        champions.push({ year, teamId: t.id });
      }
    }

    // Records and points are accumulated from the games themselves rather than
    // from ESPN's per-season totals, so the current season's part-played record
    // counts exactly the games that have actually finished.
    for (const g of playedGames(season, year)) {
      ensure(g.homeId); ensure(g.awayId);
      const homeWon = g.homePts > g.awayPts, tie = g.homePts === g.awayPts;

      for (const [id, own, opp, won] of [
        [g.homeId, g.homePts, g.awayPts, homeWon],
        [g.awayId, g.awayPts, g.homePts, !homeWon && !tie],
      ]) {
        const buckets = [phases[id].all, g.postseason ? phases[id].post : phases[id].regular];
        for (const b of buckets) {
          b.pointsFor = r1(b.pointsFor + own);
          b.pointsAgainst = r1(b.pointsAgainst + opp);
          if (tie) b.ties += 1;
          else if (won) b.wins += 1;
          else b.losses += 1;
          // Every scoring period of the fixture enters the pool on its own.
          for (const w of g.weeks) {
            const wOwn = id === g.homeId ? w.homePts : w.awayPts;
            const wOpp = id === g.homeId ? w.awayPts : w.homePts;
            b.weekScores.push({ points: wOwn, season: g.season, week: w.period, opponent: id === g.homeId ? g.awayId : g.homeId });
            b.margins.push({ margin: r1(wOwn - wOpp), season: g.season, week: w.period, opponent: id === g.homeId ? g.awayId : g.homeId });
          }
        }
      }

      // Streaks and the chronology read matchups, not weeks: a two-week
      // postseason matchup is one result, however many weeks it covered.
      gamesByTeam[g.homeId].push({ season: g.season, week: g.week, own: g.homePts, opp: g.awayPts, oppId: g.awayId, round: g.round, postseason: g.postseason });
      gamesByTeam[g.awayId].push({ season: g.season, week: g.week, own: g.awayPts, opp: g.homePts, oppId: g.homeId, round: g.round, postseason: g.postseason });
    }
  });

  // Current identity and active status: a franchise is active when it is on
  // this season's roster. `isActive` on the payload is unreliable — it reads
  // false for every team in every season, current ones included — so presence
  // in the live roster is the only trustworthy signal.
  const sources = (ctx && ctx.sources) || {};
  const liveTeams = Array.isArray(sources.league_teams && sources.league_teams.teams)
    ? sources.league_teams.teams : [];
  const activeIds = new Set(liveTeams.map((t) => t.id));
  for (const t of liveTeams) {
    const row = ensure(t.id);
    row.name = displayName(t);
    row.abbrev = t.abbrev || row.abbrev;
    // Never the raw ESPN URL. An uploaded logo lives on mystique-api and
    // answers 401 without the league's ESPN session, so a browser cannot fetch
    // it at all, and the other kinds sit on assorted hosts. Every other digest
    // routes through the same R2-backed proxy; a per-host split would render
    // one league two different ways.
    if (t.logo) row.logo = teamLogoUrl(t.id, t.logo);
  }
  for (const mem of (sources.league_teams && sources.league_teams.members) || []) {
    const full = `${mem.firstName || ''} ${mem.lastName || ''}`.trim();
    for (const t of liveTeams) {
      if (t.primaryOwner === mem.id || (t.owners || []).includes(mem.id)) {
        if (full) owners[t.id] = full;
      }
    }
  }

  /** Reduce one phase's pools into the shape the tool renders. */
  function phaseStats(p) {
    const played = p.wins + p.losses + p.ties;
    const best = (list, key, higher) => {
      if (!list.length) return null;
      let pick = list[0];
      for (const it of list) {
        if (higher ? it[key] > pick[key] : it[key] < pick[key]) pick = it;
      }
      return pick;
    };
    const wins = p.margins.filter((m) => m.margin > 0);
    const losses = p.margins.filter((m) => m.margin < 0);
    return {
      record: {
        wins: p.wins, losses: p.losses, ties: p.ties, games: played,
        winPct: played ? (p.wins + p.ties * 0.5) / played : 0,
      },
      points: {
        for: r1(p.pointsFor), against: r1(p.pointsAgainst),
        diff: r1(p.pointsFor - p.pointsAgainst),
        // Per scoring period, not per matchup, so a two-week postseason
        // fixture does not read as one enormous game.
        perGame: p.weekScores.length ? r1(p.pointsFor / p.weekScores.length) : 0,
        weeks: p.weekScores.length,
      },
      high: best(p.weekScores, 'points', true),
      low: best(p.weekScores, 'points', false),
      biggestWin: best(wins, 'margin', true),
      biggestLoss: losses.length
        ? (() => { const w = best(losses, 'margin', false); return { ...w, margin: r1(Math.abs(w.margin)) }; })()
        : null,
      closestWin: best(wins, 'margin', false),
      closestLoss: losses.length
        ? (() => { const w = best(losses, 'margin', true); return { ...w, margin: r1(Math.abs(w.margin)) }; })()
        : null,
    };
  }

  const rows = Object.values(teams).map((row) => {
    const games = (gamesByTeam[row.teamId] || [])
      .sort((a, b) => (a.season - b.season) || ((a.week || 0) - (b.week || 0)));

    // Streaks run as one continuous chronology, never reset at a season
    // boundary — a team that closed one year on four wins and opened the next
    // with three is on a seven-game run, and saying otherwise loses the record.
    let bestWin = 0, bestLoss = 0, runType = null, runLen = 0;
    let bestWinAt = null, bestLossAt = null, runAt = null;
    for (const g of games) {
      const res = g.own > g.opp ? 'W' : (g.own < g.opp ? 'L' : 'T');
      if (res === runType) { runLen += 1; }
      else { runType = res; runLen = 1; runAt = { season: g.season, week: g.week }; }
      if (res === 'W' && runLen > bestWin) { bestWin = runLen; bestWinAt = { ...runAt, endSeason: g.season, endWeek: g.week }; }
      if (res === 'L' && runLen > bestLoss) { bestLoss = runLen; bestLossAt = { ...runAt, endSeason: g.season, endWeek: g.week }; }
    }

    const all = phaseStats(phases[row.teamId].all);
    const regular = phaseStats(phases[row.teamId].regular);
    const post = phaseStats(phases[row.teamId].post);

    const ranks = row.finishes.map((f) => f.rank);
    const best = row.finishes.length
      ? row.finishes.reduce((m, f) => (f.rank < m.rank ? f : m)) : null;
    const worst = row.finishes.length
      ? row.finishes.reduce((m, f) => (f.rank > m.rank ? f : m)) : null;
    const seasonsSorted = row.seasons.slice().sort((a, b) => a - b);
    const active = activeIds.size ? activeIds.has(row.teamId) : true;

    return {
      teamId: row.teamId,
      name: row.name,
      abbrev: row.abbrev,
      // Set on the accumulator from the live roster and then dropped here,
      // which is why every logo on the page fell back to the shield — the
      // proxy URL was being built correctly and then thrown away.
      logo: row.logo || null,
      owner: owners[row.teamId] || '',
      active,
      lastActiveSeason: active ? null : (seasonsSorted[seasonsSorted.length - 1] || null),
      seasons: seasonsSorted,
      // Career figures stay at the top level so every existing reader keeps
      // working; the split lives beside them rather than replacing them.
      record: all.record,
      points: all.points,
      phases: { all, regular, post },
      streak: (() => {
        const last = games[games.length - 1];
        if (!last) return null;
        return { type: runType, length: runLen, final: !active };
      })(),
      bestWinStreak: bestWin ? { length: bestWin, ...bestWinAt } : null,
      worstLossStreak: bestLoss ? { length: bestLoss, ...bestLossAt } : null,
      postseason: {
        appearances: row.playoffAppearances,
        seasonsPlayed: row.seasonsCompleted,
        wins: post.record.wins, losses: post.record.losses, ties: post.record.ties,
      },
      championships: { count: row.championships.length, years: row.championships },
      runnerUp: { count: row.runnerUp.length, years: row.runnerUp },
      thirdPlace: { count: row.thirdPlace.length, years: row.thirdPlace },
      lastPlace: { count: row.lastPlace.length, years: row.lastPlace },
      bestFinish: best, worstFinish: worst,
      avgFinish: ranks.length ? Math.round((ranks.reduce((s, r) => s + r, 0) / ranks.length) * 100) / 100 : null,
      singleGameHigh: all.high, singleGameLow: all.low,
      biggestWin: all.biggestWin, biggestLoss: all.biggestLoss,
      transactions: row.transactions,
      seasonLog: row.seasonLog.sort((a, b) => a.year - b.year),
    };
  }).sort((a, b) => b.record.winPct - a.record.winPct);

  /**
   * Where each team places league-wide on every stat its card shows.
   *
   * Computed here rather than in the browser because the tool would otherwise
   * have to re-sort every team for every stat on every render, and because the
   * tie rule and the "higher is better" question differ per stat — decisions
   * that belong with the data, not spread through the view.
   *
   * A rank is emitted as the placement, whether it is shared, and the leader's
   * value, which is all the card needs to render either the gold first-place
   * line or the "T-2nd (1st: …)" form.
   */
  const RANKABLE = [
    ['record.wins', (r) => r.record.wins, true],
    ['record.losses', (r) => r.record.losses, false],
    ['record.winPct', (r) => r.record.winPct, true],
    ['record.games', (r) => r.record.games, true],
    ['points.for', (r) => r.points.for, true],
    ['points.against', (r) => r.points.against, false],
    ['points.perGame', (r) => r.points.perGame, true],
    ['points.diff', (r) => r.points.diff, true],
    ['bestWinStreak', (r) => (r.bestWinStreak ? r.bestWinStreak.length : null), true],
    ['worstLossStreak', (r) => (r.worstLossStreak ? r.worstLossStreak.length : null), false],
    ['postseason.appearances', (r) => r.postseason.appearances, true],
    ['postseason.wins', (r) => r.postseason.wins, true],
    ['championships', (r) => r.championships.count, true],
    ['runnerUp', (r) => r.runnerUp.count, true],
    ['thirdPlace', (r) => r.thirdPlace.count, true],
    ['lastPlace', (r) => r.lastPlace.count, false],
    ['avgFinish', (r) => r.avgFinish, false],
    ['bestFinish', (r) => (r.bestFinish ? r.bestFinish.rank : null), false],
    ['transactions.total', (r) => r.transactions.acquisitions + r.transactions.drops + r.transactions.trades, true],
    ['transactions.trades', (r) => r.transactions.trades, true],
    ['transactions.acquisitions', (r) => r.transactions.acquisitions, true],
  ];
  for (const phaseName of ['regular', 'post']) {
    RANKABLE.push(
      [`${phaseName}.record.wins`, (r) => r.phases[phaseName].record.wins, true],
      [`${phaseName}.record.winPct`, (r) => r.phases[phaseName].record.winPct, true],
      [`${phaseName}.points.for`, (r) => r.phases[phaseName].points.for, true],
      [`${phaseName}.points.against`, (r) => r.phases[phaseName].points.against, false],
      [`${phaseName}.points.perGame`, (r) => r.phases[phaseName].points.perGame, true],
      [`${phaseName}.points.diff`, (r) => r.phases[phaseName].points.diff, true],
    );
  }

  const ranked = rows.filter((r) => r.record.games > 0);
  for (const [key, valueOf, higherIsBetter] of RANKABLE) {
    const scored = ranked
      .map((r) => ({ teamId: r.teamId, name: r.name, v: valueOf(r) }))
      .filter((x) => x.v != null && Number.isFinite(x.v));
    if (!scored.length) continue;
    scored.sort((a, b) => (higherIsBetter ? b.v - a.v : a.v - b.v));
    const leader = scored[0];
    // Standard competition ranking: equal values share a place, and the next
    // distinct value skips as many places as were shared.
    let place = 0, seen = 0, prev = null;
    const placeOf = new Map();
    for (const x of scored) {
      seen += 1;
      if (prev === null || Math.abs(x.v - prev) > 1e-9) { place = seen; prev = x.v; }
      placeOf.set(x.teamId, place);
    }
    const counts = new Map();
    for (const p of placeOf.values()) counts.set(p, (counts.get(p) || 0) + 1);
    for (const r of rows) {
      if (!placeOf.has(r.teamId)) continue;
      const p = placeOf.get(r.teamId);
      if (!r.ranks) r.ranks = {};
      r.ranks[key] = {
        place: p,
        tied: counts.get(p) > 1,
        of: scored.length,
        leaderValue: leader.v,
        leaderTeam: leader.name,
        leaderTeamId: leader.teamId,
      };
    }
  }

  // ---- league-wide superlatives -------------------------------------------
  const withSample = rows.map((r) => ({ ...r, _sample: r.seasons.filter((y) => y !== currentSeason).length }));
  const played = withSample.filter((r) => r.record.games > 0);
  const pick = (items, valueOf, opts) => topHolders(items, valueOf, opts)
    .map((r) => ({ teamId: r.teamId, value: valueOf(r) }));

  // Single-game extremes are league-wide, so they are found across every row's
  // own extreme rather than by re-walking the schedule.
  const highs = played.map((r) => r.singleGameHigh && { teamId: r.teamId, ...r.singleGameHigh }).filter(Boolean);
  const lows = played.map((r) => r.singleGameLow && { teamId: r.teamId, ...r.singleGameLow }).filter(Boolean);
  const bestOf = (list, key, higher) => {
    if (!list.length) return [];
    let b = list[0][key];
    for (const it of list) { if (higher ? it[key] > b : it[key] < b) b = it[key]; }
    return list.filter((it) => Math.abs(it[key] - b) < 1e-9);
  };

  // Pairwise records are computed here rather than read from h2h_full_digest.
  //
  // Declaring that digest as a `need` would look tidier, but it derives from
  // this same source: resolving it through the coordinator would refresh
  // `league_history`, which re-enters this very build. It happens to be fresh
  // in practice, because it is written moments earlier in the same pass, so the
  // loop would stay closed by timing alone — which is not a guarantee worth
  // resting on. Recomputing from the already-memoised parts costs nothing extra
  // and removes the cycle outright.
  const pairs = (await buildHeadToHeadFull(ctx)).pairs;
  const pairStats = Object.entries(pairs).map(([key, p]) => {
    const [lowId, highId] = key.split(':').map(Number);
    const games = p.lowWins + p.highWins + p.ties;
    const lowPct = games ? (p.lowWins + p.ties * 0.5) / games : 0;
    return { key, lowId, highId, games, lowPct, skew: Math.abs(lowPct - 0.5), p };
  });
  // Five meetings, not three. At three, a 4-0-0 pairing sits at a perfect
  // 100% and eight of them tie for "most lopsided" at once — technically the
  // record, but it says more about a short sample than about a rivalry.
  const PAIR_FLOOR = 5;
  const eligiblePairs = pairStats.filter((p) => p.games >= PAIR_FLOOR);
  const pairPick = (higher) => {
    if (!eligiblePairs.length) return [];
    let b = eligiblePairs[0].skew;
    for (const p of eligiblePairs) { if (higher ? p.skew > b : p.skew < b) b = p.skew; }
    return eligiblePairs.filter((p) => Math.abs(p.skew - b) < 1e-9).map((p) => ({
      teamA: p.lowId, teamB: p.highId,
      dominantTeam: p.lowPct >= 0.5 ? p.lowId : p.highId,
      record: p.lowPct >= 0.5
        ? `${p.p.lowWins}-${p.p.highWins}-${p.p.ties}`
        : `${p.p.highWins}-${p.p.lowWins}-${p.p.ties}`,
      winPct: Math.max(p.lowPct, 1 - p.lowPct),
      games: p.games,
    }));
  };

  // Every single game, once, for the two whole-league game records.
  let blowout = [], closest = [];
  for (const [key, p] of Object.entries(pairs)) {
    const [lowId, highId] = key.split(':').map(Number);
    for (const g of p.games || []) {
      // Per scoring period: a two-week postseason matchup would otherwise post
      // a margin no single week ever produced.
      for (const w of g.weeks || [{ period: g.week, lowPts: g.lowPts, highPts: g.highPts }]) {
      const margin = r1(Math.abs(w.lowPts - w.highPts));
      const winner = w.lowPts > w.highPts ? lowId : highId;
      const loser = winner === lowId ? highId : lowId;
      const entry = { winner, loser, teamA: lowId, teamB: highId, margin, season: g.season, week: w.period, postseason: g.postseason };
      if (!blowout.length || margin > blowout[0].margin) blowout = [entry];
      else if (blowout.length && Math.abs(margin - blowout[0].margin) < 1e-9) blowout.push(entry);
      if (!closest.length || margin < closest[0].margin) closest = [entry];
      else if (closest.length && Math.abs(margin - closest[0].margin) < 1e-9) closest.push(entry);
      }
    }
  }

  const records = {
    mostChampionships: pick(played, (r) => r.championships.count),
    highestWinPct: pick(played, (r) => r.record.winPct),
    bestAvgFinish: pick(withSample.filter((r) => r.avgFinish != null), (r) => r.avgFinish,
      { min: 2, higherIsBetter: false }),
    mostPoints: pick(played, (r) => r.points.for),
    bestDiff: pick(played, (r) => r.points.diff),
    mostPlayoffApps: pick(played, (r) => r.postseason.appearances),
    longestWinStreak: played.filter((r) => r.bestWinStreak)
      .filter((r, _i, arr) => r.bestWinStreak.length === Math.max(...arr.map((x) => x.bestWinStreak.length)))
      .map((r) => ({ teamId: r.teamId, value: r.bestWinStreak.length, at: r.bestWinStreak })),
    longestLossStreak: played.filter((r) => r.worstLossStreak)
      .filter((r, _i, arr) => r.worstLossStreak.length === Math.max(...arr.map((x) => x.worstLossStreak.length)))
      .map((r) => ({ teamId: r.teamId, value: r.worstLossStreak.length, at: r.worstLossStreak })),
    highestSingleGame: bestOf(highs, 'points', true),
    lowestSingleGame: bestOf(lows, 'points', false),
    biggestBlowout: blowout,
    closestGame: closest,
    mostLopsidedMatchup: pairPick(true),
    closestMatchup: pairPick(false),
    mostTransactions: pick(played, (r) => r.transactions.acquisitions + r.transactions.drops + r.transactions.trades),
    mostTrades: pick(played, (r) => r.transactions.trades),
  };

  // One card per season, newest first, with the season still being played
  // present as a placeholder rather than missing — an absent slot reads as a
  // season that never happened.
  const years = Object.keys(seasonMeta).map(Number).sort((a, b) => b - a);
  const championsByYear = [];
  for (const year of years) {
    const won = champions.filter((c) => c.year === year);
    if (won.length) {
      for (const c of won) {
        championsByYear.push({ year, teamId: c.teamId, placeholder: false });
      }
    } else {
      championsByYear.push({ year, teamId: null, placeholder: true });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    currentSeason,
    currentSeasonIncluded: currentIncluded,
    seasonMeta,
    champions: championsByYear,
    count: rows.length,
    rows,
    records,
  };
}

/**
 * Registry of derivations, keyed by the source dataset.
 *
 * A source may drive more than one digest — `league_history` feeds Live
 * Matchups' capped head-to-head card, the Hall of Fame's uncapped one, and the
 * record book — so an entry is either a single spec or an array of them.
 * `derivationsFor` always answers with an array so callers never branch.
 */
export const DERIVATIONS = {
  nfl_injuries: {
    target: 'injuries_digest',
    build: buildInjuryDigest,
  },
  league_players: {
    target: 'player_digest',
    build: buildPlayerDigest,
    // Bye weeks come from a separately derived, long-lived lookup rather than
    // being recomputed from 32 team schedules every time the pool refreshes.
    needsByeMap: true,
  },
  nfl_team_schedules: {
    target: 'bye_weeks',
    buildMulti: buildByeWeeks,
  },
  league_history: [
    {
      target: 'h2h_digest',
      buildMulti: buildHeadToHeadHistory,
      // This season's schedule, so meetings already played this year count.
      current: 'matchups',
    },
    {
      target: 'h2h_full_digest',
      buildMulti: buildHeadToHeadFull,
      current: 'matchups',
    },
    {
      target: 'league_history_digest',
      buildMulti: buildLeagueHistoryDigest,
      current: 'matchups',
      // Current identity for names, logos and the active-team test. The
      // pairwise history it also needs is computed in-process rather than
      // declared here — see the note in buildLeagueHistoryDigest.
      needs: ['league_teams'],
    },
  ],
  nfl_scoreboard: {
    target: 'scoreboard_digest',
    build: buildScoreboardDigest,
  },
  matchups: {
    target: 'matchup_digest',
    build: buildMatchupDigest,
    // Names and logos live in a separate, much smaller payload.
    needs: ['league_teams'],
  },
  standings: {
    target: 'standings_digest',
    build: buildStandingsDigest,
    needs: ['league_teams'],
  },
  rosters: {
    target: 'roster_digest',
    build: buildRosterDigest,
  },
  live_scoring: {
    target: 'live_scoring_digest',
    build: buildLiveScoringDigest,
    // Identity for the team join, standings for the season context strip, and
    // the NFL scoreboard for every live/final/upcoming state in the tool. All
    // three are resolved through the coordinator rather than read hopefully.
    needs: ['league_teams', 'standings_digest', 'scoreboard_digest'],
  },
  transactions: {
    target: 'transaction_digest',
    build: buildTransactionDigest,
    needs: ['league_teams', 'player_digest'],
  },
};

/**
 * Every derivation a source drives, always as an array.
 *
 * Registry entries may be a single spec or a list of them; normalising here
 * means the refresh path has one shape to handle and adding a second digest to
 * an existing source needs no change anywhere else.
 */
export function derivationsFor(datasetKey) {
  const entry = DERIVATIONS[datasetKey];
  if (!entry) return [];
  return Array.isArray(entry) ? entry : [entry];
}

/** The first derivation for a source. Retained for callers that only ever
 *  dealt with one, such as the dev diagnostics surface. */
export function derivationFor(datasetKey) {
  return derivationsFor(datasetKey)[0] || null;
}
