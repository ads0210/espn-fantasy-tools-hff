import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import ScrollBox from "../shared/ScrollBox.jsx";
import { num, bytes, pct, dur, relText, absText, shortText, clockText, dayKey, dayName, toMs, hourSpan, reportCounts } from "./format.js";
import { Heartbeat, TrafficChart, Spark, Heat, Slices, DepDiagram } from "./charts.jsx";

/* Everything a panel body can hold, drawn from the small vocabulary the server writes in. */

export const Ctx = createContext({ teams: {}, pages: [], go: () => {}, jump: () => {}, markSeen: () => {}, detail: async () => null });

// ---------------------------------------------------------------- a clock every time shares

const CLOCK = { now: Date.now(), subs: new Set(), timer: null };
function subscribe(fn) {
  CLOCK.subs.add(fn);
  if (!CLOCK.timer) CLOCK.timer = setInterval(() => { CLOCK.now = Date.now(); CLOCK.subs.forEach((f) => f()); }, 1000);
  return () => { CLOCK.subs.delete(fn); if (!CLOCK.subs.size && CLOCK.timer) { clearInterval(CLOCK.timer); CLOCK.timer = null; } };
}
export const useNow = () => useSyncExternalStore(subscribe, () => CLOCK.now, () => CLOCK.now);

/** A time, shown as how long ago; tap for the exact moment in your time zone, and back. */
export function Time({ v, abs: startAbs = false }) {
  const [abs, setAbs] = useState(startAbs);
  const now = useNow();
  const ms = toMs(v);
  if (ms == null || !Number.isFinite(ms)) return <span>—</span>;
  const text = abs ? shortText(ms) : relText(ms, now);
  return <button type="button" className="t" title={abs ? relText(ms, now) : absText(ms)} onClick={(e) => { e.stopPropagation(); setAbs((a) => !a); }}>{text}</button>;
}

const SEV_WORD = { ok: "ok", warn: "warn", bad: "bad", run: "run", idle: "idle" };
export const Dot = ({ s }) => <span className={`sd s-${SEV_WORD[s] || "idle"}`} aria-hidden="true" />;
export const Pill = ({ s, children }) => <span className={`pill s-${SEV_WORD[s] || "idle"}`}>{children}</span>;

export function TeamName({ id }) {
  const { teams } = useContext(Ctx);
  if (id == null) return <span className="teamname mono-dim">No team chosen</span>;
  const t = teams[id] || teams[String(id)];
  return <span className="teamname">{t ? t.name : `Team ${id}`}</span>;
}

const Sm = ({ sm }) => (sm ? <> <small>{sm}</small></> : null);

/** One value cell. A plain string or number is text; an object says what kind of value it is. */
export function Cell({ c }) {
  const { go } = useContext(Ctx);
  if (c == null) return <span>—</span>;
  if (typeof c === "string" || typeof c === "number") return <span>{c}</span>;
  switch (c.k) {
    case "time": return <><Time v={c.v} /><Sm sm={c.sm} /></>;
    case "at": return <><Time v={c.v} abs /><Sm sm={c.sm} /></>;
    case "bytes": return <><span className="t" title={`${num(c.v)} bytes`}>{bytes(c.v)}</span><Sm sm={c.sm} /></>;
    case "pill": return <><Pill s={c.s}>{c.v}</Pill><Sm sm={c.sm} /></>;
    case "code": return <><code>{c.v}</code><Sm sm={c.sm} /></>;
    case "tab": return <><button type="button" className="linkbtn" onClick={() => go(c.tab)}>{c.v}</button><Sm sm={c.sm} /></>;
    case "team": return <TeamName id={c.v} />;
    case "dot": return <><Dot s={c.s} />{c.v ? <> {c.v}</> : null}<Sm sm={c.sm} /></>;
    case "n": return <>{num(c.v)}<Sm sm={c.sm} /></>;
    case "pct": return <>{pct(c.v)}<Sm sm={c.sm} /></>;
    case "dur": return <>{dur(c.v)}<Sm sm={c.sm} /></>;
    case "sp": return <Spark values={c.v} />;
    case "redact": return <><span className="redact" aria-label="hidden">••••••</span><Sm sm={c.sm} /></>;
    case "mix": return <>{(c.v || []).map((x, i) => <React.Fragment key={i}><Cell c={x} />{i < c.v.length - 1 ? " " : null}</React.Fragment>)}</>;
    case "txt": return <><span className={c.c ? `c-${c.c}` : undefined}>{c.v}</span><Sm sm={c.sm} /></>;
    default: return <span>{String(c.v ?? "")}</span>;
  }
}

