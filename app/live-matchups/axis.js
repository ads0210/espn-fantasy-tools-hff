/**
 * The progression charts' horizontal axis.
 *
 * Extracted from the component so it can be tested by behaviour rather than by
 * matching source strings: the weighting rules here were previously asserted by
 * grepping the component, which broke on every refactor that changed nothing
 * observable and could not check the arithmetic at all.
 *
 * The frame is shared by all three charts in a section, so a vertical position
 * means the same instant in each of them.
 */

/* What an idle stretch is still worth on the axis.
   Enough to stay a legible band, because a week that silently omitted Friday
   and Saturday would misrepresent how long a matchup actually ran. */
export const MIN_DAY_SHARE = 0.07;

/* Nothing recorded for this long and the axis stops paying for it by the clock.
   Two hours is comfortably longer than any in-game lull — the cron samples
   every minute inside a game window — so a stretch this quiet is genuinely
   dead air rather than a slow patch of scoring. */
export const IDLE_MS = 2 * 60 * 60 * 1000;

/* An idle stretch is worth what an idle day used to be worth, and every idle
   stretch together can never take more than this much of the frame. Without a
   ceiling a week of short bursts would spend most of its width on the gaps
   between them, which is the problem this is here to solve. */
export const IDLE_BUDGET = 0.34;

/* A run with only one or two samples in it still needs to be findable. */
export const MIN_ACTIVE_SHARE = 0.012;

/**
 * Split one day into alternating active and idle runs.
 *
 * Collapsing whole empty days made a week readable, but it stopped at the day
 * boundary: a Sunday with games in it was drawn at full width even though
 * nothing at all happened between midnight and late morning, so the hours that
 * mattered were still squeezed by the hours that did not. Any stretch with no
 * samples in it is now collapsed, wherever it falls.
 *
 * Runs are cut at sample times, so a sample always sits on the edge of an
 * active run and never inside an idle one — an idle band with a data point in
 * the middle of it would be a contradiction, and would put that point at a
 * position the clock does not justify.
 */
export function splitIdle(day, times) {
  const inside = times.filter((t) => t >= day.start && t < day.segEnd);
  const idleRuns = [];
  if (!inside.length) {
    idleRuns.push([day.start, day.segEnd]);
  } else {
    if (inside[0] - day.start >= IDLE_MS) idleRuns.push([day.start, inside[0]]);
    for (let i = 1; i < inside.length; i++) {
      if (inside[i] - inside[i - 1] >= IDLE_MS) idleRuns.push([inside[i - 1], inside[i]]);
    }
    const last = inside[inside.length - 1];
    if (day.segEnd - last >= IDLE_MS) idleRuns.push([last, day.segEnd]);
  }

  const segs = [];
  let cursor = day.start;
  for (const [a, b] of idleRuns) {
    if (a > cursor) {
      segs.push({ start: cursor, end: a, idle: false });
    } else if (segs.length && segs[segs.length - 1].idle) {
      /* Two idle runs meeting at a single sample — a day with one lonely
         reading in the middle of it. Without a run of its own that sample
         would sit on the seam between two collapsed bands and have no width
         to be found in, so it gets a sliver. */
      segs.push({ start: cursor, end: cursor, idle: false });
    }
    segs.push({ start: a, end: b, idle: true });
    cursor = b;
  }
  if (cursor < day.segEnd) segs.push({ start: cursor, end: day.segEnd, idle: false });
  if (!segs.length) segs.push({ start: day.start, end: day.segEnd, idle: !inside.length });

  for (const seg of segs) {
    // An idle run holds no samples by construction: the runs are cut at sample
    // times, so a sample can only ever sit on one of its edges.
    seg.samples = seg.idle
      ? 0
      : inside.filter((t) => t >= seg.start && t <= seg.end).length;
  }
  return segs;
}

/**
 * Give each stretch of the week a width proportional to how much happened in it.
 *
 * Sizing by elapsed time is what made these charts unreadable: a Thursday night
 * game and a full Sunday carry almost all the scoring, and the dead hours
 * between them were drawn just as wide, so the parts worth looking at got
 * squeezed into a fraction of the frame while nothing occupied the rest.
 *
 * Because repeats are no longer recorded, the number of samples in a stretch is
 * a direct measure of how much moved in it, so the stored data already carries
 * the weighting. Every idle stretch keeps a floor, so it narrows to a band
 * rather than vanishing and the passage of time stays visible.
 *
 * Position *within* a run stays proportional to the clock, so the shape of a
 * game is never distorted — only how much of the frame each run is given.
 */
export function weightDays(days, times, chartW) {
  const withSegs = days.map((d) => ({ ...d, segments: splitIdle(d, times) }));
  const all = withSegs.flatMap((d) => d.segments);
  const idle = all.filter((s) => s.idle);
  const active = all.filter((s) => !s.idle);

  const idleTotal = idle.length ? Math.min(MIN_DAY_SHARE * idle.length, IDLE_BUDGET) : 0;
  const perIdle = idle.length ? idleTotal / idle.length : 0;
  const activeTotal = 1 - idleTotal;
  const activeRaw = active.map((s) => MIN_ACTIVE_SHARE + s.samples);
  const activeSum = activeRaw.reduce((a, b) => a + b, 0) || 1;

  active.forEach((s, i) => { s.w = (activeRaw[i] / activeSum) * activeTotal; });
  idle.forEach((s) => { s.w = perIdle; });

  /* Normalised at the end rather than trusted to add up. A week with no active
     run at all — every day a single reading — would otherwise leave the active
     share unspent and draw a chart narrower than its own frame. */
  const share = all.reduce((n, s) => n + s.w, 0) || 1;
  all.forEach((s) => { s.w = (s.w / share) * chartW; });

  return withSegs.map((d) => ({
    ...d,
    samples: d.segments.reduce((n, s) => n + s.samples, 0),
    w: d.segments.reduce((n, s) => n + s.w, 0),
  }));
}

export function makeXOf(days) {
  return (t) => {
    let cumX = 0;
    for (let i = 0; i < days.length; i++) {
      const d = days[i];
      if (t < d.segEnd || i === days.length - 1) {
        for (let j = 0; j < d.segments.length; j++) {
          const s = d.segments[j];
          if (t < s.end || j === d.segments.length - 1) {
            // Within the run, still the clock: a run's width changes, the shape
            // of what happened inside it does not.
            const span = Math.max(1, s.end - s.start);
            const frac = Math.min(1, Math.max(0, (t - s.start) / span));
            return cumX + frac * s.w;
          }
          cumX += s.w;
        }
        return cumX;
      }
      cumX += d.w;
    }
    return cumX;
  };
}
