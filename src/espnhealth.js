/**
 * ESPN credential health.
 *
 * espn_s2 has no published lifetime. It is generally long-lived, but it is
 * invalidated early by a password change, an explicit sign-out, or an ESPN-side
 * session reset — none of which this site can see coming. So there is nothing
 * useful to predict: the only honest signal is an authenticated call coming
 * back 401.
 *
 * Without this, expiry is silent. Every authenticated dataset quietly stops
 * refreshing, the site keeps serving whatever it last stored, and the first
 * anyone knows is that scores stopped moving. The flag exists so the site can
 * say so plainly instead.
 *
 * State is deliberately tiny and lives outside the main config blob, so noting
 * a failure can never race with a config write and lose a field.
 */

export const ESPN_AUTH_KEY = 'config:espn_auth';

/**
 * Record the outcome of an authenticated ESPN call.
 *
 * Only writes on a transition. A pull touches a dozen authenticated datasets
 * and would otherwise spend a KV write on each one to say nothing new.
 */
export async function noteEspnAuth(env, { failing, status = null }) {
  const current = await readEspnAuth(env);
  if (Boolean(current.failing) === Boolean(failing)) return current;

  const next = failing
    ? { failing: true, since: new Date().toISOString(), status: status || 401 }
    : { failing: false, since: null, status: null };
  try {
    await env.CONFIG.put(ESPN_AUTH_KEY, JSON.stringify(next));
  } catch {
    // Health reporting must never be the thing that breaks a refresh.
    return current;
  }
  return next;
}

export async function readEspnAuth(env) {
  try {
    const raw = await env.CONFIG.get(ESPN_AUTH_KEY);
    if (!raw) return { failing: false, since: null, status: null };
    const parsed = JSON.parse(raw);
    return {
      failing: Boolean(parsed && parsed.failing),
      since: (parsed && parsed.since) || null,
      status: (parsed && parsed.status) || null,
    };
  } catch {
    return { failing: false, since: null, status: null };
  }
}

/**
 * Decide what a finished authenticated refresh says about the credentials.
 *
 * A 401 or 403 on a dataset that sends the cookie means the session is no
 * longer accepted. A 403 on an *unauthenticated* dataset means something else
 * entirely — ESPN's site API sits behind bot protection that answers 403 to
 * Workers regardless of credentials — which is why this only ever runs for
 * datasets flagged `auth`.
 *
 * One success is enough to clear the flag: the credentials demonstrably work,
 * and whatever else failed did so for its own reasons.
 */
export function readAuthOutcome(parts) {
  const list = Array.isArray(parts) ? parts : [];
  if (!list.length) return null;
  if (list.some((r) => r && r.ok)) return { failing: false, status: null };
  const denied = list.find((r) => r && (r.status === 401 || r.status === 403));
  if (denied) return { failing: true, status: denied.status };
  return null;
}
