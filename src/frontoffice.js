/**
 * Front Office's rules: one team's week, its pickups and the weeks ahead, from a model of stored facts (src/fomodel.js,
 * gathered by the backend step src/frontofficestep.js). Plain functions, no I/O, tested by behaviour
 * (test/frontoffice.mjs). Every number a member sees is ESPN's projection or an actual score; the rules only compare
 * them (plan D4, D5). Rule keys are descriptive ('starterOut', 'hot'); the plan's catalogue numbers stay in comments.
 *
 *   thisWeek(M, teamId)   the slot list, alternatives, lineup notes, the pre-lock checklist, totals and late swaps
 *   pickups(M, teamId)    free agents ranked by fit, each with its suggested drop
 *   weeksAhead(M, teamId) the roster x weeks grid, each week's best lineup, the fantasy schedule, stash candidates
 */
export const RULES_VERSION = 5;
export const MARGIN = 2;                  // D12: A7/A8 and a bench alternative
export const HOT = 15;                    // D25: L1/L2, combined over three weeks
export const SPREAD_X = 1.5;              // D25: L15
export const W = { next: 0.5, rest: 0.3, post: 0.2 };   // D26
export const ADJ_CAP = 0.5;               // D31: Rising and Form capped at 0.50
// A bench upgrade (30 Oct, the user): a free agent who would not start but projects better than a bench player at his
// position, who could be dropped for him. Its fit is the depth gain at a quarter weight, so it sits below pickups that
// would start; it needs at least BENCH_MIN a week of depth gain to be named.
export const BENCH_W = 0.25, BENCH_MIN = 0.5, BENCH_PER_POS = 3;
/* The league's calendar comes with the model (M.regLast, M.postFirst, M.postLast): 13, 14 and 17 here. */

export const POS = { 1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'D/ST' };
export const SLOT_POS = { 0: [1], 2: [2], 4: [3], 6: [4], 23: [2, 3, 4], 16: [16], 17: [5] };
export const SLOT_NAME = { 0: 'QB', 2: 'RB', 4: 'WR', 6: 'TE', 23: 'FLEX', 16: 'D/ST', 17: 'K', 20: 'Bench', 21: 'IR' };
const OUT = new Set(['OUT', 'INJURY_RESERVE', 'SUSPENSION']);
const r2 = (x) => Math.round(Number(x) * 100 + 1e-9) / 100;
const sum = (a) => a.reduce((s, x) => s + x, 0);
const avg = (a) => (a.length ? sum(a) / a.length : 0);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

/* ------------------------------------------------------------------ facts about one player */
export const projOf = (p, w) => Number((p.proj || {})[w]) || 0;
export const isOut = (p) => OUT.has(p.inj);
export const onBye = (M, p, w) => { const t = M.nfl[p.nfl]; return !t || t.bye === w || !(t.opp || {})[w]; };
/** Can he score in week w? Out, on a bye or projected at nothing means no. */
export function plays(M, p, w) {
  if (onBye(M, p, w)) return false;
  if (w === M.week && isOut(p)) return false;
  return projOf(p, w) > 0 || (w === M.week && !isOut(p) && p.posId === 16);
}
/** Played weeks with both an actual and a projection, newest last. */
function playedWeeks(M, p) {
  const out = [];
  for (let w = 1; w < M.week; w++) if ((p.act || {})[w] != null && projOf(p, w) > 0) out.push(w);
  return out;
}
/** A player's season tape, week 1 to this week: what he scored (or is scoring) against ESPN's projection. */
export function tapeOf(M, p) {
  const out = [];
  for (let w = 1; w <= M.week; w++) {
    const a = w < M.week ? (p.act || {})[w] : (M.live || {})[p.pid];
    out.push({ w, a: a == null ? null : r2(a), p: r2(projOf(p, w)), bye: onBye(M, p, w) });
  }
  return out;
}
export function gameOf(M, p) { return M.games[p.nfl] || null; }
export function lockedNow(M, p) {
  const g = gameOf(M, p);
  return Boolean(g && (g.state === 'live' || g.state === 'final' || Date.parse(g.kickoff) <= M.now));
}

/* ------------------------------------------------------------------ the lineup solver */
/** The starting slots, one entry per place, fixed (one-position) slots first so the flexible ones take what is left. */
export function slotList(M) {
  const out = [];
  for (const [s, n] of M.slots) for (let i = 0; i < n; i++) out.push(s);
  return out.sort((a, b) => (SLOT_POS[a] || []).length - (SLOT_POS[b] || []).length);
}
/**
 * The best lineup from a pool by `value(p)`: fixed slots take the best eligible player left, then the flexible slots.
 * With one-position slots plus flex slots whose positions include theirs, this order is optimal (an exchange argument;
 * test/frontoffice.mjs checks it against brute force on real rosters). `fixed` maps slot index -> pid already locked in.
 */
