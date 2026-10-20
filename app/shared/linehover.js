// The one hover for every line chart on the site (week 6: plan N1, N2, N7; rule PD11).
//
// Pointing at a plot opens a popup for every line within `radius` px of the pointer (16 px on touch),
// measured to the drawn line itself, not only its points. Where lines meet, all of them are listed;
// where one passes alone, only that one. With no line that close, nothing opens.
// On a phone: press and drag to scrub; tap anywhere else to close. Keyboard: the plot takes focus,
// the arrow keys step between points, Escape closes; a keyboard step lists every line at that step.
//
// Framework-free: give it the plot element, the SVG the lines are drawn in, and three callbacks. Used by
// Fortune Teller's league odds charts, Live Matchups' progression charts and Site Backend's visits chart.
//
//   attachLineHover(plot, {
//     svg,                         // the <svg> whose user units the series are in
//     series: () => [{ key, points: [[x, y], …] }],   // as drawn, holds included
//     snap: (x) => at,             // the moment or step the pointer's x stands for (caller's own value)
//     steps: () => [x, …],         // keyboard stops, in user units
//     xOf: (at) => x,              // where a snapped value sits, for the crosshair
//     render: (keys, at, how) => html,   // the popup; `how` is 'pointer' or 'key'
//     onLines: (keys) => {},       // optional: emphasise the lines being read
//     radius: 8, touchRadius: 16, label: 'Chart'
//   })
// Returns { close, destroy, showAt(clientX, clientY, how), showStep(i) } — showAt lets a page (or a test) place it.

export function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
  let t = len ? ((px - ax) * dx + (py - ay) * dy) / len : 0;
  t = Math.max(0, Math.min(1, t));
  const qx = ax + t * dx - px, qy = ay + t * dy - py;
  return Math.sqrt(qx * qx + qy * qy);
}

/** Which of the series pass within r of (x, y), all in the same (screen) units: the rule, as a plain function. */
export function linesNear(series, x, y, r) {
  return series.filter((s) => {
    for (let i = 0; i < s.pts.length; i++) {
      const a = s.pts[i], b = s.pts[i + 1] || a;
      if (segDist(x, y, a[0], a[1], b[0], b[1]) <= r) return true;
    }
    return false;
  }).map((s) => s.key);
}

