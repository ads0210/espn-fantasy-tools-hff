/**
 * Matchup Insights: record placements (Week 10 plan, D38, D40, G15–G18; types I232–I289).
 *
 * Matchup Insights already says when a record falls (I191 this season, I229 all time) or is within reach (I154, I231).
 * These types fill in the places below first ("the 5th biggest upset this season", "the 7th lowest score in league
 * history"), before kickoff (from projections), while a game is played (already there, or on course for it) and
 * after the final. Every value is ranked against the same per-scoring-period games Hall of Fame and Season Statistics
 * count, read from the Postmortem's stored rosters for every season (src/postmortemstep.js): pools only exist once
 * every season is read, and no placement is said before then.
 *
 * A place is the competition rank of a value among a pool (equal values share it). Place 1 is left to the record
 * types, so these speak for places 2 to 10 (projections excepted), and only within the best 12% of a pool (never
 * fewer than three places), and this season's from week 4. At most three placement rows a game and a phase, never
 * two about the same measure and team.
 *
 * Pools: { complete, mpc: {season: n}, teamW: [{ season, week, team, opp, pts, oppPts, proj, optimal, post }],
 *          matchW: [{ season, week, a, b, pa, pb, projA, projB, win, lose, upset, post }],
 *          players: [{ season, week, team, name, pos, pts }] }
 */

const r2 = (x) => Math.round(((Number(x) || 0) + (x < 0 ? -1e-9 : 1e-9)) * 100) / 100;
export const ord = (n) => `${n}${[, 'st', 'nd', 'rd'][(n % 100 >> 3 ^ 1) && n % 10] || 'th'}`;
const fmt = (x) => Number(x).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export const MEASURES = {
  score: { level: 'team', dir: 1, tone: 1, words: 'highest score', key: (t) => t.pts },
  scoreLow: { level: 'team', dir: -1, tone: -1, words: 'lowest score', key: (t) => t.pts },
  lossHigh: { level: 'team', dir: 1, tone: 0, words: 'highest score in a loss', key: (t) => (t.pts < t.oppPts ? t.pts : null) },
  winLow: { level: 'team', dir: -1, tone: 0, words: 'lowest winning score', key: (t) => (t.pts > t.oppPts ? t.pts : null) },
  beatProj: { level: 'team', dir: 1, tone: 1, words: 'biggest margin over projection', key: (t) => (t.proj != null ? r2(t.pts - t.proj) : null) },
  missProj: { level: 'team', dir: -1, tone: -1, words: 'biggest miss of projection', key: (t) => (t.proj != null ? r2(t.pts - t.proj) : null) },
  leftOn: { level: 'team', dir: 1, tone: -1, words: 'most points left on the bench', key: (t) => (t.optimal != null ? r2(t.optimal - t.pts) : null) },
  combined: { level: 'match', dir: 1, tone: 0, words: 'highest-scoring game', key: (m) => r2(m.pa + m.pb) },
  combLow: { level: 'match', dir: -1, tone: 0, words: 'lowest-scoring game', key: (m) => r2(m.pa + m.pb) },
  blowout: { level: 'match', dir: 1, tone: 1, words: 'biggest blowout', key: (m) => r2(Math.abs(m.pa - m.pb)) },
  closest: { level: 'match', dir: -1, tone: 0, words: 'closest game', key: (m) => (m.pa === m.pb ? null : r2(Math.abs(m.pa - m.pb))) },
  upset: { level: 'match', dir: 1, tone: 1, words: 'biggest upset by projection', key: (m) => m.upset },
};

