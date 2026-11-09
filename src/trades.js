/**
 * Trade offers from ESPN's linked records (docket A2, A8; plan D9).
 *
 * ESPN records one offer as several transactions pointing back at it with `relatedTransactionId`:
 *   - the TRADE_PROPOSAL itself (it stays PENDING even after the deal goes through);
 *   - a TRADE_ACCEPT with status null once the other side accepts (the league's review window; it carries the drops
 *     the receiving side makes to fit the players in), then a TRADE_UPHOLD and an EXECUTED TRADE_ACCEPT;
 *   - or a TRADE_DECLINE, or a CANCELED copy of the proposal naming the member (or the processing task) that ended it.
 * When one offer is accepted ESPN cancels the competing offers at the same instant (the same proposedDate as that
 * acceptance): those are Superseded, not turned down.
 *
 * One entry per offer, however many records sit behind it and whether or not another offer moved the same players
 * (A8). Plain functions of the raw records: League activity, the LLM export, Site API and the Postmortem all read it.
 */

export const OFFER_STATUSES = ['on_the_table', 'pending_approval', 'completed', 'expired', 'rejected', 'withdrawn', 'superseded'];
const EXPIRY_GRACE_MS = 60 * 1000;
const isGuid = (m) => /^\{?[0-9A-F]{8}-/i.test(String(m || ''));
const up = (s) => String(s || '').toUpperCase();

/** memberId -> teamId, from league_teams' owners. */
export function membersOf(teamsDoc) {
  const out = {};
  for (const t of (teamsDoc && teamsDoc.teams) || []) for (const m of t.owners || []) out[String(m)] = t.id;
  return out;
}

/** Every record that belongs to an offer rather than being one: accepts, upholds, declines and cancellation copies. */
export function isOfferRecord(tx) {
  const type = up(tx && tx.type);
  return type.startsWith('TRADE');
}

/**
 * Every trade offer in the records, newest first.
 * opts: { members: {memberId: teamId}, now }
 * Each offer: { id, status, proposer, teams: [teamIds], sends: {teamId: [playerId]}, drops: [{pid, team}],
 *   offeredAt, executedAt, decidedAt, expiresAt, period }
 */
export function offersOf(raw, opts = {}) {
  const members = opts.members || {};
  const now = opts.now ?? Date.now();
  const tx = (raw || []).filter(Boolean);
  const kids = new Map();
  for (const x of tx) if (x.relatedTransactionId) {
    if (!kids.has(x.relatedTransactionId)) kids.set(x.relatedTransactionId, []);
    kids.get(x.relatedTransactionId).push(x);
  }
  const acceptAt = new Set(tx.filter((x) => up(x.type) === 'TRADE_ACCEPT' && x.proposedDate != null).map((x) => x.proposedDate));
  const out = [];
  const seenAccept = new Set();
  const offer = (p, rel) => {
    const acc = rel.filter((r) => up(r.type) === 'TRADE_ACCEPT');
    for (const a of acc) seenAccept.add(a.id);
    const done = acc.find((a) => up(a.status) === 'EXECUTED') || (up(p.status) === 'EXECUTED' ? p : null);
    const cancel = rel.find((r) => up(r.type) === 'TRADE_PROPOSAL' && ['CANCELED', 'CANCELLED'].includes(up(r.status)));
    const decline = rel.find((r) => up(r.type) === 'TRADE_DECLINE');
    let status, decidedAt = null;
    if (done) { status = 'completed'; decidedAt = done.processDate || done.proposedDate || null; }
    else if (acc.length) status = 'pending_approval';
    else if (cancel) {
      const m = cancel.memberId, by = members[String(m)];
      const at = cancel.proposedDate || cancel.processDate || 0;
      decidedAt = at || null;
      if (acceptAt.has(cancel.proposedDate) && by !== p.teamId) status = 'superseded';
      else if (!isGuid(m) || (p.expirationDate && at >= p.expirationDate - EXPIRY_GRACE_MS)) status = 'expired';
      else if (by === p.teamId) status = 'withdrawn';
      else status = 'rejected';
    } else if (decline) { status = 'rejected'; decidedAt = decline.proposedDate || decline.processDate || null; }
    else if (['CANCELED', 'CANCELLED'].includes(up(p.status))) status = p.expirationDate && p.expirationDate <= now ? 'expired' : 'rejected';
    else if (p.expirationDate && p.expirationDate <= now) status = 'expired';
    else {
      // Older records may carry the answer only as teamActions: every side has acted, so it waits out the review.
      const acted = Object.keys(p.teamActions || {}).map(Number);
      const sides = new Set();
      for (const i of p.items || []) for (const t of [i.fromTeamId, i.toTeamId]) if (t != null) sides.add(t);
      status = sides.size > 0 && [...sides].every((t) => acted.includes(t)) ? 'pending_approval' : 'on_the_table';
    }
    const items = (p.items || []).filter((i) => up(i.type) === 'TRADE');
    const teams = [];
    for (const i of items) for (const t of [i.fromTeamId, i.toTeamId]) if (t != null && !teams.includes(t)) teams.push(t);
    if (teams.length < 2) return;
    // The proposer first, then the others in the order the offer names them.
    const proposer = teams.includes(p.teamId) ? p.teamId : teams[0];
    const ordered = [proposer, ...teams.filter((t) => t !== proposer)];
    const sends = {};
    for (const t of ordered) sends[t] = items.filter((i) => i.fromTeamId === t).map((i) => i.playerId);
    const dropKeys = new Set(), drops = [];
    if (done) for (const a of acc) for (const i of a.items || []) {
      if (up(i.type) !== 'DROP') continue;
      const k = `${i.playerId}:${i.fromTeamId}`;
      if (!dropKeys.has(k)) { dropKeys.add(k); drops.push({ pid: i.playerId, team: i.fromTeamId }); }
    }
    out.push({ id: p.id, status, proposer, teams: ordered, sends, drops,
      offeredAt: p.proposedDate ?? null, executedAt: done ? (done.processDate || done.proposedDate || null) : null,
      decidedAt, expiresAt: p.expirationDate ?? null, period: p.scoringPeriodId ?? null });
  };
  for (const p of tx) {
    if (up(p.type) !== 'TRADE_PROPOSAL' || p.relatedTransactionId) continue;
    offer(p, kids.get(p.id) || []);
  }
  // An executed acceptance whose proposal is not in the records (outside the periods read) is still a completed deal.
  for (const a of tx) {
    if (up(a.type) !== 'TRADE_ACCEPT' || up(a.status) !== 'EXECUTED' || seenAccept.has(a.id)) continue;
    if (a.relatedTransactionId && tx.some((x) => x.id === a.relatedTransactionId)) continue;
    offer({ ...a, type: 'TRADE_PROPOSAL', status: 'EXECUTED', teamId: a.teamId }, [a]);
  }
  return out.sort((x, y) => (y.offeredAt || 0) - (x.offeredAt || 0));
}

/** A waiver claim (or a free-agent move) that did not go through: ESPN marks it FAILED_<reason>. */
export const isLostClaim = (tx) => !up(tx && tx.type).startsWith('TRADE') && up(tx && tx.status).startsWith('FAILED');
