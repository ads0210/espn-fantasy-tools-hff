import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  ChevronDown, ChevronUp, Star, Ban, X, Sun, Moon, HelpCircle, ArrowLeft,
  Eye, AlertTriangle, Users, RotateCcw, Check, RefreshCw, Newspaper,
  ClipboardList, SlidersHorizontal, Trophy, LayoutGrid, Radio, Circle,
  Settings as SettingsIcon
} from "lucide-react";
import { PALETTES, BASE_CSS, BACKDROP } from "../../src/ui.js";
import SettingsMenu from "../shared/SettingsMenu.jsx";

// color tokens — dark and light themes
// Values mirror the shared design tokens exactly, so the tool sits inside the
// same visual language as the rest of the site rather than beside it.
const PALETTE = {
  dark: {
    bgApp: "#070A08", bgPanel: "#111713", bgPanelAlt: "#161D18", bgInset: "#0A0F0B",
    border: "#1F2A21", borderStrong: "#2C3B2E",
    textPrimary: "#E6F2E4", textSecondary: "#93A695", textFaint: "#5A6A5C",
    green: "#63FF4A", greenDeep: "#2BB81C", greenSoft: "rgba(99,255,74,0.16)",
    red: "#FF5C5C", redSoft: "rgba(255,92,92,0.13)",
    amber: "#FFB020", amberSoft: "rgba(255,176,32,0.13)",
    gold: "#FFD447", blue: "#5BA8FF",
  },
  light: {
    bgApp: "#EBF1E9", bgPanel: "#FFFFFF", bgPanelAlt: "#F4F8F3", bgInset: "#F3F8F2",
    border: "#D4E0D3", borderStrong: "#B4C6B3",
    textPrimary: "#0D140C", textSecondary: "#48564A", textFaint: "#75846F",
    green: "#12762E", greenDeep: "#0A5220", greenSoft: "rgba(18,118,46,0.13)",
    red: "#BF2231", redSoft: "rgba(191,34,49,0.08)",
    amber: "#8A5406", amberSoft: "rgba(138,84,6,0.10)",
    gold: "#A9790A", blue: "#20629E",
  },
};

// The site loads no external fonts, scripts or stylesheets — a security
// property, since nothing may be fetched before the League Password gate runs.
// The condensed display face is replaced by the system stack at heavy weight.
const UI_FONT = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

// league roster construction — stable league settings, not fetched live (see planning doc)
const STARTER_SLOTS = ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "K", "D/ST"];
const BENCH_SLOTS = 7;
const MAX_ROSTERED = { QB: 4, RB: 8, WR: 8, TE: 3, K: 3, "D/ST": 3 };
const FLEX_ELIGIBLE = ["RB", "WR", "TE"];


// ESPN's fixed position and NFL-team ID conventions — validated against live data
const POSITION_MAP = { 1: "QB", 2: "RB", 3: "WR", 4: "TE", 5: "K", 16: "D/ST" };
const PRO_TEAM_MAP = {
  1: "ATL", 2: "BUF", 3: "CHI", 4: "CIN", 5: "CLE", 6: "DAL", 7: "DEN", 8: "DET",
  9: "GB", 10: "TEN", 11: "IND", 12: "KC", 13: "LV", 14: "LAR", 15: "MIA", 16: "MIN",
  17: "NE", 18: "NO", 19: "NYG", 20: "NYJ", 21: "PHI", 22: "ARI", 23: "PIT", 24: "LAC",
  25: "SF", 26: "SEA", 27: "TB", 28: "WSH", 29: "CAR", 30: "JAX", 33: "BAL", 34: "HOU",
  0: "FA",
};

const POS_COLOR = (pal, pos) => ({
  QB: pal.blue, RB: pal.green, WR: pal.gold, TE: pal.amber,
  K: pal.textSecondary, "D/ST": pal.red,
}[pos] || pal.textSecondary);

// data-fetching layer — reads the platform's on-demand API, which serves from
// R2 and refreshes from ESPN only when a dataset is past its freshness window.
// ETag conditional requests keep an unchanged dataset to a cheap 304.
//
// Polling pauses while the tab is hidden and stops entirely after four hours
// without interaction. Refresh cost scales with how long a page keeps polling
// rather than with how many people are watching, so an abandoned tab is the
// only pattern that can run up cost unbounded.
const IDLE_LIMIT_MS = 4 * 60 * 60 * 1000;

function useIdleClock() {
  const [idle, setIdle] = useState(false);
  const lastActive = useRef(Date.now());

  useEffect(() => {
    const bump = () => { lastActive.current = Date.now(); setIdle(false); };
    const events = ["pointerdown", "keydown", "scroll", "touchstart", "focus"];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const t = setInterval(() => {
      setIdle(Date.now() - lastActive.current > IDLE_LIMIT_MS);
    }, 60000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      clearInterval(t);
    };
  }, []);

  return idle;
}

function useDataset(key, intervalMs, idle) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const etagRef = useRef(null);
  const timerRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const headers = {};
      if (etagRef.current) headers["If-None-Match"] = etagRef.current;
      const res = await fetch(`/api/data/${key}`, { headers, credentials: "same-origin" });
      if (res.status === 401) { setError("session expired"); return; }
      if (res.status === 304) { setLastUpdated(new Date()); setError(null); return; }
      if (!res.ok) throw new Error(`${res.status}`);
      etagRef.current = res.headers.get("etag");
      const json = await res.json();
      setData(json);
      setLastUpdated(new Date());
      setError(null);
    } catch (e) {
      setError(e.message || "fetch failed");
    }
  }, [key]);

  useEffect(() => {
    load();
    if (!intervalMs) return undefined;
    function tick() {
      if (!document.hidden && !idle) load();
      timerRef.current = setTimeout(tick, intervalMs);
    }
    timerRef.current = setTimeout(tick, intervalMs);
    function onVisible() { if (!document.hidden && !idle) load(); }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timerRef.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load, intervalMs, idle]);

  return { data, error, lastUpdated, refetch: load };
}

// The team selection is site-wide: the dashboard sets it, every tool reads it,
// so nobody has to pick their team once per tool.
const TEAM_COOKIE = "eft_team";

function readTeamCookie() {
  const m = new RegExp("(?:^|; )" + TEAM_COOKIE + "=([^;]*)").exec(document.cookie);
  return m ? Number(decodeURIComponent(m[1])) || null : null;
}

function writeTeamCookie(id) {
  document.cookie = TEAM_COOKIE + "=" + encodeURIComponent(id == null ? "" : id) +
    "; path=/; max-age=31536000; samesite=lax";
}

// derived-data helpers — turn raw GitHub/ESPN JSON into what the UI needs
function deriveTeams(rostersData) {
  if (!rostersData) return [];
  const membersById = {};
  (rostersData.members || []).forEach((m) => { membersById[m.id] = m; });
  return (rostersData.teams || []).map((t) => {
    const owner = membersById[(t.owners || [])[0]];
    return {
      id: t.id, name: t.name, abbrev: t.abbrev,
      owner: owner ? `${owner.firstName} ${owner.lastName}` : "Unknown Owner",
    };
  });
}

