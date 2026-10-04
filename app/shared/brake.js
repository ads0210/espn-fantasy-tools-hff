/**
 * The brake (C5), as a page sees it. As one of the site's free daily limits fills, every answer the site gives a
 * page carries `X-Brake: economy` (from 60% of a limit) or `X-Brake: protect` (from 80%), and the page asks less
 * often until the answers stop carrying it: every minute while something is live (a game, the league's draft) and
 * every 5 minutes otherwise at Economy, every 5 minutes at Protect. The backend never slows; only the pages do.
 *
 * The rule itself is src/budget.js pollSecsFor(), so the server pages (src/pages/poller.js) and the React tools
 * keep to the same figures.
 */
import { pollSecsFor } from "../../src/budget.js";

let level = "normal";

/** Read the brake from an answer the site gave this page. Returns the level now in force. */
export function noteBrake(res) {
  // Cloudflare's own limit page, or a limit the site names (C6): the page keeps what it shows and says so.
  try { if (typeof window !== "undefined" && window.__eftLimit) window.__eftLimit.check(res); } catch { /* nothing */ }
  try {
    const b = res && res.headers && typeof res.headers.get === "function" ? res.headers.get("x-brake") : null;
    level = b === "economy" || b === "protect" || b === "limit" ? b : "normal";
  } catch { /* an answer without headers changes nothing */ }
  return level;
}

export function brakeLevel() { return level; }

/** How long to wait before asking again: the page's own interval, or longer while the brake is on. */
export function pollDelay(baseMs, { live = false, backstage = false } = {}) {
  // Resting at Cloudflare's daily limit: nothing is asked until a minute past midnight UTC (C6).
  try { if (typeof window !== "undefined" && window.__eftLimit && window.__eftLimit.resting()) return Math.max(baseMs, window.__eftLimit.wakeIn()); } catch { /* nothing */ }
  const s = pollSecsFor(level, { live, backstage });
  return s ? Math.max(baseMs, s * 1000) : baseMs;
}
