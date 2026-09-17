/* ============================================================================
   Trade Analyzer — evaluation engine.

   The DATA blob above is real: teams, owners, rosters, trade blocks, waiver
   ranks, ESPN playoff odds and all three live pending proposals, read from the
   league on 2026-09-12.

   The evaluator below is a STAND-IN. It is deterministic, it respects the
   output contract in trade-algorithm-plan.md (a per-row, per-side vector of
   contributions at weight 1.00, with the client doing SUM(w_i * points_i)), and
   the structural behaviours are real — sequential attribution, the monotone
   playoff-odds fit over ESPN's own cross-section, forced-drop selection, the
   verdict bands and guards, the add/remove/swap balancing neighbourhood. The
   per-row formulas are illustrative placeholders, not the specified ones.
   What this sample is for is the shape of the surface, not the numbers on it.
   ========================================================================= */


import { TRADE_ROWS, TRADE_GROUPS } from "../../src/traderows.js";

/**
 * Builds an evaluator bound to one digest.
 *
 * Everything below is pure with respect to the payload: the same digest and the
 * same weights always produce the same vector. Weight selection is held on the
 * instance rather than threaded through every call, because the ledger, the
 * verdict and the rebalancing pass all have to agree on it within a single
 * render and passing it eleven levels down bought nothing.
 */
export function createEngine(digest, ADMIN) {
  const DATA = adaptDigest(digest);

/* The evaluator's own version, reported in Details. Bumped when the row set,
   the attribution order or a default weight changes — a saved analysis link is
   only reproducible against the engine that produced it. */
const ENGINE_VERSION = "ta-1";

/* --- model constants (from §13 of the plan) ------------------------------ */
const MIN_GAP = 4.0;
const MIN_SCALE = 10.0;
const BALANCE_HELP_BAND = 0.25;
const BALANCE_SUGGESTIONS = 3;
const OFFER_SOON_HOURS = 6;
const BENCH_DISCOUNT = 0.30;
const LOPSIDED_RATIO = 2.5;

/* Value-point conversions for this sample. One value point is roughly one
   projected fantasy point per remaining week. */
const ODDS_VP = 55;
const TITLE_VP = 90;
const PLACE_VP = 26;

/* The starting lineup, read from the league's own settings rather than assumed.
   FLEX resolves last against whatever the dedicated slots did not take, which
   is what makes the greedy fill below exact for this slot structure. */
const FLEX_ELIGIBLE = { RB: ["RB"], WR: ["WR"], TE: ["TE"], QB: ["QB"], K: ["K"],
  "D/ST": ["D/ST"], FLEX: ["RB", "WR", "TE"], "OP": ["QB", "RB", "WR", "TE"] };
const BENCH_SLOT_NAMES = new Set(["BE", "IR", "Bench"]);
const SLOTS = (DATA.league.slots || [])
  .filter((s) => !BENCH_SLOT_NAMES.has(s.name))
  .map((s) => [s.name, FLEX_ELIGIBLE[s.name] || [s.name]])
  .sort((a, b) => (a[0] === "FLEX" ? 1 : 0) - (b[0] === "FLEX" ? 1 : 0));

const ROSTER_CAP = DATA.league.rosterCap || 16;
/* Position limits are not in any payload this tool reads. Rather than pin one
   league's numbers, the ceiling is taken from what the league is already
   carrying plus headroom: high enough never to block a trade ESPN would
   accept, low enough to catch a deal that stacks a position absurdly. */
const POS_LIMIT = (() => {
  const max = {};
  for (const t of DATA.teams) {
    const c = {};
    for (const p of t.roster) c[p.pos] = (c[p.pos] || 0) + 1;
    for (const k of Object.keys(c)) max[k] = Math.max(max[k] || 0, c[k]);
  }
  for (const k of Object.keys(max)) max[k] += 2;
  return max;
})();

const INJ_RATE = { QB: 0.07, RB: 0.14, WR: 0.09, TE: 0.09, K: 0.02, "D/ST": 0.02 };
const SIGMA_POS = { QB: 6, RB: 7, WR: 8, TE: 6, K: 4, "D/ST": 6 };
const PLAY_PROB = { ACTIVE: 1, NORMAL: 1, QUESTIONABLE: 0.75, DOUBTFUL: 0.35, OUT: 0, INJURY_RESERVE: 0 };
/* Season-scale projection of what is freely available on waivers at each
   position. A slot a trade leaves empty is filled from here, not left at zero:
   trading away your only kicker costs the difference against a streamer, not
   that kicker's whole projection. Kickers and defences sit close to the
   rostered ones, which is the same fact R18 prices. */
const REPLACEMENT = { QB: 205, RB: 95, WR: 100, TE: 85, K: 132, "D/ST": 98 };

const WEEKS_LEFT = DATA.league.finalSP - DATA.league.sp + 1;

/* --- the 28 rows, in canonical attribution order (§7) --------------------
   The order is part of the specification: reordering silently changes what
   every default weight means. */
const ROWS = TRADE_ROWS;
const GROUPS = TRADE_GROUPS;

const BANDS = [
  { max: 0.10, key: "even", label: "Even" },
  { max: 0.25, key: "slight", label: "Slightly leans" },
  { max: 0.45, key: "leans", label: "Leans" },
  { max: 0.75, key: "favors", label: "Favors" },
  { max: Infinity, key: "heavy", label: "Heavily favors" },
];

/* --- small helpers -------------------------------------------------------- */
const teamById = (id) => DATA.teams.find((t) => t.id === id);
const playerById = (id) => {
  for (const t of DATA.teams) { const p = t.roster.find((x) => x.id === id); if (p) return p; }
  return null;
};
const ownerOf = (t) => (t.ow || []).filter(Boolean).join(", ");
const posClass = (p) => "pos-" + (p === "D/ST" ? "DST" : p);
const sgn = (n) => (n > 0 ? "+" : n < 0 ? "\u2212" : "");
const vp = (n) => sgn(n) + Math.abs(n).toFixed(1);
const numCls = (n) => (Math.abs(n) < 0.05 ? "zero" : n > 0 ? "pos" : "neg");

/* Real time. The digest is minutes old at worst, but an offer's expiry is a
   wall-clock fact and a countdown that runs from the payload's age would drift
   further behind the longer a tab stayed open. */
function nowMs() { return Date.now(); }

/* ESPN states the trade deadline as epoch milliseconds. Date.parse() of a
   number stringifies it and answers NaN, and every comparison against NaN is
   false — which read as "the deadline has passed" on a league months away from
   one. Accepts either form, because a fork's payload may differ. */
function deadlineMs() {
  const d = DATA.league.deadline;
  if (d == null || d === '') return 0;
  if (typeof d === 'number') return d;
  const parsed = Date.parse(d);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/* --- time, rendered in the browser from the ISO instant -------------------- */
let TZ = null;
function setZone(z) { TZ = z || null; }
function tzLabel() { try { return TZ || Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return "UTC"; } }
function fmtWhen(ms) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tzLabel(), month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit",
    }).format(new Date(ms));
  } catch (e) { return new Date(ms).toISOString(); }
}
function countdown(ms) {
  const d = ms - nowMs();
  if (d <= 0) return { text: "Expired", cls: "gone", soon: false, gone: true };
  const h = Math.floor(d / 3600000); const m = Math.floor((d % 3600000) / 60000);
  const text = h >= 24 ? Math.floor(h / 24) + "d " + (h % 24) + "h" : h + "h " + String(m).padStart(2, "0") + "m";
  return { text: text, cls: h < OFFER_SOON_HOURS ? "soon" : "", soon: h < OFFER_SOON_HOURS, gone: false };
}

