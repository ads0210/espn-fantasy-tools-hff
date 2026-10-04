/**
 * Site API: the rate window, and the pace record that keeps it.
 *
 * rateDecide() is the rule, exactly as designed and tested in the Site API sample (and its test kit):
 * each program gets one round of up to 5 requests within 10 seconds per suggested interval; the next round
 * opens 5 seconds early; the programs at one address together begin at most 4 rounds per interval; a request
 * sooner is refused, too_fast when it came sooner than the pace of the program's last answered round (never
 * judged stricter than once a minute), otherwise pace_changed. The first refusal in a window is sent at once;
 * later ones are held.
 *
 * SourcePaceDO is one small object per key and address, holding that address's programs' windows (up to 10
 * names and the unnamed one) and when its recent rounds began. An isolate asks it once per answered request.
 */

export const RW = { ROUND: 10, ROUND_MAX: 5, EARLY: 5, HOLD: 20, STANDARD: 60, NAMES: 10, ADDRESS_ROUNDS: 4 };

/* rec: one program's record { start, used, given, refused }. addr: the address's { starts: [] }. t in seconds.
   P: the pace now in seconds, or null while the site rests (restUntil: when it wakes, in seconds). */
export function rateDecide(rec, t, P, restUntil, addr) {
  if (P != null && rec.start != null && t - rec.start < RW.ROUND && rec.used < RW.ROUND_MAX) {
    rec.used++;
    return { kind: 'ok', pace: P, inRound: true };
  }
  const open = rec.start == null ? t : rec.start + (P == null ? Infinity : P) - RW.EARLY;
  if (P != null && t >= open) {
    if (addr) {
      addr.starts = addr.starts.filter((s) => t - s < P - RW.EARLY);
      if (addr.starts.length >= RW.ADDRESS_ROUNDS) {
        const held0 = rec.refused > 0;
        rec.refused++;
        return { kind: 'pc', pace: P, retry: Math.max(1, Math.ceil(addr.starts[0] + P - RW.EARLY - t)), held: held0,
          gap: rec.start == null ? Infinity : t - rec.start, judged: Math.min(rec.given || RW.STANDARD, RW.STANDARD), address: true };
      }
      addr.starts.push(t);
    }
    // Answered inside the five seconds' grace: counted for Site Backend, the decision is the same.
    const early = rec.start != null && t < rec.start + P;
    rec.start = t; rec.used = 1; rec.given = P; rec.refused = 0;
    return early ? { kind: 'ok', pace: P, early: true } : { kind: 'ok', pace: P };
  }
  const gap = rec.start == null ? Infinity : t - rec.start;
  const judged = Math.min(rec.given || RW.STANDARD, RW.STANDARD);
  const kind = gap < judged - RW.EARLY ? 'tf' : 'pc';
  const held = rec.refused > 0;
  rec.refused++;
  return { kind, pace: P, retry: Math.max(1, Math.ceil((P == null ? restUntil : open) - t)), held, gap, judged,
    over: P != null && gap < RW.ROUND };
}

/** Seconds in words. */
export function durWords(sec) {
  if (sec == null) return '—';
  if (sec < 60) return sec + ' seconds';
  if (sec === 60) return '1 minute';
  if (sec % 3600 === 0) return (sec / 3600) + (sec === 3600 ? ' hour' : ' hours');
  return Math.round(sec / 60) + ' minutes';
}

/** The words a refusal carries, in the body's message (or, for Google Sheets, in its one cell). */
export function refusalWords(d, sheets) {
  const every = (s) => (s === 60 ? 'one round a minute' : 'one round every ' + durWords(s));
  const secs = (s) => { s = Math.round(s); return s === 1 ? '1 second' : durWords(s); };
  if (sheets) {
    if (d.pace == null) return 'The site is resting until 00:00 UTC. This sheet fills in again at its first refresh after that.';
    return 'This sheet asked too soon. The site allows ' + every(d.kind === 'tf' ? d.judged : d.pace) + ', so it fills in again at its next refresh.';
  }
  if (d.over) return 'This program asked more than five times in ten seconds. The site allows ' + every(d.judged) + ', of up to five requests. It should stop until it is fixed.';
  if (d.kind === 'tf') return 'This program asked after ' + secs(d.gap) + ', but the site allows ' + every(d.judged) + '. It should stop until its interval is fixed.';
  if (d.pace == null) return 'The site is resting until 00:00 UTC. Pause your program and ask again then.';
  if (d.address) return 'Four programs at this address have already asked in this ' + (d.pace === 60 ? 'minute' : 'interval') + ', the most one address may. Pause this program and ask again in ' + secs(d.retry) + '.';
  if (d.pace <= 60) return 'Games are over or the site is less quiet, so it now allows ' + every(d.pace) + '. Your program asked after ' + secs(d.gap) + '. Pause it and ask again in ' + secs(d.retry) + '.';
  return 'The site is busy, so it now allows ' + every(d.pace) + '. Your program asked after ' + secs(d.gap) + '. Pause it and ask again in ' + secs(d.retry) + '.';
}

/** A program's name at an address: up to 10 names each keep a window; any further name shares the unnamed one. */
export function programName(addr, name) {
  const n = String(name || '');
  if (!n) return '';
  addr.names = addr.names || [];
  if (addr.names.includes(n)) return n;
  if (addr.names.length >= RW.NAMES) return '';
  addr.names.push(n);
  return n;
}

const newRec = () => ({ start: null, used: 0, given: null, refused: 0 });

/**
 * One address's windows, as the object and an isolate's memory both keep them. `decide()` applies the rule to
 * one request and returns the decision with the program's record after it.
 */
export function decideFor(state, name, t, P, restUntil) {
  state.addr = state.addr || { starts: [], names: [] };
  state.progs = state.progs || {};
  const prog = programName(state.addr, name);
  const rec = state.progs[prog] || (state.progs[prog] = newRec());
  const d = rateDecide(rec, t, P, restUntil, state.addr);
  state.seen = t;
  return { ...d, prog, rec: { ...rec } };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

/**
 * The pace record: one per key and address. Writes only its own storage (one row per answered request, the
 * address's windows together), and answers from memory while it stays warm.
 */
export class SourcePaceDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.data = null;
  }

  async load() {
    if (this.data) return this.data;
    try { this.data = (await this.state.storage.get('state')) || {}; } catch { this.data = {}; }
    return this.data;
  }

  async fetch(request) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/decide') {
        const b = await request.json();
        const st = await this.load();
        const d = decideFor(st, b.name, Number(b.t), b.P == null ? null : Number(b.P), Number(b.restUntil) || null);
        // Only an answered request changes what has to survive an eviction; a refusal's count lives in memory.
        if (d.kind === 'ok') await this.state.storage.put('state', st);
        return json({ ok: true, d });
      }
      if (url.pathname === '/peek') return json({ ok: true, state: await this.load() });
      return json({ ok: false, error: 'unknown route' }, 404);
    } catch (err) {
      return json({ ok: false, error: String((err && err.message) || err) }, 500);
    }
  }
}
