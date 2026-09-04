/**
 * Login rate limiting.
 *
 * One Durable Object instance per client IP. Password checks are deliberately
 * expensive, but expense alone does not stop a patient attacker, and the League
 * Password is the only thing standing in front of real league-member data. A
 * sliding window caps how fast guesses can be made.
 *
 * Failures count; a success clears the window, so an ordinary user who mistypes
 * a few times is never penalised once they get it right.
 */

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_FAILURES = 10;

export class LoginThrottle {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.failures = null;

    this.state.blockConcurrencyWhile(async () => {
      this.failures = (await this.state.storage.get('failures')) || [];
    });
  }

  prune(now) {
    this.failures = this.failures.filter((t) => now - t < WINDOW_MS);
  }

  async fetch(request) {
    const url = new URL(request.url);
    const now = Date.now();
    this.prune(now);

    if (url.pathname === '/check') {
      const blocked = this.failures.length >= MAX_FAILURES;
      return json({
        blocked,
        failures: this.failures.length,
        retryAfterSeconds: blocked
          ? Math.max(1, Math.ceil((WINDOW_MS - (now - this.failures[0])) / 1000))
          : 0,
      });
    }

    if (url.pathname === '/fail') {
      this.failures.push(now);
      await this.state.storage.put('failures', this.failures);
      const blocked = this.failures.length >= MAX_FAILURES;
      return json({ blocked, failures: this.failures.length });
    }

    if (url.pathname === '/succeed') {
      this.failures = [];
      await this.state.storage.put('failures', this.failures);
      return json({ blocked: false, failures: 0 });
    }

    if (url.pathname === '/reset') {
      this.failures = [];
      await this.state.storage.put('failures', this.failures);
      return json({ ok: true });
    }

    return json({ error: 'unknown throttle route' }, 404);
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

// ---------------------------------------------------------------- client side

function clientKey(request) {
  // CF-Connecting-IP is set by Cloudflare's edge and cannot be spoofed by the
  // client; the fallbacks only ever apply in local testing.
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for') ||
    'unknown'
  );
}

function stub(env, request) {
  return env.THROTTLE.get(env.THROTTLE.idFromName(clientKey(request)));
}

export async function throttleCheck(env, request) {
  if (!env.THROTTLE) return { blocked: false, failures: 0, retryAfterSeconds: 0 };
  const res = await stub(env, request).fetch('https://throttle/check');
  return res.json();
}

export async function throttleFail(env, request) {
  if (!env.THROTTLE) return { blocked: false, failures: 0 };
  const res = await stub(env, request).fetch('https://throttle/fail');
  return res.json();
}

export async function throttleSucceed(env, request) {
  if (!env.THROTTLE) return;
  await stub(env, request).fetch('https://throttle/succeed');
}
