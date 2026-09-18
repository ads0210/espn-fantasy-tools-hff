/**
 * The per-reader part of the export.
 *
 * The team selection is a browser cookie, so the league-wide document is one
 * cacheable digest and this is applied in the browser. Nothing here fetches.
 */

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function applyMyTeam(doc, teamId) {
  const team = teamId != null ? doc.teams.find((t) => t.teamId === teamId) : null;
  const out = {};
  for (const key of Object.keys(doc)) {
    if (key === 'myTeam') {
      out.myTeam = team ? myTeamBlock(doc, team) : null;
    } else if (key === 'teams') {
      // Flag the reader's team where the rosters are, not only at the top.
      out.teams = doc.teams.map((t) => {
        if (!team || t.teamId !== team.teamId) return t;
        const { teamId: id, name, ...rest } = t;
        return { teamId: id, name, isMyTeam: true, ...rest };
      });
    } else {
      out[key] = doc[key];
    }
  }
  return out;
}

function myTeamBlock(doc, team) {
  const id = team.teamId;
  const game = (doc.thisWeek.matchups || []).find((m) =>
    (m.home && m.home.teamId === id) || (m.away && m.away.teamId === id));
  const opp = game ? (game.home.teamId === id ? game.away : game.home) : null;
  const me = game ? (game.home.teamId === id ? game.home : game.away) : null;
  const row = doc.standings.find((s) => s.teamId === id);
  const block = {
    teamId: id,
    team: team.name,
  };
  if (row) {
    block.standing = `${ordinal(row.rank)} of ${doc.standings.length}`;
    block.record = row.record;
    if (row.playoffOdds) block.playoffOdds = row.playoffOdds;
  }
  if (opp) {
    block.thisWeek = {
      opponentTeamId: opp.teamId,
      opponent: opp.team,
      projected: `${me.projected ?? '?'} to ${opp.projected ?? '?'}`,
      winProbability: me.winProbability,
    };
  }
  block.note = 'This is the reader\'s own team. Give advice from this team\'s point of view.';
  return block;
}
