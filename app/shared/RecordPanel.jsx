import React, { useState, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { pts2, ptsSigned } from "../../src/ui.js";
import { TeamStrip, Placeholder } from "../hall-of-fame/HallOfFame.jsx";

/**
 * The one record panel (Week 10 plan, D13, D24–D26, D34–D36): Season Statistics' anatomy, shared so Hall of Fame and
 * Season Statistics draw records the same way. Five fixed areas (title, value, subtitle, week label, holders), the
 * info note with Next, winner and loser chips on matchup records, the red tone on bad records, Live on records a game
 * in progress can beat.
 *
 * A "Show top N" bar at the foot of a panel with more than one entry opens the panel to the full width of its row
 * (Hall of Fame's FLIP expansion), then slides its table open beneath the face at the site's disclosure rate; closing
 * runs the other way. Any number can be open; each closes only on its own bar. The table has no header row; team
 * names take the site gradient and are set from the left. A value with more to tell carries a dotted underline:
 * tapping it opens a small note beside it (entry.pop), or a row under it listing what counted (entry.detail).
 *
 * rec: { id, title, unit, tone, info, kind?, word?, better?, live?, since?, empty?, inPlay?,
 *        entries: [{ teams, value, vs?, season?, week?, span?, text?, sub?, player?, team?, good?, bad?, pop?, detail? }] }
 * T(id, season?) -> { name, logo, then? }   liveOn: the live overlay is on   glowSeason: Hall of Fame's current season
 */
const COUNTS = new Set(["n", "wks", "teams"]);
const TOP_N = 10;
const pct1 = (x) => `${(Math.round(Number(x || 0) * 1000 + 1e-6) / 10).toFixed(1)}%`;
const signed = (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v)}`;
export function fmtValue(rec, e) {
  const v = e.value;
  switch (rec.unit) {
    case "pts": return pts2(v);
    case "diff": return ptsSigned(v);
    case "diff1": return `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}`;
    case "pct": return e.text || pct1(v);
    case "wp": return `${Number(v).toFixed(0)}%`;
    case "rec": return e.text || String(v);
    case "power": return Number(v).toFixed(1);
    case "place": return Number(v).toFixed(2);
    case "places": return rec.id === "S79" ? String(Math.abs(v)) : signed(v);
    case "net": return signed(v);
    default: return String(v);
  }
}
export function unitWord(rec, e) {
  if (rec.word) return rec.word;
  if (rec.id.startsWith("S11.")) return e.value === 1 ? "game in a row" : "games in a row";
  if (rec.unit === "wks") return "weeks in a row";
  if (rec.unit === "teams") return e.value === 1 ? "team" : "teams";
  if (rec.id === "S79") return "places down at his position";
  if (rec.unit === "places") return rec.kind === "player" ? "places at his position" : Math.abs(e.value) === 1 ? "place" : "places";
  if (rec.unit === "diff1") return Math.abs(e.value) === 1 ? "win" : "wins";
  if (rec.unit === "place") return "average place";
  if (rec.unit === "pct" && e.text) return "all-play record";
  if (rec.id === "S110" && e.text) { const n = e.text.split("-").reduce((x, y) => Number(x) + Number(y), 0); return n === 1 ? "after week 1" : `after ${n} weeks`; }
  return "";
}
export const weekLabel = (e) => e.when || [e.season, e.span ? (e.span[0] === e.span[1] ? `Week ${e.span[0]}` : `Weeks ${e.span[0]}–${e.span[1]}`) : e.week ? `Week ${e.week}` : ""].filter(Boolean).join(" · ");
const holdersOf = (rec) => (rec.entries.length ? rec.entries.filter((e) => e.value === rec.entries[0].value) : []);
const ord = (n) => `${n}${[, "st", "nd", "rd"][(n % 100 >> 3 ^ 1) && n % 10] || "th"}`;
export function emptyOf(rec) {
  if (rec.empty) return rec.empty;
  if (!rec.entries.length) return { title: "Not yet", note: "Nothing to show for this period yet." };
  if (COUNTS.has(rec.unit) && rec.entries[0].value === 0 && rec.better !== "low") return { title: "None yet", note: rec.info };
  return null;
}

/* --------------------------------------------------------------- the FLIP expansion, as Hall of Fame's flipRow */
const EXPAND_RATE = 1.05, MIN_MS = 460, MAX_MS = 1150, EASE = "cubic-bezier(.25,.9,.25,1)";
const still = () => document.documentElement.classList.contains("stillness") || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarse = () => window.matchMedia("(pointer: coarse)").matches;
function flipRow(row, mutate, onDone) {
  const done = () => { if (onDone) onDone(); };
  if (!row) { mutate(); done(); return; }
  const cards = Array.from(row.children);
  const first = cards.map((el) => el.getBoundingClientRect());
  mutate();
  if (still() || coarse()) { done(); return; }
  const last = cards.map((el) => el.getBoundingClientRect());
  const moved = [];
  let maxDelta = 0;
  cards.forEach((el, i) => {
    const f = first[i], l = last[i];
    if (!l || !f || !l.width || !l.height || !f.width || !f.height) return;
    const dx = f.left - l.left, dy = f.top - l.top, sx = f.width / l.width, sy = f.height / l.height;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sx - 1) < 0.004 && Math.abs(sy - 1) < 0.004) return;
    maxDelta = Math.max(maxDelta, Math.abs(dx), Math.abs(dy), Math.abs(f.width - l.width), Math.abs(f.height - l.height));
    const inner = el.querySelector(".rt-inner");
    const t = `translate(${dx}px,${dy}px) scale(${sx},${sy})`;
    el.style.transformOrigin = "top left"; el.style.transform = t; el.style.willChange = "transform";
    if (inner) { inner.style.transformOrigin = "top left"; inner.style.transform = `scale(${1 / sx},${1 / sy})`; }
    moved.push({ el, inner, t });
  });
  if (!moved.length) { done(); return; }
  const dur = Math.max(MIN_MS, Math.min(MAX_MS, maxDelta / EXPAND_RATE));
  void row.offsetWidth;
  let left = moved.length;
  moved.forEach(({ el, inner, t }) => {
    const a = el.animate([{ transform: t }, { transform: "none" }], { duration: dur, easing: EASE });
    if (inner) inner.animate([{ transform: inner.style.transform }, { transform: "none" }], { duration: dur, easing: EASE });
    a.onfinish = () => { el.style.transform = ""; el.style.willChange = ""; if (inner) inner.style.transform = ""; if (--left === 0) done(); };
  });
}

/* The table drawer opens and shuts at the site's fixed disclosure rate (0.7 px per ms), on its own height only. */
const RATE = 0.7;
function slide(el, open, onDone) {
  if (!el) { if (onDone) onDone(); return; }
  const h = el.scrollHeight;
  if (still() || !h) { el.style.height = open ? "auto" : "0px"; if (onDone) onDone(); return; }
  const dur = Math.max(220, Math.min(900, h / RATE));
  // The end state is set before the animation runs, so the frame between its end and onfinish never flashes the start.
  el.style.height = open ? `${h}px` : "0px";
  const a = el.animate([{ height: open ? "0px" : `${h}px` }, { height: open ? `${h}px` : "0px" }], { duration: dur, easing: "cubic-bezier(.3,.8,.3,1)" });
  a.onfinish = () => { el.style.height = open ? "auto" : "0px"; if (onDone) onDone(); };
}

/* --------------------------------------------------------------- value notes and contribution rows */
function PopValue({ children, open, onToggle, label }) {
  return (
    <button type="button" className={`rt-vbtn${open ? " on" : ""}`} aria-expanded={open ? "true" : "false"} aria-label={label}
      onClick={(ev) => { ev.stopPropagation(); onToggle(); }}>{children}</button>
  );
}
function TeamName({ t }) {
  return <span className="rt-team">{t.logo ? <img src={t.logo} alt="" /> : <i className="rt-nologo" aria-hidden="true" />}<span className="rt-nm">{t.name}</span>{t.then ? <span className="rt-then">as {t.then}</span> : null}</span>;
}
function PopNote({ rows, T }) {
  return (
    <div className="rt-pop" role="note" onClick={(e) => e.stopPropagation()}>
      {rows.map(([k, v], i) => (
        <div className="rt-poprow" key={i}><span className="rt-popk">{k}</span>
          <span className="rt-popv">{Array.isArray(v)
            ? v.map((x, j) => (x && typeof x === "object" ? <TeamName key={j} t={T(x.team, x.season)} /> : <React.Fragment key={j}>{x}</React.Fragment>))
            : v && typeof v === "object" ? <TeamName t={T(v.team, v.season)} /> : v}</span></div>
      ))}
    </div>
  );
}
const refValue = (x) => fmtValue({ unit: x.unit, id: x.id || "" }, { value: x.value, text: x.text });
const refWhen = (x) => [x.player, weekLabel(x)].filter(Boolean).join(" · ");
function Detail({ d, T }) {
  // A streak or a run: every game in it, a row each.
  if (d.kind === "games") {
    return (
      <div className="rt-detail">
        <table className="rt-dtbl rt-gtbl"><tbody>
          {d.games.map((g, i) => (
            <tr key={i} className={g.res === "W" ? "good" : g.res === "L" ? "bad" : ""}>
              <td className="rt-dp">{g.label}</td>
              <td className="rt-gres">{g.res === "W" ? "Beat" : g.res === "L" ? "Lost to" : "Tied"}</td>
              <td className="col-team rt-gopp"><TeamName t={T(g.opp, g.season)} /></td>
              <td className="rt-dv">{pts2(g.own)}–{pts2(g.op)}</td>
            </tr>
          ))}
        </tbody></table>
      </div>
    );
  }
  if (d.kind === "held") {
    const group = (list, label, sign, cls) => (list.length ? (
      <div className={`rt-dgrp ${cls}`}>
        <div className="rt-dgh"><span>{label}</span><b>{sign}{list.length}</b></div>
        <ul>{list.map((x, i) => <li key={i}><span className="rt-dt">{x.title}</span><span className="rt-dv">{refValue(x)}</span>{refWhen(x) ? <span className="rt-dw">{refWhen(x)}</span> : null}</li>)}</ul>
      </div>) : null);
    const none = !d.good.length && !d.bad.length && !d.against.length;
    return (
      <div className="rt-detail">
        {none ? <p className="rt-dnone">Holds no good or bad record outright.</p> : null}
        {group(d.good, "Good records held", "+", "good")}
        {group(d.bad, "Bad records held", "−", "bad")}
        {group(d.against, "Wrong end of a good matchup record", "−", "bad")}
      </div>
    );
  }
  const lines = d.lines || [];
  if (!lines.length) return <div className="rt-detail"><p className="rt-dnone">Not in the top ten of any good or bad record.</p></div>;
  return (
    <div className="rt-detail">
      <table className="rt-dtbl"><tbody>
        {lines.map((x, i) => (
          <tr key={i} className={x.pts > 0 ? "good" : "bad"}>
            <td className="rt-dt">{x.title}{x.side === "against" ? <em> · wrong end</em> : null}</td>
            <td className="rt-dp">{ord(x.place)}</td>
            <td className="rt-dv">{refValue(x)}{refWhen(x) ? <span className="rt-dw">{refWhen(x)}</span> : null}</td>
            <td className="rt-dpts">{signed(x.pts)}</td>
          </tr>
        ))}
      </tbody></table>
    </div>
  );
}

/** The table inside an open panel: no header row, every row a place. */
export function TopTable({ rec, T, glowSeason }) {
  const match = rec.kind === "match" || rec.kind === "pair";
  const list = rec.entries.slice(0, TOP_N);
  const showWhen = list.some((e) => weekLabel(e)) && !rec.standing;
  const [pop, setPop] = useState(null);
  useEffect(() => {
    if (pop == null) return undefined;
    const close = () => setPop((p) => (p != null && list[p] && list[p].detail ? p : null));
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [pop, list]);
  let place = 0, last = null;
  const cols = 3 + (showWhen ? 1 : 0);
  return (
    <table className="rt-toptbl" aria-label={`${rec.title}: top ${list.length}`}>
      <tbody>
        {list.map((e, i) => {
          if (i === 0 || e.value !== last) { place = i + 1; last = e.value; }
          const who = match && e.vs ? e.vs : e.teams || [];
          const lead = e.value === list[0].value;
          const has = e.pop || e.detail;
          const val = fmtValue(rec, e);
          // Hall of Fame only: a row from the season being played glows like its panel (first place bright, others dim).
          const glow = glowSeason != null && (e.season === glowSeason || e.endSeason === glowSeason) ? (place === 1 ? " rt-rglow" : " rt-rglow2") : "";
          return (
            <React.Fragment key={i}>
              <tr className={`${lead ? "rt-lead" : ""}${pop === i ? " rt-sel" : ""}${glow}`}>
                <td className="rt-rank">{place}</td>
                <td className="col-team rt-tc">
                  <span className="rt-who">
                    {e.player ? <span className="rt-pl">{e.player.name} · {e.player.pos}</span> : null}
                    {who.map((id, k) => (
                      <React.Fragment key={k}>
                        {k > 0 ? <span className="rt-vs">{match ? (e.teams && e.teams.length === 1 ? "over" : "&") : "&"}</span> : null}
                        <TeamName t={T(id, e.season)} />
                      </React.Fragment>
                    ))}
                    {e.player && !e.team && !who.length ? <span className="rt-then">free agent</span> : null}
                  </span>
                </td>
                <td className="rt-val">
                  {has ? (
                    <span className="rt-popwrap">
                      <PopValue open={pop === i} onToggle={() => setPop(pop === i ? null : i)} label={`${val}: more about this`}>{val}</PopValue>
                      {pop === i && e.pop ? <PopNote rows={e.pop} T={T} /> : null}
                    </span>
                  ) : val}
                </td>
                {showWhen ? <td className="rt-when">{weekLabel(e) || "Career"}</td> : null}
              </tr>
              {pop === i && e.detail ? <tr className="rt-drow"><td colSpan={cols}><Detail d={e.detail} T={T} /></td></tr> : null}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

export default function RecordPanel({ rec, T, open, onToggle, ipBand, liveOn, glowSeason }) {
  const [note, setNote] = useState(false);
  useEffect(() => {
    if (!note) return undefined;
    const close = () => setNote(false);
    const esc = (e) => { if (e.key === "Escape") setNote(false); };
    document.addEventListener("click", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("click", close); document.removeEventListener("keydown", esc); };
  }, [note]);
  const empty = emptyOf(rec);
  const hs = empty ? [] : holdersOf(rec);
  const first = hs[0];
  const text = first ? fmtValue(rec, first) : "—";
  const auto = text.length > 9 ? "small" : text.length > 6 ? "med" : "";
  const runner = !empty && rec.entries.find((e) => e.value !== first.value);
  const match = rec.kind === "match" || rec.kind === "pair";
  const decided = (e) => Boolean(e.vs && e.teams && e.teams.length === 1 && e.teams[0] === e.vs[0]);
  const chip = (id, season) => { const t = T(id, season); return { teamId: `${id}-${season || ""}`, name: t.name, logo: t.logo, owner: t.then ? `as ${t.then}` : undefined }; };
  const entryName = (e) => {
    if (!e) return "";
    if (e.player) return e.player.name;
    if (e.vs) return `${T(e.vs[0], e.season).name} vs ${T(e.vs[1], e.season).name}`;
    return (e.teams || []).map((id) => T(id, e.season).name).join(" & ");
  };
  const own = new Set(hs.map(weekLabel)).size > 1;
  const isLive = liveOn && rec.live;
  const net = rec.unit === "net" && first;
  const tally = net && first.good != null && hs.every((e) => e.good === first.good && e.bad === first.bad);
  const good = rec.tone > 0;
  let names = [], vs = null;
  if (!empty) {
    if (rec.kind === "player" || first.player) {
      names = hs.map((e, i) => ({ teamId: `${e.player.name}-${e.team}-${i}`, name: `${e.player.name} · ${e.player.pos}`,
        logo: e.team ? T(e.team, e.season).logo : null,
        owner: [e.against ? `against ${T(e.team, e.season).name}` : e.team ? T(e.team, e.season).name : "Free agent", own ? weekLabel(e) : ""].filter(Boolean).join(" · ") }));
    } else if (match) {
      vs = hs.map((e) => (decided(e)
        ? [{ ...chip(e.vs[0], e.season), cls: "sswin" }, { ...chip(e.vs[1], e.season), cls: "sslose" }]
        : [chip(e.vs[0], e.season), chip(e.vs[1], e.season)]));
    } else names = hs.flatMap((e) => e.teams.map((id) => ({ ...chip(id, e.season), owner: own ? weekLabel(e) : chip(id, e.season).owner })));
  }
  const wk = first && !own ? weekLabel(first) : "";
  const unit = first ? unitWord(rec, first) : "";
  const level = net && !tally && hs.length > 1;
  const sub = !empty && (unit || level || first.sub || tally);
  const ip = rec.inPlay;
  const n = Math.min(rec.entries.length, TOP_N);
  const bad = rec.tone < 0 || (rec.unit === "net" && rec.better === "low");
  // Hall of Fame only: a golden glow when the record shown is held by the season being played, a fainter one when the
  // season being played is somewhere in its top ten.
  const glow = glowSeason == null || empty ? "" : hs.some((e) => e.season === glowSeason || e.endSeason === glowSeason) ? " rt-glow" : rec.entries.slice(0, TOP_N).some((e) => e.season === glowSeason || e.endSeason === glowSeason) ? " rt-glow2" : "";
  return (
    <div className={`tile ssrec rt-card${isLive ? " sslive" : ""}${bad ? " ssbad" : ""}${open ? " rt-open" : ""}${ipBand ? " rt-hasip" : ""}${glow}`} data-rec={rec.id}>
      <div className="rt-inner">
        <button className="tinfo" type="button" aria-expanded={note ? "true" : "false"} aria-label={`About ${rec.title}`}
          onClick={(e) => { e.stopPropagation(); setNote((v) => !v); }}>i</button>
        {note && (
          <div className="tnote" onClick={(e) => e.stopPropagation()}>
            {rec.info}
            {rec.since && <span className="ssnext"><b>Recorded</b> from week {rec.since}, when the site began recording games as they were played</span>}
            {match && hs.filter(decided).map((e, i) => (
              <span className="ssnext" key={`m${i}`}><b>{good ? "For" : "Won"}</b> {T(e.vs[0], e.season).name} <b className="ssagainst">{good ? "Against" : "Lost"}</b> {T(e.vs[1], e.season).name}</span>
            ))}
            {net && first.good != null && hs.map((e) => <span className="ssnext" key={e.teams[0]}><b>{T(e.teams[0]).name}</b> {e.good} good, {e.bad} bad</span>)}
            {runner && <span className="ssnext"><b>Next</b> {fmtValue(rec, runner)}{entryName(runner) ? ` · ${entryName(runner)}` : ""}{runner.season ? ` · ${weekLabel(runner)}` : ""}</span>}
            {ip && <span className="ssnext"><b>In play</b> {T(ip.team).name}, {ip.text || fmtValue(rec, ip)}{ip.games ? ` after ${ip.games} ${ip.games === 1 ? "game" : "games"}` : ""}{ip.pace ? `, on pace for ${pts2(ip.pace)}` : ""}{ip.settled ? ". Already past the mark: it counts." : ". Counts once the season ends or it can no longer be lost."}</span>}
          </div>
        )}
        {/* Fixed areas, each centred in its own band, so a wrapped title or a smaller value never moves the rest. */}
        <div className="tlabel ssarea-t"><div className="sstbox"><i className="ssfl" aria-hidden="true" /><i className="ssfr" aria-hidden="true" /><span className="sstitle">{rec.title}</span></div></div>
        {empty ? <div className="ssarea-e"><Placeholder title={empty.title} /></div> : (
          <>
            <div className="ssarea-v"><div className={`tvalue gradv ${auto}`}>{text}</div></div>
            <div className="ssarea-s">
              {sub && (
                <span className="ssline">
                  {unit && !tally && <span className="ssunit">{unit}</span>}
                  {level && <span className="ssunit">{hs.length} teams level</span>}
                  {first.sub && <span className="ssmeta">{first.sub}</span>}
                  {tally && (
                    <span className="sstally" aria-label={`${first.good} good, ${first.bad} bad`}>
                      <span className="sstallybar" aria-hidden="true">
                        <i className="g" style={{ flexGrow: first.good }} /><i className="b" style={{ flexGrow: first.bad }} />
                      </span>
                      <span className="sstallytxt"><b className="g">{first.good}</b> good <b className="b">{first.bad}</b> bad</span>
                    </span>
                  )}
                </span>
              )}
            </div>
            <div className="ssarea-w">
              {isLive && <span className="sslivechip">Live</span>}
              {wk && <span className="sswk">{wk}</span>}
            </div>
          </>
        )}
        <div className="ssarea-n">{empty ? <div className="tfootnames" /> : <TeamStrip teams={names} vs={vs} />}</div>
        {ipBand && <div className="rt-area-ip">{ip && !ip.settled && <span className="rt-inplay" title="This season's leader, not yet counted">In play: {ip.text || fmtValue(rec, ip)}</span>}</div>}
        <div className="rt-area-m">
          {n > 1 && !empty && (
            <button type="button" className="rt-more" aria-expanded={open ? "true" : "false"} onClick={(e) => { e.stopPropagation(); onToggle(e.currentTarget.closest(".rt-card")); }}>
              <span>{open ? `Hide top ${n}` : `Show top ${n}`}</span><i className="rt-chev" aria-hidden="true" />
            </button>
          )}
        </div>
        {open && <div className="rt-drawer" style={{ height: 0 }}><div className="rt-drawin"><TopTable rec={rec} T={T} glowSeason={glow ? glowSeason : null} /></div></div>}
      </div>
    </div>
  );
}

/** A row of record panels. Any number of panels may be open at once; each closes only on its own bar. */
export function RecordGrid({ recs, T, liveOn, glowSeason, cls = "" }) {
  const [open, setOpen] = useState(() => new Set());
  const busy = useRef(new Set());
  const set = (id, on) => flushSync(() => setOpen((s) => { const x = new Set(s); if (on) x.add(id); else x.delete(id); return x; }));
  const toggle = (id, card) => {
    if (busy.current.has(id)) return;                       // one animation at a time per panel
    busy.current.add(id);
    const row = card.parentElement, free = () => busy.current.delete(id);
    if (!open.has(id)) flipRow(row, () => set(id, true), () => slide(card.querySelector(".rt-drawer"), true, free));
    else slide(card.querySelector(".rt-drawer"), false, () => flipRow(row, () => set(id, false), free));
  };
  // A grid that has an In play line keeps the band on every panel, so their heights stay equal.
  const ipBand = recs.some((r) => r.inPlay);
  return (
    <div className={`rowgrid ${cls}`}>{recs.map((r) => <RecordPanel key={r.id} rec={r} T={T} ipBand={ipBand} liveOn={liveOn} glowSeason={glowSeason} open={open.has(r.id)} onToggle={(card) => toggle(r.id, card)} />)}</div>
  );
}

/* The panel's layout and its table, under .scr-ss (the root both tools give their record sections). */
export const RECORD_CSS = `
.scr-ss .ssrec.rt-card { display:block; }
.scr-ss .rt-card > .rt-inner { display:grid; grid-template-rows:var(--ss-t) var(--ss-v) var(--ss-s) var(--ss-w) var(--ss-n) 22px;
  row-gap:5px; align-items:stretch; }
