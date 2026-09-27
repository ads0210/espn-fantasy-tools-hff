import React, { useMemo, useState } from "react";
import { num, shortText, axisText, hourOfDay, dayKey, dayName, clockText, dur, toMs } from "./format.js";

/* Small inline SVG charts only: no chart library. */

export function Spark({ values, w = 84, h = 18 }) {
  const vals = (values || []).map((v) => Number(v) || 0);
  if (vals.length < 2 || !vals.some((v) => v)) return null;
  const max = Math.max(1, ...vals), n = vals.length;
  const d = vals.map((v, i) => `${i ? "L" : "M"}${(i * (w - 2) / (n - 1) + 1).toFixed(1)} ${(h - 2 - (v / max) * (h - 4)).toFixed(1)}`).join(" ");
  return <svg className="spark" viewBox={`0 0 ${w} ${h}`} aria-hidden="true"><path d={d} /></svg>;
}

/**
 * The minute schedule's heartbeat: one blip per minute that ticked, a red cross for a
 * missed minute, a faint dash before the log began. `beat` is sixty entries, oldest first.
 */
export function Heartbeat({ beat, fresh }) {
  const W = 600, H = 64, base = 42;
  const blip = (x) => `L${x + 3} ${base} L${x + 4} ${base - 4} L${x + 5} ${base + 5} L${x + 6.2} ${base - 28} L${x + 7.4} ${base + 9} L${x + 8.4} ${base} L${x + 10} ${base}`;
  let d = "";
  const misses = [], none = [];
  (beat || []).forEach((b, i) => {
    const x = i * 10;
    if (b === 1 && i < 59) d += (d ? " " : `M${x} ${base} `) + blip(x);
    else {
      d += ` M${x + 10} ${base}`;
      if (b === 0) misses.push(x);
      else if (b == null) none.push(x);
    }
  });
  const last = beat && beat.length ? beat[beat.length - 1] : null;
  const nx = 590;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Cron ticks in the last 60 minutes">
      <path className="base" d={`M0 ${base} H${W}`} />
      {d ? <path className="trace" d={d} opacity=".9" /> : null}
      {last === 1 ? <path key={fresh || 0} className={"trace" + (fresh ? " newblip" : "")} d={`M${nx} ${base} ${blip(nx)}`} /> : null}
      {misses.map((x) => <g key={"m" + x}><path className="miss" d={`M${x} ${base} H${x + 10}`} strokeDasharray="2 2" /><path className="miss" d={`M${x + 3} ${base - 4} l4 8 M${x + 7} ${base - 4} l-4 8`} /></g>)}
      {none.map((x) => <path key={"n" + x} className="none" d={`M${x} ${base} H${x + 10}`} />)}
    </svg>
  );
}

const PAGE_COLOURS = ["var(--acc)", "var(--blue)", "var(--amber)", "#B98CFF", "#46D3C3", "#FF8FB1", "#C8D46A", "#8FA3FF", "#FFB38A", "#6FD08C", "#D0A3FF", "#7FC4FF", "#E6C35C", "var(--grey)"];

