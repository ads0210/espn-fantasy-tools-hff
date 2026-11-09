// Records about the records (Week 10 plan, D27–D29): Records held and Prestige, one module for Season Statistics and
// Hall of Fame, so the two pages can never give two answers. Plain functions over a list of record panels.
//
//   rec: { id, title, tone (1 good, -1 bad, 0 neither), kind ('team'|'teamweek'|'match'|'pair'|'player'), unit,
//          better ('high'|'low'), entries: [{ teams, vs?, team?, value, season?, week?, text? }] best first }
//
// Records held (Season Statistics' rule, D63): +1 for each good record a team holds, -1 for each bad one, -1 to the
// team on the wrong end of a good matchup record. Prestige (round 2): the same idea down the whole top 10, weighted
// by rank: a good record's top ten earn 15, 12, 9, 7, 6, 5, 4, 3, 2, 1; a bad record's top ten lose as much; the team
// on the wrong end of a good matchup entry loses that entry's points. A team counts once per record, at its best
// place on a good record and its worst on a bad one. Records that are neither count nothing in either.

export const PRESTIGE = [15, 12, 9, 7, 6, 5, 4, 3, 2, 1];
const COUNT_UNITS = new Set(['n', 'wks', 'teams']);

/** Competition ranks over the entries as listed (best first): equal values share a place. */
export function ranked(rec) {
  const out = [];
  let place = 0, last;
  rec.entries.forEach((e, i) => {
    if (i === 0 || e.value !== last) { place = i + 1; last = e.value; }
    // A count still at zero ranks nothing (nobody has the most of something yet), unless fewest is the point.
    if (COUNT_UNITS.has(rec.unit) && e.value === 0 && rec.better !== 'low') return;
    out.push({ e, place });
  });
  return out;
}
const creditOf = (rec, e) => (rec.kind === 'player' ? (e.team ? [e.team] : []) : (e.teams || []));
const againstOf = (rec, e, credited) => (rec.tone > 0 && (rec.kind === 'match' || rec.kind === 'pair') && e.vs && e.vs[1] != null && !credited.includes(e.vs[1]) ? [e.vs[1]] : []);
const ref = (rec, e, place) => ({ rec: rec.id, title: rec.title, unit: rec.unit, value: e.value, text: e.text || null, season: e.season || null, week: e.week || null, place, player: e.player ? `${e.player.name} · ${e.player.pos}` : null });

/** Records held for every team: { teamId: { good:[ref], bad:[ref], against:[ref] } }. */
export function heldTally(recs, teamIds) {
  const t = Object.fromEntries(teamIds.map((id) => [id, { good: [], bad: [], against: [] }]));
  for (const rec of recs) {
    if (!rec.tone) continue;
    const top = ranked(rec).filter((x) => x.place === 1);
    // A team counts once per record, even when it holds the record twice over (two streaks of the same length).
    const seen = new Set(), seenAgainst = new Set();
    for (const { e } of top) {
      const cr = creditOf(rec, e);
      for (const id of cr) if (t[id] && !seen.has(id)) { seen.add(id); t[id][rec.tone > 0 ? 'good' : 'bad'].push(ref(rec, e, 1)); }
      for (const id of againstOf(rec, e, cr)) if (t[id] && !seenAgainst.has(id)) { seenAgainst.add(id); t[id].against.push(ref(rec, e, 1)); }
    }
  }
  return t;
}

/** Prestige for every team: { teamId: [{ ...ref, pts }] } — one line per record the team scores on. */
export function prestigeTally(recs, teamIds) {
  const t = Object.fromEntries(teamIds.map((id) => [id, new Map()]));
  for (const rec of recs) {
    if (!rec.tone) continue;
    for (const { e, place } of ranked(rec)) {
      if (place > PRESTIGE.length) continue;
      const pts = PRESTIGE[place - 1];
      const cr = creditOf(rec, e);
      const give = (id, p, side) => {
        if (!t[id]) return;
        // Best place on a good record, worst on a bad one: the first entry seen is it, because entries run best first
        // and a bad record's first entry is its worst. A team can be on both ends of a good matchup record (it won one
        // blowout and lost another): each end counts once.
        const key = `${rec.id}:${side === 'against' ? 'a' : 'c'}`;
        if (t[id].has(key)) return;
        t[id].set(key, { ...ref(rec, e, place), pts: p, side });
      };
      for (const id of cr) give(id, rec.tone > 0 ? pts : -pts, rec.tone > 0 ? 'good' : 'bad');
      for (const id of againstOf(rec, e, cr)) give(id, -pts, 'against');
    }
  }
  return Object.fromEntries(Object.entries(t).map(([id, m]) => [id, [...m.values()].sort((a, b) => b.pts - a.pts)]));
}

/** The four panels: Most / Least records held, Highest / Lowest prestige, every team listed, contributions attached. */
export function standingPanels(recs, teamIds, { idPrefix = '', ids = null, infoHeld, infoPrestige } = {}) {
  const id = (k) => (ids && ids[k]) || `${idPrefix}${k}`;
  const held = heldTally(recs, teamIds);
  const pre = prestigeTally(recs, teamIds);
  const net = (t) => held[t].good.length - held[t].bad.length - held[t].against.length;
  const heldEntry = (t) => ({ teams: [t], value: net(t), good: held[t].good.length, bad: held[t].bad.length + held[t].against.length, detail: { kind: 'held', ...held[t] } });
  const sum = (t) => pre[t].reduce((s, x) => s + x.pts, 0);
  const preEntry = (t) => ({ teams: [t], value: sum(t), detail: { kind: 'prestige', lines: pre[t] } });
  const counted = recs.filter((r) => r.tone).length;
  return [
    { id: id('held.most'), title: 'Most records held', unit: 'net', kind: 'team', tone: 0, standing: true, word: 'net, good minus bad', info: infoHeld(counted),
      entries: teamIds.map(heldEntry).sort((a, b) => b.value - a.value || b.good - a.good) },
    { id: id('held.least'), title: 'Least records held', unit: 'net', kind: 'team', tone: 0, better: 'low', standing: true, word: 'net, good minus bad', info: infoHeld(counted),
      entries: teamIds.map(heldEntry).sort((a, b) => a.value - b.value || b.bad - a.bad) },
    { id: id('prestige.high'), title: 'Highest prestige', unit: 'net', kind: 'team', tone: 0, standing: true, word: 'prestige points', info: infoPrestige(counted),
      entries: teamIds.map(preEntry).sort((a, b) => b.value - a.value) },
    { id: id('prestige.low'), title: 'Lowest prestige', unit: 'net', kind: 'team', tone: 0, better: 'low', standing: true, word: 'prestige points', info: infoPrestige(counted),
      entries: teamIds.map(preEntry).sort((a, b) => a.value - b.value) },
  ];
}
