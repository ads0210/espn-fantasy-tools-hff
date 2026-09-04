/**
 * R2 dataset store.
 *
 * Layout:
 *   data/<datasetKey>/<part>.json    raw ESPN payload, byte-for-byte
 *   status/<datasetKey>.json         small per-dataset refresh report
 *
 * Freshness lives on the object itself (R2's own `uploaded` timestamp), so a
 * staleness check is a single head() with no body transfer.
 */

export const DATA_PREFIX = 'data/';
export const STATUS_PREFIX = 'status/';

export function objectKey(datasetKey, part = 'main') {
  return `${DATA_PREFIX}${datasetKey}/${part}.json`;
}

export function statusKey(datasetKey) {
  return `${STATUS_PREFIX}${datasetKey}.json`;
}

export function ageSeconds(uploaded, now = Date.now()) {
  if (!uploaded) return Infinity;
  const t = uploaded instanceof Date ? uploaded.getTime() : new Date(uploaded).getTime();
  return Math.max(0, Math.round((now - t) / 1000));
}

/**
 * A ttl of 0 means "manual refresh only" — an existing copy is always
 * considered fresh, and it only ever gets rewritten on an explicit force.
 */
export function isFresh(uploaded, ttl, now = Date.now()) {
  if (!uploaded) return false;
  if (!ttl || ttl <= 0) return true;
  return ageSeconds(uploaded, now) < ttl;
}

export async function headPart(env, datasetKey, part) {
  try {
    return await env.DATA.head(objectKey(datasetKey, part));
  } catch {
    return null;
  }
}

export async function getPart(env, datasetKey, part) {
  try {
    return await env.DATA.get(objectKey(datasetKey, part));
  } catch {
    return null;
  }
}

export async function putPart(env, datasetKey, part, buffer, meta) {
  const custom = {};
  for (const [k, v] of Object.entries(meta || {})) {
    if (v === undefined || v === null) continue;
    custom[k] = String(v).slice(0, 400);
  }
  return env.DATA.put(objectKey(datasetKey, part), buffer, {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
    customMetadata: custom,
  });
}

export async function writeStatus(env, datasetKey, report) {
  const body = JSON.stringify(report);
  await env.DATA.put(statusKey(datasetKey), body, {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });
}

export async function readStatus(env, datasetKey) {
  const obj = await env.DATA.get(statusKey(datasetKey));
  if (!obj) return null;
  try {
    return await obj.json();
  } catch {
    return null;
  }
}

/** List every stored object under a prefix (handles pagination). */
export async function listAll(env, prefix) {
  const out = [];
  let cursor;
  for (;;) {
    const res = await env.DATA.list({ prefix, cursor, limit: 1000 });
    for (const o of res.objects) {
      out.push({
        key: o.key,
        size: o.size,
        uploaded: o.uploaded instanceof Date ? o.uploaded.toISOString() : String(o.uploaded),
        meta: o.customMetadata || {},
      });
    }
    if (!res.truncated) break;
    cursor = res.cursor;
  }
  return out;
}
