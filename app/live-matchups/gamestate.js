/**
 * What a lineup row says about a player's NFL game: the quarter and clock and the score while it is live, the
 * opponent and kickoff before it starts, and the result once it is over. A plain module, so it is tested by behaviour.
 *
 * A player record carries `nfl` (their team), `game` ("AWAY@HOME"), `gameStatus` (pre, live, final), `gameState`
 * (ESPN's own short text) and `kickoff`; the NFL game itself, from the matchup's nflGames, carries the scores and,
 * while live, `period`, `clock` and `phase` (ESPN's status name).
 */

/** The other team in the player's game, and whether the player is the visitor ("at DAL") or at home ("vs DAL"). */
export function opponentOf(p) {
  if (!p || typeof p.game !== 'string' || !p.game.includes('@')) return null;
  const [away, home] = p.game.split('@');
  if (p.nfl === away) return { opp: home, at: true, text: `at ${home}` };
  if (p.nfl === home) return { opp: away, at: false, text: `vs ${away}` };
  return null;
}

const ordinalQ = (n) => (n >= 5 ? (n === 5 ? 'OT' : `${n - 4}OT`) : `Q${n}`);

/** "Q3 4:21", "Half", "End Q1", "OT 2:10": the quarter and clock of a live game, or ESPN's own text if they are missing. */
export function liveClock(game) {
  if (!game) return '';
  const n = Number(game.period);
  if (game.phase === 'STATUS_HALFTIME') return 'Half';
  if (!Number.isFinite(n) || n < 1) return game.state || '';
  if (game.phase === 'STATUS_END_PERIOD') return `End ${ordinalQ(n)}`;
  return game.clock ? `${ordinalQ(n)} ${game.clock}` : ordinalQ(n);
}

/** The player's team's score first: "BUF 21–17 NE". Empty before kickoff or with no score. */
export function scoreLine(p, game) {
  if (!p || !game || game.homeScore == null || game.awayScore == null) return '';
  const mineHome = p.nfl === game.home;
  const [ms, os] = mineHome ? [game.homeScore, game.awayScore] : [game.awayScore, game.homeScore];
  return `${p.nfl} ${ms}–${os} ${mineHome ? game.away : game.home}`;
}

/**
 * The small line under a player's name.
 *   yet to play: "at DAL · Sun 1:00 PM" (the opponent, then kickoff in the reader's zone); with no game found, just
 *                "BUF": a week off cannot be told apart from a game the scoreboard does not carry yet, so neither is claimed
 *   live:        "Q3 4:21 · BUF 21–17 DAL"
 *   final:       "Final · BUF 31–17 DAL"
 * `when` formats a kickoff instant for the reader; it is passed in so this module stays free of time-zone settings.
 */
export function playerMeta(p, game, when) {
  if (!p) return '';
  if (p.gameStatus === 'live') {
    const sc = scoreLine(p, game);
    const clock = liveClock(game) || p.gameState || 'Live';
    return sc ? `${clock} · ${sc}` : clock;
  }
  if (p.gameStatus === 'final') {
    const sc = scoreLine(p, game);
    const word = (game && /OT/.test(game.state || '')) ? 'Final/OT' : 'Final';
    return sc ? `${word} · ${sc}` : `${p.nfl} · ${p.gameState || 'Final'}`;
  }
  const o = opponentOf(p);
  if (!o) return p.nfl || '';
  let t = '';
  if (p.kickoff && when) { try { t = when(p.kickoff); } catch { t = ''; } }
  return t ? `${o.text} · ${t}` : o.text;
}

/** Points as a lineup shows them: a dash for a player whose game has not started, never a zero that reads as a result. */
export function pointsText(p, n1) {
  if (!p) return '';
  return p.gameStatus === 'pre' ? '–' : n1(p.points);
}

/** How far a player is through their projection, 0 to 1, or null when there is nothing to measure against. */
export function projectionShare(p) {
  if (!p || p.gameStatus === 'pre' || !(p.proj > 0)) return null;
  return Math.max(0, Math.min(1, p.points / p.proj));
}

/** The change since the last reading, rounded to a tenth, or 0 when there is nothing to show. */
export function pointsDelta(prev, next) {
  if (!Number.isFinite(prev) || !Number.isFinite(next)) return 0;
  const d = Math.round((next - prev) * 10) / 10;
  return Math.abs(d) >= 0.1 ? d : 0;
}

/**
 * How far through a game is, 0 to 1: regulation is four quarters of fifteen minutes, read from the quarter and the
 * clock; half time is half way; overtime is past the end of regulation, so it reads as full. Null when unknown.
 */
export function gameProgress(game) {
  if (!game) return null;
  if (game.status === 'final') return 1;
  if (game.status !== 'live') return 0;
  if (game.phase === 'STATUS_HALFTIME') return 0.5;
  const n = Number(game.period);
  if (!Number.isFinite(n) || n < 1) return null;
  if (n > 4) return 1;
  if (game.phase === 'STATUS_END_PERIOD') return n / 4;
  const m = /^(\d+):(\d{2})$/.exec(String(game.clock || ''));
  const left = m ? Number(m[1]) * 60 + Number(m[2]) : 15 * 60;
  return Math.max(0, Math.min(1, ((n - 1) * 900 + (900 - Math.min(900, left))) / 3600));
}
