/**
 * The statistics a trade is judged on, and what each is worth by default.
 *
 * Shared by the evaluator that applies them and by Site Configuration, where an
 * administrator sets the league's own weighting. Two copies of this list would
 * drift the moment a row was added, and the panel would then be offering to
 * weight a statistic that no longer exists — or quietly missing a new one.
 *
 * The canonical order is part of the specification: the engine attributes each
 * row's contribution at its own step, so reordering silently changes what every
 * default weight means.
 */
export const TRADE_ROWS = [
  { id: "R1", g: "A", n: "Rest-of-season production", s: 1, w: 1.00,
    h: "Net rest-of-season projected points moving each way, before any lineup slot is considered. The base term everything else is attributed on top of." },
  { id: "R2", g: "A", n: "Starting-lineup improvement", s: 1, w: 1.00,
    h: "What changes once the optimal legal lineup is actually solved. A side receiving three startable players into two open slots gains less here than the raw production suggests — that shortfall lands in this row." },
  { id: "R3", g: "A", n: "Recent form", s: 1, w: 0.35, needs: 3,
    h: "Trailing production against season projection. Needs about three games played before it says anything." },
  { id: "R4", g: "A", n: "Last season's production", s: 0, w: 0.20,
    h: "A prior-year anchor that decays to nothing by roughly week 6, so early-season noise does not overwhelm what a player actually did last year." },
  { id: "R5", g: "A", n: "Floor / consistency", s: 1, w: 0.30, needs: 3,
    h: "Week-to-week reliability. Two players with the same projection are not the same asset if one of them busts every third week." },
  { id: "R6", g: "A", n: "Ceiling / upside", s: 1, w: 0.30, needs: 3,
    h: "Top-end weekly outcomes. Worth more to a team that needs to make up ground than to one already comfortable." },
  { id: "R7", g: "A", n: "Opportunity quality", s: 0, w: 0.25, needs: 3,
    h: "How repeatable the volume is, separated from efficiency that is unlikely to hold." },
  { id: "R8", g: "A", n: "Total-points value", s: 0, w: 0.20,
    h: "Effect on season points scored. This league seeds on total points, so raw scoring carries value beyond winning individual weeks." },

  { id: "R9", g: "B", n: "Injury risk", s: 1, w: 0.70,
    h: "Expected points lost to injury designations and positional base rates. Scaling this row to 0% removes its attributed cost; it does not re-simulate an injury-free season." },
  { id: "R10", g: "B", n: "Durability", s: 0, w: 0.25, needs: 3,
    h: "Games missed historically, against the base rate for the position." },
  { id: "R11", g: "B", n: "Bye-week impact", s: 0, w: 0.40,
    h: "Lineup holes created or solved. Receiving two players who share a bye with an existing starter is a real cost that no projection shows." },
  { id: "R12", g: "B", n: "Role security", s: 0, w: 0.30,
    h: "Depth-chart position and the competition behind it." },

  { id: "R13", g: "C", n: "Positional need", s: 1, w: 0.80,
    h: "Marginal value measured against that side's own weakest starting slot, not against a league-average one. The same player is worth more to the team with a hole." },
  { id: "R14", g: "C", n: "Depth after the trade", s: 0, w: 0.50,
    h: "Change in bench quality, which is insurance rather than points. Bench value is discounted to 30% of a starter's." },
  { id: "R15", g: "C", n: "Forced drops", s: 0, w: 0.60,
    h: "Value destroyed by cuts the trade makes unavoidable. The drop set is chosen to minimise what is lost while keeping a legal lineup and staying inside position limits." },
  { id: "R16", g: "C", n: "Replacement level", s: 1, w: 0.45,
    h: "The free-agent floor is per team, not league-wide. The same bench player is worth more to a team with poor waiver access, because that team's alternative is worse." },
  { id: "R17", g: "C", n: "Roster flexibility", s: 0, w: 0.25,
    h: "FLEX eligibility and headroom under the position limits." },
  { id: "R18", g: "C", n: "Streaming discount", s: 0, w: 0.30,
    h: "Kickers and defences are replaceable week to week, so their apparent projection overstates what they are worth in a trade. This row suppresses most of it." },

  { id: "R19", g: "D", n: "Playoff-odds change", s: 1, w: 0.90,
    h: "The change in probability of reaching the bracket. The level comes from ESPN; only the change is ours, read off a monotone curve fitted across all ten teams' published odds." },
  { id: "R20", g: "D", n: "Championship-odds change", s: 0, w: 0.75,
    h: "Modelled, not published. Reaching the bracket, then winning two two-week rounds. Lower confidence than the row above it." },
  { id: "R21", g: "D", n: "Placement value", s: 0, w: 0.35,
    h: "Expected final finish, consolation ladder included. Six of ten teams finish outside the bracket here, so placement is most of the season for most teams." },
  { id: "R22", g: "D", n: "Playoff-weeks value", s: 1, w: 0.75,
    h: "Value concentrated in the postseason periods, above what the rest-of-season row already counted. Both rounds in this league span two scoring periods." },
  { id: "R23", g: "D", n: "Risk-appetite fit", s: 0, w: 0.45,
    h: "Whether added variance helps or hurts, taken from the slope of the fitted odds curve at this team's position. Steep slope near the qualification boundary means variance is worth taking." },
  { id: "R24", g: "D", n: "Schedule strength", s: 0, w: 0.30, needs: 3,
    h: "Remaining fantasy opponents." },

  { id: "R25", g: "E", n: "Market value", s: 1, w: 0.15,
    h: "Draft position, auction value and percent rostered. What the wider market thinks, kept deliberately low by default." },
  { id: "R26", g: "E", n: "Deal shape", s: 0, w: 0.20,
    h: "Consolidation against spread. On a capped roster, turning three players into one is worth something on its own." },
  { id: "R27", g: "E", n: "Draft capital", s: 0, w: 0.50, off: "Pick trading is off in this league",
    h: "Picks exchanged. Active only where the league enables pick trading." },
  { id: "R28", g: "E", n: "Keeper value", s: 0, w: 0.60, off: "This league has no keepers",
    h: "Retention value into next season. Active only in keeper leagues." },
];
export const TRADE_GROUPS = { A: "Production", B: "Availability", C: "Roster construction", D: "Situation", E: "Market and structure" };