.scr-ss .rt-card.rt-hasip > .rt-inner { grid-template-rows:var(--ss-t) var(--ss-v) var(--ss-s) var(--ss-w) var(--ss-n) var(--ss-w) 22px; }
.scr-ss .rt-open > .rt-inner { grid-template-rows:var(--ss-t) var(--ss-v) var(--ss-s) var(--ss-w) var(--ss-n) 22px auto; }
.scr-ss .rt-open.rt-hasip > .rt-inner { grid-template-rows:var(--ss-t) var(--ss-v) var(--ss-s) var(--ss-w) var(--ss-n) var(--ss-w) 22px auto; }
/* The title's first-line floats are as wide as the info button and it sits 6 px from the top, so a wrapped second
   line never runs under it (docket A13). */
.scr-ss .ssrec.rt-card .ssfl, .scr-ss .ssrec.rt-card .ssfr { width:22px; }
.scr-ss .ssrec.rt-card > .rt-inner > .tinfo { top:6px; }
.scr-ss .rt-card > .rt-inner > [class*="ssarea-"], .scr-ss .rt-card > .rt-inner > .rt-area-m, .scr-ss .rt-card > .rt-inner > .rt-area-ip {
  display:flex; align-items:center; justify-content:center; min-width:0; width:100%; }
