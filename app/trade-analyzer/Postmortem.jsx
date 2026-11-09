import React, { useEffect, useState } from "react";
import { pts2, ptsSigned, dateText, dateTimeText } from "../../src/ui.js";
import TeamLogo from "../shared/TeamLogo.jsx";
import ScrollBox from "../shared/ScrollBox.jsx";

/**
 * Trade Analyzer's Postmortem (Week 10 plan, D1–D12, D22): every decided trade offer, judged by what it did, or would
 * have done, to both teams' lineups week by week. Each card is Trade Analyzer's own offer card, with the outcome where
 * the verdict sits for an offer on the table, and opens to both sides' figures and the weekly chart. The figures are
 * worked out by the backend (src/postmortem.js, src/postmortemstep.js) and read from /api/trade/postmortem.
 */
const STATUS = {
  completed: ["Completed", "good"], expired: ["Expired", "dim"], rejected: ["Turned down", "bad"],
  withdrawn: ["Withdrawn", "info"], superseded: ["Superseded", "warn"],
};
const POS = { 1: "QB", 2: "RB", 3: "WR", 4: "TE", 5: "K", 16: "D/ST" };
const posCls = (p) => "pos-" + String(p || "").replace("/", "");
const sideOf = (o, t) => o.impact[t] || { rows: [], toDate: 0, stillToPlay: 0, received: 0, started: null, weeks: 0, weeksPlayed: 0 };

function WeekChart({ o, name }) {
  const [a, b] = o.sides.map((s) => s.team);
  const A = sideOf(o, a), B = sideOf(o, b);
  const weeks = [...new Set([...A.rows, ...B.rows].map((r) => r.w))].sort((x, y) => x - y);
  if (!weeks.length) return <p className="pm-note">No week left in which this deal could change a lineup.</p>;
  const val = (S, w) => { const r = S.rows.find((x) => x.w === w); return r ? r.impact : null; };
  const fut = (S, w) => { const r = S.rows.find((x) => x.w === w); return r ? r.future : false; };
  const max = Math.max(4, ...weeks.flatMap((w) => [Math.abs(val(A, w) || 0), Math.abs(val(B, w) || 0)]));
  const W = Math.max(640, weeks.length * 36), H = 170, left = 40, right = 8, mid = 84, half = 70;
  const step = (W - left - right) / weeks.length, bw = Math.max(3, Math.min(14, step / 3));
  const y = (v) => mid - (v / max) * half;
  const firstFuture = weeks.find((w) => fut(A, w) || fut(B, w));
  return (
    <div className="pm-chart">
      <div className="pm-legend">
        <span><i className="pm-sw a" aria-hidden="true" />{name(a)}</span>
        <span><i className="pm-sw b" aria-hidden="true" />{name(b)}</span>
        {firstFuture ? <span><i className="pm-sw f" aria-hidden="true" />still to play (ESPN's projections)</span> : null}
      </div>
      <ScrollBox>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ minWidth: Math.min(W, 560) }} role="img" aria-label={`Lineup impact by week for ${name(a)} and ${name(b)}`}>
          <line x1={left} x2={W - right} y1={mid} y2={mid} className="pm-zero" />
          <text x={left - 6} y={y(max) + 4} className="pm-ax" textAnchor="end">+{Math.round(max)}</text>
          <text x={left - 6} y={mid + 4} className="pm-ax" textAnchor="end">0</text>
          <text x={left - 6} y={y(-max) + 4} className="pm-ax" textAnchor="end">−{Math.round(max)}</text>
          {firstFuture ? <rect x={left + weeks.indexOf(firstFuture) * step} y={mid - half - 6} width={W - right - (left + weeks.indexOf(firstFuture) * step)} height={half * 2 + 12} className="pm-futband" /> : null}
          {weeks.map((w, i) => {
            const x0 = left + i * step + step / 2;
            const bar = (S, dx, cls) => {
              const v = val(S, w);
              if (v == null) return null;
              const yy = y(Math.max(v, 0)), h = Math.max(1, Math.abs(y(v) - mid));
              return <rect x={x0 + dx} y={v >= 0 ? yy : mid} width={bw} height={h} className={`pm-bar ${cls}${fut(S, w) ? " f" : ""}`}><title>{`Week ${w}: ${name(S.team)} ${ptsSigned(v)}${fut(S, w) ? " (projected)" : ""}`}</title></rect>;
            };
            return (
              <g key={w}>
                {bar(A, -bw - 1, "a")}{bar(B, 1, "b")}
                <text x={x0} y={H - 6} className="pm-ax" textAnchor="middle">{w}</text>
              </g>
            );
          })}
        </svg>
      </ScrollBox>
      <div className="pm-axcap">Week · points a week each side's best lineup gained (+) or lost (−) from the deal</div>
    </div>
  );
}