// ---------------------------------------------------------------- blocks

function KV({ items }) {
  return (
    <div className="kv">
      {(items || []).filter(Boolean).map(([k, v], i) => <div key={i}><span className="k">{k}</span><span className="v"><Cell c={v} /></span></div>)}
    </div>
  );
}

function Table({ cols, rows }) {
  const n = (cols || []).length;
  return (
    <div className="tbl">
      <ScrollBox>
        <table>
          <thead><tr>{(cols || []).map((c, i) => <th key={i} className={c[1] === "n" ? "n" : undefined}>{c[0]}</th>)}</tr></thead>
          <tbody>
            {(rows || []).map((r, i) => (r.line
              ? <tr key={i} className="cut"><td colSpan={n}><div className="cutline">{r.line}</div></td></tr>
              : <tr key={i} className={r.s || undefined}>{(r.c || []).map((c, j) => <td key={j} className={cols[j] && cols[j][1] === "n" ? "n" : undefined}><Cell c={c} /></td>)}</tr>))}
          </tbody>
        </table>
      </ScrollBox>
    </div>
  );
}

function Gauge({ g }) {
  const used = g.used == null ? 0 : g.used;
  const p = g.limit ? Math.min(1, used / g.limit) : 0;
  const cls = p > 0.9 ? " b" : p > 0.7 ? " w" : "";
  const r = g.reserved && g.limit ? Math.min(p, g.reserved / g.limit) : 0;
  const val = g.used == null ? "not known yet" : g.bytes ? `${bytes(used)} / ${bytes(g.limit)}` : `${num(used)} / ${num(g.limit)}`;
  return (
    <div className="g">
      <span className="gl">{g.label}</span><span className="gv">{val}</span>
      <div className="track">
        <div className={"fill" + cls} style={{ width: `${((p - r) * 100).toFixed(2)}%` }} />
        {r ? <div className="fill r" style={{ left: `${((p - r) * 100).toFixed(2)}%`, width: `${(r * 100).toFixed(2)}%` }} /> : null}
        {(g.caps || []).map(([f, label], i) => <div key={i} className="capmark" title={label} style={{ left: `${(f * 100).toFixed(1)}%` }} />)}
      </div>
      <div className="gs"><span>{pct(p)} {g.per || "today"}{g.est ? ", estimate" : ""}{g.note ? ` · ${g.note}` : ""}</span><Spark values={g.spark} /></div>
    </div>
  );
}

function Gauges({ b }) {
  const now = useNow();
  const any = (b.items || []).some((g) => g.reserved);
  return (
    <div>
      <div className="gauges">{(b.items || []).map((g, i) => <Gauge key={i} g={g} />)}</div>
      <div className="legend">
        <span><i className="sw9" style={{ background: "var(--acc)" }} />the site</span>
        {any ? <span><i className="sw9" style={{ background: "var(--blue)" }} />Fortune Teller builds</span> : null}
        {(b.items || []).some((g) => g.caps) ? <span><i className="sw9" style={{ borderLeft: "1px dashed var(--blue)" }} />caps: the log&apos;s 10%, Fortune Teller up to 50%</span> : null}
        {b.resetsAt ? <span>resets {relText(toMs(b.resetsAt), now)}</span> : null}
      </div>
    </div>
  );
}

function Bars({ items }) {
  return (
    <div className="bars">
      {(items || []).map((x, i) => (
        <div className="brow" key={i}>
          <span className="nm"><Cell c={x.l} /></span>
          <span className="btrack"><i className={x.s === "warn" ? "w" : ""} style={{ width: `${Math.min(100, (x.v / Math.max(1, x.max)) * 100).toFixed(1)}%` }} /></span>
          <span className="n"><Cell c={x.r} /></span>
        </div>
      ))}
    </div>
  );
}

function Cells({ items }) {
  return (
    <div className="cells" role="img" aria-label="One cell per minute, oldest first">
      {(items || []).map((c, i) => <span key={i} className={`cell ${c.s === "miss" ? "miss" : c.s === "none" ? "none" : ""}`} title={clockText(toMs(c.at))} />)}
    </div>
  );
}

