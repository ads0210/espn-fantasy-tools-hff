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