function SideFigures({ o, t, team, completed }) {
  const S = sideOf(o, t);
  const fav = o.grade.favors === t;
  const fig = (label, v, signed = true, hint) => (
    <div className="pm-fig"><span className="pm-fl">{label}</span><span className={`pm-fv${signed ? (v > 0.004 ? " pos" : v < -0.004 ? " neg" : " zero") : ""}`}>{v == null ? "—" : signed ? ptsSigned(v) : pts2(v)}</span><span className="pm-fh">{hint || " "}</span></div>
  );
  return (
    <div className={`pm-side${fav ? " fav" : ""}`}>
      <div className="pm-sidehead"><TeamLogo src={team.logo} className="lgo" alt="" /><b className="pm-tn">{team.name}</b>{team.then ? <span className="pm-then">as {team.then}</span> : null}{fav ? <span className="chip good">Came out ahead</span> : null}</div>
      <div className="pm-figs">
        {fig("Lineup impact to date", S.toDate, true, `${S.weeksPlayed} ${S.weeksPlayed === 1 ? "week" : "weeks"}`)}
        {S.weeks > S.weeksPlayed ? fig("Still to play", S.stillToPlay, true, `${S.weeks - S.weeksPlayed} ${S.weeks - S.weeksPlayed === 1 ? "week" : "weeks"}, projected`) : null}
        {fig("Points received", S.received, false, "scored by what it got, started or not")}
        {completed ? fig("Started points", S.started, false, "what it got and started") : null}
      </div>
    </div>
  );
}

function OfferPM({ o, T, players, open, onToggle, me }) {
  const [a, b] = o.sides;
  const [label, cls] = STATUS[o.status] || [o.status, ""];
  const g = o.grade, eg = o.expectedGrade;
  const name = (t) => T(t).name;
  const pl = (pid) => { const p = players[pid] || {}; return { pid, name: p.n || `Player ${pid}`, pos: p.pos || "" }; };
  const verdict = o.verdict;
  const mine = me != null && (a.team === me || b.team === me);
  const Col = ({ s, side }) => (
    <div className={`ocside ${side}`}>
      <div className="octeam"><TeamLogo src={T(s.team).logo} className="lgo" alt="" /><b>{name(s.team)}</b></div>
      <span className="ocgives">{s.team === o.proposer ? "Offered" : "Was asked for"}</span>
      {s.sends.map(pl).map((p) => <div className="ocplayer" key={p.pid}><span className={`posbadge ${posCls(p.pos)}`}>{p.pos}</span><span className="nm">{p.name}</span></div>)}
    </div>
  );
  const outcome = o.note === "tooLate" ? <span className="v band c-none">Too late in the season to change a lineup</span>
    : o.note === "changesNothing" ? <span className="v band c-none">Changes nothing: these players moved anyway</span>
      : <span className={`v band c-${g.key}`}>{g.key === "even" ? "Even" : `${g.label} ${name(g.favors)}`}</span>;
  const words = (k, lbl, fav) => (k === "even" ? "an even deal" : `it to ${lbl.toLowerCase()} ${name(fav)}`);
  return (
    <div className={`offer${open ? " open" : ""}${mine ? " pm-mine" : ""}`}>
      <button className="offercard" type="button" aria-expanded={open} onClick={onToggle}>
        <div className="ocsides"><Col s={a} side="a" /><div className="ocswap"><span className="pm-swap" aria-hidden="true">⇄</span></div><Col s={b} side="b" /></div>
        <div className="ocinfo">
          <span className={`chip ${cls}`}>{label}</span>
          <span className="pm-when">{dateText(o.offeredAt)}</span>
          <span className="dot" aria-hidden="true" />
          {outcome}
          {!o.note && g.key !== "even" ? <span className="pm-gap">{pts2(Math.abs(g.gapPerWeek))} a week</span> : null}
          {!o.note ? <>
            <span className="dot" aria-hidden="true" />
            {verdict ? <span className="pm-exp">Trade Analyzer said: <b className={`band c-${verdict.key}`}>{verdict.key === "even" ? "Even" : `${verdict.label}${verdict.favors != null ? ` ${name(verdict.favors)}` : ""}`}</b></span>
              : <span className="pm-exp">ESPN expected: <b className={`band c-${eg.key}`}>{eg.key === "even" ? "Even" : `${eg.label} ${name(eg.favors)}`}</b></span>}
          </> : null}
        </div>
        <span className="chev turns" aria-hidden="true" />
      </button>
      {open && (
        <div className="offerbody"><div className="offerbody-inner">
          <div className="pm-body">
            <div className="pm-sides">
              <SideFigures o={o} t={a.team} team={T(a.team)} completed={o.status === "completed"} />
              <SideFigures o={o} t={b.team} team={T(b.team)} completed={o.status === "completed"} />
            </div>
            <WeekChart o={o} name={name} />
            <ul className="pm-notes">
              <li>Offered {dateTimeText(o.offeredAt)} by {name(o.proposer)}. {o.status === "completed"
                ? `Went through ${dateTimeText(o.effectiveAt)}${o.effWeek ? `; counted from week ${o.effWeek}` : ""}.`
                : `Counted as if accepted at once and through the league's review, from ${dateTimeText(o.effectiveAt)}${o.effWeek ? `: week ${o.effWeek}` : ""}${Object.values(o.impact).some((s) => s.rows.some((r) => r.partial)) ? ", where players whose games had already kicked off stay with their own team" : ""}.`}</li>
              {o.drops.length ? <li>To make room, {name(o.drops[0].team)} dropped {o.drops.map((d) => pl(d.pid).name).join(" and ")}: their points count against it.</li> : null}
              <li>Each week, each side's best possible lineup from the points its players actually scored, with the deal against without it{Object.values(o.impact).some((s) => s.weeks > s.weeksPlayed) ? "; weeks still to play use ESPN's projection for each week" : ""}.</li>
              {verdict
                ? <li>Trade Analyzer's view when the offer was first on the table: {words(verdict.key, verdict.label, verdict.favors)}. ESPN's weekly projections, run the same way as above, expected {words(eg.key, eg.label, eg.favors)}.</li>
                : <li>Trade Analyzer's view at the time: <b>not recorded</b>, because the offer predates the Postmortem. ESPN's weekly projections, run the same way, expected {words(eg.key, eg.label, eg.favors)}.</li>}
            </ul>
          </div>
        </div></div>
      )}
    </div>
  );
}