export function solve(pool, slots, value, fixed = {}) {
  const used = new Set(Object.values(fixed));
  const assign = slots.map((s, i) => (fixed[i] != null ? fixed[i] : undefined));
  let total = 0;
  for (const [i, pid] of Object.entries(fixed)) { const p = pool.find((x) => x.pid === pid); if (p) total += value(p); }
  slots.forEach((s, i) => {
    if (assign[i] !== undefined) return;
    let best = null, bv = -Infinity;
    for (const p of pool) {
      if (used.has(p.pid) || !(SLOT_POS[s] || []).includes(p.posId)) continue;
      const v = value(p);
      if (v > bv) { bv = v; best = p; }
    }
    if (best && bv > 0) { used.add(best.pid); assign[i] = best.pid; total += bv; } else assign[i] = null;
  });
  return { total: r2(total), assign };
}
export function bruteBest(pool, slots, value) {   // the oracle for tests only
  let best = 0;
  const rec = (i, used, t) => {
    if (i === slots.length) { best = Math.max(best, t); return; }
    rec(i + 1, used, t);
    for (const p of pool) if (!used.has(p.pid) && (SLOT_POS[slots[i]] || []).includes(p.posId) && value(p) > 0) { used.add(p.pid); rec(i + 1, used, t + value(p)); used.delete(p.pid); }
  };
  rec(0, new Set(), 0);
  return r2(best);
}
const weekValue = (M, w) => (p) => (plays(M, p, w) ? projOf(p, w) : 0);
export function bestTotal(M, pids, w) {
  return solve(pids.map((id) => M.players[id]).filter(Boolean), slotList(M), weekValue(M, w)).total;
}

/* ------------------------------------------------------------------ lineup notes L1-L16 */
const DEF = new Set(['DE', 'DT', 'NT', 'LB', 'ILB', 'OLB', 'MLB', 'CB', 'S', 'SS', 'FS', 'DB', 'EDGE']);
function spreadOf(p, M) { const ws = playedWeeks(M, p); if (ws.length < 4) return null; const xs = ws.map((w) => p.act[w]); const m = avg(xs); return Math.sqrt(avg(xs.map((x) => (x - m) ** 2))); }
export function typicalSpread(M) {
  const by = {};
  for (const p of Object.values(M.players)) { const s = spreadOf(p, M); if (s != null) (by[p.posId] ||= []).push(s); }
  const med = {};
  for (const [k, a] of Object.entries(by)) { a.sort((x, y) => x - y); med[k] = a[Math.floor(a.length / 2)]; }
  return med;
}
/** Every note for one player this week. Each note: { id, tag: up|down|neutral, label, text, red }. */
export function notesFor(M, p, ctx) {
  const out = [];
  const w = M.week, g = gameOf(M, p), team = M.nfl[p.nfl] || {};
  const add = (id, tag, label, text, red = false) => out.push({ id, tag, label, text, red });
  const ws = playedWeeks(M, p).slice(-3);
  if (ws.length === 3) {
    const d = ws.map((x) => p.act[x] - projOf(p, x));
    if (d.every((x) => x > 0) && sum(d) >= HOT) add('hot', 'up', 'Running hot', `Beat his projection in each of the last 3 weeks, by ${r2(sum(d)).toFixed(2)} in all.`);
    if (d.every((x) => x < 0) && -sum(d) >= HOT) add('cold', 'down', 'Running cold', `Missed his projection in each of the last 3 weeks, by ${r2(-sum(d)).toFixed(2)} in all.`, true);
  }
  if ([2, 3, 4].includes(p.posId)) {
    const qb = ctx.qb1[p.nfl];
    if (qb && ['OUT', 'DOUBTFUL', 'INJURY_RESERVE'].includes(qb.inj)) add('qbOut', 'down', 'His QB is out', `${qb.name} is ${qb.inj === 'DOUBTFUL' ? 'doubtful' : 'out'}${qb.backup ? `; ${qb.backup} is next on the depth chart` : ''}.`, true);
    const ahead = ctx.aheadOut[p.pid];
    if (ahead) add('teammateOut', 'up', 'Teammate out', `${ahead} is out, and he is next on the depth chart.`);
  }
  if (ctx.promoted && ctx.promoted[p.pid]) add('promoted', 'up', 'Promoted', `Moved up to ${ctx.promoted[p.pid]} on his depth chart.`);
  if (w > 2 && (p.act || {})[w - 1] == null && !onBye(M, p, w - 1) && Object.keys(p.act || {}).length && plays(M, p, w)) add('back', 'neutral', 'First game back', 'He returns after missing last week.');
  if (g && ctx.defOut[g.opp] >= 2 && p.posId !== 16) add('weakDefence', 'up', 'Weakened defence', `${ctx.defOut[g.opp]} of ${g.opp}'s defenders are ruled out.`);
  if (g && g.ou >= 50) add('shootout', 'up', 'Shootout', `His game's over/under is ${g.ou}.`);
  if (g && g.fav && g.spread >= 7) {
    const fav = g.fav === p.nfl;
    if (fav && p.posId === 2) add('gameScript', 'up', 'Game script', `${p.nfl} are ${g.spread}-point favourites: a run-heavy afternoon is likely.`);
    if (!fav && [1, 3, 4].includes(p.posId)) add('gameScript', 'up', 'Game script', `${p.nfl} are ${g.spread}-point underdogs: expect plenty of passing.`);
  }
  const rank = g && ((M.ratings[p.posId] || {})[g.opp]);
  if (rank >= 30) add('softMatchup', 'up', 'Soft matchup', `${g.opp} give up the ${ordinal(33 - rank)}-most points to ${POS[p.posId]}s.`);
  const first = (M.projFirst || {})[p.pid];
  if (first != null && Math.abs(projOf(p, w) - first) >= 3) {
    const up = projOf(p, w) > first;
    add('projMoved', up ? 'up' : 'down', 'Projection moved', `ESPN moved him from ${first.toFixed(2)} to ${projOf(p, w).toFixed(2)} this week.`, !up);
  }
  if (ctx.stack && ctx.stack.has(p.pid)) add('stack', 'neutral', 'Stack', ctx.stackText[p.pid]);
  if (p.posId === 5 && g && g.indoor && ctx.weatherK) add('domeKicker', 'up', 'Dome kicker', `Kicks indoors while ${ctx.weatherK} faces the weather.`);
  const vol = plays(M, p, w) ? ctx.volume[p.pid] : null;
  if (vol) add('volume', 'up', 'Volume', vol);
  const sp = spreadOf(p, M), typ = ctx.typSpread[p.posId];
  if (sp != null && typ && sp >= SPREAD_X * typ) add('boomBust', 'neutral', 'Boom or bust', `His weekly points swing ${r2(sp).toFixed(2)} either way, ${(sp / typ).toFixed(1)}× a typical ${POS[p.posId]}.`);
  if (ctx.added && ctx.added.has(p.pid)) add('newPickup', 'neutral', 'New pickup', 'Added this week: his first start for this team.');
  return out;
}
const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;