function Attn({ items }) {
  const { jump } = useContext(Ctx);
  return (
    <ul className="attn">
      {(items || []).map((x, i) => (
        <li key={i}><Dot s={x.s} /><span>{x.text}{x.since ? <small> · since <Time v={x.since} /></small> : null}</span>
          {x.go ? <button className="mini" type="button" onClick={() => jump(x.go)}>Show</button> : <span />}</li>
      ))}
    </ul>
  );
}

function Seen() {
  const { markSeen } = useContext(Ctx);
  return <button className="btn" type="button" onClick={markSeen}>Mark everything as seen</button>;
}

// ---------------------------------------------------------------- the log

const sevDot = (s) => (s === "info" ? "idle" : s === "warn" ? "warn" : s === "bad" ? "bad" : s === "ok" ? "ok" : "idle");
const KIND = { visit: "visit", "sign-in": "sign-in", admin: "admin", operation: "operation", change: "change", status: "status" };

export function Feed({ items, compact, fresh }) {
  const { go, pages } = useContext(Ctx);
  const [openGrp, setOpenGrp] = useState({});
  const names = useMemo(() => new Map(pages || []), [pages]);
  if (!items || !items.length) return <div className="empty">Nothing in the log matches.</div>;
  const out = [];
  let day = "";
  for (const x of items) {
    const at = toMs(x.at);
    const dk = dayKey(at);
    if (!compact && dk !== day) { day = dk; out.push(<div className="day" key={`d${dk}`}>{dayName(at)}</div>); }
    const isFresh = fresh && fresh.has(x.id);
    if (x.kind === "status") {
      const rc = reportCounts(x.report);
      const open = openGrp[x.id];
      const toggle = () => setOpenGrp((o) => ({ ...o, [x.id]: !o[x.id] }));
      out.push(
        <div key={x.id} className={"ev grp" + (isFresh ? " fresh" : "")} role="button" tabIndex={0} aria-expanded={Boolean(open)}
          onClick={toggle} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}>
          <span className="tm" title={absText(at)}>{clockText(at)}</span><span className="sv"><Dot s={sevDot(x.sev)} /></span><span className="kd">status</span>
          <span className="tx">Hourly status, {hourSpan(toMs(x.hour))}: {rc.n} checks{rc.bad ? <>, <span className="c-bad">{rc.bad} failing</span></> : null}{rc.warn ? <>, <span className="c-warn">{rc.warn} {rc.warn === 1 ? "warning" : "warnings"}</span></> : null}{!rc.bad && !rc.warn ? ", all OK" : null} <span className="mono-dim">{open ? "▴" : "▾"}</span></span>
          <span className="who" />
        </div>);
      if (open) out.push(<div key={`${x.id}s`} className="subrep">{(x.report || []).map((r, i) => <div key={i}><Dot s={sevDot(r.sev)} /><b>{r.sub}</b><span>{r.text}</span></div>)}</div>);
    } else {
      out.push(
        <div key={x.id} className={"ev" + (isFresh ? " fresh" : "")}>
          <span className="tm" title={absText(at)}>{clockText(at)}</span><span className="sv"><Dot s={sevDot(x.sev)} /></span><span className="kd">{KIND[x.kind] || x.kind}</span>
          <span className="tx">{x.text}{x.n > 1 ? <span className="xn">×{num(x.n)}</span> : null}
            {x.page && !compact && names.has(x.page) ? <button className="linkbtn pg" type="button" onClick={() => go(x.page)}>{names.get(x.page)}</button> : null}</span>
          <span className="who">{x.kind === "change" || x.kind === "status" ? null : <TeamName id={x.team} />}</span>
        </div>);
    }
  }
  return <div className="feed">{out}</div>;
}

// ---------------------------------------------------------------- datasets