/* =========================================================================
   LINEUP AND ROSTER MECHANICS
   ========================================================================= */
function ros(p) { return p.pr * (WEEKS_LEFT / 17); }

/* Exact for this slot structure: FLEX is the only overlapping slot and it is
   resolved last against whatever the dedicated slots did not take. */
function optimalLineup(roster) {
  const pool = roster.slice().sort((a, b) => ros(b) - ros(a));
  const used = new Set(); const starters = []; const unfilled = [];
  let total = 0;
  for (const [name, elig] of SLOTS) {
    const pick = pool.find((p) => !used.has(p.id) && elig.indexOf(p.pos) >= 0);
    if (pick) { used.add(pick.id); starters.push(pick); total += ros(pick); }
    else {
      unfilled.push(name);
      total += (REPLACEMENT[name === "FLEX" ? "RB" : name] || 90) * (WEEKS_LEFT / 17);
    }
  }
  const bench = roster.filter((p) => !used.has(p.id));
  return { starters, bench, total, legal: unfilled.length === 0, unfilled, ids: used };
}

function posCounts(roster) {
  const c = {}; for (const p of roster) c[p.pos] = (c[p.pos] || 0) + 1; return c;
}
function overLimits(roster) {
  const c = posCounts(roster);
  return Object.keys(POS_LIMIT).filter((k) => (c[k] || 0) > POS_LIMIT[k]);
}

/* §8.3 — a small constrained optimisation, not a sort. Dropping the lowest
   projections outright can leave a roster unable to field a legal lineup. */
