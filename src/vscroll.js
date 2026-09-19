/**
 * The drawn vertical scrollbar.
 *
 * The platform's own scrollbar is an overlay nearly everywhere: it fades when
 * idle, and on touch it never appears until a finger is already moving, so a
 * pane with more below it reads as one that ends there. Styling it is not
 * enough either: naming a width through the WebKit pseudo-elements has no
 * effect on iOS, and naming the standard properties makes Chrome fall back to
 * the overlay bar. So the bar is drawn, exactly as the horizontal one under a
 * wide table already is, in the place the native one would have sat.
 *
 * The implementation is this string, and only this string. Both callers install
 * the same text: the server-rendered pages inline it with the rest of their
 * script, and the React tools inject it once through ensureVScroll().
 *
 * It was previously a real function shared by calling .toString() on it, which
 * broke every server-rendered page. The Worker's bundler rewrites named inner
 * functions as __name(fn, "fn") for stack traces; .toString() carried those
 * calls into the browser, where __name does not exist. The reference error
 * killed each page's whole script, and since panels are revealed by that
 * script, the home page came up blank. A literal string cannot be instrumented.
 *
 * Markup, the same shape the horizontal scroller uses:
 *
 *   <div class="vwrap">
 *     <div class="pane vscroll" data-vscroll>...</div>
 *     <div class="vbar" hidden><div class="vbar-thumb"></div></div>
 *   </div>
 */
export const VSCROLL_JS = `
window.attachVScroll = function (pane, bar) {
  if (!pane || !bar) return function () {};
  var thumb = bar.firstElementChild;
  var dragging = false;
  var startY = 0;
  var startTop = 0;
  var frame = 0;
  /* Layout is read on resize and when the content changes, never per frame.
     Asking for scrollHeight inside a scroll handler forces the browser to lay
     the pane out again on every event, which on a long pane is exactly the lag
     that makes the thumb trail the content. A frame now only reads scrollTop
     and writes a transform. */
  var room = 0;
  var track = 0;
  var size = 28;

  var measure = function () {
    room = pane.scrollHeight - pane.clientHeight;
    track = bar.clientHeight;
    if (room <= 2) { bar.hidden = true; return; }
    bar.hidden = false;
    size = Math.max(28, Math.round((pane.clientHeight / pane.scrollHeight) * track));
    thumb.style.height = size + 'px';
  };

  var draw = function () {
    frame = 0;
    if (room <= 2) return;
    var top = Math.round((pane.scrollTop / room) * (track - size));
    thumb.style.transform = 'translate3d(0,' + top + 'px,0)';
  };

  var remeasure = function () {
    measure();
    draw();
  };

  var schedule = function () {
    if (frame) return;
    frame = requestAnimationFrame(draw);
  };

  var seek = function (clientY) {
    var rect = bar.getBoundingClientRect();
    var span = rect.height - size;
    if (span <= 0) return;
    var offset = Math.min(Math.max(clientY - rect.top - size / 2, 0), span);
    pane.scrollTop = (offset / span) * room;
  };

  var onDown = function (e) {
    dragging = true;
    bar.classList.add('dragging');
    startY = e.clientY;
    startTop = thumb.getBoundingClientRect().top;
    if (e.target !== thumb) seek(e.clientY);
    if (bar.setPointerCapture && e.pointerId != null) bar.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  var onMove = function (e) {
    if (!dragging) return;
    var rect = bar.getBoundingClientRect();
    var span = rect.height - size;
    if (span <= 0) return;
    var offset = Math.min(Math.max(startTop - rect.top + (e.clientY - startY), 0), span);
    pane.scrollTop = (offset / span) * room;
    e.preventDefault();
  };

  var onUp = function () {
    dragging = false;
    bar.classList.remove('dragging');
  };

  pane.addEventListener('scroll', schedule, { passive: true });
  bar.addEventListener('pointerdown', onDown);
  bar.addEventListener('pointermove', onMove);
  bar.addEventListener('pointerup', onUp);
  bar.addEventListener('pointercancel', onUp);
  window.addEventListener('resize', remeasure);

  var ro = null;
  if (typeof ResizeObserver === 'function') {
    ro = new ResizeObserver(remeasure);
    ro.observe(pane);
    if (pane.firstElementChild) ro.observe(pane.firstElementChild);
  }
  remeasure();

  return function () {
    pane.removeEventListener('scroll', schedule);
    bar.removeEventListener('pointerdown', onDown);
    bar.removeEventListener('pointermove', onMove);
    bar.removeEventListener('pointerup', onUp);
    bar.removeEventListener('pointercancel', onUp);
    window.removeEventListener('resize', remeasure);
    if (ro) ro.disconnect();
    if (frame) cancelAnimationFrame(frame);
  };
};

Array.prototype.forEach.call(document.querySelectorAll('[data-vscroll]'), function (pane) {
  var bar = pane.parentElement && pane.parentElement.querySelector('.vbar');
  if (bar) window.attachVScroll(pane, bar);
});
`;

/**
 * The same text, installed once in a tool's page, for the React callers.
 * Returns the attach function, or a no-op where there is no document.
 */
export function ensureVScroll() {
  if (typeof document === 'undefined') return () => () => {};
  if (!window.attachVScroll) {
    const tag = document.createElement('script');
    tag.textContent = VSCROLL_JS;
    document.head.appendChild(tag);
  }
  return window.attachVScroll || (() => () => {});
}

/** Attach the drawn bar to a pane, installing the behaviour if it is not there. */
export function attachVScroll(pane, bar) {
  return ensureVScroll()(pane, bar);
}