.scr-ss .rt-card .ssarea-e { grid-row:2 / 5; }
.scr-ss .rowgrid > .tile.rt-open { flex:0 0 100%; max-width:100%; border-color:var(--accent-deep); }
.scr-ss .rt-open .tnote { left:auto; width:min(320px,calc(100% - 18px)); }
.rt-more { display:inline-flex; align-items:center; gap:7px; font:inherit; font-size:9.5px; font-weight:900; letter-spacing:.14em;
  text-transform:uppercase; color:var(--ink-3); background:none; border:0; border-top:1px solid var(--line); padding:5px 10px 0;
  cursor:pointer; width:100%; justify-content:center; }
.rt-more:hover, .rt-more[aria-expanded="true"] { color:var(--accent); }
.rt-more:focus-visible { outline:2px solid var(--sky); outline-offset:2px; }
.rt-chev { width:6px; height:6px; border-right:2px solid currentColor; border-bottom:2px solid currentColor; transform:rotate(45deg) translate(-1px,-1px); }
.rt-more[aria-expanded="true"] .rt-chev { transform:rotate(225deg) translate(-1px,-1px); }
.rt-inplay { display:inline-block; max-width:100%; overflow:hidden; white-space:nowrap; font-size:9.5px; font-weight:900;
  letter-spacing:.08em; text-transform:uppercase; color:var(--sky); border:1px dashed currentColor; padding:1px 6px; }
