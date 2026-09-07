/**
 * Refresh engine.
 *
 * Fetches whichever parts of a dataset are stale, streams them into R2 and
 * writes a compact status document. Never throws on an individual part failure
 * — the whole point is to surface every failure in one sweep rather than
 * stopping at the first one.
 *
 * Stale-while-revalidate: a failed fetch leaves the previous good R2 copy
 * exactly where it was, so a page always has something to serve.
 */

import { fetchPart, mapLimit, inspectBody } from './espn.js';
import { noteEspnAuth, readAuthOutcome } from './espnhealth.js';
import { headPart, getPart, putPart, writeStatus, readStatus, isFresh, ageSeconds } from './store.js';
import { canCallEspn } from './config.js';
import { derivationsFor } from './derive.js';
import { getDataset } from './datasets.js';
import { coordinatorRefresh } from './dedupe.js';

const CONCURRENCY = 5; // Workers allow 6 simultaneous outgoing connections

/**
 * Fetch a payload another dataset's digest depends on, refreshing it first if
 * it is missing or stale.
 *
 * This is not an optimisation, it is a correctness requirement. Team names,
 * abbreviations, owners and logos live only in the small `mTeam` payload, and
 * the standings, matchup and transaction digests all join against it. Reading
 * it opportunistically — the previous behaviour — meant that on a deployment
 * where nothing had ever requested `league_teams` directly, every digest was
 * built against an empty identity map and quietly rendered "Team 1", "Team 2"
 * for the life of the site. Nothing on any request path ever fetched it, so
 * the gap never closed on its own.
 *
 * The refresh is routed through the coordinator rather than run inline so that
 * two digests rebuilding at once share a single upstream call, and so the work
 * is charged to that dataset's own invocation rather than piling onto this one.
 */
async function ensureSource(env, key) {
  const dataset = getDataset(key);
  if (!dataset) return null;
  const head = await headPart(env, key, 'main');
  if (!head || !isFresh(head.uploaded, dataset.ttl)) {
    await coordinatorRefresh(env, key, false);
  }
  return getPart(env, key, 'main');
}

