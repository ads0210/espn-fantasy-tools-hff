/**
 * The one rounding rule for stored figures (docket A1).
 *
 * Points — team and player scores, projections, margins, points for and against, points a game — are kept to two
 * decimals, half up, from the moment a digest is built (`roundPts`). Rounding them to one decimal at the source and
 * printing two showed members wrong figures (182.60 for a real 182.56).
 *
 * `oneDecimal` is for figures that are not points: ownership and start percentages, their weekly change, average draft
 * position, auction value, a power index. A source scan in the suite fails any other one-decimal rounding in `src/`
 * and any `oneDecimal` applied to something named like points.
 */
export const roundPts = (n) => {
  const x = Number(n) || 0;
  return Math.round(x * 100 + (x < 0 ? -1e-6 : 1e-6)) / 100;
};

export const oneDecimal = (n) => Math.round((Number(n) || 0) * 10) / 10;
