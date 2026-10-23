/**
 * Season Statistics while games are on (plan "Live figures", D29, D33).
 *
 * Seven records are running maxima that a game in progress can already beat: S21 highest weekly score, S26 highest
 * combined matchup score, S63 most lead changes, S66 biggest win-chance swing in an hour, S70 top scorer (and at each
 * position), S71 best single-week performance and S72 best single week at each position. Everything else waits for
 * the matchups to end.
 *
 * Three plain functions, shared by the Worker and the page:
 *   liveBase(model, view)  — stored with each live period's part: every player's settled points in the period, so a
 *                            live week can be added to them (src/seasonstep.js).
 *   liveWeek(digest, tl)   — the Worker's one-a-minute answer while games are on: this week's scores and players from
 *                            the live scoring digest, and its matchups' timeline facts.
 *   liveOverlay(part, live)— the page's patch: each ⚡ record whose holder this week's games now beat, or tie, marked
 *                            live. A live figure never enters the stored part; when the week settles the backend's
 *                            figures take over.
 * The regular season only: a two-week postseason matchup's running score spans two weeks, and its records wait for it
 * to settle.
 */
import { POS } from './seasonstats.js';

export const LIVE_RECORDS = ['S21.high', 'S26', 'S63', 'S66', 'S70', 'S71'];
const isLiveId = (id) => LIVE_RECORDS.includes(id) || /^S7[02]\./.test(id);

/** Every player's settled points in a period: { pid: [points, position] }, players with points only. */
export function liveBase(model, view) {
  const periods = new Set(model.teamWeeks.filter((t) => view.weeks.includes(t.week)).map((t) => t.period));
  const out = {};
  for (const p of Object.values(model.players)) {
    let v = 0;
    for (const [w, x] of Object.entries(p.weekly || {})) if (periods.has(Number(w))) v += Number(x) || 0;
    if (v) out[p.pid] = [Math.round(v * 100) / 100, p.pos];
  }
  return out;
}

/**
 * This week as the live scoring digest has it (src/derive.js live_scoring_digest), reduced for the page, with each
 * matchup's timeline facts (timelineFacts, src/seasonstats.js). `on` is whether any game of the week is live.
 */
export function liveWeek(digest, tlFacts = {}, regWeeks = 13) {
  const mp = Number(digest && digest.matchupPeriod);
  const games = ((digest && digest.games) || []).filter((g) => g && g.home && g.away && Number(g.period) === mp);
  const on = games.some((g) => g.state === 'live');
  if (!mp || mp > regWeeks || !games.length) return { on: false, week: mp || null, matches: [], players: [], tl: {} };
  const players = [];
  const matches = games.map((g) => {
    for (const side of ['home', 'away']) {
      const s = g[side];
      for (const x of [...(s.starters || []), ...(s.bench || [])]) {
        if (x && x.id && Number(x.points)) players.push([x.id, x.name || '', x.pos || '?', s.teamId, Math.round(Number(x.points) * 100) / 100, x.gameState || null]);
      }
    }
    return { id: g.id, state: g.state, home: g.home.teamId, away: g.away.teamId, hp: Number(g.home.points) || 0, ap: Number(g.away.points) || 0 };
  });
  const tl = {};
  for (const m of matches) if (tlFacts[m.id]) tl[m.id] = { changes: tlFacts[m.id].changes, swing: tlFacts[m.id].swing };
  return { on, week: mp, matches, players, tl };
}

const r2 = (x) => Math.round(x * 100 + 1e-9) / 100;
/** A record's entries with live candidates merged in, best first, ten kept; null when nothing live reaches the top. */
function merged(rec, candidates, sameAs) {
  if (!candidates.length) return null;
  const top = rec.entries.length ? rec.entries[0].value : -Infinity;
  const best = Math.max(...candidates.map((c) => c.value));
  if (best < top) return null;
  const kept = rec.entries.filter((e) => !candidates.some((c) => sameAs && sameAs(e, c)));
  const entries = [...kept, ...candidates].sort((a, b) => b.value - a.value).slice(0, 10);
  return { ...rec, entries, empty: null };
}

/**
 * The ⚡ records this week's games now hold or share, as { id: record }, each marked live. `part` is a live period's
 * stored part (with its liveBase); `live` is liveWeek()'s answer.
 */
export function liveOverlay(part, live) {
  const out = {};
  if (!part || !live || !live.on || !part.period || !part.period.live || !Array.isArray(part.records)) return out;
  const wk = live.week;
  const byId = Object.fromEntries(part.records.map((r) => [r.id, r]));
  // A record a game in progress now holds says so: "so far" until the week settles.
  const put = (id, rec) => {
    if (!rec) return;
    const entries = rec.entries.map((e) => (e.live && e.value === rec.entries[0].value ? { ...e, sub: 'so far' } : e));
    out[id] = { ...rec, entries, live: true, liveWeek: wk };
  };
  // The side ahead first; level scores name both teams and neither as ahead.
  const lead = (m) => (m.hp >= m.ap ? [m.home, m.away] : [m.away, m.home]);
  const ahead = (m) => (m.hp === m.ap ? [m.home, m.away] : [lead(m)[0]]);
  // S21: the highest weekly score.
  if (byId['S21.high']) {
    put('S21.high', merged(byId['S21.high'], live.matches.flatMap((m) => [{ teams: [m.home], value: r2(m.hp), week: wk, live: true }, { teams: [m.away], value: r2(m.ap), week: wk, live: true }])));
  }
  // S26: the highest combined matchup score.
  if (byId.S26) put('S26', merged(byId.S26, live.matches.map((m) => ({ vs: lead(m), teams: ahead(m), value: r2(m.hp + m.ap), week: wk, live: true }))));
  // S63 and S66: from the week's score timeline so far.
  for (const [id, key] of [['S63', 'changes'], ['S66', 'swing']]) {
    if (!byId[id]) continue;
    put(id, merged(byId[id], live.matches.filter((m) => live.tl[m.id] && live.tl[m.id][key] > 0)
      .map((m) => ({ vs: lead(m), teams: ahead(m), value: live.tl[m.id][key], week: wk, live: true }))));
  }
  // S70: season points with this week's added; S71 and S72: this week's points.
  const base = part.liveBase || {};
  const seasonOf = (p) => r2(((base[p[0]] || [0])[0] || 0) + p[4]);
  const player = (p, value, extra) => ({ kind: 'player', player: { name: p[1], pos: p[2] }, pid: p[0], team: p[3], teams: [p[3]], value, live: true, ...extra });
  const samePid = (e, c) => e.pid != null && e.pid === c.pid;
  const posIds = new Set(Object.values(POS));
  for (const rec of part.records) {
    if (!isLiveId(rec.id)) continue;
    const m = /^S7([012])(?:\.(.+))?$/.exec(rec.id);
    if (!m) continue;
    const pos = m[2] || null;
    if (pos && !posIds.has(pos)) continue;
    const pool = live.players.filter((p) => !pos || p[2] === pos);
    if (m[1] === '0') put(rec.id, merged(rec, pool.map((p) => player(p, seasonOf(p))), samePid));
    else put(rec.id, merged(rec, pool.map((p) => player(p, p[4], { week: wk }))));
  }
  return out;
}
