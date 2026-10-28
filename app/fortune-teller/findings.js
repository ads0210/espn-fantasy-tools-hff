/**
 * Week 6 (plan N6, PD23): the small finding the home page's matchup banners read, stored with each update so it is
 * never counted on a request. For one team, at one update: its next game, its playoff odds if it wins that game and
 * if it loses it, and whether that game moves its odds more than any other game it has left.
 *
 * Plain and pure: the build object hands it the team's map and the engine's totalsOf, and a test checks it against
 * direct counts.
 */

/** Win and loss odds for each game team `i` still has after the update's played games. */
export function ownGameOdds(summary, tr, i, map, totalsOf) {
  const G = summary.games.length, ix = new Map(summary.teams.map((t, k) => [t.id, k]));
  const base = new Int8Array(G).fill(-1);
  for (let j = 0; j < tr.fixed; j++) base[j] = summary.future[j].digit;
  const out = [];
  for (let j = tr.fixed; j < G; j++) {
    const g = summary.games[j], home = ix.get(g.a) === i, away = ix.get(g.b) === i;
    if (!home && !away) continue;
    const at = (d) => { const p = base.slice(); p[j] = d; const t = totalsOf(map, p, summary.places); return t[0] ? t[1] / t[0] : 0; };
    out.push({ j, week: g.week, win: at(home ? 1 : 2), loss: at(home ? 2 : 1) });
  }
  return out;
}

/**
 * The finding: the next game's figures, and the three facts the banners name. Must Win: a loss leaves no way into the
 * playoffs and a win keeps one. Win and You're In: a win clinches a place and a loss does not. Critical: no game the
 * team has left moves its odds more (and it moves them at all).
 */
export function teamFinding(games) {
  if (!games.length) return null;
  const next = games.reduce((a, g) => (g.week < a.week || (g.week === a.week && g.j < a.j) ? g : a), games[0]);
  const swing = (g) => g.win - g.loss;
  const most = Math.max(...games.map(swing));
  const eps = 1e-9;
  return {
    week: next.week,
    win: +next.win.toFixed(6), loss: +next.loss.toFixed(6),
    mustWin: next.loss <= eps && next.win > eps,
    winIn: next.win >= 1 - eps && next.loss < 1 - eps,
    critical: swing(next) > 0.005 && swing(next) >= most - eps,
  };
}

/**
 * Matchup Insights (plan D33): one team's column of the swing table for the coming week, from one lean count of its
 * map. For every game of the coming week (the earliest week still to play at this update), the team's playoff odds
 * if the home side (team A) wins and if the away side wins; its odds if it wins every game it has left; and the one
 * game it has left that moves its odds most. Exact: every figure is a share of the paths the map covers.
 */
export function teamSwing(summary, tr, i, map, countLean, totalsOf) {
  const G = summary.games.length, ix = new Map(summary.teams.map((t, k) => [t.id, k]));
  const base = new Int8Array(G).fill(-1);
  for (let j = 0; j < tr.fixed; j++) base[j] = summary.future[j].digit;
  const left = [];
  for (let j = tr.fixed; j < G; j++) left.push(j);
  if (!left.length) return null;
  const week = Math.min(...left.map((j) => summary.games[j].week));
  const c = countLean(map, base, summary.places);
  const share = (j, d) => { const p = c.M[6 * j + 2 * d]; return p ? c.M[6 * j + 2 * d + 1] / p : 0; };
  const r6 = (x) => +x.toFixed(6);
  const next = left.filter((j) => summary.games[j].week === week).map((j) => ({ j, home: r6(share(j, 1)), away: r6(share(j, 2)) }));
  let critical = null, most = -1;
  const out = base.slice();
  for (const j of left) {
    const g = summary.games[j], home = ix.get(g.a) === i, away = ix.get(g.b) === i;
    if (!home && !away) continue;
    const sw = Math.abs(share(j, 1) - share(j, 2));
    if (sw > most + 1e-12) { most = sw; critical = j; }
    out[j] = home ? 1 : 2;
  }
  const t = totalsOf(map, out, summary.places);
  return { week, odds: r6(c.total[0] ? c.total[1] / c.total[0] : 0), next, winOut: r6(t[0] ? t[1] / t[0] : 0), critical: most > 0.005 ? critical : null };
}

/**
 * The league's swing table at one update, from every team's column: { week, teams [ids], odds [by team],
 * games [{ j, a, b, home [by team], away [by team] }], winOut [by team], critical [game index or null, by team] }.
 * A team whose map was missing reads null throughout.
 */
export function assembleSwing(summary, cols) {
  const first = cols.find(Boolean);
  if (!first) return null;
  const n = summary.teams.length;
  const games = first.next.map(({ j }) => ({ j, a: summary.games[j].a, b: summary.games[j].b,
    home: cols.map((c) => (c ? (c.next.find((x) => x.j === j) || {}).home ?? null : null)),
    away: cols.map((c) => (c ? (c.next.find((x) => x.j === j) || {}).away ?? null : null)) }));
  return { week: first.week, teams: summary.teams.map((t) => t.id), odds: cols.map((c) => (c ? c.odds : null)), games,
    winOut: cols.map((c) => (c ? c.winOut : null)), critical: cols.map((c) => (c ? c.critical : null)), n };
}