function deriveBye(stats) {
  if (!Array.isArray(stats)) return 0;
  const counts = {};
  stats.forEach((s) => { if (s.scoringPeriodId > 0) counts[s.scoringPeriodId] = (counts[s.scoringPeriodId] || 0) + 1; });
  const entries = Object.entries(counts);
  if (!entries.length) return 0;
  const max = Math.max(...entries.map(([, c]) => c));
  const bye = entries.find(([, c]) => c < max);
  return bye ? Number(bye[0]) : 0;
}

// The platform serves a reduced player digest: position/team decoding and the
// bye-week derivation all happen server-side, so this is a pass-through.
function derivePlayers(digest) {
  if (!digest?.players) return [];
  return digest.players;
}

function deriveDraftState(draftResultsData) {
  if (!draftResultsData) return null;
  const dd = draftResultsData.draftDetail || {};
  const picks = dd.picks || [];
  const draftStartMs = draftResultsData.settings?.draftSettings?.date || null;
  const made = picks.filter((p) => p.playerId && p.playerId !== -1);
  let scenario = "pre";
  if (picks.length > 0 && made.length >= picks.length) scenario = "post";
  else if (made.length > 0 || dd.inProgress) scenario = "active";
  const rounds = picks.length ? Math.max(...picks.map((p) => p.roundId)) : 16;
  const boardColumns = picks
    .filter((p) => p.roundId === 1)
    .sort((a, b) => a.roundPickNumber - b.roundPickNumber)
    .map((p) => p.teamId);
  return { scenario, picks, draftStartMs, rounds, boardColumns };
}

function buildDraftedMap(picks, playersById) {
  const map = new Map();
  (picks || []).forEach((pick) => {
    if (pick.playerId && pick.playerId !== -1) {
      const player = playersById.get(pick.playerId);
      map.set(pick.overallPickNumber, {
        ...(player || { id: pick.playerId, name: `Player #${pick.playerId}`, pos: "FLEX", nfl: "FA", bye: 0, injuryStatus: "ACTIVE" }),
        draftedBy: pick.teamId,
        overall: pick.overallPickNumber,
      });
    }
  });
  return map;
}

// The platform serves a reduced injury digest rather than ESPN's full report:
// the raw feed is ~8.9MB with no server-side filter available, so it is
// flattened to one current entry per player before it ever reaches a browser.
function deriveInjuryList(digest) {
  if (!digest?.players) return [];
  return digest.players
    .filter((p) => p.status && p.status !== "ACTIVE")
    .map((p) => ({
      id: p.id,
      name: p.name || "Unknown player",
      status: (p.status || "").toUpperCase(),
      note: p.note || (p.type ? `${p.type}.` : ""),
      team: p.team,
      pos: p.pos,
    }));
}

function timeAgo(iso) {
  if (!iso) return "";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function deriveNews(newsData) {
  if (!newsData?.articles) return [];
  return newsData.articles.slice(0, 8).map((a) => ({ id: a.id, headline: a.headline, time: timeAgo(a.published) }));
}

function assignRoster(teamId, draftedByOverall) {
  const picks = [...draftedByOverall.values()]
    .filter((p) => p.draftedBy === teamId)
    .sort((a, b) => a.overall - b.overall);
  const slots = STARTER_SLOTS.map((s) => ({ slot: s, player: null }));
  const bench = [];
  const remaining = [...picks];

  STARTER_SLOTS.forEach((slotType, idx) => {
    if (slotType === "FLEX") return;
    const i = remaining.findIndex((p) => p.pos === slotType);
    if (i >= 0) { slots[idx].player = remaining[i]; remaining.splice(i, 1); }
  });
  const flexIdx = slots.findIndex((s) => s.slot === "FLEX");
  const fi = remaining.findIndex((p) => FLEX_ELIGIBLE.includes(p.pos));
  if (fi >= 0) { slots[flexIdx].player = remaining[fi]; remaining.splice(fi, 1); }

  remaining.forEach((p) => { if (bench.length < BENCH_SLOTS) bench.push(p); });
  return { slots, bench, totalPicks: picks.length };
}

function posCounts(teamId, draftedByOverall) {
  const counts = {};
  [...draftedByOverall.values()].filter((p) => p.draftedBy === teamId).forEach((p) => {
    counts[p.pos] = (counts[p.pos] || 0) + 1;
  });
  return counts;
}

// small presentational pieces

/* ============================================================================
   Presentation
   ----------------------------------------------------------------------------
   Rebuilt from the ground up on the site's design system. The data layer above
   is unchanged; everything below is new.

   Position glyphs are drawn rather than borrowed from an icon set, so a running
   back reads as a running back rather than a generic circle, and so the marks
   share the stroke weight of the rest of the site.
   ========================================================================== */

const POS_GLYPHS = {
  QB: <><path d="M4 16.5c3.4-4 8.6-4 12 0" /><path d="M9 6.5c2.6-1.4 5.4-1.4 8 0" /><ellipse cx="13" cy="11" rx="6.4" ry="4.2" transform="rotate(-24 13 11)" /><path d="M11 9.6l4 2.8M12.6 8.4l1 .7M9.4 10.8l1 .7" /></>,
  RB: <><circle cx="14.5" cy="4.6" r="2.1" /><path d="M13 8.2l-3.4 3 2.6 2.6-1.2 5.4" /><path d="M12.2 13.8l3.6 1.6 1.4 4.4" /><path d="M9.6 11.2L5 12.4" /><path d="M16.2 9.6l3.6 1.8" /></>,
  WR: <><path d="M3.5 19.5c4-9 9-13 15.5-15" /><path d="M13 4.5h6v6" /><circle cx="6.5" cy="16.5" r="2.4" /></>,
  TE: <><path d="M4 6h16" /><path d="M12 6v13" /><path d="M7.5 19h9" /><path d="M8 10.5h8" /></>,
  K: <><circle cx="6.5" cy="17.5" r="2.2" /><path d="M8.4 16.1l4.2-3.4" /><path d="M13 12.4l4.6 1.2" /><path d="M4 21h16" /><path d="M18 4v6M15 6.5h6" /></>,
  "D/ST": <><path d="M12 3.2l7.5 3v5.4c0 4.6-3.2 8.2-7.5 9.6-4.3-1.4-7.5-5-7.5-9.6V6.2z" /><path d="M9 12l2.2 2.3L15.4 10" /></>,
  FLEX: <><path d="M4 8h9l-2.4-2.6M4 8l2.4 2.6" /><path d="M20 16h-9l2.4 2.6M20 16l-2.4-2.6" /></>,
};

function PosGlyph({ pos, size = 16, color }) {
  const g = POS_GLYPHS[pos] || POS_GLYPHS.FLEX;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color || "currentColor"}
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{g}</svg>
  );
}

/**
 * Countdown ring, drawn as a conic gradient rather than SVG.
 *
 * One element, one custom property, and the fill animates by interpolating that
 * property — no separate paint surface and nothing to mis-composite.
 */
function Ring({ pct, value, label }) {
  const clamped = Math.max(0, Math.min(1, pct));
  return (
    <div className="ring" style={{ "--pct": clamped }} role="img" aria-label={`${value} ${label}`}>
      <div className="ringface">
        <b>{value}</b>
        <span>{label}</span>
      </div>
    </div>
  );
}