function chooseDrops(roster, n) {
  if (n <= 0) return [];
  const drops = []; let cur = roster.slice();
  for (let k = 0; k < n; k++) {
    const cands = cur.slice().sort((a, b) => ros(a) - ros(b));
    let chosen = null;
    for (const c of cands) {
      const trial = cur.filter((p) => p.id !== c.id);
      if (optimalLineup(trial).legal && overLimits(trial).length === 0) { chosen = c; break; }
    }
    if (!chosen) chosen = cands[0];
    drops.push(chosen); cur = cur.filter((p) => p.id !== chosen.id);
  }
  return drops;
}

function applyTrade(roster, outIds, incoming) {
  const kept = roster.filter((p) => outIds.indexOf(p.id) < 0);
  return kept.concat(incoming);
}

/* =========================================================================
   §11 — PLAYOFF ODDS. ESPN publishes the level; we fit the curve across the
   league's own ten (strength, playoffPct) pairs and read the slope.
   ========================================================================= */
const ODDS = (function fitOdds() {
  const pts = DATA.teams.map((t) => ({
    id: t.id, S: optimalLineup(t.roster).total / WEEKS_LEFT, P: t.pp == null ? 0 : t.pp,
  }));
  const sum = pts.reduce((s, p) => s + p.P, 0);
  const tol = 0.15 * DATA.league.playoffTeams;
  const coherent = Math.abs(sum - DATA.league.playoffTeams) <= tol;

  /* Grid search over a logistic with k > 0, which makes the fit monotone by
     construction. An unconstrained fit over ten noisy points can come back
     with a negative slope, i.e. improving your roster hurts your odds. */
  const Svals = pts.map((p) => p.S);
  const lo = Math.min.apply(null, Svals); const hi = Math.max.apply(null, Svals);
  let best = { k: 0.2, S0: (lo + hi) / 2, sse: Infinity };
  for (let ki = 1; ki <= 90; ki++) {
    const k = ki * 0.01;
    for (let si = 0; si <= 60; si++) {
      const S0 = lo + ((hi - lo) * si) / 60;
      let sse = 0;
      for (const p of pts) { const e = 1 / (1 + Math.exp(-k * (p.S - S0))) - p.P; sse += e * e; }
      if (sse < best.sse) best = { k: k, S0: S0, sse: sse };
    }
  }
  const residual = Math.sqrt(best.sse / pts.length);
  const spread = Math.sqrt(pts.reduce((s, p) => s + Math.pow(p.P - sum / pts.length, 2), 0) / pts.length);
  const blend = Math.max(0, Math.min(0.9, spread * 3.4));
  return {
    k: best.k, S0: best.S0, sum: sum, coherent: coherent, residual: residual,
    blend: blend, source: coherent ? "espn" : "modelled",
    S: (id) => pts.find((p) => p.id === id).S,
    P: (id) => pts.find((p) => p.id === id).P,
    slope: (S) => { const p = 1 / (1 + Math.exp(-best.k * (S - best.S0))); return best.k * p * (1 - p); },
  };
})();

/* =========================================================================
   GATES (§4.6). Fifteen checks; the ones that can fire here are implemented.
   ========================================================================= */
function runGates(trade) {
  const A = teamById(trade.a); const B = teamById(trade.b);
  const g = [];
  if (!A || !B) {
    return { gates: [{ id: "G12", passed: false, reason: "Only two-team trades can be analysed", blocking: true }],
      finalA: [], finalB: [], afterA: [], afterB: [], dropsA: [], dropsB: [], inA: [], inB: [] };
  }
  const add = (id, passed, reason, blocking) => g.push({ id, passed, reason, blocking: blocking !== false });
  add("G1", trade.aOut.length > 0 && trade.bOut.length > 0, "Both sides must send at least one asset");
  add("G11", trade.a !== trade.b, "A team cannot trade with itself");
  add("G12", (trade.teams || 2) === 2, "Only two-team trades can be analysed");
  const overlap = trade.aOut.filter((id) => trade.bOut.indexOf(id) >= 0);
  add("G2", overlap.length === 0, "A player cannot appear on both sides");
  add("G3", trade.aOut.every((id) => A.roster.some((p) => p.id === id))
    && trade.bOut.every((id) => B.roster.some((p) => p.id === id)),
  "Every asset must be on the roster it is sent from");
  add("G8", !deadlineMs() || nowMs() < deadlineMs(), "The trade deadline has passed");
  add("G9", true, "No asset is trade-locked");
  add("G10", true, "Pick trading is disabled in this league");
  add("G15", true, "League transactions are not locked");

  const inA = trade.bOut.map(playerById); const inB = trade.aOut.map(playerById);
  const afterA = applyTrade(A.roster, trade.aOut, inA);
  const afterB = applyTrade(B.roster, trade.bOut, inB);
  const dropsA = chooseDrops(afterA, Math.max(0, afterA.length - ROSTER_CAP));
  const dropsB = chooseDrops(afterB, Math.max(0, afterB.length - ROSTER_CAP));
  const finalA = afterA.filter((p) => dropsA.indexOf(p) < 0);
  const finalB = afterB.filter((p) => dropsB.indexOf(p) < 0);
  add("G4", finalA.length <= ROSTER_CAP && finalB.length <= ROSTER_CAP, "Both rosters must fit the 16-man cap");
  /* Non-blocking on purpose. ESPN accepted the live 3-for-3 in this league
     even though it leaves one side with no kicker, so a blocking gate here
     would mark a real, standing offer as impossible. It is surfaced as a
     flag and priced through replacement level instead. */
  add("G5", optimalLineup(finalA).legal && optimalLineup(finalB).legal,
    "A starting slot would be left unfilled", false);
  add("G6", overLimits(finalA).length === 0 && overLimits(finalB).length === 0, "Position limits must be respected");
  add("G7", dropsA.length + dropsB.length === 0 || (finalA.length <= ROSTER_CAP && finalB.length <= ROSTER_CAP),
    "A legal drop set must exist");
  add("G13", !trade.expires || nowMs() < trade.expires, "The offer must not have expired");
  add("G14", true, "No asset is committed to an already-accepted trade");
  return { gates: g, finalA, finalB, afterA, afterB, dropsA, dropsB, inA, inB };
}

