/* ============================================================================
   Trade Analyzer — evaluation engine.

   A pure module: the trade digest in, a per-row, per-side vector of
   contributions at weight 1.00 out (the client does SUM(w_i * points_i)), as
   trade-algorithm-plan.md sets out. Sequential attribution over the canonical
   row order, the monotone playoff-odds fit over ESPN's own cross-section,
   forced-drop selection, the verdict bands and guards and the add/remove/swap
   balancing neighbourhood are the plan's; the 28 row formulas below are the
   real ones (C1), each written beside the row it serves.

   One value point is one projected fantasy point per remaining week. Every
   row answers in that unit, so a weight means the same thing on every row.

   What the rows read, all from the digest: ESPN's updated projection for each
   player (a rate a game, and the games ESPN expects), every week he has
   played, last season, his team's bye and depth chart, the market's view, the
   league's free agents, each team's record and points, ESPN's playoff odds and
   the games still to play. A row whose data has not been pulled answers
   "not enough data yet" rather than guessing.
   ========================================================================= */


import { TRADE_ROWS, TRADE_GROUPS } from "../../src/traderows.js";
import { ENGINE_VERSION, MIN_GAP, MIN_SCALE, BALANCE_HELP_BAND, BALANCE_SUGGESTIONS, OFFER_SOON_HOURS,
  BENCH_DISCOUNT, LOPSIDED_RATIO, ODDS_VP, TITLE_VP, PLACE_VP, INJ_RATE, SIGMA_POS, REPLACEMENT, BANDS,
  FLOOR_FRAC, FORM_HALFLIFE, FORM_MIN_GAMES, PRIOR_DECAY_WEEK, OMEGA, PLACEMENT_CURVE, TEAM_WEEK_SD, STREAM_FACTOR,
  TD_NORM, DESIGNATION_GAMES, ROLE_RISK } from "./constants.js";

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


/* --- model constants (from §13 of the plan) ------------------------------ */

/* Value-point conversions for this sample. One value point is roughly one
   projected fantasy point per remaining week. */

/* The starting lineup, read from the league's own settings rather than assumed.
   FLEX resolves last against whatever the dedicated slots did not take, which
   is what makes the greedy fill below exact for this slot structure. */
const FLEX_ELIGIBLE = { RB: ["RB"], WR: ["WR"], TE: ["TE"], QB: ["QB"], K: ["K"],
  "D/ST": ["D/ST"], FLEX: ["RB", "WR", "TE"], "OP": ["QB", "RB", "WR", "TE"] };
const BENCH_SLOT_NAMES = new Set(["BE", "IR", "Bench"]);
const SLOTS = (DATA.league.slots || [])
  .filter((s) => !BENCH_SLOT_NAMES.has(s.name))
  .map((s) => [s.name, FLEX_ELIGIBLE[s.name] || [s.name]])
  .sort((a, b) => a[1].length - b[1].length);

const ROSTER_CAP = DATA.league.rosterCap || 16;
/* Position limits are the league's own where it sets any. Where it sets none,
   the ceiling is what the league is already carrying plus headroom: high
   enough never to block a trade ESPN would accept, low enough to catch a deal
   that stacks a position absurdly. A gate, never a penalty. */
const POS_LIMIT = (() => {
  const stated = DATA.league.positionLimits || {};
  if (Object.keys(stated).length) return stated;
  const max = {};
  for (const t of DATA.teams) {
    const c = {};
    for (const p of t.roster) c[p.pos] = (c[p.pos] || 0) + 1;
    for (const k of Object.keys(c)) max[k] = Math.max(max[k] || 0, c[k]);
  }
  for (const k of Object.keys(max)) max[k] += 2;
  return max;
})();

/* The horizon: every scoring period from this one to the league's last. */
const WEEK = DATA.league.sp;
const FINAL = Math.max(DATA.league.finalSP, WEEK);
const REG = Math.min(DATA.league.regular || FINAL, FINAL);
const WEEKS = []; for (let w = WEEK; w <= FINAL; w++) WEEKS.push(w);
const WEEKS_LEFT = WEEKS.length;
const REG_LEFT = WEEKS.filter((w) => w <= REG).length;
const ROUND_LEN = Math.max(1, DATA.league.roundLength || 1);
/* A week's weight: 1 in the regular season, more in each playoff round. */
const omega = (w) => {
  if (w <= REG) return OMEGA.regular;
  const round = Math.ceil((w - REG) / ROUND_LEN);
  return OMEGA.rounds[Math.min(round, OMEGA.rounds.length) - 1];
};

/* What is freely available at each position, as a rate a game, best first:
   the league's own free agents where the digest carries them, otherwise a
   season-scale constant. A slot a trade leaves empty is filled from here, not
   left at zero: trading away your only kicker costs the difference against a
   streamer, not that kicker's whole projection. */
