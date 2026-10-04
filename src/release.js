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
  'New tool: Site API. Your league\u2019s data for spreadsheets, scripts and phones, with step-by-step '
  + 'guides for Google Sheets, Excel, Python, iPhone, Android, Home Assistant, Discord and more, and '
  + 'downloads of every dataset. Every example keeps to the pace the site sets and stops itself if it '
  + 'asks too often. Admin-only by default.',
  'Live Matchups is made for following a game: a player whose game is on is lit up with the quarter, '
  + 'the clock and the score, a dash marks a player yet to play, a bar shows points against projection, '
  + 'and a brief +6.0 appears when points change. Highlights show each team\u2019s panels on its own side, '
  + 'the optimal lineup gauges always sit level, and team names on the matchup card take the site\u2019s colours.',
  'Trade Analyzer now judges every deal on real figures: each player\u2019s projection for the rest of the season, his '
  + 'weeks so far, injuries, bye weeks, depth charts, your league\u2019s free agents and its playoff odds.',
  'Site Configuration opens as a board of panels: choose one to open it.',
  'If the site ever reaches one of Cloudflare\u2019s free daily limits, pages now say so and pick up again '
  + 'by themselves.',
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
export const NEW_TOOLS = ['site-api'];
