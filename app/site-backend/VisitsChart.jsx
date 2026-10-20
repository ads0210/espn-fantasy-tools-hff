import React, { useEffect, useRef } from "react";
import { attachLineHover, LINEHOVER_CSS } from "../shared/linehover.js";
import { teamVar, teamColourCss } from "../shared/teamcolours.js";
import { VISIT_RANGES, NO_TEAM, HOUR_MS, visitLines } from "./visits.js";
import { num, zone } from "./format.js";

/**
 * Week 6 (plan N7, PD25, PD11): Visits over time, the first panel on the Activity tab. Starts shut like every panel;
 * only while it is open does the tab's request ask the log for the rows (`vrange`). One line per team and one for
 * visits with no team chosen; the legend hides and shows teams; pointing at the plot reads every line near it.
 */
const W = 600, H = 210, PADL = 30, PADR = 10, PADT = 10, PADB = 8;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = (o, tz) => { try { return new Intl.DateTimeFormat("en-US", { ...o, timeZone: tz || undefined }); } catch { return new Intl.DateTimeFormat("en-US", o); } };
// Daily buckets are UTC days, so they are named as UTC days whatever zone the page shows.
const dayLabel = (t) => fmt({ weekday: "short", month: "short", day: "numeric" }, "UTC").format(t);
const hourLabel = (t) => fmt({ hour: "numeric" }, zone()).format(t);
const hourSpanLabel = (t) => `${fmt({ weekday: "short", month: "short", day: "numeric", hour: "numeric" }, zone()).format(t)} to ${fmt({ hour: "numeric" }, zone()).format(t + HOUR_MS)}`;
const sinceLabel = (t) => fmt({ month: "short", day: "numeric" }, zone()).format(t);
export function readTeamCookie() {
  const m = /(?:^|;\s*)eft_team=(\d+)/.exec(typeof document === "undefined" ? "" : document.cookie);
  return m ? Number(m[1]) : null;
}

export const VISITS_CSS = `
${LINEHOVER_CSS}
#p-visits { --ink-2:var(--dim); --ink-3:var(--faint); --accent:var(--acc); }
#p-visits .vplot { position:relative; margin:4px 0 0 0; }
#p-visits .vplot svg { position:absolute; inset:0; width:100%; height:100%; overflow:visible; }
#p-visits .vgrid { stroke:var(--line); stroke-width:1; vector-effect:non-scaling-stroke; }
#p-visits .vline { fill:none; stroke:var(--c); stroke-width:1.6; vector-effect:non-scaling-stroke; stroke-linejoin:round; opacity:.85; }
#p-visits .vline.me { stroke-width:2.8; opacity:1; }
#p-visits .vline.none { stroke-dasharray:4 3; }
#p-visits .vline.hot { stroke-width:3.2; opacity:1; }
#p-visits .vylab { position:absolute; transform:translateY(-50%); font-size:10.5px; color:var(--faint); font-variant-numeric:tabular-nums; }
#p-visits .vxaxis { position:relative; height:18px; margin:2px 0 6px; }
#p-visits .vxaxis span { position:absolute; transform:translateX(-50%); font-size:10.5px; color:var(--faint); white-space:nowrap; }
#p-visits .vxaxis span:first-child { transform:none; }
#p-visits .vxaxis span:last-child { transform:translateX(-100%); }
#p-visits .vlegend { display:flex; flex-wrap:wrap; gap:4px 12px; align-items:center; margin:6px 0 4px; }
#p-visits .vkey { display:inline-flex; align-items:center; gap:6px; background:none; border:0; padding:3px 0; color:var(--ink); font-size:12px; cursor:pointer; text-align:left; }
#p-visits .vkey i { width:14px; height:3px; border-radius:2px; background:var(--c); flex:none; }
#p-visits .vkey.none i { background:repeating-linear-gradient(90deg,var(--c) 0 4px,transparent 4px 7px); }
#p-visits .vkey[aria-pressed="false"] { color:var(--faint); text-decoration:line-through; }
#p-visits .vkey[aria-pressed="false"] i { opacity:.35; }
#p-visits .vkey.me { font-weight:700; }
#p-visits .vempty { padding:18px 0; color:var(--dim); text-align:center; }
`;

