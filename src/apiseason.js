/**
 * Site API and the LLM export: Season Statistics' stored figures (src/seasonstep.js) as data.
 *
 * One shaping for both, so they can never disagree with the page. Settled figures only (plan D33): the live
 * overlay never reaches either. Team names come from the period's own index; owner names never appear.
 */

const r2 = (x) => (x == null || !Number.isFinite(Number(x)) ? null : Math.round(Number(x) * 100 + 1e-9) / 100);
const r4 = (x) => (x == null || !Number.isFinite(Number(x)) ? null : Math.round(Number(x) * 10000 + 1e-9) / 10000);

/** The fields a /standings row gains (plan D15): additive, so existing scripts keep working. */
export function seasonExtras(row) {
  if (!row) return { allPlay: null, luck: null, power: null };
  const ap = row.allPlay;
  return {
    allPlay: ap ? { wins: ap.w, losses: ap.l, ties: ap.t || 0 } : null,
    luck: r2(row.luck),
    power: row.power == null ? null : Math.round(Number(row.power) * 10 + 1e-9) / 10,
  };
}

/** One period's standings, in /standings' own field names plus the three new ones. */
export function seasonStandings(part, names) {
  return ((part && part.standings) || []).slice().sort((a, b) => a.seed - b.seed).map((s) => ({
    seed: s.seed, teamId: s.team, team: names[s.team] || null, wins: s.w, losses: s.l, ties: s.t || 0,
    winPct: r4(s.winPct), pointsFor: r2(s.pf), pointsAgainst: r2(s.pa), pointsPerWeek: r2(s.ppg),
    streak: s.streak ? `${s.streak.type}${s.streak.n}` : null,
    playoffOdds: s.playoffPct == null ? null : r4(s.playoffPct),
    ...seasonExtras(s),
  }));
}

const VALUE_ROUND = { pts: r2, diff: r2, diff1: r2, pct: r4, rec: r4, power: (x) => (x == null ? null : Math.round(x * 10) / 10) };
const valueOf = (rec, e) => (VALUE_ROUND[rec.unit] ? VALUE_ROUND[rec.unit](e.value) : (Number.isFinite(e.value) ? r4(e.value) : e.value));
const COUNTS = new Set(['n', 'wks', 'teams']);

/** Every holder of a record: everyone level with the first; none when it is empty or a count still at zero. */
function holdersOf(rec) {
  if (rec.empty || !rec.entries || !rec.entries.length) return [];
  const top = rec.entries[0].value;
  if (COUNTS.has(rec.unit) && top === 0 && rec.better !== 'low') return [];
  return rec.entries.filter((e) => e.value === top);
}

/** One record as data: its stable id, its words, its value and every holder. */
export function seasonRecord(rec, names) {
  const hs = holdersOf(rec);
  const holder = (e) => {
    const base = { value: valueOf(rec, e), text: e.text || null, week: e.week || null, weeks: e.span ? [e.span[0], e.span[1]] : null };
    if (rec.kind === 'player') {
      return { ...base, player: e.player ? e.player.name : null, position: e.player ? e.player.pos : null,
        teamId: e.team || null, team: e.team ? names[e.team] || null : null, freeAgent: !e.team, against: Boolean(e.against), detail: e.sub || null };
    }
    if (rec.kind === 'match' || rec.kind === 'pair') {
      // The winner (or the side ahead) is named first; a tie, or a pair with no side ahead, has no winner.
      const won = e.teams && e.teams.length === 1 && e.teams[0] === e.vs[0];
      return { ...base, teamId: e.vs[0], team: names[e.vs[0]] || null, opponentTeamId: e.vs[1], opponent: names[e.vs[1]] || null,
        winnerTeamId: won ? e.vs[0] : null };
    }
    if (rec.unit === 'net') return { ...base, teamId: e.teams[0], team: names[e.teams[0]] || null, good: e.good, bad: e.bad };
    return { ...base, teamId: e.teams[0], team: names[e.teams[0]] || null, detail: e.sub || null };
  };
  // A record set by several teams together (a tie in one entry) lists each.
  const holders = [];
  for (const e of hs) {
    if (rec.kind !== 'player' && rec.kind !== 'match' && rec.kind !== 'pair' && e.teams && e.teams.length > 1) {
      for (const id of e.teams) holders.push({ ...holder({ ...e, teams: [id] }) });
    } else holders.push(holder(e));
  }
  return {
    id: rec.id, section: rec.sec, record: rec.title, about: rec.info || null, unit: rec.unit,
    kind: rec.kind === 'player' ? 'player' : rec.kind === 'match' || rec.kind === 'pair' ? 'matchup' : 'team',
    headline: Boolean(rec.headline), good: rec.tone > 0 ? true : rec.tone < 0 ? false : null,
    recordedFromWeek: rec.since || null,
    holders,
    empty: holders.length ? null : ((rec.empty && rec.empty.note) || 'No holder yet.'),
  };
}

/** One period as Site API's /season and the LLM export carry it. */
export function seasonPeriod(part, index) {
  const names = Object.fromEntries(Object.entries((index && index.teams) || {}).map(([id, t]) => [id, t.name]));
  return {
    period: part && part.period ? { key: part.period.key, label: part.period.label, weeks: part.period.weeks } : null,
    builtAt: (part && part.builtAt) || null,
    standings: seasonStandings(part, names),
    records: ((part && part.records) || []).map((r) => seasonRecord(r, names)),
  };
}

/** The records table as CSV rows (plan D15): one row per holder; a record with none still has its row. */
export function seasonRecordRows(period) {
  const rows = [];
  for (const r of (period && period.records) || []) {
    const base = { id: r.id, section: r.section, record: r.record };
    if (!r.holders.length) { rows.push({ ...base, holder: null, team: null, opponent: null, value: null, week: null }); continue; }
    for (const h of r.holders) {
      rows.push({ ...base, holder: h.player ? `${h.player} (${h.position})` : h.team, team: h.player ? (h.freeAgent ? 'Free agent' : h.team) : h.team,
        opponent: h.opponent || null, value: h.text || h.value, week: h.weeks ? `${h.weeks[0]}-${h.weeks[1]}` : h.week });
    }
  }
  return rows;
}

/** The period keys the API answers for, from the index, in order. */
export function seasonPeriodKeys(index) {
  return ((index && index.periods) || []).map((p) => p.key);
}