/** The catalogue, ids I232 to I289 in this order (D38). */
export const PLACEMENT_TYPES = [];
{
  let n = 232;
  const add = (t) => PLACEMENT_TYPES.push({ id: `I${n++}`, ...t });
  for (const scope of ['alltime', 'season']) for (const m of ['score', 'scoreLow', 'lossHigh', 'winLow', 'combined', 'combLow', 'blowout', 'closest', 'upset', 'beatProj', 'missProj', 'leftOn']) add({ phase: 'post', basis: 'final', scope, measure: m });
  for (const scope of ['alltime', 'season']) for (const m of ['score', 'combined']) add({ phase: 'live', basis: 'now', scope, measure: m });
  for (const scope of ['alltime', 'season']) for (const m of ['score', 'scoreLow', 'combined', 'combLow', 'blowout', 'closest']) add({ phase: 'live', basis: 'course', scope, measure: m });
  for (const m of ['score', 'scoreLow', 'combined', 'combLow', 'blowout', 'closest']) add({ phase: 'pre', basis: 'proj', scope: 'season', measure: m });
  for (const scope of ['alltime', 'season']) for (const m of ['score', 'scoreLow', 'combined', 'closest']) add({ phase: 'pre', basis: 'projVsProj', scope, measure: m });
  add({ phase: 'post', basis: 'pace', scope: 'alltime', measure: 'pfPace' });
  add({ phase: 'post', basis: 'pace', scope: 'alltime', measure: 'pfPaceLow' });
  add({ phase: 'post', basis: 'final', scope: 'season', measure: 'playerPos' });
  add({ phase: 'live', basis: 'now', scope: 'season', measure: 'playerPos' });
}
const typeFor = (phase, basis, scope, measure) => PLACEMENT_TYPES.find((t) => t.phase === phase && t.basis === basis && t.scope === scope && t.measure === measure);

/** Weight by place, scope, basis and tone (G17). */
export function weightOf(t, place) {
  const top = t.scope === 'alltime' ? [null, 9, 8, 8, 7, 7, 6, 6, 6, 6, 6] : [null, 7, 6, 6, 5, 5, 4, 4, 4, 4, 4];
  let w = top[place];
  if (w == null) return null;
  const tone = t.measure in MEASURES ? MEASURES[t.measure].tone : 1;
  if (tone === 0) w -= 1;
  if (t.measure === 'playerPos') w = place <= 3 ? 5 : 4;
  if (t.basis === 'now') w -= 1;
  if (t.basis === 'course') w = Math.max(3, w - 2);
  if (t.basis === 'proj') w = Math.max(3, w - 2);
  if (t.basis === 'projVsProj') w = Math.min(t.scope === 'alltime' ? 6 : 5, Math.max(3, w - 2));
  if (t.basis === 'pace') w = place === 1 ? 7 : 5;
  return w;
}
export function placesFor(t) {
  if (t.basis === 'pace') return [1, 3];
  if (t.basis === 'projVsProj') return [1, t.scope === 'alltime' ? 5 : 3];
  if (t.measure === 'playerPos') return [2, 5];
  return [2, 10];
}
export const SHARE = 0.12;
export function maxPlace(t, poolSize) {
  const [, hi] = placesFor(t);
  return Math.min(hi, Math.max(3, Math.floor(poolSize * SHARE)));
}
const SHORT = { score: 'Big score', scoreLow: 'Low score', lossHigh: 'Unlucky loss', winLow: 'Ugly win', combined: 'Shootout',
  combLow: 'Low-scoring game', blowout: 'Blowout', closest: 'Photo finish', upset: 'Upset', beatProj: 'Beat the projection',
  missProj: 'Missed the projection', leftOn: 'Bench blunder', pfPace: 'Record pace', pfPaceLow: 'Slow start', playerPos: 'Big week' };
export function labelOf(t) {
  const short = SHORT[t.measure] || 'Record';
  return t.scope === 'alltime' ? `All-time ${short[0].toLowerCase()}${short.slice(1)}` : short;
}
/** Matchup Insights' TYPES entries for the catalogue: [category, label, base weight (unused: rows carry their own), phase]. */
export const PLACEMENT_TYPE_ENTRIES = Object.fromEntries(PLACEMENT_TYPES.map((t) => [t.id, ['records', labelOf(t), 3, t.phase]]));

export function placeOf(v, pool, dir) {
  if (v == null) return null;
  let better = 0;
  for (const x of pool) if (x != null && (dir > 0 ? x > v : x < v)) better++;
  return better + 1;
}
const inRange = (t, place, n) => { const [lo] = placesFor(t); return place != null && place >= lo && place <= maxPlace(t, n); };
export const SEASON_FROM = 4;
const theNth = (p) => (p === 1 ? 'the ' : `the ${ord(p)} `);
const scopeWords = (sc) => (sc === 'alltime' ? 'in league history' : 'this season');
const inPool = (g, sc, season, week, incWeek) => (sc === 'season' ? g.season === season && (g.week < week || (incWeek && g.week === week))
  : g.season < season || (g.season === season && (g.week < week || (incWeek && g.week === week))));