/** `teams`: today's teams from Trade Analyzer's board ({ id, n, logo }); `me`: the team chosen on the home page. */
export default function Postmortem({ teams, me }) {
  const [state, setState] = useState({ ready: null });
  const [season, setSeason] = useState(null);
  const [only, setOnly] = useState(false);
  const [openId, setOpenId] = useState(null);
  useEffect(() => {
    let dead = false;
    const q = season ? `?season=${season}` : "";
    fetch(`/api/trade/postmortem${q}`, { credentials: "same-origin" }).then((r) => r.json()).then((d) => { if (!dead) { setState(d); if (!season && d.season) setSeason(d.season); } })
      .catch(() => { if (!dead) setState({ ready: false, error: true }); });
    return () => { dead = true; };
  }, [season]);
  const doc = state.doc || null;
  const now = Object.fromEntries((teams || []).map((t) => [t.id, t]));
  const T = (id) => {
    const cur = now[id], then = doc && (doc.teams || []).find((t) => t.id === id);
    // G8: today's name, with the name it had then when it differs.
    return { name: cur ? cur.n : then ? then.name : `Team ${id}`, logo: cur ? cur.logo || null : null, then: cur && then && then.name !== cur.n ? then.name : null };
  };
  const list = ((doc && doc.offers) || []).filter((o) => !only || o.sides.some((s) => s.team === me));
  const done = list.filter((o) => o.status === "completed"), not = list.filter((o) => o.status !== "completed");
  const group = (title, items, empty) => (
    <section className="pm-group">
      <div className="pm-subhead"><span>{title}</span><span className="pm-n">{items.length}</span></div>
      {items.length ? <div className="offerlist">{items.map((o) => <OfferPM key={o.id} o={o} T={T} players={doc.players || {}} me={me} open={openId === o.id} onToggle={() => setOpenId(openId === o.id ? null : o.id)} />)}</div>
        : <div className="placeholder"><b>{empty}</b></div>}
    </section>
  );
  const seasons = state.seasons || [];
  return (
    <div className="pm" id="postmortem">
      <div className="sechead"><span className="t">Postmortem</span><span className="rule" /><span className="count">{doc ? `${list.length} decided ${list.length === 1 ? "offer" : "offers"}` : "not ready"}</span></div>
      {state.ready === null ? <div className="placeholder"><b>Loading the Postmortem</b></div>
        : !doc ? <div className="placeholder"><b>The Postmortem is being worked out</b><span>Every trade offer this league has made is read from ESPN, a few at a time; this fills in once the first season is done.</span></div>
          : <>
            <p className="pm-lead">Every decided trade offer, judged by what it did, or would have done, to both teams' lineups week by week. Offers still on the table appear above.</p>
            <div className="pm-deck">
              {seasons.length > 1 ? (
                <div className="pm-seasons" role="tablist" aria-label="Season">
                  {seasons.map((s) => <button key={s.season} type="button" role="tab" aria-selected={season === s.season} className={season === s.season ? "on" : ""} onClick={() => { setSeason(s.season); setOpenId(null); }}>{s.season}<span className="pm-sn">{s.decided}</span></button>)}
                </div>
              ) : null}
              {me != null ? <button type="button" className={`pm-only${only ? " on" : ""}`} aria-pressed={only} onClick={() => setOnly((v) => !v)}>My team only</button> : null}
            </div>
            {group("Completed", done, `No trade went through in ${doc.season}`)}
            {group("Not completed", not, only ? "None of your offers was left undone" : "Every offer went through")}
          </>}
    </div>
  );
}