const FA = (() => {
  const out = {};
  for (const pos of Object.keys(REPLACEMENT)) {
    const list = (DATA.freeAgents && DATA.freeAgents[pos]) || [];
    out[pos] = list.length ? list.slice() : [REPLACEMENT[pos] / 17];
  }
  return out;
})();
const faBest = (pos) => (FA[pos] ? FA[pos][0] : 0);
/* Replacement is per team (R16): waiver order decides who reaches the best free
   agent, so a team late in the order refills from further down the list. */
const faFor = (team, pos) => {
  const list = FA[pos] || [0];
  const size = Math.max(2, DATA.league.size);
  const k = Math.round(((Math.max(1, team.wr || 1) - 1) / (size - 1)) * 4);
  return list[Math.min(list.length - 1, k)];
};
const slotFloor = (elig, fn) => Math.max.apply(null, elig.map(fn).concat([0]));

/* --- the 28 rows, in canonical attribution order (§7) --------------------
   The order is part of the specification: reordering silently changes what
   every default weight means. */
const ROWS = TRADE_ROWS;
const FORM_ROWS = new Set(["R3", "R5", "R6", "R7", "R10"]);
const GROUPS = TRADE_GROUPS;


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
/* --- the projection spine (plan §2.2) --------------------------------------
   ESPN's updated projection is a rate a game; the rest of the season is that
   rate over the games his team still plays inside the horizon. Where ESPN
   gives no updated projection, the season projection less what he has already
   scored, floored so a hot start does not project to nothing. */
function gamesLeft(p) {
  if (!p || p.tm === "FA") return 0;
  return p.bye != null && p.bye >= WEEK && p.bye <= FINAL ? WEEKS_LEFT - 1 : WEEKS_LEFT;
}
function rate(p) {
  if (!p) return 0;
  if (p.rt != null) return p.rt;
  const g = gamesLeft(p); if (!g) return 0;
  const perGame = (p.pr || 0) / 17;
  return Math.max((p.pr || 0) - (p.ac || 0), perGame * g * FLOOR_FRAC) / g;
}
function ros(p) { return rate(p) * gamesLeft(p); }
const weekRate = (w) => (p) => (p.bye === w || p.tm === "FA" ? 0 : rate(p));

/* Exact for a slot structure whose shared slots (FLEX, a superflex) are
   resolved after the dedicated ones against whatever those did not take. */
/* Values are points a week: each player's rate by default (a week with nobody
   on a bye), or one named week's rates. */
function optimalLineup(roster, val, floorFn) {
  const v = val || rate;
  const fl = floorFn || faBest;
  const pool = roster.slice().sort((a, b) => v(b) - v(a));
  const used = new Set(); const starters = []; const unfilled = []; const slotVals = [];
  let total = 0;
  for (const [name, elig] of SLOTS) {
    const pick = pool.find((p) => !used.has(p.id) && elig.indexOf(p.pos) >= 0);
    const floor = slotFloor(elig, fl);
    if (pick && v(pick) >= floor) { used.add(pick.id); starters.push(pick); total += v(pick); slotVals.push(v(pick)); }
    else {
      // Nobody for the slot, or nobody better than a free agent (a bye week, say): filled from the waiver wire.
      if (!pick) unfilled.push(name);
      total += floor; slotVals.push(floor);
    }
  }
  const bench = roster.filter((p) => !used.has(p.id));
  return { starters, bench, total, legal: unfilled.length === 0, unfilled, ids: used, slotVals };
}

/* A roster's season, week by week: the best lineup each week with players on a
   bye out of it. Cached, because the balancing pass asks about the same roster
   a hundred times. */
const WEEKLY = new Map();
function weekly(roster) {
  const key = roster.map((p) => p.id).sort().join(",");
  const hit = WEEKLY.get(key); if (hit) return hit;
  const byWeek = []; const starts = {}; let total = 0; let playoff = 0;
  for (const w of WEEKS) {
    const l = optimalLineup(roster, weekRate(w));
    byWeek.push(l.total); total += l.total;
    if (w > REG) playoff += (omega(w) - 1) * l.total;
    for (const p of l.starters) starts[p.id] = (starts[p.id] || 0) + 1;
  }
  const out = { byWeek, total, playoff, starts };
  if (WEEKLY.size > 400) WEEKLY.clear();
  WEEKLY.set(key, out);
  return out;
}
/* How much of a player's value a roster actually uses: a starter counts whole,
   a bench player at the bench discount, in proportion to the weeks he starts. */
function useOf(p, roster) {
  const g = gamesLeft(p); if (!g) return BENCH_DISCOUNT;
  const share = Math.min(1, (weekly(roster).starts[p.id] || 0) / g);
  return BENCH_DISCOUNT + (1 - BENCH_DISCOUNT) * share;
}

