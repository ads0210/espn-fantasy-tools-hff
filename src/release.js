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
  'New tool: Site Backend. How the site is running at a glance: its health, its '
  + 'data, its traffic and its logs. Admin-only by default.',
  'Added support for traded draft picks, alternate roster sizes, and alternate '
  + 'draft formats in Draft Helper.',
  'LLM Data Export now makes sure the data is always fresh on every copy or download.',
  'Tools on the home page have a new order, and whoever administers this site can '
  + 'now arrange them in Site Configuration.',
  'The Setup Wizard now allows defaulting tools to admin-only, in addition to '
  + 'visible and hidden.',
  'Added uniform rounding rules to prevent percentage mismatches across pages.',
  'Various bug fixes and performance improvements.',
];