export default function VisitsChart({ d, vis, setVis }) {
  const plotRef = useRef(null), svgRef = useRef(null);
  const v = d && d.visits;
  const ids = Object.keys((d && d.teams) || {}).map(Number).sort((a, b) => a - b);
  const me = readTeamCookie();
  const shown = vis.hidden || [];
  const ready = v && !v.rest && Array.isArray(v.rows);
  const { times, lines } = ready ? visitLines(v, { page: vis.page, teams: ids }) : { times: [], lines: new Map() };
  const keys = [...lines.keys()].filter((k) => !shown.includes(k)).sort((a, b) => (a === me) - (b === me));
  const total = [...lines.values()].reduce((a, l) => a + l.reduce((x, y) => x + y, 0), 0);
  const max = Math.max(4, ...keys.flatMap((k) => lines.get(k)));
  const top = Math.ceil(max / 4) * 4, n = times.length;
  const X = (i) => PADL + (n <= 1 ? 0.5 : i / (n - 1)) * (W - PADL - PADR), Y = (y) => PADT + (1 - y / top) * (H - PADT - PADB);
  const name = (k) => (k === NO_TEAM ? "No team chosen" : ((d.teams || {})[k] || {}).name || `Team ${k}`);
  const colour = (k) => (k === NO_TEAM ? "var(--team-none)" : teamVar(k, ids));
  const pageName = (k) => ((d.pages || []).find((p) => p[0] === k) || [k, k])[1];
  const sig = `${ready ? `${v.from}|${v.to}|${v.rows.length}|${total}` : "none"}|${vis.page}|${keys.join(",")}|${me}`;

  useEffect(() => {
    const plot = plotRef.current, svg = svgRef.current;
    if (!plot || !svg || !n) return undefined;
    const h = attachLineHover(plot, {
      svg, label: "Visits over time",
      series: () => keys.map((k) => ({ key: k, points: lines.get(k).map((y, i) => [X(i), Y(y)]) })),
      snap: (x) => Math.max(0, Math.min(n - 1, Math.round((x - PADL) / ((W - PADL - PADR) / Math.max(1, n - 1))))),
      steps: () => times.map((_, i) => X(i)), xOf: (i) => X(i),
      render: (ks, i) => {
        const when = v.hourly ? hourSpanLabel(times[i]) : dayLabel(times[i]);
        const rows = ks.map((k) => [k, lines.get(k)[i]]).sort((a, b) => b[1] - a[1]);
        return `<p class="lhhead">${esc(when)}${vis.page ? ` · ${esc(pageName(vis.page))}` : ""}</p>${rows.map(([k, y]) => {
          const t = (d.teams || {})[k] || {};
          const logo = k !== NO_TEAM && t.logo ? `<img class="lhlogo" src="${esc(t.logo)}" alt="">` : "<span></span>";
          return `<div class="lhrow"><i class="lhkey" style="background:${colour(k)}"></i>${logo}<span class="lhname"><b>${esc(name(k))}</b></span><span class="lhval">${num(y)} ${y === 1 ? "visit" : "visits"}</span></div>`;
        }).join("")}`;
      },
      onLines: (ks) => plot.querySelectorAll(".vline").forEach((p) => p.classList.toggle("hot", ks.map(String).includes(p.dataset.k))),
    });
    return () => { h.destroy(); plot.querySelectorAll(".vline.hot").forEach((p) => p.classList.remove("hot")); };
    // Attached again only when what is drawn changes: the tab polls every 15 seconds and a popup must survive that.
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  const chip = (field, value, label) => <button key={field + value} type="button" className="chip" aria-pressed={vis[field] === value} onClick={() => setVis((s) => ({ ...s, [field]: value }))}>{label}</button>;
  const toggle = (k) => setVis((s) => ({ ...s, hidden: s.hidden.includes(k) ? s.hidden.filter((x) => x !== k) : [...s.hidden, k] }));
  const every = Math.max(1, Math.ceil(n / 6));
  const pages = (d.pages || []).filter(([k]) => k !== "signin" && k !== "wizard");

  return (
    <section className={"panel" + (vis.open ? "" : " shut")} id="p-visits">
      <style dangerouslySetInnerHTML={{ __html: `${teamColourCss()}${VISITS_CSS}` }} />
      <div className="ph">
        <button type="button" className="tog" aria-expanded={vis.open} aria-controls="b-p-visits" onClick={() => setVis((s) => ({ ...s, open: !s.open }))}>
          <span className="caret" aria-hidden="true">▾</span>
          <span className="phx"><span className="pt">Visits over time</span>
            <span className="ps">Page visits by the team chosen on each browser. Counted by the hour, kept by the day after 8 days.</span></span>
        </button>
        {ready ? <span className="asof">as of {fmt({ hour: "numeric", minute: "2-digit", second: "2-digit" }, zone()).format(Date.parse(d.at))}</span> : null}
      </div>
      {vis.open ? (
        <div className="pb" id="b-p-visits">
          <div className="chips">{VISIT_RANGES.map(([k, l]) => chip("range", k, l))}</div>
          <div className="chips">{chip("page", "", "All pages")}{pages.map(([k, l]) => chip("page", k, l))}</div>
          {!v ? <div className="loading">Reading the log…</div>
            : v.rest ? <div className="restnote">{v.rest.replace(/^The panels built from/, "Visits over time and the panels built from")}</div>
            : <>
              {total === 0 ? <div className="vempty">No visits recorded in this range{vis.page ? ` on ${pageName(vis.page)}` : ""}.</div> : null}
              <div className="vplot" ref={plotRef} style={{ aspectRatio: `${W} / ${H}` }}>
                <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
                  {[0, top / 2, top].map((y) => <line key={y} className="vgrid" x1={PADL} x2={W - PADR} y1={Y(y)} y2={Y(y)} />)}
                  {keys.map((k) => (
                    <path key={k} className={`vline${k === me ? " me" : ""}${k === NO_TEAM ? " none" : ""}`} data-k={k} style={{ "--c": colour(k) }}
                      d={lines.get(k).map((y, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(y).toFixed(1)}`).join(" ")} />
                  ))}
                </svg>
                {[0, top / 2, top].map((y) => <span key={y} className="vylab" style={{ top: `${(Y(y) / H) * 100}%`, left: 0 }}>{num(y)}</span>)}
              </div>
              <div className="vxaxis">{times.map((t, i) => (i % every === 0 || i === n - 1) && !(i !== n - 1 && n - 1 - i < every / 2)
                ? <span key={t} style={{ left: `${(X(i) / W) * 100}%` }}>{v.hourly && v.range === "24h" ? hourLabel(t) : v.hourly ? fmt({ weekday: "short" }, zone()).format(t) : dayLabel(t)}</span> : null)}</div>
              <div className="vlegend" role="group" aria-label="Teams shown: tap one to hide or show it">
                <button type="button" className="chip" aria-pressed={!vis.hidden.length} onClick={() => setVis((s) => ({ ...s, hidden: [] }))}>All teams</button>
                {me != null && ids.includes(me) ? <button type="button" className="chip" aria-pressed={vis.hidden.length === ids.length - 1 && !vis.hidden.includes(me) && !vis.hidden.includes(NO_TEAM)}
                  onClick={() => setVis((s) => ({ ...s, hidden: ids.filter((x) => x !== me) }))}>Only my team</button> : null}
                {[...ids, NO_TEAM].map((k) => (
                  <button key={k} type="button" className={`vkey${k === me ? " me" : ""}${k === NO_TEAM ? " none" : ""}`} aria-pressed={!shown.includes(k)}
                    style={{ "--c": colour(k) }} onClick={() => toggle(k)}><i />{name(k)}</button>
                ))}
              </div>
              <p className="note">{v.hourly ? "Each point is one hour." : "Each point is one UTC day."}{v.since ? ` Counted since ${sinceLabel(v.since)}.` : ""}</p>
            </>}
        </div>
      ) : null}
    </section>
  );
}
