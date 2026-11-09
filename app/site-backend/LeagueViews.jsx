import React from "react";
import { NO_TEAM } from "./visits.js";
import { teamVar } from "../shared/teamcolours.js";

/**
 * Site Backend's Activity tab, week 10 (plan D30, G9–G11): four views of how the league uses the site, every one read
 * from the log's small rollups (visits by hour all season, and each team's sign-ins, copies and shares per day), never
 * the events table. Each panel starts shut; the tab asks for the rollups only while one is open.
 *   Teams active per day · Tool reach · When the league visits · Teams
 */
const DAY = 86400000;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const num = (n) => Number(n || 0).toLocaleString("en-US");
const zone = () => { try { return document.documentElement.dataset.tz || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; } };
const dayText = (t) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(t);

function Shell({ id, title, sub, sum, open, onToggle, children }) {
  return (
    <section className={"panel" + (open ? "" : " shut")} id={id}>
      <div className="ph">
        <button className="tog" type="button" aria-expanded={open} aria-controls={`b-${id}`} onClick={onToggle}>
          <span className="caret" aria-hidden="true">▾</span>
          <span className="phx"><span className="pt">{title}</span><span className="psum"><span>{sum}</span></span>{sub ? <span className="ps">{sub}</span> : null}</span>
        </button>
      </div>
      {open ? <div className="pb" id={`b-${id}`}>{children}</div> : null}
    </section>
  );
}