function Stat({ value, label, tone }) {
  return (
    <div className="stat">
      <b style={tone ? { color: tone } : undefined}>{value}</b>
      <span>{label}</span>
    </div>
  );
}

/** A collapsible broadcast panel. */
function Panel({ id, title, glyph, badge, right, open, onToggle, children, flush }) {
  return (
    <section className={"dhpanel" + (open ? " open" : "")}>
      <button className="dhhead focus-ring" onClick={() => onToggle && onToggle(id)}
        aria-expanded={open} type="button">
        <span className="dhglyph">{glyph}</span>
        <span className="dhtitle">{title}</span>
        {badge != null && <span className="dhbadge">{badge}</span>}
        <span className="dhright">{right}</span>
        {onToggle && <span className={"dhchev" + (open ? " up" : "")} aria-hidden="true" />}
      </button>
      {/* Always mounted and animated by grid rows: a conditional render cannot
          transition, and the panels expand to very different heights. */}
      <div className="dhcollapse" aria-hidden={!open}>
        <div><div className={"dhbody" + (flush ? " flush" : "")}>{children}</div></div>
      </div>
    </section>
  );
}

/** Empty states are marked-out field, never a bare sentence. */
function Blank({ title, sub }) {
  return <div className="placeholder"><b>{title}</b>{sub && <span>{sub}</span>}</div>;
}

