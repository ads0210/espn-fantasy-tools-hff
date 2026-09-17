/**
 * What changed in this version, shown once per browser after an update.
 *
 * Its own module because two places need it: the dashboard that shows it, and
 * the diagnostics preview that renders the dialog for inspection. When the
 * preview kept its own copy the two drifted, and the preview went on showing a
 * release that had already been superseded. A direct import between them would
 * be circular, so the list lives here and both read it.
 *
 * Bumped in the same edit as BUILD_MARKER: a version number that moved without
 * the notes moving is how a reader is told about the last release twice. An
 * empty list is a valid state \u2014 the popup then says only that the site was
 * updated, which is the honest thing to say about a build whose changes nobody
 * outside the repo would notice.
 */
export const RELEASE_NOTE_ITEMS = [
  'New tool: Trade Analyzer. Every offer on the table, broken down statistic by '
  + 'statistic for both sides, with a verdict on how balanced the deal is \u2014 '
  + 'and you can build your own between any two teams.',
  'Your matchup card now puts each team\u2019s score either side of the win-chance '
  + 'dial, so you can see where the week stands at a glance.',
  'A finished matchup shows as final, with the winning score and the margin, '
  + 'instead of looking like a game still in progress.',
  'Further rescaled Score Progression graphs on Live Matchups to increase '
  + 'readability.',
  'League activity reads as one entry per move: a waiver claim is a single row '
  + 'instead of an unrelated add and drop, and a trade is one row showing both '
  + 'teams, everyone involved, and whether it is on the table, accepted, '
  + 'completed, rejected or expired.',
  'Various bug fixes.',
];
