/**
 * Client half of the score timeline.
 *
 * Its own module with no imports, for the same reason dedupe.js is: the
 * scheduled handler and the request path both need to talk to the timeline, and
 * the Durable Object itself imports nothing from either. Keeping the three
 * callable functions here means no module in this bundle imports its own
 * caller, so there is no cycle to reason about at build time.
 */

/** One instance per week, so a season's timelines never share storage. */
export function timelineName(season, period) {
  return `${season || 'x'}:${period || 0}`;
}

function stub(env, season, period) {
  const ns = env.SCORE_TIMELINE;
  if (!ns) return null;
  return ns.get(ns.idFromName(timelineName(season, period)));
}

/**
 * @param matchups {id: [homePoints, awayPoints, homeWinProbability]}
 * @param players  {playerId: points} — the object turns these into events
 * @param playerMatchup {playerId: matchupId} — so a feed can be filtered
 */
export async function timelineAppend(env, season, period, matchups, at, players, playerMatchup) {
  const s = stub(env, season, period);
  if (!s) return { ok: false, error: 'SCORE_TIMELINE binding missing' };
  try {
    const res = await s.fetch('https://timeline/append', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        at: at || Date.now(), m: matchups,
        p: players || {}, pm: playerMatchup || {},
      }),
    });
    return await res.json();
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
}

export async function timelineRead(env, season, period) {
  const s = stub(env, season, period);
  if (!s) return { ok: false, count: 0, rows: [] };
  try {
    const res = await s.fetch('https://timeline/read');
    return await res.json();
  } catch {
    return { ok: false, count: 0, rows: [] };
  }
}

export async function timelineReset(env, season, period) {
  const s = stub(env, season, period);
  if (!s) return { ok: false };
  try {
    const res = await s.fetch('https://timeline/reset');
    return await res.json();
  } catch {
    return { ok: false };
  }
}
