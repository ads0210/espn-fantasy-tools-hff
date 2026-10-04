/**
 * The Trade Analyzer's model constants, in a plain module of their own.
 *
 * Imported by the engine and by Site Backend's Trade Analyzer tab, so what the
 * backend reports is the engine's own value rather than a copy of it.
 */

/* The evaluator's own version, reported in Details. Bumped when the row set,
   the attribution order or a default weight changes — a saved analysis link is
   only reproducible against the engine that produced it. */
export const ENGINE_VERSION = "ta-2";

/* --- model constants (from §13 of the plan) ------------------------------ */
export const MIN_GAP = 4.0;
export const MIN_SCALE = 10.0;
export const BALANCE_HELP_BAND = 0.25;
export const BALANCE_SUGGESTIONS = 3;
export const OFFER_SOON_HOURS = 6;
export const BENCH_DISCOUNT = 0.30;
export const LOPSIDED_RATIO = 2.5;

/* Value-point conversions. One value point is roughly one projected fantasy
   point per remaining week. The three follow the plan's objective weights
   (title 1.00, bracket 0.60, placement 0.50) on one scale. */
export const TITLE_VP = 90;
export const ODDS_VP = 55;
export const PLACE_VP = 45;

/* The projection spine's floor when the season so far has outrun the projection. */
export const FLOOR_FRAC = 0.60;
/* Recent form: the half-life in games, and the games needed before it says anything. */
export const FORM_HALFLIFE = 3;
export const FORM_MIN_GAMES = 3;
/* The week last season's weight reaches zero. */
export const PRIOR_DECAY_WEEK = 6;
/* Week weights: a regular-season week, then each playoff round. */
export const OMEGA = { regular: 1.0, rounds: [2.5, 3.5] };
/* Final finish to value, first to tenth; scaled to the league's size. */
export const PLACEMENT_CURVE = [1.00, 0.86, 0.76, 0.69, 0.64, 0.60, 0.57, 0.54, 0.52, 0.50];
/* One team's week-to-week spread in points, for the title and placement models. */
export const TEAM_WEEK_SD = 22;
/* Kickers and defences: how hard the streamable part of a swing is suppressed.
   At the row's default weight (0.30) this removes about nine tenths of it. */
export const STREAM_FACTOR = 3.0;
/* The share of a position's points that normally comes from touchdowns. */
export const TD_NORM = { QB: 0.28, RB: 0.22, WR: 0.19, TE: 0.22 };
/* Games a designation is expected to cost, before the position's base rate. */
export const DESIGNATION_GAMES = { QUESTIONABLE: 0.25, DOUBTFUL: 0.65, OUT: 1.5, INJURY_RESERVE: 4, SUSPENSION: 2 };
/* The share of a player's rate at risk by where he stands on his team's depth chart. */
export const ROLE_RISK = { starter: 0, third: 0.03, second: 0.10, deep: 0.20, unlisted: 0.06 };

export const INJ_RATE = { QB: 0.07, RB: 0.14, WR: 0.09, TE: 0.09, K: 0.02, "D/ST": 0.02 };
export const SIGMA_POS = { QB: 6, RB: 7, WR: 8, TE: 6, K: 4, "D/ST": 6 };
export const PLAY_PROB = { ACTIVE: 1, NORMAL: 1, QUESTIONABLE: 0.75, DOUBTFUL: 0.35, OUT: 0, INJURY_RESERVE: 0 };
/* Season points freely available at each position: used only where the league's own free agents are not known. */
export const REPLACEMENT = { QB: 205, RB: 95, WR: 100, TE: 85, K: 132, "D/ST": 98 };

export const BANDS = [
  { max: 0.10, key: "even", label: "Even" },
  { max: 0.25, key: "slight", label: "Slightly leans" },
  { max: 0.45, key: "leans", label: "Leans" },
  { max: 0.75, key: "favors", label: "Favors" },
  { max: Infinity, key: "heavy", label: "Heavily favors" },
];
