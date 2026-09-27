/**
 * The league's draft, read from its own settings and picks.
 *
 * Draft Helper used to assume this league's draft: sixteen rounds, and a snake
 * order read only from the first round's picks. A fork with a longer bench, a
 * linear draft, or a draft whose picks ESPN has not yet listed got the wrong
 * board. The draft payload already carries the league's settings, so the plan
 * comes from there, and today's values are kept only as the fallback.
 *
 * A plain module, so it is tested by behaviour.
 */

/** What a league without readable settings or picks is assumed to draft. */
export const DEFAULT_ROUNDS = 16;

const IR_SLOT = 21;

/** Rounds: from the picks when ESPN has listed them, else the roster's size (injured reserve is not drafted). */
function roundsOf(settings, picks) {
  const fromPicks = picks.reduce((m, p) => Math.max(m, Number(p.roundId) || 0), 0);
  if (fromPicks > 0) return { rounds: fromPicks, source: 'picks' };
  const counts = settings && settings.rosterSettings && settings.rosterSettings.lineupSlotCounts;
  if (counts && typeof counts === 'object') {
    let n = 0;
    for (const [slot, c] of Object.entries(counts)) if (Number(slot) !== IR_SLOT) n += Number(c) || 0;
    if (n > 0) return { rounds: n, source: 'roster' };
  }
  return { rounds: DEFAULT_ROUNDS, source: 'default' };
}

/**
 * Snake or straight: ESPN names the type, and a draft already under way shows it,
 * because a snake's second round opens with the team that closed the first.
 */
function isSnake(settings, byRound, n) {
  const r1Last = byRound.get(`1:${n}`), r2First = byRound.get('2:1'), r1First = byRound.get('1:1');
  if (n > 1 && r1Last && r2First) {
    if (r2First.teamId === r1Last.teamId) return true;
    if (r1First && r2First.teamId === r1First.teamId) return false;
  }
  const type = settings && settings.draftSettings && settings.draftSettings.type;
  return type ? String(type).toUpperCase() !== 'LINEAR' : true;
}

export function draftPlan(settings, picks) {
  const list = Array.isArray(picks) ? picks : [];
  const ds = (settings && settings.draftSettings) || {};
  const { rounds, source } = roundsOf(settings, list);

  // The board's columns: the first round as drafted, else the order the league has set.
  let order = list.filter((p) => p.roundId === 1).sort((a, b) => a.roundPickNumber - b.roundPickNumber).map((p) => p.teamId);
  if (!order.length && Array.isArray(ds.pickOrder)) order = ds.pickOrder.filter((t) => Number.isFinite(Number(t)) && Number(t) > 0).map(Number);

  const byRound = new Map();
  for (const p of list) byRound.set(`${p.roundId}:${p.roundPickNumber}`, p);
  const n = order.length;
  const snake = isSnake(settings, byRound, n);

  /** A board cell: round r and column c, both counted from 0. Traded picks keep their place. */
  function slotAt(r, c) {
    const within = snake && r % 2 === 1 ? n - c : c + 1;
    const pick = byRound.get(`${r + 1}:${within}`) || null;
    return { overall: pick ? pick.overallPickNumber : r * n + within, pick };
  }

  return {
    rounds, roundsFrom: source, order, snake,
    teamCount: n || Number(settings && settings.size) || 0,
    type: ds.type || null,
    timePerSelection: Number(ds.timePerSelection) || null,
    keeperCount: Number(ds.keeperCount) || 0,
    slotAt,
  };
}
