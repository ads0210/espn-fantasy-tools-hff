/**
 * Week 6 (plan P9, PD31, PD41, PD42): a note from the Site Admin.
 *
 * The note's body is stored as a small markup the Site Configuration panel writes, never as HTML, and rendered with
 * escaping first, so a note cannot carry a script:
 *
 *   **bold**   *italic*   {gold:coloured words}   [words](fortune-teller)
 *
 * Colours are the site's own set only (PD42), drawn from its tokens so they follow the theme; a link may point only
 * at one of the site's own pages (by key), and a key the site does not know leaves the words plain. Blank lines start
 * a paragraph; a single line break stays a line break.
 *
 * The server renders the note for the home page with these functions; the panel's live preview runs the same rules
 * from NOTE_JS, a literal script (never a function sent with .toString()). A test renders a set of notes through both
 * and requires the same HTML.
 */
import { TOOLS } from './tools.js';

export const NOTE_COLOURS = { green: '--accent', red: '--flag', amber: '--signal', blue: '--sky', gold: '--gold' };
export const NOTE_LIMITS = { subject: 80, body: 2000, sig: 40, sigs: 8 };
export const DEFAULT_SIGS = ['- Site admin'];

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/** The pages a note may link to: Home and every league tool (Site Backend is for the administrator alone). */
export function notePages(tools = TOOLS) {
  const out = { home: { href: '/', name: 'Home' } };
  for (const t of tools) if (!t.backstage) out[t.key] = { href: t.href, name: t.name };
  return out;
}

function inline(text, pages) {
  let s = esc(text);
  s = s.replace(/\[([^\]\n]{1,200})\]\(([a-z-]{1,40})\)/g, (m, words, key) => (Object.prototype.hasOwnProperty.call(pages, key) ? `<a href="${esc(pages[key].href)}" class="notelink">${words}</a>` : words));
  s = s.replace(/\{(green|red|amber|blue|gold):([^}\n]{1,400})\}/g, (m, c, words) => `<span class="nc nc-${c}">${words}</span>`);
  s = s.replace(/\*\*([^*\n]{1,400})\*\*/g, (m, w) => `<strong>${w}</strong>`);
  s = s.replace(/(^|[^*])\*([^*\n]{1,400})\*(?!\*)/g, (m, pre, w) => `${pre}<em>${w}</em>`);
  return s;
}

/** The body as HTML, escaped first. */
export function renderNote(markup, pages = notePages()) {
  return String(markup || '').replace(/\r\n?/g, '\n').trim().split(/\n\s*\n/).filter(Boolean)
    .map((p) => `<p>${p.split('\n').map((l) => inline(l, pages)).join('<br>')}</p>`).join('');
}

/** What a toolbar button does to the selected words of the textarea. */
export function wrapSelection(value, start, end, kind, arg) {
  const sel = value.slice(start, end) || 'words';
  const wrapped = kind === 'bold' ? `**${sel}**` : kind === 'italic' ? `*${sel}*`
    : kind === 'colour' ? `{${arg}:${sel}}` : kind === 'link' ? `[${sel}](${arg})` : sel;
  return { value: value.slice(0, start) + wrapped + value.slice(end), start, end: start + wrapped.length };
}

/** A note as stored, made safe and whole, or null. */
export function cleanNote(n) {
  if (!n || typeof n !== 'object') return null;
  const subject = String(n.subject || '').trim().slice(0, NOTE_LIMITS.subject);
  const body = String(n.body || '').replace(/\r\n?/g, '\n').trim().slice(0, NOTE_LIMITS.body);
  if (!subject || !body) return null;
  return { id: String(n.id || '').replace(/[^0-9a-z]/g, '').slice(0, 16) || null, subject, body,
    sig: String(n.sig || '').trim().slice(0, NOTE_LIMITS.sig), at: typeof n.at === 'string' ? n.at : null };
}

/** The saved signatures, or the starting list. */
export function cleanSigs(list) {
  const out = (Array.isArray(list) ? list : []).map((s) => String(s || '').trim().slice(0, NOTE_LIMITS.sig)).filter(Boolean).slice(0, NOTE_LIMITS.sigs);
  return out.length ? out : DEFAULT_SIGS.slice();
}

/** What the home page receives: the note rendered, or null. */
export function noteForBoard(note, pages = notePages()) {
  const n = cleanNote(note);
  return n && n.id ? { id: n.id, subject: n.subject, html: renderNote(n.body, pages), sig: n.sig } : null;
}

/* The same rules for the browser (Site Configuration's preview and toolbar). String.raw keeps every backslash. */
export const NOTE_JS = String.raw`
var NOTE_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function noteEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return NOTE_ESC[c]; }); }
function noteInline(text, pages) {
  var s = noteEsc(text);
  s = s.replace(/\[([^\]\n]{1,200})\]\(([a-z-]{1,40})\)/g, function (m, words, key) { return Object.prototype.hasOwnProperty.call(pages, key) ? '<a href="' + noteEsc(pages[key].href) + '" class="notelink">' + words + '</a>' : words; });
  s = s.replace(/\{(green|red|amber|blue|gold):([^}\n]{1,400})\}/g, function (m, c, words) { return '<span class="nc nc-' + c + '">' + words + '</span>'; });
  s = s.replace(/\*\*([^*\n]{1,400})\*\*/g, function (m, w) { return '<strong>' + w + '</strong>'; });
  s = s.replace(/(^|[^*])\*([^*\n]{1,400})\*(?!\*)/g, function (m, pre, w) { return pre + '<em>' + w + '</em>'; });
  return s;
}
function renderNote(markup, pages) {
  return String(markup || '').replace(/\r\n?/g, '\n').trim().split(/\n\s*\n/).filter(Boolean)
    .map(function (p) { return '<p>' + p.split('\n').map(function (l) { return noteInline(l, pages); }).join('<br>') + '</p>'; }).join('');
}
function wrapSelection(value, start, end, kind, arg) {
  var sel = value.slice(start, end) || 'words';
  var wrapped = kind === 'bold' ? '**' + sel + '**' : kind === 'italic' ? '*' + sel + '*'
    : kind === 'colour' ? '{' + arg + ':' + sel + '}' : kind === 'link' ? '[' + sel + '](' + arg + ')' : sel;
  return { value: value.slice(0, start) + wrapped + value.slice(end), start: start, end: start + wrapped.length };
}
`;

/** The note's colours and links, for the home page's popup and the panel's preview. */
export const NOTE_CSS = `
.notebody p { margin:0 0 10px; font-size:14px; line-height:1.6; color:var(--ink); }
.notebody strong { font-weight:900; }
.notebody .notelink { color:var(--sky); font-weight:800; text-decoration:underline; text-underline-offset:2px; }
.nc-green { color:var(--accent); } .nc-red { color:var(--flag); } .nc-amber { color:var(--signal); } .nc-blue { color:var(--sky); } .nc-gold { color:var(--gold); }
.notesig { margin:4px 0 14px; font-size:14px; font-weight:800; color:var(--ink-2); }
`;