/** Facts the notes need about every NFL team, worked out once per model. */
export function noteContext(M, teamId) {
  const qb1 = {}, aheadOut = {}, defOut = {}, volume = {};
  for (const p of Object.values(M.players)) {
    const d = M.depth[p.pid];
    if (p.posId === 1 && d && d.d === 1) qb1[p.nfl] = { name: p.name, inj: p.inj };
  }
  for (const p of Object.values(M.players)) {
    const d = M.depth[p.pid];
    if (p.posId === 1 && d && d.d === 2 && qb1[p.nfl]) qb1[p.nfl].backup = p.name;
  }
  for (const x of M.injuries) {
    if (DEF.has(x.pos) && x.status === 'OUT') defOut[x.team] = (defOut[x.team] || 0) + 1;
    const d = M.depth[x.id];
    if (!d || x.status !== 'OUT') continue;
    for (const p of Object.values(M.players)) {
      const pd = M.depth[p.pid];
      if (pd && p.nfl === x.team && pd.s === d.s && pd.d === d.d + 1 && x.name !== p.name) aheadOut[p.pid] = x.name;
    }
  }
  // L14: share of targets and carries over the last three weeks among the team's known players at his position.
  const lastW = [M.week - 3, M.week - 2, M.week - 1].filter((w) => w >= 1);
  const touches = (p) => sum(lastW.map((w) => ((p.tgt || {})[w] || 0) + ((p.car || {})[w] || 0)));
  const byTeamPos = {};
  for (const p of Object.values(M.players)) if ([2, 3, 4].includes(p.posId)) (byTeamPos[`${p.nfl}:${p.posId}`] ||= []).push(p);
  for (const list of Object.values(byTeamPos)) {
    list.sort((a, b) => touches(b) - touches(a));
    list.slice(0, 2).forEach((p, i) => {
      const t = touches(p), recent = avg(lastW.map((w) => (p.act || {})[w]).filter((x) => x != null));
      if (t >= 15 && recent - projOf(p, M.week) >= 3) volume[p.pid] = `${t} targets and carries over 3 weeks, ${i === 0 ? 'the most' : 'second most'} among ${p.nfl}'s ${POS[p.posId]}s; ESPN projects ${projOf(p, M.week).toFixed(2)} against his ${r2(recent).toFixed(2)} average.`;
    });
  }
  const roster = (M.rosters[teamId] || []);
  const starters = roster.filter((e) => e.slot !== 20 && e.slot !== 21).map((e) => M.players[e.pid]).filter(Boolean);
  const stack = new Set(), stackText = {};
  for (const q of starters.filter((p) => p.posId === 1)) {
    const mates = starters.filter((p) => [3, 4].includes(p.posId) && p.nfl === q.nfl);
    if (mates.length) { stack.add(q.pid); stackText[q.pid] = `Starts with his pass catcher${mates.length > 1 ? 's' : ''} ${mates.map((m) => m.name).join(' and ')}.`; mates.forEach((m) => { stack.add(m.pid); stackText[m.pid] = `Starts with his QB, ${q.name}.`; }); }
  }
  const benchK = roster.map((e) => M.players[e.pid]).filter((p) => p && p.posId === 5).find((p) => { const g = gameOf(M, p); return g && !g.indoor && g.windy; });
  return { qb1, aheadOut, defOut, volume, stack, stackText, typSpread: typicalSpread(M), added: M.added[teamId], weatherK: benchK ? benchK.name : null, promoted: M.promoted || null };
}