/* --- what a player has done, from his weeks ---------------------------------- */
const playedPts = (p) => (p.wk || []).filter((r) => r[2]).map((r) => r[1]);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
/* Recent form (R3): a half-life-weighted average of his games against the rate
   he is projected at, shrunk toward nothing while the sample is small. */
function formOf(p) {
  const g = playedPts(p); if (g.length < FORM_MIN_GAMES) return null;
  let num = 0; let den = 0;
  g.forEach((x, i) => { const w = Math.pow(0.5, (g.length - 1 - i) / FORM_HALFLIFE); num += w * x; den += w; });
  return (num / den - rate(p)) * (g.length / (g.length + 3));
}
/* Week-to-week spread, split into the part below his own average (R5) and the
   part above it (R6). This season's games count whole, last season's half, and
   the position's usual spread stands in until there are games to go on. */
function spreadOf(p) {
  const now = playedPts(p); const last = p.lw || [];
  const xs = now.map((x) => [x, 1]).concat(last.map((x) => [x, 0.5]));
  const sp = (SIGMA_POS[p.pos] || 6); const prior = (sp * sp) / 2; const k = 4;
  let wsum = 0; let m = 0;
  for (const [x, w] of xs) { m += x * w; wsum += w; }
  m = wsum ? m / wsum : 0;
  let dn = 0; let up = 0;
  for (const [x, w] of xs) { const d = x - m; if (d < 0) dn += w * d * d; else up += w * d * d; }
  // Scaled to today's rate, so a player whose role has grown carries a spread to match.
  const scale = m > 1 && xs.length >= 3 ? Math.max(0.5, Math.min(2, rate(p) / m)) : 1;
  return {
    down: Math.sqrt((dn + k * prior) / (wsum + k)) * scale,
    up: Math.sqrt((up + k * prior) / (wsum + k)) * scale,
    n: now.length,
  };
}
/* A point of week-to-week spread is priced at half a point of production. */
const SPREAD_PRICE = 0.5;
const variance = (p) => { const s = spreadOf(p); return s.down * s.down + s.up * s.up; };
/* Opportunity quality (R7): points that came from touchdowns beyond the
   position's usual share are luck that tends not to hold, and half of it is
   taken back; a workload trending up or down moves the rate a quarter as far. */
function qualityOf(p) {
  const norm = TD_NORM[p.pos]; const gp = p.gp || 0;
  if (norm == null || gp < FORM_MIN_GAMES || !p.td || !(p.ac > 0)) return null;
  const tdPts = 4 * p.td[0] + 6 * p.td[1];
  const luck = (tdPts / p.ac - norm) * (p.ac / gp);
  const opp = (p.wk || []).filter((r) => r[2]).map((r) => r[3]);
  const base = mean(opp); const recent = mean(opp.slice(-2));
  const trend = base >= 1 ? Math.max(-0.5, Math.min(0.5, (recent - base) / base)) * rate(p) * 0.25 : 0;
  return -0.5 * luck + trend;
}
/* Games a player is expected to miss inside the horizon (R9): what his
   designation costs, or what ESPN's own projection already allows for,
   whichever is more, plus the position's base rate. */
function missOf(p) {
  const g = gamesLeft(p); if (!g) return 0;
  const tag = DESIGNATION_GAMES[p.inj] || 0;
  const espn = p.eg != null && p.gp != null ? Math.max(0, g - Math.max(0, p.eg - p.gp)) : 0;
  return Math.min(g, Math.max(tag, espn) + (INJ_RATE[p.pos] || 0.05) * g);
}
/* Durability (R10): games missed last season and this one against the
   position's base rate, a quarter believed: most of a bad year does not repeat. */
function durabilityOf(p) {
  const weeks = p.wk || [];
  const thisMiss = weeks.filter((r) => !r[2]).length;
  const hasLast = p.lyg != null && p.lyg > 0;
  const span = weeks.length + (hasLast ? 17 : 0);
  if (span < FORM_MIN_GAMES) return null;
  const missed = thisMiss + (hasLast ? Math.max(0, 17 - p.lyg) : 0);
  const excess = Math.max(-0.1, Math.min(0.4, missed / span - (INJ_RATE[p.pos] || 0.05)));
  return excess * gamesLeft(p) * rate(p) * 0.25;
}
/* Role security (R12): the share of his rate at risk, by where his team's
   depth chart lists him. */
function roleRiskOf(p) {
  if (p.pos === "D/ST") return 0;
  const dc = p.dc;
  if (!dc) return p.pos === "K" ? 0 : ROLE_RISK.unlisted;
  if (dc.d <= 1) return dc.s === "wr3" ? ROLE_RISK.third : ROLE_RISK.starter;
  return dc.d === 2 ? ROLE_RISK.second : ROLE_RISK.deep;
}
/* Market value (R25): how the wider game rates him, from 0 to 1: rostered,
   started, and where he was drafted. */
