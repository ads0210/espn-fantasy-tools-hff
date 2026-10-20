/**
 * Datasets the registry no longer carries, and the one-time sweep of their stored copies.
 *
 * Week 6 (plan P1, PD40) removed fourteen datasets nothing on the site read. Taking them out of
 * src/datasets.js stops every fetch; this sweep deletes what they left in R2 once, so Site Backend's
 * Data Layer and the stored-size figures stop counting them. It is the one shipped deletion of
 * dataset payloads, and it can only ever touch the keys listed here: a key the registry still
 * carries is refused, so a dataset re-added later is never swept.
 *
 * Run from the minute work at most once per isolate until its marker exists; after that it costs one
 * R2 head a quarter of an hour, and nothing once the isolate has seen the marker.
 */
import { DATASETS } from './datasets.js';
import { DATA_PREFIX, statusKey } from './store.js';

export const RETIRED_DATASETS = Object.freeze([
  'nfl_athletes_index', 'nfl_venues', 'nfl_franchises', 'nfl_coaches', 'nfl_weeks', 'nfl_draft', 'nfl_futures',
  'cdn_scoreboard', 'espn_news_nfl', 'espn_news_all', 'nfl_athlete_stats_probe', 'player_pool', 'league_nav',
  'player_watchlist',
]);

/** The marker that says the sweep has run. A new list of retirements takes a new version. */
export const RETIRED_MARK = 'meta/retired-datasets-v1.json';

const seen = new WeakMap();

/** The keys this sweep may delete: retired, and not registered again since. */
export function sweepable() {
  const live = new Set(DATASETS.map((d) => d.key));
  return RETIRED_DATASETS.filter((k) => !live.has(k));
}

export async function sweepRetired(env, { now = Date.now() } = {}) {
  const bucket = env && env.DATA;
  if (!bucket) return null;
  if (seen.get(bucket)) return { already: true };
  if (await bucket.head(RETIRED_MARK)) { seen.set(bucket, true); return { already: true }; }
  let deleted = 0;
  const keys = sweepable();
  for (const key of keys) {
    let cursor;
    do {
      const page = await bucket.list({ prefix: `${DATA_PREFIX}${key}/`, cursor });
      for (const obj of page.objects || []) { await bucket.delete(obj.key); deleted += 1; }
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    if (await bucket.head(statusKey(key))) { await bucket.delete(statusKey(key)); deleted += 1; }
  }
  await bucket.put(RETIRED_MARK, JSON.stringify({ at: new Date(now).toISOString(), keys, deleted }));
  seen.set(bucket, true);
  return { swept: keys.length, deleted };
}