/* ------------------------------------------------------------------ Tab 1: this week */
export function thisWeek(M, teamId) {
  const roster = M.rosters[teamId] || [];
  const ctx = noteContext(M, teamId);
  const P = (id) => M.players[id];
  const w = M.week;
  const val = (p) => (plays(M, p, w) ? projOf(p, w) : 0);
  const cards = roster.map((e) => {
    const p = P(e.pid), g = gameOf(M, p);
    return {
      pid: e.pid, slot: e.slot, name: p.name, pos: POS[p.posId], posId: p.posId, nfl: p.nfl, inj: p.inj, proj: projOf(p, w),
      opp: g ? g.opp : null, home: g ? g.home : null, kickoff: g ? g.kickoff : null, rank: g ? (M.ratings[p.posId] || {})[g.opp] || null : null,
      ou: g ? g.ou : null, line: g ? g.lineText : null, weather: g && !g.indoor ? g.weatherText : null, indoor: g ? g.indoor : null,
      bye: onBye(M, p, w), locked: lockedNow(M, p), state: g ? g.state : 'bye', live: (M.live || {})[e.pid] ?? null,
      notes: notesFor(M, p, ctx), droppable: p.droppable !== false, tape: tapeOf(M, p),
      // What the opened card shows beyond the week: the next three weeks, ownership, depth chart.
      ahead: [1, 2, 3].map((k) => w + k).filter((x) => x <= M.postLast).map((x) => { const o = ((M.nfl[p.nfl] || {}).opp || {})[x] || null;
        return { w: x, p: r2(projOf(p, x)), bye: onBye(M, p, x), opp: o, home: ((M.nfl[p.nfl] || {}).home || {})[x] ?? null, rank: o ? (M.ratings[p.posId] || {})[o] || null : null }; }),
      own: p.own ?? null, chg: Number(p.chg) || 0, depth: M.depth[p.pid] ? M.depth[p.pid].d : null, indoorGame: g ? !!g.indoor : null,
    };
  });
  const ORDER = { 0: 0, 2: 1, 4: 2, 6: 3, 23: 4, 16: 5, 17: 6 };
  const PORD = { 1: 0, 2: 1, 3: 2, 4: 3, 16: 4, 5: 5 };
  cards.sort((a, b) => (ORDER[a.slot] ?? 9) - (ORDER[b.slot] ?? 9) || PORD[a.posId] - PORD[b.posId] || b.proj - a.proj);
  const byPid = Object.fromEntries(cards.map((c) => [c.pid, c]));
  const starters = cards.filter((c) => c.slot !== 20 && c.slot !== 21);
  const bench = cards.filter((c) => c.slot === 20);
  const ir = cards.filter((c) => c.slot === 21);
  // Alternatives: the best unlocked bench player eligible for each unlocked starter's slot, each bench player offered
  // once, the biggest gains placed first (D11: 2.00+ higher, or a note makes it notable).
  const taken = new Set();
  const cand = [];
  for (const s of starters) {
    if (s.locked) continue;
    for (const b of bench) {
      if (b.locked || !(SLOT_POS[s.slot] || []).includes(b.posId)) continue;
      const bv = val(P(b.pid)), sv = val(P(s.pid));
      const gain = r2(bv - sv);
      const redStarter = s.notes.some((n) => n.red) || isOut(P(s.pid)) || s.bye;
      const upBench = b.notes.some((n) => n.tag === 'up');
      if (gain >= MARGIN || (bv > 0 && gain > -MARGIN && (redStarter || upBench))) cand.push({ s: s.pid, b: b.pid, gain, why: gain >= MARGIN ? 'proj' : redStarter ? 'starter' : 'bench' });
    }
  }
  cand.sort((a, b) => b.gain - a.gain);
  const alt = {};
  for (const c of cand) if (!alt[c.s] && !taken.has(c.b)) { alt[c.s] = c; taken.add(c.b); }
  for (const s of starters) s.alt = alt[s.pid] || null;
  // Totals: this lineup, the best one (locked players stay where they are), the opponent's.
  const slots = slotList(M);
  const lineupNow = r2(sum(starters.map((s) => (s.locked && s.live != null ? s.live : val(P(s.pid))))));
  const pool = roster.filter((e) => e.slot !== 21).map((e) => P(e.pid));
  const fixed = {};
  const order = slots.map((s, i) => [s, i]);
  for (const st of starters.filter((c) => c.locked)) { const hit = order.find(([s, i]) => s === st.slot && fixed[i] == null); if (hit) fixed[hit[1]] = st.pid; }
  const best = solve(pool, slots, (p) => (byPid[p.pid].locked && byPid[p.pid].live != null ? byPid[p.pid].live : val(p)), fixed).total;
  const fx = (M.schedule[w] || []).find((m) => m.home === teamId || m.away === teamId);
  const oppId = fx ? (fx.home === teamId ? fx.away : fx.home) : null;
  const oppProj = oppId ? r2(sum((M.rosters[oppId] || []).filter((e) => e.slot !== 20 && e.slot !== 21).map((e) => val(P(e.pid))))) : null;
  const checklist = checks(M, teamId, { starters, bench, ir, cards, lineupNow, oppProj });
  const open = starters.filter((s) => !s.locked);
  const nextLock = open.map((s) => s.kickoff).filter(Boolean).sort()[0] || null;
  const anyLocked = starters.some((s) => s.locked);
  return { week: w, oppId, totals: { lineup: lineupNow, best, opp: oppProj }, starters, bench, ir, checklist,
    lateSwap: anyLocked && open.length ? { open: open.map((s) => SLOT_NAME[s.slot]), nextLock } : null,
    over: starters.every((s) => s.state === 'final' || s.bye) && anyLocked };
}