/** Requests per hour for 48 hours, stacked by page, with the cron's share underneath. */
export function TrafficChart({ hours, pages }) {
  const W = 960, H = 160, pad = 22;
  const keys = useMemo(() => {
    const seen = new Set();
    for (const h of hours || []) for (const [k, v] of Object.entries(h.byPage || {})) if (v) seen.add(k);
    const order = (pages || []).map((p) => p[0]).filter((k) => seen.has(k));
    if (seen.has("other")) order.push("other");
    return order;
  }, [hours, pages]);
  const names = new Map((pages || []).concat([["other", "Other"]]));
  const colour = (k) => PAGE_COLOURS[keys.indexOf(k) % PAGE_COLOURS.length];
  const tot = (hours || []).map((h) => (h.total || 0) + (h.cron || 0));
  const max = Math.max(1, ...tot);
  const bw = W / Math.max(1, (hours || []).length);
  const bars = [], ax = [];
  (hours || []).forEach((h, i) => {
    const at = toMs(h.at), x = i * bw + 1;
    let y = H - pad;
    const hc = ((h.cron || 0) / max) * (H - pad - 6);
    bars.push(<rect key={`c${i}`} className="bar" x={x.toFixed(1)} y={(y - hc).toFixed(1)} width={Math.max(1, bw - 2).toFixed(1)} height={hc.toFixed(1)} fill="var(--line-2)" />);
    y -= hc;
    for (const k of keys) {
      const v = (h.byPage || {})[k] || 0;
      if (!v) continue;
      const hh = (v / max) * (H - pad - 6);
      bars.push(<rect key={`${k}${i}`} className="bar" x={x.toFixed(1)} y={(y - hh).toFixed(1)} width={Math.max(1, bw - 2).toFixed(1)} height={hh.toFixed(1)} fill={colour(k)}>
        <title>{`${shortText(at)}: ${names.get(k) || k} ${num(v)}`}</title></rect>);
      y -= hh;
    }
    bars.push(<rect key={`t${i}`} x={x.toFixed(1)} y={pad / 2} width={Math.max(1, bw - 2).toFixed(1)} height={H - pad * 1.5} fill="transparent">
      <title>{`${shortText(at)}: ${num(h.total || 0)} requests, ${num(h.cron || 0)} cron ticks${h.errors ? `, ${num(h.errors)} server errors` : ""}`}</title></rect>);
    if (hourOfDay(at) % 6 === 0) ax.push(<text key={`a${i}`} className="ax" x={x.toFixed(1)} y={H - 6}>{axisText(at)}</text>);
  });
  return (
    <div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Requests per hour, last 48 hours">
        <path className="gridline" d={`M0 ${H - pad} H${W}`} />{bars}{ax}
      </svg>
      <div className="legend">
        {keys.map((k) => <span key={k}><i className="sw9" style={{ background: colour(k) }} />{names.get(k) || k}</span>)}
        <span><i className="sw9" style={{ background: "var(--line-2)" }} />cron</span>
      </div>
    </div>
  );
}

/** Sign-ins by hour of day for the last few days, in the reader's zone. */
export function Heat({ days = 3, times, now }) {
  const rows = [];
  const base = now || Date.now();
  for (let d = days - 1; d >= 0; d--) {
    const ms = base - d * 86400000;
    rows.push({ key: dayKey(ms), label: dayName(ms).split(",")[0], at: ms });
  }
  const counts = new Map(rows.map((r) => [r.key, new Array(24).fill(0)]));
  for (const t of times || []) {
    const k = dayKey(t);
    if (counts.has(k)) counts.get(k)[hourOfDay(t)] += 1;
  }
  const max = Math.max(1, ...[...counts.values()].flat());
  return (
    <div className="heat" role="img" aria-label="Sign-ins by hour of day">
      <span />
      {Array.from({ length: 24 }, (_, h) => <span key={h} style={{ textAlign: "center" }}>{h % 6 === 0 ? h : ""}</span>)}
      {rows.map((r) => (
        <React.Fragment key={r.key}>
          <span>{r.label}</span>
          {counts.get(r.key).map((n, h) => <i key={h} className={n ? "" : "z"} style={n ? { opacity: 0.25 + 0.75 * (n / max) } : undefined} title={`${n} at ${h}:00`} />)}
        </React.Fragment>
      ))}
    </div>
  );
}

/** Each recent slice's duration against the 10 s target and the 30 s limit. */
export function Slices({ v }) {
  const W = 960, H = 120, pad = 16;
  const list = v || [];
  const max = Math.max(30000, ...list);
  const bw = W / Math.max(1, list.length);
  const y = (ms) => H - pad - (ms / max) * (H - pad * 2);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Recent slice durations">
      <path className="gridline" d={`M0 ${H - pad} H${W}`} />
      <path className="tgt" d={`M0 ${y(10000)} H${W}`} />
      <path className="lim" d={`M0 ${y(30000)} H${W}`} />
      <text className="ax" x="4" y={y(10000) - 3}>10 s target</text>
      <text className="ax" x="4" y={y(30000) - 3}>30 s limit</text>
      {list.map((ms, i) => (
        <rect key={i} className="bar" x={(i * bw + 0.5).toFixed(1)} width={Math.max(1, bw - 1).toFixed(1)} y={y(ms).toFixed(1)} height={(H - pad - y(ms)).toFixed(1)}
          fill={ms > 10000 ? "var(--amber)" : "var(--acc)"}><title>{dur(ms)}</title></rect>
      ))}
    </svg>
  );
}