export async function refreshDataset(env, cfg, dataset, { force = false } = {}) {
  const startedAt = Date.now();

  // Derived datasets are produced as a by-product of their source, never
  // fetched. Refreshing one means refreshing what it is built from.
  if (dataset.derivedFrom) {
    const source = getDataset(dataset.derivedFrom);
    if (!source) {
      return {
        key: dataset.key, label: dataset.label, tier: dataset.tier, ok: false,
        error: `derived from unknown dataset "${dataset.derivedFrom}"`,
        parts: [], counts: { fetched: 0, skipped: 0, empty: 0, failed: 0 },
        startedAt: new Date(startedAt).toISOString(), ms: 0,
      };
    }
    const sourceReport = await refreshDataset(env, cfg, source, { force });
    return {
      key: dataset.key, label: dataset.label, tier: dataset.tier, ttl: dataset.ttl,
      startedAt: new Date(startedAt).toISOString(), ms: Date.now() - startedAt,
      forced: force, ok: sourceReport.ok, derivedFrom: dataset.derivedFrom,
      parts: [{
        part: 'main',
        action: sourceReport.derived ? 'derived' : 'skipped-fresh',
        ok: sourceReport.ok,
        bytes: sourceReport.derived && sourceReport.derived.bytes,
      }],
      counts: { fetched: sourceReport.derived ? 1 : 0, skipped: sourceReport.derived ? 0 : 1, empty: 0, failed: sourceReport.ok ? 0 : 1 },
      sourceReport,
    };
  }

  if (!canCallEspn(cfg, dataset.auth)) {
    const report = {
      key: dataset.key,
      startedAt: new Date(startedAt).toISOString(),
      ms: 0,
      forced: force,
      ok: false,
      blocked: true,
      reason: dataset.auth
        ? 'league id and ESPN cookies are required for this dataset'
        : 'league id is not configured',
      parts: [],
      counts: { fetched: 0, skipped: 0, failed: 0 },
    };
    return report;
  }

  const parts = dataset.parts(cfg);

  // Which parts actually need a fetch? head() is an internal subrequest and
  // costs no body transfer.
  const heads = await Promise.all(parts.map((p) => headPart(env, dataset.key, p.part)));

  // Negative cache. Some datasets legitimately hold no data outside the regular
  // season (ESPN answers 404 "No stats found"). Without this, every request for
  // one of those would re-run the whole sweep — 32 pointless ESPN calls for team
  // season stats in August — because nothing was stored to look fresh.
  const emptySince = new Map();
  if (dataset.allowEmpty && !force) {
    const prior = await readStatus(env, dataset.key);
    if (prior && Array.isArray(prior.parts)) {
      for (const p of prior.parts) {
        if (p.action === 'empty' && p.at) emptySince.set(String(p.part), p.at);
      }
    }
  }

  const work = [];
  const results = [];
  parts.forEach((p, i) => {
    const existing = heads[i];
    const fresh = existing && isFresh(existing.uploaded, dataset.ttl);
    const emptyAt = emptySince.get(String(p.part));
    if (!force && !existing && emptyAt && isFresh(emptyAt, Math.max(dataset.ttl, 300))) {
      results.push({
        part: p.part,
        action: 'empty',
        ok: true,
        cached: true,
        at: emptyAt,
        ageSeconds: ageSeconds(emptyAt),
      });
      return;
    }
    if (!force && fresh) {
      results.push({
        part: p.part,
        action: 'skipped-fresh',
        ok: true,
        bytes: existing.size,
        ageSeconds: ageSeconds(existing.uploaded),
      });
    } else {
      work.push({ p, existing });
    }
  });

  const fetched = await mapLimit(work, CONCURRENCY, async ({ p, existing }) => {
    const res = await fetchPart(cfg, p, { auth: dataset.auth, timeoutMs: dataset.timeoutMs });
    // Always inspect, including on failure — a 403's body is what identifies
    // an Akamai denial vs. a genuine permissions problem, and leaving it
    // uncaptured costs a whole extra diagnose-and-redeploy round trip.
    const probe = res.buffer ? inspectBody(res.buffer, dataset.expect) : null;

    // A 200 that isn't JSON (an HTML login wall, say) is a failure, not a success.
    const usable = res.ok && probe && probe.looksJson;

    if (usable) {
      await putPart(env, dataset.key, p.part, res.buffer, {
        fetchedAt: new Date().toISOString(),
        sourceStatus: res.status,
        ttl: dataset.ttl,
        bytes: res.bytes,
      });
      return {
        part: p.part,
        action: 'fetched',
        ok: true,
        status: res.status,
        bytes: res.bytes,
        ms: res.ms,
        contentType: res.contentType,
        hasExpected: probe.hasExpected,
        closed: probe.closed,
        head: probe.head,
        viaFallback: res.viaFallback || null,
        url: p.url,
      };
    }

    // A 404 carrying a small JSON error body is ESPN saying "nothing here yet",
    // not a broken URL. For datasets flagged allowEmpty that is an expected
    // state, recorded distinctly so it stays visible without reading as a fault.
    if (dataset.allowEmpty && res.status === 404 && probe && probe.looksJson) {
      return {
        part: p.part,
        action: 'empty',
        ok: true,
        status: 404,
        bytes: res.bytes,
        ms: res.ms,
        at: new Date().toISOString(),
        head: probe.head,
        url: p.url,
      };
    }

    return {
      part: p.part,
      action: 'failed',
      ok: false,
      status: res.status,
      bytes: res.bytes,
      ms: res.ms,
      contentType: res.contentType,
      error:
        (res.error || '') +
        (probe && probe.reason ? ` — ${probe.reason}` : '') +
        (res.fallbackTried ? ` — fallback host also ${res.fallbackStatus}` : ''),
      head: probe ? probe.head : '',
      keptStale: Boolean(existing),
      url: p.url,
    };
  });

  const all = results.concat(fetched);
  all.sort((a, b) => String(a.part).localeCompare(String(b.part), undefined, { numeric: true }));

  // Only an authenticated dataset can say anything about the credentials. An
  // unauthenticated 403 is ESPN's bot protection, which is a different problem
  // wearing the same status code.
  if (dataset.auth && fetched.length) {
    const outcome = readAuthOutcome(fetched);
    if (outcome) await noteEspnAuth(env, outcome);
  }

  const counts = {
    fetched: all.filter((r) => r.action === 'fetched').length,
    skipped: all.filter((r) => r.action === 'skipped-fresh').length,
    empty: all.filter((r) => r.action === 'empty').length,
    failed: all.filter((r) => r.action === 'failed').length,
  };

  const report = {
    key: dataset.key,
    label: dataset.label,
    tier: dataset.tier,
    ttl: dataset.ttl,
    startedAt: new Date(startedAt).toISOString(),
    ms: Date.now() - startedAt,
    forced: force,
    ok: counts.failed === 0,
    parts: all,
    counts,
  };

  // Build any derived digest from the freshly stored payload.
  //
  // Normally this only runs when the source actually changed, so a no-op sweep
  // costs nothing extra. The exception is a digest whose source never changes
  // but which is not itself only about that source — head-to-head is built from
  // the historical seasons, which are immutable, yet has to pick up this
  // season's meetings as they are played. Without the staleness check below,
  // such a digest is built exactly once and then frozen forever, because its
  // source is never refetched again.
  //
  // A source may drive several digests. They are built in registry order, and
  // each is judged on its own staleness — one digest going stale must not force
  // its siblings to rebuild, and a sibling that throws must not stop the rest.
  const derivations = derivationsFor(dataset.key);
  const derivedReports = [];
  for (const derivation of derivations) {
    let targetStale = false;
    if (derivation.target && counts.fetched === 0) {
      const targetSpec = getDataset(derivation.target);
      if (targetSpec && targetSpec.ttl > 0) {
        const head = await headPart(env, derivation.target, 'main');
        targetStale = !head || !isFresh(head.uploaded, targetSpec.ttl);
      }
    }
    if (!(counts.fetched > 0 || targetStale)) continue;

    try {
      let digest = null;

      // Dependencies are resolved the same way for both build styles, so a
      // multi-part build can name what it needs exactly as a single-part one
      // does rather than reaching for R2 itself.
      const ctx = {};
      if (Array.isArray(derivation.needs) && derivation.needs.length) {
        ctx.sources = {};
        for (const key of derivation.needs) {
          const o = await ensureSource(env, key);
          if (o) {
            try { ctx.sources[key] = await o.json(); } catch { /* leave absent */ }
          }
        }
      }

      if (derivation.buildMulti) {
        // Sources spread across many parts build from the parts directly.
        digest = await derivation.buildMulti({
          ...ctx,
          env,
          teamIds: parts.map((p) => p.part),
          readPart: async (part) => {
            const o = await getPart(env, dataset.key, part);
            return o ? o.json() : null;
          },
          // A multi-part build that also needs a single current dataset asks
          // for it by name, resolved through the coordinator like any other
          // dependency rather than read hopefully from R2.
          readCurrent: derivation.current
            ? async () => {
                const o = await ensureSource(env, derivation.current);
                return o ? o.json() : null;
              }
            : null,
        });
      } else {
        const source = await getPart(env, dataset.key, 'main');
        if (source) {
          if (derivation.needsByeMap) {
            // Fetched when entirely absent, then left alone until its own TTL
            // expires. The reconstruction costs 32 upstream calls, so forcing
            // it on every rebuild would be disproportionate — but leaving it
            // purely opportunistic was worse: before week one the stat-split
            // fallback has no splits to read, so on a site where nothing had
            // ever requested it every player's bye came back as week 0.
            let byeObj = await getPart(env, 'bye_weeks', 'main');
            if (!byeObj) {
              await coordinatorRefresh(env, 'bye_weeks', false);
              byeObj = await getPart(env, 'bye_weeks', 'main');
            }
            if (byeObj) {
              try { ctx.byeMap = (await byeObj.json()).byes || {}; } catch { ctx.byeMap = {}; }
            }
          }
          digest = derivation.build(await source.json(), ctx);
        }
      }

      if (digest) {
        const body = new TextEncoder().encode(JSON.stringify(digest));
        await putPart(env, derivation.target, 'main', body.buffer, {
          fetchedAt: new Date().toISOString(),
          derivedFrom: dataset.key,
          bytes: body.byteLength,
        });
        derivedReports.push({ target: derivation.target, bytes: body.byteLength, entries: digest.count });
      }
    } catch (err) {
      derivedReports.push({ target: derivation.target, error: String((err && err.message) || err) });
    }
  }
  if (derivedReports.length) {
    // `derived` stays the single-object shape every existing reader expects;
    // `derivedAll` carries the rest so a multi-digest source reports honestly.
    [report.derived] = derivedReports;
    if (derivedReports.length > 1) report.derivedAll = derivedReports;
  }

  // Only rewrite the status document when the sweep actually changed something.
  // A sweep where every part was already fresh has nothing new to record, and
  // rewriting it anyway would double this dataset's R2 Class A operations for
  // no benefit — the single largest avoidable cost in the whole data layer.
  //
  // The derivation now runs before this rather than after, so a digest that
  // threw is recorded in the status document instead of being swallowed. A
  // derivation can fail while every fetch succeeded, and the dataset then reads
  // as COMPLETE with nothing derived from it — which is precisely the sort of
  // fault that is invisible until somebody goes looking for it.
  const changed = counts.fetched > 0 || counts.failed > 0 ||
    all.some((r) => r.action === 'empty' && !r.cached);

  if (changed) {
    // Persisted status omits `head` (raw payload prefix) so nothing that could
    // carry league-member data ever lands in a second place on disk.
    await writeStatus(env, dataset.key, {
      ...report,
      parts: all.map(({ head, url, ...rest }) => rest),
    });
  }
  report.statusWritten = changed;

  return report;
}
