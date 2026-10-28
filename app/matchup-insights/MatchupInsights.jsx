import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { PALETTES, BASE_CSS, BACKDROP, pts2, dateText, dateTimeText } from "../../src/ui.js";
import { MATCHUP_CARD_CSS } from "../../src/matchupcard.js";
import { CATS as CAT_LIST, WEIGHT_MAX, headlineOf, phaseOf, afterName } from "../../src/insights.js";
import ToolControls from "../shared/ToolControls.jsx";
import TeamLogo from "../shared/TeamLogo.jsx";
import { noteBrake, pollDelay } from "../shared/brake.js";
import { SecHead, Placeholder, UI_FONT, HOF_CSS } from "../hall-of-fame/HallOfFame.jsx";
import { MI_CSS } from "./css.js";

/**
 * Matchup Insights: what makes every game interesting, before, during and after it (plan D1-D58).
 *
 * Every row is built on the backend (src/insightstep.js runs src/insights.js over stored copies) and stored per week;
 * the page asks for one week at a time from /apps/matchup-insights/api and, while it shows this week, again once a
 * minute (the answer carries the Live rows while games are on). Every game is drawn as the home page's matchup card
 * (its stylesheet is src/matchupcard.js); the team is the one chosen on the home page (D58), never picked here.
 */

