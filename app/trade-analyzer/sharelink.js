/**
 * Share links.
 *
 * A plain module so the round trip can be tested by behaviour: the link the
 * copy button writes has to be the link the tool reads back. It did not, which
 * is how a shared builder link opened an empty builder — indistinguishable
 * from arriving at the tool from the home page.
 */

/** The link for a trade: a standing offer by its id, a built one by its parts. */
export function shareLinkFor(trade, origin = '') {
  const base = `${origin}/apps/trade-analyzer/`;
  if (trade && trade.source === 'pending' && trade.id) {
    return `${base}?offer=${encodeURIComponent(trade.id)}`;
  }
  const ids = (list) => (list || []).join('.');
  return `${base}?a=${trade.a}&b=${trade.b}&ao=${ids(trade.aOut)}&bo=${ids(trade.bOut)}`;
}

/**
 * The builder state a link describes, or null when it describes none.
 *
 * Every id is checked against the rosters as they stand now, so a link shared
 * before somebody was traded away opens with whoever is still on the roster
 * rather than inventing a player.
 */
export function parseSharedBuild(search, teamById) {
  const params = new URLSearchParams(search || '');
  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const a = num(params.get('a'));
  const b = num(params.get('b'));
  if (!a || !b || a === b) return null;
  const ta = teamById(a);
  const tb = teamById(b);
  if (!ta || !tb) return null;
  const onRoster = (team, raw) => String(raw || '').split('.').map(num)
    .filter((id) => id && (team.roster || []).some((p) => p.id === id));
  return { a, b, aOut: onRoster(ta, params.get('ao')), bOut: onRoster(tb, params.get('bo')) };
}

/** The standing offer a link points at, if it points at one. */
export function parseSharedOffer(search) {
  return new URLSearchParams(search || '').get('offer') || null;
}
