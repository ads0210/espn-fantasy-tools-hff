/**
 * Site Backend's formatting: times in the reader's chosen zone, sizes, counts and
 * durations. A plain module so it is tested by behaviour.
 */

const nf = new Intl.NumberFormat("en-US");

export function num(n) {
  return n == null || !Number.isFinite(Number(n)) ? "—" : nf.format(Math.round(Number(n)));
}

export function bytes(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0, v = Number(n);
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return (i ? v.toFixed(v < 10 ? 2 : 1) : String(Math.round(v))) + " " + u[i];
}

export function pct(v, digits = 1) {
  if (v == null || !Number.isFinite(Number(v))) return "—";
  const p = Number(v) * 100;
  const d = p > 0 && p < 0.1 ? 2 : digits;
  // Half up, the same rule as the home page's and Fortune Teller's: toFixed alone rounds whatever the float holds.
  const k = 10 ** (d + 2);
  return (Math.round(Number(v) * k + 1e-6) / (k / 100)).toFixed(d) + "%";
}

export function dur(ms) {
  if (ms == null || !Number.isFinite(Number(ms))) return "—";
  const v = Number(ms);
  if (v < 1000) return Math.round(v) + " ms";
  if (v < 60000) return (v / 1000).toFixed(v < 10000 ? 2 : 1) + " s";
  if (v < 3600000) return Math.floor(v / 60000) + "m " + Math.round((v % 60000) / 1000) + "s";
  return Math.floor(v / 3600000) + "h " + Math.round((v % 3600000) / 60000) + "m";
}

/** How long ago (or how long until), short: "42s ago", "3h 5m ago", "in 12m". */
export function relText(ms, now = Date.now()) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  let d = Math.round((now - ms) / 1000);
  const future = d < 0;
  d = Math.abs(d);
  let s;
  if (d < 60) s = d + "s";
  else if (d < 3600) s = Math.floor(d / 60) + "m";
  else if (d < 86400) {
    const h = Math.floor(d / 3600), m = Math.floor((d % 3600) / 60);
    s = h + "h" + (h < 10 && m ? " " + m + "m" : "");
  } else s = Math.floor(d / 86400) + "d";
  return future ? "in " + s : s + " ago";
}

function deviceZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
}

let ZONE = null;
export function readZone() {
  try {
    const m = /(?:^|; )eft_tz=([^;]*)/.exec(typeof document !== "undefined" ? document.cookie : "");
    const z = m ? decodeURIComponent(m[1]) : "";
    return z && z !== "device" ? z : deviceZone();
  } catch { return deviceZone(); }
}
export function setZone(z) { ZONE = z || null; FMT.clear(); }
export function zone() { return ZONE || readZone(); }

const FMT = new Map();
function fmt(opts) {
  const z = zone();
  const k = z + JSON.stringify(opts);
  if (!FMT.has(k)) {
    let f;
    try { f = new Intl.DateTimeFormat("en-US", { timeZone: z, ...opts }); } catch { f = new Intl.DateTimeFormat("en-US", opts); }
    FMT.set(k, f);
  }
  return FMT.get(k);
}

export const absText = (ms) => fmt({ weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit", timeZoneName: "short" }).format(ms);
export const clockText = (ms) => fmt({ hour: "numeric", minute: "2-digit", second: "2-digit" }).format(ms);
/** An hour as the span it covers: "2:00–3:00 AM", or "11:00 AM–12:00 PM" across noon. */
export function hourSpan(ms) {
  const f = fmt({ hour: "numeric", minute: "2-digit" });
  const a = f.format(ms), b = f.format(ms + 3600000);
  const sa = a.slice(-2), sb = b.slice(-2);
  return sa === sb ? `${a.slice(0, -3)}–${b}` : `${a}–${b}`;
}
/** An hourly report's headline counts: problems only, "failing" before "warning". */
export function reportCounts(report) {
  const bad = (report || []).filter((r) => r.sev === "bad").length;
  const warn = (report || []).filter((r) => r.sev === "warn").length;
  return { n: (report || []).length, bad, warn };
}
export const shortText = (ms) => fmt({ month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(ms);
export const dayName = (ms) => fmt({ weekday: "long", month: "long", day: "numeric" }).format(ms);
export const dayKey = (ms) => fmt({ year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);
export const hourOfDay = (ms) => Number(fmt({ hour: "numeric", hourCycle: "h23" }).format(ms)) % 24;
export const axisText = (ms) => fmt({ weekday: "short", hour: "numeric" }).format(ms);

/** Midnight today in the chosen zone, as an instant: "today" on every panel starts here. */
export function localMidnight(now = Date.now()) {
  const parts = fmt({ hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23" }).formatToParts(now);
  const get = (t) => Number((parts.find((p) => p.type === t) || { value: 0 }).value) || 0;
  const since = (((get("hour") % 24) * 60 + get("minute")) * 60 + get("second")) * 1000;
  return Math.floor((now - since) / 1000) * 1000;
}

export const toMs = (v) => (v == null ? null : typeof v === "number" ? v : Date.parse(v));
