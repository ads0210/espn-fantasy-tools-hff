/**
 * Trade Analyzer's Postmortem: every decided trade offer graded in hindsight (Week 10 plan, D1–D12, G1–G5).
 * Plain functions, no I/O: the backend step (src/postmortemstep.js) hands it one season's reduced ESPN records.
 *
 * Season input S:
 *   { season, liveSeason, now, mpc, final, current, slots: {slotId: n}, trade: {revisionHours}, members: {memberId: teamId},
 *     schedule: [{week, home, away, hby, aby}], tx: [ESPN trade records],
 *     rosters: {period: {teamId: [[pid, slot, posId, act, proj, name, proTeam]]}},
 *     players: {pid: {name, posId, pro, act: {w}, proj: {w}}}, kick: {proTeam: {period: iso or ms}} }
 *
 * The measure (D2) is lineup impact: for each week, each side's best possible lineup on the points its players scored,
 * with the deal against without it, on that week's real rosters (Front Office's solver). The deal takes effect when it
 * went through, or for an offer that never did, when it was offered plus the league's review period (D3); players
 * whose games had kicked off by then stay put that week. Weeks still to play this season use ESPN's weekly projections
 * (D4). "ESPN expected" (G1, D42) is the same measure on ESPN's projections for each week.
 */
import { solve, SLOT_POS } from './frontoffice.js';
import { offersOf as linkedOffers } from './trades.js';

/** G2: Trade Analyzer's band names, on the gap in lineup points a week between the two sides. */
export const PM_BANDS = [
  { max: 1.5, key: 'even', label: 'Even' },
  { max: 4, key: 'slight', label: 'Slightly leans' },
  { max: 8, key: 'leans', label: 'Leans' },
  { max: 14, key: 'favors', label: 'Favors' },
  { max: Infinity, key: 'heavy', label: 'Heavily favors' },
];
export const PM_VERSION = 1;
const r2 = (x) => Math.round(((Number(x) || 0) + Number.EPSILON) * 100) / 100;
const ms = (x) => (x == null ? null : typeof x === 'number' ? x : Date.parse(x) || null);

/* ------------------------------------------------------------------ 1. offers from ESPN's linked records */
/** Every offer of the season (decided or not), two-team offers only, as { id, status, proposer, sides, drops, offeredAt, effectiveAt, period }. */
export function offersOf(S) {
  const now = S.now ?? Date.now();
  const hours = S.trade && S.trade.revisionHours != null ? Number(S.trade.revisionHours) : 24;
  return linkedOffers(S.tx || [], { members: S.members || {}, now }).filter((o) => o.teams.length === 2).map((o) => {
    const [a, b] = o.teams;
    const done = o.status === 'completed';
    return { id: o.id, season: S.season, status: o.status, offeredAt: o.offeredAt,
      effectiveAt: done ? (o.executedAt || o.offeredAt) : (o.offeredAt || 0) + hours * 3600e3,
      executedAt: o.executedAt, period: o.period, proposer: a,
      sides: [{ team: a, sends: o.sends[a] || [] }, { team: b, sends: o.sends[b] || [] }], drops: o.drops };
  });
}

/* ------------------------------------------------------------------ 2. lineup impact, week by week */
const slotList = (S) => {
  const out = [];
  for (const [s, n] of Object.entries(S.slots || {})) if (SLOT_POS[s]) for (let i = 0; i < n; i++) out.push(Number(s));
  return out.sort((a, b) => SLOT_POS[a].length - SLOT_POS[b].length);
};
function weekBook(S, w) {
  const book = new Map();
  for (const [team, list] of Object.entries((S.rosters || {})[w] || {})) for (const [pid, slot, posId, act, proj, name, pro] of list) book.set(pid, { pid, team: Number(team), slot, posId, act: act || 0, proj: proj || 0, name, pro });
  return book;
}
function playerIn(S, book, pid, w) {
  const b = book.get(pid);
  if (b) return b;
  const p = (S.players || {})[pid];
  if (!p) return null;
  return { pid, team: null, slot: null, posId: p.posId, act: (p.act || {})[w] || 0, proj: (p.proj || {})[w] || 0, name: p.name, pro: p.pro };
}
const kickoff = (S, p, w) => (p && p.pro != null && S.kick && S.kick[p.pro] ? ms(S.kick[p.pro][w]) : null);

/** The scoring periods a team plays from `from` on: every regular week, and a postseason week only with a fixture
 *  covering it (or, before this season's brackets are set, every postseason week, as a projection). */
function weeksPlayed(S, team, from) {
  const out = [];
  const post = (S.schedule || []).filter((m) => m.week > S.mpc);
  for (let w = from; w <= S.final; w++) {
    if (w <= S.mpc) { out.push(w); continue; }
    const fx = post.find((m) => (m.home === team || m.away === team) && Object.keys((m.home === team ? m.hby : m.aby) || {}).map(Number).includes(w));
    if (fx || (!post.length && S.season === S.liveSeason)) out.push(w);
  }
  return out;
}

