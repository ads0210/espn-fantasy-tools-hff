/**
 * The Trade Analyzer's model constants, in a plain module of their own.
 *
 * Imported by the engine and by Site Backend's Trade Analyzer tab, so what the
 * backend reports is the engine's own value rather than a copy of it.
 */

/* The evaluator's own version, reported in Details. Bumped when the row set,
   the attribution order or a default weight changes — a saved analysis link is
   only reproducible against the engine that produced it. */
export const ENGINE_VERSION = "ta-1";

/* --- model constants (from §13 of the plan) ------------------------------ */
export const MIN_GAP = 4.0;
export const MIN_SCALE = 10.0;
export const BALANCE_HELP_BAND = 0.25;
export const BALANCE_SUGGESTIONS = 3;
export const OFFER_SOON_HOURS = 6;
export const BENCH_DISCOUNT = 0.30;
export const LOPSIDED_RATIO = 2.5;

/* Value-point conversions for this sample. One value point is roughly one
   projected fantasy point per remaining week. */
export const ODDS_VP = 55;
export const TITLE_VP = 90;
export const PLACE_VP = 26;

export const INJ_RATE = { QB: 0.07, RB: 0.14, WR: 0.09, TE: 0.09, K: 0.02, "D/ST": 0.02 };
export const SIGMA_POS = { QB: 6, RB: 7, WR: 8, TE: 6, K: 4, "D/ST": 6 };
export const PLAY_PROB = { ACTIVE: 1, NORMAL: 1, QUESTIONABLE: 0.75, DOUBTFUL: 0.35, OUT: 0, INJURY_RESERVE: 0 };
export const REPLACEMENT = { QB: 205, RB: 95, WR: 100, TE: 85, K: 132, "D/ST": 98 };

export const BANDS = [
  { max: 0.10, key: "even", label: "Even" },
  { max: 0.25, key: "slight", label: "Slightly leans" },
  { max: 0.45, key: "leans", label: "Leans" },
  { max: 0.75, key: "favors", label: "Favors" },
  { max: Infinity, key: "heavy", label: "Heavily favors" },
];
