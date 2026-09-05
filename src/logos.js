/**
 * Fantasy team logo store.
 *
 * ESPN serves three kinds of team logo, and only one of them can be linked to
 * directly from a browser:
 *
 *   VECTOR         g.espncdn.com/...        public, hotlinkable
 *   CUSTOM_VALID   whatever the member      public, hotlinkable
 *                  pasted
 *   CUSTOM_UPLOAD  mystique-api.fantasy     401 AUTH_MISSING_CREDENTIALS
 *                  .espn.com/apis/v1/...    unless the league session is sent
 *
 * A member who uses ESPN's own upload button always lands in the third case, so
 * "upload a logo in ESPN and it shows up here" was broken for everyone who did
 * the obvious thing. The image is reachable with the league's stored espn_s2 /
 * SWID pair, which only the Worker holds, so the bytes are fetched server-side
 * and re-served from R2 rather than linked.
 *
 * Copying into R2 rather than proxying on demand buys three things: the cookie
 * is used on a schedule instead of on a visitor's request path, a logo survives
 * an ESPN outage, and a changed logo appears within one refresh cycle rather
 * than whenever a cache entry happens to lapse.
 *
 * NFL team logos are untouched. They are plain espncdn URLs, they have never
 * failed, and routing them through here would add storage and a request hop for
 * no gain.
 */

import { coordinatorRefresh } from './dedupe.js';
import { isEspnFantasyHost, logoVersion } from './derive.js';
import { buildHeaders } from './espn.js';
import { getPart, listAll } from './store.js';

/**
 * Logos live outside DATA_PREFIX. Several diagnostics walk `data/` expecting
 * `<key>/<part>.json` and would have to special-case binary entries otherwise.
 */
export const LOGO_PREFIX = 'logos/';

/** Matches /api/img. A team logo far above this is not a team logo. */
export const LOGO_MAX_BYTES = 3 * 1024 * 1024;

const FETCH_TIMEOUT_MS = 6000;

/** How often the cron does a logo pass, in milliseconds. */
export const LOGO_REFRESH_MS = 5 * 60 * 1000;

export function logoObjectKey(teamId) {
  return `${LOGO_PREFIX}${String(teamId)}`;
}

/**
 * ESPN answers custom uploads with `image/jpg`, which is not a registered type.
 * Browsers accept it, but the response also carries `nosniff`, so the declared
 * type is the only thing they get to work from. Normalise the one known-bad
 * value and pass everything else through untouched.
 */
export function normalizeImageType(type) {
  const t = String(type || '').split(';')[0].trim().toLowerCase();
  if (!t) return null;
  if (!t.startsWith('image/')) return null;
  return t === 'image/jpg' ? 'image/jpeg' : t;
}

/**
 * Fetch one logo, attaching the league session only when the host is ESPN's.
 *
 * The host test is the security-critical line in this file. The source URL
 * comes from ESPN's own payload, but a league member can set it to anything a
 * URL field accepts, so it is treated as untrusted: a loose match here would
 * hand espn_s2 — a full ESPN session — to whatever host they named. The pattern
 * is anchored on a label boundary, so `notfantasy.espn.com` and
 * `fantasy.espn.com.example.test` both fail closed.
 */
export async function fetchLogo(cfg, src) {
  let host;
  try {
    const parsed = new URL(src);
    if (parsed.protocol !== 'https:') return { ok: false, error: 'not https' };
    host = parsed.hostname;
  } catch {
    return { ok: false, error: 'unparseable url' };
  }

  const useAuth = isEspnFantasyHost(host);
  const headers = useAuth
    ? buildHeaders(cfg, {
      auth: true,
      extra: { Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8' },
    })
    : {
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
        + '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(src, { headers, signal: controller.signal, redirect: 'follow' });
    clearTimeout(timer);

    const type = normalizeImageType(res.headers.get('content-type'));
    if (!res.ok) return { ok: false, status: res.status, authed: useAuth, error: `HTTP ${res.status}` };
    if (!type) {
      return {
        ok: false,
        status: res.status,
        authed: useAuth,
        error: `not an image (${res.headers.get('content-type') || 'no content-type'})`,
      };
    }

    const body = await res.arrayBuffer();
    if (body.byteLength > LOGO_MAX_BYTES) {
      return { ok: false, status: res.status, authed: useAuth, error: 'too large' };
    }
    return { ok: true, status: res.status, authed: useAuth, type, body };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, authed: useAuth, error: String((err && err.message) || err) };
  }
}