/* =========================================================================
   THE EVALUATOR. Returns points at weight 1.00 per row per side.
   ========================================================================= */
function analyzeTrade(trade) {
  const A = teamById(trade.a); const B = teamById(trade.b);
  /* A three-team proposal, or one naming a team that is no longer in the
     league. Listed rather than hidden, and answered with a result the UI can
     render instead of an exception. */
  if (!A || !B || (trade.teams || 2) > 2) {
    return {
      valid: false, unsupported: true, source: trade.source, rows: [], flags: [],
      gates: [{ id: 'G12', passed: false, blocking: true,
        reason: 'Only two-team trades can be analysed' }],
      drops: { a: [], b: [] },
      ctxA: { team: A || { n: 'Unknown team', roster: [] }, outs: [], drops: [] },
      ctxB: { team: B || { n: 'Unknown team', roster: [] }, outs: [], drops: [] },
      trade,
      meta: { horizon: DATA.league.sp + "\u2013" + DATA.league.finalSP,
        weeksRemaining: WEEKS_LEFT, confidence: 'low', dataAsOf: DATA.asOf,
        engineVersion: ENGINE_VERSION, oddsSource: ODDS.source },
    };
  }
  const pre = runGates(trade);
  const blocking = pre.gates.filter((x) => !x.passed && x.blocking);
  const week = DATA.league.sp;

  const sideCtx = (team, outIds, incoming, after, final, drops, other) => {
    const before = team.roster;
    const outs = outIds.map(playerById);
    const lb = optimalLineup(before); const la = optimalLineup(final);
    const rosIn = incoming.reduce((s, p) => s + ros(p), 0);
    const rosOut = outs.reduce((s, p) => s + ros(p), 0);
    return { team, before, outs, incoming, after, final, drops, lb, la, rosIn, rosOut, other };
  };
  const ctxA = sideCtx(A, trade.aOut, pre.inA, pre.afterA, pre.finalA, pre.dropsA, B);
  const ctxB = sideCtx(B, trade.bOut, pre.inB, pre.afterB, pre.finalB, pre.dropsB, A);

  const rowFns = {
    /* Sequential attribution over the canonical order: each row's points are
       the change that effect caused at its own step, so the rows sum to the
       total by construction. */
    R1: (c) => ({ v: (c.rosIn - c.rosOut) / WEEKS_LEFT,
      raw: sgn(c.rosIn - c.rosOut) + Math.abs(c.rosIn - c.rosOut).toFixed(0) + " proj pts" }),
    R2: (c, memo) => {
      const total = (c.la.total - c.lb.total) / WEEKS_LEFT;
      const v = total - memo.R1;
      return { v, raw: (c.la.starters.length ? sgn(total) + Math.abs(total).toFixed(1) + " pts/wk lineup" : "") };
    },
    R3: null, R5: null, R6: null, R7: null, R10: null, R24: null,
    R4: (c) => { const d = (c.incoming.reduce((s, p) => s + p.ow, 0) - c.outs.reduce((s, p) => s + p.ow, 0)) / 100;
      return { v: d * 1.6, raw: sgn(d) + Math.abs(d * 100).toFixed(0) + " pts rostered" }; },
    R8: (c, memo) => ({ v: memo.R1 * 0.09, raw: "seeding on total points" }),
    R9: (c) => {
      const exp = (arr) => arr.reduce((s, p) => s + ros(p) * (INJ_RATE[p.pos] || 0.08)
        * (2 - (PLAY_PROB[p.inj] == null ? 1 : PLAY_PROB[p.inj])), 0);
      const v = -(exp(c.incoming) - exp(c.outs)) / WEEKS_LEFT;
      return { v, raw: "expected availability cost" };
    },
    R11: (c) => { const bye = (p) => ((p.tm.charCodeAt(0) * 7 + p.tm.length) % 10) + 5;
      const starters = new Set(c.lb.starters.map((p) => bye(p)));
      const clash = c.incoming.filter((p) => starters.has(bye(p))).length;
      return { v: -clash * 0.42, raw: clash ? clash + " bye clash" + (clash > 1 ? "es" : "") : "no new bye clash" }; },
    R12: (c) => { const lo = (a) => (a.length ? Math.min.apply(null, a.map((p) => p.ow)) : 0);
      const d = (lo(c.incoming) - lo(c.outs)) / 100; return { v: d * 1.1, raw: "weakest role in the package" }; },
    R13: (c) => {
      let upIn = 0; let upOut = 0;
      const starterAt = (pos) => { const s = c.lb.starters.filter((p) => p.pos === pos);
        return s.length ? ros(s[s.length - 1]) : 0; };
      for (const p of c.incoming) upIn += Math.max(0, ros(p) - starterAt(p.pos));
      for (const p of c.outs) upOut += Math.max(0, ros(p) - starterAt(p.pos));
      const v = ((upIn - upOut) / WEEKS_LEFT) * 0.35;
      return { v, raw: "against this side's weakest slot" };
    },
    R14: (c) => { const bv = (r) => optimalLineup(r).bench.reduce((s, p) => s + ros(p), 0) * BENCH_DISCOUNT;
      const v = (bv(c.final) - bv(c.before)) / WEEKS_LEFT;
      return { v, raw: "bench at 30% of a starter" }; },
    R15: (c) => { const lost = c.drops.reduce((s, p) => s + ros(p), 0) * BENCH_DISCOUNT;
      return { v: -lost / WEEKS_LEFT, raw: c.drops.length ? c.drops.length + " forced cut" + (c.drops.length > 1 ? "s" : "") : "no cuts forced" }; },
    R16: (c) => { const floor = (c.team.wr / DATA.league.size) * 1.25;
      const v = (c.incoming.length - c.outs.length) * floor;
      return { v, raw: "waiver rank " + c.team.wr + " of " + DATA.league.size }; },
    R17: (c) => { const fx = (a) => a.filter((p) => ["RB", "WR", "TE"].indexOf(p.pos) >= 0).length;
      return { v: (fx(c.incoming) - fx(c.outs)) * 0.45, raw: "FLEX-eligible bodies" }; },
    R18: (c) => { const st = (a) => a.filter((p) => p.pos === "K" || p.pos === "D/ST")
      .reduce((s, p) => s + ros(p), 0);
      const v = -((st(c.incoming) - st(c.outs)) / WEEKS_LEFT) * 0.86;
      return { v, raw: "K and D/ST are streamable" }; },
    R19: (c, memo) => {
      const S = ODDS.S(c.team.id); const P = ODDS.P(c.team.id);
      const dS = memo.R1 + memo.R2;
      const after = Math.max(0, Math.min(1, P + ODDS.slope(S) * dS));
      memo._p = { before: P, after };
      return { v: (after - P) * ODDS_VP, raw: (P * 100).toFixed(1) + "% \u2192 " + (after * 100).toFixed(1) + "%" };
    },
    R20: (c, memo) => { const p = memo._p || { before: 0, after: 0 };
      const rd = (q) => q * 0.5; const t = (q) => q * rd(q) * rd(q);
      return { v: (t(p.after) - t(p.before)) * TITLE_VP, raw: "two two-week rounds" }; },
    R21: (c, memo) => { const p = memo._p || { before: 0, after: 0 };
      return { v: (p.after - p.before) * PLACE_VP * 0.5, raw: "consolation ladder included" }; },
    R22: (c, memo) => { const av = (a) => a.reduce((s, p) => s + ros(p)
      * (PLAY_PROB[p.inj] == null ? 1 : PLAY_PROB[p.inj]), 0);
      const raw = ((av(c.incoming) - av(c.outs)) / 17) * 3.2 / WEEKS_LEFT * 4;
      return { v: raw - memo.R1 * 0.42, raw: "periods 14\u201317, weighted" }; },
    R23: (c, memo) => { const sig = (r) => Math.sqrt(optimalLineup(r).starters
      .reduce((s, p) => s + Math.pow(SIGMA_POS[p.pos] || 6, 2), 0));
      const dv = sig(c.final) - sig(c.before);
      const steep = ODDS.slope(ODDS.S(c.team.id)) / (ODDS.k / 4);
      return { v: dv * 0.30 * (steep - 0.5), raw: "fitted slope " + steep.toFixed(2) }; },
    R25: (c) => { const d = (c.incoming.reduce((s, p) => s + p.ow, 0)
      - c.outs.reduce((s, p) => s + p.ow, 0)) / 100;
      return { v: d * 2.2, raw: sgn(d) + Math.abs(d * 100).toFixed(0) + " market share" }; },
    R26: (c) => ({ v: (c.outs.length - c.incoming.length) * 0.55,
      raw: c.outs.length > c.incoming.length ? "consolidating" : c.outs.length < c.incoming.length ? "spreading" : "even shape" }),
    R27: null, R28: null,
  };

  const memoA = {}; const memoB = {};
  const rows = ROWS.map((spec) => {
    const inert = spec.needs != null && week < spec.needs;
    const off = Boolean(spec.off);
    const fn = rowFns[spec.id];
    let a = { v: 0, raw: null }; let b = { v: 0, raw: null };
    if (!inert && !off && fn) { a = fn(ctxA, memoA); b = fn(ctxB, memoB); }
    memoA[spec.id] = a.v; memoB[spec.id] = b.v;
    return {
      id: spec.id, label: spec.n, group: spec.g, slider: Boolean(spec.s),
      defaultWeight: spec.w, adminWeight: ADMIN_WEIGHTS[spec.id] == null ? spec.w : ADMIN_WEIGHTS[spec.id],
      help: spec.h, inert, off: spec.off || null,
      sideA: { points: a.v, display: a.raw }, sideB: { points: b.v, display: b.raw },
    };
  });

  /* Flags — listed, never scored (§10). */
  const flags = [];
  if (ctxA.drops.length) flags.push({ side: A.n, id: "F-drops", label: "Cuts required", note: ctxA.drops.length + " player" + (ctxA.drops.length > 1 ? "s" : "") + " must be released to make room." });
  if (ctxB.drops.length) flags.push({ side: B.n, id: "F-drops", label: "Cuts required", note: ctxB.drops.length + " player" + (ctxB.drops.length > 1 ? "s" : "") + " must be released to make room." });
  for (const [team, outIds] of [[A, trade.aOut], [B, trade.bOut]]) {
    const tb = outIds.map(playerById).filter((p) => p && p.bl === "UNTOUCHABLE");
    if (tb.length) flags.push({ side: team.n, id: "F15", label: "Marked untouchable",
      note: tb.map((p) => p.n).join(", ") + " " + (tb.length > 1 ? "are" : "is") + " marked UNTOUCHABLE on this team's trade block. That states willingness, not worth \u2014 it does not change the valuation." });
    const ob = outIds.map(playerById).filter((p) => p && p.bl === "ON_THE_BLOCK");
    if (ob.length) flags.push({ side: team.n, id: "F15", label: "Openly available",
      note: ob.length + " of the assets " + team.n + " is sending " + (ob.length > 1 ? "are" : "is") + " marked ON THE BLOCK." });
  }
  if (!A.roster.some((p) => p.bl) || !B.roster.some((p) => p.bl)) {
    const who = !A.roster.some((p) => p.bl) ? A.n : B.n;
    flags.push({ side: who, id: "F15", label: "No trade block set", note: who + " has not set a trade block, so nothing can be read from it either way." });
  }
  const totA0 = rows.reduce((s, r) => s + r.defaultWeight * r.sideA.points, 0);
  const totB0 = rows.reduce((s, r) => s + r.defaultWeight * r.sideB.points, 0);
  if (Math.abs(totA0) > LOPSIDED_RATIO * Math.max(1, Math.abs(totB0))
    || Math.abs(totB0) > LOPSIDED_RATIO * Math.max(1, Math.abs(totA0))) {
    flags.push({ side: "both", id: "F11", label: "Lopsided", note: "One side's total is more than " + LOPSIDED_RATIO + "\u00d7 the other's." });
  }
  for (const ctx of [ctxA, ctxB]) {
    const uf = optimalLineup(ctx.final).unfilled;
    if (uf.length) flags.push({ side: ctx.team.n, id: "F-slot",
      label: "Leaves a slot unfilled",
      note: "After this trade " + ctx.team.n + " has nobody for " + uf.join(" or ")
        + ". ESPN allows the deal; the cost of streaming a replacement is priced in, "
        + "but somebody has to remember to do it." });
  }
  if (ODDS.source === "modelled") flags.push({ side: "both", id: "F18", label: "Playoff odds are modelled", note: "ESPN's published odds failed the coherence check, so the odds rows were computed internally and deserve less trust." });
  if (week < 3) flags.push({ side: "both", id: "F13", label: "Early season", note: "Six rows have nothing to compute from until roughly week 3. They are listed and inert rather than hidden." });
  if (trade.overlaps && trade.overlaps.length) {
    flags.push({ side: "both", id: "F21", label: "Also in another offer",
      note: "A player in this trade appears in " + trade.overlaps.length + " other pending offer" + (trade.overlaps.length > 1 ? "s" : "") + ". Accepting one can invalidate the other." });
  }
  if (trade.staleGates) flags.push({ side: "both", id: "F19", label: "No longer valid", note: "ESPN validated this deal when it was offered. A gate is failing now, so something has changed since." });

  return {
    valid: blocking.length === 0, source: trade.source, gates: pre.gates, rows, flags,
    drops: { a: ctxA.drops, b: ctxB.drops }, ctxA, ctxB, trade,
    meta: { horizon: DATA.league.sp + "\u2013" + DATA.league.finalSP, weeksRemaining: WEEKS_LEFT,
      confidence: week < 3 ? "low" : week < 7 ? "building" : "steady",
      dataAsOf: DATA.asOf, engineVersion: ENGINE_VERSION, oddsSource: ODDS.source },
  };
}