const STATE = { fresh: ["ok", "fresh"], resting: ["idle", "resting"], manual: ["idle", "manual"], kept: ["warn", "kept stale"], failing: ["bad", "failing"], missing: ["warn", "never fetched"], empty: ["idle", "empty"] };
const RANK = { bad: 4, warn: 3, run: 2, ok: 1, idle: 0 };
const ttlText = (t) => (!t ? "manual" : t >= 3600 ? `${t / 3600} h` : t >= 60 ? `${t / 60} min` : `${t} s`);
const COLS = [["Dataset", "key"], ["State", "state"], ["Newest", "age", "n"], ["Refresh interval", "ttl", "n"], ["Parts", "parts", "n"], ["Size", "size", "n"], ["Kind"], ["Tier", "tier"], ["Group", "group"]];

function DatasetDetail({ row }) {
  const { detail, cachedDetail, go, pages } = useContext(Ctx);
  const [d, setD] = useState(() => cachedDetail(row.key, row.newest));
  const [err, setErr] = useState(false);
  useEffect(() => {
    let live = true;
    detail(row.key, row.newest).then((x) => { if (live) setD(x); }).catch(() => { if (live) setErr(true); });
    return () => { live = false; };
  }, [row.key, row.newest, detail]);
  const names = new Map(pages || []);
  if (err) return <div className="empty">This dataset&apos;s detail could not be read just now.</div>;
  if (!d) return <div className="loading">Reading its last refresh and counters…</div>;
  const r = d.report, c = d.counters;
  const readers = d.readers || [];
  return (
    <div className="split">
      <div>
        <KV items={[
          ["Last refresh", r ? (r.ok ? { k: "mix", v: [{ k: "pill", s: "ok", v: "ok" }, { k: "time", v: r.startedAt }] } : { k: "mix", v: [{ k: "pill", s: "warn", v: "failed" }, { k: "time", v: r.startedAt }] }) : "no report yet"],
          ["Took", r ? { k: "dur", v: r.ms } : "—"],
          ["Parts", row.extra ? { k: "txt", v: `${row.stored} stored of ${row.parts}`, sm: `and ${row.extra} more: ${(row.extraParts || []).join(", ")}${row.extra > (row.extraParts || []).length ? ", …" : ""}` } : `${row.stored} stored of ${row.parts}`],
          row.derivedFrom ? ["Built from", { k: "code", v: row.derivedFrom }] : null,
          row.needs && row.needs.length ? ["Also needs", row.needs.join(", ")] : null,
          row.freshNeeds ? ["Must be current", row.freshNeeds.join(", ")] : null,
          row.targets && row.targets.length ? ["Builds", row.targets.join(", ")] : null,
          ["Read by", readers.length ? { k: "mix", v: readers.map((k) => ({ k: "tab", tab: k, v: names.get(k) || k })) } : "no page reads it directly"],
        ]} />
        {r && r.derived && r.derived.length ? <Table cols={[["Digest"], ["Size", "n"], ["Result"]]} rows={r.derived.map((x) => ({ c: [{ k: "code", v: x.target }, { k: "bytes", v: x.bytes }, x.error ? { k: "txt", v: x.error, c: "bad" } : "built"], s: x.error ? "bad" : null }))} /> : null}
      </div>
      <div>
        {c ? <KV items={[["Requests to its coordinator", { k: "n", v: c.requests }], ["Refreshes", { k: "n", v: c.sweeps }], ["Joined a refresh already running", { k: "n", v: c.coalesced }], ["Last refresh started", { k: "time", v: c.lastSweepAt }]]} /> : <div className="empty">No coordinator counters yet.</div>}
        {r && (r.parts || []).length ? <Table cols={[["Part"], ["Result"], ["HTTP", "n"], ["Time", "n"], ["Size", "n"]]}
          rows={r.parts.slice(0, 20).map((p) => ({ c: [p.part, p.action || "", p.status == null ? "—" : String(p.status), p.ms == null ? "—" : { k: "dur", v: p.ms }, p.bytes == null ? "—" : { k: "bytes", v: p.bytes }], s: p.action === "failed" ? "bad" : null }))} /> : null}
        {r && (r.parts || []).length > 20 ? <p className="note">and {r.parts.length - 20} more parts</p> : null}
      </div>
    </div>
  );
}

