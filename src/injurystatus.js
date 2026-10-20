/**
 * When ESPN's two injury statuses disagree, the newer wins (week 6, PD39).
 *
 * A player's status reaches the site twice: on his fantasy record (rosters, the player pool, live scoring) and in
 * ESPN's league-wide injury report. They can disagree for hours: Saquon Barkley read QUESTIONABLE on the site while
 * the report had said OUT for six hours (audit, 16 October). The report dates each entry; the fantasy record carries
 * no date, so the site keeps a small ledger of when it first saw each player's fantasy status and compares the two.
 *
 * The digests that carry a status declare `injuryCheck: true` in DERIVATIONS; the refresh runner hands their build a
 * `ctx.injury.pick(id, status)` built here from the stored injury report and the ledger, and saves the ledger after
 * the build when it changed. A build without it (a test, an old caller) keeps the fantasy status unchanged.
 */

export const LEDGER_KEY = 'meta/injury-seen.json';

/** The injury report's words in the fantasy record's vocabulary. */
export function fantasyStatus(report) {
  const s = String(report || '').toUpperCase().replace(/[\s-]+/g, '_');
  if (!s) return null;
  if (s === 'INJURED_RESERVE' || s === 'IR') return 'INJURY_RESERVE';
  if (s === 'SUSPENDED') return 'SUSPENSION';
  return s;
}

/** The report as a lookup: ESPN athlete id → { status, at }. */
export function reportIndex(digest) {
  const out = new Map();
  for (const p of (digest && digest.players) || []) {
    if (p.id == null) continue;
    const at = Date.parse(p.date || '');
    const status = fantasyStatus(p.status);
    if (!status || !Number.isFinite(at)) continue;
    const prev = out.get(String(p.id));
    if (!prev || at > prev.at) out.set(String(p.id), { status, at });
  }
  return out;
}

/**
 * The picker a build uses. `ledger` is { [id]: { s, at } } and is updated in place: a fantasy status not seen before
 * (or changed) is stamped `now`. The report wins only when it disagrees and was written after that stamp.
 */
export function makePicker(report, ledger, now = Date.now()) {
  let changed = false;
  const pick = (id, status) => {
    const s = status || 'ACTIVE';
    if (id == null) return s;
    const k = String(id);
    const e = ledger[k];
    if (!e || e.s !== s) { ledger[k] = { s, at: now }; changed = true; }
    const r = report.get(k);
    if (r && r.status !== s && r.at > ledger[k].at) return r.status;
    return s;
  };
  return { pick, changed: () => changed };
}

export async function loadPicker(env, now = Date.now()) {
  let report = new Map(), ledger = {};
  try { const o = await env.DATA.get('data/injuries_digest/main.json'); if (o) report = reportIndex(await o.json()); } catch { /* the fantasy status stands */ }
  try { const o = await env.DATA.get(LEDGER_KEY); if (o) ledger = (await o.json()) || {}; } catch { ledger = {}; }
  const p = makePicker(report, ledger, now);
  return {
    pick: p.pick,
    save: async () => {
      if (!p.changed()) return false;
      // Players not seen for a season fall out: the ledger stays small.
      for (const [k, v] of Object.entries(ledger)) if (now - v.at > 200 * 86400000) delete ledger[k];
      try { await env.DATA.put(LEDGER_KEY, JSON.stringify(ledger)); return true; } catch { return false; }
    },
  };
}
