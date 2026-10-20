import React, { useEffect, useRef } from "react";
import { attachLineHover } from "../shared/linehover.js";
import { teamVar } from "../shared/teamcolours.js";

/**
 * Week 6 (plan N1, PD11): the league odds charts. Every team's line, the chosen team's drawn heavier and last;
 * pointing at the plot reads every line within 8 px (16 px on touch) at the nearest week; the legend, in current
 * place order, isolates a team on a tap. Points are spaced by order, like Odds by week.
 */
const W = 600, H = 230, PADL = 34, PADR = 14, PADT = 14, PADB = 12;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const oddsText = (v) => (v >= 0.9995 ? "Clinched" : v <= 0.0005 ? "Eliminated" : `${(Math.round(v * 1000 + 1e-6) / 10).toFixed(1)}%`);
const ordinal = (n) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

export function chartGeometry(series) {
  const weeks = [...new Set([...series.values()].flatMap((a) => a.map((p) => p.week)))].sort((a, b) => a - b);
  const X = (w) => (weeks.length === 1 ? (PADL + W - PADR) / 2 : PADL + (weeks.indexOf(w) / (weeks.length - 1)) * (W - PADL - PADR));
  const Y = (v) => PADT + (1 - v) * (H - PADT - PADB);
  return { weeks, X, Y };
}

export default function LeagueOdds({ kind, title, sub, series, teams, me, isolated, onIsolate, nowLabel = "Now" }) {
  const plotRef = useRef(null), svgRef = useRef(null);
  const allIds = [...teams.keys()];
  const { weeks, X, Y } = chartGeometry(series);
  const ids = [...series.keys()].sort((a, b) => (a === me) - (b === me) || a - b);
  const last = weeks[weeks.length - 1];
  const sig = `${kind}|${me}|${isolated}|${JSON.stringify([...series.entries()])}|${[...teams.entries()].map(([id, t]) => `${id}:${t.name}:${t.place}`).join(",")}`;

  useEffect(() => {
    const plot = plotRef.current, svg = svgRef.current;
    if (!plot || !svg || !weeks.length) return undefined;
    const h = attachLineHover(plot, {
      svg, label: kind === "espn" ? "League odds, ESPN's" : "League odds, simulated",
      series: () => [...series.entries()].filter(([id]) => isolated == null || isolated === id).map(([id, a]) => ({ key: id, points: a.map((q) => [X(q.week), Y(q.v)]) })),
      snap: (x) => weeks.reduce((b, w) => (Math.abs(X(w) - x) < Math.abs(X(b) - x) ? w : b), weeks[0]),
      steps: () => weeks.map((w) => X(w)),
      xOf: (w) => X(w),
      render: (keys, week, how) => {
        const rows = keys.map((id) => ({ id, v: ((series.get(id) || []).find((p) => p.week === week) || {}).v })).filter((r) => r.v != null).sort((a, b) => b.v - a.v);
        const head = `${kind === "espn" ? "ESPN's odds" : "Simulated odds"} ${week === 0 ? "before week 1" : `after week ${week}`}${how === "key" ? " · every team" : ""}`;
        return `<p class="lhhead">${esc(head)}</p>${rows.map(({ id, v }) => {
          const t = teams.get(id) || {};
          const logo = t.logo ? `<img class="lhlogo" src="${esc(t.logo)}" alt="">` : "<span></span>";
          const small = [t.owner, t.place ? `${ordinal(t.place)} now` : ""].filter(Boolean).join(" · ");
          return `<div class="lhrow"><i class="lhkey" style="background:${teamVar(id, allIds)}"></i>${logo}<span class="lhname"><b class="grad">${esc(t.name || `Team ${id}`)}</b>${small ? `<small>${esc(small)}</small>` : ""}</span><span class="lhval">${oddsText(v)}</span></div>`;
        }).join("")}`;
      },
      onLines: (keys) => plot.querySelectorAll(".lgline").forEach((g) => g.classList.toggle("hot", keys.includes(Number(g.dataset.team)))),
    });
    return () => { h.destroy(); plot.querySelectorAll(".lgline.hot").forEach((g) => g.classList.remove("hot")); };
    // Attached again only when what is drawn changes: the page re-renders often, and a popup must survive that.
  }, [sig]);

  if (!weeks.length) return null;
  const legendIds = [...series.keys()].sort((a, b) => ((teams.get(a) || {}).place || 99) - ((teams.get(b) || {}).place || 99));
  return (
    <div className="panel lgpanel ftin" data-kind={kind}>
      <div className="panelhead"><span className="t">{title}</span><span className="count">{sub}</span></div>
      <div className="lgplot" ref={plotRef} style={{ aspectRatio: `${W} / ${H}` }}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          {[1, 0.5, 0].map((v) => <line key={v} className="lggrid" x1={PADL} x2={W - PADR} y1={Y(v)} y2={Y(v)} />)}
          {ids.map((id) => {
            const a = series.get(id), d = a.map((p, i) => `${i ? "L" : "M"}${X(p.week).toFixed(1)} ${Y(p.v).toFixed(1)}`).join(" ");
            const dim = isolated != null && isolated !== id ? " dim" : "";
            return (
              <g key={id} className={`lgline${id === me ? " me" : ""}${dim}`} data-team={id} style={{ "--c": teamVar(id, allIds) }}>
                <path d={d} />
                {a.map((p) => <circle key={p.week} cx={X(p.week).toFixed(1)} cy={Y(p.v).toFixed(1)} r={id === me ? 4 : 3} />)}
              </g>
            );
          })}
        </svg>
        {[1, 0.5, 0].map((v) => <span key={v} className="lgylab" style={{ top: `${(Y(v) / H) * 100}%` }}>{v * 100}%</span>)}
      </div>
      <div className="lgaxis">{weeks.map((w) => <span key={w} style={{ left: `${(X(w) / W) * 100}%` }}>{w === last ? nowLabel : weeks.length > 8 ? w : `Wk ${w}`}</span>)}</div>
      <div className="lglegend" role="group" aria-label="Teams: tap one to show it alone">
        {legendIds.map((id) => {
          const t = teams.get(id) || {};
          return (
            <button key={id} type="button" className={`lgkey${isolated === id ? " on" : ""}${isolated != null && isolated !== id ? " off" : ""}${id === me ? " me" : ""}`}
              aria-pressed={isolated === id} style={{ "--c": teamVar(id, allIds) }} onClick={() => onIsolate(isolated === id ? null : id)}>
              <i />{t.name || `Team ${id}`}
            </button>
          );
        })}
        {isolated != null ? <button type="button" className="lgkey all" onClick={() => onIsolate(null)}>Show every team</button> : null}
      </div>
    </div>
  );
}

