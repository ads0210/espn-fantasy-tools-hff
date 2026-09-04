/**
 * Historical pull.
 *
 * Roughly 1,450 ESPN calls across several seasons, driven from the browser one
 * batch at a time. Free-plan Workers allow 50 external subrequests per
 * invocation, so this cannot be one request — and it should not be a background
 * job either, because there is no way to show progress for one.
 *
 * Job state lives in R2 rather than KV: it is written once per batch, and KV's
 * free tier allows only 1,000 writes a day across the whole site. R2 has no
 * comparable daily ceiling.
 *
 * The job is a queue, so an interruption resumes from where it stopped instead
 * of starting over — closing the tab mid-pull costs nothing but time.
 */

import { fetchPart, mapLimit, inspectBody } from './espn.js';
import { putPart, headPart } from './store.js';
import { historySeasons } from './datasets.js';

const JOB_KEY = 'jobs/history.json';

/**
 * Batch sizing is per phase, because the two phases cost wildly different
 * amounts of work per call.
 *
 * Enumerating a week's events returns a small index document. Fetching a game
 * summary returns the whole game — box score, drives, play-by-play — which runs
 * to megabytes. Twenty-four of those in one invocation meant decompressing and
 * re-emitting something like 24MB inside a single Free-plan request, which sat
 * right on the resource ceiling: it usually passed and occasionally did not,
 * surfacing as an unexplained 503 partway through a thousand-step pull.
 *
 * The event phase is therefore bounded twice over — by count and by bytes
 * actually transferred — so one unusually heavy run of games cannot push an
 * invocation over. Whatever is left over goes back on the queue and rides in
 * the next batch, which costs a round trip and nothing else.
 */
const WEEK_BATCH = 24;
const EVENT_BATCH = 8;
const EVENT_BYTE_BUDGET = 6 * 1024 * 1024;
const WEEK_CONCURRENCY = 5;
const EVENT_CONCURRENCY = 3;

const CORE = 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl';
const SITE = 'https://site.web.api.espn.com/apis/site/v2/sports/football/nfl';

const MAX_RECORDED_FAILURES = 60;

/**
 * How many times a single week or game is attempted before it is written off.
 *
 * Skipping on first failure was wrong. Nearly everything that goes wrong here
 * is transient — a rate limit, a momentary store error, an invocation that ran
 * out of subrequest allowance — and a pull that sails past those and reports
 * "complete, 302 failures" has quietly lost 302 games that were never actually
 * unavailable. Anything that fails goes to the back of a retry queue and is
 * tried again once the first pass is done, so a transient fault costs a second
 * attempt rather than a hole in the archive. Only something that fails every
 * attempt is recorded as a genuine failure.
 */
const MAX_TRIES = 3;

/**
 * Record a failure without letting the list grow without bound. The job
 * document is rewritten on every batch, and a pull where a whole season is
 * unavailable would otherwise accumulate a thousand strings and rewrite all of
 * them, over a thousand times.
 */
function noteFailure(job, message) {
  job.failureTotal = (job.failureTotal || 0) + 1;
  if (job.failures.length < MAX_RECORDED_FAILURES) job.failures.push(message);
}

export async function readJob(env) {
  try {
    const obj = await env.DATA.get(JOB_KEY);
    if (!obj) return null;
    return await obj.json();
  } catch {
    return null;
  }
}

async function writeJob(env, job) {
  await env.DATA.put(JOB_KEY, JSON.stringify(job), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });
}

export async function clearJob(env) {
  try {
    await env.DATA.delete(JOB_KEY);
  } catch { /* nothing to clear */ }
}

/**
 * Build a fresh job. Phase 1 enumerates each season-week's events; phase 2
 * fetches one box score per event. Weeks are queued up front so total progress
 * is knowable from the start rather than growing as it goes.
 */
export function buildJob(cfg) {
  const seasons = [...new Set([...(historySeasons(cfg) || []), Number(cfg.season)])]
    .filter((y) => Number.isFinite(y))
    .sort((a, b) => a - b);

  const weeks = [];
  for (const season of seasons) {
    for (let week = 1; week <= 18; week++) weeks.push({ season, week });
  }

  return {
    startedAt: new Date().toISOString(),
    seasons,
    phase: 'weeks',
    weekQueue: weeks,
    weeksTotal: weeks.length,
    weeksDone: 0,
    eventQueue: [],
    eventsTotal: 0,
    eventsDone: 0,
    // Anything that failed an attempt but has attempts left. Drained back into
    // the main queue once the first pass is done.
    weekRetry: [],
    eventRetry: [],
    retryRound: 0,
    failures: [],
    failureTotal: 0,
    complete: false,
  };
}

