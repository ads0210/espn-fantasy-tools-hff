import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { PALETTES, BASE_CSS, BACKDROP, pts2, ptsSigned, dateText } from "../../src/ui.js";
import { STANDINGS_CSS } from "../../src/standingstable.js";
import ToolControls from "../shared/ToolControls.jsx";
import { noteBrake, pollDelay } from "../shared/brake.js";
import { TeamStrip, SecHead, Placeholder, UI_FONT, HOF_CSS } from "../hall-of-fame/HallOfFame.jsx";
import { SS_CSS } from "./css.js";
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
const COUNTS = new Set(["n", "wks", "teams"]);
const pct1 = (x) => `${(Math.round(Number(x || 0) * 1000 + 1e-6) / 10).toFixed(1)}%`;
const readCookie = (name) => {
  try { const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`)); return m ? decodeURIComponent(m[1]) : null; } catch { return null; }
};
const IDLE_LIMIT_MS = 4 * 60 * 60 * 1000;

const HELP_STEPS = [
  [1, "Choose a period", "The rail under the title sets what every section counts: the whole season, the regular season, the postseason once it starts, or the season as it stood after any week played. Tap a week on the rail to go back to it."],
  [2, "Standings", "The league table, the same one the home page can show, with all-play, luck and the power ranking beside the usual columns. Tap a column's heading to sort by it, and the small i beneath it for what it means."],
  [3, "Read a record", "Each panel is one record: its value, and the team or player holding it below. A tie lists everyone sharing it. The i in a panel's corner says how the record is counted and who is next."],
  [4, "See every record", "Each section shows its headline records first. The bar beneath them opens the rest of the section."],
  [5, "Scoring", "The highest and lowest weeks, the season's shootout and slog, and the most points from each position."],
  [6, "Lineups and projections", "Bench points, best possible lineups, and how teams did against ESPN's projections."],
  [7, "Games and players", "Blowouts, close games, comebacks and streaks; the season's best players and best moves, free agents included."],
  [8, "Moves, history and fun", "Who has been busiest, whose draft is paying off, anything Hall of Fame has never seen, and the frauds and heartbreaks."],
  [9, "Record Holders", "The last section counts the page itself: a point for every good record a team holds, a point off for every bad one."],
  [10, "While games are on", "Records marked Live can change during the games; everything else, and the standings, moves only when a matchup ends."],
];

/* ------------------------------------------------------------------ formatting */
function fmt(rec, e) {
  const v = e.value;
  switch (rec.unit) {
    case "pts": return pts2(v);
    case "diff": return ptsSigned(v);
    case "diff1": return `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}`;
    case "pct": return pct1(v);
    case "wp": return `${Number(v).toFixed(0)}%`;
    case "rec": return e.text || String(v);
    case "power": return Number(v).toFixed(1);
    case "places": return rec.id === "S79" ? String(Math.abs(v)) : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v)}`;
    case "net": return `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v)}`;
    default: return String(v);
  }
}
const unitWord = (rec, e) => {
  if (rec.id.startsWith("S11.")) return e.value === 1 ? "game in a row" : "games in a row";
  if (rec.unit === "wks") return "weeks in a row";
  if (rec.unit === "teams") return e.value === 1 ? "team" : "teams";
  if (rec.id === "S79") return "places down at his position";
  if (rec.unit === "places") return rec.kind === "player" ? "places at his position" : Math.abs(e.value) === 1 ? "place" : "places";
  if (rec.unit === "diff1") return Math.abs(e.value) === 1 ? "win" : "wins";
  if (rec.unit === "n" && rec.id === "S113") return e.value === 1 ? "record" : "records";
  if (rec.id === "S110" && e.text) { const n = e.text.split("-").reduce((x, y) => Number(x) + Number(y), 0); return n === 1 ? "after week 1" : `after ${n} weeks`; }
  return "";
};
const weekLabel = (e) => (e.span ? `Weeks ${e.span[0]}–${e.span[1]}` : e.week ? `Week ${e.week}` : "");
function holders(rec) {
  if (!rec.entries.length) return [];
  const top = rec.entries[0].value;
  return rec.entries.filter((e) => e.value === top);
}
/* When tied holders set the record in different weeks, each holder carries its own week and the shared week label
   above the strip is left out (a team can even tie itself, in two weeks). */
const weeksDiffer = (list) => new Set(list.map(weekLabel)).size > 1;
const emptyOf = (rec) => {
  if (rec.empty) return rec.empty;
  if (!rec.entries.length) return { title: "Not yet", note: "Nothing to show for this period yet." };
  if (COUNTS.has(rec.unit) && rec.entries[0].value === 0 && rec.better !== "low") return { title: "None yet", note: rec.info };
  return null;
};

