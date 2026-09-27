/**
 * A page that loads once, and was answered with data past its refresh interval.
 *
 * The server answers a page load with what it has stored and rebuilds it behind the
 * answer (stale-while-revalidate), which is right for speed but means the first
 * visitor after a quiet spell sees data that is days old: a trade offer missing from
 * Trade Analyzer, last week's rosters in the league export. Pages that poll anyway
 * catch up on their own; these ask again a few times until the rebuilt copy arrives.
 *
 * A plain module, so it is tested by behaviour.
 */

export const FRESHEN_TRIES = [4000, 9000, 16000, 30000];

/**
 * Start asking again when `stamp` (an ISO time) is older than `ttlMs`. Returns a
 * cancel function, or null when the data was fresh and nothing was started.
 *
 *   refetch()      resolves to the next payload
 *   stampOf(p)     that payload's stamp
 *   apply(p)       called once, with the first payload whose stamp moved on
 *   done()         called once, when the rebuilt copy arrived or the tries ran out
 */
export function freshenWhenStale({ stamp, ttlMs, refetch, stampOf, apply, done, tries = FRESHEN_TRIES, now = Date.now }) {
  const at = Date.parse(stamp);
  if (!Number.isFinite(at) || now() - at <= ttlMs) return null;
  let stopped = false;
  const timers = [];
  const finish = () => { if (stopped) return; stopped = true; timers.forEach(clearTimeout); if (done) done(); };
  tries.forEach((ms, i) => timers.push(setTimeout(async () => {
    if (stopped) return;
    try {
      const next = await refetch();
      if (stopped) return;
      const s = next ? stampOf(next) : null;
      if (s && s !== stamp) { apply(next); finish(); return; }
    } catch (e) { /* the next try will do */ }
    if (i === tries.length - 1) finish();
  }, ms)));
  return () => { stopped = true; timers.forEach(clearTimeout); };
}