function Datasets({ b }) {
  const [sort, setSort] = useState(b.keepOrder ? { col: null, dir: 1 } : { col: "state", dir: -1 });
  const [f, setF] = useState({ group: "all", tier: "all", kind: "all", state: "all", q: "" });
  const [open, setOpen] = useState({});
  const [dep, setDep] = useState(false);
  const { detail } = useContext(Ctx);
  const warm = useRef(null);
  const now = useNow();
  const rows = b.rows || [];
  const groups = [...new Set(rows.map((r) => r.group))].filter(Boolean);
  const list = rows.filter((d) => (f.group === "all" || d.group === f.group) && (f.tier === "all" || d.tier === f.tier)
    && (f.kind === "all" || (f.kind === "derived") === Boolean(d.derivedFrom)) && (f.state === "all" || (STATE[d.state] || [])[1] === f.state)
    && (!f.q.trim() || d.key.includes(f.q.trim().toLowerCase()) || String(d.label || "").toLowerCase().includes(f.q.trim().toLowerCase())));
  const val = (d) => (sort.col === "age" ? (d.newest ? now - Date.parse(d.newest) : Infinity) : sort.col === "size" ? d.bytes : sort.col === "state" ? RANK[d.sev] : sort.col === "ttl" ? (d.ttl || 1e12) : sort.col === "parts" ? d.parts : String(d[sort.col] || ""));
  const sorted = sort.col ? list.slice().sort((a, c) => (val(a) > val(c) ? sort.dir : val(a) < val(c) ? -sort.dir : 0)) : list;
  const chip = (field, v, label) => <button key={field + v} className="chip" type="button" aria-pressed={f[field] === v} onClick={() => setF((x) => ({ ...x, [field]: v }))}>{label || v}</button>;
  const counts = { fresh: 0, rest: 0, trouble: 0 };
  for (const d of rows) { if (d.state === "fresh") counts.fresh++; else if (d.sev === "warn" || d.sev === "bad") counts.trouble++; else counts.rest++; }
  const n = COLS.length + (b.via ? 1 : 0);
  return (
    <div>
      {!b.via ? <KV items={[["Registered", { k: "n", v: rows.length, sm: b.param ? `plus ${b.param.length} on-demand types` : null }], ["Fresh", { k: "n", v: counts.fresh }], ["Resting or manual", { k: "n", v: counts.rest }],
        ["In trouble", counts.trouble ? { k: "txt", v: String(counts.trouble), c: "warn" } : "0"], ["Derived digests", { k: "n", v: rows.filter((r) => r.derivedFrom).length }], ["Stored", { k: "bytes", v: rows.reduce((a, d) => a + (d.bytes || 0), 0) }]]} /> : null}
      {!b.via ? <>
        <div className="filters" style={{ marginTop: 12 }}>
          <input type="search" placeholder="Search datasets" value={f.q} onChange={(e) => setF((x) => ({ ...x, q: e.target.value }))} aria-label="Search datasets" />
          <button className="btn" type="button" onClick={() => setDep((v) => !v)}>{dep ? "Hide" : "Show"} dependency diagram</button>
        </div>
        <div className="chips">{chip("group", "all", "all groups")}{groups.map((g) => chip("group", g))}</div>
        <div className="chips">{chip("tier", "all", "all tiers")}{["core", "aux", "probe"].map((g) => chip("tier", g))}
          {chip("kind", "all", "raw and derived")}{chip("kind", "raw")}{chip("kind", "derived")}
          {chip("state", "all", "any state")}{["fresh", "resting", "manual", "kept stale", "failing", "never fetched"].map((g) => chip("state", g))}</div>
        {dep ? <DepDiagram rows={rows} /> : null}
      </> : null}
      <div className="tbl" style={{ marginTop: b.via ? 0 : 10 }}>
        <ScrollBox>
          <table>
            <thead><tr>
              {COLS.map((c, i) => {
                const th = c[1] ? <th key={c[0]} className={"sort" + (c[2] ? " n" : "")} onClick={() => setSort((s) => ({ col: c[1], dir: s.col === c[1] ? -s.dir : 1 }))}>{c[0]}{sort.col === c[1] ? <span className="arr">{sort.dir > 0 ? "↑" : "↓"}</span> : null}</th> : <th key={c[0]}>{c[0]}</th>;
                return i === 2 && b.via ? [<th key="via">How it is used</th>, th] : th;
              })}
            </tr></thead>
            <tbody>
              {sorted.map((d) => {
                const [sev, label] = STATE[d.state] || ["idle", d.state];
                const isOpen = open[d.key];
                return (
                  <React.Fragment key={d.key}>
                    <tr className={"click " + (sev === "bad" ? "bad" : sev === "warn" ? "warn" : "")} aria-expanded={Boolean(isOpen)} tabIndex={0}
                      onClick={() => setOpen((o) => ({ ...o, [d.key]: !o[d.key] }))}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => ({ ...o, [d.key]: !o[d.key] })); } }}
                      onPointerEnter={() => { clearTimeout(warm.current); warm.current = setTimeout(() => detail(d.key, d.newest).catch(() => {}), 120); }}
                      onPointerLeave={() => clearTimeout(warm.current)}
                      onFocus={() => detail(d.key, d.newest).catch(() => {})}>
                      <td><span className="key">{d.key}</span><span className="lbl">{d.label}</span>{d.error ? <span className="lbl c-warn">{d.error}</span> : null}</td>
                      <td><Pill s={sev}>{label}</Pill></td>
                      {b.via ? <td className="nw mono-dim">{d.via}</td> : null}
                      <td className="n">{d.newest ? <Time v={d.newest} /> : "—"}</td>
                      <td className="n">{ttlText(d.ttl)}</td>
                      <td className="n">{d.stored}/{d.parts}{d.extra ? <span className="lbl" title={(d.extraParts || []).join(", ")}>+{d.extra} more</span> : null}</td>
                      <td className="n"><span className="t" title={`${num(d.bytes)} bytes`}>{bytes(d.bytes)}</span></td>
                      <td className="nw">{d.derivedFrom ? "derived" : "raw"}{d.auth ? ", signed in" : ""}</td>
                      <td className="nw">{d.tier}</td><td className="nw">{d.group}</td>
                    </tr>
                    {isOpen ? <tr className="detail"><td colSpan={n}><DatasetDetail row={d} /></td></tr> : null}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </ScrollBox>
      </div>
      {!sorted.length ? <div className="empty" style={{ marginTop: 8 }}>No dataset matches these filters.</div> : null}
      {!b.via ? <p className="note">Resting means older than its refresh interval because nothing has read it since; the next page that reads it refreshes it first. That is normal and never a fault. Tap a row for its last refresh, its coordinator counters and which pages read it.</p> : null}
      {!b.via && b.param && b.param.length ? <p className="note">On-demand types, stored only when a page asks: {b.param.map((p) => `${p.key} (${num(p.ids)} stored, ${bytes(p.bytes)})`).join(", ")}.</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------- the dispatcher

export function Block({ b }) {
  const { go } = useContext(Ctx);
  if (!b) return null;
  switch (b.t) {
    case "kv": return <KV items={b.items} />;
    case "table": return <Table cols={b.cols} rows={b.rows} />;
    case "note": return <p className="note">{b.v}</p>;
    case "sub": return <span className="sub2">{b.v}</span>;
    case "empty": return <div className="empty">{b.v}</div>;
    case "checks": return <ul className="checks">{(b.items || []).map(([ok, text], i) => <li key={i} className={ok ? "" : "x"}>{text}</li>)}</ul>;
    case "list": return <ul className="plain">{(b.items || []).map((x, i) => <li key={i}>{x}</li>)}</ul>;
    case "bars": return <Bars items={b.items} />;
    case "split": return <div className="split"><div><Blocks list={b.a} /></div><div><Blocks list={b.b} /></div></div>;
    case "progress": return <div className={`progress s-${b.s || "run"}`}><i style={{ width: `${Math.max(0, Math.min(100, (b.v || 0) * 100)).toFixed(1)}%` }} /></div>;
    case "btn": return <div><button className="mini" type="button" onClick={() => go(b.tab, b.page)}>{b.v}</button></div>;
    case "attn": return <Attn items={b.items} />;
    case "seen": return <Seen />;
    case "gauges": return <Gauges b={b} />;
    case "feed": return <Feed items={b.items} compact={b.compact} />;
    case "traffic": return <TrafficChart hours={b.hours} pages={b.pages} />;
    case "datasets": return <Datasets b={b} />;
    case "cells": return <Cells items={b.items} />;
    case "heat": return <Heat days={b.days} times={b.times} />;
    case "slices": return <Slices v={b.v} />;
    default: return null;
  }
}

export function Blocks({ list }) {
  return <>{(list || []).map((b, i) => <Block key={i} b={b} />)}</>;
}

export { KV, Heartbeat };
