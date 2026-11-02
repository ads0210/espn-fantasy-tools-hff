/**
 * Site API and the LLM export: Front Office's stored team pages (src/frontofficestep.js) as data.
 *
 * One shaping for both, so they can never disagree with the page. Rule keys are descriptive ('starterOut', 'hot');
 * no catalogue number from the plan reaches the data. Owner names never appear (the pages never carry them).
 */
const r2 = (x) => (x == null || !Number.isFinite(Number(x)) ? null : Math.round(Number(x) * 100 + 1e-9) / 100);
const SLOT = { 0: 'QB', 2: 'RB', 4: 'WR', 6: 'TE', 23: 'FLEX', 16: 'D/ST', 17: 'K', 20: 'Bench', 21: 'IR' };
const LEVEL = { red: 'act now', amber: 'look', info: 'note' };
export const FO_PICKUPS_IN_DATA = 10;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** A time in words, in UTC, for text read by a person or an assistant: Sun 1 Nov, 18:00 UTC. */
export function whenWords(iso) {
  const t = Date.parse(iso || '');
  if (!Number.isFinite(t)) return '';
  const d = new Date(t);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
}

function player(c, names) {
  const live = c.locked && c.live != null;
  return {
    playerId: c.pid, player: c.name, slot: SLOT[c.slot] || null, position: c.pos, nflTeam: c.nfl, injury: c.inj && c.inj !== 'ACTIVE' ? c.inj : null,
    projected: r2(c.proj), points: live ? r2(c.live) : null, locked: Boolean(c.locked), gameState: c.bye ? 'bye' : c.state || null,
    opponent: c.bye ? null : c.opp || null, home: c.bye ? null : c.home ?? null, kickoff: c.kickoff || null, defenceRank: c.rank || null,
    notes: (c.notes || []).map((n) => ({ key: n.id, label: n.label, text: n.text, leaning: n.tag })),
    ...(c.alt ? { startInstead: { playerId: c.alt.b, player: (names[c.alt.b] || {}).name || null, gain: r2(c.alt.gain), why: c.alt.why === 'proj' ? 'projects higher' : 'a note makes him worth a look' } } : {}),
  };
}

/* Fortune Teller's race for the team (Weeks ahead): odds are fractions from 0 to 1, as everywhere in the API. */
function raceData(r, T) {
  if (!r) return null;
  const nm = (id) => (id != null && T[id] ? T[id].name : null);
  return { week: r.week, now: r.odds, withWin: r.win, withLoss: r.loss, winOut: r.winOut, opponentTeamId: r.oppId, opponentTeam: nm(r.oppId),
    biggestGame: r.critical ? { week: r.critical.week, opponentTeamId: r.critical.oppId, opponentTeam: nm(r.critical.oppId) } : null,
    rootFor: r.rootFor.map((x) => ({ teamId: x.forId, team: nm(x.forId), againstTeamId: x.againstId, againstTeam: nm(x.againstId), oddsGain: x.gain })) };
}

/** One team's page as data: this week's lineup and bench, the checklist, the top pickups, the weeks ahead. */
export function foTeamData(doc) {
  if (!doc || !doc.tw) return null;
  const tw = doc.tw, names = doc.players || {}, T = doc.teams || {};
  return {
    teamId: doc.team.id, team: doc.team.name, week: doc.week, builtAt: doc.builtAt || null,
    totals: { lineup: r2(tw.totals.lineup), best: r2(tw.totals.best), opponent: r2(tw.totals.opp), opponentTeamId: tw.oppId || null, opponentTeam: tw.oppId ? (T[tw.oppId] || {}).name || null : null },
    checklist: (tw.checklist || []).map((c) => ({ key: c.id, level: LEVEL[c.tone] || c.tone, text: c.at ? `${c.text} ${whenWords(c.at)}.` : c.text, ...(c.at ? { at: c.at } : {}) })),
    lineup: tw.starters.map((c) => player(c, names)),
    bench: [...tw.bench, ...tw.ir].map((c) => player(c, names)),
    lateSwap: tw.lateSwap ? { open: tw.lateSwap.open, nextLock: tw.lateSwap.nextLock } : null,
    pickups: ((doc.pk && doc.pk.list) || []).filter((x) => x.fit > 0).slice(0, FO_PICKUPS_IN_DATA).map((x) => ({
      playerId: x.pid, player: x.name, position: x.pos, nflTeam: x.nfl, status: x.status === 'WAIVERS' ? 'on waivers' : 'free agent', injury: x.inj && x.inj !== 'ACTIVE' ? x.inj : null,
      role: x.kind === 'bench' ? 'bench upgrade' : 'would start', fitPerWeek: r2(x.fit), benchGain: r2((x.gain && x.gain.bench) || 0), gainNext3: r2(x.gain.next), gainRestOfSeason: r2(x.gain.rest), gainPostseason: r2(x.gain.post),
      projectedThisWeek: r2(x.next), projectedRestOfSeason: r2(x.ros), owned: x.own, ownedChange: x.chg,
      drop: { playerId: x.drop.pid, player: x.drop.name, position: x.drop.pos, projectedRestOfSeason: r2(x.drop.ros) }, reasons: x.reasons,
    })),
    waiverPosition: (doc.pk && doc.pk.waiverRank) || null,
    weeksAhead: ((doc.wa && doc.wa.cols) || []).map((c) => ({
      week: c.w, postseason: Boolean(c.post), round: c.round || null, opponentTeamId: c.oppId || null, opponentTeam: c.oppId ? (T[c.oppId] || {}).name || null : null,
      bestLineup: r2(c.best), opponentBestLineup: r2(c.oppBest), missing: c.holes || [],
    })),
    race: raceData(doc.wa && doc.wa.race, T),
    stash: ((doc.wa && doc.wa.stash) || []).map((s) => ({ playerId: s.pid, player: s.name, position: s.pos, nflTeam: s.nfl, lastThreeAverage: r2(s.form), nextFourAverage: r2(s.ahead), postseasonAverage: r2(s.post), owned: s.own })),
  };
}

/** The CSV form: a row per player on the team's roster this week (lineup first, then bench and IR). */
export function foCsvRows(list) {
  const rows = [];
  for (const t of list || []) for (const p of [...t.lineup, ...t.bench]) rows.push({
    teamId: t.teamId, team: t.team, week: t.week, slot: p.slot, player: p.player, position: p.position, nflTeam: p.nflTeam, injury: p.injury,
    projected: p.projected, points: p.points, locked: p.locked, opponent: p.opponent, defenceRank: p.defenceRank,
    notes: p.notes.map((n) => n.label).join(' / '), startInstead: p.startInstead ? `${p.startInstead.player} (${p.startInstead.gain >= 0 ? '+' : ''}${p.startInstead.gain})` : null,
  });
  return rows;
}