.rt-drawer { overflow:hidden; text-align:left; }
.rt-drawin { padding-top:8px; display:flex; justify-content:center; }
.rt-toptbl { width:100%; max-width:760px; border-collapse:separate; border-spacing:0; font-variant-numeric:tabular-nums; font-size:12.5px; }
.rt-toptbl td { text-align:center; padding:7px 6px; border-bottom:1px solid var(--line); vertical-align:middle; }
.rt-toptbl tr:last-child > td { border-bottom:0; }
.rt-toptbl td.col-team { text-align:left; }
.rt-toptbl tr.rt-lead > td { background:color-mix(in srgb,var(--accent) 9%,transparent); }
.ssbad .rt-toptbl tr.rt-lead > td { background:color-mix(in srgb,var(--flag) 9%,transparent); }
.rt-rank { width:34px; color:var(--ink-2); font-weight:900; }
.rt-val { font-weight:900; white-space:nowrap; width:1%; padding-left:14px !important; padding-right:14px !important; }
.rt-when { color:var(--ink-2); font-size:var(--fs-small); width:1%; min-width:6.5em; }
/* A streak's games, under its row: every cell may wrap but the score, so the table never runs past its panel. */
.rt-gtbl td.rt-dp { white-space:normal; width:auto; min-width:5.5em; } .rt-gtbl td.rt-dv { white-space:nowrap; }
@media (max-width:520px) { .rt-toptbl td { padding:6px 3px; } .rt-toptbl td.rt-when { padding-right:8px; } .rt-gtbl td { padding:4px 3px; font-size:11px; } }
.rt-who { display:flex; flex-wrap:wrap; justify-content:flex-start; align-items:center; gap:4px 8px; }
.rt-team { display:inline-flex; align-items:center; gap:6px; font-weight:800; }
.rt-team img, .rt-nologo { width:20px; height:20px; flex:none; border-radius:3px; }
.rt-nologo { display:inline-block; background:var(--line-2); }
.rt-nm { background:linear-gradient(94deg,var(--ink) 30%,var(--accent) 165%); -webkit-background-clip:text; background-clip:text;
  color:transparent; -webkit-text-fill-color:transparent; }