function marketOf(p) {
  const own = (p.ow || 0) / 100; const st = (p.st != null ? p.st : p.ow || 0) / 100;
  const draft = p.adp != null && p.adp > 0 ? 1 - Math.min(p.adp, 170) / 170 : own;
  return 0.5 * own + 0.3 * st + 0.2 * draft;
}

/* The normal curve, for the title and placement models. */
function phi(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const q = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - q : q;
}
const pdf = (z) => 0.3989423 * Math.exp(-z * z / 2);
function probit(p) {
  // Bisection is plenty: this is read a handful of times per trade.
  let lo = -6; let hi = 6;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (phi(m) < p) lo = m; else hi = m; }
  return (lo + hi) / 2;
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
    const cands = cur.filter((p) => p.sl !== "IR").sort((a, b) => ros(a) - ros(b));
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

/* A player arriving in a trade lands on the bench, whatever slot he left. */
function applyTrade(roster, outIds, incoming) {
  const kept = roster.filter((p) => outIds.indexOf(p.id) < 0);
  return kept.concat(incoming.map((p) => (p.sl === "IR" ? { ...p, sl: "BE" } : p)));
}
/* The cap counts everyone but the players held in an injured-reserve slot. */
const capCount = (roster) => roster.filter((p) => p.sl !== "IR").length;

/* =========================================================================
   §11 — PLAYOFF ODDS. ESPN publishes the level; we fit the curve across the
   league's own ten (strength, playoffPct) pairs and read the slope.
   ========================================================================= */
const strengthOf = (roster) => weekly(roster).total / WEEKS_LEFT;
const ODDS = (function fitOdds() {
  const pts = DATA.teams.map((t) => ({
    id: t.id, S: strengthOf(t.roster), P: t.eliminated ? 0 : (t.pp == null ? 0 : t.pp),
  }));
  const sum = pts.reduce((s, p) => s + p.P, 0);
  const tol = 0.15 * DATA.league.playoffTeams;
  /* §11.5: expected qualifiers equals the sum of the individual chances. Outside
     the tolerance ESPN's figures are not being read as probabilities, and the
     odds rows fall back to the analytic estimate alone. */
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
  const residual = Math.sqrt(best.sse / Math.max(1, pts.length));
  const spread = Math.sqrt(pts.reduce((s, p) => s + Math.pow(p.P - sum / Math.max(1, pts.length), 2), 0) / Math.max(1, pts.length));
  /* §11.3: how far to trust the fit follows how well ESPN's odds separate the
     teams. Early on they cluster and the analytic estimate carries the row. */
  const blend = coherent ? Math.max(0, Math.min(0.9, spread * 3.4)) : 0;
  /* The analytic estimate: a team's average over the weeks left moves by about
     one team-week's spread over the root of those weeks, widened for the gaps
     already on the board. */
  const tau = (TEAM_WEEK_SD / Math.sqrt(Math.max(1, REG_LEFT))) * 1.6;
  const of = (id) => pts.find((p) => p.id === id) || { S: 0, P: 0 };
  const fitP = (S) => 1 / (1 + Math.exp(-best.k * (S - best.S0)));
  return {
    k: best.k, S0: best.S0, sum: sum, coherent: coherent, residual: residual,
    blend: blend, source: coherent ? "espn" : "modelled", tau: tau,
    S: (id) => of(id).S,
    P: (id) => of(id).P,
    /* dP/dS at a team's position: the fitted slope and the analytic one, blended. Never negative. */
    slope: (S, P) => {
      const f = fitP(S); const fitted = best.k * f * (1 - f);
      const q = Math.max(0.02, Math.min(0.98, P));
      const analytic = pdf(probit(q)) / tau;
      /* Ten points can fit a near-step, whose slope would turn one point a week into a
         season: the fitted slope is never read as more than twice the analytic one. */
      return blend * Math.min(fitted, 2 * analytic) + (1 - blend) * analytic;
    },
    /* The curve's bend at a team's position: positive below the middle, where spread helps, negative above it. */
    curve: (S) => { const f = fitP(S); return best.k * best.k * f * (1 - f) * (1 - 2 * f); },
    pts: pts,
  };
})();

/* Each player's rest-of-season projection, the figure R1 nets: shown beside his name on every roster. */
for (const t of DATA.teams) for (const p of t.roster) p.rosPts = Math.round(ros(p) * 10) / 10;

/* The league's average starter at each lineup slot, as a rate a game: what a
   "hole" is measured against (R13). */
