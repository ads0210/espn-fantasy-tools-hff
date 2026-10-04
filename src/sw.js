/**
 * The browser helper (C6): a service worker, the browser's own offline helper, installed quietly on a member's
 * visit. It lets every request pass untouched except page loads, and when a page load comes back as Cloudflare's
 * limit page (no marker from the site, and error 1027) it shows the site's own resting page instead, kept in the
 * browser with no league data in it. It helps only browsers that have visited before.
 *
 * The kill switch: with SW_ON false, /sw.js serves a worker that removes itself and its cache. Browsers check for a
 * new /sw.js at least once a day, so a helper that ever misbehaves is gone within about a day of the switch.
 */
import { MARK_HEADER } from './pages/limitnotice.js';

export const SW_ON = true;
const CACHE = 'eft-rest-v1';
export const RESTING_PATH = '/sw-resting.html';

/** The helper itself. Page loads only; any failure of its own falls back to the answer as it came. */
export const SW_JS = `/* ESPN Fantasy Tools: the browser helper. Shows the site's own resting page when Cloudflare's daily limit page arrives. */
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open('${CACHE}').then(function (c) { return c.add('${RESTING_PATH}'); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== '${CACHE}'; }).map(function (k) { return caches.delete(k); })); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.mode !== 'navigate' || req.method !== 'GET') return;
  e.respondWith(fetch(req).then(function (res) {
    if (res.headers.get('${MARK_HEADER}') || res.status < 400) return res;
    return res.clone().text().then(function (t) {
      if (!/\\b1027\\b/.test(t)) return res;
      return caches.match('${RESTING_PATH}').then(function (rest) { return rest || res; });
    }).catch(function () { return res; });
  }));
});
`;

/** The kill switch: a worker that removes itself and everything it kept. */
export const KILL_JS = `/* ESPN Fantasy Tools: the browser helper, switched off. It removes itself. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); })
    .then(function () { return self.registration.unregister(); }));
});
`;

export function swScript() { return SW_ON ? SW_JS : KILL_JS; }

/**
 * The site's own resting page: no league data, no outside fetch, the time it wakes in the reader's own time.
 * `reason` is 'worker' (shown by the helper in place of Cloudflare's page) or 'kv' (served by the site itself when
 * the day's settings reads are spent and this isolate holds no settings). Live scores are said to keep recording
 * only where the backend clock does the minute's work (C5), since only then does the backend need no Worker request.
 */
export function restingPage(reason = 'worker', { clockOn = false } = {}) {
  const what = reason === 'kv'
    ? 'The site has used today’s free allowance of settings reads, so it can’t open this page right now.'
    : 'The site has reached Cloudflare’s free daily limit, so pages can’t load right now.';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Resting until midnight UTC</title>
<style>
  :root { color-scheme: dark; --bg:#0A0D0B; --panel:#121714; --ink:#DCEFDD; --ink2:#96A599; --accent:#63FF4A; --signal:#FFB020; }
  html, body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
  main { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px 16px; box-sizing:border-box; }
  section { max-width:520px; text-align:center; background:var(--panel); border:1px solid #252C26; border-top:2px solid var(--signal); padding:28px 22px; }
  .eyebrow { font-size:11px; font-weight:900; letter-spacing:.16em; text-transform:uppercase; color:var(--signal); margin:0 0 8px; }
  h1 { font-size:24px; margin:0 0 12px; letter-spacing:-.01em; }
  p { margin:0 0 10px; color:var(--ink2); }
  b { color:var(--ink); }
  button { margin-top:12px; background:none; color:var(--accent); border:1px solid var(--accent); padding:9px 16px; font:inherit; font-weight:800; cursor:pointer; }
</style></head>
<body><main><section>
  <p class="eyebrow">Resting</p>
  <h1>Back at <b id="t">midnight UTC</b></h1>
  <p>${what}</p>
  <p>It wakes at 00:00 UTC, <b id="t2">midnight UTC</b> where you are.${clockOn ? ' Live scores keep being recorded while pages rest.' : ''}</p>
  <button type="button" onclick="location.reload()">Try again</button>
</section></main>
<script>
  try {
    var mid = Math.floor(Date.now() / 86400000) * 86400000 + 86400000;
    var m = document.cookie.match(/(?:^|; )eft_tz=([^;]*)/);
    var tz = m ? decodeURIComponent(m[1]) : undefined;
    var s = new Date(mid).toLocaleTimeString(undefined, { timeZone: tz, hour: 'numeric', minute: '2-digit' });
    document.getElementById('t').textContent = s;
    document.getElementById('t2').textContent = s;
  } catch (e) { /* the page still says midnight UTC */ }
</script>
</body></html>`;
}
