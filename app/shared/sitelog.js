/**
 * Tell the site log about something only the browser knows happened: a share link
 * written to the clipboard, an export copied or downloaded. One allow-listed name,
 * nothing else; the server refuses anything off its list. Never waits, never throws.
 */
export function logEvent(name) {
  try {
    if (typeof fetch !== "function" || typeof location === "undefined" || location.protocol === "file:") return;
    fetch("/api/site-log/event", {
      method: "POST", credentials: "same-origin", keepalive: true,
      headers: { "content-type": "application/json" }, body: JSON.stringify({ name }),
    }).catch(() => {});
  } catch { /* recording must never matter */ }
}