/* --- weights: developer / admin / session sliders (§3.4) ------------------- */
/* Three layers: developer defaults in ROWS, an administrator's adjustments
   stored for the league, and this session's sliders. The administrator layer
   is empty until one is set, and the toggle that selects it appears only when
   it actually differs — a control that changes nothing is worse than absent. */
const ADMIN_WEIGHTS = ADMIN || {};
let weightSource = "developer";
let sessionWeights = {};
function baseWeight(r) { return weightSource === "admin" ? r.adminWeight : r.defaultWeight; }
function appliedWeight(r) { return sessionWeights[r.id] == null ? baseWeight(r) : sessionWeights[r.id]; }
const ADMIN_DIFFERS = ROWS.some((r) => ADMIN_WEIGHTS[r.id] != null && ADMIN_WEIGHTS[r.id] !== r.w);

/* --- totals, verdict (§9) ------------------------------------------------- */
function totalsFor(res) {
  let a = 0; let b = 0;
  for (const r of res.rows) { const w = appliedWeight(r); a += w * r.sideA.points; b += w * r.sideB.points; }
  return { a, b };
}
function verdictFor(res, tot) {
  const allZero = ROWS.every((r) => appliedWeight(r) === 0);
  if (allZero) return { key: "none", label: "No statistics selected", imbalance: 0, gap: 0,
    beneficiary: null, desc: null, descKey: "none" };
  const gap = tot.a - tot.b;
  const scale = Math.max((Math.abs(tot.a) + Math.abs(tot.b)) / 2, MIN_SCALE);
  let imbalance = Math.abs(gap) / scale;
  if (Math.abs(gap) < MIN_GAP) imbalance = 0;
  const band = BANDS.find((x) => imbalance < x.max);
  const bene = band.key === "even" ? null
    : gap > 0 ? res.ctxA.team : gap < 0 ? res.ctxB.team : null;
  const both = tot.a > 0.5 && tot.b > 0.5;
  const neither = tot.a <= 0.5 && tot.b <= 0.5;
  return {
    key: band.key, label: band.key === "even" ? "Even" : band.label + " " + (bene ? bene.n : ""),
    plain: band.label, imbalance, gap, beneficiary: bene,
    desc: both ? "Both sides improve" : neither ? "Neither side gains" : "One-sided gain",
    descKey: both ? "both" : neither ? "none" : "one",
  };
}

