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
/* Week 6 (v1.2xx): the list the user wrote and approved on 17 October 2026, spell-checked only. Its last line is the
   user's own wording of the usual closing line. */
export const RELEASE_NOTE_ITEMS = [
  'You can now add the site as an app on your phone: on iPhone, open the home page, tap Share, then Add to Home Screen.',
  'New in Fortune Teller: league-wide odds charts show every team\u2019s ESPN and simulated playoff odds after each week. '
  + 'Point at a line to read it, or tap a team to show it alone. Standings now toggle between live and selected.',
  'You can now hover over Live Matchups\u2019 score, margin and win-probability charts to read any moment of a game.',
  'The matchup card on the home page now carries a banner when a game matters: the Championship, playoff rounds, '
  + 'Must Win, Win and You\u2019re In, and more.',
  'Whoever administers the site can now leave a note for everyone on the home page from Site Configuration.',
  'NFL depth charts and team schedules load reliably again, and the home page says so if any league data can\u2019t be reached.',
  'Site API: twelve new ready-made jobs, from game alerts and a desk scoreboard to league dashboards, with phone alerts through ntfy.',
  'Various bug fixes, theme support, and performance improvements.',
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
/* Week 6: no new tool in this release; Site API's tag from v1.199 cleared at the user's word (20 October 2026). */
export const NEW_TOOLS = [];
