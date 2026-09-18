/**
 * Team logo URLs.
 *
 * Its own module because the client bundles need it too: importing it from
 * derive.js dragged the whole derivation layer into Draft Helper's bundle.
 * derive.js re-exports both names, so every existing import still works.
 */
export function isEspnFantasyHost(host) {
  return /(^|\.)fantasy\.espn\.com$/.test(String(host || ''));
}

/**
 * A short, stable fingerprint of a logo's source URL (FNV-1a, 32-bit).
 *
 * Used as a cache-busting version, not as a security primitive. ESPN mints a
 * new UUID for every upload, so a changed source URL is a changed logo, and
 * hashing the URL gives a version that moves exactly when the image does.
 */
export function logoVersion(raw) {
  let h = 0x811c9dc5;
  const s = String(raw || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/**
 * Where a surface should load a fantasy team's logo from.
 *
 * Always the Worker's own store, never ESPN: a custom upload is behind ESPN's
 * session and a browser cannot fetch it. Null when the team has no logo, so the
 * caller renders the shield rather than requesting an image that cannot exist.
 *
 * The `v` parameter lets the response be cached immutably while still changing
 * the moment the team changes their logo.
 */
export function teamLogoUrl(teamId, raw) {
  if (teamId === null || teamId === undefined || teamId === '') return null;
  if (!raw || typeof raw !== 'string') return null;
  return `/api/logo/${encodeURIComponent(String(teamId))}?v=${logoVersion(raw)}`;
}
