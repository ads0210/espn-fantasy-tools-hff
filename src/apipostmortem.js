/**
 * Site API and the LLM export: Trade Analyzer's Postmortem (src/postmortemstep.js) as data (Week 10 plan, D11).
 *
 * One shaping for both, so they never disagree with the page. Team names are today's (G8); no owner name, member id or
 * pending offer appears (a postmortem exists only for a decided offer).
 */
const r2 = (x) => (x == null || !Number.isFinite(Number(x)) ? null : Math.round(Number(x) * 100 + 1e-9) / 100);
const iso = (ms) => (ms ? new Date(ms).toISOString() : null);

/** Every decided offer of one stored season, newest first. `names`: { teamId: today's name } (falls back to the season's). */
export function postmortemData(doc, names = {}) {
  if (!doc || !Array.isArray(doc.offers)) return [];
  const then = Object.fromEntries((doc.teams || []).map((t) => [t.id, t.name]));
  const nm = (id) => (id == null ? null : names[id] || then[id] || `Team ${id}`);
  const pl = (pid) => { const p = (doc.players || {})[pid] || {}; return { playerId: pid, player: p.n || null, position: p.pos || null }; };
  const grade = (g) => (g ? { band: g.key, label: g.label, favorsTeamId: g.favors ?? null, favorsTeam: nm(g.favors), gapPerWeek: r2(Math.abs(g.gapPerWeek || 0)) } : null);
  return doc.offers.map((o) => ({
    id: String(o.id), season: doc.season, status: o.status, offeredAt: iso(o.offeredAt), effectiveAt: iso(o.effectiveAt), effectiveWeek: o.effWeek ?? null,
    proposerTeamId: o.proposer, proposerTeam: nm(o.proposer),
    sides: o.sides.map((s) => {
      const im = (o.impact || {})[s.team] || {};
      return { teamId: s.team, team: nm(s.team), sends: s.sends.map(pl),
        lineupImpactToDate: r2(im.toDate), stillToPlay: r2(im.stillToPlay), lineupImpactTotal: r2(im.total), espnExpected: r2(im.expected),
        pointsReceived: r2(im.received), startedPoints: im.started == null ? null : r2(im.started), weeksCounted: im.weeks || 0, weeksPlayed: im.weeksPlayed || 0,
        byWeek: (im.rows || []).map((r) => ({ week: r.w, impact: r2(r.impact), future: Boolean(r.future) })) };
    }),
    droppedToMakeRoom: (o.drops || []).map((d) => ({ ...pl(d.pid), teamId: d.team, team: nm(d.team) })),
    grade: o.note ? null : grade(o.grade),
    espnExpectedGrade: o.note ? null : grade(o.expectedGrade),
    tradeAnalyzerVerdict: o.verdict ? { band: o.verdict.key, label: o.verdict.label, favorsTeamId: o.verdict.favors ?? null, favorsTeam: nm(o.verdict.favors) } : null,
    note: o.note === 'changesNothing' ? 'Changes nothing: these players moved anyway' : o.note === 'tooLate' ? 'Too late in the season to change a lineup' : null,
  }));
}

/** A row per offer and side, for CSV and the sheet job. */
export function postmortemCsvRows(list) {
  const rows = [];
  for (const o of list || []) for (const s of o.sides) {
    rows.push({ id: o.id, season: o.season, status: o.status, offeredAt: o.offeredAt, team: s.team, sends: s.sends.map((p) => p.player).join('; '),
      lineupImpactToDate: s.lineupImpactToDate, stillToPlay: s.stillToPlay, espnExpected: s.espnExpected, pointsReceived: s.pointsReceived,
      grade: o.grade ? o.grade.label : o.note, favors: o.grade ? o.grade.favorsTeam : null, gapPerWeek: o.grade ? o.grade.gapPerWeek : null,
      tradeAnalyzer: o.tradeAnalyzerVerdict ? `${o.tradeAnalyzerVerdict.label}${o.tradeAnalyzerVerdict.favorsTeam ? ` ${o.tradeAnalyzerVerdict.favorsTeam}` : ''}` : null });
  }
  return rows;
}

/** The LLM export's form: a sentence or two per offer, in plain words. */
export function postmortemForExport(list) {
  return (list || []).map((o) => {
    const [a, b] = o.sides;
    const sg = (x) => (x > 0 ? `+${x.toFixed(2)}` : x < 0 ? x.toFixed(2) : '0.00');
    const verb = o.status === 'completed' ? 'sent' : 'would have sent';
    const side = (s) => `${s.team} ${verb} ${s.sends.map((p) => `${p.player} (${p.position})`).join(', ') || 'nothing'}: lineup impact ${sg(s.lineupImpactToDate || 0)} to date${s.weeksCounted > s.weeksPlayed ? `, ${sg(s.stillToPlay || 0)} still to play` : ''}`;
    return { season: o.season, status: o.status === 'rejected' ? 'turned down' : o.status, offered: o.offeredAt ? o.offeredAt.slice(0, 10) : null,
      deal: `${side(a)}; ${side(b)}.`,
      outcome: o.note || (o.grade ? `${o.grade.label}${o.grade.favorsTeam ? ` ${o.grade.favorsTeam}` : ''} (${o.grade.gapPerWeek.toFixed(2)} points a week)` : null),
      espnExpected: o.espnExpectedGrade ? `${o.espnExpectedGrade.label}${o.espnExpectedGrade.favorsTeam ? ` ${o.espnExpectedGrade.favorsTeam}` : ''}` : null,
      ...(o.tradeAnalyzerVerdict ? { tradeAnalyzerSaid: `${o.tradeAnalyzerVerdict.label}${o.tradeAnalyzerVerdict.favorsTeam ? ` ${o.tradeAnalyzerVerdict.favorsTeam}` : ''}` } : {}),
      ...(o.droppedToMakeRoom.length ? { droppedToMakeRoom: o.droppedToMakeRoom.map((p) => `${p.player} (${p.team})`).join(', ') } : {}) };
  });
}
