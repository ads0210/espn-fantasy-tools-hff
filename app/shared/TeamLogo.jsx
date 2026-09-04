import React, { useState, useEffect } from "react";

/**
 * A team logo, with the shield standing in whenever there is no image.
 *
 * The drawn shield is deliberate. The obvious fallback is the team's initials
 * or abbreviation, but an abbreviation the league never chose reads as real
 * data in exactly the way "Team 1" does, and ESPN's own abbrev is not always
 * present. A shield is visibly a stand-in.
 *
 * This must stay visually identical to LOGO_FALLBACK_SVG in src/ui.js, which is
 * what the server-rendered pages and the /api/logo fallback both emit. The
 * markup is duplicated here only because a React tool cannot inject raw HTML
 * without dangerouslySetInnerHTML; the geometry and stroke colour are the same.
 * Layout comes from the shared .lgo rules in BASE_CSS, so the box behaves the
 * same on every surface.
 */
export function LogoShield() {
  return (
    <svg viewBox="0 0 40 40" role="img" aria-hidden="true" focusable="false">
      <path
        d="M20 3 33 8v12c0 8-5.6 14.3-13 17-7.4-2.7-13-9-13-17V8z"
        fill="none" stroke="#5A6A5C" strokeWidth="2.4" strokeLinejoin="round"
      />
      <path
        d="M14 20h12M20 14v12"
        stroke="#5A6A5C" strokeWidth="2.4" strokeLinecap="round"
      />
    </svg>
  );
}

export default function TeamLogo({ src, alt = "", className = "" }) {
  const [failed, setFailed] = useState(false);

  // A new src is a new image and deserves its own attempt. Without this, one
  // failure would keep the shield showing after the team fixed their logo and
  // the digest picked up the new URL.
  useEffect(() => { setFailed(false); }, [src]);

  const showImage = Boolean(src) && !failed;
  const classes = ["lgo", showImage ? "" : "lgofail", className]
    .filter(Boolean).join(" ");

  return (
    <span className={classes}>
      {showImage ? (
        <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />
      ) : null}
      <LogoShield />
    </span>
  );
}
