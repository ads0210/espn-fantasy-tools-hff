import { ensureVScroll } from './vscroll.js';

/**
 * The drawn horizontal scrollbar, and the two-way pane.
 *
 * The site's rule: anything that can be wider or taller than its space scrolls inside it, in that direction, with
 * the site's own drawn bar, never the platform's overlay (which fades when idle and on touch never shows until a
 * finger is already moving) and never by pushing the page sideways. React tables use ScrollBox.jsx; everything
 * drawn as HTML text (the Site API page's previews, code and pictures) uses this.
 *
 * Like src/vscroll.js, the implementation is a literal string, installed once in the page, never a function sent
 * with .toString() (the Worker's bundler rewrites named inner functions, and the rewrite broke every page once).
 *
 * Markup:
 *
 *   A horizontal scroller:
 *     <div class="scrollwrap">
 *       <div class="sbar" hidden><div class="sbar-thumb"></div></div>
 *       <div class="scrollreal">...</div>
 *     </div>
 *
 *   A pane that scrolls both ways (a preview table, a block of code):
 *     <div class="xywrap">
 *       <div class="sbar" hidden><div class="sbar-thumb"></div></div>
 *       <div class="vwrap"><div class="xyreal">...</div><div class="vbar" hidden><div class="vbar-thumb"></div></div></div>
 *     </div>
 */
export const HSCROLL_JS = `
window.attachHScroll = function (real, bar) {
  if (!real || !bar) return function () {};
  var thumb = bar.firstElementChild;
  var cw = 0, sw = 0, bw = 0, tw = 0, frame = 0, drag = null;
  /* Widths are read on resize and when the content changes, never per scroll event. */
  var measure = function () {
    cw = real.clientWidth; sw = real.scrollWidth;
    if (sw <= cw + 1) { bar.hidden = true; return; }
    bar.hidden = false;
    bw = bar.clientWidth || cw;
    tw = Math.max(32, Math.round(bw * (cw / sw)));
    thumb.style.width = tw + 'px';
    place();
  };
  var place = function () {
    var max = sw - cw;
    thumb.style.transform = 'translate3d(' + (max > 0 ? (real.scrollLeft / max) * (bw - tw) : 0) + 'px,0,0)';
  };
  var schedule = function () { if (!frame) frame = requestAnimationFrame(function () { frame = 0; place(); }); };
  var remeasure = function () { requestAnimationFrame(measure); };
  var onDown = function (e) {
    if (e.target !== thumb) {
      var r = bar.getBoundingClientRect();
      real.scrollLeft = ((e.clientX - r.left) / Math.max(1, r.width)) * (sw - cw);
      return;
    }
    drag = { x: e.clientX, left: real.scrollLeft };
    bar.classList.add('dragging');
    try { thumb.setPointerCapture(e.pointerId); } catch (x) { /* not fatal */ }
    e.preventDefault();
  };
  var onMove = function (e) {
    if (!drag) return;
    real.scrollLeft = drag.left + ((e.clientX - drag.x) / Math.max(1, bw - tw)) * (sw - cw);
    e.preventDefault();
  };
  var onUp = function () { drag = null; bar.classList.remove('dragging'); };
  real.addEventListener('scroll', schedule, { passive: true });
  bar.addEventListener('pointerdown', onDown);
  bar.addEventListener('pointermove', onMove);
  bar.addEventListener('pointerup', onUp);
  bar.addEventListener('pointercancel', onUp);
  window.addEventListener('resize', remeasure);
  var ro = null;
  if (typeof ResizeObserver === 'function') {
    ro = new ResizeObserver(remeasure);
    ro.observe(real);
    if (real.firstElementChild) ro.observe(real.firstElementChild);
  }
  remeasure();
  return function () {
    real.removeEventListener('scroll', schedule);
    bar.removeEventListener('pointerdown', onDown);
    bar.removeEventListener('pointermove', onMove);
    bar.removeEventListener('pointerup', onUp);
    bar.removeEventListener('pointercancel', onUp);
    window.removeEventListener('resize', remeasure);
    if (ro) ro.disconnect();
    if (frame) cancelAnimationFrame(frame);
  };
};

/* Every scroller inside a root, attached once; ones that have left the page are let go. */
window.wireScrollers = function (root) {
  var list = window.__scrollers || (window.__scrollers = []);
  window.__scrollers = list.filter(function (x) { if (x.el.isConnected) return true; x.off(); return false; });
  var wired = function (el) { return window.__scrollers.some(function (x) { return x.el === el; }); };
  var kids = function (el, cls) { return Array.prototype.filter.call(el.children, function (c) { return c.classList.contains(cls); })[0] || null; };
  Array.prototype.forEach.call((root || document).querySelectorAll('.scrollwrap'), function (w) {
    var real = kids(w, 'scrollreal'), bar = kids(w, 'sbar');
    if (real && bar && !wired(real)) window.__scrollers.push({ el: real, off: window.attachHScroll(real, bar) });
  });
  Array.prototype.forEach.call((root || document).querySelectorAll('.xywrap'), function (w) {
    var bar = kids(w, 'sbar'), vw = kids(w, 'vwrap');
    var real = vw && kids(vw, 'xyreal'), vbar = vw && kids(vw, 'vbar');
    if (!real || wired(real)) return;
    var offH = bar ? window.attachHScroll(real, bar) : function () {};
    var offV = vbar && window.attachVScroll ? window.attachVScroll(real, vbar) : function () {};
    window.__scrollers.push({ el: real, off: function () { offH(); offV(); } });
  });
};
`;

/** The same text, installed once, for code that draws HTML in the browser. */
export function ensureHScroll() {
  if (typeof document === 'undefined') return () => {};
  if (!window.wireScrollers) {
    const tag = document.createElement('script');
    tag.textContent = HSCROLL_JS;
    document.head.appendChild(tag);
  }
  return window.wireScrollers || (() => {});
}

/** Attach every drawn scroller inside a root (the vertical ones need src/vscroll.js installed first). */
export function wireScrollers(root) { ensureHScroll()(root); }

/**
 * Keep a root's drawn scrollers attached as its content is redrawn: whatever part of the page draws a preview, a
 * block of code or a picture, its bars are attached in the next frame, so no drawing path can forget to. Only added
 * and removed nodes are watched (never attributes, so the meters' sweep costs nothing), and a batch of changes is
 * handled once. Returns a function that stops watching.
 */
export function watchScrollers(root) {
  if (!root || typeof MutationObserver !== 'function') return () => {};
  ensureVScroll();
  let frame = 0;
  const run = () => { frame = 0; wireScrollers(root); };
  const mo = new MutationObserver(() => { if (!frame) frame = requestAnimationFrame(run); });
  mo.observe(root, { childList: true, subtree: true });
  run();
  return () => { mo.disconnect(); if (frame) cancelAnimationFrame(frame); };
}

/** Markup for a horizontal scroller around some HTML. */
export const hScrollHtml = (inner, cls = '') => `<div class="scrollwrap${cls ? ` ${cls}` : ''}"><div class="sbar" hidden><div class="sbar-thumb"></div></div><div class="scrollreal">${inner}</div></div>`;

/** Markup for a pane that scrolls both ways, around some HTML; `cls` goes on the scrolling pane. */
export const xyScrollHtml = (inner, cls = '', attrs = '') => `<div class="xywrap"><div class="sbar" hidden><div class="sbar-thumb"></div></div><div class="vwrap"><div class="xyreal${cls ? ` ${cls}` : ''}"${attrs ? ` ${attrs}` : ''}>${inner}</div><div class="vbar" hidden><div class="vbar-thumb"></div></div></div></div>`;