export default function LeagueViews({ d, lv, setLv }) {
  const ids = Object.keys((d && d.teams) || {}).map(Number).sort((a, b) => a - b);
  const name = (k) => (k === NO_TEAM ? "No team chosen" : ((d.teams || {})[k] || {}).name || `Team ${k}`);
  const colour = (k) => teamVar(k, ids);
  const pages = (d.pages || []).filter(([k]) => k !== "signin" && k !== "wizard");
  const open = (k) => lv.has(k);
  const toggle = (k) => setLv((s) => { const x = new Set(s); if (x.has(k)) x.delete(k); else x.add(k); return x; });
  const waiting = (x) => (!x ? <div className="loading">Reading the log…</div> : x.rest ? <div className="restnote">{x.rest}</div> : null);
  const V = d.visits, M = d.month;

  /* Teams active per day: the month's UTC days, each team with a visit that day. */
  let active = null, avgActive = "0";
  if (M && !M.rest) {
    const since = M.since || M.from;
    const days = {};
    for (const [t, , team] of M.rows) { if (!team) continue; const k = Math.floor(t / DAY) * DAY; (days[k] = days[k] || new Set()).add(team); }
    const list = []; for (let t = Math.floor(M.from / DAY) * DAY; t <= M.to; t += DAY) list.push({ t, ids: days[t] ? [...days[t]].sort((a, b) => a - b) : [], na: t + DAY <= since });
    const rec = list.filter((x) => !x.na);
    avgActive = rec.length ? (rec.reduce((s, x) => s + x.ids.length, 0) / rec.length).toFixed(1) : "0";
    active = list;
  }
  /* Tool reach: how many teams opened each page in the range chosen on Visits over time. */
  let reach = null;
  if (V && !V.rest) {
    const by = {};
    for (const [, page, team] of V.rows) { if (!team) continue; (by[page] = by[page] || new Set()).add(team); }
    reach = pages.map(([k, l]) => [k, l, by[k] ? [...by[k]] : []]).sort((a, b) => b[2].length - a[2].length);
  }
  /* When the league visits: the season's hours by weekday and hour, in the reader's zone. */
  let heat = null, heatMax = 1;
  const H = d.hours;
  if (H && !H.rest) {
    heat = {};
    const f = new Intl.DateTimeFormat("en-US", { weekday: "short", hour: "numeric", hour12: false, timeZone: zone() });
    for (const [t, , , n] of H.rows) {
      const parts = f.formatToParts(t);
      const wd = parts.find((p) => p.type === "weekday").value, hr = Number(parts.find((p) => p.type === "hour").value) % 24;
      const k = `${wd}|${hr}`; heat[k] = (heat[k] || 0) + n;
    }
    heatMax = Math.max(1, ...Object.values(heat));
  }
  /* Teams: visits in the range, a 30-day strip, days seen, last seen, favourite page, sign-ins, copies, shares. */
  let cards = null;
  if (V && !V.rest && M && !M.rest) {
    const acts = (d.acts && d.acts.teams) || {};
    const since = M.since || M.from;
    cards = ids.map((id) => {
      const mine = V.rows.filter((r) => r[2] === id);
      const n = mine.reduce((s, r) => s + r[3], 0);
      // Last seen is the latest visit in the range or, before it, in the last 30 days (never a dash beside a day seen).
      const seen = mine.concat(M.rows.filter((r) => r[2] === id));
      const last = seen.length ? Math.max(...seen.map((r) => r[0])) : null;
      const fav = {}; for (const r of mine) fav[r[1]] = (fav[r[1]] || 0) + r[3];
      const top = Object.entries(fav).sort((a, b) => b[1] - a[1])[0];
      const strip = []; for (let t = Math.floor(M.from / DAY) * DAY; t <= M.to; t += DAY) strip.push(t + DAY <= since ? null : M.rows.filter((r) => r[2] === id && Math.floor(r[0] / DAY) * DAY === t).reduce((s, r) => s + r[3], 0));
      const a = acts[id] || { signin: 0, copy: 0, share: 0 };
      return { id, n, last, top, strip, on: strip.filter(Boolean).length, rec: strip.filter((v) => v != null).length, a };
    }).sort((x, y) => y.n - x.n);
  }
  const pageName = (k) => ((d.pages || []).find((p) => p[0] === k) || [k, k])[1];
  return (
    <>
      <Shell id="p-active" title="Teams active per day" open={open("p-active")} onToggle={() => toggle("p-active")}
        sum={active ? `${avgActive} of ${ids.length} teams a day on average` : "last 30 days"}
        sub="How many of the league's teams opened the site each UTC day of the last 30; a visit with no team chosen is left out. Hatched days come before the log recorded visits.">
        {waiting(M) || (
          <>
            <div className="lvdays" style={{ "--n": active.length }}>
              <i className="lvfull" aria-hidden="true" />
              {active.map((x) => x.na ? <div key={x.t} className="lvday lvna" title={`${dayText(x.t)}: before the log recorded visits`} /> : (
                <div key={x.t} className="lvday" title={`${dayText(x.t)}: ${x.ids.length} ${x.ids.length === 1 ? "team" : "teams"}${x.ids.length ? ` (${x.ids.map(name).join(", ")})` : ""}`}>
                  <span className="lvstack" style={{ height: `${ids.length ? (x.ids.length / ids.length) * 100 : 0}%` }}>{x.ids.map((id) => <i key={id} style={{ background: colour(id) }} />)}</span>
                </div>
              ))}
            </div>
            <div className="lvaxis"><span>{dayText(active[0].t)}</span><span>{dayText(active[active.length - 1].t)}</span></div>
          </>
        )}
      </Shell>
      <Shell id="p-reach" title="Tool reach" open={open("p-reach")} onToggle={() => toggle("p-reach")}
        sum={reach ? `${reach.filter((r) => r[2].length).length} of ${reach.length} pages opened by a team` : "the range on Visits over time"}
        sub="How many teams opened each page in the range chosen on Visits over time, however often: a page nobody opens sinks to the bottom. One square per team, in its colour.">
        {waiting(V) || (
          <div className="lvreach">
            {reach.map(([k, l, on]) => (
              <div className="lvrrow" key={k}>
                <span className="lvrl">{l}</span>
                <span className="lvsq">{ids.map((id) => <i key={id} className={on.includes(id) ? "on" : ""} style={on.includes(id) ? { background: colour(id) } : undefined} title={`${name(id)}${on.includes(id) ? "" : ": not in this range"}`} />)}</span>
                <span className="lvrn">{on.length} of {ids.length}</span>
              </div>
            ))}
          </div>
        )}
      </Shell>
      <Shell id="p-when" title="When the league visits" open={open("p-when")} onToggle={() => toggle("p-when")}
        sum={heat ? `this season, ${zone()}` : "this season"} sub="Every visit this season by weekday and hour, in your time zone; darker is more.">
        {waiting(H) || (
          <div className="lvheat">
            <span />{Array.from({ length: 24 }, (_, h) => <span key={h} className="lvhh">{h % 3 === 0 ? h : ""}</span>)}
            {DAYS.map((day) => (
              <React.Fragment key={day}>
                <span className="lvhd">{day}</span>
                {Array.from({ length: 24 }, (_, h) => { const n = heat[`${day}|${h}`] || 0; return <i key={h} style={{ "--a": n ? 0.15 + 0.85 * (n / heatMax) : 0 }} title={`${day} ${h}:00, ${num(n)} ${n === 1 ? "visit" : "visits"}`} />; })}
              </React.Fragment>
            ))}
          </div>
        )}
      </Shell>
      <Shell id="p-teams" title="Teams" open={open("p-teams")} onToggle={() => toggle("p-teams")}
        sum={cards ? `${cards.filter((c) => c.n).length} of ${cards.length} teams seen in the range` : "the range on Visits over time"}
        sub="Per team, for the range chosen on Visits over time: visits, the last 30 days one bar a day, days seen, last seen, favourite page, and sign-ins, copies of the league data and shared links.">
        {waiting(V) || waiting(M) || (
          <div className="lvcards">
            {cards.map((c) => {
              const m = Math.max(1, ...c.strip.filter((v) => v != null));
              const t = (d.teams || {})[c.id] || {};
              return (
                <div className="lvcard" key={c.id}>
                  <div className="lvct">{t.logo ? <img src={t.logo} alt="" /> : null}<b>{name(c.id)}</b></div>
                  <div className="lvstrip" title={`${c.on} of ${c.rec} recorded days with a visit`}>{c.strip.map((v, i) => <i key={i} className={v == null ? "na" : ""} style={{ height: v == null ? "100%" : v ? `${18 + 82 * (v / m)}%` : "2px", background: v ? colour(c.id) : undefined }} />)}</div>
                  <dl>
                    <dt>Visits</dt><dd>{num(c.n)}</dd>
                    <dt>Days seen</dt><dd>{c.on} of {c.rec}</dd>
                    <dt>Last seen</dt><dd>{c.last ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: zone() }).format(c.last) : "—"}</dd>
                    <dt>Favourite</dt><dd>{c.top ? pageName(c.top[0]) : "—"}</dd>
                    <dt>Sign-ins</dt><dd>{num(c.a.signin)}</dd><dt>Copies</dt><dd>{num(c.a.copy)}</dd><dt>Shares</dt><dd>{num(c.a.share)}</dd>
                  </dl>
                </div>
              );
            })}
          </div>
        )}
        {d.acts && d.acts.since ? <p className="note">Sign-ins, copies and shares counted since {dayText(d.acts.since)}.</p> : null}
      </Shell>
    </>
  );
}