const T = (id) => ({ t: id });
const V = (x) => ({ v: x });
function mk(t, place, when, teams, parts) {
  return { type: t.id, cat: 'records', label: labelOf(t), weight: weightOf(t, place), when, teams, about: teams.length === 1 ? 'team' : 'matchup',
    parts, predict: null, outcome: null, measure: t.measure, place };
}

/**
 * After the final: the game's own scoring periods (`periods`), counted once they are in the pools or given as `extra`
 * ({ teamW, matchW, players } for a game final but not yet settled).
 */
export function postPlacements(P, season, periods, home, away, extra = null) {
  if (!P || !P.complete) return [];
  const out = [];
  const teamW = extra ? [...P.teamW.filter((g) => !(g.season === season && periods.includes(g.week) && [home, away].includes(g.team))), ...(extra.teamW || [])] : P.teamW;
  const matchW = extra ? [...P.matchW.filter((g) => !(g.season === season && periods.includes(g.week) && [g.a, g.b].includes(home))), ...(extra.matchW || [])] : P.matchW;
  const players = extra ? [...P.players.filter((x) => !(x.season === season && periods.includes(x.week) && [home, away].includes(x.team))), ...(extra.players || [])] : P.players;
  const mpc = P.mpc[season] || 13;
  for (const week of periods) {
    const m = matchW.find((g) => g.season === season && g.week === week && ((g.a === home && g.b === away) || (g.a === away && g.b === home)));
    if (!m) continue;
    for (const scope of ['alltime', 'season']) {
      if (scope === 'season' && week < SEASON_FROM) continue;
      const poolM = matchW.filter((g) => inPool(g, scope, season, week, true));
      const poolT = teamW.filter((g) => inPool(g, scope, season, week, true));
      for (const key of ['combined', 'combLow', 'blowout', 'closest', 'upset']) {
        const t = typeFor('post', 'final', scope, key), M = MEASURES[key], v = M.key(m);
        const place = placeOf(v, poolM.map(M.key), M.dir);
        if (!inRange(t, place, poolM.length)) continue;
        const W = m.win ?? m.a, L = m.lose ?? m.b;
        const tail = `${theNth(place)}${M.words} ${scopeWords(scope)}.`;
        const parts = key === 'combined' || key === 'combLow' ? [T(m.a), ` ${fmt(m.pa)}–${fmt(m.pb)} `, T(m.b), ', ', V(fmt(v)), ` combined: ${tail}`]
          : key === 'upset' ? [T(W), ' beat ', T(L), ' from ', V(fmt(v)), ` down in the projections: ${tail}`]
            : [T(W), ' beat ', T(L), ' by ', V(fmt(v)), `: ${tail}`];
        out.push(mk(t, place, 'post', key === 'upset' || key === 'blowout' ? [W, L] : [m.a, m.b], parts));
      }
      for (const tw of teamW.filter((g) => g.season === season && g.week === week && (g.team === home || g.team === away))) {
        for (const key of ['score', 'scoreLow', 'lossHigh', 'winLow', 'beatProj', 'missProj', 'leftOn']) {
          const t = typeFor('post', 'final', scope, key), M = MEASURES[key], v = M.key(tw);
          if (v == null || (key === 'beatProj' && v <= 0) || (key === 'missProj' && v >= 0)) continue;
          const place = placeOf(v, poolT.map(M.key), M.dir);
          if (!inRange(t, place, poolT.length)) continue;
          const tail = `${theNth(place)}${M.words} ${scopeWords(scope)}.`;
          const parts = key === 'lossHigh' ? [T(tw.team), ' scored ', V(fmt(v)), ` and lost: ${tail}`]
            : key === 'winLow' ? [T(tw.team), ' won with ', V(fmt(v)), `: ${tail}`]
              : key === 'beatProj' ? [T(tw.team), ' beat their projection by ', V(fmt(v)), `: ${tail}`]
                : key === 'missProj' ? [T(tw.team), ' fell ', V(fmt(-v)), ` short of their projection: ${tail}`]
                  : key === 'leftOn' ? [T(tw.team), ' left ', V(fmt(v)), ` on the bench (best possible lineup ${fmt(tw.optimal)}): ${tail}`]
                    : [T(tw.team), ' scored ', V(fmt(v)), `: ${tail}`];
          out.push(mk(t, place, 'post', [tw.team], parts));
        }
      }
    }
    if (week >= SEASON_FROM) {
      const t = typeFor('post', 'final', 'season', 'playerPos');
      for (const pl of players.filter((x) => x.season === season && x.week === week && (x.team === home || x.team === away))) {
        const pool = players.filter((x) => x.season === season && x.week <= week && x.pos === pl.pos).map((x) => x.pts);
        const place = placeOf(pl.pts, pool, 1);
        if (!inRange(t, place, pool.length)) continue;
        out.push(mk(t, place, 'post', [pl.team], [{ p: `${pl.name} · ${pl.pos}` }, ' scored ', V(fmt(pl.pts)), ' for ', T(pl.team), `: ${theNth(place)}best ${pl.pos} week this season.`]));
      }
    }
    // Season to date against every season to the same week (regular season), top three, only when new or improved.
    if (week >= SEASON_FROM && week <= mpc) {
      const thru = (y, team, wk) => r2(teamW.filter((g) => g.season === y && g.team === team && g.week <= wk && !g.post).reduce((s, g) => s + g.pts, 0));
      const seasons = [...new Set(teamW.map((g) => g.season))].filter((y) => y <= season);
      const poolAt = (wk) => { const o = []; for (const y of seasons) for (const tm of [...new Set(teamW.filter((g) => g.season === y).map((g) => g.team))]) { const v = thru(y, tm, wk); if (v) o.push(v); } return o; };
      const pool = poolAt(week), poolB = poolAt(week - 1);
      for (const tid of [home, away]) {
        const mine = thru(season, tid, week), before = thru(season, tid, week - 1);
        for (const [key, dir, words] of [['pfPace', 1, 'most'], ['pfPaceLow', -1, 'fewest']]) {
          const t = typeFor('post', 'pace', 'alltime', key), place = placeOf(mine, pool, dir);
          if (!inRange(t, place, pool.length)) continue;
          const prev = placeOf(before, poolB, dir);
          if (week - 1 >= SEASON_FROM && inRange(t, prev, poolB.length) && prev <= place) continue;
          out.push(mk(t, place, 'post', [tid], [T(tid), ' have ', V(fmt(mine)), ` points after ${week} weeks: the ${place === 1 ? '' : `${ord(place)} `}${words} through week ${week} in league history.`]));
        }
      }
    }
  }
  return capPlacements(out);
}

