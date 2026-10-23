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
/* Season Statistics (v1.227 or later): the user's own list, approved 22 October 2026, spell-check only. It leaves
   out how to show the standings on the home page again (plan D31's draft line); the user's wording stands.
   It replaces the week-6 list (v1.223). */
export const RELEASE_NOTE_ITEMS = [
  'New tool: Season Statistics. This season\u2019s standings and around a hundred and twenty of its records, from the '
  + 'highest weekly score to the luckiest team, each with the team or player holding it. Choose the whole season, the '
  + 'regular season, the postseason, or the season as it stood after any week.',
  'The standings now live on Season Statistics, with each team\u2019s all-play record, luck and power ranking now included.',
  'LLM Data Export and Site API now carry this season\u2019s standings columns and records, and Site API has two new '
  + 'jobs for keeping the season\u2019s records in a sheet.',
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
/* Season Statistics' release: the new tool carries the tag (the week-6 release had none). */
export const NEW_TOOLS = ['season-stats'];