const THEME_COOKIE = "eft_theme";
const TEAM_COOKIE = "eft_team";
const readCookie = (name) => {
  try { const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`)); return m ? decodeURIComponent(m[1]) : null; } catch { return null; }
};
const IDLE_LIMIT_MS = 4 * 60 * 60 * 1000;
const CATS = Object.entries(CAT_LIST).sort((a, b) => a[1].order - b[1].order);
const TOP = 5;
const WMAX = WEIGHT_MAX;
const WHEN = { pre: "Before kickoff", live: "Live", post: "After the final" };
const ABOUT = { team: "Team", player: "Player", matchup: "Matchup", league: "League" };

const HELP_STEPS = [
  [1, "Choose a week", "The arrows at the top step through the season. The page opens on this week; every week played stays, with what was said before kickoff and how it turned out."],
  [2, "Now, or any time", "Each game opens on what fits where it stands: before kickoff, what to watch for; while it is on, what is happening; once it is over, what it came to. Any time shows everything said about it, and Before, Live and After one phase each."],
  [3, "Narrow it down", "Search any word, tap categories on the colour bar, or show only rows about your team. Everything applies to every game at once. On a phone the categories and phases sit behind Filters."],
  [4, "Across the league", "Facts about the whole week sit above the games: the closest projected week, who can clinch, the week's big game, and once games are over, every record that fell."],
  [5, "The games", "Each game is a matchup card like the home page's: the countdown to kickoff, then the score and win chance, then the result and each team's record with it counted, with its top insight beneath. Your team's game comes first."],
  [6, "Open a game", "The bar under a card opens its insights. The coloured chip is the category; the diamonds say how much it matters, ten the most: an all-time record from Hall of Fame or the title itself. The logos are every team it names, playing or not."],
  [7, "Show all", "A game shows its five weightiest rows first. The bar beneath them shows the rest."],
  [8, "Before, during and after", "Rows written before kickoff are kept as they stood at each team's first kickoff, so a past week shows what was said. Live rows appear while the games are on; once a game ends, what happened takes over, counted at once rather than when ESPN settles the week."],
  [9, "Predictions", "A row that predicts something is judged once the game is final: Held or Broke."],
  [10, "Your team", "Your team is the one chosen on the home page. Rows that name it carry a small You mark in every game, even games your team is not playing."],
  [11, "Weeks before Matchup Insights", "Weeks that ended before the site had Matchup Insights show only what can be worked out honestly from the results and what ESPN kept: no lineups or injury news from before kickoff."],
];

/* ------------------------------------------------------------------ one row's sentence */
const prevName = (parts, i, T) => (i && parts[i - 1] && parts[i - 1].t != null && T[parts[i - 1].t] ? T[parts[i - 1].t].name : "");
function Sentence({ parts, T }) {
  return parts.map((p, i) => {
    if (typeof p === "string") return <React.Fragment key={i}>{afterName(prevName(parts, i, T), p)}</React.Fragment>;
    if (p.t != null) return <b key={i} className="mitn">{T[p.t] ? T[p.t].name : "a team"}</b>;
    if (p.v != null) return <b key={i} className="miv">{p.v}</b>;
    if (p.p != null) return <span key={i} className="mip">{p.p}</span>;
    if (p.d != null) return <b key={i} className="miv">{dateText(p.d)}</b>;
    return null;
  });
}
const textOf = (parts, T) => parts.map((p, i) => (typeof p === "string" ? afterName(prevName(parts, i, T), p) : p.t != null ? (T[p.t] || {}).name || "" : p.v ?? p.p ?? (p.d ? dateText(p.d) : ""))).join("");
const Weight = ({ w }) => (
  <span className="miweight" role="img" aria-label={`Weight ${w} of ${WMAX}`}>{Array.from({ length: WMAX }, (_, k) => <i key={k} className={k < w ? "on" : ""} />)}</span>
);
const Chip = ({ cat, label }) => <span className="milabelchip">{label || CAT_LIST[cat].label}</span>;

/* ------------------------------------------------------------------ the table */
const COLS = [
  { key: "cat", label: "Category", cls: "micat" },
  { key: "text", label: "Insight", cls: "misent" },
  { key: "teams", label: "Teams", cls: "col-team" },
  { key: "about", label: "About", cls: "miabout" },
  { key: "weight", label: "Weight", cls: "miwt" },
  { key: "when", label: "When", cls: "miwhen" },
  { key: "outcome", label: "Outcome", cls: "mioc" },
];
const OUT_ORDER = { held: 0, broke: 1, pending: 2 };
const sortVal = (r, key, T) => {
  switch (key) {
    case "cat": return CAT_LIST[r.cat].order;
    case "text": return textOf(r.parts, T).toLowerCase();
    case "teams": return r.teams.length ? ((T[r.teams[0]] || {}).name || "").toLowerCase() : "~";
    case "about": return r.about;
    case "when": return ["pre", "live", "post"].indexOf(r.when);
    case "outcome": return r.outcome ? OUT_ORDER[r.outcome] : 9;
    default: return 0;
  }
};
function byDefault(a, b) { return b.weight - a.weight || CAT_LIST[a.cat].order - CAT_LIST[b.cat].order || Number(a.type.slice(1)) - Number(b.type.slice(1)); }
function sortRows(rows, sort, T) {
  if (!sort || sort.key === "weight") return [...rows].sort((a, b) => (sort && sort.dir === -1 ? -1 : 1) * byDefault(a, b));
  return [...rows].sort((a, b) => { const x = sortVal(a, sort.key, T), y = sortVal(b, sort.key, T); return (x < y ? -1 : x > y ? 1 : byDefault(a, b)) * sort.dir; });
}
function Table({ rows, mine, showOutcome, sort, setSort, T }) {
  const cols = COLS.filter((c) => c.key !== "outcome" || showOutcome);
  return (
    <table className="mitable">
      <thead>
        <tr>
          {cols.map((c) => {
            const on = sort.key === c.key;
            return (
              <th key={c.key} scope="col" aria-sort={on ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
                onClick={() => setSort((s) => (s.key === c.key ? { key: c.key, dir: -s.dir } : { key: c.key, dir: 1 }))}>
                <span className="lbl">{c.label}</span><span className="arrow" aria-hidden="true">{on && sort.dir === -1 ? "▲" : "▼"}</span>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const you = mine != null && r.teams.includes(mine);
          return (
            <tr key={`${r.type}-${i}`} className={`cat-${r.cat}${you ? " mine" : ""}`}>
              <td className="micat"><Chip cat={r.cat} /><span className="miname">{r.label}</span></td>
              <td className="misent"><Sentence parts={r.parts} T={T} />{you && <span className="miyou">You</span>}</td>
              <td className="col-team"><span className="milogos">{r.teams.filter((id) => T[id]).map((id) => <TeamLogo key={id} src={T[id].logo} className="tklogo" alt={T[id].name} />)}</span></td>
              <td className="miabout"><span className="mimeta">{ABOUT[r.about]}</span></td>
              <td className="miwt"><Weight w={r.weight} /></td>
              <td className="miwhen"><span className="mimeta">{WHEN[r.when]}</span></td>
              {showOutcome && <td className="mioc">{r.outcome ? <span className={`miout ${r.outcome}`}>{r.outcome === "held" ? "Held" : r.outcome === "broke" ? "Broke" : "Pending"}</span> : <span className="mimeta" aria-label="Not a prediction">—</span>}</td>}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ------------------------------------------------------------------ the matchup card (the home page's, home team left) */
const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th"}`;
const ROUND_TAG = { quarter: "Playoff Quarterfinal", semi: "Playoff Semifinal", championship: "Championship", third: "Third Place Game", consolation: "Consolation" };
const two = (n) => (n < 10 ? `0${n}` : String(n));
function Countdown({ at }) {
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(id); }, []);
  const ms = Date.parse(at) - Date.now();
  if (!(ms > 0)) return <div className="countdown">Kickoff</div>;
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return <div className="countdown">{d ? <>{d}<em>d</em> </> : null}{two(h)}<em>:</em>{two(m)}<em>:</em>{two(s % 60)}</div>;
}
function Gauge({ p }) {
  const mine = Math.max(0, Math.min(100, p)), theirs = 100 - mine, R = 42, C = 2 * Math.PI * R, lead = mine >= theirs;
  return (
    <div className="wgauge" role="img" aria-label={`${mine.toFixed(0)} percent to win`}>
      <svg viewBox="0 0 100 100">
        <circle className="wgtrack" cx="50" cy="50" r={R} />
        <circle className="wgtheirs" cx="50" cy="50" r={R} strokeDasharray={C} strokeDashoffset={C * (1 - theirs / 100)} transform={`rotate(${-90 + 360 * (mine / 100)} 50 50)`} />
        <circle className="wgmine" cx="50" cy="50" r={R} strokeDasharray={C} strokeDashoffset={C * (1 - mine / 100)} transform="rotate(-90 50 50)" />
      </svg>
      <span className={`wgmid ${lead ? "smine" : "stheirs"}`}>{(lead ? mine : theirs).toFixed(0)}<i>%</i></span>
    </div>
  );
}
function Stats({ s }) {
  if (!s) return null;
  return <div className="cardstats"><span className="stat"><b>{s.w}-{s.l}-{s.t || 0}</b><span>Record</span></span><span className="stat"><b>{s.seed}</b><span>Rank</span></span><span className="stat"><b>{pts2(s.pf)}</b><span>PF</span></span></div>;
}
function CardBody({ g, wk, rec, T }) {
  const left = g.home, right = g.away;
  const done = g.state === "final";
  const diff = (g.hp || 0) - (g.ap || 0), tied = Math.abs(diff) < 0.005;
  let mid;
  if (g.state === "pre") {
    mid = g.firstKickoff ? <><Countdown at={g.firstKickoff} /><div className="vslabel">Until kickoff</div></>
      : <><div className="vslabel">{g.periods && g.periods.length > 1 ? `Weeks ${g.periods[0]}–${g.periods[g.periods.length - 1]}` : `Week ${wk.week}`}</div><div className="cdnote">Before kickoff</div></>;
  } else {
    mid = (
      <div className={`vsgrid${done ? " isdone" : ""}`}>
        <div className={`vslabel${done ? " isfinal" : ""}`}>{done ? "Final" : "Live"}</div>
        <div className={`vsscore mine${done && diff > 0 ? " won" : ""}`}><b className="smine">{pts2(g.hp)}</b>{!done && g.hproj != null && <span className="sproj">{pts2(g.hproj)}</span>}</div>
        {done ? <div className={`vsmargin ${tied ? "tied" : "won"}`}>{tied ? "Tied" : `By ${pts2(Math.abs(diff))}`}</div> : g.hwp != null ? <Gauge p={g.hwp} /> : <div />}
        <div className={`vsscore theirs${done && diff < 0 ? " won" : ""}`}><b className="stheirs">{pts2(g.ap)}</b>{!done && g.aproj != null && <span className="sproj">{pts2(g.aproj)}</span>}</div>
      </div>
    );
  }
  const side = (id) => (
    <span className="vsid"><span className="vsname">{(T[id] || {}).name || "A team"}</span>{T[id] && T[id].owner ? <span className="vsowner">{T[id].owner}</span> : null}<Stats s={rec[id]} /></span>
  );
  return (
    <div className="vsrow">
      <span className="vsme"><TeamLogo src={(T[left] || {}).logo} className="cardlogo" alt={(T[left] || {}).name || ""} />{side(left)}</span>
      <span className="vsmid">{mid}</span>
      <span className="vsopp">{side(right)}<TeamLogo src={(T[right] || {}).logo} className="cardlogo" alt={(T[right] || {}).name || ""} /></span>
    </div>
  );
}

