/**
 * First-run setup.
 *
 * A freshly deployed site has no passwords. The unlock mechanism (plan §6,
 * "Plan A") is a one-time code generated at build time, printed in plain text
 * to the Cloudflare build log — visible only to the account owner — with only
 * its hash baked into the Worker bundle.
 *
 * If no code was baked in (the build step did not run), the site falls back to
 * "Plan B": setup is reachable without a code but the page says plainly that
 * the site is unprotected and must be configured immediately. That fallback
 * exists so a misconfigured build never locks an owner out of their own
 * deployment — an unconfigured site holds no data worth protecting yet, since
 * ESPN credentials are entered during setup itself.
 */

import { SETUP_CODE_HASH, SETUP_CODE_GENERATED_AT } from './generated/setup-code.js';
import { hashPassword, randomToken, timingSafeEqual, createSession, SESSION_TTL_SECONDS } from './auth.js';
import { saveConfig, isConfigured } from './config.js';

export function setupCodeRequired() {
  return typeof SETUP_CODE_HASH === 'string' && SETUP_CODE_HASH.length > 0;
}

export function setupCodeGeneratedAt() {
  return SETUP_CODE_GENERATED_AT;
}

async function sha256Base64Url(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  let bin = '';
  const arr = new Uint8Array(digest);
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Verify a user-entered setup code. Case and separator tolerant, because the
 * code is transcribed by hand off a build log.
 */
export async function verifySetupCode(supplied) {
  if (!setupCodeRequired()) return true;
  if (!supplied) return false;
  const cleaned = String(supplied).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const canonical = cleaned.replace(/(.{4})(?=.)/g, '$1-');
  const digest = await sha256Base64Url(canonical);
  return timingSafeEqual(digest, SETUP_CODE_HASH);
}

const MIN_PASSWORD_LENGTH = 8;

export function validatePasswords(leaguePassword, adminPassword) {
  const problems = [];
  if (!leaguePassword || leaguePassword.length < MIN_PASSWORD_LENGTH) {
    problems.push(`League Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (!adminPassword || adminPassword.length < MIN_PASSWORD_LENGTH) {
    problems.push(`Admin Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (leaguePassword && adminPassword && leaguePassword === adminPassword) {
    problems.push('The two passwords must be different — they protect different things.');
  }
  return problems;
}

/**
 * Set both passwords and open a session for the browser that did it.
 *
 * The session is granted in the same step deliberately: the passwords take
 * effect immediately, so without it the admin would be locked out of the wizard
 * they are still standing in the middle of.
 */
export async function completePasswordSetup(env, cfg, { leaguePassword, adminPassword }) {
  if (isConfigured(cfg)) {
    return { ok: false, status: 409, error: 'This site is already configured.' };
  }
  const problems = validatePasswords(leaguePassword, adminPassword);
  if (problems.length) return { ok: false, status: 400, error: problems.join(' ') };

  const [leaguePasswordHash, adminPasswordHash] = await Promise.all([
    hashPassword(leaguePassword),
    hashPassword(adminPassword),
  ]);
  const sessionSecret = randomToken(32);

  const saved = await saveConfig(env, {
    leaguePasswordHash,
    adminPasswordHash,
    sessionSecret,
  });

  const token = await createSession(sessionSecret, 'league', SESSION_TTL_SECONDS);
  return { ok: true, config: saved, token };
}
