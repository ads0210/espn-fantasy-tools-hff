/**
 * Telling members when a free limit is reached (C6).
 *
 * Every answer the site gives carries its own marker header (x-eft). Cloudflare's refusal at the daily Worker
 * request limit (error 1027) comes from Cloudflare, before the site's code runs, so it carries no marker: a page that
 * gets an error without the marker whose body names 1027 knows the site is resting. It keeps what it shows, puts the
 * site's notice at the top, stops asking until a minute past 00:00 UTC (spread by a few random seconds, so every page
 * does not come back at once), and when the site answers again it reports that it saw the refusal, so the site's
 * record holds the first real cutoff exactly.
 *
 * Limits the site's code still runs past (Durable Object requests, KV) are announced by the site itself: an answer
 * carrying `x-limit` names the limit reached, and the page shows that limit's notice.
 *
 * Like src/vscroll.js, the client code is a literal string, installed once per page, never a function sent with
 * .toString().
 */
export const MARK_HEADER = 'x-eft';

/** What a member reads, by limit. {until} is the reset time in the reader's zone. */
export const LIMIT_COPY = {
  worker: 'The site has reached Cloudflare’s free daily limit and is resting until {until} (00:00 UTC). What you see was current at {asof}. This page will pick up again by itself.',
  doReq: 'The site has used today’s free allowance of Durable Object requests, so pages show what is stored and signing in may be refused until {until} (00:00 UTC).',
  rowsW: 'The site has used today’s free allowance of stored writes, so pages show what is stored and some changes wait until {until} (00:00 UTC).',
  kvR: 'The site has used today’s free allowance of settings reads, so some pages may rest until {until} (00:00 UTC).',
  kvW: 'The site has used today’s free allowance of settings writes, so saving settings waits until {until} (00:00 UTC). Everything else carries on.',
};

/** The home page's warning before the daily Worker request limit, from Protect on that limit. */
export function busyWarning(clockOn) {
  return 'The site is very busy today. If it reaches Cloudflare’s free daily limit, pages may stop loading until {until} (00:00 UTC).'
    + (clockOn ? ' Live scores keep being recorded either way.' : '');
}

/** Whether an answer is Cloudflare's own refusal at the daily limit: no marker from the site, an error, and 1027. */
export function isCloudflareLimit(status, headers, bodyText) {
  const get = (k) => (headers && typeof headers.get === 'function' ? headers.get(k) : headers && headers[k]);
  if (get(MARK_HEADER)) return false;
  if (!(status >= 400)) return false;
  return /\b1027\b/.test(String(bodyText || ''));
}

export const LIMIT_JS = `
(function () {
  if (window.__eftLimit) return;
  var COPY = ${JSON.stringify(LIMIT_COPY)};
  var state = { resting: false, until: 0, seen: 0, lastGood: Date.now(), shown: null };
  var zone = function () { try { var m = document.cookie.match(/(?:^|; )eft_tz=([^;]*)/); return m ? decodeURIComponent(m[1]) : undefined; } catch (e) { return undefined; } };
  var clock = function (ms) { try { return new Date(ms).toLocaleTimeString(undefined, { timeZone: zone(), hour: 'numeric', minute: '2-digit' }); } catch (e) { return new Date(ms).toISOString().slice(11, 16) + ' UTC'; } };
  var midnight = function (now) { return Math.floor(now / 86400000) * 86400000 + 86400000; };
  function bar() {
    var b = document.getElementById('eftlimit');
    if (b) return b;
    b = document.createElement('div');
    b.id = 'eftlimit';
    b.setAttribute('role', 'status');
    b.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:2147483000;padding:12px 16px;font:600 13px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;'
      + 'color:var(--ink,#DCEFDD);background:var(--panel,#121714);border-bottom:2px solid var(--signal,var(--amber,#FFB020));box-shadow:0 6px 18px rgba(0,0,0,.35);text-align:center;';
    document.body.appendChild(b);
    return b;
  }
  function show(key) {
    var text = (COPY[key] || COPY.worker).split('{until}').join(clock(midnight(Date.now()))).split('{asof}').join(clock(state.lastGood));
    if (state.shown === text) return;
    state.shown = text;
    bar().textContent = text;
  }
  function hide() { var b = document.getElementById('eftlimit'); if (b) b.remove(); state.shown = null; }
  function rest() {
    if (state.resting) return;
    var now = Date.now();
    state.resting = true;
    state.seen = now;
    state.until = midnight(now) + 60000 + Math.floor(Math.random() * 30000);
    show('worker');
  }
  function recover() {
    var seen = state.seen;
    state.resting = false;
    hide();
    try {
      fetch('/api/site-log/event', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'limit-seen', at: seen }) }).catch(function () {});
    } catch (e) { /* the page carries on */ }
  }
  window.__eftLimit = {
    check: function (res) {
      try {
        if (!res || !res.headers) return Promise.resolve(false);
        if (res.headers.get('${MARK_HEADER}')) {
          if (state.resting) recover();
          var lim = res.headers.get('x-limit');
          if (lim && COPY[lim]) show(lim); else if (state.shown && !state.resting) hide();
          if (res.ok) state.lastGood = Date.now();
          return Promise.resolve(false);
        }
        if (res.status < 400) return Promise.resolve(false);
        return res.clone().text().then(function (t) {
          if (/\\b1027\\b/.test(t)) { rest(); return true; }
          return false;
        }).catch(function () { return false; });
      } catch (e) { return Promise.resolve(false); }
    },
    resting: function () { return state.resting && Date.now() < state.until; },
    wakeIn: function () { return Math.max(0, state.until - Date.now()); },
  };
  /* The browser helper (C6): installed quietly, it shows the site's own resting page in place of Cloudflare's limit
     page on a later visit. Every other request passes through it untouched. */
  try { if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function () {}); } catch (e) { /* nothing */ }
})();
`;
