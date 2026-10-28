/**
 * Site API and the LLM export: Matchup Insights' stored rows (src/insightstep.js) as data.
 *
 * One shaping for both, so they can never disagree with the page. Each row's words are written out with team names
 * put in; its team ids travel beside them. Owner names never appear (the rows never carry them).
 */
import { CATS, TYPES, BANNER_MIN, headlineOf, afterName } from './insights.js';

const WHEN = { pre: 'beforeKickoff', live: 'live', post: 'afterTheFinal' };
const r2 = (x) => (x == null || !Number.isFinite(Number(x)) ? null : Math.round(Number(x) * 100 + 1e-9) / 100);

/** A row's words, with team names put in. */
export function insightText(parts, names) {
  return (parts || []).map((p, i) => (typeof p === 'string' ? afterName(i && parts[i - 1] && parts[i - 1].t != null ? names[parts[i - 1].t] : '', p) : p && p.t != null ? names[p.t] || 'a team' : p && (p.v ?? p.p) != null ? String(p.v ?? p.p) : p && p.d != null ? String(p.d).slice(0, 10) : '')).join('');
}

/** One row as data. */
export function insightRow(r, names) {
  return {
    type: r.type, category: (CATS[r.cat] || {}).label || r.cat, label: r.label || (TYPES[r.type] || [])[1] || null,
    importance: r.weight, when: WHEN[r.when] || r.when, subject: r.about,
    teamIds: r.teams || [], teams: (r.teams || []).map((id) => names[id] || null),
    text: insightText(r.parts, names),
    prediction: Boolean(r.predict), outcome: r.outcome || null,
  };
}

/**
 * One week as Site API's /insights and the LLM export carry it: every game with its rows (heaviest first) and the
 * week's rows across the league. `live` is the week's Live rows document, laid over while it is current.
 */
export function insightWeek(doc, names, live = null) {
  if (!doc) return null;
  const order = (a, b) => b.weight - a.weight || (CATS[a.cat] || {}).order - (CATS[b.cat] || {}).order || Number(a.type.slice(1)) - Number(b.type.slice(1));
  const liveOn = Boolean(live && live.on && live.week === doc.week);
  return {
    week: doc.week, label: doc.label, current: doc.kind === 'current', builtAt: doc.builtAt || null,
    games: (doc.games || []).map((g) => {
      const rows = [...(g.rows || []), ...(liveOn && live.games && live.games[g.id] ? live.games[g.id] : [])].sort(order);
      const head = headlineOf(rows, g.state);
      return {
        gameId: g.id, homeTeamId: g.home, homeTeam: names[g.home] || null, awayTeamId: g.away, awayTeam: names[g.away] || null,
        state: g.state, homePoints: r2(g.hp), awayPoints: r2(g.ap), round: g.round || null,
        // The game's headline: its weightiest row for where the game stands (before, live, after the final; round 8).
        headline: head ? insightRow(head, names) : null,
        insights: rows.map((r) => insightRow(r, names)),
      };
    }),
    // The week's rows (at most six) and, after the final, one row for every record a game broke (round 8).
    acrossTheLeague: (() => {
      const all = [...(doc.league || []), ...(liveOn ? live.league || [] : [])].sort(order);
      const rec = (r) => r.type === 'I191' || r.type === 'I229';
      return [...all.filter((r) => !rec(r)).slice(0, 6), ...all.filter(rec)].sort(order).map((r) => insightRow(r, names));
    })(),
  };
}

/** The week as CSV rows: one row per insight, the week's own rows first. */
export function insightCsvRows(week) {
  if (!week) return [];
  const row = (g, r) => ({ week: week.week, gameId: g ? g.gameId : null, homeTeam: g ? g.homeTeam : null, awayTeam: g ? g.awayTeam : null,
    category: r.category, label: r.label, importance: r.importance, when: r.when, subject: r.subject, teams: r.teams.filter(Boolean).join(' & '), text: r.text, outcome: r.outcome });
  return [...week.acrossTheLeague.map((r) => row(null, r)), ...week.games.flatMap((g) => g.insights.map((r) => row(g, r)))];
}

/** The compact form for the LLM export: each game's headline and its rows of weight 7 or more (of 10), the week's own rows. */
export function insightWeekCompact(week) {
  if (!week) return null;
  return { ...week, games: week.games.map((g) => ({ ...g, insights: g.insights.filter((r) => r.importance >= BANNER_MIN || (g.headline && r.text === g.headline.text && r.type === g.headline.type)) })) };
}