function progress(job) {
  // Weeks are cheap and events are the bulk of the work, so weight accordingly
  // once the event count is actually known.
  const total = job.weeksTotal + (job.eventsTotal || 0);
  const done = job.weeksDone + (job.eventsDone || 0);
  return { total, done };
}

export function jobStatus(job) {
  if (!job) return { ok: true, running: false, complete: false, done: 0, total: 0 };
  const { total, done } = progress(job);
  return {
    ok: true,
    running: !job.complete,
    complete: Boolean(job.complete),
    phase: job.phase,
    done,
    total,
    seasons: job.seasons,
    eventsTotal: job.eventsTotal,
    eventsDone: job.eventsDone,
    failures: job.failures.slice(-10),
    failureCount: job.failureTotal != null ? job.failureTotal : job.failures.length,
    retrying: (job.eventRetry || []).length + (job.weekRetry || []).length,
    retryRound: job.retryRound || 0,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt || null,
  };
}

/**
 * Run one batch. Returns the job status plus a human label for the progress UI.
 */
/** A job document is only usable if it still has the pieces a batch needs. */
function jobIsUsable(job) {
  return Boolean(job) && Array.isArray(job.weekQueue) && Array.isArray(job.eventQueue) &&
    Array.isArray(job.failures);
}

/** Older job documents predate the retry queues; treat them as empty. */
function normaliseJob(job) {
  if (!Array.isArray(job.weekRetry)) job.weekRetry = [];
  if (!Array.isArray(job.eventRetry)) job.eventRetry = [];
  if (typeof job.retryRound !== 'number') job.retryRound = 0;
  return job;
}

