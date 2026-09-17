/**
 * A glyph per tool, keyed by the tool's own key.
 *
 * Imported by the dashboard's tiles and by the setup wizard's picker, so a new
 * tool's icon cannot appear in one and be missing from the other.
 */
/**
 * One glyph per tool, shared by the dashboard tiles and the setup wizard's
 * tool picker. Exported rather than duplicated: a new tool's icon has to
 * appear in both places, and two copies is exactly the shape of the bug where
 * one of them silently keeps an older list.
 */
export const TOOL_ICONS = {
  // A draft board: a column of picks with the next slot marked. Deliberately
  // not a trophy, which belongs to standings and playoff tools.
  'draft-helper': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 8.5h18M3 14h18"/><path d="M8.5 3v18"/><path d="M12 11.2h5.5M12 16.8h4"/><circle cx="5.7" cy="11.2" r="1"/><circle cx="5.7" cy="16.8" r="1"/></svg>',
  // Two lineups facing each other across a live scoreline: the bracket on each
  // side is a team's stack of players, the pulse between them is the game being
  // played. Deliberately not a clock or a broadcast tower — the subject is the
  // matchup, not the fact that it is live.
  'live-matchups': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 4.2h-3v15.6h3"/><path d="M17.5 4.2h3v15.6h-3"/><path d="M2.2 12h2.4M19.4 12h2.4"/><path d="M8 12h1.6l1.1-3 1.9 6 1.2-3H16"/><circle cx="12" cy="20" r="1.05"/><circle cx="12" cy="4" r="1.05"/></svg>',
  // A trophy on its plinth, with handles and an engraved band. The record book
  // covers every team rather than only the winners, but the name on the tile
  // says Hall of Fame, and a glyph that argues with its own label just reads as
  // the wrong icon.
  'hall-of-fame': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7.4 3.2h9.2v5.4a4.6 4.6 0 0 1-9.2 0z"/><path d="M7.4 4.9H4.9v1.8a3.1 3.1 0 0 0 3.1 3.1"/><path d="M16.6 4.9h2.5v1.8a3.1 3.1 0 0 1-3.1 3.1"/><path d="M12 13.2v3.1"/><path d="M8.9 20.8h6.2l-.7-4.5H9.6z"/><path d="M6.6 20.8h10.8"/></svg>',
  // A beam across a fulcrum with a pan hanging either side, tipped slightly.
  // The subject is the judgement, not the transaction, so this is a balance
  // rather than two swapping arrows — and it is deliberately off level, because
  // a trade that is exactly even is the rare case rather than the usual one.
  'trade-analyzer': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4.4v15.2"/><path d="M8.8 20.4h6.4"/><path d="M4.6 9.3 19.4 6.5"/><path d="M4.6 9.3 2.2 14.2a2.7 2.7 0 0 0 4.8 0z"/><path d="M19.4 6.5 17 11.4a2.7 2.7 0 0 0 4.8 0z"/><circle cx="12" cy="4.4" r="1.05"/></svg>',
  'site-config': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h12"/><path d="M19 6h2"/><circle cx="17" cy="6" r="2"/><path d="M3 12h4"/><path d="M11 12h10"/><circle cx="9" cy="12" r="2"/><path d="M3 18h10"/><path d="M17 18h4"/><circle cx="15" cy="18" r="2"/></svg>',
  default: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
};
