import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { PALETTES, BASE_CSS, BACKDROP, dateText } from "../../src/ui.js";
import { STANDINGS_CSS } from "../../src/standingstable.js";
import ToolControls from "../shared/ToolControls.jsx";
import { noteBrake, pollDelay } from "../shared/brake.js";
import { SecHead, Placeholder, UI_FONT, HOF_CSS } from "../hall-of-fame/HallOfFame.jsx";
import { SS_CSS } from "./css.js";
import { RecordGrid, RECORD_CSS } from "../shared/RecordPanel.jsx";
import { liveOverlay } from "../../src/seasonlive.js";

/**
 * Season Statistics: this season's standings and records, for any stretch of it (plan D1-D74).
 *
 * Every figure is built on the backend (src/seasonstep.js runs src/seasonstats.js once a week settles, or a stat
 * correction arrives) and stored per period; the page asks for one period at a time from /apps/season-stats/api
 * and keeps what it has been given. The standings are the home page's table (src/standingstable.js, loaded by the
 * tool's shell), and every record panel is Hall of Fame's anatomy, with its components and rules.
 *
 * While games are on, the records marked Live in the build may change mid-game: the page asks once a minute and the
 * answer carries them laid over the settled ones (D33); the standings never move until a matchup ends.
 */

const THEME_COOKIE = "eft_theme";
const readCookie = (name) => {
  try { const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`)); return m ? decodeURIComponent(m[1]) : null; } catch { return null; }
};
const IDLE_LIMIT_MS = 4 * 60 * 60 * 1000;

const HELP_STEPS = [
  [1, "Choose a period", "The rail under the title sets what every section counts: the whole season, the regular season, the postseason once it starts, or the season as it stood after any week played. Tap a week on the rail to go back to it."],
  [2, "Standings", "The league table, the same one the home page can show, with all-play, luck and the power ranking beside the usual columns. Tap a column's heading to sort by it, and the small i beneath it for what it means."],
  [3, "Read a record", "Each panel is one record: its value, and the team or player holding it below. A tie lists everyone sharing it. The i in a panel's corner says how the record is counted and who is next. Show top N at a panel's foot opens it across the page with the whole top ten; it stays open until you close it with the same bar."],
  [4, "See every record", "Each section shows its headline records first. The bar beneath them opens the rest of the section."],
  [5, "Scoring", "The highest and lowest weeks, the season's shootout and slog, and the most points from each position."],
  [6, "Lineups and projections", "Bench points, best possible lineups, and how teams did against ESPN's projections."],
  [7, "Games and players", "Blowouts, close games, comebacks and streaks; the season's best players and best moves, free agents included."],
  [8, "Moves and fun", "Who has been busiest, whose draft is paying off, the most lopsided trade, and the frauds and heartbreaks. The best start in league history sits with the standings."],
  [9, "Record Holders", "The last section counts the page itself: a point for every good record a team holds, a point off for every bad one."],
  [10, "While games are on", "Records marked Live can change during the games; everything else, and the standings, moves only when a matchup ends."],
];

/* Every record panel is the shared one (app/shared/RecordPanel.jsx), with Hall of Fame. */

/* ------------------------------------------------------------------ the standings: the one shared table */
function Standings({ data }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && window.EFTStandings) window.EFTStandings.render(ref.current, data);
  }, [data]);
  return <div className="panel ssstandpanel"><div id="standings" ref={ref} /></div>;
}

/* ------------------------------------------------------------------ the period rail */
function railRange(cal, key) {
  const p = cal.played, last = p.length ? p[p.length - 1] : 0, reg = cal.regWeeks;
  if (key === "whole") return [1, last];
  if (key === "regular") return [1, Math.min(last, reg)];
  if (key === "post") return [reg + 1, last];
  return [1, Number(key.slice(1))];
}
function railMeta(cal, key) {
  const p = cal.played, last = p.length ? p[p.length - 1] : 0, reg = cal.regWeeks, rounds = cal.totalWeeks - reg;
  const postText = (k) => (k >= rounds ? "the final" : `postseason round ${k}`);
  const regPart = (n) => (n === 1 ? "Week 1" : `Weeks 1–${n}`);
  const [, b] = railRange(cal, key);
  if (key === "whole") return last > reg ? `${regPart(reg)} and the postseason through ${postText(last - reg)}` : `${regPart(last)} · ${last} of ${reg} regular-season weeks played`;
  if (key === "regular") return last >= reg ? `${regPart(reg)}, complete` : `${regPart(last)} of ${reg}`;
  if (key === "post") return last - reg === 1 ? "Postseason round 1" : `Postseason rounds 1–${last - reg}`;
  return b > reg ? `The season as it stood after ${postText(b - reg)}` : `${regPart(b)} · the season as it stood after week ${b}`;
}
function PeriodRail({ cal, periods, value, onChange, live }) {
  const played = new Set(cal.played);
  const reg = cal.regWeeks, total = Math.max(cal.totalWeeks, reg + 1);
  const hasPost = periods.some((p) => p.key === "post");
  const [a, b] = railRange(cal, value);
  const weeks = Array.from({ length: total }, (_, i) => i + 1);
  const cur = periods.find((p) => p.key === value) || {};
  const ticksRef = useRef(null);
  const list = cal.played.filter((w) => periods.some((p) => p.key === `w${w}`));
  const has = new Set(list);
  const keyNav = (e) => {
    const sel = /^w\d+$/.test(value) ? Number(value.slice(1)) : null;
    let next = null;
    if (e.key === "ArrowRight") next = sel == null ? list[0] : list[Math.min(list.length - 1, list.indexOf(sel) + 1)];
    else if (e.key === "ArrowLeft") next = sel == null ? list[list.length - 1] : list[Math.max(0, list.indexOf(sel) - 1)];
    else if (e.key === "Home") next = list[0];
    else if (e.key === "End") next = list[list.length - 1];
    if (next == null) return;
    e.preventDefault();
    onChange(`w${next}`);
    requestAnimationFrame(() => { const el = ticksRef.current && ticksRef.current.querySelector(`[data-w="${next}"]`); if (el) el.focus({ preventScroll: true }); });
  };
  const selWeek = /^w\d+$/.test(value) ? Number(value.slice(1)) : null;
  const tabTarget = selWeek || list[list.length - 1];
  return (
    <div className="ssrail">
      <div className="ssrailhead">
        <span className="ssraileye">Showing</span>
        <span className="ssrailnow"><span className="gradv">{cur.label || "Whole season"}</span></span>
        <span className="ssrailmeta">{live && cur.live && <span className="sslivechip">Games on</span>}{railMeta(cal, value)}</span>
      </div>
      <div className="phasetabs ssphase" role="radiogroup" aria-label="Period">
        {[["whole", "Whole season"], ["regular", "Regular season"], ["post", "Postseason"]].map(([k, l]) => (
          <button key={k} type="button" role="radio" aria-checked={value === k} className={`phasetab${value === k ? " on" : ""}`}
            disabled={k === "post" && !hasPost} title={k === "post" && !hasPost ? `From week ${reg + 1}` : undefined} onClick={() => onChange(k)}>{l}</button>
        ))}
      </div>
      <div className="sstrackwrap">
        <span className="sstracklbl">After week</span>
        <div className="sstrack" ref={ticksRef} role="radiogroup" aria-label="The season as it stood after a week" onKeyDown={keyNav}
          style={{ gridTemplateColumns: `repeat(${reg}, minmax(0,1fr)) 16px repeat(${total - reg}, minmax(0,1fr))` }}>
          {weeks.map((w) => {
            const isPost = w > reg;
            const ok = played.has(w) && has.has(w);
            const inRange = played.has(w) && w >= a && w <= b;
            const cls = ["sstick", isPost ? "post" : "", ok ? "" : "future", inRange ? "in" : "", inRange && w === a ? "from" : "", inRange && w === b ? "to" : "",
              selWeek === w ? "end" : ""].filter(Boolean).join(" ");
            const node = (
              <button key={w} type="button" className={cls} data-w={w} disabled={!ok} role="radio" aria-checked={selWeek === w}
                tabIndex={w === tabTarget ? 0 : -1} aria-label={ok ? `After week ${w}` : played.has(w) ? `Week ${w}, being added` : `Week ${w}, not played yet`}
                onClick={() => onChange(`w${w}`)}>
                <i className="seg" aria-hidden="true" /><b className="dot" aria-hidden="true" /><span className="n">{isPost ? (w === total ? "F" : `P${w - reg}`) : w}</span>
              </button>
            );
            return w === reg + 1 ? [<span key="gap" className="ssgap" aria-hidden="true"><i /></span>, node] : node;
          })}
        </div>
        <div className="sstrackfoot" style={{ gridTemplateColumns: `${reg}fr 16px ${total - reg}fr` }} aria-hidden="true">
          <span>Regular season</span><span /><span className="post">Postseason</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ a section: its headline records, then the rest behind one bar */
function Section({ id, title, recs, live, T, children, fixed }) {
  const [open, setOpen] = useState(false);
  const head = fixed ? recs : recs.filter((r) => r.headline);
  const rest = fixed ? [] : recs.filter((r) => !r.headline);
  const TF = (id) => T[id] || { name: "Unknown team", logo: null };
  const grid = (list, cls = "") => <RecordGrid recs={list} T={TF} liveOn={live} cls={cls} />;
  return (
    <section className="sssec" id={`sec-${id}`}>
      <SecHead>{title}</SecHead>
      {children}
      {grid(head)}
      {rest.length > 0 && (
        <>
          {open && grid(rest, "ssrest")}
          <button type="button" className={`ssmore${open ? " open" : ""}`} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <span className="ssmoret">{open ? "Show the headline records" : `Every ${title.toLowerCase()} record`}</span>
            <span className="ssmoren">{open ? `${head.length} of ${recs.length}` : `+${rest.length}`}</span>
            <i className="ssmorechev" aria-hidden="true" />
          </button>
        </>
      )}
    </section>
  );
}

export default function SeasonStats() {
  const [theme, setTheme] = useState(() =>
    (typeof document !== "undefined" && document.documentElement.dataset.theme) || (readCookie(THEME_COOKIE) === "light" ? "light" : "dark"));
  const [leagueName, setLeagueName] = useState("");
  const [period, setPeriod] = useState("whole");
  const [store, setStore] = useState({ index: null, parts: {}, ready: null, settlesAt: null, live: null });
  const [error, setError] = useState("");
  const tags = useRef({});
  const want = useRef("whole");
  const lastActive = useRef(Date.now());

  useEffect(() => {
    fetch("/api/meta", { credentials: "same-origin" })
      .then((r) => r.json()).then((j) => { if (j && j.leagueName) setLeagueName(j.leagueName); })
      .catch(() => { /* the header simply stays blank */ });
  }, []);

  const load = useCallback(async (key) => {
    const res = await fetch(`/apps/season-stats/api?period=${encodeURIComponent(key)}&live=1`, {
      credentials: "same-origin", headers: tags.current[key] ? { "if-none-match": tags.current[key] } : {} });
    noteBrake(res);
    if (res.status === 304) return null;
    if (!res.ok) throw new Error(res.status === 403 ? "Season Statistics is switched off on this site." : "The figures could not be loaded. They will be asked for again shortly.");
    const tag = res.headers.get("etag");
    const j = await res.json();
    if (tag) tags.current[key] = tag;
    setStore((s) => {
      if (!j.ready) return { ...s, ready: false, index: j.index || null, settlesAt: j.settlesAt || null };
      const got = (j.part && j.part.period && j.part.period.key) || key;
      return { ...s, ready: true, index: j.index, parts: { ...s.parts, [got]: j.part }, live: j.live || null };
    });
    setError("");
    return j;
  }, []);

  // The period on show is asked for at once, then again once a minute while the page is open and in front; a
  // tab left alone for four hours stops asking until it is touched again.
  useEffect(() => {
    want.current = period;
    let timer = null, dead = false;
    const tick = async () => {
      if (dead) return;
      if (!document.hidden && Date.now() - lastActive.current < IDLE_LIMIT_MS) {
        try { await load(want.current); } catch (e) { setError(String(e.message || e)); }
      }
      if (!dead) timer = setTimeout(tick, pollDelay(60000, { live: Boolean(store.live) }));
    };
    tick();
    const wake = () => { const idle = Date.now() - lastActive.current >= IDLE_LIMIT_MS; lastActive.current = Date.now(); if (idle) { clearTimeout(timer); tick(); } };
    const evs = ["pointerdown", "keydown", "scroll", "touchstart"];
    for (const ev of evs) window.addEventListener(ev, wake, { passive: true });
    const vis = () => { if (!document.hidden) { clearTimeout(timer); tick(); } };
    document.addEventListener("visibilitychange", vis);
    return () => { dead = true; clearTimeout(timer); for (const ev of evs) window.removeEventListener(ev, wake); document.removeEventListener("visibilitychange", vis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, load]);

  const index = store.index;
  const T = (index && index.teams) || {};
  const periods = (index && index.periods) || [];
  const cal = (index && index.calendar) || { regWeeks: 13, totalWeeks: 15, played: [], playoffTeams: 4 };
  const part = store.parts[period] || null;
  const live = Boolean(store.live && store.live.on);
  const view = useMemo(() => {
    if (!part) return null;
    if (!live || !part.period || !part.period.live) return part;
    // The live overlay: the seven records a game in progress can already beat, patched with this week so far (D29, D33).
    const over = liveOverlay(part, store.live);
    return Object.keys(over).length ? { ...part, records: part.records.map((r) => over[r.id] || r) } : part;
  }, [part, live, store.live]);
  const bySec = useMemo(() => {
    const m = {};
    for (const r of (view && view.records) || []) (m[r.sec] = m[r.sec] || []).push(r);
    return m;
  }, [view]);
  const standData = useMemo(() => (view ? {
    rows: view.standings, teams: T, places: cal.playoffTeams,
    sim: (view.standings || []).some((r) => r.simPct != null),
  } : null), [view, T, cal.playoffTeams]);
  const choose = (k) => { if (periods.some((p) => p.key === k)) setPeriod(k); };

  return (
    <div style={{ minHeight: "100svh", fontFamily: UI_FONT }}>
      <div dangerouslySetInnerHTML={{ __html: BACKDROP }} />
      <style>{`
        ${PALETTES}
        ${BASE_CSS}
${HOF_CSS}
${STANDINGS_CSS}
${SS_CSS}
${RECORD_CSS}
      `}</style>
      <div className="wrap scr-ss">
        <div className="toolhead">
          <a className="toolmark homelink" href="/" aria-label="Back to home">
            <svg className="mark" viewBox="0 0 1000 150" role="img" aria-label="ESPN Fantasy Tools">
              <text className="fit" x="500" y="74" textAnchor="middle" textLength="980" lengthAdjust="spacingAndGlyphs" fontSize="86" fontWeight="900" letterSpacing="-2" fontFamily={UI_FONT}>
                <tspan className="m1">ESPN</tspan><tspan className="m2"> FANTASY TOOLS</tspan>
              </text>
              <path className="rule" d="M10 100 H990" /><path className="rulelive" d="M10 100 H360" />
              <text x="500" y="137" textAnchor="middle" fontSize="30" fontWeight="700" letterSpacing="14" fill="var(--ink-3)" fontFamily={UI_FONT}>LEAGUE HQ</text>
            </svg>
          </a>
          <div className="toolid"><p className="eyebrow">Season Statistics</p><div className="toolleague">{leagueName}</div></div>
          <div className="toolctl"><ToolControls steps={HELP_STEPS} label="How to use Season Statistics" theme={theme} onTheme={setTheme} /></div>
        </div>

        {error && <div className="msg err" style={{ display: "block" }}>{error}</div>}

        {store.ready === null ? (
          <><SecHead>Standings</SecHead><Placeholder title="Loading the season" note="Reading every week this season has played." /></>
        ) : store.ready === false ? (
          <>
            <SecHead>Standings</SecHead>
            <Placeholder title={index ? "The figures are being built" : "The season hasn't started"}
              note={index ? "Every week played is being read; this page fills in as soon as it is done."
                : store.settlesAt ? `The standings and every record appear when week 1 settles, on ${dateText(store.settlesAt)}.`
                : "The standings and every record appear when week 1 settles."} />
          </>
        ) : (
          <>
            <PeriodRail cal={cal} periods={periods} value={period} onChange={choose} live={live} />
            {!view ? (
              <><SecHead>Standings</SecHead><Placeholder title="Loading this period" note="Reading the season as it stood." /></>
            ) : (index.sections || []).map(([key, title]) => (
              <Section key={key + period} id={key} title={title} recs={bySec[key] || []} live={live} T={T} fixed={key === "holders"}>
                {key === "standings" && <Standings data={standData} />}
              </Section>
            ))}
          </>
        )}

        <div className="grow" />
        <div className="pageaction"><a className="pagebtn" href="/">&larr; Back to home</a></div>
        <div className="toolfoot">
          <a className="gh" href="https://github.com/shortcutsbin-netizen" target="_blank" rel="noopener noreferrer">GitHub - shortcutsbin-netizen</a>
        </div>
      </div>
    </div>
  );
}