/* --- §5 the balancing pass: add / remove / swap ---------------------------- */
function recommend(res) {
  const t = res.trade;
  const tot = totalsFor(res); const v = verdictFor(res, tot);
  if (v.key === "none" || v.imbalance < BALANCE_HELP_BAND) return [];
  const A = teamById(t.a); const B = teamById(t.b);
  const favoured = v.gap > 0 ? "a" : "b";
  const cands = [];
  const mk = (aOut, bOut) => ({ ...t, aOut, bOut, source: "manual", overlaps: null, staleGates: false });
  const score = (trade) => {
    const r = analyzeTrade(trade);
    if (!r.valid) return null;
    const tt = totalsFor(r); const vv = verdictFor(r, tt);
    return { imbalance: vv.imbalance, band: vv.plain, key: vv.key, totals: tt, gap: vv.gap };
  };
  const roster = (k) => (k === "a" ? A : B).roster;
  const sent = (k) => (k === "a" ? t.aOut : t.bOut);
  const other = favoured === "a" ? "b" : "a";

  /* Add: the favoured side sends one more. */
  for (const p of roster(favoured)) {
    if (sent(favoured).indexOf(p.id) >= 0) continue;
    const nt = favoured === "a" ? mk(t.aOut.concat(p.id), t.bOut) : mk(t.aOut, t.bOut.concat(p.id));
    cands.push({ kind: "add", side: favoured, player: p, trade: nt });
  }
  /* Remove: the disadvantaged side takes one of its own off the table. */
  for (const id of sent(other)) {
    if (sent(other).length <= 1) break;
    const keep = sent(other).filter((x) => x !== id);
    const nt = other === "a" ? mk(keep, t.bOut) : mk(t.aOut, keep);
    cands.push({ kind: "remove", side: other, player: playerById(id), trade: nt });
  }
  /* Swap: substitute one already in the deal for a different body. Not
     restricted to the same position — forcing that would hide a cross-position
     swap that lands closer to even. */
  for (const k of ["a", "b"]) {
    for (const id of sent(k)) {
      for (const p of roster(k)) {
        if (sent(k).indexOf(p.id) >= 0) continue;
        const next = sent(k).map((x) => (x === id ? p.id : x));
        const nt = k === "a" ? mk(next, t.bOut) : mk(t.aOut, next);
        cands.push({ kind: "swap", side: k, player: p, replaces: playerById(id), trade: nt });
      }
    }
  }
  const scored = [];
  for (const c of cands) {
    const s = score(c.trade);
    if (!s) continue;
    if (Math.sign(s.gap) !== 0 && Math.sign(s.gap) !== Math.sign(v.gap) && s.imbalance > v.imbalance) continue;
    if (s.imbalance >= v.imbalance) continue;
    scored.push({ ...c, ...s });
  }
  scored.sort((x, y) => x.imbalance - y.imbalance);
  const seen = new Set(); const out = [];
  for (const s of scored) {
    const key = s.kind + ":" + (s.player ? s.player.id : "") + ":" + (s.replaces ? s.replaces.id : "");
    if (seen.has(key)) continue; seen.add(key); out.push(s);
    if (out.length >= BALANCE_SUGGESTIONS) break;
  }
  return out;
}