export const LEAGUE_VIEWS_CSS = `
.lvdays { position:relative; display:grid; grid-template-columns:repeat(var(--n),minmax(0,1fr)); gap:2px; height:120px; align-items:end; margin-top:6px; }
.lvfull { position:absolute; left:0; right:0; top:0; border-top:1px dashed var(--line-2); }
.lvday { height:100%; display:flex; align-items:flex-end; background:color-mix(in srgb,var(--ink) 3%,transparent); }
.lvday.lvna { background:repeating-linear-gradient(135deg,transparent 0 4px,color-mix(in srgb,var(--ink) 8%,transparent) 4px 6px); }
.lvstack { display:flex; flex-direction:column-reverse; width:100%; }
.lvstack i { flex:1 1 0; min-height:2px; border-top:1px solid var(--panel); }
.lvaxis { display:flex; justify-content:space-between; font-size:10px; color:var(--faint); margin-top:4px; }
.lvreach { display:grid; gap:6px; }
.lvrrow { display:grid; grid-template-columns:minmax(110px,170px) 1fr auto; gap:10px; align-items:center; font-size:12px; }
.lvrl { font-weight:800; }
.lvsq { display:flex; flex-wrap:wrap; gap:3px; }
.lvsq i { width:12px; height:12px; border:1px solid var(--line-2); }
.lvsq i.on { border-color:transparent; }
.lvrn { color:var(--dim); font-variant-numeric:tabular-nums; white-space:nowrap; }
.lvheat { display:grid; grid-template-columns:34px repeat(24,minmax(0,1fr)); gap:2px; font-size:10px; color:var(--faint); }
.lvheat i { aspect-ratio:1; background:color-mix(in srgb,var(--acc) calc(var(--a) * 100%),color-mix(in srgb,var(--ink) 4%,transparent)); }
.lvhh { text-align:center; } .lvhd { font-weight:800; color:var(--dim); align-self:center; }
.lvcards { display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:10px; }
.lvcard { border:1px solid var(--line); padding:10px 12px; background:var(--panel-2,var(--panel)); }
.lvct { display:flex; align-items:center; gap:8px; margin-bottom:8px; } .lvct img { width:22px; height:22px; } .lvct b { font-weight:900; }
.lvstrip { display:flex; align-items:flex-end; gap:1px; height:34px; margin-bottom:8px; }
.lvstrip i { flex:1 1 0; background:color-mix(in srgb,var(--ink) 8%,transparent); }
.lvstrip i.na { background:repeating-linear-gradient(135deg,transparent 0 3px,color-mix(in srgb,var(--ink) 8%,transparent) 3px 5px); }
.lvcard dl { display:grid; grid-template-columns:auto 1fr; gap:2px 10px; margin:0; font-size:12px; }
.lvcard dt { color:var(--dim); } .lvcard dd { margin:0; text-align:right; font-weight:800; font-variant-numeric:tabular-nums; }
@media (max-width:520px) { .lvrrow { grid-template-columns:1fr auto; } .lvsq { grid-column:1 / -1; } .lvheat { grid-template-columns:28px repeat(24,minmax(0,1fr)); font-size:8px; } }
`;
