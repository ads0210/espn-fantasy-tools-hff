/**
 * The Admin Password gate, one component for every page that has one.
 *
 * Site Configuration is always behind it, and so is any tool set to admin-only.
 * Both draw the same header, the same panel and the same note above the password,
 * from here, so they cannot drift apart. Each page keeps only its own script: a
 * tool unlocks and reloads into itself, while Site Configuration keeps the password
 * for the life of the page and reveals its panels.
 *
 * The note says "whoever administers this site", not whoever runs the league: the
 * person who looks after the site need not be the league's commissioner.
 */

import { displayTitle, passwordField } from './ui.js';

export const ADMIN_GATE_NOTE = 'This tool is restricted to whoever administers this site. Enter the Admin Password to open it.';

const LOCK_GLYPH = `<svg viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="1.6"><rect x="4" y="10.5" width="16" height="11"/>
          <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/><circle cx="12" cy="16" r="1.4"/></svg>`;

/** The header over the gate: the page's name, and nothing else between it and the password. */
export function adminGateRail(title) {
  return `
    <p class="eyebrow">Restricted</p>
    ${displayTitle(title)}
`;
}

/** The gate itself: the note, the password and the button. Ids are shared: adminPw, unlock, gateMsg. */
export function adminGateSection() {
  return `
    <section id="gate">
      <div class="panel">
        <span class="ghostmark" aria-hidden="true">${LOCK_GLYPH}</span>
        <p class="hint gatenote">${ADMIN_GATE_NOTE}</p>
        ${passwordField({ id: 'adminPw', label: 'Admin Password', autofocus: true, autocomplete: 'current-password' })}
        <button class="primary" id="unlock">Unlock</button>
        <div class="msg" id="gateMsg"></div>
      </div>
    </section>`;
}

/**
 * One question on an otherwise empty page: centred, with the header centred over it.
 * Written against the gate being visible, so a page that reveals its own panels once
 * unlocked (Site Configuration) lets go of the centring by hiding the gate.
 */
export const ADMIN_GATE_CSS = `
    .pagegrid.stack .rail { max-width:none; }
    .pagegrid.stack .railtext, .pagegrid.stack .titlebar { text-align:center; }
    .pagegrid.stack .railmark { margin:0 auto; }
    .pagegrid.stack .railtext .display { margin:0 auto; }
    .pagegrid.stack .railtext .eyebrow { justify-content:center; }
    body:has(#gate:not([hidden])) .main { display:flex; justify-content:center; }
    body:has(#gate:not([hidden])) #gate { width:min(100%,420px); }
    #gate .panel { text-align:center; }
    /* Kept clear of the lock drawn faintly in the panel's corner, and centred between. */
    #gate .panel .gatenote { margin-top:0; padding:0 44px; text-wrap:balance; }
    #gate .panel .fieldwrap, #gate .panel .msg { text-align:left; }
`;
