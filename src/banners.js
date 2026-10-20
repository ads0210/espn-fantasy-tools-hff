// Week 6 (plan N6, PD23, PD35, PD36): the home page matchup card's banner. One at a time, by a fixed priority, drawn
// as a ribbon with a one-line reason (the reason line is dropped below 390 px). Fortune Teller's banners read a small
// finding stored at build time (app/fortune-teller/findings.js), never computed on a request. A plain module, tested
// by behaviour; the board payload carries what it returns and the dashboard client draws it.

export const BANNERS = {
  championship: { label: 'Championship', tone: 'gold', glyph: 'trophy' },
  third: { label: 'Third Place Game', tone: 'bronze', glyph: 'medal' },
  semi: { label: 'Playoff Semifinal', tone: 'silver', glyph: 'bracket' },
  quarter: { label: 'Playoff Quarterfinal', tone: 'silver', glyph: 'bracket' },
  consolation: { label: 'Consolation', tone: 'muted', glyph: 'ladder' },
  mustWin: { label: 'Must Win', tone: 'flag', glyph: 'alert' },
  winIn: { label: "Win and You're In", tone: 'accent', glyph: 'check' },
  critical: { label: 'Most Critical Remaining Matchup', tone: 'violet', glyph: 'target' },
  top: { label: 'Top of the Table', tone: 'goldsoft', glyph: 'crown' },
};
// Postseason first (it describes the game itself), then Must Win before Win and You're In (a loss ends the
// season), then the most critical game, then Top of the Table.
export const PRIORITY = ['championship', 'third', 'semi', 'quarter', 'consolation', 'mustWin', 'winIn', 'critical', 'top'];

const pctWords = (v) => `${Math.round(v * 1000) / 10}%`;

// facts: {
//   round: 'championship' | 'third' | 'semi' | 'quarter' | 'consolation' | null   (from the schedule's bracket)
//   ft: { mustWin, winIn, critical: { withWin, withLoss } | null } | null       (Fortune Teller's stored finding)
//   top: boolean                                                                  (1st plays 2nd, regular season)
// }
export function applicable(facts) {
  const out = [];
  if (facts.round) out.push(facts.round);
  if (!facts.round && facts.ft) {
    if (facts.ft.mustWin) out.push('mustWin');
    if (facts.ft.winIn) out.push('winIn');
    if (facts.ft.critical) out.push('critical');
  }
  if (!facts.round && facts.top) out.push('top');
  return PRIORITY.filter((k) => out.includes(k));
}

export function reasonFor(key, facts) {
  switch (key) {
    case 'championship': return 'The final. The winner takes the league.';
    case 'third': return 'Both lost a semifinal; third place is still to play for.';
    case 'semi': return 'Win and you play for the Championship.';
    case 'quarter': return 'Win and you reach the semifinals.';
    case 'consolation': return 'Out of the playoffs; this game decides the final places.';
    case 'mustWin': return 'Fortune Teller: a loss ends your playoff hopes.';
    case 'winIn': return 'Fortune Teller: a win clinches a playoff place, whatever else happens.';
    case 'critical': {
      const c = facts.ft && facts.ft.critical;
      return c ? `Fortune Teller: no game you have left moves your playoff chances more (${pctWords(c.withWin)} with a win, ${pctWords(c.withLoss)} with a loss).`
        : 'Fortune Teller: no game you have left moves your playoff chances more.';
    }
    case 'top': return '1st plays 2nd in the standings.';
    default: return '';
  }
}

export function chooseBanner(facts) {
  const all = applicable(facts);
  if (!all.length) return null;
  const key = all[0];
  return { key, ...BANNERS[key], reason: reasonFor(key, facts), alsoApplies: all.slice(1) };
}

// Small line glyphs, drawn in currentColor.
export const GLYPHS = {
  trophy: '<path d="M7 4h10v4a5 5 0 0 1-10 0z M7 6H4a3 3 0 0 0 3 4 M17 6h3a3 3 0 0 1-3 4 M12 13v4 M8 20h8 M9 17h6"/>',
  medal: '<circle cx="12" cy="15" r="5"/><path d="M9 3l3 7 3-7 M12 13v4"/>',
  bracket: '<path d="M3 5h6v6H3 M3 13h6v6H3 M9 8h4v8H9 M13 12h8"/>',
  ladder: '<path d="M7 3v18 M17 3v18 M7 7h10 M7 12h10 M7 17h10"/>',
  alert: '<path d="M12 3l10 18H2z M12 10v5 M12 18v.5"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  crown: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>',
};
export const glyphSvg = (g) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${GLYPHS[g] || ''}</svg>`;

/**
 * The facts for one card: the game's bracket round, Fortune Teller's finding for the reader's team when it is about
 * this week's game, and whether 1st plays 2nd in the regular season.
 */
export function cardFacts({ round = null, finding = null, week = null, myRank = null, oppRank = null, started = false } = {}) {
  const f = finding && (finding.week == null || week == null || Number(finding.week) === Number(week)) ? finding : null;
  return {
    round: round || null,
    ft: f ? { mustWin: Boolean(f.mustWin), winIn: Boolean(f.winIn), critical: f.critical ? { withWin: f.win, withLoss: f.loss } : null } : null,
    top: !round && Boolean(started) && ((myRank === 1 && oppRank === 2) || (myRank === 2 && oppRank === 1)),
  };
}

/** What the board payload sends: the chosen banner with its glyph drawn, or null. */
export function cardBanner(facts) {
  const b = chooseBanner(facts);
  return b ? { key: b.key, label: b.label, tone: b.tone, reason: b.reason, svg: glyphSvg(b.glyph) } : null;
}

export function bannerHtml(b, esc) {
  if (!b) return '';
  return `<div class="mbanner t-${b.tone}" data-banner="${b.key}"><div class="mbline"><span class="mbglyph">${glyphSvg(b.glyph)}</span>`
    + `<span class="mblabel">${esc(b.label)}</span></div><p class="mbreason">${esc(b.reason)}</p></div>`;
}
