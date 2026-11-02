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
/* Front Office: drafted at the user's request and approved by the user as written (30 October 2026). It replaces
   the Matchup Insights list (v1.241). */
export const RELEASE_NOTE_ITEMS = [
  'New tool: Front Office. Your weekly roster desk, with who to start, a checklist before lock, free agents ranked by '
  + 'how much they\u2019d help your lineup (each with a player to drop), and the weeks ahead.',
  'Matchup Insights keeps what still matters on screen once a game starts.',
  'Site API: Front Office for any team, a lineup alert, and eight new iPhone and iPad jobs.',
  'LLM Data Export includes your Front Office.',
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
/* Front Office's release: the new tool carries the tag. */
export const NEW_TOOLS = ['front-office'];