/** The fantasy teams and their raw logo sources, straight from the stored mTeam view. */
export async function readTeamLogoSources(env) {
  const obj = await getPart(env, 'league_teams', 'main');
  if (!obj) return null;
  let doc;
  try {
    doc = await obj.json();
  } catch {
    return null;
  }
  return (doc && doc.teams || []).map((t) => ({
    teamId: t.id,
    name: t.name || `Team ${t.id}`,
    src: typeof t.logo === 'string' && t.logo ? t.logo : null,
    logoType: t.logoType || null,
  }));
}

/**
 * Bring the stored logos in line with ESPN.
 *
 * A logo is only re-fetched when its source URL has changed. That is not an
 * optimisation dressed up as correctness: ESPN mints a fresh time-based UUID
 * for every upload, so the URL changing is exactly what a logo changing looks
 * like. Steady state is therefore one ESPN call per pass — the team view — and
 * no image traffic at all, which is what keeps a five-minute cadence inside the
 * free tier.
 */
export async function refreshLogos(env, cfg, { force = false } = {}) {
  const startedAt = Date.now();

  // The logo source lives in mTeam, so noticing a change means re-reading it.
  // Forced rather than TTL-gated: the dataset's own 30-minute freshness is
  // right for names and owners but would cap logo latency at 30 minutes.
  let teamsError = null;
  try {
    await coordinatorRefresh(env, 'league_teams', true);
  } catch (err) {
    teamsError = String((err && err.message) || err);
  }

  const teams = await readTeamLogoSources(env);
  if (!teams) {
    return {
      ok: false, error: teamsError || 'league_teams unavailable',
      ms: Date.now() - startedAt, teams: [],
    };
  }

  const results = [];
  let changed = 0;
  let failed = 0;

  for (const t of teams) {
    const key = logoObjectKey(t.teamId);
    const want = t.src ? logoVersion(t.src) : null;

    if (!t.src) {
      // No logo set. Drop any copy so the surface falls back to the shield
      // rather than showing a logo the team has since removed.
      await env.DATA.delete(key).catch(() => {});
      results.push({ teamId: t.teamId, name: t.name, state: 'none' });
      continue;
    }

    const head = force ? null : await env.DATA.head(key).catch(() => null);
    const have = head && head.customMetadata && head.customMetadata.version;
    if (have && have === want) {
      results.push({ teamId: t.teamId, name: t.name, state: 'current', version: want });
      continue;
    }

    const got = await fetchLogo(cfg, t.src);
    if (!got.ok) {
      failed += 1;
      results.push({
        teamId: t.teamId, name: t.name, state: 'failed',
        error: got.error, status: got.status || null, authed: got.authed || false,
      });
      continue;
    }

    await env.DATA.put(key, got.body, {
      httpMetadata: { contentType: got.type, cacheControl: 'public, max-age=86400' },
      customMetadata: {
        version: want,
        contentType: got.type,
        source: String(t.src).slice(0, 400),
        fetchedAt: new Date().toISOString(),
      },
    });
    changed += 1;
    results.push({
      teamId: t.teamId, name: t.name, state: 'stored',
      version: want, type: got.type, bytes: got.body.byteLength, authed: got.authed,
    });
  }

  // A team that has left the league keeps no copy behind.
  const live = new Set(teams.map((t) => logoObjectKey(t.teamId)));
  let removed = 0;
  try {
    for (const obj of await listAll(env, LOGO_PREFIX)) {
      if (live.has(obj.key)) continue;
      await env.DATA.delete(obj.key).catch(() => {});
      removed += 1;
    }
  } catch {
    // Listing is a tidy-up, never the point of the pass.
  }

  return {
    ok: failed === 0,
    ms: Date.now() - startedAt,
    teamsSeen: teams.length,
    changed,
    failed,
    removed,
    teamsError,
    teams: results,
  };
}
