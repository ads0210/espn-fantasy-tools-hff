import React, { useEffect, useRef } from "react";
import { attachVScroll } from "../../src/vscroll.js";

/**
 * A pane that scrolls vertically inside its own space, with the site's drawn bar at its right edge rather than
 * the platform's overlay (which on touch shows only once a finger is already moving). The vertical counterpart of
 * ScrollBox; the bar's behaviour is src/vscroll.js, shared with every server-drawn page.
 */
export default function VScrollBox({ className = "", onScroll, children }) {
  const paneRef = useRef(null);
  const barRef = useRef(null);
  useEffect(() => {
    if (!paneRef.current || !barRef.current) return undefined;
    return attachVScroll(paneRef.current, barRef.current);
  }, []);
  return (
    <div className="vwrap">
      <div ref={paneRef} className={`${className} vscroll`.trim()} onScroll={onScroll}>{children}</div>
      <div ref={barRef} className="vbar" hidden><div className="vbar-thumb" /></div>
    </div>
  );
}
