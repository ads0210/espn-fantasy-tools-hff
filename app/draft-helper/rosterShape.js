/**
 * The league's roster shape, read from its own settings.
 *
 * Draft Helper used to carry this league's shape as constants (one QB, two RBs, two
 * WRs, a TE, a FLEX, D/ST and K; seven bench; fixed position caps), so a fork whose
 * league plays two QBs or a superflex got the wrong needs and targets. The draft
 * payload already carries the league's settings, so the shape comes from there, and
 * today's values are kept only as the fallback for a payload without them.
 *
 * A plain module, so it is tested by behaviour.
 */

/** Today's shape: what a league without readable settings is assumed to play. */
export const DEFAULT_SHAPE = Object.freeze({
  starters: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "D/ST", "K"],
  bench: 7,
  limits: { QB: 4, RB: 8, WR: 8, TE: 3, K: 3, "D/ST": 3 },
  flex: { FLEX: ["RB", "WR", "TE"] },
  source: "default",
});

/* ESPN's lineup slot ids, in the site's canonical lineup order. A slot that takes
   more than one position carries the positions it takes. */
const SLOTS = [
  [0, "QB", null],
  [2, "RB", null],
  [4, "WR", null],
  [6, "TE", null],
  [3, "RB/WR", ["RB", "WR"]],
  [5, "WR/TE", ["WR", "TE"]],
  [23, "FLEX", ["RB", "WR", "TE"]],
  [7, "OP", ["QB", "RB", "WR", "TE"]],
  [16, "D/ST", null],
  [17, "K", null],
];
const BENCH = 20;
const POSITIONS = { 1: "QB", 2: "RB", 3: "WR", 4: "TE", 5: "K", 16: "D/ST" };

export function rosterShape(settings) {
  const rs = settings && settings.rosterSettings;
  const counts = rs && rs.lineupSlotCounts;
  if (!counts || typeof counts !== "object") return DEFAULT_SHAPE;
  const starters = [];
  const flex = {};
  for (const [id, label, eligible] of SLOTS) {
    const n = Number(counts[id] ?? counts[String(id)] ?? 0);
    for (let i = 0; i < n; i++) starters.push(label);
    if (n > 0 && eligible) flex[label] = eligible;
  }
  // A league whose lineup uses only slots this tool does not draw (IDP, say) keeps today's shape.
  if (!starters.length) return DEFAULT_SHAPE;
  const bench = Math.max(0, Number(counts[BENCH] ?? counts[String(BENCH)] ?? DEFAULT_SHAPE.bench));
  let limits = { ...DEFAULT_SHAPE.limits };
  if (rs.positionLimits && typeof rs.positionLimits === "object") {
    limits = {};
    for (const [id, pos] of Object.entries(POSITIONS)) {
      const v = Number(rs.positionLimits[id]);
      // ESPN writes 0 (or nothing) for "no limit".
      if (Number.isFinite(v) && v > 0) limits[pos] = v;
    }
  }
  return { starters, bench, limits, flex, source: "league" };
}

/** Whether a player at `pos` can fill a lineup slot labelled `slot`. */
export function fits(shape, slot, pos) {
  return slot === pos || Boolean(shape.flex && shape.flex[slot] && shape.flex[slot].includes(pos));
}

/**
 * A team's lineup from its picks, in pick order: single-position slots first, then
 * the slots that take several positions, narrowest first, then the bench.
 */
export function assignRoster(shape, picks) {
  const slots = shape.starters.map((s) => ({ slot: s, player: null }));
  const remaining = [...picks];
  const order = slots.map((s, i) => i).sort((a, b) => {
    const wa = shape.flex[slots[a].slot] ? shape.flex[slots[a].slot].length : 0;
    const wb = shape.flex[slots[b].slot] ? shape.flex[slots[b].slot].length : 0;
    return wa - wb || a - b;
  });
  for (const idx of order) {
    const i = remaining.findIndex((p) => fits(shape, slots[idx].slot, p.pos));
    if (i >= 0) { slots[idx].player = remaining[i]; remaining.splice(i, 1); }
  }
  const bench = remaining.slice(0, shape.bench);
  return { slots, bench, totalPicks: picks.length };
}