/** Before kickoff, from the two teams' projected totals (`hproj`, `aproj`). */
/* `sameWeek`: the week's other games' projections ({ teams: [proj], matches: [{ pa, pb }] }), counted into the
   projection-against-projection pools so two teams projected low the same week are not both the lowest. */
export function prePlacements(P, season, week, home, away, hproj, aproj, { lowOk = true, sameWeek = null } = {}) {
  if (!P || !P.complete || hproj == null || aproj == null || !(hproj > 0 && aproj > 0)) return [];
  const out = [];
  const pm = { pa: hproj, pb: aproj };
  const fav = hproj >= aproj ? home : away, dog = fav === home ? away : home;
  for (const [basis, scopes] of [['proj', ['season']], ['projVsProj', ['alltime', 'season']]]) for (const scope of scopes) {
    if (scope === 'season' && week < SEASON_FROM) continue;
    const poolT = P.teamW.filter((g) => inPool(g, scope, season, week, false));
    const poolM = P.matchW.filter((g) => inPool(g, scope, season, week, false));
    const tv = basis === 'proj' ? poolT.map((g) => g.pts) : poolT.map((g) => g.proj).concat(scope === 'season' || scope === 'alltime' ? ((sameWeek && sameWeek.teams) || []) : []);
    const mv = basis === 'proj' ? poolM : poolM.filter((g) => g.projA != null && g.projB != null).map((g) => ({ pa: g.projA, pb: g.projB })).concat((sameWeek && sameWeek.matches) || []);
    for (const key of ['score', 'scoreLow']) {
      const t = typeFor('pre', basis, scope, key); if (!t) continue;
      if (key === 'scoreLow' && !lowOk) continue;
      const M = MEASURES[key];
      for (const [team, v] of [[home, hproj], [away, aproj]]) {
        const place = placeOf(v, tv, M.dir);
        if (!inRange(t, place, tv.length)) continue;
        out.push(mk(t, place, 'pre', [team], basis === 'proj'
          ? [T(team), ' are projected for ', V(fmt(v)), `: that would be ${theNth(place)}${M.words} ${scopeWords(scope)}.`]
          : [T(team), ' are projected for ', V(fmt(v)), `: ${theNth(place)}${key === 'score' ? 'highest' : 'lowest'} projection of any team ${scopeWords(scope)}.`]));
      }
    }
    for (const key of ['combined', 'combLow', 'blowout', 'closest']) {
      const t = typeFor('pre', basis, scope, key); if (!t) continue;
      if ((key === 'combLow' || key === 'closest' || key === 'blowout') && !lowOk) continue;
      const M = MEASURES[key], v = M.key(pm);
      const pool = mv.map(M.key);
      const place = placeOf(v, pool, M.dir);
      if (!inRange(t, place, pool.length)) continue;
      const lead = key === 'blowout' || key === 'closest' ? [T(fav), ' are projected to beat ', T(dog), ' by ', V(fmt(v))] : [T(home), ' and ', T(away), ' are projected for ', V(fmt(v)), ' combined'];
      out.push(mk(t, place, 'pre', [fav, dog], [...lead, basis === 'proj' ? `: that would be ${theNth(place)}${M.words} ${scopeWords(scope)}.` : `: ${theNth(place)}${key === 'closest' ? 'closest projected game' : key === 'combined' ? 'highest projected total' : 'lowest projected total'} ${scopeWords(scope)}.`]));
    }
  }
  return capPlacements(out);
}