.rt-vs { font-size:var(--fs-micro); color:var(--ink-2); text-transform:uppercase; letter-spacing:.12em; }
.rt-then { font-weight:600; color:var(--ink-2); font-size:var(--fs-micro); margin-left:2px; }
.rt-pl { font-weight:800; margin-right:2px; }
.rt-popwrap { position:relative; display:inline-block; }
.rt-vbtn { font:inherit; font-weight:900; color:inherit; background:none; border:0; padding:0; cursor:pointer;
  text-decoration:underline dotted color-mix(in srgb,var(--accent) 70%,transparent); text-underline-offset:3px; }
.rt-vbtn:hover, .rt-vbtn.on { color:var(--accent); }
.rt-pop { position:absolute; z-index:6; right:0; top:calc(100% + 6px); min-width:200px; max-width:min(340px,86vw); background:var(--panel);
  border:1px solid var(--accent); padding:8px 10px; box-shadow:0 8px 22px rgba(0,0,0,.34); text-align:left; white-space:normal; font-weight:400; }
.rt-poprow { display:flex; justify-content:space-between; gap:12px; align-items:center; font-size:11.5px; line-height:1.4; padding:2px 0; }
.rt-popk { color:var(--ink-3); white-space:nowrap; font-size:10px; font-weight:900; letter-spacing:.1em; text-transform:uppercase; }
.rt-popv { font-weight:800; text-align:right; }
.rt-popv .rt-team img { width:16px; height:16px; }
.rt-sel > td { background:color-mix(in srgb,var(--sky) 8%,transparent); }
.rt-drow > td { padding:4px 6px 12px !important; background:var(--inset); }
.rt-detail { display:flex; flex-wrap:wrap; gap:10px 22px; justify-content:center; text-align:left; padding-top:6px; }
.rt-dgrp { flex:1 1 230px; max-width:360px; }
.rt-dgh { display:flex; justify-content:space-between; font-size:10px; font-weight:900; letter-spacing:.12em; text-transform:uppercase;
  color:var(--ink-3); border-bottom:1px solid var(--line); padding-bottom:4px; margin-bottom:4px; }