const SLOT_AVG = (() => {
  const sums = SLOTS.map(() => 0);
  for (const t of DATA.teams) optimalLineup(t.roster).slotVals.forEach((v, i) => { sums[i] += v; });
  return sums.map((v) => v / Math.max(1, DATA.teams.length));
})();
function holesOf(roster) {
  return optimalLineup(roster).slotVals.reduce((s, v, i) => s + Math.max(0, SLOT_AVG[i] - v), 0);
}
/* Bench value above what the waiver wire offers (R14, R15). */
const aboveWire = (p) => Math.max(0, rate(p) - faBest(p.pos)) * gamesLeft(p);
function benchValue(roster) {
  return optimalLineup(roster).bench.reduce((s, p) => s + aboveWire(p), 0);
}
/* The value of each final finish, on the league's own size. */
function placeValue(rank) {
  const n = Math.max(2, DATA.league.size);
  const x = Math.max(0, Math.min(PLACEMENT_CURVE.length - 1, ((rank - 1) * (PLACEMENT_CURVE.length - 1)) / (n - 1)));
  const i = Math.floor(x); const f = x - i;
  return PLACEMENT_CURVE[i] + (PLACEMENT_CURVE[Math.min(PLACEMENT_CURVE.length - 1, i + 1)] - PLACEMENT_CURVE[i]) * f;
}
/* Expected final place in the regular-season order (R21). Where the league
   seeds on points, each team's points so far plus its strength over the weeks
   left; otherwise its wins so far plus its chance in each game left. Every
   pair is compared on the normal curve. `shift` is a change in strength, by
   team id, so both sides of a trade move at once. */
const POINTS_SEEDED = /POINTS_SCORED/.test(String(DATA.league.seedingRule || ""));
function expectedRank(teamId, shift) {
  const sh = shift || {};
  const S = (id) => ODDS.S(id) + (sh[id] || 0);
  const score = (t) => {
    if (POINTS_SEEDED) return (t.pf || 0) + S(t.id) * REG_LEFT;
    let wins = (t.w || 0) + (t.t || 0) / 2;
    for (const g of DATA.league.games) {
      if (g[1] !== t.id && g[2] !== t.id) continue;
      const opp = g[1] === t.id ? g[2] : g[1];
      wins += phi((S(t.id) - S(opp)) / (TEAM_WEEK_SD * Math.SQRT2));
    }
    return wins;
  };
  const sd = POINTS_SEEDED ? TEAM_WEEK_SD * Math.sqrt(Math.max(1, REG_LEFT)) : Math.sqrt(Math.max(1, REG_LEFT)) / 2;
  const me = DATA.teams.find((t) => t.id === teamId); if (!me) return DATA.league.size;
  const mine = score(me);
  let rank = 1;
  for (const t of DATA.teams) if (t.id !== teamId) rank += phi((score(t) - mine) / (sd * Math.SQRT2));
  return rank;
}
/* The chance of winning the title from inside the bracket (R20): each round is
   a total over the round's weeks against a typical bracket team. */
