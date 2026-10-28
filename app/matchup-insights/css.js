/**
 * Matchup Insights' own rules: the control deck, game cards (the home page's matchup card, src/matchupcard.js), the
 * insights table and its phone cards, category tints and chips, weight marks and outcomes. Made of the site's tokens
 * and type; the three category colours of its own (rose, teal, cyan) are measured to 4.5:1 for chip text and for text
 * on its tint in both themes (test/a11y.mjs holds them).
 */
import { INSIGHT_TONES_CSS } from '../../src/matchupcard.js';

export const MI_CSS = `
${INSIGHT_TONES_CSS}

/* ---- the control deck (review 3): the week, a colour bar of the eleven categories, then search, phase and team.
   One panel, three thin bands; the colour bar is the category filter itself, so the key to the tints and the
   control are one thing. ------------------------------------------------------------------------------------------ */
.mideck { padding:0; margin-bottom:22px; overflow:hidden; }
.mideckhead { display:flex; align-items:center; gap:10px 16px; flex-wrap:wrap; padding:11px clamp(12px,1.6vw,18px); border-bottom:1px solid var(--line); }
.weeksel { display:flex; align-items:center; gap:8px; flex:none; }
.weekbtn { background:none; border:1px solid var(--line-2); color:var(--ink-2); width:28px; height:28px; cursor:pointer; font-size:14px; font-weight:900;
  display:flex; align-items:center; justify-content:center; transition:border-color .16s ease, color .16s ease; font-family:inherit; }
.weekbtn:hover:not(:disabled) { border-color:var(--accent); color:var(--accent); }
.weekbtn:disabled { opacity:.3; cursor:default; }
.weekbtn:focus-visible { outline:2px solid var(--sky); outline-offset:2px; }
.weeklabel { font-size:15px; font-weight:900; letter-spacing:.01em; min-width:72px; text-align:center;
  background:linear-gradient(96deg,var(--ink) 30%,var(--accent) 130%); -webkit-background-clip:text; background-clip:text; color:transparent; -webkit-text-fill-color:transparent; }
.weekstate { flex:1 1 220px; min-width:0; font-size:10.5px; font-weight:800; color:var(--ink-2); letter-spacing:.06em; display:flex; align-items:center; gap:7px; }
.weekstate i { width:6px; height:6px; border-radius:50%; background:var(--accent); animation:miblip 1.8s ease-in-out infinite; flex:none; }
.weekstate i.still { animation:none; background:var(--ink-3); }
@keyframes miblip { 0%,100%{opacity:1} 50%{opacity:.3} }
html.stillness .weekstate i { animation:none; }
.micount { font-size:10.5px; font-weight:800; letter-spacing:.06em; color:var(--ink-2); white-space:nowrap; }
.micount b { color:var(--ink); font-variant-numeric:tabular-nums; }

.mispectrum { display:grid; grid-template-columns:repeat(auto-fit,minmax(96px,1fr)); border-bottom:1px solid var(--line); }
.mispec { position:relative; display:flex; align-items:center; justify-content:center; min-height:40px; padding:10px 6px 8px; margin:0;
  background:var(--panel-2); border:0; border-right:1px solid var(--line); border-bottom:1px solid var(--line); color:var(--ink-2);
  font:inherit; font-size:9px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; line-height:1.25; text-align:center; cursor:pointer;
  transition:background .16s ease, color .16s ease; }
.mispec i { position:absolute; left:0; right:0; top:0; height:3px; background:var(--c); opacity:.55; transition:height .16s ease, opacity .16s ease; }
.mispec:hover { color:var(--ink); }
.mispec:hover i { opacity:1; }
.mispec[aria-pressed="true"] { color:var(--ink); background:color-mix(in srgb,var(--c) calc(var(--mi-tint) * 2),var(--panel-2)); }
.mispec[aria-pressed="true"] i { height:5px; opacity:1; box-shadow:0 0 12px var(--c); }
.mispec:focus-visible { outline:2px solid var(--sky); outline-offset:-2px; }

.midecktools { display:flex; flex-wrap:wrap; align-items:center; gap:10px 14px; padding:10px clamp(12px,1.6vw,18px); }
.misearch { position:relative; flex:1 1 240px; min-width:0; }
.misearch svg { position:absolute; left:11px; top:50%; width:14px; height:14px; transform:translateY(-50%); color:var(--ink-3); pointer-events:none; }
.misearch input[type=text] { padding:9px 11px 9px 33px; font-size:14px; }
.misearch input::placeholder { color:var(--ink-3); }
.miphase, .misort { display:inline-flex; border:1px solid var(--line-2); }
.miphase button, .misort button { background:none; border:0; border-right:1px solid var(--line-2); padding:7px 11px; color:var(--ink-2); font:inherit;
  font-size:9.5px; font-weight:900; letter-spacing:.14em; text-transform:uppercase; cursor:pointer; }
.miphase button:last-child, .misort button:last-child { border-right:0; }
.miphase button.on, .misort button.on { color:var(--on-accent); background:var(--accent); }
.miphase button:focus-visible, .misort button:focus-visible, .mitraybtn:focus-visible, .miclear:focus-visible { outline:2px solid var(--sky); outline-offset:2px; }
.misort { display:none; }
.mimine { display:inline-flex; align-items:center; gap:9px; font-size:10px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; color:var(--ink-2); }
.mimine .sw[aria-disabled="true"] { opacity:.5; cursor:not-allowed; }
.mitraybtn { display:none; align-items:center; gap:7px; background:none; border:1px solid var(--line-2); color:var(--ink); padding:7px 11px; font:inherit;
  font-size:9.5px; font-weight:900; letter-spacing:.14em; text-transform:uppercase; cursor:pointer; }
.mitraybtn b { padding:1px 6px; color:var(--on-accent); background:var(--accent); font-size:9px; }
.miclear { background:none; border:0; padding:0; color:var(--sky); font:inherit; font-size:10.5px; font-weight:800; letter-spacing:.06em; text-decoration:underline; text-underline-offset:2px; cursor:pointer; }

/* A tool-level notice (as Fortune Teller's), at the top: rebuilt weeks say what they leave out (D25). */
.minote { margin:0 0 14px; padding:10px 14px; border:1px solid var(--signal); background:var(--signal-soft); font-size:12px; line-height:1.5; color:var(--ink); text-align:center; }

/* ---- a game: the home page's matchup card, its top insight, and the bar that opens the rest ------------------- */
.migames { display:flex; flex-direction:column; gap:14px; }
.migame { position:relative; padding:clamp(18px,1.7vw,24px) clamp(16px,1.6vw,22px) 0; }
.migame[data-state="live"]::before { background:linear-gradient(90deg, var(--accent) 0%, var(--accent-deep) 34%, transparent 78%); height:2px; }
.migame.mymatch { border-color:color-mix(in srgb,var(--accent) 45%,var(--line)); }
.migtags { display:flex; flex-wrap:wrap; justify-content:center; gap:6px; margin:-6px 0 10px; }
.migtag { padding:2px 8px; font-size:9px; font-weight:900; letter-spacing:.16em; text-transform:uppercase; color:var(--accent); border:1px solid color-mix(in srgb,var(--accent) 55%,transparent); }
.migtag.round { color:var(--c-stakes); border-color:color-mix(in srgb,var(--c-stakes) 55%,transparent); }
.mighl { display:flex; align-items:flex-start; justify-content:center; gap:10px; margin:14px auto 0; max-width:860px; padding:9px 12px;
  background:color-mix(in srgb,var(--c) var(--mi-tint),transparent); border-left:3px solid var(--c); text-align:left; }
.mighl .milabelchip { flex:none; margin-top:1px; }
.mighl p { margin:0; font-size:13px; line-height:1.45; color:var(--ink); }
.migopen { display:flex; align-items:center; justify-content:center; gap:10px; width:calc(100% + 2 * clamp(16px,1.6vw,22px)); margin:14px calc(-1 * clamp(16px,1.6vw,22px)) 0;
  padding:11px 12px; background:none; border:0; border-top:1px solid var(--line); color:var(--ink-2); font:inherit; font-size:10px; font-weight:900;
  letter-spacing:.16em; text-transform:uppercase; cursor:pointer; transition:color .16s ease, background .16s ease; }
.migopen:hover { color:var(--ink); background:color-mix(in srgb,var(--accent) 6%,transparent); }
.migopen:focus-visible { outline:2px solid var(--sky); outline-offset:-2px; }
.migchev { width:8px; height:8px; border-right:2px solid var(--accent); border-bottom:2px solid var(--accent); transform:translateY(-2px) rotate(45deg); transition:transform .2s ease; }
.migopen[aria-expanded="true"] .migchev { transform:translateY(2px) rotate(-135deg); }
.migbody { padding:4px 0 16px; }
.migbody .placeholder { margin:4px 0 0; }

/* ---- the insights table ------------------------------------------------------------------------------------------ */
table.mitable { width:100%; border-collapse:separate; border-spacing:0 4px; }
table.mitable th { padding:6px 8px 8px; font-size:9.5px; font-weight:900; letter-spacing:.16em; text-transform:uppercase; color:var(--ink-2); text-align:center; white-space:nowrap; cursor:pointer; user-select:none; }
table.mitable th.nosort { cursor:default; }
table.mitable th .arrow { margin-left:4px; font-size:8px; color:var(--ink-3); }
table.mitable th[aria-sort="ascending"] .arrow, table.mitable th[aria-sort="descending"] .arrow { color:var(--accent); }
table.mitable td { padding:9px 8px; text-align:center; vertical-align:middle; font-size:12.5px; line-height:1.45; color:var(--ink);
  background:color-mix(in srgb,var(--c) var(--mi-tint),transparent); }
table.mitable td:first-child { border-left:3px solid var(--c); }
table.mitable td.col-team { text-align:left; }
table.mitable td.misent { min-width:260px; text-align:left; }
table.mitable tr.mine td:last-child { box-shadow:inset -3px 0 0 var(--accent); }
.mitn { font-weight:900; background:linear-gradient(96deg,var(--ink) 30%,var(--accent) 130%); -webkit-background-clip:text; background-clip:text; color:transparent; -webkit-text-fill-color:transparent; }
.miv { font-weight:900; font-variant-numeric:tabular-nums; color:var(--ink); }
.mip { font-weight:800; color:var(--ink); }
.milabelchip { display:inline-block; padding:3px 7px; font-size:9px; font-weight:900; letter-spacing:.14em; text-transform:uppercase; white-space:nowrap; color:var(--c-chipink); background:var(--c); }
.miname { display:block; margin-top:4px; font-size:9.5px; font-weight:800; letter-spacing:.05em; color:var(--ink-2); white-space:nowrap; }
.milogos { display:flex; gap:4px; align-items:center; flex-wrap:wrap; }
.milogos .tklogo { width:22px; height:22px; }
.miweight { display:inline-flex; gap:3px; }
.miweight i { width:5px; height:5px; transform:rotate(45deg); border:1.25px solid var(--c); }
.miweight i.on { background:var(--c); }
.mimeta { font-size:10.5px; font-weight:800; color:var(--ink-2); letter-spacing:.03em; }
.miout { display:inline-block; padding:2px 7px; font-size:9px; font-weight:900; letter-spacing:.14em; text-transform:uppercase; border:1px solid; }
.miout.held { color:var(--accent); border-color:var(--accent); }
.miout.broke { color:var(--flag); border-color:var(--flag); }
.miout.pending { color:var(--ink-2); border-color:var(--line-2); }
.miyou { display:inline-block; margin-left:6px; padding:1px 5px; font-size:8px; font-weight:900; letter-spacing:.14em; text-transform:uppercase; color:var(--accent); border:1px solid color-mix(in srgb,var(--accent) 55%,transparent); vertical-align:2px; }

/* The bar that opens the rest of a game (Season Statistics' bar, D12). */
.mimore { position:relative; display:flex; align-items:center; justify-content:center; gap:12px; width:100%; margin:10px 0 0; padding:12px 16px;
  background:var(--panel-2); border:1px solid var(--line-2); color:var(--ink); font:inherit; cursor:pointer; transition:border-color .16s ease, box-shadow .16s ease; }
.mimore:hover { border-color:var(--accent); box-shadow:0 0 22px -10px var(--accent-glow); }
.mimore:focus-visible { outline:2px solid var(--sky); outline-offset:2px; }
.mimoret { font-size:10.5px; font-weight:900; letter-spacing:.17em; text-transform:uppercase; background:linear-gradient(94deg,var(--ink) 10%,var(--accent) 150%);
  -webkit-background-clip:text; background-clip:text; color:transparent; -webkit-text-fill-color:transparent; }
.mimoren { padding:2px 8px; font-size:10px; font-weight:900; font-variant-numeric:tabular-nums; letter-spacing:.06em; color:var(--on-accent); background:var(--accent); }
.mimore.open .mimoren { color:var(--ink-2); background:none; border:1px solid var(--line-2); }

.mileague { padding:12px clamp(10px,1.4vw,18px) 10px; margin-bottom:24px; }

/* ---- phones: each row becomes a compact card (D21) ------------------------------------------------------------ */
@media (max-width:699px) {
  table.mitable thead { display:none; }
  table.mitable, table.mitable tbody { display:block; }
  table.mitable tr { display:grid; grid-template-columns:auto 1fr auto; grid-template-areas:"chip meta weight" "sent sent sent" "logos logos out";
    gap:7px 10px; margin-bottom:6px; padding:10px 11px; text-align:left; background:color-mix(in srgb,var(--c) var(--mi-tint),transparent); border-left:3px solid var(--c); }
  table.mitable tr.mine { box-shadow:inset -3px 0 0 var(--accent); }
  table.mitable td { display:block; padding:0; background:none; text-align:inherit; }
  table.mitable td:first-child { border-left:0; }
  table.mitable tr.mine td:last-child { box-shadow:none; }
  table.mitable td.misent { grid-area:sent; min-width:0; font-size:13px; }
  table.mitable td.micat { grid-area:chip; }
  table.mitable td.micat .miname { display:none; }
  table.mitable td.col-team { grid-area:logos; }
  table.mitable td.miabout { display:none; }
  table.mitable td.miwt { grid-area:weight; align-self:center; }
  table.mitable td.miwhen { display:none; }
  table.mitable td.mioc { grid-area:out; align-self:center; }
  .mispectrum, .miphase, .misort { display:none; }
  .mideck.trayopen .mispectrum { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); }
  .mideck.trayopen .miphase, .mideck.trayopen .misort { display:inline-flex; }
  /* Five phases (round 8): one even row across the tray at any phone width. */
  .mideck.trayopen .miphase { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); width:100%; }
  .mideck.trayopen .miphase button { padding:7px 2px; }
  .mitraybtn { display:inline-flex; }
  .weekstate { order:3; flex-basis:100%; }
  .migopen { width:calc(100% + 2 * clamp(16px,1.6vw,22px)); }
  .mighl { flex-direction:column; align-items:flex-start; gap:6px; }
}
`;
