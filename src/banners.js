// Week 6 (plan N6, PD23, PD35, PD36): the home page matchup card's banner. One at a time, by a fixed priority, drawn
// as a ribbon with a one-line reason (the reason line is dropped below 390 px). Fortune Teller's banners read a small
// finding stored at build time (app/fortune-teller/findings.js), never computed on a request. A plain module, tested
// by behaviour; the board payload carries what it returns and the dashboard client draws it.

import { afterName } from './insights.js';

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
/* Matchup Insights' categories (D40): a banner from a row with no glyph of its own takes its category's. */
Object.assign(GLYPHS, {
  stakes: '<path d="M12 3l9 9-9 9-9-9z M12 8v5 M12 16v.5"/>',
  race: '<path d="M5 21V4 M5 4h11l-2 3.5 2 3.5H5"/>',
  rivalry: '<path d="M4 4l9 9 M20 4l-9 9 M7 15l-3 3 2 2 3-3 M17 15l3 3-2 2-3-3"/>',
  form: '<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-8.5z"/>',
  players: '<path d="M8 3l-4 3 2 4 2-1v12h8V9l2 1 2-4-4-3c-1 1.5-2.5 2-4 2s-3-.5-4-2z"/>',
  avail: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 8v8 M8 12h8"/>',
  records: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  proj: '<path d="M3 20h18 M5 16l4-5 4 3 6-8 M15 6h4v4"/>',
  live: '<path d="M3 12h4l2-6 4 12 2-6h6"/>',
  moves: '<path d="M4 8h14l-3-3 M20 16H6l3 3"/>',
  after: '<path d="M5 21V4 M5 4h14v9H5 M9 4v9 M13 4v9 M5 8.5h14"/>',
});
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

/** A Matchup Insights row's words, with team names put in (the row carries ids, never names). */
export function rowText(parts, names) {
  return (parts || []).map((p, i) => (typeof p === 'string' ? afterName(i && parts[i - 1] && parts[i - 1].t != null ? names[parts[i - 1].t] : '', p) : p && p.t != null ? names[p.t] || 'a team' : p && (p.v ?? p.p) != null ? String(p.v ?? p.p) : p && p.d != null ? String(p.d).slice(0, 10) : '')).join('');
}

/* The banner's words without the label its title already shows ("Comeback on: X was down…" under "Comeback on"). */
export function withoutLabel(text, label) {
  const head = `${label}: `;
  if (!label || !text.startsWith(head)) return text;
  const rest = text.slice(head.length);
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

/**
 * The home card's banner from Matchup Insights' stored banners (D30): the postseason game keeps today's label, words
 * and medal tone (D36); any other banner takes its row's label, its words and its category's colour (tone
 * 'cat-<category>'). Null when the stored banners are for another week or the team has none.
 */
export function insightBanner(stored, teamId, week, names = {}) {
  if (!stored || !stored.byTeam || (week != null && Number(stored.week) !== Number(week))) return null;
  const b = stored.byTeam[teamId];
  if (!b) return null;
  if (b.tier === 1) {
    const key = { championship: 'championship', third: 'third', semi: 'semi', quarter: 'quarter', consolation: 'consolation' }[Object.keys(BANNERS).find((k) => BANNERS[k].label === b.label)] || 'consolation';
    return { key, label: BANNERS[key].label, tone: BANNERS[key].tone, reason: reasonFor(key, {}), svg: glyphSvg(BANNERS[key].glyph) };
  }
  const row = b.row || {};
  return { key: `mi-${row.type || 'row'}`, label: b.label, tone: `cat-${row.cat || b.tone}`, reason: withoutLabel(rowText(row.parts, names), b.label), svg: glyphSvg(GLYPHS[b.glyph] ? b.glyph : row.cat) };
}

export function bannerHtml(b, esc) {
  if (!b) return '';
  return `<div class="mbanner t-${b.tone}" data-banner="${b.key}"><div class="mbline"><span class="mbglyph">${glyphSvg(b.glyph)}</span>`
    + `<span class="mblabel">${esc(b.label)}</span></div><p class="mbreason">${esc(b.reason)}</p></div>`;
}
