// One colour per team, the same on every chart on the site (week 6, plan N1). Fourteen slots (leagues run up to
// 14 teams), assigned in team-id order, so a team keeps its colour everywhere and a filter never repaints the rest.
// Validated 16 October 2026: adjacent slots pass colour-vision-deficiency separation (worst ΔE 12.1 dark / 11.6
// light), the normal-vision floor (25.0 / 23.6) and 3:1 against --panel in both themes. Fourteen lines at once can
// never all be told apart by colour alone, so identity is carried by the hover read-out, the legend (tap to isolate)
// and the chosen team's heavier line. Colour never carries meaning by itself.
export const TEAM_COLOURS = {
  dark: ['#9b7102', '#b672d8', '#088c81', '#db7508', '#0aa6bb', '#c54b39', '#5c90f5', '#e16386', '#4f8c0b', '#b34c97', '#01af71', '#7665d0', '#9d9906', '#0282b8'],
  light: ['#906801', '#af66d2', '#008f80', '#ce6d02', '#019cb0', '#bf3c2b', '#4f86f0', '#db557d', '#488203', '#ac3f90', '#07a46a', '#6e59cc', '#939004', '#0079ab'],
};
export const NO_TEAM = { dark: '#7C8E7E', light: '#5B6956' };

/** The CSS tokens --team-1 … --team-14 and --team-none, for both themes. */
export function teamColourCss() {
  const block = (m) => TEAM_COLOURS[m].map((c, i) => `--team-${i + 1}:${c};`).join('') + `--team-none:${NO_TEAM[m]};`;
  return `html[data-theme="dark"]{${block('dark')}} html[data-theme="light"]{${block('light')}}`;
}

/** A team's slot: its place among the league's team ids, sorted (ESPN ids are 1…n in practice). */
export function teamSlot(teamId, allIds) {
  const ids = [...new Set(allIds.map(Number))].sort((a, b) => a - b);
  const i = ids.indexOf(Number(teamId));
  return i < 0 ? null : (i % 14) + 1;
}
export const teamVar = (teamId, allIds) => {
  const s = teamSlot(teamId, allIds);
  return s ? `var(--team-${s})` : 'var(--team-none)';
};
