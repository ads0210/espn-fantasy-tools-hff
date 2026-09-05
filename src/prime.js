/**
 * The prime pass: fetch every dataset in the registry, once, up front.
 *
 * Why this exists
 * ---------------
 * The platform fetches on demand. That is the right behaviour steady-state, but
 * it means a dataset nothing has yet asked for simply does not exist, and a
 * surface that reads it without being able to trigger it reads nothing. Two
 * separate faults on a fresh deployment came from exactly that shape, and the
 * second survived a fix to the first:
 *
 *   - The identity payloads (league settings, teams, players) were read
 *     opportunistically and never fetched, so a configured site showed
 *     "Team 1" and no league name.
 *   - Bye weeks are reconstructed from 32 NFL team schedules. That derivation
 *     is a soft dependency, because forcing it would drag 32 upstream calls
 *     into whatever request happened to trigger it. Nothing else asks for it
 *     either, so before week one — when the stat-split fallback has no splits
 *     to read — every player's bye came back as week 0.
 *
 * Both are the same bug: correctness that depends on somebody having visited
 * the right page first. Priming removes the class rather than the instances.
 * Anything added to the registry later is covered automatically.
 *
 * Shape
 * -----
 * Batching reuses planBatches, which already isolates the 32-part datasets into
 * batches of their own and packs the rest under a call ceiling. Each key is
 * refreshed through the coordinator, so the work is charged to that dataset's
 * own invocation rather than accumulating in this request, and a refresh
 * already in flight is joined rather than duplicated.
 *
 * Derived digests are appended after the sources they read. planBatches skips
 * them — they are produced from a source rather than fetched — but a source
 * refresh does not rebuild them, so priming has to ask for each one explicitly.
 *
 * Probe-tier datasets are included and allowed to fail. The point is that every
 * dataset has been attempted and has either a value or a recorded reason.
 */

import { DATASETS, getDataset, planBatches } from './datasets.js';
import { refreshLogos } from './logos.js';
import { coordinatorRefresh } from './dedupe.js';

const JOB_KEY = 'jobs/prime.json';
const CALLS_PER_BATCH = 24;

/**
 * Attempts per dataset before it is written off.
 *
 * Same reasoning as the history pull: most of what goes wrong upstream is
 * transient, and a pass that reports "done, with failures" has left the site
 * with exactly the empty datasets this pass exists to prevent. A key that fails
 * goes back for another attempt after the first sweep finishes, and only
 * something that fails every time is reported.
 */
const MAX_TRIES = 3;

async function writeJob(env, job) {
  await env.DATA.put(JOB_KEY, JSON.stringify(job), {
    httpMetadata: { contentType: 'application/json' },
  });
}

async function loadJob(env) {
  const obj = await env.DATA.get(JOB_KEY);
  if (!obj) return null;
  try {
    return await obj.json();
  } catch {
    return null;
  }
}

/**
 * How many datasets one prime call handles.
 *
 * Well below the subrequest ceiling on purpose. The meter only moves when a
 * call returns, so a batch of twenty-four datasets sat at 0% and then jumped
 * straight to 43% — which reads as a stall followed by a glitch rather than as
 * steady progress. Smaller chunks cost a few more round trips and buy a meter
 * that actually moves, and a label that can say what is being fetched.
 */
const KEYS_PER_CALL = 6;

function chunk(keys, size) {
  const out = [];
  for (let i = 0; i < keys.length; i += size) out.push(keys.slice(i, i + size));
  return out;
}

/** Every key worth priming, sources first and derived digests after. */
export function primePlan(cfg) {
  const batches = planBatches(cfg, CALLS_PER_BATCH)
    .flatMap((keys) => (keys.length > KEYS_PER_CALL ? chunk(keys, KEYS_PER_CALL) : [keys.slice()]));
  const derived = DATASETS.filter((d) => d.derivedFrom && d.ttl > 0).map((d) => d.key);
  // One digest per batch: each is cheap in calls but reduces a whole payload,
  // and reducing several large ones in a single invocation is the one way this
  // pass could push against the CPU ceiling.
  for (const key of derived) batches.push([key]);
  return batches;
}

function newJob(cfg) {
  const batches = primePlan(cfg);
  return {
    startedAt: new Date().toISOString(),
    finishedAt: null,
    batches,
    index: 0,
    total: batches.reduce((n, b) => n + b.length, 0),
    done: 0,
    ok: 0,
    // Keys that failed but still have attempts left, with their attempt count.
    retry: {},
    retryRound: 0,
    failures: [],
    complete: false,
  };
}

function report(job, label) {
  return {
    ok: true,
    running: !job.complete,
    complete: job.complete,
    done: job.done,
    total: job.total,
    label: label || '',
    okCount: job.ok,
    failureCount: job.failures.length,
    retrying: Object.keys(job.retry || {}).length,
    retryRound: job.retryRound || 0,
    failures: job.failures.slice(0, 12),
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
  };
}

/** Status without doing any work, for rendering a resume affordance. */
export async function primeStatus(env) {
  const job = await loadJob(env);
  if (!job) return { ok: true, running: false, complete: false, done: 0, total: 0 };
  return report(job, '');
}

/**
 * Run one batch. Called repeatedly by the browser, exactly like the historical
 * pull, and driven by the same retrying client runner.
 */
export async function runPrimeBatch(env, cfg, { restart = false } = {}) {
  let job = restart ? null : await loadJob(env);
  if (!job || !Array.isArray(job.batches)) job = newJob(cfg);

  if (job.complete) return report(job, 'Complete');

  const batch = job.batches[job.index] || [];
  job.index += 1;

  // Name what this call is fetching, so the progress line says something
  // specific rather than repeating "Loading league data" for two minutes.
  const names = batch.map((k) => {
    const d = getDataset(k);
    return (d && d.label) || k;
  });
  const label = names.length > 2
    ? `${names.slice(0, 2).join(', ')} + ${names.length - 2} more`
    : names.join(', ');

  if (!job.retry) job.retry = {};
  if (typeof job.retryRound !== 'number') job.retryRound = 0;

  for (const key of batch) {
    let res = null;
    try {
      res = await coordinatorRefresh(env, key, false);
    } catch (err) {
      res = { ok: false, error: String(err) };
    }
    if (res && res.ok) {
      job.done += 1;
      job.ok += 1;
      delete job.retry[key];
      continue;
    }
    const why = (res && (res.error || (res.report && res.report.error))) || 'refresh failed';
    const tries = (job.retry[key] || 0) + 1;
    if (tries < MAX_TRIES) {
      // Not done yet — it gets another sweep before anyone is told it failed.
      job.retry[key] = tries;
    } else {
      job.done += 1;
      delete job.retry[key];
      job.failures.push(`${key}: ${String(why).slice(0, 160)}`);
    }
  }

  job.lastLabel = label;

  if (job.index >= job.batches.length) {
    const pending = Object.keys(job.retry);
    if (pending.length) {
      // Another sweep over only what has not answered yet.
      job.batches = pending.map((k) => [k]);
      job.index = 0;
      job.retryRound += 1;
    } else {
      job.complete = true;
      job.finishedAt = new Date().toISOString();
      // Copy the team logos now that the team view exists, so the dashboard has
      // them the first time anyone opens it rather than on the next cron pass.
      // A failure here is not a prime failure: the pass runs every five minutes
      // anyway, and a missing logo degrades to the shield.
      try {
        await refreshLogos(env, cfg);
      } catch (err) {
        job.logoError = String((err && err.message) || err).slice(0, 160);
      }
    }
  }

  await writeJob(env, job);
  return report(job, label || 'Finishing');
}
