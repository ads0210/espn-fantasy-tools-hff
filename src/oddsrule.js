/**
 * One rule for Clinched and Eliminated across the site (week 11, D1 and D7): a team is Eliminated only when its
 * playoff chance is exactly 0 (out on every remaining path) and Clinched only when it is exactly 1. Before r282 any
 * chance at or under 0.05% read as Eliminated, while Matchup Insights still told the same team "Must Win".
 *
 * A chance between 0 and 0.05%, or between 99.95% and 100%, would print as 0.0% or 100.0% under the one-decimal
 * percentage rule; it reads "<0.1%" or ">99.9%" instead, so a team that is not out never looks out.
 *
 * ODDS_JS is the same rule as a literal for server pages' scripts (never shared with .toString(), see the traps).
 */

export const isEliminated = (v) => v != null && Number.isFinite(Number(v)) && Number(v) <= 0;
export const isClinched = (v) => v != null && Number.isFinite(Number(v)) && Number(v) >= 1;

/** A chance as members read it: Clinched, Eliminated, "<0.1%", ">99.9%" or one decimal (half up). */
export function oddsWords(v, { clinched = 'Clinched', eliminated = 'Eliminated' } = {}) {
  if (v == null || !Number.isFinite(Number(v))) return null;
  const x = Number(v);
  if (x >= 1) return clinched;
  if (x <= 0) return eliminated;
  if (x < 0.0005) return '<0.1%';
  if (x >= 0.9995) return '>99.9%';
  return `${(Math.round(x * 1000 + 1e-6) / 10).toFixed(1)}%`;
}

/** The same three tests for scripts in server pages. */
export const ODDS_JS = `
  window.isEliminated = function (v) { return v != null && isFinite(v) && Number(v) <= 0; };
  window.isClinched = function (v) { return v != null && isFinite(v) && Number(v) >= 1; };
  window.oddsTiny = function (v) { v = Number(v); return v > 0 && v < 0.0005 ? '<0.1%' : v < 1 && v >= 0.9995 ? '>99.9%' : null; };
`;