/** How every derived digest is built: its source and what it also needs. Tap a box to trace it. */
export function DepDiagram({ rows }) {
  const [hl, setHl] = useState(null);
  const model = useMemo(() => {
    const nodes = new Map();
    const add = (k) => { if (!nodes.has(k)) nodes.set(k, { k, parents: [], needs: [] }); return nodes.get(k); };
    const byKey = new Map((rows || []).map((r) => [r.key, r]));
    for (const r of rows || []) {
      if (!r.derivedFrom) continue;
      const n = add(r.key); add(r.derivedFrom); n.parents.push(r.derivedFrom);
      for (const q of (r.needs || []).concat(r.current ? [r.current] : [])) if (byKey.has(q) && q !== r.derivedFrom) { add(q); n.needs.push(q); }
    }
    const layer = new Map();
    const L = (k, seen = new Set()) => {
      if (layer.has(k)) return layer.get(k);
      if (seen.has(k)) return 0;
      seen.add(k);
      const n = nodes.get(k), deps = n.parents.concat(n.needs);
      const v = deps.length ? 1 + Math.max(...deps.map((d) => L(d, seen))) : 0;
      layer.set(k, v);
      return v;
    };
    nodes.forEach((n) => L(n.k));
    const cols = [];
    nodes.forEach((n) => { const l = layer.get(n.k); (cols[l] = cols[l] || []).push(n.k); });
    cols.forEach((c) => c && c.sort());
    const NW = 186, NH = 22, GX = 64, GY = 8, P = 10;
    const pos = new Map();
    cols.forEach((c, i) => (c || []).forEach((k, j) => pos.set(k, { x: P + i * (NW + GX), y: P + j * (NH + GY) })));
    const W = P * 2 + cols.length * NW + Math.max(0, cols.length - 1) * GX;
    const H = P * 2 + Math.max(1, ...cols.map((c) => (c || []).length)) * (NH + GY);
    const edges = [];
    nodes.forEach((n) => {
      const to = pos.get(n.k);
      const draw = (from, cls) => {
        const a = pos.get(from);
        const x1 = a.x + NW, y1 = a.y + NH / 2, x2 = to.x, y2 = to.y + NH / 2, mx = (x1 + x2) / 2;
        edges.push({ a: from, b: n.k, cls, d: `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}` });
      };
      n.parents.forEach((p) => draw(p, "src"));
      n.needs.forEach((p) => draw(p, "need"));
    });
    return { nodes, pos, edges, W, H, NW, NH, byKey };
  }, [rows]);

  const on = useMemo(() => {
    if (!hl) return null;
    const set = new Set([hl]);
    const up = (k) => { for (const e of model.edges) if (e.b === k && !set.has(e.a)) { set.add(e.a); up(e.a); } };
    const down = (k) => { for (const e of model.edges) if (e.a === k && !set.has(e.b)) { set.add(e.b); down(e.b); } };
    up(hl); down(hl);
    return set;
  }, [hl, model]);

  if (!model.nodes.size) return <div className="empty">No derived digests are registered.</div>;
  return (
    <div>
      <div className={"dep" + (on ? " hl" : "")}>
        <div className="scrollreal" style={{ overflowX: "auto" }}>
          <svg width={model.W} height={model.H} viewBox={`0 0 ${model.W} ${model.H}`} role="img" aria-label="How derived datasets are built">
            {model.edges.map((e, i) => <path key={i} className={`edge ${e.cls}${on && on.has(e.a) && on.has(e.b) ? " on" : ""}`} d={e.d} />)}
            {[...model.pos.entries()].map(([k, p]) => {
              const r = model.byKey.get(k);
              return (
                <g key={k} className={`node${r && r.derivedFrom ? " derived" : ""}${on && on.has(k) ? " on" : ""}`} tabIndex={0} role="button"
                  onClick={() => setHl(hl === k ? null : k)} onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); setHl(hl === k ? null : k); } }}>
                  <rect x={p.x} y={p.y} width={model.NW} height={model.NH} rx="4" />
                  <text x={p.x + 8} y={p.y + 15}>{k}</text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
      <div className="legend">
        <span><i className="sw9" style={{ border: "1px solid var(--line-2)" }} />raw dataset</span>
        <span><i className="sw9" style={{ border: "1px solid var(--acc)" }} />derived digest</span>
        <span>solid line: built from</span><span>dashed line: also needs</span><span>tap a box to trace it</span>
      </div>
    </div>
  );
}

export function tickTitle(at) { return clockText(at); }