.rt-dgrp.good .rt-dgh b { color:var(--accent); } .rt-dgrp.bad .rt-dgh b { color:var(--flag); }
.rt-dgrp ul { list-style:none; margin:0; padding:0; }
.rt-dgrp li { display:flex; flex-wrap:wrap; gap:2px 8px; align-items:baseline; font-size:11.5px; padding:3px 0; border-bottom:1px dashed var(--line); }
.rt-dt { flex:1 1 auto; font-weight:700; color:var(--ink); }
.rt-dt em { font-style:normal; color:var(--flag); font-weight:800; font-size:10.5px; }
.rt-dv { font-weight:900; font-variant-numeric:tabular-nums; white-space:nowrap; }
.rt-dw { display:block; color:var(--ink-3); font-size:10px; font-weight:700; }
.rt-dnone { color:var(--ink-2); margin:6px 0; }
.rt-dtbl { width:100%; max-width:640px; border-collapse:collapse; font-size:11.5px; }
.rt-dtbl td { padding:4px 6px; border-bottom:1px dashed var(--line); text-align:center; }
.rt-dtbl td.rt-dt { text-align:center; }
.rt-dp { color:var(--ink-3); font-weight:900; width:1%; white-space:nowrap; }
.rt-dpts { font-weight:900; width:1%; white-space:nowrap; }
.rt-gtbl { max-width:560px; margin:0 auto; } .rt-gtbl td.col-team { text-align:left; }
.rt-gres { font-weight:900; width:1%; white-space:nowrap; } .rt-gtbl tr.good .rt-gres { color:var(--accent); } .rt-gtbl tr.bad .rt-gres { color:var(--flag); }
.rt-dtbl tr.good .rt-dpts { color:var(--accent); } .rt-dtbl tr.bad .rt-dpts { color:var(--flag); }
/* Hall of Fame only: a panel glows gold when its record belongs to the season being played; a row in its table too. */
.scr-ss .tile.rt-glow { border-color:color-mix(in srgb,var(--gold) 75%,var(--line));
  box-shadow:0 0 0 1px color-mix(in srgb,var(--gold) 45%,transparent), 0 0 26px -6px color-mix(in srgb,var(--gold) 80%,transparent); }
