/**
 * ESPN's playoff odds as the site recorded them, one entry per settled week (week 0 is before
 * any game), turned into chart points for one team. A plain module, tested by behaviour.
 * `before` keeps only the weeks the simulation does not cover, so the two never overlap.
 */
export function espnPoints(history, teamId, before = Infinity) {
  if (!history || !history.weeks) return [];
  return Object.keys(history.weeks).map(Number).filter((w) => Number.isFinite(w) && w < before).sort((a, b) => a - b)
    .map((w) => ({ week: w, v: history.weeks[String(w)][teamId], kind: "espn" }))
    .filter((p) => typeof p.v === "number");
}

/**
 * Week 6 (N1): every team's ESPN odds after each recorded week, for the league odds chart: a Map of team id to
 * [{ week, v }] in week order. `current` ({ week, byId }) adds today's figure where the record has no entry yet;
 * `upTo` drops weeks the chart should not show.
 */
export function leagueEspnSeries(history, teamIds, { current = null, upTo = Infinity } = {}) {
  const out = new Map(teamIds.map((id) => [Number(id), []]));
  const weeks = history && history.weeks ? Object.keys(history.weeks).map(Number).filter((w) => Number.isFinite(w) && w <= upTo).sort((a, b) => a - b) : [];
  for (const w of weeks) for (const id of out.keys()) {
    const v = history.weeks[String(w)][id];
    if (typeof v === "number") out.get(id).push({ week: w, v });
  }
  if (current && Number.isFinite(current.week) && current.week <= upTo) {
    for (const id of out.keys()) {
      const a = out.get(id), v = current.byId && current.byId[id];
      if (typeof v === "number" && !a.some((p) => p.week === current.week)) { a.push({ week: current.week, v }); a.sort((x, y) => x.week - y.week); }
    }
  }
  for (const [id, a] of out) if (!a.length) out.delete(id);
  return out;
}

/**
 * Week 6 (N1): every team's exact simulated odds after each week the map covers (each trim's recorded odds, by
 * team index), or the settled figures `exact(trim)` gives once every game is played (1 or 0).
 */
export function leagueSimSeries(teams, trims, exact = () => null) {
  const out = new Map(teams.map((t) => [Number(t.id), []]));
  for (const tr of trims || []) {
    const odds = exact(tr) || tr.odds;
    if (!Array.isArray(odds)) continue;
    teams.forEach((t, i) => { if (typeof odds[i] === "number") out.get(Number(t.id)).push({ week: tr.thru, v: odds[i] }); });
  }
  for (const [id, a] of out) if (!a.length) out.delete(id);
  return out;
}

/** The order the brackets seed teams in: the standings, or ESPN's playoff odds (the standings break ties). */
export function seedOrder(teams, by) {
  const idx = teams.map((t, i) => i).sort((a, b) => (teams[a].rank || 99) - (teams[b].rank || 99));
  if (by !== "espn") return idx;
  return idx.slice().sort((a, b) => ((teams[b].playoffPct ?? -1) - (teams[a].playoffPct ?? -1)) || ((teams[a].rank || 99) - (teams[b].rank || 99)));
}