/* ------------------------------------------------------------------ the pre-lock checklist A1-A17 */
function checks(M, teamId, T) {
  const out = [];
  const add = (id, tone, text, at = null) => out.push({ id, tone, text, at });
  const name = (c) => `${c.name} (${SLOT_NAME[c.slot]})`;
  const slotsNeeded = slotList(M).length;
  for (const s of T.starters) {
    if (s.locked) continue;
    if (['OUT', 'INJURY_RESERVE', 'SUSPENSION'].includes(s.inj)) add('starterOut', 'red', `${name(s)} is ${s.inj === 'SUSPENSION' ? 'suspended' : s.inj === 'OUT' ? 'out' : 'on injured reserve'}.`);
    if (s.bye) add('starterBye', 'red', `${name(s)} is on a bye.`);
    if (s.moved) add('gameMoved', 'red', `${name(s)}'s game has moved to ${s.moved}.`);
    if (s.inj === 'DOUBTFUL') add('doubtful', 'amber', `${name(s)} is doubtful.`);
    if (s.inj === 'QUESTIONABLE') add('questionable', 'amber', `${name(s)} is questionable; his game kicks off`, s.kickoff);
    if (s.alt && s.alt.gain >= MARGIN) add(s.slot === 23 ? 'betterFlex' : 'betterStart', 'amber', `${M.players[s.alt.b].name} projects ${s.alt.gain.toFixed(2)} more than ${s.name} at ${SLOT_NAME[s.slot]}.`);
    const d = M.depth[s.pid];
    const slip = d && ((s.posId === 1 && d.d >= 2) || (s.posId === 4 && d.d >= 3) || (s.posId === 2 && d.d >= 3) || (s.posId === 5 && d.d >= 2));
    if (slip) add('depthSlip', 'amber', `${name(s)} is ${ordinal(d.d)} on his NFL depth chart.`);
    if (s.rank != null && s.rank <= 3 && s.posId !== 16) add('toughDefence', 'info', `${name(s)} faces ${s.opp}, the ${s.rank === 1 ? 'stingiest' : `${ordinal(s.rank)}-stingiest`} defence against ${s.pos}s.`);
    if (s.ou != null && s.ou < 38) add('lowTotal', 'info', `${name(s)}'s game has a low over/under (${s.ou}).`);
    if (s.weather && [1, 3, 5].includes(s.posId) && /wind|snow|rain/i.test(s.weather)) add('weather', 'info', `${name(s)}: ${s.weather}.`);
  }
  const empty = slotsNeeded - T.starters.length;
  if (empty > 0) add('emptySlot', 'red', `${empty} starting slot${empty > 1 ? 's are' : ' is'} empty.`);
  for (const r of T.ir) if (!['OUT', 'INJURY_RESERVE', 'SUSPENSION', 'DOUBTFUL'].includes(r.inj)) add('irBlocked', 'amber', `${r.name} is in the IR spot but no longer injured, so ESPN will not accept roster moves until he leaves it.`);
  if (!T.ir.length) for (const b of T.bench) if (['OUT', 'INJURY_RESERVE'].includes(b.inj)) add('irOpen', 'amber', `${b.name} is ${b.inj === 'OUT' ? 'out' : 'on injured reserve'} and could move to the empty IR spot, freeing a bench place.`);
  const dst = T.starters.find((s) => s.posId === 16);
  if (dst) for (const s of T.starters) if (s !== dst && s.opp === dst.nfl) add('facesOwnDefence', 'info', `${name(s)} plays against your own D/ST.`);
  const open = T.starters.filter((s) => !s.locked);
  if (T.starters.some((s) => s.locked) && open.length) add('unlocked', 'info', `${open.length} starter${open.length > 1 ? 's' : ''} still unlocked; the next lock is`, open.map((s) => s.kickoff).filter(Boolean).sort()[0] || null);
  // TD: the league's own trade deadline, from a week before it until it passes (none for a league without one).
  if (M.deadline && M.deadline > M.now && M.deadline - M.now <= 8 * 864e5) add('tradeDeadline', 'info', 'Trade deadline: offers must be accepted and through the league\'s review by', new Date(M.deadline).toISOString());
  if (T.oppProj != null && T.oppProj - T.lineupNow >= 15) add('trailing', 'info', `You trail by ${(T.oppProj - T.lineupNow).toFixed(2)} projected points: upside plays matter this week.`);
  const rank = { red: 0, amber: 1, info: 2 };
  return out.sort((a, b) => rank[a.tone] - rank[b.tone]);
}