.scr-ss .tile.rt-glow2 { border-color:color-mix(in srgb,var(--gold) 35%,var(--line)); box-shadow:0 0 16px -8px color-mix(in srgb,var(--gold) 70%,transparent); }
.rt-toptbl tr.rt-rglow > td { box-shadow:inset 0 1px 0 color-mix(in srgb,var(--gold) 75%,transparent), inset 0 -1px 0 color-mix(in srgb,var(--gold) 75%,transparent); background:color-mix(in srgb,var(--gold) 10%,transparent); }
.rt-toptbl tr.rt-rglow2 > td { box-shadow:inset 0 1px 0 color-mix(in srgb,var(--gold) 35%,transparent), inset 0 -1px 0 color-mix(in srgb,var(--gold) 35%,transparent); background:color-mix(in srgb,var(--gold) 5%,transparent); }
.rt-toptbl tr.rt-rglow > td:first-child { box-shadow:inset 1px 1px 0 color-mix(in srgb,var(--gold) 75%,transparent), inset 0 -1px 0 color-mix(in srgb,var(--gold) 75%,transparent); border-radius:6px 0 0 6px; }
.rt-toptbl tr.rt-rglow > td:last-child { box-shadow:inset -1px 1px 0 color-mix(in srgb,var(--gold) 75%,transparent), inset 0 -1px 0 color-mix(in srgb,var(--gold) 75%,transparent); border-radius:0 6px 6px 0; }
.rt-toptbl tr.rt-rglow2 > td:first-child { box-shadow:inset 1px 1px 0 color-mix(in srgb,var(--gold) 35%,transparent), inset 0 -1px 0 color-mix(in srgb,var(--gold) 35%,transparent); border-radius:6px 0 0 6px; }
.rt-toptbl tr.rt-rglow2 > td:last-child { box-shadow:inset -1px 1px 0 color-mix(in srgb,var(--gold) 35%,transparent), inset 0 -1px 0 color-mix(in srgb,var(--gold) 35%,transparent); border-radius:0 6px 6px 0; }
.rt-toptbl tr.rt-rglow { filter:drop-shadow(0 0 6px color-mix(in srgb,var(--gold) 55%,transparent)); }
.rt-toptbl tr.rt-rglow2 { filter:drop-shadow(0 0 4px color-mix(in srgb,var(--gold) 25%,transparent)); }
@media (max-width:520px) { .rt-toptbl { font-size:11.5px; } .rt-toptbl td { padding:6px 3px; } .rt-val { padding-left:6px !important; padding-right:6px !important; }
  .rt-when { font-size:10.5px; } .rt-team img, .rt-nologo { width:16px; height:16px; } }
`;