const ROUNDS = Math.max(1, Math.ceil(Math.log2(Math.max(2, DATA.league.playoffTeams))));
function bracketRun(teamId, S) {
  let wsum = 0; let opp = 0;
  for (const p of ODDS.pts) if (p.id !== teamId) { const w = Math.max(0.02, p.P); wsum += w; opp += w * p.S; }
  const field = wsum ? opp / wsum : S;
  const one = phi(((S - field) * ROUND_LEN) / (TEAM_WEEK_SD * Math.sqrt(2 * ROUND_LEN)));
  return Math.pow(one, ROUNDS);
}

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
  const dropsA = chooseDrops(afterA, Math.max(0, capCount(afterA) - ROSTER_CAP));
  const dropsB = chooseDrops(afterB, Math.max(0, capCount(afterB) - ROSTER_CAP));
  const finalA = afterA.filter((p) => dropsA.indexOf(p) < 0);
  const finalB = afterB.filter((p) => dropsB.indexOf(p) < 0);
  add("G4", capCount(finalA) <= ROSTER_CAP && capCount(finalB) <= ROSTER_CAP, "Both rosters must fit the " + ROSTER_CAP + "-man cap");
  /* Non-blocking on purpose. ESPN accepted the live 3-for-3 in this league
     even though it leaves one side with no kicker, so a blocking gate here
     would mark a real, standing offer as impossible. It is surfaced as a
     flag and priced through replacement level instead. */
  add("G5", optimalLineup(finalA).legal && optimalLineup(finalB).legal,
    "A starting slot would be left unfilled", false);
  add("G6", overLimits(finalA).length === 0 && overLimits(finalB).length === 0, "Position limits must be respected");
  add("G7", dropsA.length + dropsB.length === 0 || (capCount(finalA) <= ROSTER_CAP && capCount(finalB) <= ROSTER_CAP),
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
    const wb = weekly(before); const wa = weekly(final);
    /* The change in what the side puts on the field each week: the strength the odds rows move on. */
    const dS = (wa.total - wb.total) / WEEKS_LEFT;
    return { team, before, outs, incoming, after, final, drops, lb, la, rosIn, rosOut, other, wb, wa, dS };
  };
  const ctxA = sideCtx(A, trade.aOut, pre.inA, pre.afterA, pre.finalA, pre.dropsA, B);
  const ctxB = sideCtx(B, trade.bOut, pre.inB, pre.afterB, pre.finalB, pre.dropsB, A);
  ctxA.otherCtx = ctxB; ctxB.otherCtx = ctxA;
  const shift = { [A.id]: ctxA.dS, [B.id]: ctxB.dS };

  /* A per-player measure, netted across the deal: what comes in, used the way
     the roster after the trade would use it, less what goes out, used the way
     the roster before it did. In points a remaining week. */
  const net = (c, fn) => {
    let v = 0; let seen = 0;
    for (const p of c.incoming) { const x = fn(p); if (x != null) { seen++; v += x * useOf(p, c.final); } }
    for (const p of c.outs) { const x = fn(p); if (x != null) { seen++; v -= x * useOf(p, c.before); } }
    return seen ? v : null;
  };
  const perWeek = (p) => gamesLeft(p) / WEEKS_LEFT;
  const none = { v: 0, raw: null };
  const num = (n, d) => sgn(n) + Math.abs(n).toFixed(d == null ? 1 : d);
  const p1 = (x) => (Math.round(x * 1000 + 1e-6) / 10).toFixed(1) + "%";

  const rowFns = {
    /* Sequential attribution over the canonical order: each row's points are
       the change that effect caused at its own step, so the rows sum to the
       total by construction. */

    /* R1. Net rest-of-season points moving each way, slots ignored. */
    R1: (c) => ({ v: (c.rosIn - c.rosOut) / WEEKS_LEFT,
      raw: num(c.rosIn - c.rosOut, 0) + " proj pts" }),
    /* R2. What the best legal lineup actually gains, beyond R1: three startable
       players into two open slots gain less than their projections add up to. */
    R2: (c, memo) => {
      const total = c.la.total - c.lb.total;
      return { v: total - memo.R1, raw: num(total) + " pts/wk lineup" };
    },
    /* R3. Recent form against the projected rate. */
    R3: (c) => { const v = net(c, (p) => { const f = formOf(p); return f == null ? null : f * perWeek(p); });
      return v == null ? none : { v, raw: num(v) + " pts/wk on form" }; },
    /* R4. Last season's rate against this season's projected one, fading to nothing by week 6. */
    R4: (c) => {
      const decay = Math.max(0, Math.min(1, 1 - (WEEK - 1) / (PRIOR_DECAY_WEEK - 1)));
      if (!decay) return { v: 0, raw: "faded out by week " + PRIOR_DECAY_WEEK };
      const v = net(c, (p) => (p.lyg != null && p.lyg >= 6 && p.ly != null ? (p.ly / p.lyg - rate(p)) * perWeek(p) : null));
      return v == null ? none : { v: v * decay, raw: "last season at " + Math.round(decay * 100) + "%" };
    },
    /* R5. Week-to-week reliability: the spread below a player's own average counts against. */
    R5: (c) => { const v = net(c, (p) => (DATA.inputs.form ? -spreadOf(p).down * SPREAD_PRICE * perWeek(p) : null));
      return v == null ? none : { v, raw: v >= 0 ? "steadier weeks" : "shakier weeks" }; },
    /* R6. Top-end weeks: the spread above a player's own average counts for. */
    R6: (c) => { const v = net(c, (p) => (DATA.inputs.form ? spreadOf(p).up * SPREAD_PRICE * perWeek(p) : null));
      return v == null ? none : { v, raw: v >= 0 ? "more upside" : "less upside" }; },
    /* R7. Volume that repeats against touchdown luck that tends not to. */
    R7: (c) => { const v = net(c, (p) => { const q = qualityOf(p); return q == null ? null : q * perWeek(p); });
      return v == null ? none : { v, raw: "workload against touchdown luck" }; },
    /* R8. The lineup's change over the regular-season weeks left, where points scored decide seeding. */
    R8: (c) => {
      const share = REG_LEFT / WEEKS_LEFT;
      const v = c.dS * share * (POINTS_SEEDED ? 1 : 0.25);
      return { v, raw: POINTS_SEEDED ? num(c.dS * REG_LEFT, 0) + " pts toward seeding" : "points break ties only" };
    },

    /* R9. Points lost to the games each player is expected to miss. */
    R9: (c) => { const v = -net(c, (p) => (missOf(p) * rate(p)) / WEEKS_LEFT);
      const g = c.incoming.reduce((s, p) => s + missOf(p), 0) - c.outs.reduce((s, p) => s + missOf(p), 0);
      return { v, raw: num(g) + " games expected missed" }; },
    /* R10. Games missed last season and this one, against the position's base rate. */
    R10: (c) => { const v = net(c, (p) => { const d = durabilityOf(p); return d == null ? null : -d / WEEKS_LEFT; });
      return v == null ? none : { v, raw: "games missed, last season and this" }; },
    /* R11. The season solved week by week with players on a bye out of the lineup, beyond the bye-free week R2 solved. */
    R11: (c, memo) => { const v = c.dS - (memo.R1 + memo.R2);
      return { v, raw: Math.abs(v) < 0.05 ? "no new bye clash" : (v < 0 ? "bye weeks cost " : "bye weeks eased ") + Math.abs(v * WEEKS_LEFT).toFixed(0) + " pts" }; },
    /* R12. The share of each player's rate at risk by where his depth chart lists him. */
    R12: (c) => { if (!DATA.inputs.depth) return none;
      const v = -net(c, (p) => roleRiskOf(p) * rate(p) * perWeek(p));
      return { v, raw: "depth-chart standing" }; },

    /* R13. Slots sitting below the league's average starter, before and after: filling a hole is worth more than its points. */
    R13: (c) => { const d = holesOf(c.final) - holesOf(c.before);
      return { v: -d * 0.5, raw: Math.abs(d) < 0.05 ? "no hole opened or filled" : d < 0 ? "fills a weak slot" : "opens a weak slot" }; },
    /* R14. Bench quality above the waiver wire, at the bench discount, as if no cut were forced. */
    R14: (c) => { const v = ((benchValue(c.final.concat(c.drops)) - benchValue(c.before)) * BENCH_DISCOUNT) / WEEKS_LEFT;
      return { v, raw: "bench at " + Math.round(BENCH_DISCOUNT * 100) + "% of a starter" }; },
    /* R15. What the forced cuts were worth. */
    R15: (c) => { const lost = c.drops.reduce((s, p) => s + aboveWire(p), 0) * BENCH_DISCOUNT;
      return { v: -lost / WEEKS_LEFT, raw: c.drops.length ? c.drops.length + " forced cut" + (c.drops.length > 1 ? "s" : "") : "no cuts forced" }; },
    /* R16. Replacement is per team: an empty slot refills from this team's place in
       the waiver order, and a bench player is worth more where the wire offers less. */
    R16: (c) => {
      const gap = (pos) => faBest(pos) - faFor(c.team, pos);
      const slotGap = (l) => l.unfilled.reduce((s, name) => { const sl = SLOTS.find((x) => x[0] === name);
        return s + (sl ? slotFloor(sl[1], (pos) => faFor(c.team, pos)) - slotFloor(sl[1], faBest) : 0); }, 0);
      const benchGap = (r) => optimalLineup(r).bench.reduce((s, p) => s + gap(p.pos) * perWeek(p), 0) * BENCH_DISCOUNT;
      const v = (slotGap(c.la) - slotGap(c.lb)) + (benchGap(c.final) - benchGap(c.before));
      return { v, raw: "waiver rank " + c.team.wr + " of " + DATA.league.size }; },
    /* R17. Bench players a shared slot can take, and positions pushed to their limit. */
    R17: (c) => {
      const shared = SLOTS.filter((x) => x[1].length > 1).reduce((set, x) => { x[1].forEach((q) => set.add(q)); return set; }, new Set());
      const fx = (r) => Math.min(3, optimalLineup(r).bench.filter((p) => shared.has(p.pos) && rate(p) > faFor(c.team, p.pos)).length);
      const capped = (r) => { const n = posCounts(r); return Object.keys(POS_LIMIT).filter((k) => (n[k] || 0) >= POS_LIMIT[k]).length; };
      const v = (fx(c.final) - fx(c.before)) * 0.4 - (capped(c.final) - capped(c.before)) * 0.3;
      return { v, raw: "bench cover and position limits" }; },
    /* R18. A kicker or defence is replaceable week to week, so most of a swing in those slots is taken back. */
    R18: (c) => {
      const kd = (l) => SLOTS.reduce((s, x, i) => s + (x[0] === "K" || x[0] === "D/ST" ? l.slotVals[i] : 0), 0);
      const swing = kd(c.la) - kd(c.lb);
      return { v: -swing * STREAM_FACTOR, raw: Math.abs(swing) < 0.05 ? "no kicker or defence swing" : "K and D/ST are streamable" }; },

    /* R19. ESPN gives the level; the change is read off the curve at this team's position (§11). */
    R19: (c, memo) => {
      const S = ODDS.S(c.team.id); const P = ODDS.P(c.team.id);
      const dead = Boolean(c.team.eliminated);
      const after = dead ? 0 : Math.max(0, Math.min(1, P + ODDS.slope(S, P) * c.dS));
      memo._p = { before: P, after, S };
      return { v: (after - P) * ODDS_VP, raw: p1(P) + " \u2192 " + p1(after) };
    },
    /* R20. Reaching the bracket, then winning each round on a total over the round's weeks. */
    R20: (c, memo) => { const p = memo._p;
      const before = p.before * bracketRun(c.team.id, p.S); const after = p.after * bracketRun(c.team.id, p.S + c.dS);
      return { v: (after - before) * TITLE_VP, raw: p1(before) + " \u2192 " + p1(after) + " title" }; },
    /* R21. Expected final place, both sides' strength moved at once, on the placement curve. */
    R21: (c) => { const before = expectedRank(c.team.id, null); const after = expectedRank(c.team.id, shift);
      return { v: (placeValue(after) - placeValue(before)) * PLACE_VP, raw: "place " + before.toFixed(1) + " \u2192 " + after.toFixed(1) }; },
    /* R22. The playoff weeks' extra weight on the lineup's change in those weeks, as far as the bracket is in reach. */
    R22: (c, memo) => { if (WEEKS.every((w) => w <= REG)) return { v: 0, raw: "no playoff weeks left" };
      const reach = c.team.eliminated ? 0.25 : Math.max(0.25, memo._p.after);
      const v = ((c.wa.playoff - c.wb.playoff) / WEEKS_LEFT) * reach;
      return { v, raw: "weeks " + (REG + 1) + "\u2013" + FINAL + ", weighted" }; },
    /* R23. Spread helps a team below the middle of the curve and hurts one above it:
       half the curve's bend times the change in the lineup's variance. */
    R23: (c, memo) => { if (!DATA.inputs.form || c.team.eliminated) return none;
      const lv = (l) => l.starters.reduce((s, p) => s + variance(p), 0) / Math.max(1, REG_LEFT);
      const v = 0.5 * ODDS.curve(memo._p.S) * (lv(c.la) - lv(c.lb)) * ODDS.blend * ODDS_VP;
      return { v, raw: ODDS.curve(memo._p.S) >= 0 ? "spread helps here" : "spread hurts here" }; },
    /* R24. Games still to play against the other side, whose lineup this trade changes. */
    R24: (c) => { const n = DATA.league.games.filter((g) => (g[1] === c.team.id && g[2] === c.other.id) || (g[2] === c.team.id && g[1] === c.other.id)).length;
      const v = -n * c.otherCtx.dS * 0.10 * (POINTS_SEEDED ? 0.3 : 1);
      return { v, raw: n ? n + " game" + (n > 1 ? "s" : "") + " left against them" : "no games left against them" }; },

    /* R25. How the wider game rates what moves: rostered, started, drafted. */
    R25: (c) => { const d = c.incoming.reduce((s, p) => s + marketOf(p), 0) - c.outs.reduce((s, p) => s + marketOf(p), 0);
      return { v: d * 2.2, raw: num(d * 100, 0) + " market share" }; },
    /* R26. Consolidation: the side that ends up with the best single player in the deal. */
    R26: (c) => { const top = (a) => (a.length ? Math.max.apply(null, a.map(rate)) : 0);
      const d = Math.max(-2, Math.min(2, (top(c.incoming) - top(c.outs)) * 0.25));
      return { v: d, raw: d > 0.05 ? "gets the best player in the deal" : d < -0.05 ? "gives up the best player in the deal" : "even shape" }; },
    R27: null, R28: null,
  };

  const memoA = {}; const memoB = {};
  const rows = ROWS.map((spec) => {
    /* Visible and inert (§16): too early in the season, or the data the row reads has not been pulled. */
    const lacks = (FORM_ROWS.has(spec.id) && !DATA.inputs.form) || (spec.id === "R12" && !DATA.inputs.depth);
    const inert = (spec.needs != null && week < spec.needs) || lacks;
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
  if (!DATA.inputs.form || !DATA.inputs.depth) flags.push({ side: "both", id: "F13", label: "Waiting on data",
    note: "Some rows read each player's weeks so far or his team's depth chart, and that data has not been pulled yet. They are listed and inert rather than guessed." });
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
    optimalLineup, applyTrade, overLimits, chooseDrops, capCount,
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
    eliminated: Boolean(t.eliminated), w: t.w, l: t.l, t: t.t, pf: t.pf, top: t.top, clinch: t.clinch || null,
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
      regular: d.regularSeasonPeriods || null,
      roundLength: d.playoffRoundLength || 1,
      seedingRule: d.seedingRule || null,
      positionLimits: d.positionLimits || {},
      games: d.remainingGames || [],
    },
    freeAgents: d.freeAgents || {},
    inputs: { form: Boolean(d.inputs && d.inputs.form), depth: Boolean(d.inputs && d.inputs.depth) },
    teams,
    pending: (d.pending || []).map((t) => ({
      ...t, source: 'pending', overlaps: [], staleGates: false,
    })),
    asOf: d.generatedAt,
  };
}