/* ------------------------------------------------------------------ a game */
function Game({ g, wk, rec, rows, mine, sort, setSort, empty, startOpen, T }) {
  const [open, setOpen] = useState(startOpen);
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, TOP);
  // The headline follows where the game stands (D48, round 8): before kickoff, live, or what happened.
  const head = headlineOf(g.rows, g.state);
  const myGame = mine != null && (g.home === mine || g.away === mine);
  const tag = g.round ? (g.round === "consolation" && g.place ? `${ordinal(g.place)} place game` : ROUND_TAG[g.round]) : null;
  return (
    <section className={`panel migame${myGame ? " mymatch" : ""}${tag ? " hastag" : ""}`} data-state={g.state} aria-label={`${(T[g.home] || {}).name} against ${(T[g.away] || {}).name}`}>
      {(tag || myGame) && <div className="migtags">{tag && <span className="migtag round">{tag}</span>}{myGame && <span className="migtag">Your matchup</span>}</div>}
      <CardBody g={g} wk={wk} rec={rec} T={T} />
      {head && <div className={`mighl cat-${head.cat}`}><Chip cat={head.cat} label={head.label} /><p><Sentence parts={head.parts} T={T} /></p></div>}
      <button type="button" className="migopen" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span>{open ? "Hide the insights" : `${rows.length} insight${rows.length === 1 ? "" : "s"}${rows.length !== g.rows.length ? ` · ${g.rows.length} in all` : ""}`}</span><i className="migchev" aria-hidden="true" />
      </button>
      {open && (
        <div className="migbody">
          {rows.length ? (
            <>
              <Table rows={shown} mine={mine} showOutcome={g.state === "final"} sort={sort} setSort={setSort} T={T} />
              {rows.length > TOP && (
                <button type="button" className={`mimore${all ? " open" : ""}`} aria-expanded={all} onClick={() => setAll((v) => !v)}>
                  <span className="mimoret">{all ? `Show the top ${TOP}` : "Show all"}</span>
                  <span className="mimoren">{all ? `${TOP} of ${rows.length}` : `+${rows.length - TOP}`}</span>
                </button>
              )}
            </>
          ) : <Placeholder title="Nothing matches" note={empty} />}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ the control deck: week, colour bar, search, phase */
const SEARCH_SVG = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>;
// "Now" (round 8, the default): each game's rows for where it stands; "Any time" every row.
const PHASES = [["now", "Now"], ["all", "Any time"], ["pre", "Before"], ["live", "Live"], ["post", "After"]];
const NO_FILTER = () => ({ q: "", cats: new Set(), when: "now", mineOnly: false });
function Deck({ f, setF, total, shownCount, mine, sort, setSort, nav, wk }) {
  const [tray, setTray] = useState(false);
  const toggle = (k) => setF((x) => { const s = new Set(x.cats); if (s.has(k)) s.delete(k); else s.add(k); return { ...x, cats: s }; });
  const narrowed = f.cats.size + (f.when !== "now" ? 1 : 0);
  const any = f.q || narrowed || f.mineOnly;
  return (
    <div className={`panel mideck${tray ? " trayopen" : ""}`}>
      <div className="mideckhead">
        <div className="weeksel">
          <button className="weekbtn" type="button" aria-label="Previous week" disabled={!nav.prev} onClick={nav.prev || undefined}>&lsaquo;</button>
          <span className="weeklabel">{wk.label}</span>
          <button className="weekbtn" type="button" aria-label={nav.next ? "Next week" : "Already at the current week"} disabled={!nav.next} onClick={nav.next || undefined}>&rsaquo;</button>
        </div>
        <span className="weekstate"><i className={nav.live ? "" : "still"} />{nav.state}</span>
        <span className="micount"><b>{shownCount}</b> of <b>{total}</b> insights</span>
      </div>
      <div className="mispectrum" role="group" aria-label="Categories">
        {CATS.map(([k, c]) => (
          <button key={k} type="button" className={`mispec cat-${k}`} aria-pressed={f.cats.has(k)} onClick={() => toggle(k)}><i aria-hidden="true" /><span>{c.label}</span></button>
        ))}
      </div>
      <div className="midecktools">
        <label className="misearch">{SEARCH_SVG}<input type="text" placeholder="Search every insight" aria-label="Search every insight" value={f.q} onChange={(e) => setF((x) => ({ ...x, q: e.target.value }))} /></label>
        <div className="miphase" role="radiogroup" aria-label="When">
          {PHASES.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={f.when === k} className={f.when === k ? "on" : ""} onClick={() => setF((x) => ({ ...x, when: k }))}>{l}</button>)}
        </div>
        <div className="misort" role="radiogroup" aria-label="Sort">
          {[["weight", "Weight"], ["cat", "Category"], ["when", "Phase"]].map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={sort.key === k} className={sort.key === k ? "on" : ""} onClick={() => setSort({ key: k, dir: 1 })}>{l}</button>)}
        </div>
        <span className="mimine">My team only
          <button className="sw" role="switch" type="button" aria-checked={f.mineOnly ? "true" : "false"} aria-label="Only rows about my team"
            aria-disabled={mine == null ? "true" : undefined} title={mine == null ? "Choose your team on the home page first" : undefined}
            onClick={() => { if (mine != null) setF((x) => ({ ...x, mineOnly: !x.mineOnly })); }} />
        </span>
        <button type="button" className="mitraybtn" aria-expanded={tray} onClick={() => setTray((v) => !v)}>Filters{narrowed ? <b>{narrowed}</b> : null}</button>
        {any && <button type="button" className="miclear" onClick={() => setF(NO_FILTER())}>Clear</button>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ the week */
function emptyWhy(wk, f, ftOpensAfter, g) {
  if (f.cats.has("stakes") && f.cats.size === 1 && !wk.post && ftOpensAfter && wk.week <= ftOpensAfter) return `No Fortune Teller insights this week: its simulation opens after week ${ftOpensAfter}.`;
  if (f.when === "now" && g && g.state === "live" && !f.q && !f.cats.size && !f.mineOnly) return "Nothing to say about this game in play yet. Any time shows what was said before kickoff.";
  if (f.when === "live" && wk.kind !== "current") return "This game is over: live rows give way to what happened once a game ends.";
  if (f.when === "live") return "Live rows appear once this game's first player kicks off.";
  if (f.mineOnly) return "No insight in this game names your team.";
  return "No insight in this game matches the search and filters.";
}
/* Order (D49), as Live Matchups: the chosen team's game first, then the rest in the schedule's order. In the
   postseason the rest follow the bracket: the highest place the winner can still reach first. */
function orderGames(wk, mine) {
  const own = (g) => (mine != null && (g.home === mine || g.away === mine) ? 0 : 1);
  return [...wk.games].sort((a, b) => own(a) - own(b) || (wk.post ? (a.best || 99) - (b.best || 99) : 0) || a.id - b.id);
}
/* Across the league, "Now": before any kickoff the week's Pre rows; once games are under way what is live and what is
   over (records that fell among them); a played week what it came to. */
function leaguePhases(wk) {
  if (wk.kind === "past" || wk.games.every((g) => g.state === "final")) return new Set(["post"]);
  if (wk.games.some((g) => g.state !== "pre")) return new Set(["live", "post"]);
  return new Set(["pre"]);
}
function WeekView({ wk, mine, nav, T, rec, ftOpensAfter }) {
  const [f, setF] = useState(NO_FILTER);
  const [sort, setSort] = useState({ key: "weight", dir: 1 });
  const lp = leaguePhases(wk);
  // `g` is the row's game, or null for a row across the league.
  const pass = (r, g) => {
    if (f.cats.size && !f.cats.has(r.cat)) return false;
    if (f.when === "now" ? (g ? r.when !== phaseOf(g.state) : !lp.has(r.when)) : f.when !== "all" && r.when !== f.when) return false;
    if (f.mineOnly && mine != null && !r.teams.includes(mine)) return false;
    if (f.q && !`${textOf(r.parts, T)} ${r.label} ${CAT_LIST[r.cat].label}`.toLowerCase().includes(f.q.toLowerCase())) return false;
    return true;
  };
  const games = useMemo(() => orderGames(wk, mine), [wk, mine]);
  const total = wk.league.length + wk.games.reduce((x, g) => x + g.rows.length, 0);
  const shownCount = wk.league.filter((r) => pass(r, null)).length + wk.games.reduce((x, g) => x + g.rows.filter((r) => pass(r, g)).length, 0);
  const league = sortRows(wk.league.filter((r) => pass(r, null)), sort, T);
  // In the default view a league section with nothing for where the week stands is left out.
  const showLeague = wk.league.length > 0 && (league.length > 0 || f.when !== "now" || f.q || f.cats.size || f.mineOnly);
  const rebuilt = wk.kind === "past" && wk.games.length && wk.games.every((g) => !g.watched);
  return (
    <>
      <Deck f={f} setF={setF} total={total} shownCount={shownCount} mine={mine} sort={sort} setSort={setSort} nav={nav} wk={wk} />
      {rebuilt && (
        <div className="minote" role="status"><b>Worked out after the fact.</b> This week ended before the site had Matchup Insights, so it shows only what the results and ESPN's records can say honestly: no lineups or injury news from before kickoff.</div>
      )}
      {showLeague && (
        <>
          <SecHead>Across the league</SecHead>
          <div className="panel mileague">
            {league.length ? <Table rows={league} mine={mine} showOutcome={false} sort={sort} setSort={setSort} T={T} /> : <Placeholder title="Nothing matches" note="No week-level insight matches the search and filters." />}
          </div>
        </>
      )}
      <SecHead>{wk.post ? wk.label : `Week ${wk.week}'s games`}</SecHead>
      <div className="migames">
        {games.map((g, i) => <Game key={`${wk.week}-${g.id}`} g={g} wk={wk} rec={rec} rows={sortRows(g.rows.filter((r) => pass(r, g)), sort, T)} mine={mine} sort={sort} setSort={setSort} empty={emptyWhy(wk, f, ftOpensAfter, g)} startOpen={i === 0} T={T} />)}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ the page */
export default function MatchupInsights() {
  const [theme, setTheme] = useState(() =>
    (typeof document !== "undefined" && document.documentElement.dataset.theme) || (readCookie(THEME_COOKIE) === "light" ? "light" : "dark"));
  const [leagueName, setLeagueName] = useState("");
  const [week, setWeek] = useState(null);
  const [store, setStore] = useState({ ready: null, index: null, weeks: {}, settlesAt: null, ftOpensAfter: null });
  const [error, setError] = useState("");
  const [, setZone] = useState(0);
  const mine = useMemo(() => { const v = Number(readCookie(TEAM_COOKIE)); return Number.isFinite(v) && v > 0 ? v : null; }, []);
  const tags = useRef({});
  const want = useRef(null);
  const lastActive = useRef(Date.now());

  useEffect(() => {
    fetch("/api/meta", { credentials: "same-origin" })
      .then((r) => r.json()).then((j) => { if (j && j.leagueName) setLeagueName(j.leagueName); })
      .catch(() => { /* the header simply stays blank */ });
    const tz = () => setZone((x) => x + 1);
    window.addEventListener("tzchange", tz);
    return () => window.removeEventListener("tzchange", tz);
  }, []);

  const load = useCallback(async (w) => {
    const key = w == null ? "now" : String(w);
    const res = await fetch(`/apps/matchup-insights/api${w == null ? "" : `?week=${encodeURIComponent(w)}`}`, {
      credentials: "same-origin", headers: tags.current[key] ? { "if-none-match": tags.current[key] } : {} });
    noteBrake(res);
    if (res.status === 304) return null;
    if (!res.ok) throw new Error(res.status === 403 ? "Matchup Insights is switched off on this site." : "The insights could not be loaded. They will be asked for again shortly.");
    const tag = res.headers.get("etag");
    const j = await res.json();
    if (tag) tags.current[key] = tag;
    setStore((s) => {
      if (!j.ready) return { ...s, ready: false, index: j.index || null, settlesAt: j.settlesAt || null };
      const got = j.week && j.week.week;
      return { ...s, ready: true, index: j.index, ftOpensAfter: j.ftOpensAfter ?? s.ftOpensAfter, weeks: got ? { ...s.weeks, [got]: { doc: j.week, rec: j.records || {} } } : s.weeks };
    });
    if (w == null && j.week && j.week.week) setWeek((x) => (x == null ? j.week.week : x));
    setError("");
    return j;
  }, []);

  // The week on show is asked for at once; this week again once a minute while the page is open and in front (a
  // played week is asked for again only to catch a rebuild). A tab left alone for four hours stops asking.
  useEffect(() => {
    want.current = week;
    let timer = null, dead = false;
    const tick = async () => {
      if (dead) return;
      if (!document.hidden && Date.now() - lastActive.current < IDLE_LIMIT_MS) {
        try { await load(want.current); } catch (e) { setError(String(e.message || e)); }
      }
      const cur = store.index && store.index.current;
      if (!dead) timer = setTimeout(tick, pollDelay(want.current == null || want.current === cur ? 60000 : 600000, { live: true }));
    };
    tick();
    const wake = () => { const idle = Date.now() - lastActive.current >= IDLE_LIMIT_MS; lastActive.current = Date.now(); if (idle) { clearTimeout(timer); tick(); } };
    const evs = ["pointerdown", "keydown", "scroll", "touchstart"];
    for (const ev of evs) window.addEventListener(ev, wake, { passive: true });
    const vis = () => { if (!document.hidden) { clearTimeout(timer); tick(); } };
    document.addEventListener("visibilitychange", vis);
    return () => { dead = true; clearTimeout(timer); for (const ev of evs) window.removeEventListener(ev, wake); document.removeEventListener("visibilitychange", vis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week, load]);

  const index = store.index;
  const T = (index && index.teams) || {};
  const weeks = (index && index.weeks) || [];
  const entry = week != null ? store.weeks[week] : null;
  const wk = entry ? entry.doc : null;
  const i = weeks.findIndex((x) => x.week === week);
  const live = Boolean(wk && wk.kind === "current" && wk.playing);
  const state = !wk ? "" : wk.kind === "current"
    ? (live ? `Games on · as of ${dateTimeText(wk.asOf || wk.builtAt)}` : wk.games.every((g) => g.state === "final") ? "This week · every game final" : `This week · as of ${dateTimeText(wk.asOf || wk.builtAt)}`)
    : `${wk.label} · complete`;
  const nav = { prev: i > 0 ? () => setWeek(weeks[i - 1].week) : null, next: i >= 0 && i < weeks.length - 1 ? () => setWeek(weeks[i + 1].week) : null, state, live };

  return (
    <div style={{ minHeight: "100svh", fontFamily: UI_FONT }}>
      <div dangerouslySetInnerHTML={{ __html: BACKDROP }} />
      <style>{`
        ${PALETTES}
        ${BASE_CSS}
${HOF_CSS}
${MATCHUP_CARD_CSS}
${MI_CSS}
      `}</style>
      <div className="wrap scr-mi">
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
          <div className="toolid"><p className="eyebrow">Matchup Insights</p><div className="toolleague">{leagueName}</div></div>
          <div className="toolctl"><ToolControls steps={HELP_STEPS} label="How to use Matchup Insights" theme={theme} onTheme={setTheme} /></div>
        </div>

        {error && <div className="msg err" style={{ display: "block" }}>{error}</div>}

        {store.ready === null ? (
          <><SecHead>This week</SecHead><Placeholder title="Loading the insights" note="Reading this week's games." /></>
        ) : store.ready === false ? (
          <>
            <SecHead>This week</SecHead>
            <Placeholder title={index ? "The insights are being built" : "The season hasn't started"}
              note={index ? "Every game is being read; this page fills in as soon as it is done."
                : "Week 1's insights appear once ESPN posts the fixtures and the site has read them."} />
          </>
        ) : !wk ? (
          <><SecHead>{week != null ? `Week ${week}` : "This week"}</SecHead><Placeholder title="Loading this week" note="Reading the week's games." /></>
        ) : (
          <WeekView key={wk.week} wk={wk} mine={mine} nav={nav} T={T} rec={entry.rec} ftOpensAfter={store.ftOpensAfter} />
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
