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
/* Week 10: drafted for review on 5 November 2026 and approved by the user as written on 6 November. Replaces the
   Front Office list (v1.253). */
export const RELEASE_NOTE_ITEMS = [
  'Trade Analyzer\u2019s new Postmortem judges every trade offer of every season in hindsight: what each deal did to '
  + 'both sides\u2019 best lineups, beside what ESPN expected and what Trade Analyzer said at the time.',
  'Hall of Fame\u2019s record book is rebuilt: a top 10 on every record, season records, Record Holders, and a glow on '
  + 'records set this season.',
  'Season Statistics adds top 10 tables, Records held and Prestige, and counts Hall of Fame records once this season '
  + 'can no longer lose them.',
  'Matchup Insights calls out games that climb a record\u2019s top 10. League activity shows each trade offer once, '
  + 'with how it really ended, and marks waiver claims that didn\u2019t go through.',
  'Site API: a Postmortem address and sheets for the trades and the record book. LLM Data Export includes the Postmortem.',
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
/* Week 10's release: no new tool. */
export const NEW_TOOLS = [];
