/**
 * Naming a tool in prose, and linking it.
 *
 * Release notes and the site's banners both refer to tools by name, and a
 * reader told that something changed should be able to go and look.
 */
import { esc } from '../ui.js';
import { TOOLS, SITE_CONFIG_TOOL } from '../tools.js';

/**
 * Turn a tool's name into a link to it.
 *
 * Update notes name the tools they describe, and a reader who has just been
 * told Live Matchups changed should be able to go and look rather than dismiss
 * the notice and hunt for it. The credential and re-pull banners already link
 * Site Configuration this way; this makes it the rule for every notice.
 *
 * Escaping happens first and the anchors are inserted afterwards, so release
 * copy is still treated as text and cannot introduce markup of its own. Longer
 * names are matched first: "Site Configuration" must win over a shorter name it
 * contains before that name gets a chance to match inside it.
 */
export function linkTools(text) {
  const all = [...TOOLS, SITE_CONFIG_TOOL]
    .flatMap((t) => (t.key === 'site-config'
      // The short form people actually write, alongside the formal name.
      ? [{ ...t }, { ...t, name: 'Site Config' }]
      : [t]))
    .sort((a, b) => b.name.length - a.name.length);
  let out = esc(text);
  const taken = [];
  for (const t of all) {
    const needle = esc(t.name);
    let from = 0;
    for (;;) {
      const at = out.indexOf(needle, from);
      if (at < 0) break;
      // Never match inside an anchor already inserted for a longer name.
      if (taken.some(([s0, e0]) => at < e0 && at + needle.length > s0)) {
        from = at + needle.length;
        continue;
      }
      const link = `<a href="${t.href}">${needle}</a>`;
      out = out.slice(0, at) + link + out.slice(at + needle.length);
      const shift = link.length - needle.length;
      for (const span of taken) { if (span[0] > at) { span[0] += shift; span[1] += shift; } }
      taken.push([at, at + link.length]);
      from = at + link.length;
    }
  }
  return out;
}