export function attachLineHover(plot, o) {
  const opts = { radius: 8, touchRadius: 16, label: 'Chart', onLines: () => {}, ...o };
  const pop = document.createElement('div');
  pop.className = 'lhpop'; pop.setAttribute('role', 'status'); pop.hidden = true;
  const hair = document.createElement('div');
  hair.className = 'lhhair'; hair.hidden = true; hair.setAttribute('aria-hidden', 'true');
  plot.append(hair, pop);
  plot.classList.add('lhplot');
  if (!plot.hasAttribute('tabindex')) plot.tabIndex = 0;
  plot.setAttribute('aria-label', `${opts.label}: point at a line, or use the arrow keys, to read its figures`);
  let step = -1, scrubbing = false, open = false;

  const toScreen = () => {
    const m = opts.svg.getScreenCTM(); if (!m) return [];
    const pt = opts.svg.createSVGPoint();
    return opts.series().map((s) => ({ key: s.key, pts: s.points.map(([x, y]) => { pt.x = x; pt.y = y; const q = pt.matrixTransform(m); return [q.x, q.y]; }) }));
  };
  const toUserX = (clientX) => {
    const m = opts.svg.getScreenCTM(); if (!m) return 0;
    const pt = opts.svg.createSVGPoint(); pt.x = clientX; pt.y = 0;
    return pt.matrixTransform(m.inverse()).x;
  };
  const userXToClient = (x) => {
    const m = opts.svg.getScreenCTM(); const pt = opts.svg.createSVGPoint(); pt.x = x; pt.y = 0;
    return pt.matrixTransform(m).x;
  };

  function place(clientX, clientY) {
    const box = plot.getBoundingClientRect();
    pop.hidden = false;
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let left = clientX - box.left + 14, top = clientY - box.top - h - 12;
    if (left + w > box.width) left = clientX - box.left - w - 14;
    if (left < 0) left = Math.max(0, Math.min(box.width - w, clientX - box.left - w / 2));
    if (top < 0) top = Math.min(box.height - h, clientY - box.top + 16);
    pop.style.transform = `translate(${Math.round(left)}px, ${Math.round(Math.max(0, top))}px)`;
  }
  function showHair(at) {
    if (!opts.xOf) return;
    const box = plot.getBoundingClientRect();
    hair.hidden = false;
    hair.style.transform = `translateX(${Math.round(userXToClient(opts.xOf(at)) - box.left)}px)`;
  }
  function close() {
    pop.hidden = true; hair.hidden = true; open = false; opts.onLines([]);
  }
  function showAt(clientX, clientY, how = 'pointer') {
    const r = how === 'touch' ? opts.touchRadius : opts.radius;
    const near = linesNear(toScreen(), clientX, clientY, r);
    if (!near.length) { close(); return []; }
    const at = opts.snap(toUserX(clientX));
    pop.innerHTML = opts.render(near, at, 'pointer');
    place(clientX, clientY); showHair(at); open = true; opts.onLines(near);
    return near;
  }
  function showStep(i) {
    const xs = opts.steps(); if (!xs.length) return;
    step = Math.max(0, Math.min(xs.length - 1, i));
    const at = opts.snap(xs[step]);
    const keys = opts.series().map((s) => s.key);
    pop.innerHTML = opts.render(keys, at, 'key');
    const box = plot.getBoundingClientRect();
    place(userXToClient(xs[step]), box.top + box.height * 0.35); showHair(at); open = true; opts.onLines(keys);
  }

  const onMove = (e) => {
    if (e.pointerType === 'touch' && !scrubbing) return;
    showAt(e.clientX, e.clientY, e.pointerType === 'touch' ? 'touch' : 'pointer');
  };
  const onDown = (e) => {
    if (e.pointerType !== 'touch') return;
    scrubbing = true; showAt(e.clientX, e.clientY, 'touch');
  };
  const onUp = () => { scrubbing = false; };
  const onLeave = (e) => { if (e.pointerType !== 'touch') close(); };
  const onDocDown = (e) => { if (open && !plot.contains(e.target)) close(); };
  const onKey = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault(); const xs = opts.steps();
      showStep(step < 0 ? (e.key === 'ArrowRight' ? 0 : xs.length - 1) : step + (e.key === 'ArrowRight' ? 1 : -1));
    } else if (e.key === 'Escape') { close(); step = -1; }
  };
  const onBlur = () => { if (step >= 0) { close(); step = -1; } };
  plot.addEventListener('pointermove', onMove);
  plot.addEventListener('pointerdown', onDown);
  plot.addEventListener('pointerup', onUp);
  plot.addEventListener('pointercancel', onUp);
  plot.addEventListener('pointerleave', onLeave);
  plot.addEventListener('keydown', onKey);
  plot.addEventListener('blur', onBlur);
  document.addEventListener('pointerdown', onDocDown);
  return {
    close, showAt, showStep,
    destroy() {
      plot.removeEventListener('pointermove', onMove); plot.removeEventListener('pointerdown', onDown);
      plot.removeEventListener('pointerup', onUp); plot.removeEventListener('pointercancel', onUp);
      plot.removeEventListener('pointerleave', onLeave); plot.removeEventListener('keydown', onKey);
      plot.removeEventListener('blur', onBlur);
      document.removeEventListener('pointerdown', onDocDown); pop.remove(); hair.remove();
      plot.classList.remove('lhplot');
    },
  };
}

// The popup's shared CSS. A popup never leaves its plot.
export const LINEHOVER_CSS = `
.lhplot { position:relative; outline:none; touch-action:pan-y; }
.lhplot:focus-visible { box-shadow:0 0 0 2px var(--accent); }
.lhpop { position:absolute; left:0; top:0; z-index:5; pointer-events:none; min-width:150px; max-width:min(300px,calc(100% - 8px));
  background:var(--panel); border:1px solid var(--line-2); box-shadow:0 10px 30px rgba(0,0,0,.35); padding:9px 11px 10px;
  font-size:12px; color:var(--ink); text-align:left; }
.lhpop[hidden] { display:none; }
.lhpop .lhhead { font-size:10px; font-weight:900; letter-spacing:.14em; text-transform:uppercase; color:var(--ink-3); margin:0 0 7px; }
.lhpop .lhrow { display:grid; grid-template-columns:auto auto 1fr auto; align-items:center; gap:8px; padding:4px 0; border-top:1px solid var(--line); }
.lhpop .lhrow:first-of-type { border-top:0; }
.lhpop .lhkey { width:10px; height:3px; border-radius:2px; }
.lhpop .lhlogo { width:20px; height:20px; display:block; object-fit:cover; }
.lhpop .lhname { min-width:0; }
.lhpop .lhname b { display:block; font-weight:900; font-size:12px; line-height:1.15; }
.lhpop .lhname small { display:block; color:var(--ink-3); font-size:10.5px; margin-top:1px; }
.lhpop .lhval { font-weight:900; font-variant-numeric:tabular-nums; font-size:13px; text-align:right; }
.lhpop .lhnote { color:var(--ink-2); font-size:11.5px; line-height:1.4; }
.lhhair { position:absolute; top:0; bottom:0; left:0; width:0; border-left:1px dashed var(--line-2); pointer-events:none; z-index:1; }
.lhhair[hidden] { display:none; }
`;