export const PM_CSS = `
.pm { margin-top:var(--sp-3); }
.pm-lead { color:var(--ink-2); margin:2px 0 12px; max-width:80ch; font-size:var(--fs-small); }
.pm-deck { display:flex; flex-wrap:wrap; gap:8px 12px; align-items:center; margin-bottom:14px; }
.pm-seasons { display:inline-flex; flex-wrap:wrap; gap:4px; }
.pm-seasons button, .pm-only { font:inherit; font-size:var(--fs-small); font-weight:900; letter-spacing:.04em; background:var(--panel); color:var(--ink-2);
  border:1px solid var(--line); padding:6px 12px; cursor:pointer; }
.pm-seasons button.on, .pm-only.on { color:var(--on-accent); background:var(--accent); border-color:var(--accent); }
.pm-sn { margin-left:6px; font-size:var(--fs-micro); opacity:.85; }
.pm-group { margin-bottom:var(--sp-3); }
.pm-subhead { display:flex; align-items:baseline; gap:8px; margin:8px 0; font-weight:900; letter-spacing:.14em; text-transform:uppercase;
  font-size:var(--fs-small); color:var(--ink-2); }
.pm-n { color:var(--ink-3); }
.pm-swap { font-size:18px; color:var(--accent-deep); }
.offer.pm-mine { border-left:3px solid var(--accent); }
.chip.dim { color:var(--ink-3); }
.pm-when { color:var(--ink-2); }
.pm-gap { color:var(--ink-2); text-transform:none; letter-spacing:.02em; font-size:var(--fs-small); }
.pm-exp { text-transform:none; letter-spacing:.02em; color:var(--ink-3); font-size:var(--fs-small); }
.pm-exp b { font-weight:900; }
.pm-body { padding-top:var(--sp-2); }
.pm-sides { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:10px; }
.pm-side { border:1px solid var(--line); background:var(--inset); padding:10px 12px; }
.pm-side.fav { border-color:var(--accent-deep); }
.pm-sidehead { display:flex; align-items:center; gap:8px; margin-bottom:8px; flex-wrap:wrap; }
.pm-sidehead .lgo { width:24px; height:24px; flex:none; }
.pm-tn { font-weight:900; }
.pm-then { font-size:var(--fs-micro); color:var(--ink-3); }
.pm-figs { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
.pm-fig { display:grid; grid-template-rows:28px 30px 28px; align-items:center; text-align:center; border:1px solid var(--line); padding:6px; background:var(--panel); }
.pm-fl { font-size:var(--fs-micro); font-weight:900; letter-spacing:.12em; text-transform:uppercase; color:var(--ink-3); line-height:1.25; }
.pm-fv { font-size:20px; font-weight:900; font-variant-numeric:tabular-nums; }
.pm-fv.pos { color:var(--accent); } .pm-fv.neg { color:var(--flag); }
.pm-fh { font-size:var(--fs-micro); color:var(--ink-3); line-height:1.25; }
.pm-chart { margin-top:12px; border:1px solid var(--line); background:var(--panel); padding:8px 10px; }
.pm-chart svg { width:100%; height:auto; display:block; }
.pm-legend { display:flex; flex-wrap:wrap; gap:4px 14px; font-size:var(--fs-small); color:var(--ink-2); }
.pm-legend span { display:inline-flex; align-items:center; gap:6px; }
.pm-sw { width:12px; height:10px; display:inline-block; }
.pm-sw.a { background:var(--accent); } .pm-sw.b { background:var(--sky); }
.pm-sw.f { background:var(--line-2); border:1px dashed var(--ink-3); }
.pm-bar.a { fill:var(--accent); } .pm-bar.b { fill:var(--sky); }
.pm-bar.f { fill-opacity:.35; stroke-dasharray:2 2; stroke-width:1; }
.pm-bar.a.f { stroke:var(--accent); } .pm-bar.b.f { stroke:var(--sky); }
.pm-zero { stroke:var(--line-2); stroke-width:1; }
.pm-futband { fill:var(--ink); fill-opacity:.04; }
.pm-ax { fill:var(--ink-3); font-size:10px; }
.pm-axcap { font-size:var(--fs-micro); color:var(--ink-3); text-align:center; }
.pm-notes { margin:12px 0 0; padding-left:18px; color:var(--ink-2); font-size:var(--fs-small); }
.pm-notes li { margin:3px 0; }
.pm-note { color:var(--ink-3); }
`;