/* =========================================================================
   PENDING OFFERS
   ========================================================================= */

/**
 * Which offers share a player with which.
 *
 * Accepting one proposal can invalidate another, and a member looking at a
 * single card has no way to see that. The digest cannot work it out — it is a
 * property of the set, not of any one offer.
 */
function crossReference(list) {
  for (const t of list) {
    const mine = new Set(t.aOut.concat(t.bOut));
    t.overlaps = list.filter((o) => o.id !== t.id
      && o.aOut.concat(o.bOut).some((p) => mine.has(p))).map((o) => o.id);
  }
  return list;
}

  let sessionWeightsRef = sessionWeights;
  return {
    DATA,
    ROWS, GROUPS, BANDS, ROSTER_CAP, SLOTS, WEEKS_LEFT,
    teamById, playerById, ownerOf, posClass, vp, sgn, numCls,
    countdown, fmtWhen, setZone,
    optimalLineup, applyTrade, overLimits, chooseDrops,
    analyzeTrade, totalsFor, verdictFor, recommend, crossReference,
    appliedWeight, baseWeight,
    adminDiffers: ADMIN_DIFFERS,
    oddsSource: ODDS.source,
    oddsCoherent: ODDS.coherent,
    get weightSource() { return weightSource; },
    setWeights(source, session) {
      weightSource = source === "admin" ? "admin" : "developer";
      sessionWeights = session || {};
      sessionWeightsRef = sessionWeights;
    },
    get sessionWeights() { return sessionWeightsRef; },
  };
}

/**
 * The digest, in the shape the evaluator was written against.
 *
 * Kept as a seam rather than renaming fields through six hundred lines of
 * scoring: the payload is free to change its field names without any of the
 * arithmetic below caring.
 */
function adaptDigest(d) {
  const teams = (d.teams || []).map((t) => ({
    id: t.id, n: t.name, ab: t.abbrev, ow: t.owners || [], logo: t.logo,
    wr: t.waiverRank || 1, pp: t.playoffPct, roster: t.roster || [],
  }));
  const sp = d.scoringPeriodId || 1;
  const finalSP = d.finalScoringPeriod || 17;
  return {
    league: {
      name: d.leagueName || '', season: d.season, sp, finalSP,
      playoffTeams: d.playoffTeams || Math.max(1, Math.round((teams.length || 10) * 0.4)),
      size: teams.length || 1,
      deadline: d.tradeDeadline || null,
      rosterCap: d.rosterCap,
      slots: d.slots || [],
    },
    teams,
    pending: (d.pending || []).map((t) => ({
      ...t, source: 'pending', overlaps: [], staleGates: false,
    })),
    asOf: d.generatedAt,
  };
}