/* ------------------------------------------------------------------ one record panel (Hall of Fame's anatomy) */
function RecordTile({ rec, live, T }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("click", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("click", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  const team = (id) => T[id] || { name: "Unknown team", logo: null };
  const chipTeam = (id) => ({ teamId: id, name: team(id).name, logo: team(id).logo });
  const empty = emptyOf(rec);
  const hs = empty ? [] : holders(rec);
  const first = hs[0];
  const text = first ? fmt(rec, first) : "—";
  const auto = text.length > 9 ? "small" : text.length > 6 ? "med" : "";
  const runner = !empty && rec.entries.find((e) => e.value !== (first && first.value));
  const match = rec.kind === "match" || rec.kind === "pair";
  // Who an entry names: a matchup's two teams (winner first), a player, or every team sharing it.
  const entryName = (e) => {
    if (!e) return "";
    if (e.player) return e.player.name;
    if (e.vs) return `${team(e.vs[0]).name} vs ${team(e.vs[1]).name}`;
    return (e.teams || []).map((id) => team(id).name).join(" & ");
  };
  const isLive = live && rec.live;
  const wk = first && !weeksDiffer(hs) ? weekLabel(first) : "";
  const unit = first ? unitWord(rec, first) : "";
  const net = rec.unit === "net" && first;
  const tally = net && hs.every((e) => e.good === first.good && e.bad === first.bad);
  // A matchup entry with a winner: the winner's chip outlined green, the other red (D63, and every neutral matchup
  // record too). A tie, or a pair with no side ahead (trade partners), has neither.
  const decided = (e) => Boolean(e.vs && e.teams && e.teams.length === 1 && e.teams[0] === e.vs[0]);
  const good = rec.tone > 0;
  const own = weeksDiffer(hs);
  let names = [];
  let vs = null;
  if (!empty) {
    if (rec.kind === "player") {
      names = hs.map((e, i) => ({ teamId: `${e.player.name}-${e.team}-${i}`, name: `${e.player.name} · ${e.player.pos}`,
        logo: e.team ? team(e.team).logo : null,
        owner: [e.against ? `against ${team(e.team).name}` : e.team ? team(e.team).name : "Free agent", own ? weekLabel(e) : ""].filter(Boolean).join(" · ") }));
    } else if (match) {
      vs = hs.map((e) => (decided(e)
        ? [{ ...chipTeam(e.vs[0]), cls: "sswin" }, { ...chipTeam(e.vs[1]), cls: "sslose" }]
        : [chipTeam(e.vs[0]), chipTeam(e.vs[1])]));
    } else {
      names = hs.flatMap((e) => e.teams.map((id) => ({ ...chipTeam(id), owner: own ? weekLabel(e) : undefined })));
    }
  }
  const sub = !empty && (unit || (net && !tally) || first.sub || tally);
  return (
    <div className={`tile ssrec${isLive ? " sslive" : ""}${rec.tone < 0 ? " ssbad" : ""}${rec.unit === "net" && rec.better === "low" ? " ssbad" : ""}`}>
      <button className="tinfo" type="button" aria-expanded={open ? "true" : "false"} aria-label={`About ${rec.title}`}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}>i</button>
      {open && (
        <div className="tnote" onClick={(e) => e.stopPropagation()}>
          {rec.info}
          {rec.since && <span className="ssnext"><b>Recorded</b> from week {rec.since}, when the site began recording games as they were played</span>}
          {match && hs.filter(decided).map((e, i) => (
            <span className="ssnext" key={`m${i}`}><b>{good ? "For" : "Won"}</b> {team(e.vs[0]).name} <b className="ssagainst">{good ? "Against" : "Lost"}</b> {team(e.vs[1]).name}</span>
          ))}
          {net && hs.map((e) => <span className="ssnext" key={e.teams[0]}><b>{team(e.teams[0]).name}</b> {e.good} good, {e.bad} bad</span>)}
          {runner && <span className="ssnext"><b>Next</b> {fmt(rec, runner)}{entryName(runner) ? ` · ${entryName(runner)}` : ""}</span>}
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
                {unit && <span className="ssunit">{unit}</span>}
                {net && !tally && <span className="ssunit">{hs.length} teams level</span>}
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
    </div>
  );
}

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
  const grid = (list, cls = "") => <div className={`rowgrid ${cls}`}>{list.map((r) => <RecordTile key={r.id} rec={r} live={live} T={T} />)}</div>;
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