/**
 * The row of league odds panels under the top section: ESPN's always; the simulated one only once a simulation
 * exists, until then the ESPN panel spans the row. One isolated team for both charts.
 */
export function LeagueOddsRow({ espn, sim = null, teams, me, nowLabel = "Now", final = false }) {
  const [isolated, setIsolated] = React.useState(null);
  const showSim = sim && sim.size > 0;
  if (!espn.size && !showSim) return null;
  return (
    <div className={`lgrow${showSim && espn.size ? "" : " single"}`}>
      {espn.size ? <LeagueOdds kind="espn" title="League odds · ESPN" sub={final ? "every team's playoff odds, the whole regular season" : "every team's playoff odds after each week"}
        series={espn} teams={teams} me={me} isolated={isolated} onIsolate={setIsolated} nowLabel={nowLabel} /> : null}
      {showSim ? <LeagueOdds kind="sim" title="League odds · simulated" sub={final ? "exact, every week the map covered" : "exact, after each week the map covers"}
        series={sim} teams={teams} me={me} isolated={isolated} onIsolate={setIsolated} nowLabel={nowLabel} /> : null}
    </div>
  );
}

/** Team id → { name, logo, owner, place } for the charts' popups and legend, from whatever list the page has. */
export function teamInfo(list) {
  const sorted = list.slice().sort((a, b) => (a.rank || 99) - (b.rank || 99));
  return new Map(sorted.map((t, i) => [Number(t.id), { name: t.name, logo: t.logo || null, owner: t.owner || null, place: t.rank || i + 1 }]));
}
