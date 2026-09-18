/**
 * The compact export.
 *
 * A pure transform of the full document, applied in the browser, so there is
 * one digest and the two versions can never disagree about a fact. Compact
 * keeps everything a weekly decision needs and drops depth: week-by-week
 * points, ownership trends, older transactions, the rest of the NFL calendar
 * and league history.
 */

export const COMPACT_FREE_AGENT_DEPTH = { QB: 5, RB: 8, WR: 8, TE: 5, 'D/ST': 5, K: 5 };

const PLAYER_KEEP = ['name', 'pos', 'nflTeam', 'slot', 'injury', 'bye', 'thisWeek',
  'seasonAvg', 'posRank', 'rosProj', 'seasonProj', 'availability'];

function slimPlayer(p) {
  const out = {};
  for (const k of PLAYER_KEEP) {
    if (p[k] === undefined) continue;
    if (k === 'thisWeek') {
      const { kickoff, ...rest } = p.thisWeek;
      out.thisWeek = rest;
    } else out[k] = p[k];
  }
  return out;
}

export function compactExport(doc) {
  const week = doc.about.currentWeek;
  const out = {};
  for (const key of Object.keys(doc)) {
    const v = doc[key];
    switch (key) {
      case 'about':
        out.about = {
          ...v,
          version: 'compact',
          conventions: [...v.conventions,
            'This is the compact export. It leaves out week-by-week points, ownership, '
            + 'injury notes, completed fantasy results, older transactions, most of the NFL '
            + 'schedule and league history. Ask for the full export if a question needs them.'],
        };
        break;
      case 'league': {
        const { draft, ...rest } = v;
        out.league = rest;
        break;
      }
      case 'teams':
        out.teams = v.map(({ seasonMoves, roster, ...t }) => ({ ...t, roster: roster.map(slimPlayer) }));
        break;
      case 'schedule':
        out.schedule = v.filter((m) => m.week >= week)
          .map(({ result, ...m }) => ({ ...m, home: dropPoints(m.home), away: dropPoints(m.away) }));
        break;
      case 'freeAgents': {
        const seen = {};
        out.freeAgents = {
          note: 'A short shortlist: the best available at each position by ESPN rest-of-season '
            + 'projection (8 each at RB and WR, 5 each at QB, TE, D/ST and K).',
          players: v.players.filter((p) => {
            seen[p.pos] = (seen[p.pos] || 0) + 1;
            return seen[p.pos] <= (COMPACT_FREE_AGENT_DEPTH[p.pos] || 0);
          }).map(slimPlayer),
        };
        break;
      }
      case 'transactions':
        // This week and last week only.
        out.transactions = v.filter((t) => t.week >= week - 1);
        break;
      case 'nfl':
        out.nfl = {
          teams: v.teams.map(({ team, record, bye }) => ({ team, record, bye })),
          schedule: Object.fromEntries(Object.entries(v.schedule)
            .filter(([k]) => { const n = Number(k.replace(/\D/g, '')); return n === week || n === week + 1; })),
          pointsAllowedByPosition: Object.fromEntries(Object.entries(v.pointsAllowedByPosition)
            .map(([pos, teams]) => [pos, Object.fromEntries(
              Object.entries(teams).map(([t, r]) => [t, r.rank]))])),
        };
        break;
      case 'history':
        break;
      default:
        out[key] = v;
    }
  }
  return out;
}

function dropPoints(side) {
  if (!side) return side;
  const { points, ...rest } = side;
  return rest;
}