export function impactOf(S, offer) {
  const slots = slotList(S);
  const [A, B] = offer.sides;
  const recv = { [A.team]: B.sends, [B.team]: A.sends }, sent = { [A.team]: A.sends, [B.team]: B.sends };
  const dropsOf = (t) => offer.drops.filter((d) => d.team === t).map((d) => d.pid);
  const completed = offer.status === 'completed';
  // The first week the deal could change a lineup: the earliest week with a game still to kick off after it took effect.
  let effW = null;
  for (let w = 1; w <= S.final && effW == null; w++) {
    const last = Math.max(0, ...Object.values(S.kick || {}).map((k) => ms(k[w]) || 0));
    if (last >= offer.effectiveAt) effW = w;
  }
  const res = {};
  for (const side of [A, B]) {
    const t = side.team;
    const weeks = effW == null ? [] : weeksPlayed(S, t, effW);
    const rows = [];
    for (const w of weeks) {
      const book = weekBook(S, w);
      const future = S.season === S.liveSeason && w >= S.current;
      const val = (p) => (future ? p.proj : p.act);
      const own = ((S.rosters[w] || {})[t] || []).filter((e) => e[1] !== 21).map((e) => e[0]);
      const locked = (pid) => w === effW && (() => { const p = playerIn(S, book, pid, w); const k = kickoff(S, p, w); return k != null && k < offer.effectiveAt; })();
      let withSet, withoutSet;
      if (completed) {
        withSet = new Set(own);
        withoutSet = new Set(own.filter((pid) => !recv[t].includes(pid)).concat(sent[t].filter((pid) => !locked(pid)), dropsOf(t)));
      } else {
        withoutSet = new Set(own);
        withSet = new Set(own.filter((pid) => !(sent[t].includes(pid) && !locked(pid))).concat(recv[t].filter((pid) => !locked(pid))));
      }
      const pool = (set) => [...set].map((pid) => playerIn(S, book, pid, w)).filter(Boolean);
      const bW = solve(pool(withSet), slots, val), bO = solve(pool(withoutSet), slots, val);
      const got = recv[t].map((pid) => playerIn(S, book, pid, w)).filter(Boolean);
      const started = completed ? got.filter((p) => p.team === t && p.slot != null && p.slot !== 20 && p.slot !== 21).reduce((s, p) => s + p.act, 0) : null;
      const pW = solve(pool(withSet), slots, (p) => p.proj).total, pO = solve(pool(withoutSet), slots, (p) => p.proj).total;
      rows.push({ w, future, impact: r2(bW.total - bO.total), expected: r2(pW - pO), received: r2(got.reduce((s, p) => s + val(p), 0)),
        started: started == null ? null : r2(started), partial: w === effW && [...recv[t], ...sent[t]].some(locked) });
    }
    const done = rows.filter((r) => !r.future), ahead = rows.filter((r) => r.future);
    const sum = (list, k) => r2(list.reduce((s, r) => s + (r[k] || 0), 0));
    res[t] = { team: t, rows, toDate: sum(done, 'impact'), stillToPlay: sum(ahead, 'impact'), total: sum(rows, 'impact'),
      expected: sum(rows, 'expected'), received: sum(done, 'received'), started: completed ? sum(done, 'started') : null,
      weeks: rows.length, weeksPlayed: done.length };
  }
  const nothing = effW != null && Object.values(res).every((s) => s.rows.length && s.rows.every((r) => !r.impact && !r.expected));
  return { effWeek: effW, impact: res, grade: gradeOf(res[A.team], res[B.team], A.team, B.team),
    expectedGrade: gradeOf(res[A.team], res[B.team], A.team, B.team, 'expected'),
    // G3: "Changes nothing: these players moved anyway"; or too late in the season to change any lineup.
    note: effW == null || Object.values(res).every((s) => !s.rows.length) ? 'tooLate' : nothing ? 'changesNothing' : null };
}

/* ------------------------------------------------------------------ 3. the grade (D5, G2) */
export function gradeOf(a, b, ta, tb, key = 'total') {
  const ga = a[key] / Math.max(a.weeks, 1), gb = b[key] / Math.max(b.weeks, 1);
  const gap = ga - gb;
  const band = PM_BANDS.find((x) => Math.abs(gap) < x.max);
  return { key: band.key, label: band.label, favors: band.key === 'even' ? null : gap > 0 ? ta : tb, gapPerWeek: r2(gap), weeks: Math.max(a.weeks, b.weeks, 1) };
}

/** Every decided offer of a season with its postmortem, newest first (G4). */
export function postmortemSeason(S) {
  return offersOf(S).filter((o) => !['on_the_table', 'pending_approval'].includes(o.status)).map((o) => ({ ...o, ...impactOf(S, o) }));
}
