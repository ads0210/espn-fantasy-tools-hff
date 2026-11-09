/**
 * Hall of Fame's record book in the shared record-panel format (Week 10 plan, D13–D17, G6, G7, D27–D29).
 *
 * Built once with the league history digest (src/derive.js): every league record with its top ten, the eleven season
 * records (regular season only, G6) with the season being played "in play" until it is complete or can no longer be
 * lost (H3), and Records held and Prestige from the shared rule (src/standing.js). Plain functions, no I/O.
 *
 * games: one row per team pair per scoring period played: { season, week, post, a, b, ap, bp }
 * rows: the digest's all-time rows; seasonMeta: { year: { mpc, playoffTeamCount, inProgress } }; currentSeason
 */
import { standingPanels } from './standing.js';

const r2 = (x) => Math.round((Number(x) || 0) * 100 + (x < 0 ? -1e-6 : 1e-6)) / 100;
const ptsText = (x) => Number(x).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const signedText = (x) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${ptsText(Math.abs(r2(x)))}`;
const ord = (n) => `${n}${[, 'st', 'nd', 'rd'][(n % 100 >> 3 ^ 1) && n % 10] || 'th'}`;
const TOP = 10;
const top = (list, key, dir = -1) => [...list].sort((x, y) => dir * (x[key] - y[key])).slice(0, TOP);
const WEEKLY = 'One scoring period; a two-week postseason matchup counts each week on its own.';

export function hofRecordBook({ games: pairs = [], rows = [], seasonMeta = {}, currentSeason = null }) {
  const games = pairs.flatMap((g) => [{ ...g, team: g.a, opp: g.b, pts: g.ap, oppPts: g.bp }, { ...g, team: g.b, opp: g.a, pts: g.bp, oppPts: g.ap }]);
  const seasons = [...new Set(pairs.map((g) => g.season))].sort((a, b) => a - b);
  const scoreOf = (g) => `${ptsText(g.pts)}–${ptsText(g.oppPts)}`;
  const gamePop = (g) => [[g.pts > g.oppPts ? 'Beat' : g.pts < g.oppPts ? 'Lost to' : 'Tied', { team: g.opp, season: g.season }], ['Score', scoreOf(g)], ...(g.post ? [['Game', 'Postseason']] : [])];
  const matchPop = (g) => { const w = g.ap >= g.bp; return [['Score', `${ptsText(w ? g.ap : g.bp)}–${ptsText(w ? g.bp : g.ap)}`], ...(g.post ? [['Game', 'Postseason']] : [])]; };
  const gameEntry = (g) => ({ teams: [g.team], value: g.pts, season: g.season, week: g.week, pop: gamePop(g) });
  const margins = pairs.map((g) => ({ ...g, m: r2(Math.abs(g.ap - g.bp)) }));
  const matchEntry = (g) => ({ vs: g.ap >= g.bp ? [g.a, g.b] : [g.b, g.a], teams: g.ap === g.bp ? [g.a, g.b] : [g.ap > g.bp ? g.a : g.b], value: g.m, season: g.season, week: g.week, pop: matchPop(g) });

  /* ---- league records */
  const career = {};
  for (const g of games) { const c = (career[g.team] = career[g.team] || { pf: 0, pa: 0 }); c.pf += g.pts; c.pa += g.oppPts; }
  const rank = (fn, dir = -1, positive = false, pop = null) => rows.filter((r) => fn(r) != null && (!positive || fn(r) > 0))
    .sort((a, b) => dir * (fn(a) - fn(b))).slice(0, TOP).map((r) => ({ teams: [r.teamId], value: fn(r), ...(pop ? { pop: pop(r) } : {}) }));
  const wlt = (x) => (x ? `${x.wins}-${x.losses}-${x.ties}` : '—');
  const bySeason = (team, f) => seasons.map((y) => { const g = games.filter((x) => x.team === team && x.season === y); return g.length ? [String(y), f(g)] : null; }).filter(Boolean);
  const careerPop = (team, diff) => bySeason(team, (g) => (diff ? signedText(g.reduce((s, x) => s + x.pts - x.oppPts, 0)) : ptsText(g.reduce((s, x) => s + x.pts, 0))));
  const playoffYears = (r) => (r.seasonLog || []).filter((l) => l.rank && l.rank <= ((seasonMeta[l.year] || {}).playoffTeamCount || 4)).map((l) => l.year);
  const POP = {
    champs: (r) => [['Won', (r.championships.years || []).join(', ')]],
    winPct: (r) => [['Record', wlt(r.record)], ['Regular season', wlt(r.phases && r.phases.regular && r.phases.regular.record)], ['Postseason', wlt(r.postseason)]],
    finish: (r) => (r.seasonLog || []).filter((l) => l.rank).map((l) => [String(l.year), `${ord(l.rank)} of ${l.size}`]),
    apps: (r) => [['Seasons', playoffYears(r).join(', ') || '—'], ['Postseason record', wlt(r.postseason)]],
    streak: (s) => (r) => { const x = r[s]; return x && x.season ? [['From', `${x.season} · Week ${x.week}`], ['To', `${x.endSeason ?? x.season} · Week ${x.endWeek ?? x.week}`]] : []; },
    moves: (r) => [['Adds', String(r.transactions.acquisitions)], ['Drops', String(r.transactions.drops)], ['Trades', String(r.transactions.trades)]],
  };
  const careerList = (fn, dir) => Object.entries(career).map(([t, c]) => ({ teams: [Number(t)], value: r2(fn(c)), pop: careerPop(Number(t), fn(c) !== c.pf) }))
    .sort((a, b) => dir * (a.value - b.value)).slice(0, TOP);
  const done = (r) => (r.seasonLog || []).filter((l) => l.rank).length;
  // Streaks are ranked as streaks, not one per team: a team can hold several places. Each entry names its weeks (a
  // run across a season's turn says so) and its note lists every game in it.
  const runEntry = (team, x) => ({ teams: [team], value: x.length, season: x.season, week: x.week, endSeason: x.endSeason,
    // A postseason game is named by its round: its matchup spans two scoring weeks, so a week number would mislead.
    ...(x.endSeason === x.season && !x.round && !x.endRound ? { span: [x.week, x.endWeek] }
      : { when: `${x.season} ${x.round || `Week ${x.week}`} – ${x.endSeason === x.season ? '' : `${x.endSeason} `}${x.endRound || `Week ${x.endWeek}`}` }),
    detail: { kind: 'games', games: (x.games || []).map(([y, w, opp, own, op, post, round]) => ({
      label: `${x.endSeason === x.season ? '' : `${y} · `}${post ? round || 'Postseason' : `Week ${w}`}`, res: own > op ? 'W' : own < op ? 'L' : 'T', opp, season: y, own, op })) } });
  const runs = (kind) => rows.flatMap((r) => ((r.streakRuns && r.streakRuns[kind]) || []).map((x) => runEntry(r.teamId, x)))
    .sort((a, b) => b.value - a.value || a.season - b.season || a.week - b.week).slice(0, TOP);
  // A digest built before every run was kept: the best per team, as before.
  const runsOr = (kind, key) => (rows.some((r) => r.streakRuns) ? runs(kind) : rank((r) => r[key] && r[key].length, -1, true, POP.streak(key)));
  const league = [
    { id: 'mostChampionships', title: 'Most championships', unit: 'n', tone: 1, info: 'League titles won.', entries: rank((r) => r.championships.count, -1, true, POP.champs) },
    { id: 'highestWinPct', title: 'Highest win percentage', unit: 'pct', tone: 1, info: 'Every game, regular season and postseason; ties count half.', entries: rank((r) => r.record.winPct, -1, false, POP.winPct) },
    { id: 'lowestWinPct', title: 'Lowest win percentage', unit: 'pct', tone: -1, better: 'low', info: 'Every game, regular season and postseason; ties count half.', entries: rank((r) => r.record.winPct, 1, false, POP.winPct) },
    { id: 'bestAvgFinish', title: 'Best average finish', unit: 'place', tone: 1, better: 'low', info: 'Mean final placement, over every completed season.', entries: rank((r) => (done(r) ? r.avgFinish : null), 1, false, POP.finish) },
    { id: 'mostPoints', title: 'Most points, career', unit: 'pts', tone: 1, info: 'Every scoring period played, from ESPN’s own per-week points.', entries: careerList((c) => c.pf, -1) },
    { id: 'bestDiff', title: 'Best point differential, career', unit: 'diff', tone: 1, info: 'Points for minus points against, every period played.', entries: careerList((c) => c.pf - c.pa, -1) },
    { id: 'worstDiff', title: 'Worst point differential, career', unit: 'diff', tone: -1, better: 'low', info: 'Points for minus points against, every period played.', entries: careerList((c) => c.pf - c.pa, 1) },
    { id: 'mostPlayoffApps', title: 'Most playoff appearances', unit: 'n', tone: 1, info: 'Seasons in the winners bracket.', entries: rank((r) => r.postseason.appearances, -1, true, POP.apps) },
    { id: 'longestWinStreak', title: 'Longest winning streak', unit: 'n', tone: 1, word: 'games in a row', info: 'Consecutive wins, running across seasons.', entries: runsOr('W', 'bestWinStreak') },
    { id: 'longestLossStreak', title: 'Longest losing streak', unit: 'n', tone: -1, word: 'games in a row', info: 'Consecutive losses, running across seasons.', entries: runsOr('L', 'worstLossStreak') },
    { id: 'highestSingleGame', title: 'Highest weekly score', unit: 'pts', tone: 1, info: WEEKLY, entries: top(games, 'pts').map(gameEntry) },
    { id: 'lowestSingleGame', title: 'Lowest weekly score', unit: 'pts', tone: -1, better: 'low', info: WEEKLY, entries: top(games.filter((g) => g.pts > 0), 'pts', 1).map(gameEntry) },
    { id: 'biggestBlowout', title: 'Biggest blowout', unit: 'pts', tone: 1, kind: 'match', info: `Margin in one scoring period. ${WEEKLY.split('; ')[1].replace(/^./, (c) => c.toUpperCase())}`, entries: top(margins, 'm').map(matchEntry) },
    { id: 'closestGame', title: 'Closest game', unit: 'pts', tone: 0, kind: 'match', better: 'low', info: 'Margin in one scoring period; a tie is not counted.', entries: top(margins.filter((g) => g.m > 0), 'm', 1).map(matchEntry) },
    { id: 'highestInLoss', title: 'Highest score in a loss', unit: 'pts', tone: -1, info: 'The most points a team scored in one scoring period and still lost.', entries: top(games.filter((g) => g.pts < g.oppPts), 'pts').map(gameEntry) },
    { id: 'lowestInWin', title: 'Lowest score in a win', unit: 'pts', tone: 1, better: 'low', info: 'The fewest points a team scored in one scoring period and still won.', entries: top(games.filter((g) => g.pts > g.oppPts), 'pts', 1).map(gameEntry) },
    { id: 'mostTransactions', title: 'Most transactions, career', unit: 'n', tone: 0, info: 'Adds, drops and trades.', entries: rank((r) => r.transactions.acquisitions + r.transactions.drops + r.transactions.trades, -1, true, POP.moves) },
    { id: 'mostTrades', title: 'Most trades, career', unit: 'n', tone: 0, info: 'Completed trades.', entries: rank((r) => r.transactions.trades, -1, true) },
  ];

  /* ---- season records: regular season only (G6); the season being played is in play until settled (H3) */
  const seasonLines = [];
  for (const y of seasons) {
    const meta = seasonMeta[y] || {};
    const mpc = Number(meta.mpc) || 13;
    const reg = games.filter((g) => g.season === y && !g.post && g.week <= mpc);
    const played = [...new Set(reg.map((g) => g.week))].sort((a, b) => a - b);
    const live = y === currentSeason && (meta.inProgress || played.length < mpc);
    for (const team of [...new Set(reg.map((g) => g.team))]) {
      const mine = reg.filter((g) => g.team === team).sort((a, b) => a.week - b.week);
      let w = 0, l = 0, ti = 0, apW = 0, apL = 0, high = 0, run = 0, bestW = 0, bestL = 0;
      const sruns = []; let curRun = null; const highWeeks = [];
      for (const g of mine) {
        if (g.pts > g.oppPts) { w++; run = run > 0 ? run + 1 : 1; } else if (g.pts < g.oppPts) { l++; run = run < 0 ? run - 1 : -1; } else { ti++; run = 0; }
        bestW = Math.max(bestW, run); bestL = Math.max(bestL, -run);
        const res = g.pts > g.oppPts ? 'W' : g.pts < g.oppPts ? 'L' : 'T';
        if (curRun && curRun.type === res) curRun.games.push(g); else { curRun = { type: res, games: [g] }; if (res !== 'T') sruns.push(curRun); }
        const field = reg.filter((x) => x.week === g.week);
        apW += field.filter((x) => x.team !== team && x.pts < g.pts).length; apL += field.filter((x) => x.team !== team && x.pts > g.pts).length;
        if (g.pts >= Math.max(...field.map((x) => x.pts))) { high++; highWeeks.push(g.week); }
      }
      seasonLines.push({ season: y, team, games: mine.length, done: !live, weeksLeft: live ? Math.max(0, mpc - played.length) : 0,
        pf: r2(mine.reduce((s, g) => s + g.pts, 0)), pa: r2(mine.reduce((s, g) => s + g.oppPts, 0)), w, l, t: ti,
        winPct: (w + ti / 2) / Math.max(1, mine.length), apPct: apW / Math.max(1, apW + apL), apW, apL, high, highWeeks, bestW, bestL,
        runs: sruns.map((r) => ({ type: r.type, length: r.games.length, season: y, week: r.games[0].week, endSeason: y, endWeek: r.games[r.games.length - 1].week,
          games: r.games.map((g) => [y, g.week, g.opp, r2(g.pts), r2(g.oppPts), 0]) })) });
    }
  }
  const finishOf = (y, team) => { const r = rows.find((x) => x.teamId === team); const l = r && (r.seasonLog || []).find((x) => x.year === y); return l && l.rank ? `${ord(l.rank)} of ${l.size}` : null; };
  const recText = (s) => `${s.w}-${s.l}${s.t ? `-${s.t}` : ''}`;
  const seasonPop = (s) => [['Record', recText(s)], ['Points for', ptsText(s.pf)], ['Points against', ptsText(s.pa)], ['Finished', s.done ? finishOf(s.season, s.team) || '—' : 'Season in progress']];
  const SEASON = [
    ['mostPf', 'Most points in a season', 'pf', -1, 'pts', 1, 'Points for in a regular season.'],
    ['fewestPf', 'Fewest points in a season', 'pf', 1, 'pts', -1, 'Points for in a regular season.'],
    ['bestRecord', 'Best regular season', 'winPct', -1, 'rec', 1, 'Win percentage in a regular season; ties count half.'],
    ['worstRecord', 'Worst regular season', 'winPct', 1, 'rec', -1, 'Win percentage in a regular season; ties count half.'],
    ['mostPa', 'Most points against in a season', 'pa', -1, 'pts', -1, 'Points scored against a team in a regular season: the unluckiest schedule.'],
    ['fewestPa', 'Fewest points against in a season', 'pa', 1, 'pts', 0, 'Points scored against a team in a regular season.'],
    ['bestAllPlay', 'Best all-play season', 'apPct', -1, 'pct', 1, 'Share of every other team beaten each week, had they all played each other.'],
    ['worstAllPlay', 'Worst all-play season', 'apPct', 1, 'pct', -1, 'Share of every other team beaten each week, had they all played each other.'],
    ['mostHighs', 'Most weekly high scores in a season', 'high', -1, 'n', 1, 'Weeks a team outscored the whole league.', 'weeks'],
    ['longestSeasonWin', 'Longest winning streak in a season', 'bestW', -1, 'n', 1, 'Consecutive wins inside one regular season.', 'games in a row'],
    ['longestSeasonLoss', 'Longest losing streak in a season', 'bestL', -1, 'n', -1, 'Consecutive losses inside one regular season.', 'games in a row'],
  ];
  const seasonRecs = SEASON.map(([id, title, key, dir, unit, tone, info, word]) => {
    const doneLines = seasonLines.filter((s) => s.done);
    const live = seasonLines.filter((s) => !s.done);
    const mark = doneLines.length ? [...doneLines].sort((a, b) => dir * (a[key] - b[key]))[0][key] : null;
    const lead = [...live].sort((a, b) => dir * (a[key] - b[key]))[0];
    // A "most" record that the season being played already beats can only stay with that season: it is settled.
    const settled = Boolean(lead && dir < 0 && mark != null && lead[key] > mark && ['pf', 'pa', 'high', 'bestW', 'bestL'].includes(key));
    const text = (s) => (unit === 'rec' ? recText(s) : key === 'apPct' ? `${s.apW}-${s.apL}` : null);
    const inPlay = lead ? { team: lead.team, value: lead[key], text: text(lead), games: lead.games, weeksLeft: lead.weeksLeft,
      pace: key === 'pf' || key === 'pa' ? r2((lead[key] / lead.games) * (lead.games + lead.weeksLeft)) : null, settled } : null;
    const pool = settled ? [...doneLines, ...live.filter((s) => s[key] > mark)] : doneLines;
    // Streaks in a season rank every run, so a team can hold two places in one season.
    const runKind = key === 'bestW' ? 'W' : key === 'bestL' ? 'L' : null;
    const entries = runKind
      ? pool.flatMap((s) => s.runs.filter((x) => x.type === runKind && x.length >= 2 && (s.done || x.length > mark)).map((x) => runEntry(s.team, x)))
        .sort((a, b) => b.value - a.value || a.season - b.season || a.week - b.week).slice(0, TOP)
      : [...pool].sort((a, b) => dir * (a[key] - b[key])).slice(0, TOP)
        .map((s) => ({ teams: [s.team], value: key === 'winPct' || key === 'apPct' ? Math.round(s[key] * 1e6) / 1e6 : s[key], season: s.season, text: text(s), pop: key === 'high' && s.highWeeks.length ? [[s.highWeeks.length === 1 ? 'Week' : 'Weeks', s.highWeeks.join(', ')], ...seasonPop(s)] : seasonPop(s) }));
    return { id, title, unit, tone, info, better: dir < 0 ? 'high' : 'low', ...(word ? { word } : {}), entries, inPlay };
  });

  /* ---- Records held and Prestige: the shared rule (D28) */
  const ids = rows.map((r) => r.teamId);
  const standing = standingPanels([...league, ...seasonRecs], ids, {
    ids: { 'held.most': 'hof.held.most', 'held.least': 'hof.held.least', 'prestige.high': 'hof.prestige.high', 'prestige.low': 'hof.prestige.low' },
    infoHeld: (n) => `The ${n} Hall of Fame records above that are good or bad: +1 for each good one a team holds, −1 for each bad one, and −1 to the team on the wrong end of a good matchup record. A shared record counts for everyone sharing it. A season record counts once its season is complete, or as soon as it can no longer be lost. Records that are neither, like Closest game or Most transactions, count nothing. Tap a team's figure for what counted.`,
    infoPrestige: (n) => `Records held, all the way down each top 10. On each of the ${n} good or bad records above, the top ten places earn 15, 12, 9, 7, 6, 5, 4, 3, 2 and 1 on a good record, and lose as much on a bad one; the team on the wrong end of a good matchup entry loses that entry's points. A team counts once per record, at its best place on a good record and its worst on a bad one. Tap a team's figure for what counted.`,
  });
  return { league, season: seasonRecs, standing, currentSeason };
}
