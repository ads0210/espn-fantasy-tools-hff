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
/* Week 11: a DRAFT written by Claude at the user's request on 18 November 2026, for the user's review before any
   production package (Step 0). Replaces the week-10 list (v1.274/v1.276). */
export const RELEASE_NOTE_ITEMS = [
  'Fortune Teller keeps this week’s games live: ESPN’s win chances and scores update while the page is open, '
  + 'weeks already played fold away until you switch on What-if, and Standings open on the outcomes you pick (Current '
  + 'shows the table as it stands).',
  'A team now reads Eliminated only when no result can put it in the playoffs, and Clinched only when none can keep it '
  + 'out, everywhere on the site; Must Win and the other stakes in Matchup Insights agree with it.',
  'Front Office shows your total and your opponent’s as ESPN projects them live during games, and names every move '
  + 'when your best lineup needs more than one swap.',
  'Site Backend shows the site’s use of Durable Object time, and the site uses much less of it.',
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
/* Week 11's release: no new tool. */
export const NEW_TOOLS = [];
