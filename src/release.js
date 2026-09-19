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
  'New tool: LLM Data Export \u2014 everything an AI assistant needs to be a real '
  + 'fantasy co-manager. A prompt you copy, and your whole league as one file you '
  + 'attach to it. Pick your team, copy, attach, and it can talk about your roster, '
  + 'your matchup, the waiver wire and your league\u2019s own rules.',
  'The season standings on the home page now carry points per game, points '
  + 'difference and playoff odds, mark who has clinched or been eliminated, and '
  + 'sort on any column you tap.',
  'Looking back at a week already played in Live Matchups shows its score '
  + 'progression charts and its finished games again.',
  'Choosing your team looks and works the same on every page, and every list now '
  + 'shows team logos.',
  'A shared Trade Analyzer link now opens the trade it was shared with rather '
  + 'than an empty builder.',
  'Various bug fixes.',
];