/**
 * While a game is played: { home, away, hp, ap, hcourse, acourse, starters: [{ team, name, pos, pts }] } and the
 * week's finished games ({ pa, pb } and their team scores) counted into the pools.
 */
export function livePlacements(P, season, week, g, finished = []) {
  if (!P || !P.complete) return [];
  const out = [];
  for (const scope of ['alltime', 'season']) {
    if (scope === 'season' && week < SEASON_FROM) continue;
    const poolT = P.teamW.filter((x) => inPool(x, scope, season, week, false)).map((x) => x.pts).concat(finished.flatMap((f) => [f.pa, f.pb]));
    const poolM = P.matchW.filter((x) => inPool(x, scope, season, week, false)).concat(finished.map((f) => ({ pa: f.pa, pb: f.pb })));
    for (const [team, pts, course] of [[g.home, g.hp, g.hcourse], [g.away, g.ap, g.acourse]]) {
      const t = typeFor('live', 'now', scope, 'score'), place = placeOf(pts, poolT, 1);
      if (inRange(t, place, poolT.length)) out.push(mk(t, place, 'live', [team], [T(team), ' already have ', V(fmt(pts)), `: already ${theNth(place)}highest score ${scopeWords(scope)}.`]));
      for (const key of ['score', 'scoreLow']) {
        const t2 = typeFor('live', 'course', scope, key), M = MEASURES[key], p2 = placeOf(course, poolT, M.dir);
        if (course != null && inRange(t2, p2, poolT.length)) out.push(mk(t2, p2, 'live', [team], [T(team), ' are on course for ', V(fmt(course)), `: that would be ${theNth(p2)}${M.words} ${scopeWords(scope)}.`]));
      }
    }
    const comb = r2(g.hp + g.ap);
    { const t = typeFor('live', 'now', scope, 'combined'), place = placeOf(comb, poolM.map(MEASURES.combined.key), 1);
      if (inRange(t, place, poolM.length)) out.push(mk(t, place, 'live', [g.home, g.away], [T(g.home), ' and ', T(g.away), ' already have ', V(fmt(comb)), ` combined: already ${theNth(place)}highest-scoring game ${scopeWords(scope)}.`])); }
    if (g.hcourse != null && g.acourse != null) {
      const cm = { pa: g.hcourse, pb: g.acourse };
      const fav = g.hcourse >= g.acourse ? g.home : g.away, dog = fav === g.home ? g.away : g.home;
      for (const key of ['combined', 'combLow', 'blowout', 'closest']) {
        const t = typeFor('live', 'course', scope, key), M = MEASURES[key], v = M.key(cm), place = placeOf(v, poolM.map(M.key), M.dir);
        if (!inRange(t, place, poolM.length)) continue;
        const lead = key === 'blowout' || key === 'closest' ? [T(fav), ' are on course to beat ', T(dog), ' by ', V(fmt(v))] : ['On course for ', V(fmt(v)), ' combined'];
        out.push(mk(t, place, 'live', [fav, dog], [...lead, `: that would be ${theNth(place)}${M.words} ${scopeWords(scope)}.`]));
      }
    }
  }
  if (week >= SEASON_FROM) {
    const t = typeFor('live', 'now', 'season', 'playerPos');
    for (const pl of g.starters || []) {
      if (!pl.pts) continue;
      const pp = P.players.filter((x) => x.season === season && x.week < week && x.pos === pl.pos).map((x) => x.pts);
      const place = placeOf(pl.pts, pp, 1);
      if (inRange(t, place, pp.length)) out.push(mk(t, place, 'live', [pl.team], [{ p: `${pl.name} · ${pl.pos}` }, ' already has ', V(fmt(pl.pts)), ' for ', T(pl.team), `: already ${theNth(place)}best ${pl.pos} week this season.`]));
    }
  }
  return capPlacements(out);
}