/* ------------------------------------------------------------------ Tab 2: pickups */
export function pickups(M, teamId, opts = {}) {
  const roster = M.rosters[teamId] || [];
  const ids = roster.filter((e) => e.slot !== 21).map((e) => e.pid);
  const irFree = !roster.some((e) => e.slot === 21);
  const w0 = M.week;
  const span = (a, b) => { const o = []; for (let w = a; w <= b; w++) o.push(w); return o; };
  const next3 = span(w0, Math.min(w0 + 2, M.postLast)), rest = span(w0, M.regLast), post = span(M.postFirst, M.postLast);
  const inRace = (M.teams[teamId] || {}).inRace !== false;
  const base = {};
  for (const w of span(w0, M.postLast)) base[w] = bestTotal(M, ids, w);
  const gainOf = (pidsAfter, weeks) => avg(weeks.map((w) => bestTotal(M, pidsAfter, w) - base[w]));
  const counts = {};
  for (const id of ids) { const p = M.players[id]; counts[p.posId] = (counts[p.posId] || 0) + 1; }
  const benchIds = roster.filter((e) => e.slot === 20).map((e) => e.pid).filter((id) => M.players[id].droppable !== false);
  // Docket A7: with the IR spot free and a player who can go there (out or on injured reserve), the move is "put him
  // on IR", not "drop him": he leaves the active roster either way, so the lineup sums are the same, but nobody is
  // cut. The one ESPN projects least for the rest of the season is the one named.
  const restW = []; for (let w = w0; w <= M.regLast; w++) restW.push(w);
  const irCand = irFree ? roster.filter((e) => e.slot !== 21 && ['OUT', 'INJURY_RESERVE'].includes(M.players[e.pid].inj)).map((e) => e.pid)
    .sort((a, b) => sum(restW.map((w) => projOf(M.players[a], w))) - sum(restW.map((w) => projOf(M.players[b], w))))[0] ?? null : null;
  const opp = (() => { const fx = (M.schedule[w0] || []).find((m) => m.home === teamId || m.away === teamId); return fx ? (fx.home === teamId ? fx.away : fx.home) : null; })();
  const out = [];
  for (const fa of Object.values(M.players).filter((p) => p.status === 'FREEAGENT' || p.status === 'WAIVERS')) {
    const stash = ['OUT', 'DOUBTFUL', 'INJURY_RESERVE'].includes(fa.inj);
    if (stash && !(irFree && irCand == null && projOf(fa, Math.min(w0 + 3, M.regLast)) > 0)) continue;
    const atCap = M.caps[fa.posId] > 0 && (counts[fa.posId] || 0) >= M.caps[fa.posId];
    const drops = benchIds.filter((id) => !atCap || M.players[id].posId === fa.posId);
    // The suggested drop (plan, Tab 2; D31): the bench player with the lowest rest-of-season projection whose loss leaves
    // every starting slot fillable in each of the next three weeks. (Round 1 first tried "whichever drop gains most",
    // which named a strong third QB every time: he never starts, so losing him costs the lineup nothing.)
    const rosVal = (id) => sum(rest.map((w) => projOf(M.players[id], w)));
    const holesAfter = (after) => next3.some((w) => solve(after.map((id) => M.players[id]), slotList(M), weekValue(M, w)).assign.some((x) => x == null));
    const holesNow = holesAfter(ids);
    const ordered = [...drops].sort((a, b) => rosVal(a) - rosVal(b));
    const useIR = irCand != null && !atCap;
    const chosen = useIR ? irCand : ordered.find((d) => holesNow || !holesAfter(ids.filter((x) => x !== d).concat(fa.pid))) ?? ordered[0];
    let best = null;
    for (const d of chosen != null ? [chosen] : []) {
      const after = ids.filter((x) => x !== d).concat(fa.pid);
      const streamer = fa.posId === 5 || fa.posId === 16;
      const gN = gainOf(after, streamer ? [w0] : next3);
      const gR = streamer ? 0 : gainOf(after, rest);
      const gP = streamer || !inRace ? 0 : gainOf(after, post);
      const core = streamer ? gN : W.next * gN + (inRace ? W.rest * gR + W.post * gP : (W.rest + W.post) * gR);
      if (!best || core > best.core) best = { drop: d, core, gN, gR, gP };
    }
    if (!best) continue;
    const reasons = [], adj = [];
    const chg = Number(fa.chg) || 0;
    if (chg) adj.push(['Rising', clamp(0.25 * chg / 10, -ADJ_CAP, ADJ_CAP)]);
    const fw = playedWeeks(M, fa).slice(-3);
    if (fw.length) adj.push(['Form', clamp(0.25 * avg(fw.map((w) => fa.act[w] - projOf(fa, w))), -ADJ_CAP, ADJ_CAP)]);
    const d = M.depth[fa.pid];
    const myRb1 = ids.map((id) => M.players[id]).find((p) => p.posId === 2 && p.nfl === fa.nfl && M.depth[p.pid] && M.depth[p.pid].d === 1);
    if (fa.posId === 2 && d && d.d === 2 && myRb1) { adj.push(['Handcuff', 0.5]); reasons.push(`Backs up your ${myRb1.name}.`); }
    let block = false;
    if (opp) {
      const theirs = (M.rosters[opp] || []).map((e) => M.players[e.pid]).filter((p) => p && p.posId === fa.posId && plays(M, p, w0));
      const top = Math.max(0, ...theirs.map((p) => projOf(p, w0)));
      if (plays(M, fa, w0) && projOf(fa, w0) - top >= MARGIN) { block = true; adj.push(['Block', 0.5]); reasons.push(`Projects ${(projOf(fa, w0) - top).toFixed(2)} above every ${POS[fa.posId]} ${M.teams[opp].name} rosters this week.`); }
    }
    if (fa.inj === 'QUESTIONABLE') adj.push(['Questionable', -0.5]);
    // D31: the adjustments only refine a player who would actually start somewhere in the
    // window; one who never would keeps a fit of zero however hot or popular he is, and sits under Show all.
    let fit = best.core >= 0.05 ? best.core + sum(adj.map((a) => a[1])) : Math.min(0, best.core);
    let kind = best.core >= 0.05 ? 'start' : null, depth = 0, benchVs = null;
    // Not a starter anywhere ahead: is he still better than a bench player at his position the team could drop? Then
    // he is named as a bench upgrade, that bench player is the drop, and his fit is the depth gain at a quarter weight.
    if (!kind && !stash) {
      const streamer = fa.posId === 5 || fa.posId === 16;
      const dv = (p) => (streamer ? projOf(p, w0) : 0.5 * avg(next3.map((w) => projOf(p, w))) + 0.5 * avg(rest.map((w) => projOf(p, w))));
      const mine = dv(fa);
      const worse = benchIds.filter((id) => M.players[id].posId === fa.posId && id !== irCand)
        .map((id) => [id, mine - dv(M.players[id])]).filter(([, g]) => g >= BENCH_MIN)
        .filter(([id]) => holesNow || !holesAfter(ids.filter((x) => x !== id).concat(fa.pid)))
        .sort((a, b) => b[1] - a[1]);
      if (worse.length) { kind = 'bench'; depth = worse[0][1]; benchVs = worse[0][0]; if (!useIR) best.drop = worse[0][0]; fit = BENCH_W * depth; }
    }
    if (fa.status === 'WAIVERS' && fit > 0) fit *= 0.9;
    fit = r2(fit);
    // Reasons a member reads: the lineup gain first, then schedule, depth chart, streamer, the adjustments.
    if (best.gN > 0.01) reasons.unshift(`Would start for you: +${r2(best.gN).toFixed(2)} a week over the next ${fa.posId === 5 || fa.posId === 16 ? 'game' : '3 weeks'}.`);
    if (kind === 'bench') reasons.unshift(`Better than your bench: projects ${r2(depth).toFixed(2)} a week more than ${M.players[benchVs].name}${fa.posId === 5 || fa.posId === 16 ? ' this week' : ' over the weeks ahead'}.`);
    const soft = next3.filter((w) => { const o = (M.nfl[fa.nfl] || {}).opp || {}; const r = (M.ratings[fa.posId] || {})[o[w]]; return r >= 25; }).length;
    if (soft >= 2) reasons.push(`Soft schedule: ${soft} of his next 3 opponents rank in the bottom 8 against ${POS[fa.posId]}s.`);
    if (d && d.d === 1 && [1, 2, 4].includes(fa.posId)) reasons.push(`First on ${fa.nfl}'s depth chart.`);
    if (chg >= 5) reasons.push(`Rising: +${r2(chg).toFixed(1)} points of ESPN ownership this week.`);
    if (stash) reasons.push('An IR stash: your IR spot is free.');
    const byes = next3.filter((w) => ids.some((id) => { const p = M.players[id]; return p.posId === fa.posId && onBye(M, p, w); }));
    if (byes.length) reasons.push(`Covers a ${POS[fa.posId]} bye in week ${byes.join(', ')}.`);
    const dp = M.players[best.drop];
    out.push({
      pid: fa.pid, name: fa.name, pos: POS[fa.posId], posId: fa.posId, nfl: fa.nfl, inj: fa.inj, status: fa.status,
      own: fa.own, chg, next: projOf(fa, w0), ros: r2(sum(rest.map((w) => projOf(fa, w)))), form: fw.length ? r2(avg(fw.map((w) => fa.act[w]))) : null,
      opps: next3.map((w) => { const o = ((M.nfl[fa.nfl] || {}).opp || {})[w] || null; return { w, opp: o, p: r2(projOf(fa, w)), bye: onBye(M, fa, w), rank: o ? (M.ratings[fa.posId] || {})[o] || null : null }; }),
      tape: tapeOf(M, fa), fit, kind, gain: { next: r2(best.gN), rest: r2(best.gR), post: r2(best.gP), bench: r2(depth) }, adj: adj.map(([k, v]) => [k, r2(v)]), block,
      reasons: reasons.slice(0, 3), drop: { pid: dp.pid, name: dp.name, pos: POS[dp.posId], nfl: dp.nfl, next: projOf(dp, w0), ros: r2(sum(rest.map((w) => projOf(dp, w)))), ...(useIR && best.drop === irCand ? { toIR: true } : {}) },
      ...(benchVs != null ? { benchVs: { pid: benchVs, name: M.players[benchVs].name } } : {}),
    });
  }
  // Bench upgrades are kept to the best BENCH_PER_POS at each position; the rest go back among the players who would
  // not help (one weak bench player otherwise had dozens of free agents named against him).
  const seen = {};
  for (const x of out.filter((y) => y.kind === 'bench').sort((a, b) => b.fit - a.fit)) {
    seen[x.posId] = (seen[x.posId] || 0) + 1;
    if (seen[x.posId] > BENCH_PER_POS) { x.kind = null; x.fit = 0; x.reasons = x.reasons.filter((r) => !r.startsWith('Better than your bench')); }
  }
  // Pickups that would start come first, then bench upgrades, then the rest; by fit within each.
  const tier = (x) => (x.kind === 'start' && x.fit > 0 ? 0 : x.kind === 'bench' && x.fit > 0 ? 1 : 2);
  out.sort((a, b) => tier(a) - tier(b) || b.fit - a.fit || (b.own || 0) - (a.own || 0));
  return { week: w0, waiverRank: (M.teams[teamId] || {}).waiverRank, teams: Object.keys(M.teams).length, waiver: M.waiver || null, list: out, needs: needs(M, teamId, next3) };
}
/** The needs strip: each of the next three weeks' holes (a slot no healthy, non-bye player can fill, or a thin one). */
function needs(M, teamId, weeks) {
  const roster = (M.rosters[teamId] || []).filter((e) => e.slot !== 21).map((e) => M.players[e.pid]);
  const out = [];
  for (const w of weeks) {
    for (const [s, n] of M.slots.filter(([s]) => (SLOT_POS[s] || []).length === 1)) {
      const ok = roster.filter((p) => (SLOT_POS[s] || []).includes(p.posId) && plays(M, p, w)).length;
      const byes = roster.filter((p) => (SLOT_POS[s] || []).includes(p.posId) && onBye(M, p, w)).length;
      if (ok < n) out.push({ w, tone: 'red', text: `${SLOT_NAME[s]} short in week ${w}${byes ? `: ${byes} on bye` : ''}` });
      else if (ok === n && byes) out.push({ w, tone: 'amber', text: `${SLOT_NAME[s]} thin in week ${w}: ${byes} on bye` });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ Tab 3: weeks ahead */
/**
 * The race (from Fortune Teller's swing table, counted exactly at its last update): the team's playoff odds now, with a
 * win and with a loss this week, if it wins every game left, its biggest game left, and up to three other games this
 * week whose result moves its odds most, each with the side to root for. Null before Fortune Teller has a table for
 * this week (it opens late in the regular season), after the regular season, or while Fortune Teller is not visible.
 */
export const ROOT_MIN = 0.005;
export function raceOf(M, teamId) {
  const s = M.swing;
  if (!s || s.odds[teamId] == null || M.week > M.regLast) return null;
  const r6 = (x) => (x == null ? null : Math.round(x * 1e6) / 1e6);
  const mine = s.games.find((g) => g.a === teamId || g.b === teamId) || null;
  const pick = (g, home) => (g ? (home ? g.home : g.away)[teamId] ?? null : null);
  const win = mine ? pick(mine, mine.a === teamId) : null, loss = mine ? pick(mine, mine.a !== teamId) : null;
  const rootFor = s.games.filter((g) => g !== mine && g.home[teamId] != null && g.away[teamId] != null)
    .map((g) => { const d = g.home[teamId] - g.away[teamId]; return { forId: d >= 0 ? g.a : g.b, againstId: d >= 0 ? g.b : g.a, gain: r6(Math.abs(d)) }; })
    .filter((x) => x.gain >= ROOT_MIN).sort((x, y) => y.gain - x.gain).slice(0, 3);
  const c = s.critical[teamId];
  return { week: s.week, odds: r6(s.odds[teamId]), win: r6(win), loss: r6(loss), winOut: r6(s.winOut[teamId] ?? null),
    oppId: mine ? (mine.a === teamId ? mine.b : mine.a) : null,
    critical: c ? { week: c.week, oppId: c.a === teamId ? c.b : c.a } : null, rootFor };
}
export function weeksAhead(M, teamId, opts = {}) {
  const roster = M.rosters[teamId] || [];
  const order = { 0: 0, 2: 1, 4: 2, 6: 3, 23: 4, 16: 5, 17: 6, 20: 7, 21: 8 };
  const weeks = []; for (let w = M.week; w <= M.postLast; w++) weeks.push(w);
  const rows = [...roster].sort((a, b) => order[a.slot] - order[b.slot] || M.players[a.pid].posId - M.players[b.pid].posId).map((e) => {
    const p = M.players[e.pid];
    return { pid: p.pid, name: p.name, pos: POS[p.posId], posId: p.posId, nfl: p.nfl, slot: e.slot, inj: p.inj,
      cells: weeks.map((w) => { const o = ((M.nfl[p.nfl] || {}).opp || {})[w] || null; return { w, bye: onBye(M, p, w), out: !onBye(M, p, w) && projOf(p, w) <= 0, proj: projOf(p, w), opp: o, rank: o ? (M.ratings[p.posId] || {})[o] || null : null }; }) };
  });
  const ids = roster.filter((e) => e.slot !== 21).map((e) => e.pid);
  const slots = slotList(M);
  const cols = weeks.map((w) => {
    const pool = ids.map((id) => M.players[id]);
    const sol = solve(pool, slots, weekValue(M, w));
    const holes = slots.map((s, i) => (sol.assign[i] == null ? SLOT_NAME[s] : null)).filter(Boolean);
    const fx = (M.schedule[w] || []).find((m) => m.home === teamId || m.away === teamId);
    const oppId = fx ? (fx.home === teamId ? fx.away : fx.home) : null;
    const ORD = { 0: 0, 2: 1, 4: 2, 6: 3, 23: 4, 16: 5, 17: 6 };
    const lineup = slots.map((s, i) => ({ slot: s, pid: sol.assign[i] ?? null, proj: sol.assign[i] ? r2(projOf(M.players[sol.assign[i]], w)) : null }))
      .sort((a, b) => ORD[a.slot] - ORD[b.slot] || (b.proj || 0) - (a.proj || 0));
    return { w, best: sol.total, holes, lineup, post: w >= M.postFirst, round: ((M.rounds || {})[w] || {})[teamId] || null, oppId, oppBest: oppId ? bestTotal(M, (M.rosters[oppId] || []).filter((e) => e.slot !== 21).map((e) => e.pid), w) : null };
  });
  // Stash candidates: free agents whose next four weeks (or the postseason weeks) clearly beat their recent form.
  const stash = Object.values(M.players).filter((p) => (p.status === 'FREEAGENT' || p.status === 'WAIVERS') && ![5, 16].includes(p.posId)).map((p) => {
    const ws = weeks.slice(0, 4), f = playedWeeks(M, p).slice(-3);
    const ahead = avg(ws.map((w) => projOf(p, w))), form = avg(f.map((w) => p.act[w]));
    const postAvg = avg(Array.from({ length: M.postLast - M.postFirst + 1 }, (_, k) => projOf(p, M.postFirst + k)));
    return { pid: p.pid, name: p.name, pos: POS[p.posId], nfl: p.nfl, ahead: r2(ahead), form: r2(form), post: r2(postAvg), lift: r2(Math.max(ahead, postAvg) - form), own: p.own,
      tape: tapeOf(M, p), next: ws.map((w) => ({ w, p: r2(projOf(p, w)), bye: onBye(M, p, w) })) };
  }).filter((x) => f3(x)).sort((a, b) => b.lift - a.lift).slice(0, 5);
  function f3(x) { return x.form > 0 && x.lift >= 3 && (x.own || 0) < 60; }
  for (const r of rows) r.starts = cols.filter((c) => c.lineup.some((x) => x.pid === r.pid)).length;
  return { weeks, rows, cols, stash, bracket: (M.brackets || {})[teamId] || null, race: raceOf(M, teamId) };
}
