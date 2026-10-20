/**
 * Week 6 (plan P3): browser error reports in the site log.
 *
 * Every page (server pages through SHARED_JS, the tools through their shell) installs one small listener for script
 * errors and unhandled promise rejections. A page reports at most three distinct errors per load, as the allow-listed
 * client event `page-error`, carrying only: which page, which kind, the error's type and a short scrubbed message,
 * and the file and line it came from. The server scrubs again (a browser is never trusted), names the page from its
 * own list, drops a repeat of the same report within ten minutes in that isolate, and records it as a warning of
 * kind `error`. The log object's 60-a-minute cap on browser events still applies.
 *
 * Scrubbing keeps a report general: quoted text, long digit runs, and any run of 12 or more letters, digits, `_`
 * or `-` (the shape of a key, a token or an id) become `…`; a report never carries a query string or a value.
 *
 * Like src/pages/limitnotice.js, the client code is a literal string, never a function sent with .toString().
 */

/** The longest message kept. */
export const ERROR_TEXT_MAX = 100;

/** A message or a location made general: no quoted values, no long ids, no addresses' queries. */
export function scrubError(s, max = ERROR_TEXT_MAX) {
  let t = String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]+/g, ' ');
  t = t.replace(/\?[^\s)]*/g, '');                                   // query strings
  t = t.replace(/(["'`])(?:(?!\1).){0,200}\1/g, '…');                 // quoted text
  t = t.replace(/[A-Za-z0-9_-]{12,}/g, (w) => (/^[A-Za-z]+$/.test(w) && w.length < 24 ? w : '…')); // ids, keys, tokens
  t = t.replace(/\d{4,}/g, '…');                                      // long numbers
  t = t.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** Just the file of a script location, with its line and column: "bundle.js:1:2345". */
export function scrubWhere(file, line, col) {
  const f = String(file || '').split(/[?#]/)[0].split('/').filter(Boolean).pop() || '';
  const name = /^[A-Za-z0-9_.-]{1,40}$/.test(f) ? f : f ? 'script' : '';
  const ln = Number(line) > 0 ? `:${Math.floor(Number(line))}` : '', cl = ln && Number(col) > 0 ? `:${Math.floor(Number(col))}` : '';
  return name ? `${name}${ln}${cl}` : '';
}

/** The text the log stores for one report. */
export function errorText(pageName, body) {
  const kind = body && body.kind === 'promise' ? 'an unhandled promise rejection' : 'a script error';
  const what = scrubError(body && body.what);
  // Only ever a plain "file:line:col"; anything else (an encoded path, an evaluated snippet) is left out.
  const w = String((body && body.where) || '');
  const where = /^[A-Za-z0-9_.-]{1,40}(:\d{1,7}){0,2}$/.test(w) ? w : '';
  return `A browser hit ${kind} on ${pageName}${what ? `: ${what}` : ''}${where ? ` (${where})` : ''}`.slice(0, 160);
}

export const ERROR_JS = `
(function () {
  if (window.__eftErr) return; window.__eftErr = true;
  if (location.protocol === 'file:') return;
  var sent = {}, n = 0;
  function pageKey() {
    var p = location.pathname;
    if (p.indexOf('/apps/') === 0) return p.split('/')[2] || 'other';
    if (p === '/' || p === '') return 'home';
    if (p.indexOf('/config') === 0) return 'config';
    if (p.indexOf('/setup') === 0) return 'wizard';
    if (p.indexOf('/login') === 0) return 'signin';
    return 'other';
  }
  function where(file, line, col) {
    var f = String(file || '').split('?')[0].split('#')[0].split('/').pop() || '';
    return f ? f + (line ? ':' + line + (col ? ':' + col : '') : '') : '';
  }
  function report(kind, what, at) {
    try {
      var key = kind + '|' + what + '|' + at;
      if (sent[key] || n >= 3) return;
      sent[key] = 1; n++;
      fetch('/api/site-log/event', { method: 'POST', credentials: 'same-origin', keepalive: true,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'page-error', page: pageKey(), kind: kind, what: String(what || '').slice(0, 300), where: at }) })
        .catch(function () {});
    } catch (e) { /* reporting must never matter */ }
  }
  window.addEventListener('error', function (e) {
    if (!e || !e.error && !e.message) return;          // a failed image or stylesheet is not a script error
    var err = e.error, what = err && err.name ? err.name + ': ' + (err.message || '') : String(e.message || '');
    if (what === 'Script error.' || what === 'Script error') return;  // another origin's script: nothing to read
    report('script', what, where(e.filename, e.lineno, e.colno));
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason, what = r && r.name ? r.name + ': ' + (r.message || '') : String(r);
    if (r && r.name === 'AbortError') return;          // a request the page itself cancelled
    report('promise', what, '');
  });
})();
`;