/** Listbox matching the site's, implemented in React for this bundle. */
function Listbox({ value, options, placeholder, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("click", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("click", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const current = options.find((o) => String(o.value) === String(value));
  return (
    <div className={"xsel" + (open ? " open" : "") + (current ? "" : " empty")} ref={ref}>
      <button type="button" className="xselbtn focus-ring" disabled={disabled}
        aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="xselval">{current ? current.label : placeholder}</span>
        <span className="xselchev" aria-hidden="true" />
      </button>
      {open && (
        <ul className="xsellist" role="listbox">
          {options.map((o) => (
            <li key={String(o.value)} role="option" aria-selected={String(o.value) === String(value)}
              className={String(o.value) === String(value) ? "on" : ""}
              onClick={() => { onChange(o.value); setOpen(false); }}>
              {o.label}{o.note && <small>{o.note}</small>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A roster slot: filled reads as a card, empty reads as a gap to fill. */
function Slot({ pal, slot, player, dim }) {
  const color = POS_COLOR(pal, slot === "FLEX" ? (player ? player.pos : "FLEX") : slot);
  if (!player) {
    return (
      <div className="slot empty">
        <span className="slotpos" style={{ color }}>{slot}</span>
        <span className="slotgap">Open</span>
      </div>
    );
  }
  return (
    <div className={"slot" + (dim ? " dim" : "")}>
      <span className="slotpos" style={{ color }}>{slot}</span>
      <span className="slotmain">
        <b>{player.name}</b>
        <i>{player.nfl}{player.bye ? " \u00b7 BYE " + player.bye : ""}</i>
      </span>
      <span className="slotglyph" style={{ color }}><PosGlyph pos={player.pos} size={15} /></span>
    </div>
  );
}

function ErrorBanner({ message }) {
  return (
    <div className="msg err" style={{ display: "block", marginTop: 0, marginBottom: 14 }}>
      {message === "session expired"
        ? "Your session has expired. Reload the page and sign in again."
        : "Couldn't reach live data (" + message + "). Retrying automatically."}
    </div>
  );
}

// main app
export default function DraftHelper() {
  const [theme, setTheme] = useState("dark");
  const [showSettings, setShowSettings] = useState(false);
  const gearRef = useRef(null);
  const pal = PALETTE[theme];

  // The shared stylesheet keys every colour off html[data-theme], so the tool's
  // own toggle has to move the document attribute, not just local state.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.cookie = "eft_theme=" + theme + "; path=/; max-age=31536000; samesite=lax";
  }, [theme]);


  // live data — tiered polling per the planning doc (15s critical, 60s the rest)
  const idle = useIdleClock();
  const draftResultsRes = useDataset("draft_results", 15000, idle);
  const rostersRes = useDataset("rosters", 15000, idle);
  const playerPoolRes = useDataset("player_digest", 60000, idle);
  const injuriesRes = useDataset("injuries_digest", 60000, idle);
  const newsRes = useDataset("nfl_news", 60000, idle);

  const teams = useMemo(() => deriveTeams(rostersRes.data), [rostersRes.data]);
  const teamsDropdown = useMemo(() => [...teams].sort((a, b) => {
    const [aFirst, ...aLast] = a.owner.split(" ");
    const [bFirst, ...bLast] = b.owner.split(" ");
    const c = aFirst.localeCompare(bFirst);
    return c !== 0 ? c : aLast.join(" ").localeCompare(bLast.join(" "));
  }), [teams]);
  /* Read, not hardcoded. This was a literal, which meant every forked
     deployment displayed this league's name in its own header until somebody
     noticed. The header simply carries nothing until the name arrives. */
  const [leagueName, setLeagueName] = useState("");
  useEffect(() => {
    let live = true;
    fetch("/api/meta", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((m) => { if (live && m && m.leagueName) setLeagueName(m.leagueName); })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  const players = useMemo(() => derivePlayers(playerPoolRes.data), [playerPoolRes.data]);
  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const draftState = useMemo(() => deriveDraftState(draftResultsRes.data), [draftResultsRes.data]);
  const scenario = draftState?.scenario || "pre";
  const picks = draftState?.picks || [];
  const boardColumns = draftState?.boardColumns || [];
  const totalRounds = draftState?.rounds || 16;

  // app state
  const [selectedTeamId, setSelectedTeamId] = useState(() => readTeamCookie());
  const [previewTeamId, setPreviewTeamId] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const [collapsed, setCollapsed] = useState({
    roster: true, recs: true, settings: true, league: true, board: true, injury: true,
  });
  const [blacklist, setBlacklist] = useState(new Set());
  const [watchlist, setWatchlist] = useState(new Set());
  const [notes, setNotes] = useState({});
  const [noteDraftFor, setNoteDraftFor] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [emphasize, setEmphasize] = useState(null);
  const [posFilter, setPosFilter] = useState("ALL");
  const [showInstructions, setShowInstructions] = useState(false);
  const [resetArmed, setResetArmed] = useState(false);

  useEffect(() => {
    if (scenario !== "pre") return undefined;
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [scenario]);

  const draftStart = draftState?.draftStartMs ? new Date(draftState.draftStartMs) : null;
  const msLeft = draftStart ? Math.max(0, draftStart.getTime() - now.getTime()) : 0;
  const countdown = (() => {
    const totalSec = Math.floor(msLeft / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return { h, m, s, pad: (n) => String(n).padStart(2, "0") };
  })();

  // Every clock on the site reads in the zone chosen in Site settings; the
  // shell exposes it globally so an iframed tool does not need its own copy.
  const siteZone = typeof window !== "undefined" && typeof window.siteTz === "function"
    ? window.siteTz() : undefined;
  const scheduledLabel = draftStart ? draftStart.toLocaleString(undefined, {
    timeZone: siteZone,
    weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short",
  }) : "";

  const draftedByOverall = useMemo(() => buildDraftedMap(picks, playersById), [picks, playersById]);
  const sortedPicks = useMemo(() => [...picks].sort((a, b) => a.overallPickNumber - b.overallPickNumber), [picks]);
  const onClockPick = scenario === "active" ? sortedPicks.find((p) => !p.playerId || p.playerId === -1) : null;
  const onClockTeam = onClockPick ? teams.find((t) => t.id === onClockPick.teamId) : null;
  const recentPicks = [...draftedByOverall.values()].sort((a, b) => b.overall - a.overall).slice(0, 4);

  const viewingTeamId = previewTeamId || selectedTeamId;
  const viewingTeam = teams.find((t) => t.id === viewingTeamId);
  const roster = useMemo(() => assignRoster(viewingTeamId, draftedByOverall), [viewingTeamId, draftedByOverall]);
  const counts = useMemo(() => posCounts(viewingTeamId, draftedByOverall), [viewingTeamId, draftedByOverall]);

  const draftedIds = useMemo(() => new Set([...draftedByOverall.values()].map((p) => p.id)), [draftedByOverall]);

  const available = useMemo(() => {
    let pool = players.filter((p) => !draftedIds.has(p.id));
    pool = pool.filter((p) => !blacklist.has(p.id));
    pool = pool.filter((p) => !(MAX_ROSTERED[p.pos] && (counts[p.pos] || 0) >= MAX_ROSTERED[p.pos]));
    if (posFilter !== "ALL") pool = pool.filter((p) => p.pos === posFilter);
    pool = [...pool].sort((a, b) => {
      if (emphasize) {
        const ae = a.pos === emphasize ? 0 : 1;
        const be = b.pos === emphasize ? 0 : 1;
        if (ae !== be) return ae - be;
      }
      return a.adp - b.adp;
    });
    return pool;
  }, [players, draftedIds, blacklist, counts, posFilter, emphasize]);

  const injuryList = useMemo(() => deriveInjuryList(injuriesRes.data), [injuriesRes.data]);
  const newsList = useMemo(() => deriveNews(newsRes.data), [newsRes.data]);

  const needSlots = roster.slots.filter((s) => !s.player).map((s) => s.slot);
  const byeCollisions = useMemo(() => {
    const byWeek = {};
    roster.slots.forEach((s) => { if (s.player) byWeek[s.player.bye] = (byWeek[s.player.bye] || 0) + 1; });
    return Object.entries(byWeek).filter(([, n]) => n >= 2).map(([wk]) => wk);
  }, [roster]);

  const toggleSection = useCallback((id) => setCollapsed((c) => ({ ...c, [id]: !c[id] })), []);
  const toggleBlacklist = useCallback((id) => setBlacklist((s) => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  }), []);
  const toggleWatchlist = useCallback((id) => setWatchlist((s) => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  }), []);

  const doReset = () => {
    if (!resetArmed) { setResetArmed(true); setTimeout(() => setResetArmed(false), 4000); return; }
    setBlacklist(new Set()); setWatchlist(new Set()); setNotes({}); setEmphasize(null); setResetArmed(false);
  };

  const refresh = () => { draftResultsRes.refetch(); rostersRes.refetch(); };
  const lastUpdatedLabel = draftResultsRes.lastUpdated
    ? draftResultsRes.lastUpdated.toLocaleTimeString(undefined, { timeZone: siteZone, hour: "numeric", minute: "2-digit", second: "2-digit" })
    : "loading…";

  const inputStyle = { background: pal.bgInset, borderColor: pal.border, color: pal.textPrimary, fontFamily: UI_FONT };
  const criticalError = draftResultsRes.error || rostersRes.error;

  const scenarioLabel = scenario === "pre" ? "Draft scheduled"
    : scenario === "active" ? "Draft in progress" : "Draft complete";
  const madeCount = draftedByOverall.size;
  const totalPicks = picks.length || (boardColumns.length * totalRounds);
  const progress = totalPicks ? madeCount / totalPicks : 0;
  const teamCount = boardColumns.length || teams.length || 10;

  const posList = ["ALL", "QB", "RB", "WR", "TE", "FLEX", "K", "D/ST"];

  return (
    <div style={{ minHeight: "100svh", fontFamily: UI_FONT }}>
      <div dangerouslySetInnerHTML={{ __html: BACKDROP }} />
      <style>{`
        ${PALETTES}
        ${BASE_CSS}
        * { box-sizing: border-box; }
        button { -webkit-tap-highlight-color: transparent; font-family: inherit; }
        .focus-ring:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        ::selection { background: var(--accent-glow); }

        .toolhead { display:flex; align-items:center; gap:18px; padding:0 0 14px;
                    border-bottom:1px solid var(--line); margin-bottom:18px; }
        .toolmark { flex:none; width:min(46%,340px); }
        .toolid { flex:1; min-width:0; text-align:right; }
        .toolid .eyebrow { margin-bottom:4px; justify-content:flex-end; }
        .toolid .eyebrow::after { display:none; }
        .toolleague { font-size:clamp(15px,2.4vw,22px); font-weight:900; letter-spacing:-.02em;
          overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
          background:linear-gradient(96deg,var(--ink) 30%,var(--accent) 130%);
          -webkit-background-clip:text; background-clip:text;
          color:transparent; -webkit-text-fill-color:transparent; }
        .toolctl { flex:none; display:flex; gap:4px; position:relative; }
        .toolctl .settings { top:38px; }
        @media (max-width:700px) {
          .toolhead { flex-wrap:wrap; gap:10px; }
          .toolmark { width:calc(100% - 74px); }
          .toolid { width:100%; text-align:left; order:3; }
          .toolid .eyebrow { justify-content:flex-start; }
        }

        /* ---- panels ---- */
        .dhpanel { position:relative; background:var(--panel); border:1px solid var(--line);
                   margin-bottom:12px; }
        .dhpanel::before { content:""; position:absolute; left:-1px; right:-1px; top:-1px; height:2px;
          background:linear-gradient(90deg,var(--line-2),transparent 70%); transition:background .25s ease; }
        .dhpanel.open::before { background:linear-gradient(90deg,var(--accent) 0%,
          var(--accent-deep) 34%, transparent 78%); }
        .dhhead { width:100%; display:flex; align-items:center; gap:10px; background:none;
          border:0; cursor:pointer; padding:13px 15px; color:var(--ink); text-align:left; }
        .dhglyph { flex:none; width:17px; height:17px; color:var(--accent); display:flex; }
        .dhtitle { font-size:11px; font-weight:900; letter-spacing:.16em; text-transform:uppercase;
          background:linear-gradient(94deg,var(--ink) 10%,var(--accent) 160%);
          -webkit-background-clip:text; background-clip:text;
          color:transparent; -webkit-text-fill-color:transparent; }
        .dhbadge { font-size:9.5px; font-weight:900; letter-spacing:.1em; color:var(--accent);
          border:1px solid var(--accent); padding:2px 6px; }
        .dhright { margin-left:auto; font-size:10px; font-weight:800; letter-spacing:.12em;
          text-transform:uppercase; color:var(--ink-3); }
        .dhchev { flex:none; width:8px; height:8px; border-right:2px solid var(--ink-3);
          border-bottom:2px solid var(--ink-3); transform:rotate(45deg) translate(-2px,-2px);
          transition:transform .2s ease, border-color .2s ease; }
        .dhchev.up { transform:rotate(225deg) translate(-2px,-2px); border-color:var(--accent); }
        .dhcollapse { display:grid; grid-template-rows:0fr;
          transition:grid-template-rows .34s cubic-bezier(.3,.85,.35,1); }
        .dhpanel.open .dhcollapse { grid-template-rows:1fr; }
        .dhcollapse > div { overflow:hidden; }
        .dhbody { padding:0 15px 15px; opacity:0; transition:opacity .26s ease .04s; }
        .dhpanel.open .dhbody { opacity:1; }
        .dhbody.flush { padding:0; }
        html.stillness .dhcollapse, html.stillness .dhbody { transition:none; }
        @media (prefers-reduced-motion: reduce) {
          .dhcollapse, .dhbody { transition:none; }
        }

        /* ---- clock hero ---- */
        .hero { display:flex; align-items:center; gap:clamp(16px,3vw,32px); flex-wrap:wrap; }
        .heromain { flex:1; min-width:210px; }
        .herostate { display:flex; align-items:center; gap:9px; font-size:10.5px; font-weight:900;
          letter-spacing:.22em; text-transform:uppercase; color:var(--accent); margin-bottom:8px; }
        .herostate i { width:7px; height:7px; background:currentColor; transform:rotate(45deg);
          animation:pip 1.9s ease-in-out infinite; }
        @keyframes pip { 0%,100% { opacity:1 } 50% { opacity:.3 } }
        .herobig { font-size:clamp(30px,6.4vw,52px); font-weight:900; letter-spacing:-.03em;
          line-height:1; font-variant-numeric:tabular-nums;
          background:linear-gradient(96deg,var(--ink) 34%,var(--accent) 128%);
          -webkit-background-clip:text; background-clip:text;
          color:transparent; -webkit-text-fill-color:transparent; }
        .herobig em { font-style:normal; color:var(--ink-3); -webkit-text-fill-color:var(--ink-3);
          font-size:.44em; margin:0 .06em; }
        .herosub { font-size:12.5px; color:var(--ink-2); margin-top:9px; }
        .herostats { display:flex; gap:22px; flex-wrap:wrap; margin-top:14px; }
        .stat b { display:block; font-size:20px; font-weight:900; color:var(--accent);
          font-variant-numeric:tabular-nums; letter-spacing:-.02em; }
        .stat span { display:block; font-size:9.5px; font-weight:900; letter-spacing:.15em;
          text-transform:uppercase; color:var(--ink-3); margin-top:2px; }

        .ring { flex:none; position:relative; width:132px; height:132px; border-radius:50%;
          display:grid; place-items:center;
          background:conic-gradient(var(--accent) calc(var(--pct,0) * 360deg),
                                    var(--line) 0);
          transition:background .6s cubic-bezier(.3,.8,.4,1); }
        .ring::after { content:""; position:absolute; inset:5px; border-radius:50%;
          background:var(--panel); }
        .ringface { position:relative; z-index:1; text-align:center; }
        .ringface b { display:block; font-size:23px; font-weight:900; letter-spacing:-.02em;
          color:var(--ink); font-variant-numeric:tabular-nums; }
        .ringface span { display:block; font-size:8.5px; font-weight:900; letter-spacing:.16em;
          text-transform:uppercase; color:var(--ink-3); margin-top:2px; }

        /* ---- pick strip ---- */
        .pickstrip { display:flex; gap:0; overflow:hidden; border-top:1px solid var(--line);
          margin-top:14px; pointer-events:none;
          -webkit-mask-image:linear-gradient(90deg,transparent,#000 28px,#000 calc(100% - 28px),transparent);
                  mask-image:linear-gradient(90deg,transparent,#000 28px,#000 calc(100% - 28px),transparent); }
        .pickrun { display:flex; width:max-content; animation:marquee var(--dur,40s) linear infinite; }
        body.tabhidden .pickrun { animation-play-state:paused; }
        .pickitem { flex:none; display:flex; align-items:center; gap:8px; padding:9px 16px;
          border-right:1px solid var(--line); white-space:nowrap; }
        .picknum { font-size:9.5px; font-weight:900; color:var(--ink-3);
          font-variant-numeric:tabular-nums; letter-spacing:.06em; }
        .pickname { font-size:12.5px; font-weight:800; }
        .pickmeta { font-size:9.5px; font-weight:800; letter-spacing:.1em; color:var(--ink-3);
          text-transform:uppercase; }

        /* ---- layout ---- */
        .dhgrid { display:grid; grid-template-columns:1fr; gap:0; }

        /* ---- roster ---- */
        .slot { display:flex; align-items:center; gap:11px; padding:9px 11px;
          border:1px solid var(--line); background:var(--inset); margin-bottom:6px;
          transition:border-color .18s ease, transform .18s ease; }
        .slot:hover { border-color:var(--line-2); transform:translateX(2px); }
        .slot.empty { border-style:dashed; background:
          repeating-linear-gradient(135deg, transparent 0 8px, var(--accent-glow) 8px 9px); }
        .slotpos { flex:none; width:44px; font-size:10px; font-weight:900; letter-spacing:.1em; }
        .slotmain { flex:1; min-width:0; }
        .slotmain b { display:block; font-size:13px; font-weight:800; overflow:hidden;
          text-overflow:ellipsis; white-space:nowrap; }
        .slotmain i { display:block; font-style:normal; font-size:10px; font-weight:800;
          letter-spacing:.11em; text-transform:uppercase; color:var(--ink-3); margin-top:1px; }
        .slotgap { flex:1; font-size:10.5px; font-weight:900; letter-spacing:.16em;
          text-transform:uppercase; color:var(--ink-3); }
        .slotglyph { flex:none; opacity:.85; }

        .needrow { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; }
        .needchip { font-size:10px; font-weight:900; letter-spacing:.12em; text-transform:uppercase;
          padding:5px 9px; border:1px solid var(--accent); color:var(--accent); }
        .warnchip { font-size:10px; font-weight:900; letter-spacing:.12em; text-transform:uppercase;
          padding:5px 9px; border:1px solid var(--signal); color:var(--signal); }

        /* ---- targets ---- */
        .filters { display:flex; flex-wrap:wrap; gap:5px; margin-bottom:12px; }
        .fbtn { background:none; border:1px solid var(--line); color:var(--ink-3);
          font-family:inherit; font-size:10px; font-weight:900; letter-spacing:.11em;
          padding:6px 9px; cursor:pointer; display:flex; align-items:center; gap:5px;
          transition:all .15s ease; }
        .fbtn:hover { border-color:var(--line-2); color:var(--ink-2); }
        .fbtn.on { border-color:var(--accent); color:var(--accent); background:var(--accent-glow); }

        .prow { position:relative; display:flex; align-items:center; gap:11px; padding:10px 11px;
          border:1px solid var(--line); background:var(--inset); margin-bottom:6px; overflow:hidden;
          transition:border-color .18s ease; }
        .prow:hover { border-color:var(--line-2); }
        .prow.watch { border-left:2px solid var(--gold); }
        .prank { flex:none; width:26px; font-size:15px; font-weight:900; color:var(--ink);
          opacity:.22; font-variant-numeric:tabular-nums; letter-spacing:-.04em; text-align:right; }
        .pglyph { flex:none; }
        .pmain { flex:1; min-width:0; }
        .pmain b { display:block; font-size:13.5px; font-weight:800; overflow:hidden;
          text-overflow:ellipsis; white-space:nowrap; }
        .pmeta { display:flex; align-items:center; gap:7px; margin-top:2px; }
        .pmeta span { font-size:10px; font-weight:800; letter-spacing:.1em; text-transform:uppercase;
          color:var(--ink-3); }
        .padp { flex:none; text-align:right; }
        .padp b { display:block; font-size:13px; font-weight:900; color:var(--accent);
          font-variant-numeric:tabular-nums; }
        .padp span { display:block; font-size:8.5px; font-weight:900; letter-spacing:.14em;
          text-transform:uppercase; color:var(--ink-3); }
        .pacts { flex:none; display:flex; gap:2px; }
        .pact { background:none; border:0; padding:5px; cursor:pointer; color:var(--ink-3);
          display:flex; transition:color .15s ease; }
        .pact:hover { color:var(--accent); }
        .pact.on { color:var(--gold); }
        .pact.ban.on { color:var(--flag); }
        .pbar { position:absolute; left:0; bottom:0; height:2px; background:var(--accent);
          opacity:.5; transition:width .5s cubic-bezier(.3,.8,.4,1); }

        /* ---- board ---- */
        .boardscroll { overflow-x:auto; padding:0 15px 15px; scrollbar-width:thin; }
        .board { border-collapse:collapse; font-size:10px; width:100%; }
        .board th { position:sticky; top:0; font-size:8.5px; font-weight:900; letter-spacing:.1em;
          text-transform:uppercase; color:var(--ink-3); padding:6px 4px; white-space:nowrap;
          border-bottom:1px solid var(--line); }
        .board td { border:1px solid var(--line); padding:5px 6px; min-width:78px; height:34px;
          vertical-align:middle; }
        .board td.mine { background:var(--accent-glow); border-color:var(--accent-deep); }
        .board td.onclock { border-color:var(--accent); }
        .board .rnd { min-width:26px; width:26px; text-align:center; color:var(--ink-3);
          font-weight:900; font-variant-numeric:tabular-nums; border:0; }
        .bp { display:block; font-weight:800; font-size:10.5px; overflow:hidden;
          text-overflow:ellipsis; white-space:nowrap; }
        .bpos { display:block; font-size:8px; font-weight:900; letter-spacing:.1em; margin-top:1px; }
        .bempty { color:var(--ink-3); font-variant-numeric:tabular-nums; opacity:.55; }

        /* ---- wire ---- */
        .wirerow { display:flex; gap:10px; padding:9px 0; border-bottom:1px solid var(--line); }
        .wirerow:last-child { border-bottom:0; }
        .wtag { flex:none; font-size:8.5px; font-weight:900; letter-spacing:.1em; padding:3px 6px;
          border:1px solid currentColor; height:fit-content; }
        .wmain b { display:block; font-size:12.5px; font-weight:800; }
        .wmain span { display:block; font-size:11px; color:var(--ink-3); margin-top:2px;
          line-height:1.45; }

        /* Matches the shell exactly: one page action above the rule, the
           attribution below it. A tool that invents its own footer is how the
           site starts to feel like several sites. */
        .homelink { display:block; text-decoration:none; color:inherit; }
        .homelink:hover .mark .m2 { fill:var(--accent); }
        .pageaction { display:flex; justify-content:center; margin:22px 0 4px; }
        .pagebtn { background:none; border:1px solid var(--sky); color:var(--sky);
          font-family:inherit; font-size:10.5px; font-weight:900; letter-spacing:.15em;
          text-transform:uppercase; cursor:pointer; padding:10px 26px; border-radius:0;
          text-decoration:none; display:inline-flex; align-items:center; gap:9px;
          transition:background .16s ease, color .16s ease; }
        .pagebtn:hover { background:var(--sky); color:var(--field); }

        .toolfoot { margin-top:10px; padding-top:10px; border-top:1px solid var(--line);
          text-align:center; }
        .toolfoot .gh { display:inline-flex; align-items:center; gap:7px; color:var(--ink-3);
          font-size:10px; font-weight:900; letter-spacing:.16em; text-transform:uppercase;
          text-decoration:none; }
        .toolfoot .gh::before { content:""; width:5px; height:5px; background:currentColor;
          transform:rotate(45deg); }
        .toolfoot .gh:hover { color:var(--accent); }
      `}</style>

      <div className="wrap">
        <div className="toolhead">
          <a className="toolmark homelink" href="/" aria-label="Back to home">
            <svg className="mark" viewBox="0 0 1000 150" role="img" aria-label="ESPN Fantasy Tools">
              <text className="fit" x="500" y="74" textAnchor="middle" textLength="980"
                lengthAdjust="spacingAndGlyphs" fontSize="86" fontWeight="900"
                letterSpacing="-2" fontFamily={UI_FONT}>
                <tspan className="m1">ESPN</tspan><tspan className="m2"> FANTASY TOOLS</tspan>
              </text>
              <path className="rule" d="M10 100 H990" />
              <path className="rulelive" d="M10 100 H360" />
              <text x="500" y="137" textAnchor="middle" fontSize="30" fontWeight="700"
                letterSpacing="14" fill="var(--ink-3)" fontFamily={UI_FONT}>LEAGUE HQ</text>
            </svg>
          </a>
          <div className="toolid">
            <p className="eyebrow">Draft Helper</p>
            <div className="toolleague">{leagueName}</div>
          </div>
          <div className="toolctl">
            <button onClick={() => setShowInstructions(true)} title="How to use this tool"
              className="ctlbtn focus-ring" type="button"><HelpCircle size={18} /></button>
            <button onClick={(e) => { e.stopPropagation(); setShowSettings((v) => !v); }}
              ref={gearRef} id="gearBtn" title="Site settings" aria-haspopup="dialog"
              className="ctlbtn focus-ring" type="button"><SettingsIcon size={18} /></button>
            <SettingsMenu open={showSettings} onClose={() => setShowSettings(false)}
              theme={theme} onTheme={setTheme} anchorRef={gearRef} />
          </div>
        </div>

        {criticalError && <ErrorBanner message={criticalError} />}

        {/* team selection */}
        <div className="dhpanel open" style={{ padding: "13px 15px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <span className="dhtitle" style={{ flex: "none" }}>My team</span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <Listbox
                value={selectedTeamId ?? ""}
                placeholder={teams.length ? "Select your team" : "Loading teams"}
                disabled={teams.length === 0}
                options={teamsDropdown.map((t) => ({ value: t.id, label: t.name, note: t.owner }))}
                onChange={(v) => {
                  const id = v ? Number(v) : null;
                  setSelectedTeamId(id); writeTeamCookie(id); setPreviewTeamId(null);
                }}
              />
            </div>
            {previewTeamId && (
              <button className="fbtn on" type="button" onClick={() => setPreviewTeamId(null)}>
                <Eye size={12} /> Previewing {teams.find((t) => t.id === previewTeamId)?.name}
              </button>
            )}
          </div>
        </div>

        {/* draft clock */}
        <div className="dhpanel open">
          <div style={{ padding: "18px 15px 15px" }}>
            <div className="hero">
              <div className="heromain">
                <div className="herostate"><i />{scenarioLabel}</div>
                {scenario === "pre" && (
                  <>
                    <div className="herobig">
                      {countdown.pad(countdown.h)}<em>:</em>{countdown.pad(countdown.m)}<em>:</em>{countdown.pad(countdown.s)}
                    </div>
                    <div className="herosub">{scheduledLabel || "Draft time not set"}</div>
                  </>
                )}
                {scenario === "active" && (
                  <>
                    <div className="herobig">{onClockTeam ? onClockTeam.name : "On the clock"}</div>
                    <div className="herosub">
                      Pick {onClockPick ? onClockPick.overallPickNumber : "\u2014"} of {totalPicks}
                      {onClockPick ? " \u00b7 Round " + onClockPick.roundId : ""}
                    </div>
                  </>
                )}
                {scenario === "post" && (
                  <>
                    <div className="herobig">Draft complete</div>
                    <div className="herosub">All {totalPicks} picks are in. Rosters below are final.</div>
                  </>
                )}
                <div className="herostats">
                  <Stat value={madeCount} label="Picks made" />
                  <Stat value={totalRounds} label="Rounds" />
                  <Stat value={teamCount} label="Teams" />
                  <Stat value={available.length} label="Available" />
                </div>
              </div>
              <Ring pct={scenario === "pre" ? 0 : progress}
                value={Math.round(progress * 100) + "%"} label="Drafted" />
            </div>

            {recentPicks.length > 0 && (
              <div className="pickstrip">
                <div className="pickrun" style={{ "--dur": Math.max(18, recentPicks.length * 9) + "s" }}>
                  {[...recentPicks, ...recentPicks, ...recentPicks, ...recentPicks].map((p, i) => (
                    <div className="pickitem" key={i}>
                      <span className="picknum">#{p.overall}</span>
                      <span style={{ color: POS_COLOR(pal, p.pos), display: "flex" }}>
                        <PosGlyph pos={p.pos} size={14} />
                      </span>
                      <span className="pickname">{p.name}</span>
                      <span className="pickmeta">{p.pos} {"\u00b7"} {p.nfl}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {!viewingTeamId ? (
          <div className="dhpanel open"><div style={{ padding: 15 }}>
            <Blank title="Pick a team to begin"
              sub="Choose your team above. Roster, targets and needs all follow it." />
          </div></div>
        ) : (
          <div className="dhgrid">
            <div>
              <Panel id="roster" title={viewingTeam ? viewingTeam.name : "Roster"}
                glyph={<PosGlyph pos="TE" size={17} />}
                badge={roster.totalPicks} open={!collapsed.roster} onToggle={toggleSection}
                right={previewTeamId ? "Preview" : "Starters"}>
                {roster.slots.map((s, i) => (
                  <Slot key={i} pal={pal} slot={s.slot} player={s.player} dim={!!previewTeamId} />
                ))}
                {roster.bench.length > 0 && (
                  <>
                    <div className="dhright" style={{ margin: "12px 0 7px" }}>Bench</div>
                    {roster.bench.map((p, i) => (
                      <Slot key={"b" + i} pal={pal} slot="BE" player={p} dim={!!previewTeamId} />
                    ))}
                  </>
                )}
                <div className="needrow">
                  {needSlots.length === 0
                    ? <span className="needchip">Lineup full</span>
                    : needSlots.map((n, i) => <span className="needchip" key={i}>Need {n}</span>)}
                  {byeCollisions.map((wk) => (
                    <span className="warnchip" key={wk}>Bye clash wk {wk}</span>
                  ))}
                </div>
              </Panel>

              <Panel id="league" title="League" glyph={<Users size={16} />}
                open={!collapsed.league} onToggle={toggleSection} right={teams.length + " teams"}>
                {teams.length === 0 ? <Blank title="Loading teams" /> : (
                  <div className="needrow" style={{ marginTop: 0 }}>
                    {teamsDropdown.map((t) => (
                      <button key={t.id} type="button"
                        className={"fbtn" + (viewingTeamId === t.id ? " on" : "")}
                        onClick={() => setPreviewTeamId(t.id === selectedTeamId ? null : t.id)}>
                        {t.name}
                      </button>
                    ))}
                  </div>
                )}
              </Panel>
            </div>

            <div>
              <Panel id="recs" title="Targets" glyph={<PosGlyph pos="WR" size={17} />}
                badge={available.length} open={!collapsed.recs} onToggle={toggleSection}
                right={emphasize ? "Favouring " + emphasize : "By ADP"}>
                <div className="filters">
                  {posList.map((pos) => (
                    <button key={pos} type="button"
                      className={"fbtn" + (posFilter === pos ? " on" : "")}
                      onClick={() => setPosFilter(pos)}>
                      {pos !== "ALL" && <PosGlyph pos={pos} size={12} />}{pos}
                    </button>
                  ))}
                </div>
                {available.length === 0 ? (
                  <Blank title="Nothing available" sub="Every player is drafted, filtered out or blocked." />
                ) : available.slice(0, 24).map((p, i) => {
                  const watched = watchlist.has(p.id);
                  const banned = blacklist.has(p.id);
                  const color = POS_COLOR(pal, p.pos);
                  const need = needSlots.includes(p.pos) ||
                    (needSlots.includes("FLEX") && FLEX_ELIGIBLE.includes(p.pos));
                  return (
                    <div className={"prow" + (watched ? " watch" : "")} key={p.id}>
                      <span className="prank">{i + 1}</span>
                      <span className="pglyph" style={{ color, display: "flex" }}>
                        <PosGlyph pos={p.pos} size={17} />
                      </span>
                      <span className="pmain">
                        <b>{p.name}</b>
                        <span className="pmeta">
                          <span style={{ color }}>{p.pos}</span>
                          <span>{p.nfl}</span>
                          {p.bye ? <span>Bye {p.bye}</span> : null}
                          {need ? <span style={{ color: "var(--accent)" }}>Fills need</span> : null}
                          {p.injuryStatus && p.injuryStatus !== "ACTIVE"
                            ? <span style={{ color: "var(--signal)" }}>{p.injuryStatus.slice(0, 4)}</span> : null}
                        </span>
                      </span>
                      <span className="padp">
                        <b>{p.adp >= 999 ? "\u2014" : p.adp.toFixed(1)}</b>
                        <span>ADP</span>
                      </span>
                      <span className="pacts">
                        <button className={"pact" + (watched ? " on" : "")} type="button"
                          title="Watch" onClick={() => toggleWatchlist(p.id)}><Star size={14} /></button>
                        <button className={"pact ban" + (banned ? " on" : "")} type="button"
                          title="Hide" onClick={() => toggleBlacklist(p.id)}><Ban size={14} /></button>
                      </span>
                      <span className="pbar" style={{
                        width: Math.max(2, Math.min(100, 100 - (p.adp / 2.4))) + "%",
                        background: color,
                      }} />
                    </div>
                  );
                })}
              </Panel>

              <Panel id="settings" title="Emphasis" glyph={<SlidersHorizontal size={16} />}
                open={!collapsed.settings} onToggle={toggleSection}
                right={emphasize || "None"}>
                <div className="filters" style={{ marginBottom: 0 }}>
                  <button type="button" className={"fbtn" + (!emphasize ? " on" : "")}
                    onClick={() => setEmphasize(null)}>No emphasis</button>
                  {["QB", "RB", "WR", "TE", "K", "D/ST"].map((pos) => (
                    <button key={pos} type="button"
                      className={"fbtn" + (emphasize === pos ? " on" : "")}
                      onClick={() => setEmphasize(emphasize === pos ? null : pos)}>
                      <PosGlyph pos={pos} size={12} />{pos}
                    </button>
                  ))}
                </div>
              </Panel>
            </div>
          </div>
        )}

        <Panel id="board" title="Draft board" glyph={<LayoutGrid size={16} />}
          open={!collapsed.board} onToggle={toggleSection} flush
          right={boardColumns.length ? totalRounds + " rounds" : ""}>
          {boardColumns.length === 0 ? (
            <div style={{ padding: 15 }}>
              <Blank title="Board not available yet" sub="It appears once the draft order is set." />
            </div>
          ) : (
            <div className="boardscroll">
              <table className="board">
                <thead>
                  <tr>
                    <th className="rnd" />
                    {boardColumns.map((tid) => {
                      const t = teams.find((x) => x.id === tid);
                      return <th key={tid}>{t ? (t.abbrev || t.name.slice(0, 9)) : "T" + tid}</th>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: totalRounds }, (_, r) => (
                    <tr key={r}>
                      <td className="rnd">{r + 1}</td>
                      {boardColumns.map((tid, c) => {
                        const n = boardColumns.length;
                        const overall = (r % 2 === 0) ? r * n + c + 1 : r * n + (n - c);
                        const pick = draftedByOverall.get(overall);
                        const mine = tid === viewingTeamId;
                        const onClock = onClockPick && onClockPick.overallPickNumber === overall;
                        return (
                          <td key={c} className={(mine ? "mine " : "") + (onClock ? "onclock" : "")}>
                            {pick ? (
                              <>
                                <span className="bp">{pick.name}</span>
                                <span className="bpos" style={{ color: POS_COLOR(pal, pick.pos) }}>
                                  {pick.pos} {"\u00b7"} {pick.nfl}
                                </span>
                              </>
                            ) : <span className="bempty">{overall}</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel id="injury" title="Wire" glyph={<Newspaper size={16} />}
          open={!collapsed.injury} onToggle={toggleSection}
          right={injuryList.length + " alerts"}>
          {injuryList.length === 0 && newsList.length === 0 ? (
            <Blank title="Nothing on the wire" sub="Injury notes and headlines appear here." />
          ) : (
            <>
              {injuryList.slice(0, 6).map((p) => (
                <div className="wirerow" key={p.id}>
                  <span className="wtag" style={{
                    color: p.status === "OUT" || p.status === "IR" ? "var(--flag)" : "var(--signal)",
                  }}>{p.status.slice(0, 4)}</span>
                  <span className="wmain">
                    <b>{p.name}</b>
                    <span>{p.pos ? p.pos + " \u00b7 " : ""}{p.team}{p.note ? " \u2014 " + p.note : ""}</span>
                  </span>
                </div>
              ))}
              {newsList.slice(0, 4).map((n, i) => (
                <div className="wirerow" key={"n" + i}>
                  <span className="wtag" style={{ color: "var(--sky)" }}>NEWS</span>
                  <span className="wmain"><b>{n.headline}</b><span>{n.time}</span></span>
                </div>
              ))}
            </>
          )}
        </Panel>

        {idle && (
          <div className="msg info" style={{ display: "block" }}>
            Live updates paused after 4 hours idle. Tap anywhere to resume.
          </div>
        )}

        {/* Same shape as every other surface: the one page action sits above
            the rule, the attribution below it. */}
        <div className="pageaction">
          <a className="pagebtn" href="/">&larr; Back to home</a>
        </div>
        <div className="toolfoot">
          <a className="gh" href="https://github.com/shortcutsbin-netizen"
            target="_blank" rel="noopener noreferrer">GitHub - shortcutsbin-netizen</a>
        </div>
      </div>

      {showInstructions && <Instructions onClose={() => setShowInstructions(false)} />}
    </div>
  );
}

function Instructions({ onClose }) {
  const steps = [
    ["01", "Pick your team", "Choose your team once. The roster, needs and targets all follow it, and the choice is shared with every other tool."],
    ["02", "Watch the clock", "Before the draft it counts down. During it, the panel names whoever is on the clock and which pick they are on."],
    ["03", "Work the targets", "Available players sit in ADP order. Star anyone you want to remember, hide anyone you never want to see again."],
    ["04", "Lean a position", "Emphasis floats one position to the top without hiding the rest, for when you know what you need next."],
    ["05", "Read the board", "Your picks are highlighted. Empty cells show the overall pick number so you can count forward to your next turn."],
  ];
  return (
    <div className="instr" role="dialog" aria-modal="true" aria-label="How to use Draft Helper">
      <style>{`
        .instr { position:fixed; inset:0; z-index:80; background:var(--field);
          overflow-y:auto; animation:dhopen .22s ease; }
        .instrwrap { max-width:640px; margin:0 auto; padding:26px 18px 40px; }
        .instrhead { display:flex; align-items:center; gap:12px; margin-bottom:20px; }
        .instrhead h2 { flex:1; margin:0; font-size:20px; font-weight:900; letter-spacing:-.02em;
          background:linear-gradient(96deg,var(--ink) 30%,var(--accent) 130%);
          -webkit-background-clip:text; background-clip:text;
          color:transparent; -webkit-text-fill-color:transparent; }
        .istep { display:flex; gap:14px; padding:15px 0; border-bottom:1px solid var(--line); }
        .istep:last-of-type { border-bottom:0; }
        .inum { flex:none; font-size:22px; font-weight:900; color:var(--ink); opacity:.2;
          font-variant-numeric:tabular-nums; letter-spacing:-.04em; }
        .istep b { display:block; font-size:11px; font-weight:900; letter-spacing:.16em;
          text-transform:uppercase; margin-bottom:5px;
          background:linear-gradient(94deg,var(--ink) 10%,var(--accent) 160%);
          -webkit-background-clip:text; background-clip:text;
          color:transparent; -webkit-text-fill-color:transparent; }
        .istep p { margin:0; font-size:13.5px; color:var(--ink-2); line-height:1.6; }
      `}</style>
      <div className="instrwrap">
        <div className="instrhead">
          <h2>How this works</h2>
          <button className="ctlbtn focus-ring" onClick={onClose} aria-label="Close" type="button">
            <X size={19} />
          </button>
        </div>
        {steps.map(([n, title, body]) => (
          <div className="istep" key={n}>
            <span className="inum">{n}</span>
            <span><b>{title}</b><p>{body}</p></span>
          </div>
        ))}
        <button className="primary" onClick={onClose} type="button">Got it</button>
      </div>
    </div>
  );
}
