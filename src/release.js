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
/* Matchup Insights: drafted at the user's request and approved by the user as written (25 October 2026). It
   replaces the Season Statistics list (v1.227, also shown for v1.228). */
export const RELEASE_NOTE_ITEMS = [
  'New tool: Matchup Insights. Every game of the week as a matchup card, with what makes it worth watching: what is at '
  + 'stake, the rivalry, form, injuries, records within reach, ESPN\u2019s projection, what is happening live and how it '
  + 'all turned out. Predictions are judged once a game is final, and every week played stays.',
  'The banner across your matchup card on the home page now comes from Matchup Insights: a postseason game, Must Win, '
  + 'Win and You\u2019re In, or the most important fact about your game, and it changes as the game goes on.',
  'Site Configuration has a new Home page display panel, with switches for the matchup banners and for the standings.',
  'LLM Data Export and Site API now carry each week\u2019s insights.',
  'Various bug fixes and performance improvements.',
];

/**
 * The tools new in this release (C8). Site Configuration marks each with a small New tag in its Tools and Home page
 * order panels, so whoever administers the site sees what arrived before setting its visibility or arranging its
 * tile. The home page's own tiles never carry the tag.
 *
 * Kept here, beside the release notes, because both are written for the same release at the same moment (a
 * production package's Step 0): the list is reviewed with the notes, and like them it is cleared or rewritten for the
 * next release. Keys are those in src/tools.js; a test holds every one to a registered tool.
 */
/* Matchup Insights' release: the new tool carries the tag. */
export const NEW_TOOLS = ['matchup-insights'];