export async function runBatch(env, cfg, { restart = false } = {}) {
  let job = restart ? null : await readJob(env);
  // Rebuilding is cheap and idempotent: already-stored games are skipped by the
  // head check, so a job that cannot be read is started again rather than
  // leaving the pull permanently unable to move.
  if (job && !jobIsUsable(job)) job = null;
  if (job) normaliseJob(job);
  if (!job) {
    job = buildJob(cfg);
    await writeJob(env, job);
  }
  if (job.complete) return { ...jobStatus(job), label: 'Already complete' };

  let label = '';

  if (job.phase === 'weeks') {
    const slice = job.weekQueue.splice(0, WEEK_BATCH);
    if (!slice.length) {
      job.phase = 'events';
      job.eventsTotal = job.eventQueue.length;
    } else {
      const results = await mapLimit(slice, WEEK_CONCURRENCY, async (w) => {
        try {
        const url = `${CORE}/seasons/${w.season}/types/2/weeks/${w.week}/events?limit=100`;
        const res = await fetchPart(cfg, { url }, { auth: false });
        if (!res.ok || !res.buffer) return { w, ids: [], error: res.error };
        try {
          const doc = JSON.parse(new TextDecoder().decode(res.buffer));
          const ids = (doc.items || [])
            .map((i) => {
              const m = /\/events\/(\d+)/.exec(i.$ref || '');
              return m ? m[1] : null;
            })
            .filter(Boolean);
          return { w, ids };
        } catch (err) {
          return { w, ids: [], error: 'unparseable event list' };
        }
        } catch (err) {
          return { w, ids: [], error: String(err && err.message ? err.message : err) };
        }
      });

      for (const r of results) {
        if (r.error) {
          const tries = (r.w.tries || 0) + 1;
          if (tries < MAX_TRIES) {
            job.weekRetry.push({ season: r.w.season, week: r.w.week, tries });
          } else {
            job.weeksDone += 1;
            noteFailure(job, `${r.w.season} wk${r.w.week}: ${r.error}`);
          }
          continue;
        }
        job.weeksDone += 1;
        for (const id of r.ids) job.eventQueue.push({ id, season: r.w.season });
      }
      const last = slice[slice.length - 1];
      label = `Season ${last.season}, week ${last.week}`;
      if (!job.weekQueue.length && job.weekRetry.length) {
        // Second pass over whatever did not answer the first time.
        job.weekQueue = job.weekRetry;
        job.weekRetry = [];
        job.retryRound += 1;
        label = `Retrying ${job.weekQueue.length} week` +
          (job.weekQueue.length === 1 ? '' : 's');
      } else if (!job.weekQueue.length) {
        job.phase = 'events';
        job.eventsTotal = job.eventQueue.length;
      }
    }
  } else if (job.phase === 'events') {
    if (!job.eventQueue.length && job.eventRetry.length) {
      job.eventQueue = job.eventRetry;
      job.eventRetry = [];
      job.retryRound += 1;
    }
    const slice = job.eventQueue.splice(0, EVENT_BATCH);
    if (!slice.length) {
      job.complete = true;
      job.finishedAt = new Date().toISOString();
    } else {
      let transferred = 0;
      let taken = 0;
      // Counted separately from "attempted": a game sent back for another try
      // has not been dealt with yet, and must not move the meter.
      let resolved = 0;

      // Sub-chunked so the byte budget is checked between groups rather than
      // only after the whole slice has already been pulled.
      for (let i = 0; i < slice.length; i += EVENT_CONCURRENCY) {
        const chunk = slice.slice(i, i + EVENT_CONCURRENCY);
        const sizes = await mapLimit(chunk, EVENT_CONCURRENCY, async (ev) => {
          const give = (message) => {
            // Back of the retry queue while attempts remain; only a game that
            // fails every attempt is written off and reported.
            const tries = (ev.tries || 0) + 1;
            if (tries < MAX_TRIES) {
              job.eventRetry.push({ id: ev.id, season: ev.season, tries });
            } else {
              resolved += 1;
              noteFailure(job, message);
            }
          };

          // One game must never be able to stop the pull.
          //
          // Anything thrown in here used to escape the whole batch: the slice
          // had already been spliced off the queue but the job was never
          // written, so the queue did not advance. The next attempt read the
          // same job, took the same slice, hit the same game and threw again.
          // A single game the platform refused to store — a transient R2 error,
          // an oversized payload — turned into a permanent stall, and the
          // resume button was just a slower way of hitting it again. The
          // symptom was a retry counter climbing while the meter never moved.
          try {
            // Already stored from a previous run? Skip the call entirely.
            const existing = await headPart(env, 'game_summary', ev.id);
            if (existing) { resolved += 1; return 0; }

            const res = await fetchPart(cfg, { url: `${SITE}/summary?event=${ev.id}` }, { auth: false });
            const probe = res.buffer ? inspectBody(res.buffer, 'boxscore') : null;
            if (!res.ok || !probe || !probe.looksJson) {
              give(`event ${ev.id}: ${res.error || 'unusable response'}`);
              return res.bytes || 0;
            }
            await putPart(env, 'game_summary', ev.id, res.buffer, {
              fetchedAt: new Date().toISOString(),
              season: ev.season,
              bytes: res.bytes,
            });
            resolved += 1;
            return res.bytes || 0;
          } catch (err) {
            give(`event ${ev.id}: ${String(err && err.message ? err.message : err)}`);
            return 0;
          }
        });

        taken += chunk.length;
        for (const n of sizes) transferred += n || 0;
        if (transferred >= EVENT_BYTE_BUDGET) break;
      }

      // Anything the budget cut short goes back to the front of the queue, in
      // order, so nothing is skipped and nothing is fetched twice.
      if (taken < slice.length) job.eventQueue.unshift(...slice.slice(taken));

      job.eventsDone += resolved;
      label = `Game results (${job.eventsDone} of ${job.eventsTotal})`;
      if (!job.eventQueue.length && job.eventRetry.length) {
        job.eventQueue = job.eventRetry;
        job.eventRetry = [];
        job.retryRound += 1;
        label = `Retrying ${job.eventQueue.length} game` +
          (job.eventQueue.length === 1 ? '' : 's');
      } else if (!job.eventQueue.length) {
        job.complete = true;
        job.finishedAt = new Date().toISOString();
      }
    }
  }

  await writeJob(env, job);
  return { ...jobStatus(job), label: label || (job.complete ? 'Complete' : 'Working') };
}
