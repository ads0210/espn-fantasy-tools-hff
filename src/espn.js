/**
 * ESPN HTTP layer.
 *
 * Nothing here parses response bodies — bodies are handed back as ArrayBuffers
 * and streamed into R2 untouched. Workers Free has a 10ms CPU ceiling, and
 * JSON.parse on a multi-megabyte player pool would blow straight through it.
 * Raw counting stats are also what the pipeline wants stored anyway, so scoring
 * can be recomputed locally if league rules ever change.
 */

const DEFAULT_TIMEOUT_MS = 15000;

const BROWSERISH_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Host fallback pairs.
 *
 * `site.api.espn.com` sits behind Akamai bot protection that returns a 403
 * "Access Denied" HTML page to requests originating from Cloudflare Workers,
 * regardless of headers. `site.web.api.espn.com` serves the byte-identical
 * /apis/site/v2/ namespace with no such protection — verified live against
 * scoreboard, teams and team-roster resources.
 *
 * The registry points at the working host; this map exists so that if ESPN ever
 * flips which edge is protected, a 403 automatically retries on the twin rather
 * than silently taking the whole NFL data group offline.
 */
const HOST_FALLBACKS = {
  'site.api.espn.com': 'site.web.api.espn.com',
  'site.web.api.espn.com': 'site.api.espn.com',
};

/**
 * Build the request headers for an ESPN call.
 *
 * espn_s2 is stored by ESPN already percent-encoded (containing literal %2B,
 * %2F ...). It must be sent verbatim — decoding it first does not authenticate.
 */
export function buildHeaders(cfg, { auth = false, extra = null } = {}) {
  const headers = {
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent': BROWSERISH_UA,
  };
  if (auth && cfg.leaguePrivate && cfg.espnS2 && cfg.swid) {
    headers.Cookie = `espn_s2=${cfg.espnS2}; SWID=${cfg.swid}`;
  }
  if (extra) Object.assign(headers, extra);
  return headers;
}

function swapHost(url) {
  try {
    const u = new URL(url);
    const alt = HOST_FALLBACKS[u.hostname];
    if (!alt) return null;
    u.hostname = alt;
    return u.toString();
  } catch {
    return null;
  }
}

async function attempt(url, headers, timeoutMs) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
      redirect: 'follow',
    });
    const contentType = res.headers.get('content-type') || '';
    const buffer = await res.arrayBuffer();
    return {
      ok: res.ok,
      status: res.status,
      contentType,
      buffer,
      bytes: buffer.byteLength,
      ms: Date.now() - started,
      error: res.ok ? null : `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      contentType: '',
      buffer: null,
      bytes: 0,
      ms: Date.now() - started,
      error: err && err.name === 'AbortError' ? 'timeout' : String((err && err.message) || err),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch one URL. Never throws — failures come back as a structured result so a
 * partial sweep can report every failure at once rather than aborting on the
 * first one.
 */
export async function fetchPart(cfg, part, { auth = false, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const headers = buildHeaders(cfg, { auth, extra: part.headers });
  let res = await attempt(part.url, headers, timeoutMs);

  if (res.status === 403) {
    const alt = swapHost(part.url);
    if (alt) {
      const retry = await attempt(alt, headers, timeoutMs);
      if (retry.ok) {
        retry.viaFallback = alt;
        return retry;
      }
      res.fallbackTried = alt;
      res.fallbackStatus = retry.status;
    }
  }
  return res;
}

/**
 * Run tasks with bounded concurrency.
 * Workers allow at most 6 simultaneous outgoing connections per request.
 */
export async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    for (;;) {
      const idx = cursor++;
      if (idx >= items.length) return;
      results[idx] = await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
  return results;
}

// How much of a payload to scan when looking for the expected top-level key.
// ESPN puts `members[]` before `teams[]` on league responses, so a small window
// produces false negatives; 16KB clears it while keeping the scan cost flat.
const SCAN_BYTES = 16384;

/**
 * Cheap structural sanity check on a fetched body without a full JSON.parse.
 * Confirms the body actually looks like the JSON document we asked for rather
 * than an HTML error page or a login redirect.
 */
export function inspectBody(buffer, expectKey) {
  if (!buffer || buffer.byteLength === 0) {
    return { looksJson: false, closed: false, hasExpected: null, head: '', reason: 'empty body' };
  }
  const dec = new TextDecoder('utf-8', { fatal: false });
  const scan = dec.decode(new Uint8Array(buffer, 0, Math.min(buffer.byteLength, SCAN_BYTES)));
  const tailStart = Math.max(0, buffer.byteLength - 512);
  const tail = dec.decode(new Uint8Array(buffer, tailStart, buffer.byteLength - tailStart));

  const trimmed = scan.replace(/^\uFEFF/, '').trimStart();
  const first = trimmed.charAt(0);
  const looksJson = first === '{' || first === '[';
  const lastChar = tail.trimEnd().slice(-1);
  const closed = lastChar === '}' || lastChar === ']';

  let hasExpected = null;
  if (expectKey) hasExpected = scan.includes(`"${expectKey}"`);

  return {
    looksJson,
    closed,
    hasExpected,
    head: scan.slice(0, 220),
    reason: looksJson ? null : `body did not start as JSON (starts "${trimmed.slice(0, 60)}")`,
  };
}