/** At most three placement rows a game and a phase: the heaviest, all-time first on a tie; one per measure and team. */
export const CAP = 3;
export function capPlacements(rows) {
  const seen = new Set(), keep = [];
  const scopeOf = (r) => (PLACEMENT_TYPES.find((t) => t.id === r.type) || {}).scope;
  for (const r of [...rows].sort((a, b) => b.weight - a.weight || (scopeOf(a) === 'alltime' ? -1 : 1))) {
    const k = `${r.measure}|${r.teams[0]}`;
    if (seen.has(k)) continue;
    seen.add(k); keep.push(r);
    if (keep.length >= CAP) break;
  }
  return keep.map(({ measure, place, ...r }) => r);
}

/* ------------------------------------------------------------------ pools from the Postmortem's stored reads */
const POS = { 1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'D/ST' };
/**
 * One season's games per scoring period from its frame (base: mpc, slots, schedule with points per period) and its
 * rosters per period ({ period: { team: [[pid, slot, posId, act, proj, name, pro]] } }); `solveBest(pool)` is the best
 * lineup on actual points. Only periods before `upTo` (this season: settled weeks) are taken.
 */
export function seasonPools(base, rosters, { upTo = Infinity, solveBest } = {}) {
  const teamW = [], matchW = [], players = [];
  const y = base.season;
  for (const m of base.schedule || []) {
    if (m.home == null || m.away == null) continue;
    const per = new Set([...Object.keys(m.hby || {}), ...Object.keys(m.aby || {})].map(Number));
    for (const p of per) {
      if (p >= upTo) continue;
      const pa = r2((m.hby || {})[p] || 0), pb = r2((m.aby || {})[p] || 0);
      if (!pa && !pb) continue;
      const post = m.week > base.mpc;
      const side = (team, pts, opp, oppPts) => {
        const ro = ((rosters[p] || {})[team]) || [];
        const st = ro.filter((e) => e[1] !== 20 && e[1] !== 21);
        const proj = st.length ? r2(st.reduce((s, e) => s + (e[4] || 0), 0)) : null;
        const optimal = ro.length && solveBest ? r2(solveBest(ro.filter((e) => e[1] !== 21).map((e) => ({ pid: e[0], posId: e[2], act: e[3] || 0 })))) : null;
        for (const e of st) if (e[3] != null) players.push({ season: y, week: p, team, name: e[5], pos: POS[e[2]] || '', pts: e[3] });
        return { season: y, week: p, team, opp, pts, oppPts, proj, optimal: optimal != null && optimal >= pts ? optimal : null, post };
      };
      const A = side(m.home, pa, m.away, pb), B = side(m.away, pb, m.home, pa);
      teamW.push(A, B);
      const win = pa === pb ? null : pa > pb ? A : B, lose = win === A ? B : win === B ? A : null;
      const upset = win && win.proj != null && lose.proj != null && lose.proj > win.proj ? r2(lose.proj - win.proj) : null;
      matchW.push({ season: y, week: p, a: m.home, b: m.away, pa, pb, projA: A.proj, projB: B.proj, win: win && win.team, lose: lose && lose.team, upset, post });
    }
  }
  return { teamW, matchW, players };
}
