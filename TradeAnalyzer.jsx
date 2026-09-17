import React, {
  useState, useEffect, useMemo, useRef, useCallback, useDeferredValue,
} from "react";
import { PALETTES, BASE_CSS, BACKDROP, TEAM_COOKIE } from "../../src/ui.js";
import SettingsMenu from "../shared/SettingsMenu.jsx";
import TeamLogo from "../shared/TeamLogo.jsx";
import { createEngine } from "./engine.js";

/* ==========================================================================
 * Trade Analyzer
 *
 * Two ways in, one answer: an offer already on the table and one built here run
 * through the same evaluator, so they cannot disagree about the same deal.
 *
 * Everything is computed in the browser. The sliders recompute a weighted sum
 * on every drag and the rebalancing pass re-scores roughly a hundred
 * neighbouring trades each time — a round trip per pixel was never going to
 * work, so the tool is given the board rather than the answer.
 * ========================================================================== */

const RATE = 0.7;          // px per ms — the site's disclosure rate
const COARSE = typeof window !== "undefined" && window.matchMedia
  ? window.matchMedia("(pointer:coarse)").matches : false;

function readCookie(name) {
  if (typeof document === "undefined") return "";
  const m = new RegExp("(?:^|; )" + name + "=([^;]*)").exec(document.cookie);
  return m ? decodeURIComponent(m[1]) : "";
}

/* ==========================================================================
 * CSS
 *
 * Five type steps and four spacing steps, used strictly. The first pass of this
 * surface had a dozen font sizes and per-component margins, and read as clutter
 * for exactly that reason: nothing grouped, because everything was equally far
 * from everything else.
 * ========================================================================== */
const CSS = `
:root {
  --fs-micro: 9px; --fs-small: 11px; --fs-base: 13px; --fs-lg: 16px;
  --fs-xl: clamp(21px, 3vw, 30px);
  --sp-1: 6px; --sp-2: 14px; --sp-3: 26px; --sp-4: clamp(36px, 5vw, 58px);
  --row-h: 30px;
  --ease-out: cubic-bezier(.22,.7,.3,1);
  --ease-io: cubic-bezier(.5,0,.2,1);
  --dur-1: .16s; --dur-2: .26s;
}
* { box-sizing:border-box; }
button { -webkit-tap-highlight-color:transparent; font-family:inherit; }
.wrap { display:flex; flex-direction:column; }

/* One rule for vertical rhythm, so no component sets its own outer margin. */
.stack > * + * { margin-top:var(--sp-2); }
.stack-tight > * + * { margin-top:var(--sp-1); }
.stack > :empty, .grid > :empty, .tabbody > :empty { display:none; }

/* --- tool header --------------------------------------------------------- */
.toolhead { display:flex; align-items:center; gap:18px; padding:0 0 var(--sp-2);
  border-bottom:1px solid var(--line); }
.toolmark { flex:none; width:min(46%,340px); }
.toolmark, .homelink { display:block; text-decoration:none; color:inherit; }
.toolid { flex:1; min-width:0; text-align:right; }
.toolid .eyebrow { margin-bottom:4px; justify-content:flex-end; }
.toolid .eyebrow::after { display:none; }
.toolleague { font-size:clamp(15px,2.4vw,22px); font-weight:900; letter-spacing:-.02em;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
  background:linear-gradient(96deg,var(--ink) 30%,var(--accent) 130%);
  -webkit-background-clip:text; background-clip:text;
  color:transparent; -webkit-text-fill-color:transparent; }
.toolctl { flex:none; display:flex; gap:4px; position:relative; }
.toolctl .settings { top:38px; }
@media (max-width:700px) {
  .toolhead { flex-wrap:wrap; gap:10px; }
  .toolmark { width:calc(100% - 74px); }
  .toolid { width:100%; text-align:left; order:3; }
  .toolid .eyebrow { justify-content:flex-start; }
}
.toolmark:hover .mark .m2 { fill:var(--accent); }

/* --- section headers ------------------------------------------------------ */
.sechead { display:flex; align-items:center; gap:var(--sp-2);
  margin:var(--sp-4) 0 var(--sp-3); }
.sechead::before { content:""; width:9px; height:9px; background:var(--accent);
  transform:rotate(45deg); flex:none; }
.sechead .t { font-size:clamp(15px,2.2vw,21px); font-weight:900; letter-spacing:.18em;
  text-transform:uppercase; line-height:1; flex:none;
  background:linear-gradient(94deg,var(--ink) 10%,var(--accent) 150%);
  -webkit-background-clip:text; background-clip:text;
  color:transparent; -webkit-text-fill-color:transparent; }
.sechead .rule { flex:1; height:1px;
  background:linear-gradient(90deg,var(--line-2),transparent); }
.sechead .count { flex:none; font-size:var(--fs-micro); font-weight:900;
  letter-spacing:.14em; text-transform:uppercase; color:var(--ink-3); }

/* --- shared parts --------------------------------------------------------- */
.band { font-weight:900; letter-spacing:-.01em; }
.band.c-even { color:var(--accent); } .band.c-slight { color:var(--accent-2); }
.band.c-leans, .band.c-favors { color:var(--signal); }
.band.c-heavy { color:var(--flag); } .band.c-none { color:var(--ink-3); }
.num.pos { color:var(--accent); } .num.neg { color:var(--flag); }
.num.zero { color:var(--ink-3); }

.chip { display:inline-flex; align-items:center; gap:5px; font-size:var(--fs-micro);
  font-weight:900; letter-spacing:.1em; text-transform:uppercase; padding:3px 8px;
  border:1px solid currentColor; white-space:nowrap; color:var(--ink-3); }
.chip.warn { color:var(--signal); } .chip.bad { color:var(--flag); }
.chip.good { color:var(--accent); } .chip.info { color:var(--sky); }

.posbadge { flex:none; width:32px; text-align:center; font-size:var(--fs-micro);
  font-weight:900; letter-spacing:.04em; padding:2px 0; border:1px solid currentColor; }
.pos-QB { color:#F06BA8; } .pos-RB { color:#4FD8A8; } .pos-WR { color:#5BA8FF; }
.pos-TE { color:#FFB020; } .pos-K { color:#B78CF7; } .pos-DST { color:#9AA8A0; }
.pos-FLEX { color:#9AA8A0; }
html[data-theme="light"] .pos-QB { color:#B1256C; }
html[data-theme="light"] .pos-RB { color:#0C7A55; }
html[data-theme="light"] .pos-WR { color:#20629E; }
html[data-theme="light"] .pos-TE { color:#8A5406; }
html[data-theme="light"] .pos-K { color:#5C3B9E; }
html[data-theme="light"] .pos-DST, html[data-theme="light"] .pos-FLEX { color:#54615B; }

.swapmark { display:inline-block; width:18px; height:18px; flex:none;
  color:var(--accent-deep); }
.swapmark svg { width:100%; height:100%; display:block; }
.chev { width:8px; height:8px; border-right:2px solid currentColor;
  border-bottom:2px solid currentColor; transform:rotate(45deg);
  transition:transform var(--dur-2) var(--ease-out), color var(--dur-1) var(--ease-out); }
[aria-expanded="true"] .chev.turns { transform:rotate(225deg); }

/* ==========================================================================
 * OFFERS — a card per proposal, showing what each side actually gives up.
 * The names are the thing a member wants first; the verdict is the thing they
 * want second. So the assets lead and the judgement sits on one line beneath.
 * ========================================================================== */
.offerlist { display:flex; flex-direction:column; gap:var(--sp-1); }
.offer { border:1px solid var(--line); background:var(--panel); }
.offer.open { border-color:var(--accent-deep); }
.offercard { position:relative; display:block; width:100%; text-align:left;
  background:none; border:0; color:inherit; font:inherit; cursor:pointer;
  padding:var(--sp-2) var(--sp-2) 28px;
  transition:background var(--dur-1) var(--ease-out); }
.offercard:hover, .offer.open > .offercard { background:var(--accent-glow); }
.offercard > .chev { position:absolute; left:50%; bottom:10px; margin-left:-5px;
  color:var(--accent-deep); }
.offercard:hover > .chev { color:var(--accent); }

.ocsides { display:grid; grid-template-columns:1fr auto 1fr; gap:var(--sp-2);
  align-items:start; }
.ocsides > * { min-width:0; }
.ocswap { align-self:center; }
.octeam { display:flex; align-items:center; gap:var(--sp-1); min-width:0; }
.octeam .lgo { width:24px; height:24px; flex:none; }
.octeam b { display:block; min-width:0; font-size:var(--fs-base); font-weight:900;
  letter-spacing:-.01em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ocgives { display:block; margin:9px 0 5px; font-size:var(--fs-micro); font-weight:900;
  letter-spacing:.16em; text-transform:uppercase; color:var(--ink-3); }
.ocside.b .octeam { flex-direction:row-reverse; }
.ocside.b .octeam b { text-align:right; }
.ocside.b .ocgives, .ocside.b .ocplayer { text-align:right; }
.ocside.b .ocplayer { flex-direction:row-reverse; }
.ocplayer { display:flex; align-items:center; gap:7px; padding:3px 0;
  font-size:var(--fs-small); min-width:0; }
.ocplayer .posbadge { width:28px; font-size:8px; }
.ocplayer .nm { flex:1; min-width:0; font-weight:800; white-space:nowrap;
  overflow:hidden; text-overflow:ellipsis; }
.ocplayer .pj { flex:none; font-weight:900; font-variant-numeric:tabular-nums;
  color:var(--ink-3); }
.ocnone { display:block; padding:3px 0; font-size:var(--fs-small); color:var(--ink-3); }

.ocinfo { display:flex; align-items:center; flex-wrap:wrap; gap:var(--sp-1) 10px;
  margin-top:var(--sp-2); padding-top:var(--sp-2); border-top:1px solid var(--line);
  font-size:var(--fs-micro); font-weight:900; letter-spacing:.1em;
  text-transform:uppercase; color:var(--ink-3); }
.ocinfo .v { font-size:var(--fs-small); letter-spacing:.02em; text-transform:none; }
.ocinfo .dot { width:3px; height:3px; background:var(--line-2); transform:rotate(45deg);
  flex:none; }
.ocinfo .exp { color:var(--ink-2); font-variant-numeric:tabular-nums; }
.ocinfo .exp.soon { color:var(--signal); }
.ocinfo .exp.gone { color:var(--flag); }

.offerbody { overflow:hidden; }
.offerbody-inner { padding:0 var(--sp-2) var(--sp-3); border-top:1px solid var(--line); }
.offerbody-inner > .stack { margin-top:var(--sp-3); }

/* --- the deal strip inside an open analysis ------------------------------- */
.deal { display:grid; grid-template-columns:1fr 40px 1fr;
  border:1px solid var(--line); background:var(--panel-2); }
.deal > * { min-width:0; }
.dealcol { padding:var(--sp-2); }
.dealsplit { display:flex; align-items:center; justify-content:center;
  border-left:1px solid var(--line); border-right:1px solid var(--line); }
.dealwho { display:flex; align-items:center; gap:var(--sp-1); }
.dealwho .lgo { width:26px; height:26px; flex:none; }
.dealwho .who { min-width:0; }
.dealwho b { display:block; font-size:var(--fs-small); font-weight:900; line-height:1.3;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.dealwho em { display:block; margin-top:2px; font-style:normal; font-size:var(--fs-micro);
  font-weight:700; color:var(--ink-3); white-space:nowrap; overflow:hidden;
  text-overflow:ellipsis; }
.dealgets { display:flex; align-items:center; gap:8px; margin:var(--sp-2) 0 var(--sp-1);
  font-size:var(--fs-micro); font-weight:900; letter-spacing:.16em;
  text-transform:uppercase; color:var(--accent); }
.dealgets::after { content:""; flex:1; height:1px;
  background:linear-gradient(90deg,var(--line-2),transparent); }
.pline { display:flex; align-items:center; gap:var(--sp-1); padding:6px 0;
  font-size:var(--fs-small); }
.pline + .pline { border-top:1px solid var(--line); }
.pline .nm { flex:1; min-width:0; font-weight:800; white-space:nowrap;
  overflow:hidden; text-overflow:ellipsis; }
.pline .nm i { font-style:normal; color:var(--ink-3); font-weight:700; }
.pline .pj { flex:none; font-weight:900; font-variant-numeric:tabular-nums;
  color:var(--ink-2); }
.pline .mk { flex:none; width:7px; height:7px; transform:rotate(45deg); }
.mk.ON_THE_BLOCK { background:var(--accent); }
.mk.UNTOUCHABLE { background:var(--flag); }
.mk.overlap { background:var(--signal); }

/* ==========================================================================
 * VERDICT
 * ========================================================================== */
.verdict { position:relative; border:1px solid var(--line); background:var(--panel);
  padding:var(--sp-3) var(--sp-2) var(--sp-2); text-align:center; }
.verdict::before { content:""; position:absolute; left:-1px; right:-1px; top:-1px;
  height:2px; }
.v-even::before { background:linear-gradient(90deg,var(--accent) 0%,transparent 78%); }
.v-slight::before { background:linear-gradient(90deg,var(--accent-deep) 0%,transparent 78%); }
.v-leans::before, .v-favors::before {
  background:linear-gradient(90deg,var(--signal) 0%,transparent 78%); }
.v-heavy::before { background:linear-gradient(90deg,var(--flag) 0%,transparent 78%); }
.v-none::before { background:linear-gradient(90deg,var(--ink-3) 0%,transparent 78%); }
.vlabel { display:block; font-size:var(--fs-xl); font-weight:900; letter-spacing:-.03em;
  line-height:1.05; }
.vfor { display:flex; align-items:center; justify-content:center; height:22px;
  margin-top:6px; padding:0 var(--sp-1); font-size:var(--fs-small); font-weight:800;
  color:var(--ink-3); overflow:hidden; }
.vfor b { font-weight:900; color:var(--ink-2); }
.vdesc { display:flex; justify-content:center; flex-wrap:wrap; gap:var(--sp-1);
  margin-top:var(--sp-1); }

/* The track is symmetric: red at both ends, so the colour reads as distance
   from even rather than as bad-for-you. */
.meter { position:relative; max-width:560px; margin:var(--sp-3) auto 0; }
.metertrack { position:relative; height:10px; border:1px solid var(--line-2);
  opacity:.85; background:linear-gradient(90deg, var(--flag) 0%, var(--signal) 22%,
    var(--accent-deep) 42%, var(--accent) 50%, var(--accent-deep) 58%,
    var(--signal) 78%, var(--flag) 100%); }
.metertrack i { position:absolute; top:-1px; bottom:-1px; width:1px;
  background:var(--field); opacity:.55; }
.meterneedle { position:absolute; top:-6px; bottom:-6px; width:3px; background:var(--ink);
  box-shadow:0 0 0 1px var(--field), 0 0 12px var(--accent-glow);
  transform:translateX(-1.5px); transition:left var(--dur-2) var(--ease-out); }
.meterends { display:flex; justify-content:space-between; gap:var(--sp-2);
  margin-top:var(--sp-1); font-size:var(--fs-micro); font-weight:900;
  letter-spacing:.12em; text-transform:uppercase; color:var(--ink-3); }
.meterends span { min-width:0; overflow:hidden; text-overflow:ellipsis;
  white-space:nowrap; }
.meterends .mid { flex:none; color:var(--accent); }

.vtot { display:flex; align-items:flex-start; justify-content:center; gap:var(--sp-3);
  margin-top:var(--sp-3); padding-top:var(--sp-2); border-top:1px solid var(--line); }
.vtot > div { min-width:0; }
.vtot .lbl { display:block; font-size:var(--fs-micro); font-weight:900;
  letter-spacing:.12em; text-transform:uppercase; color:var(--ink-3);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.vtot .n { display:block; margin-top:4px; font-size:var(--fs-lg); font-weight:900;
  font-variant-numeric:tabular-nums; letter-spacing:-.02em; }

/* ==========================================================================
 * TABS
 * ========================================================================== */
.tabbar { display:flex; align-items:center; justify-content:space-between;
  gap:var(--sp-2); flex-wrap:wrap; }
.tabs { display:flex; flex-wrap:wrap; }
.tab { background:var(--panel-2); border:1px solid var(--line-2); color:var(--ink-3);
  font-family:inherit; font-size:var(--fs-micro); font-weight:900; letter-spacing:.12em;
  text-transform:uppercase; padding:8px 14px; cursor:pointer; margin-left:-1px;
  display:inline-flex; align-items:center; gap:6px; white-space:nowrap;
  transition:color var(--dur-1) var(--ease-out),
    border-color var(--dur-1) var(--ease-out), background var(--dur-1) var(--ease-out); }
.tab:first-child { margin-left:0; }
.tab:hover:not(:disabled):not(.on) { color:var(--accent); border-color:var(--accent-deep); }
.tab.on { color:var(--field); background:var(--accent); border-color:var(--accent);
  position:relative; z-index:1; }
.tab:disabled { opacity:.38; cursor:not-allowed; }
.tab .n { opacity:.72; font-variant-numeric:tabular-nums; }
.tab.on .n { opacity:.9; }
.tabbody { margin-top:var(--sp-2); overflow:hidden; }
.tabbody > * { animation:tabin .2s var(--ease-out) both; }
@keyframes tabin { from { opacity:0; transform:translateY(5px); } }
html.stillness .tabbody > * { animation:none; }

.ctlbar { display:flex; align-items:center; gap:var(--sp-2); flex-wrap:wrap;
  margin-top:var(--sp-1); padding:var(--sp-1) 0; }
.ctlgroup { display:flex; align-items:center; gap:8px; }
.ctlgroup .lab { font-size:var(--fs-micro); font-weight:900; letter-spacing:.14em;
  text-transform:uppercase; color:var(--ink-3); }

/* Equal tracks that can never fall below their own label. A flex basis of zero
   let each segment shrink under its text, and the control clips. */
.seg { position:relative; display:inline-grid; grid-auto-flow:column;
  grid-auto-columns:1fr; border:1px solid var(--line-2); background:var(--panel-2);
  overflow:hidden; }
.segthumb { position:absolute; top:0; bottom:0; left:0; width:calc(100% / var(--n,2));
  background:var(--accent); transform:translateX(calc(100% * var(--i,0)));
  transition:transform var(--dur-2) var(--ease-out); pointer-events:none; }
.segbtn { position:relative; z-index:1; background:none; border:0; color:var(--ink-3);
  font-family:inherit; font-size:var(--fs-micro); font-weight:900; letter-spacing:.12em;
  text-transform:uppercase; padding:8px 16px; cursor:pointer; white-space:nowrap;
  text-align:center; transition:color var(--dur-1) var(--ease-out); }
.segbtn:hover:not(.on) { color:var(--accent); }
.segbtn.on { color:var(--field); }
html.stillness .segthumb { transition:none; }

.minibtn { background:none; border:1px solid var(--line-2); color:var(--ink-2);
  font-family:inherit; font-size:var(--fs-micro); font-weight:900; letter-spacing:.12em;
  text-transform:uppercase; padding:8px 13px; cursor:pointer; white-space:nowrap;
  transition:border-color var(--dur-1) var(--ease-out),
    color var(--dur-1) var(--ease-out), background var(--dur-1) var(--ease-out); }
.minibtn:hover { border-color:var(--accent); color:var(--accent); }
.minibtn.sky { border-color:var(--sky); color:var(--sky); }
.minibtn.sky:hover { background:var(--sky); color:var(--field); }
.minibtn:disabled { opacity:.4; cursor:not-allowed; border-color:var(--line);
  color:var(--ink-3); }
.btnrow { display:flex; gap:var(--sp-1); flex-wrap:wrap; align-items:center; }

/* ==========================================================================
 * LEDGER
 * ========================================================================== */
.ledger { border:1px solid var(--line); background:var(--panel); }
.lgroup { display:flex; align-items:center; gap:8px; padding:9px var(--sp-2);
  background:var(--inset); border-bottom:1px solid var(--line);
  font-size:var(--fs-micro); font-weight:900; letter-spacing:.16em;
  text-transform:uppercase; color:var(--ink-3); }
.lgroup::before { content:""; width:5px; height:5px; background:var(--accent-deep);
  transform:rotate(45deg); flex:none; }
/* One shape at every width: the statistic and its slider lead, the two sides
   sit beneath as a labelled pair. Hanging the slider off one side of a
   three-column row left it floating between two numbers it belonged to
   equally. */
.lrow { display:grid; grid-template-columns:1fr 1fr; align-items:stretch; }
.lrow + .lrow, .lgroup + .lrow { border-top:1px solid var(--line); }
.lrow > * { min-width:0; }
.lrow:hover:not(.inert) { background:var(--accent-glow); }

/* The bar is the cell's own background fill, scaled on the compositor. Each
   row is measured against itself: the larger side fills, the other shows its
   share of it, which is the comparison being made when the eye is on a row. */
.lv { position:relative; order:2; display:flex; flex-direction:column;
  justify-content:center; padding:9px var(--sp-2) 11px; font-size:var(--fs-base);
  font-weight:900; font-variant-numeric:tabular-nums; overflow:hidden; }
.lv.a { text-align:left; align-items:flex-start; }
.lv.b { text-align:right; align-items:flex-end; }
/* Each side's bar grows from its own edge, under its own number, so the fill
   belongs to the value sitting on it. The larger side of a row fills
   completely and the other shows its share of it — a row whose two sides are
   equal and opposite therefore fills on both, which is what equal means. */
.lv::before { content:""; position:absolute; top:0; bottom:0; width:100%;
  background:currentColor; opacity:.16; transform:scaleX(var(--bar,0));
  transition:transform var(--dur-2) var(--ease-out); }
.lv.a::before { left:0; transform-origin:left center; }
.lv.b::before { right:0; transform-origin:right center; }
.lv > span { position:relative; }
.lv .side { display:block; margin-top:4px; max-width:100%; font-size:var(--fs-micro);
  font-weight:900; letter-spacing:.1em; text-transform:uppercase; color:var(--ink-3);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.lmid { grid-column:1 / -1; order:1; display:flex; align-items:center;
  gap:var(--sp-1) var(--sp-2); flex-wrap:wrap; padding:10px var(--sp-2) 9px;
  border-bottom:1px solid var(--line); }
.lname { flex:1 1 100%; display:flex; align-items:center; gap:7px;
  font-size:var(--fs-small); font-weight:900; letter-spacing:.01em; line-height:1.3; }
.lname button { flex:none; width:14px; height:14px; padding:0; background:none;
  border:1px solid var(--line-2); border-radius:50%; color:var(--ink-3); cursor:pointer;
  font-size:8px; font-weight:900; line-height:1; display:flex; align-items:center;
  justify-content:center;
  transition:color var(--dur-1) var(--ease-out), border-color var(--dur-1) var(--ease-out); }
.lname button:hover, .lname button[aria-expanded="true"] { color:var(--accent);
  border-color:var(--accent); }
.lslide { flex:1 1 100%; display:flex; align-items:center; gap:11px; }
.lw { flex:none; width:36px; text-align:right; font-size:var(--fs-micro); font-weight:900;
  font-variant-numeric:tabular-nums; color:var(--ink-3); }
.lw.moved { color:var(--accent); }
.lstate { flex:1 1 100%; text-align:left; font-size:var(--fs-micro); font-weight:900;
  letter-spacing:.1em; text-transform:uppercase; color:var(--ink-3); }
.lnote { grid-column:1 / -1; padding:0 var(--sp-2) var(--sp-2); }
.lnote > div { background:var(--inset); border-left:2px solid var(--accent);
  padding:9px 11px; font-size:var(--fs-small); line-height:1.55; color:var(--ink-2); }
.lnote em { display:block; margin-top:7px; font-style:normal; color:var(--ink-3);
  font-size:var(--fs-micro); letter-spacing:.06em; }
.sliderwrap { position:relative; flex:1; min-width:0; display:flex; align-items:center; }
.sliderwrap::before { content:""; position:absolute; left:50%; top:2px; bottom:2px;
  width:1px; background:var(--line-2); pointer-events:none; }
input[type=range].wslider { -webkit-appearance:none; appearance:none; flex:1;
  min-width:0; height:16px; background:transparent; cursor:pointer; margin:0; }
input[type=range].wslider::-webkit-slider-runnable-track { height:3px;
  background:var(--line-2); }
input[type=range].wslider::-moz-range-track { height:3px; background:var(--line-2); }
input[type=range].wslider::-webkit-slider-thumb { -webkit-appearance:none;
  appearance:none; width:10px; height:14px; margin-top:-5.5px; background:var(--accent);
  border:0; box-shadow:0 0 0 1px var(--field); cursor:grab; }
input[type=range].wslider::-moz-range-thumb { width:10px; height:14px; border-radius:0;
  background:var(--accent); border:0; box-shadow:0 0 0 1px var(--field); cursor:grab; }
input[type=range].wslider:focus-visible { outline:1px solid var(--accent);
  outline-offset:2px; }
.lrow.inert { opacity:.5; }
.lrow.inert .lv { color:var(--ink-3); }
.lfoot { display:grid; grid-template-columns:1fr 1fr; align-items:stretch;
  border-top:1px solid var(--line-2); background:var(--panel-2); }
.lfoot .lv { font-size:var(--fs-lg); }
.lfoot .lmid { justify-content:center; font-size:var(--fs-micro); font-weight:900;
  letter-spacing:.14em; text-transform:uppercase; color:var(--ink-3);
  border-bottom-color:var(--line-2); }
.lfolded { grid-column:1 / -1; padding:9px var(--sp-2); border-top:1px solid var(--line);
  text-align:center; font-size:var(--fs-micro); font-weight:800; letter-spacing:.05em;
  color:var(--ink-3); }
.lfolded b { color:var(--ink-2); font-weight:900; font-variant-numeric:tabular-nums; }

/* ==========================================================================
 * SUGGESTIONS / CONTEXT / DETAILS
 * ========================================================================== */
.grid { display:grid; gap:var(--sp-1); }
.grid.g3 { grid-template-columns:repeat(3,1fr); }
.grid.g2 { grid-template-columns:repeat(2,1fr); }
.grid > * { min-width:0; }
.rec { position:relative; display:flex; flex-direction:column; gap:var(--sp-1);
  border:1px solid var(--line); background:var(--panel-2); padding:var(--sp-2); }
.rec::before { content:""; position:absolute; left:-1px; right:-1px; top:-1px; height:2px;
  background:linear-gradient(90deg,var(--sky) 0%,transparent 78%); }
.rec .k { align-self:flex-start; font-size:var(--fs-micro); font-weight:900;
  letter-spacing:.16em; text-transform:uppercase; color:var(--sky); }
.rec .t { font-size:var(--fs-small); line-height:1.55; color:var(--ink); }
.rec .t b { font-weight:900; }
.rec .r { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:auto;
  padding-top:var(--sp-1); border-top:1px solid var(--line); font-size:var(--fs-micro);
  font-weight:900; letter-spacing:.1em; text-transform:uppercase; color:var(--ink-3); }
.leadnote { font-size:var(--fs-small); line-height:1.6; color:var(--ink-3);
  border-left:2px solid var(--line-2); padding-left:var(--sp-2); }
.flag { display:flex; gap:var(--sp-2); border:1px solid var(--line);
  background:var(--inset); padding:11px var(--sp-2); }
.flag .s { flex:none; max-width:104px; padding:2px 6px; height:fit-content;
  border:1px solid var(--line-2); font-size:var(--fs-micro); font-weight:900;
  letter-spacing:.1em; text-transform:uppercase; color:var(--ink-3);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.flag .s.both { color:var(--accent-deep); border-color:var(--accent-deep); }
.flag .c { min-width:0; }
.flag .c b { display:block; margin-bottom:4px; font-size:var(--fs-small); font-weight:900; }
.flag .c p { margin:0; font-size:var(--fs-small); line-height:1.55; color:var(--ink-3); }
.deflist { display:grid; grid-template-columns:auto 1fr; gap:9px var(--sp-2); margin:0;
  border:1px solid var(--line); background:var(--panel-2); padding:var(--sp-2);
  font-size:var(--fs-small); }
.deflist dt { font-size:var(--fs-micro); font-weight:900; letter-spacing:.12em;
  text-transform:uppercase; color:var(--ink-3); }
.deflist dd { margin:0; font-weight:800; color:var(--ink-2); }
.alertline { display:flex; align-items:flex-start; gap:var(--sp-2);
  padding:12px var(--sp-2); border:1px solid var(--signal); background:var(--signal-soft); }
.alertline.bad { border-color:var(--flag); background:var(--flag-soft); }
.alertline .i { flex:none; width:17px; height:17px; margin-top:1px; color:var(--signal); }
.alertline.bad .i { color:var(--flag); }
.alertline .i svg { width:100%; height:100%; display:block; }
.alertline .c { min-width:0; }
.alertline b { display:block; font-size:var(--fs-small); font-weight:900;
  letter-spacing:.1em; text-transform:uppercase; color:var(--signal); }
.alertline.bad b { color:var(--flag); }
.alertline p { margin:5px 0 0; font-size:var(--fs-small); line-height:1.55;
  color:var(--ink-2); }
.alertline .names { display:flex; flex-wrap:wrap; gap:5px; margin-top:9px; }
.alertline .names span { padding:3px 8px; border:1px solid var(--signal);
  background:var(--panel); font-size:var(--fs-micro); font-weight:900; color:var(--ink); }

/* ==========================================================================
 * BUILDER
 * ========================================================================== */
.build { display:grid; grid-template-columns:1fr 40px 1fr; border:1px solid var(--line);
  background:var(--panel); }
.build > * { min-width:0; }
.bcol { padding:var(--sp-2); }
.bsplit { display:flex; align-items:center; justify-content:center;
  border-left:1px solid var(--line); border-right:1px solid var(--line); }
.bhead { display:flex; align-items:center; gap:var(--sp-1); }
.bhead .lgo { width:26px; height:26px; flex:none; }
.bhead select { flex:1 1 auto; min-width:0; font-size:var(--fs-base);
  padding:9px 32px 9px 11px; text-overflow:ellipsis; }
.bctx { display:flex; flex-wrap:wrap; gap:6px 11px; margin:var(--sp-1) 0 var(--sp-2);
  font-size:var(--fs-micro); font-weight:800; letter-spacing:.08em;
  text-transform:uppercase; color:var(--ink-3); }
.bctx b { color:var(--ink-2); font-weight:900; font-variant-numeric:tabular-nums; }
.bctx .mine { color:var(--accent); }
.bctx .over { color:var(--flag); }
.rwrap { position:relative; border:1px solid var(--line); }
/* A soft edge where the list is cut, so it reads as continuing rather than
   stopping. Lifts once the list is at its end. */
.rwrap::after { content:""; position:absolute; left:1px; right:9px; bottom:1px;
  height:18px; pointer-events:none; z-index:2; opacity:var(--fade,1);
  background:linear-gradient(180deg, rgba(0,0,0,0), var(--inset) 82%);
  transition:opacity var(--dur-2) var(--ease-out); }
html[data-theme="light"] .rwrap::after {
  background:linear-gradient(180deg, rgba(255,255,255,0), var(--inset) 82%); }
.rlist { display:flex; flex-direction:column; max-height:calc(var(--row-h) * 8);
  overflow-y:auto; }
.rrow { display:flex; align-items:center; gap:9px; flex:none; height:var(--row-h);
  padding:0 10px; background:var(--inset); border:0; color:inherit; font:inherit;
  cursor:pointer; text-align:left;
  transition:background var(--dur-1) var(--ease-out), color var(--dur-1) var(--ease-out); }
.rrow + .rrow { border-top:1px solid var(--line); }
.rrow:hover { background:var(--panel-2); }
.rrow.on { background:var(--accent-glow); color:var(--accent); }
.rrow .posbadge { width:28px; font-size:8px; }
.rrow.on .posbadge { color:var(--accent); }
.rrow .nm { flex:1; min-width:0; font-size:var(--fs-small); font-weight:800;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.rrow .pj { flex:none; font-size:var(--fs-micro); font-weight:900;
  font-variant-numeric:tabular-nums; color:var(--ink-3); }
.rrow.on .pj { color:var(--accent); }

.result { display:flex; align-items:center; gap:var(--sp-2); flex-wrap:wrap; width:100%;
  padding:11px var(--sp-2); border:1px solid var(--line-2); background:var(--panel-2);
  text-align:left; color:inherit; font:inherit; cursor:pointer;
  transition:border-color var(--dur-1) var(--ease-out); }
.result:hover { border-color:var(--accent-deep); }
.result.flat { cursor:default; }
.result .w { flex:1; min-width:150px; }
/* Both of these are block: as inline spans the second ran straight on from the
   first and the margin that was meant to separate them did nothing. */
.result .w .b { display:block; font-size:var(--fs-base); font-weight:900;
  letter-spacing:-.01em; }
.result .w .d { display:block; margin-top:4px; font-size:var(--fs-micro);
  font-weight:800; letter-spacing:.1em; text-transform:uppercase; color:var(--ink-3); }
.result .t { flex:none; font-size:var(--fs-small); font-weight:900;
  font-variant-numeric:tabular-nums; color:var(--ink-3); }
.buildbody { overflow:hidden; }
.buildbody-inner { padding-top:var(--sp-3); }

/* ==========================================================================
 * FOOTER + STATES
 * ========================================================================== */
.toolfoot { margin-top:var(--sp-2); padding:10px 0 4px; text-align:center;
  border-top:1px solid var(--line); }
.toolfoot .gh { display:inline-flex; align-items:center; gap:7px; color:var(--ink-3);
  font-size:10px; text-transform:uppercase; letter-spacing:.16em; font-weight:900;
  text-decoration:none; }
.toolfoot .gh::before { content:""; width:5px; height:5px; background:currentColor;
  transform:rotate(45deg); }
.toolfoot .gh:hover { color:var(--accent); }
.loadbox { display:flex; align-items:center; justify-content:center; gap:11px;
  padding:var(--sp-4) var(--sp-2); color:var(--ink-3); font-size:var(--fs-small);
  font-weight:900; letter-spacing:.14em; text-transform:uppercase; }
.loadbox i { width:9px; height:9px; background:var(--accent); transform:rotate(45deg);
  animation:pulse 1.25s var(--ease-io) infinite; }
@keyframes pulse { 0%,100% { opacity:.25; } 50% { opacity:1; } }
html.stillness .loadbox i { animation:none; opacity:.7; }
.stickybar { display:none; }

/* ==========================================================================
 * RESPONSIVE — two breakpoints.
 * ========================================================================== */
@media (max-width:900px) {
  .grid.g3, .grid.g2 { grid-template-columns:1fr; }
  .ocsides { grid-template-columns:1fr auto 1fr; gap:var(--sp-1); }
  .octeam b { font-size:var(--fs-small); }
  .ocplayer { font-size:var(--fs-micro); gap:5px; }
  .ocplayer .posbadge { width:24px; }
  .deal { grid-template-columns:1fr; }
  .dealsplit { height:34px; border-left:0; border-right:0;
    border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
  .dealsplit .swapmark { transform:rotate(90deg); }
  .build { grid-template-columns:1fr; }
  .bsplit { display:none; }
  .bcol + .bcol { border-top:1px solid var(--line); }
  .rlist { max-height:calc(var(--row-h) * 7); }

  .stickybar { display:flex; position:fixed; left:0; right:0; bottom:0; z-index:50;
    align-items:center; gap:var(--sp-2);
    padding:9px 13px calc(9px + env(safe-area-inset-bottom));
    background:var(--panel); border-top:1px solid var(--accent-deep);
    box-shadow:0 -12px 28px -18px rgba(0,0,0,.8); }
  .stickybar .s { flex:none; font-size:var(--fs-micro); font-weight:900;
    letter-spacing:.1em; text-transform:uppercase; color:var(--ink-3); }
  .stickybar .b { flex:1; min-width:0; font-size:var(--fs-small); font-weight:900;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  body.hasbar { padding-bottom:60px; }
}
@media (max-width:480px) {
  .octeam .lgo { width:20px; height:20px; }
  /* The info line wraps at this width and a separator dot could end a line
     with nothing after it. Spacing carries the separation instead. */
  .ocinfo { gap:4px 14px; }
  .ocinfo .dot { display:none; }
  .vtot { gap:var(--sp-2); }
  .vtot .lbl { white-space:normal; overflow:visible; line-height:1.3; }
  .tab { padding:8px 10px; letter-spacing:.08em; }
  .deflist { grid-template-columns:1fr; gap:2px var(--sp-2); }
  .deflist dd { margin-bottom:var(--sp-1); }
}
html.stillness .meterneedle, html.stillness .lv::before { transition:none; }
`;

const INSTRUCTIONS = [
  ["01", "On the table", "Every trade proposed in this league and not yet answered, already analysed. Each card shows what either side is giving up; open one for the full breakdown. Nothing here accepts, declines or changes anything in ESPN."],
  ["02", "Build a trade", "Any two teams, not just yours. Tap players on either roster and the verdict follows as you go. A standing offer can be opened in the builder and taken apart."],
  ["03", "Two ways in, one answer", "A standing offer and one you put together yourself run through exactly the same evaluation, so they cannot disagree about the same deal."],
  ["04", "Twenty-eight statistics, eleven you can move", "Eleven carry a slider. The rest are fixed, and when they are folded away the total line says exactly what they are still contributing."],
  ["05", "A slider scales a result, not the model", "Setting injury risk to 0% removes the points that row was charging. It does not re-imagine a season in which nobody gets hurt."],
  ["06", "Colour means imbalance, not good or bad", "Red at either end of the meter means the same thing: a long way from even. A trade can be perfectly even and still leave both sides worse off, which is why the verdict also says whether anyone is actually gaining."],
  ["07", "Suggestions aim at fairness", "Where a deal leans far enough to be worth fixing, up to three single changes are offered that bring it closer to even. One of them may make the trade worse for you. That is the point of them."],
  ["08", "Some rows have nothing to say yet", "A few need about three games played. Until then they show greyed and contributing nothing, rather than quietly disappearing."],
];

/* ==========================================================================
 * Small pieces
 * ========================================================================== */
function SwapMark({ className = "" }) {
  return (
    <span className={"swapmark " + className} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" />
      </svg>
    </span>
  );
}

function WarnIcon() {
  return (
    <span className="i">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round">
        <path d="M12 8v5" />
        <circle cx="12" cy="16.6" r=".7" fill="currentColor" />
        <path d="M10.3 3.9 2.6 17.4A2 2 0 0 0 4.3 20.4h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      </svg>
    </span>
  );
}

const posClassOf = (p) => "pos-" + (p === "D/ST" ? "DST" : p);

/**
 * A weight slider.
 *
 * The input owns its value while a finger is on it and reports upward once per
 * animation frame. Committing on every input event meant a drag queued a React
 * render per pointer sample, which on a phone arrive faster than the tree can
 * be rebuilt; the thumb then lags the finger. The percentage beside it is
 * updated straight from the local value so it still tracks exactly.
 */
function Slider({ row, value, moved, onCommit }) {
  const [local, setLocal] = useState(value);
  const frame = useRef(0);
  const pending = useRef(value);
  const dragging = useRef(false);

  // Follow the outside only when it is not this slider being dragged, so a
  // reset or a weight-source switch still moves the thumb.
  useEffect(() => { if (!dragging.current) setLocal(value); }, [value]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const onInput = (e) => {
    const next = Number(e.target.value);
    dragging.current = true;
    pending.current = next;
    setLocal(next);
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      onCommit(pending.current);
    });
  };
  const settle = () => {
    dragging.current = false;
    if (frame.current) { cancelAnimationFrame(frame.current); frame.current = 0; }
    onCommit(pending.current);
  };

  return (
    <span className="lslide">
      <span className="sliderwrap">
        <input className="wslider" type="range" min="0" max="200" step="5"
          value={local} aria-label={"Weight for " + row.label}
          onChange={onInput} onPointerUp={settle} onBlur={settle}
          onTouchEnd={settle} />
      </span>
      <span className={"lw" + (moved ? " moved" : "")}>{local}%</span>
    </span>
  );
}

/**
 * Fixed-rate disclosure.
 *
 * The panel's height is set declaratively by the component; this only plays the
 * transition between the two states and leaves nothing behind. An earlier
 * version owned the height imperatively, which meant a frame where the
 * animation did not run left the content collapsed with no way back — the
 * analysis was in the DOM, fully rendered, and invisible.
 */
function slide(el, open) {
  if (!el || COARSE) return;
  if (document.documentElement.classList.contains("stillness")) return;
  const full = el.scrollHeight;
  const from = open ? 0 : full;
  const to = open ? full : 0;
  if (from === to) return;
  el.animate(
    [{ height: from + "px" }, { height: to + "px" }],
    { duration: Math.max(160, Math.min(820, Math.abs(to - from) / RATE)),
      easing: "cubic-bezier(.22,.7,.3,1)" },
  );
}

/* ==========================================================================
 * The analysis — one component, mounted wherever a trade needs explaining.
 * ========================================================================== */
function Analysis({ engine, trade, surfaceKey, weights, onWeights, onOpenInBuilder }) {
  const [tab, setTab] = useState("breakdown");
  const [showAll, setShowAll] = useState(true);
  const [note, setNote] = useState(null);
  const [copied, setCopied] = useState(false);
  const bodyRef = useRef(null);
  const prevH = useRef(0);

  /* Derived once per trade. Moving a slider changes what the rows are worth,
     never what they are. */
  const res = useMemo(() => engine.analyzeTrade(trade), [engine, trade]);
  const tot = engine.totalsFor(res);
  const v = engine.verdictFor(res, tot);

  /* The rebalancing pass scores roughly a hundred neighbouring trades, each a
     full evaluation. It has to follow the weights, but it does not have to hold
     up the drag: deferring it lets the ledger and the verdict repaint at once
     and the suggestions catch up when the thumb settles. Same answer, just not
     on the critical path. */
  const settled = useDeferredValue(weights);
  const recs = useMemo(() => {
    if (!res.valid) return [];
    engine.setWeights(settled.source, settled.session);
    const out = engine.recommend(res);
    engine.setWeights(weights.source, weights.session);
    return out;
  }, [engine, res, settled]);

  /* A tab swap changes the panel height by hundreds of pixels. Left alone that
     is a jump; animated at the disclosure rate it reads as the same panel
     changing rather than a new one arriving. */
  useEffect(() => {
    const el = bodyRef.current;
    if (!el || COARSE) return;
    if (document.documentElement.classList.contains("stillness")) return;
    const from = prevH.current;
    const to = el.scrollHeight;
    prevH.current = to;
    if (!from || !to || Math.abs(to - from) < 6) return;
    const a = el.animate([{ height: from + "px" }, { height: to + "px" }],
      { duration: Math.max(150, Math.min(360, Math.abs(to - from) / RATE)),
        easing: "cubic-bezier(.5,0,.2,1)" });
    a.onfinish = () => { el.style.height = ""; };
  }, [tab, showAll]);

  if (res.unsupported) {
    return (
      <div className="placeholder">
        <b>Three-team trade</b>
        <span>
          The engine evaluates two sides. This offer is listed so it is not
          silently missing, but it cannot be analysed.
        </span>
      </div>
    );
  }

  const A = res.ctxA.team;
  const B = res.ctxB.team;
  const blocking = res.gates.filter((g) => !g.passed && g.blocking);
  const ctxCount = res.flags.length
    + (res.drops.a.length ? 1 : 0) + (res.drops.b.length ? 1 : 0);

  const overlapIds = new Set();
  if (trade.overlapPlayers) for (const id of trade.overlapPlayers) overlapIds.add(id);

  const setW = (id, value) => onWeights({
    ...weights, session: { ...weights.session, [id]: value },
  });

  const shareLink = trade.source === "pending" && trade.id
    ? `${location.origin}/apps/trade-analyzer/?offer=${trade.id}`
    : `${location.origin}/apps/trade-analyzer/?a=${trade.a}&b=${trade.b}`
      + `&ao=${trade.aOut.join(".")}&bo=${trade.bOut.join(".")}`;

  const copy = () => {
    try { navigator.clipboard.writeText(shareLink); } catch { /* no clipboard */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const shown = res.rows.filter((r) => showAll || r.slider);
  const folded = res.rows.filter((r) => !showAll && !r.slider);
  let fa = 0; let fb = 0;
  for (const r of folded) {
    const w = engine.appliedWeight(r);
    fa += w * r.sideA.points; fb += w * r.sideB.points;
  }

  const barOf = (val, peak) =>
    (!peak || peak < 0.05 ? 0 : Math.min(1, Math.abs(val) / peak)).toFixed(3);

  /* The needle travels toward whichever side the deal favours. A positive gap
     is side A's advantage and side A is labelled at the left end, so it goes
     left. It was doing the reverse, pinning itself against the end belonging to
     the team the verdict had just named as losing. */
  const needle = v.gap === 0 ? 0
    : Math.max(-1, Math.min(1, (v.gap > 0 ? -1 : 1) * Math.min(v.imbalance, 1)));

  const Seg = ({ n, i, opts, onPick }) => (
    <div className="seg" style={{ "--n": n, "--i": i }}>
      <span className="segthumb" />
      {opts.map((o, idx) => (
        <button key={o[0]} type="button"
          className={"segbtn" + (idx === i ? " on" : "")}
          onClick={() => onPick(o[0])}>{o[1]}</button>
      ))}
    </div>
  );

  const Side = ({ team, gets }) => (
    <div className="dealcol">
      <div className="dealwho">
        <TeamLogo src={team.logo} alt="" />
        <span className="who">
          <b>{team.n}</b>
          <em>{engine.ownerOf(team)}</em>
        </span>
      </div>
      <div className="dealgets">Receives</div>
      {gets.length ? gets.map((p) => (
        <div className="pline" key={p.id}>
          <span className={"posbadge " + posClassOf(p.pos)}>{p.pos}</span>
          <span className="nm">
            {p.n} <i>{p.tm}{p.inj && p.inj !== "ACTIVE" && p.inj !== "NORMAL"
              ? " · " + p.inj : ""}</i>
          </span>
          {p.bl === "UNTOUCHABLE" || p.bl === "ON_THE_BLOCK"
            ? <span className={"mk " + p.bl} title={p.bl.replace(/_/g, " ").toLowerCase()} />
            : null}
          {overlapIds.has(p.id)
            ? <span className="mk overlap" title="also in another pending offer" /> : null}
          <span className="pj">{p.pr.toFixed(0)}</span>
        </div>
      )) : <div className="pline"><span className="nm"><i>nothing selected</i></span></div>}
    </div>
  );

  return (
    <div className="stack">
      {blocking.length ? (
        <div className="alertline bad">
          <WarnIcon />
          <span className="c">
            <b>{trade.source === "pending"
              ? "This proposal is no longer valid" : "This trade cannot be made"}</b>
            <p>
              {trade.source === "pending"
                ? "ESPN validated the deal when it was offered, so a check failing now means "
                  + "something has changed since: " : ""}
              {blocking.map((f) => f.reason).join("; ")}.
            </p>
          </span>
        </div>
      ) : null}

      <div className="deal">
        <Side team={A} gets={res.ctxB.outs} />
        <div className="dealsplit"><SwapMark /></div>
        <Side team={B} gets={res.ctxA.outs} />
      </div>

      <div className={"verdict v-" + v.key}>
        <span className={"vlabel band c-" + v.key}>
          {v.key === "none" ? v.label : v.plain}
        </span>
        <div className="vfor">
          {v.beneficiary
            ? <span>in favour of <b>{v.beneficiary.n}</b></span>
            : v.key === "none" ? null : <span>neither side is favoured</span>}
        </div>
        <div className="vdesc">
          {v.desc ? (
            <span className={"chip " + (v.descKey === "both" ? "good"
              : v.descKey === "one" ? "warn" : "")}>{v.desc}</span>
          ) : null}
          {res.meta.confidence === "low"
            ? <span className="chip warn">Early season</span> : null}
        </div>
        <div className="meter">
          <div className="metertrack">
            {[0.10, 0.25, 0.45, 0.75].flatMap((x) => [50 - x * 50, 50 + x * 50])
              .map((p, i) => <i key={i} style={{ left: p.toFixed(1) + "%" }} />)}
            <span className="meterneedle"
              style={{ left: (50 + needle * 50).toFixed(2) + "%" }} />
          </div>
          <div className="meterends">
            <span>{A.n}</span><span className="mid">Even</span><span>{B.n}</span>
          </div>
        </div>
        <div className="vtot">
          <div>
            <span className="lbl">{A.n}</span>
            <span className={"n num " + engine.numCls(tot.a)}>{engine.vp(tot.a)}</span>
          </div>
          <div>
            <span className="lbl">Gap</span>
            <span className="n">{Math.abs(v.gap).toFixed(1)}</span>
          </div>
          <div>
            <span className="lbl">{B.n}</span>
            <span className={"n num " + engine.numCls(tot.b)}>{engine.vp(tot.b)}</span>
          </div>
        </div>
      </div>

      <div className="tabbar">
        <div className="tabs">
          {[["breakdown", "Breakdown", null],
            ["suggestions", "Suggestions", recs.length],
            ["context", "Context", ctxCount],
            ["details", "Details", null]].map(([id, label, n]) => (
            <button key={id} type="button"
              className={"tab" + (tab === id ? " on" : "")}
              disabled={id === "suggestions" && recs.length === 0}
              onClick={() => setTab(id)}>
              {label}{n != null ? <span className="n">{n}</span> : null}
            </button>
          ))}
        </div>
        <div className="btnrow">
          <button className="minibtn sky" type="button" onClick={copy}>
            {copied ? "Link copied" : "Copy link"}
          </button>
          {trade.source === "pending" && onOpenInBuilder ? (
            <button className="minibtn" type="button"
              onClick={() => onOpenInBuilder(trade)}>Open in builder</button>
          ) : null}
        </div>
      </div>

      {tab === "breakdown" ? (
        <div className="ctlbar">
          <span className="ctlgroup">
            <span className="lab">Rows</span>
            <Seg n={2} i={showAll ? 1 : 0}
              opts={[["some", "Adjustable"], ["all", "All " + res.rows.length]]}
              onPick={(k) => setShowAll(k === "all")} />
          </span>
          {engine.adminDiffers ? (
            <span className="ctlgroup">
              <span className="lab">Weights</span>
              <Seg n={2} i={weights.source === "admin" ? 1 : 0}
                opts={[["developer", "Developer"], ["admin", "Admin"]]}
                onPick={(k) => onWeights({ source: k, session: {} })} />
            </span>
          ) : null}
          <button className="minibtn" type="button"
            onClick={() => onWeights({ ...weights, session: {} })}>Reset</button>
        </div>
      ) : null}

      <div className="tabbody" ref={bodyRef}>
        {tab === "breakdown" ? (
          <div className="ledger">
            {shown.map((r, idx) => {
              const w = engine.appliedWeight(r);
              const va = w * r.sideA.points;
              const vb = w * r.sideB.points;
              const peak = Math.max(Math.abs(va), Math.abs(vb));
              const dead = r.inert || r.off;
              const moved = weights.session[r.id] != null
                && weights.session[r.id] !== engine.baseWeight(r);
              const newGroup = idx === 0 || shown[idx - 1].group !== r.group;
              return (
                <React.Fragment key={r.id}>
                  {newGroup
                    ? <div className="lgroup">{engine.GROUPS[r.group]}</div> : null}
                  <div className={"lrow" + (dead ? " inert" : "")}>
                    <div className={"lv a num " + engine.numCls(va)}
                      style={{ "--bar": barOf(va, peak) }}>
                      <span>{dead ? "—" : engine.vp(va)}</span>
                      <span className="side">{A.n}</span>
                    </div>
                    <div className="lmid">
                      <span className="lname">
                        {r.label}
                        <button type="button"
                          aria-expanded={note === r.id}
                          aria-label="What this row measures"
                          onClick={() => setNote(note === r.id ? null : r.id)}>i</button>
                      </span>
                      {r.off ? <span className="lstate">{r.off}</span>
                        : r.inert ? <span className="lstate">Not enough data yet</span>
                        : r.slider ? (
                          <Slider row={r} value={Math.round(w * 100)} moved={moved}
                            onCommit={(pct) => setW(r.id, pct / 100)} />
                        ) : (
                          <span className="lstate">Fixed at {Math.round(w * 100)}%</span>
                        )}
                    </div>
                    <div className={"lv b num " + engine.numCls(vb)}
                      style={{ "--bar": barOf(vb, peak) }}>
                      <span>{dead ? "—" : engine.vp(vb)}</span>
                      <span className="side">{B.n}</span>
                    </div>
                    {note === r.id ? (
                      <div className="lnote">
                        <div>
                          {r.help}
                          <em>
                            {r.id} · default {Math.round(r.defaultWeight * 100)}%
                            {r.sideA.display ? " · " + r.sideA.display : ""}
                          </em>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </React.Fragment>
              );
            })}
            <div className="lfoot">
              <div className={"lv a num " + engine.numCls(tot.a)}
                style={{ "--bar": barOf(tot.a, Math.max(Math.abs(tot.a), Math.abs(tot.b))) }}>
                <span>{engine.vp(tot.a)}</span>
              </div>
              <div className="lmid">Total</div>
              <div className={"lv b num " + engine.numCls(tot.b)}
                style={{ "--bar": barOf(tot.b, Math.max(Math.abs(tot.a), Math.abs(tot.b))) }}>
                <span>{engine.vp(tot.b)}</span>
              </div>
              {folded.length ? (
                <div className="lfolded">
                  {folded.length} fixed rows are folded away and still counted:{" "}
                  <b>{engine.vp(fa)}</b> and <b>{engine.vp(fb)}</b>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {tab === "suggestions" ? (
          <div className="stack">
            <p className="leadnote">
              These aim at fairness, not at your advantage. A suggestion here may well
              make the deal worse for whichever side you are on.
            </p>
            <div className="grid g3">
              {recs.map((r, i) => {
                const side = r.side === "a" ? A : B;
                return (
                  <div className="rec" key={i}>
                    <span className="k">{r.kind}</span>
                    <div className="t">
                      {r.kind === "add" ? (
                        <span><b>{side.n}</b> sends <b>{r.player.n}</b> as well</span>
                      ) : r.kind === "remove" ? (
                        <span><b>{side.n}</b> takes <b>{r.player.n}</b> off the table</span>
                      ) : (
                        <span><b>{side.n}</b> sends <b>{r.player.n}</b> instead of{" "}
                          <b>{r.replaces.n}</b></span>
                      )}
                    </div>
                    <div className="r">
                      <span className={"band c-" + r.key}>{r.band}</span>
                      <span>·</span>
                      <span>imbalance {r.imbalance.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {tab === "context" ? (
          <div className="stack">
            {[res.ctxA, res.ctxB].filter((c) => c.drops.length).map((c) => (
              <div className="alertline" key={c.team.id}>
                <WarnIcon />
                <span className="c">
                  <b>{c.team.n} must release {c.drops.length}{" "}
                    player{c.drops.length > 1 ? "s" : ""}</b>
                  <p>
                    The roster is capped at {engine.ROSTER_CAP}. These are the cuts that
                    destroy the least value while keeping a legal lineup and staying
                    inside the position limits.
                  </p>
                  <span className="names">
                    {c.drops.map((p) => (
                      <span key={p.id}>{p.n} · {p.pos}</span>
                    ))}
                  </span>
                </span>
              </div>
            ))}
            <p className="leadnote">
              Nothing below moves the number. These are the things a person should weigh
              for themselves.
            </p>
            {res.flags.length ? (
              <div className="grid g2">
                {res.flags.map((f, i) => (
                  <div className="flag" key={i}>
                    <span className={"s" + (f.side === "both" ? " both" : "")}>
                      {f.side === "both" ? "Both" : f.side}
                    </span>
                    <span className="c"><b>{f.label}</b><p>{f.note}</p></span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="placeholder">
                <b>Nothing worth flagging</b>
                <span>
                  No trade-block positions, injury designations or overlapping offers
                  touch this deal.
                </span>
              </div>
            )}
          </div>
        ) : null}

        {tab === "details" ? (
          <dl className="deflist">
            <dt>Horizon</dt>
            <dd>Scoring periods {res.meta.horizon} · {res.meta.weeksRemaining} to play</dd>
            <dt>Confidence</dt><dd>{res.meta.confidence}</dd>
            <dt>Playoff odds</dt>
            <dd>{res.meta.oddsSource === "espn"
              ? "ESPN’s published figures; only the change is ours"
              : "Modelled internally — ESPN’s failed the coherence check"}</dd>
            <dt>Checks</dt>
            <dd>{res.gates.filter((g) => g.passed).length} of {res.gates.length} passed</dd>
            <dt>Engine</dt><dd>{res.meta.engineVersion}</dd>
            <dt>Data as of</dt><dd>{engine.fmtWhen(Date.parse(res.meta.dataAsOf))}</dd>
            {trade.source === "pending" ? (
              <React.Fragment>
                <dt>Proposed</dt><dd>{engine.fmtWhen(trade.proposed)}</dd>
                <dt>Expires</dt>
                <dd>{engine.fmtWhen(trade.expires)} · read from ESPN, never computed</dd>
                <dt>Awaiting</dt>
                <dd>{trade.awaiting && trade.awaiting.length
                  ? trade.awaiting.map((i) => {
                    const t = engine.teamById(i);
                    return t ? t.n : "Team " + i;
                  }).join(", ")
                  : "nobody — both sides have acted"}</dd>
              </React.Fragment>
            ) : null}
          </dl>
        ) : null}
      </div>
    </div>
  );
}

/* ==========================================================================
 * An offer, collapsed: who is sending what, then the judgement beneath.
 * ========================================================================== */
const OfferCard = React.memo(function OfferCard(
  { engine, trade, open, onToggle, children },
) {
  const bodyRef = useRef(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    slide(bodyRef.current, open);
  }, [open]);

  const A = engine.teamById(trade.a);
  const B = trade.b != null ? engine.teamById(trade.b) : null;
  const cd = engine.countdown(trade.expires);
  const unsupported = (trade.teams || 2) > 2 || !B;

  const cardRes = useMemo(
    () => (unsupported ? null : engine.analyzeTrade(trade)),
    [engine, trade, unsupported],
  );
  const band = cardRes
    ? { v: engine.verdictFor(cardRes, engine.totalsFor(cardRes)) } : null;

  const names = (ids) => ids.map((id) => engine.playerById(id)).filter(Boolean);
  const SideCol = ({ team, out, cls }) => (
    <div className={"ocside " + cls}>
      <div className="octeam">
        <TeamLogo src={team ? team.logo : ""} alt="" />
        <b>{team ? team.n : "Unknown team"}</b>
      </div>
      <span className="ocgives">Gives up</span>
      {out.length ? out.map((p) => (
        <div className="ocplayer" key={p.id}>
          <span className={"posbadge " + posClassOf(p.pos)}>{p.pos}</span>
          <span className="nm">{p.n}</span>
          <span className="pj">{p.pr.toFixed(0)}</span>
        </div>
      )) : <span className="ocnone">{unsupported ? "—" : "nothing"}</span>}
    </div>
  );

  return (
    <div className={"offer" + (open ? " open" : "")}>
      <button className="offercard" type="button" aria-expanded={open} onClick={onToggle}>
        <div className="ocsides">
          <SideCol team={A} out={names(trade.aOut || [])} cls="a" />
          <div className="ocswap"><SwapMark /></div>
          <SideCol team={B} out={names(trade.bOut || [])} cls="b" />
        </div>
        <div className="ocinfo">
          {unsupported ? (
            <span className="v band c-none">Three-team trade — not supported</span>
          ) : (
            <React.Fragment>
              <span className={"v band c-" + band.v.key}>
                {band.v.key === "even" ? "Even"
                  : band.v.plain + " " + band.v.beneficiary.n}
              </span>
              <span className="dot" />
              <span>{band.v.desc}</span>
            </React.Fragment>
          )}
          <span className="dot" />
          <span className={"exp " + cd.cls}>{cd.gone ? "Expired" : cd.text + " left"}</span>
          {trade.overlaps && trade.overlaps.length
            ? <span className="chip warn">Shared player</span> : null}
          {trade.hasPicks ? <span className="chip">Includes picks</span> : null}
        </div>
        <span className="chev turns" aria-hidden="true" />
      </button>
      <div className="offerbody" ref={bodyRef}
        style={{ height: open ? "auto" : "0px" }}>
        <div className="offerbody-inner">{open ? children : null}</div>
      </div>
    </div>
  );
});

/* ==========================================================================
 * The tool
 * ========================================================================== */
export default function TradeAnalyzer() {
  const preview = typeof window !== "undefined" ? window.__TRADE_PREVIEW__ : null;
  const [data, setData] = useState(preview || null);
  const [loading, setLoading] = useState(!preview);
  const [failed, setFailed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showInstr, setShowInstr] = useState(false);
  const [theme, setTheme] = useState(() =>
    (typeof document !== "undefined"
      ? document.documentElement.getAttribute("data-theme") : "dark") || "dark");
  const [tz, setTz] = useState(0);
  const gearRef = useRef(null);

  /* What the component actually got, for the preview badge. A payload that is
     present but empty and a payload that never arrived look identical on the
     page and completely different here. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.__TA_SEEN__ = data ? {
      ready: Boolean(data.ready), teams: (data.teams || []).length,
      pending: (data.pending || []).length, source: preview ? "inlined" : "fetched",
    } : { ready: false, teams: 0, pending: 0, source: preview ? "inlined" : "pending" };
  }, [data, preview]);

  useEffect(() => {
    if (preview) return;
    let live = true;
    fetch("/api/trade", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((j) => { if (live) { setData(j); setLoading(false); } })
      .catch(() => { if (live) { setFailed(true); setLoading(false); } });
    return () => { live = false; };
  }, [preview]);

  // Timestamps are rendered in the browser, in the zone chosen in settings.
  useEffect(() => {
    const on = () => setTz((n) => n + 1);
    window.addEventListener("tzchange", on);
    return () => window.removeEventListener("tzchange", on);
  }, []);

  const engine = useMemo(
    () => (data && data.ready ? createEngine(data, data.adminWeights || null) : null),
    [data],
  );
  useEffect(() => {
    if (!engine) return;
    const zone = readCookie("eft_tz");
    engine.setZone(zone && zone !== "device" ? zone : null);
  }, [engine, tz]);

  const offers = useMemo(() => {
    if (!engine) return [];
    const list = engine.crossReference(engine.DATA.pending.map((t) => ({ ...t })));
    for (const t of list) {
      const others = list.filter((o) => t.overlaps.indexOf(o.id) >= 0);
      t.overlapPlayers = others.flatMap((o) => o.aOut.concat(o.bOut));
    }
    return list;
  }, [engine]);

  const params = typeof window !== "undefined"
    ? new URLSearchParams(location.search) : new URLSearchParams();
  const expandAll = (typeof window !== "undefined" && window.__TRADE_EXPAND__)
    || params.get("expand") === "1";

  const [openId, setOpenId] = useState(() => params.get("offer") || null);
  useEffect(() => {
    if (expandAll && offers.length && !openId) setOpenId(offers[0].id);
  }, [expandAll, offers, openId]);

  const [weights, setWeights] = useState({ source: "developer", session: {} });

  /* Side A is the viewer's own team, from the same cookie every other tool on
     the site reads. Not a default this tool invents. */
  const myTeam = useMemo(() => {
    const forced = typeof window !== "undefined" ? window.__TRADE_TEAM__ : null;
    const id = forced || Number(readCookie(TEAM_COOKIE)) || null;
    if (!engine) return id;
    return id && engine.teamById(id) ? id : null;
  }, [engine]);
  /* Where the builder starts when nothing has chosen a team. Kept separate from
     myTeam so the "Your team" marker never claims a seat the viewer did not
     pick. */
  const seatA = myTeam || (engine ? (engine.DATA.teams[0] || {}).id : null);

  const [build, setBuild] = useState(null);
  useEffect(() => {
    if (!engine || build) return;
    const a = seatA || engine.DATA.teams[0].id;
    const b = (engine.DATA.teams.find((t) => t.id !== a) || {}).id;
    setBuild({ a, b, aOut: [], bOut: [] });
  }, [engine, seatA, build]);

  const [buildOpen, setBuildOpen] = useState(true);
  const buildBodyRef = useRef(null);
  const buildFirst = useRef(true);

  const buildTrade = useMemo(() => (build ? {
    source: "manual", a: build.a, b: build.b,
    aOut: build.aOut, bOut: build.bOut, teams: 2,
    overlaps: [], staleGates: false, expires: null,
  } : null), [build]);

  const buildReady = Boolean(buildTrade && buildTrade.aOut.length && buildTrade.bOut.length);

  useEffect(() => {
    if (buildFirst.current) { buildFirst.current = false; return; }
    slide(buildBodyRef.current, buildOpen && buildReady);
  }, [buildOpen, buildReady]);
  const buildRes = useMemo(
    () => (engine && buildReady ? engine.analyzeTrade(buildTrade) : null),
    [engine, buildTrade, buildReady],
  );
  const buildVerdict = useMemo(() => {
    if (!buildRes) return null;
    const tot = engine.totalsFor(buildRes);
    return { v: engine.verdictFor(buildRes, tot), tot };
  }, [engine, buildRes, weights]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("hasbar", buildReady);
    return () => document.body.classList.remove("hasbar");
  }, [buildReady]);

  const onScroll = useCallback((e) => {
    const el = e.currentTarget;
    const room = el.scrollHeight - el.clientHeight - el.scrollTop;
    if (el.parentNode) {
      el.parentNode.style.setProperty("--fade",
        String(Math.max(0, Math.min(1, room / 24))));
    }
  }, []);

  const openInBuilder = (trade) => {
    setBuild({ a: trade.a, b: trade.b, aOut: [...trade.aOut], bOut: [...trade.bOut] });
    setBuildOpen(true);
    setOpenId(null);
    const el = document.getElementById("buildsection");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const pickTeam = (side, id) => {
    setBuild((b) => {
      const next = { ...b, [side]: id, [side + "Out"]: [] };
      if (next.a === next.b) {
        const other = side === "a" ? "b" : "a";
        next[other] = (engine.DATA.teams.find((t) => t.id !== id) || {}).id;
        next[other + "Out"] = [];
      }
      return next;
    });
  };

  const togglePlayer = (side, id) => {
    setBuild((b) => {
      const key = side + "Out";
      const arr = b[key].indexOf(id) >= 0
        ? b[key].filter((x) => x !== id) : b[key].concat(id);
      return { ...b, [key]: arr };
    });
  };

  if (engine) engine.setWeights(weights.source, weights.session);

  const styleTag = (
    <style dangerouslySetInnerHTML={{ __html: `${PALETTES}\n${BASE_CSS}\n${CSS}` }} />
  );

  const Header = (
    <div className="toolhead">
      <a className="toolmark homelink" href="/" aria-label="Back to home">
        <svg className="mark" viewBox="0 0 1000 150" role="img"
          aria-label="ESPN Fantasy Tools">
          <text x="500" y="74" textAnchor="middle" textLength="980"
            lengthAdjust="spacingAndGlyphs" fontSize="86" fontWeight="900"
            letterSpacing="-2"
            fontFamily="ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif">
            <tspan className="m1">ESPN</tspan>
            <tspan className="m2"> FANTASY TOOLS</tspan>
          </text>
          <path className="rule" d="M10 100 H990" />
          <path className="rulelive" d="M10 100 H360" />
          <text x="500" y="137" textAnchor="middle" fontSize="30" fontWeight="700"
            letterSpacing="14" fill="var(--ink-3)"
            fontFamily="ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif">
            LEAGUE HQ
          </text>
        </svg>
      </a>
      <div className="toolid">
        <p className="eyebrow">Trade Analyzer</p>
        <div className="toolleague">{(data && data.leagueName) || "League"}</div>
      </div>
      <div className="toolctl">
        <button className="ctlbtn" type="button" title="How to use this tool"
          onClick={() => setShowInstr(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9.4" />
            <path d="M9.2 9.3a2.8 2.8 0 1 1 3.9 2.9c-.9.5-1.4 1-1.4 2.1" />
            <circle cx="12" cy="17.2" r=".55" fill="currentColor" stroke="none" />
          </svg>
        </button>
        <button className="ctlbtn" type="button" title="Site settings" ref={gearRef}
          aria-haspopup="dialog" onClick={() => setShowSettings((s) => !s)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
            strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3.1" />
            <path d="M19.1 14.6a1.5 1.5 0 0 0 .3 1.7l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.5 1.5 0 0 0-1.7-.3 1.5 1.5 0 0 0-.9 1.4v.2a2 2 0 1 1-4 0v-.1a1.5 1.5 0 0 0-1-1.4 1.5 1.5 0 0 0-1.7.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.5 1.5 0 0 0 .3-1.7 1.5 1.5 0 0 0-1.4-.9H3a2 2 0 1 1 0-4h.1a1.5 1.5 0 0 0 1.4-1 1.5 1.5 0 0 0-.3-1.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.5 1.5 0 0 0 1.7.3H9a1.5 1.5 0 0 0 .9-1.4V3a2 2 0 1 1 4 0v.1a1.5 1.5 0 0 0 .9 1.4 1.5 1.5 0 0 0 1.7-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.5 1.5 0 0 0-.3 1.7V9a1.5 1.5 0 0 0 1.4.9h.2a2 2 0 1 1 0 4h-.1a1.5 1.5 0 0 0-1.4.9z" />
          </svg>
        </button>
        <SettingsMenu open={showSettings} onClose={() => setShowSettings(false)}
          theme={theme} onTheme={setTheme} anchorRef={gearRef} />
      </div>
    </div>
  );

  if (loading || failed || !engine) {
    return (
      <React.Fragment>
        {styleTag}
        <div dangerouslySetInnerHTML={{ __html: BACKDROP }} />
        <div className="wrap">
          {Header}
          {failed || (data && !data.ready) ? (
            <div className="placeholder" style={{ marginTop: "40px" }}>
              <b>No trade data yet</b>
              <span>
                This tool reads the league&rsquo;s rosters and standing offers. If the
                league pull has not run yet, whoever runs the league can start it from
                Site Configuration.
              </span>
            </div>
          ) : (
            <div className="loadbox"><i />Reading the league</div>
          )}
          <div className="grow" />
          <div className="pageaction">
            <a className="pagebtn" href="/">&larr; Back to home</a>
          </div>
        </div>
      {showInstr ? (
        <div className="instr" role="dialog" aria-modal="true"
          aria-label="How to use the Trade Analyzer">
          <div className="instrwrap">
            <div className="instrhead">
              <h2>How this works</h2>
              <button className="ctlbtn" type="button" aria-label="Close"
                onClick={() => setShowInstr(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round">
                  <path d="M5 5l14 14M19 5L5 19" />
                </svg>
              </button>
            </div>
            {INSTRUCTIONS.map(([n, title, body]) => (
              <div className="istep" key={n}>
                <span className="inum">{n}</span>
                <span><b>{title}</b><p>{body}</p></span>
              </div>
            ))}
            <button className="primary" type="button"
              onClick={() => setShowInstr(false)}>Got it</button>
          </div>
        </div>
      ) : null}
      </React.Fragment>
    );
  }

  const teamA = build ? engine.teamById(build.a) : null;
  const teamB = build ? engine.teamById(build.b) : null;

  const BuilderCol = ({ side }) => {
    const team = side === "a" ? teamA : teamB;
    if (!team) return null;
    const sel = build[side + "Out"];
    const incoming = (side === "a" ? build.bOut : build.aOut)
      .map((id) => engine.playerById(id)).filter(Boolean);
    const after = engine.applyTrade(team.roster, sel, incoming);
    const over = engine.overLimits(after);
    const cut = Math.max(0, after.length - engine.ROSTER_CAP);
    return (
      <div className="bcol">
        <div className="bhead">
          <TeamLogo src={team.logo} alt="" />
          <select aria-label="Choose a team" value={team.id}
            onChange={(e) => pickTeam(side, Number(e.target.value))}>
            {engine.DATA.teams.map((t) => (
              <option key={t.id} value={t.id}
                disabled={t.id === (side === "a" ? build.b : build.a)}>{t.n}</option>
            ))}
          </select>
        </div>
        <div className="bctx">
          {side === "a" && myTeam === team.id
            ? <span className="mine">Your team</span> : null}
          <span>{engine.ownerOf(team)}</span>
          <span>waiver <b>{team.wr}</b></span>
          {team.pp != null ? <span>odds <b>{(team.pp * 100).toFixed(0)}%</b></span> : null}
          <span>roster <b>{after.length}/{engine.ROSTER_CAP}</b></span>
          {cut ? <span className="over">{cut} cut{cut > 1 ? "s" : ""} forced</span> : null}
          {over.length ? <span className="over">over {over.join(", ")}</span> : null}
        </div>
        <div className="rwrap">
          <div className="rlist scrollpane" onScroll={onScroll}>
            {team.roster.slice().sort((x, y) => y.pr - x.pr).map((p) => (
              <button key={p.id} type="button"
                className={"rrow" + (sel.indexOf(p.id) >= 0 ? " on" : "")}
                aria-pressed={sel.indexOf(p.id) >= 0}
                onClick={() => togglePlayer(side, p.id)}>
                <span className={"posbadge " + posClassOf(p.pos)}>{p.pos}</span>
                <span className="nm">{p.n}</span>
                <span className="pj">{p.pr.toFixed(0)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <React.Fragment>
      {styleTag}
      <div dangerouslySetInnerHTML={{ __html: BACKDROP }} />
      <div className="wrap">
        {Header}

        <div className="sechead">
          <span className="t">On the table</span>
          <span className="rule" />
          <span className="count">
            {offers.length ? offers.length + (offers.length === 1 ? " offer" : " offers")
              : "none open"}
          </span>
        </div>
        {offers.length ? (
          <div className="offerlist">
            {offers.map((t) => (
              <OfferCard key={t.id} engine={engine} trade={t}
                open={openId === t.id}
                onToggle={() => setOpenId(openId === t.id ? null : t.id)}>
                <Analysis engine={engine} trade={t} surfaceKey={t.id}
                  weights={weights} onWeights={setWeights}
                  onOpenInBuilder={openInBuilder} />
              </OfferCard>
            ))}
          </div>
        ) : (
          <div className="placeholder">
            <b>No offers on the table</b>
            <span>
              When somebody proposes a trade it appears here, already analysed, before
              anyone has to accept anything.
            </span>
          </div>
        )}

        <div id="buildsection">
          <div className="sechead">
            <span className="t">Build a trade</span>
            <span className="rule" />
            <span className="count">any two teams</span>
          </div>
          {build ? (
            <div className="stack">
              <div className="build">
                <BuilderCol side="a" />
                <div className="bsplit"><SwapMark /></div>
                <BuilderCol side="b" />
              </div>
              {buildReady ? (
                <button className="result" type="button" aria-expanded={buildOpen}
                  onClick={() => setBuildOpen((o) => !o)}>
                  <span className="w">
                    <span className={"b band c-" + buildVerdict.v.key}>
                      {buildVerdict.v.key === "none" ? buildVerdict.v.label
                        : buildVerdict.v.plain
                          + (buildVerdict.v.beneficiary
                            ? " " + buildVerdict.v.beneficiary.n : "")}
                    </span>
                    <span className="d">
                      {build.aOut.length} for {build.bOut.length} · {buildVerdict.v.desc}
                    </span>
                  </span>
                  <span className={"t num " + engine.numCls(buildVerdict.tot.a)}>
                    {engine.vp(buildVerdict.tot.a)}
                  </span>
                  <span className="t">/</span>
                  <span className={"t num " + engine.numCls(buildVerdict.tot.b)}>
                    {engine.vp(buildVerdict.tot.b)}
                  </span>
                  <span className="chev turns" aria-hidden="true" />
                </button>
              ) : (
                <div className="result flat">
                  <span className="w">
                    <span className="b" style={{ color: "var(--ink-3)" }}>No deal yet</span>
                    <span className="d">Pick at least one player on each side</span>
                  </span>
                </div>
              )}
            </div>
          ) : null}
          <div className="buildbody" ref={buildBodyRef}
            style={{ height: buildOpen && buildReady ? "auto" : "0px" }}>
            <div className="buildbody-inner">
              {buildOpen && buildReady ? (
                <Analysis engine={engine} trade={buildTrade} surfaceKey="build"
                  weights={weights} onWeights={setWeights} />
              ) : null}
            </div>
          </div>
        </div>

        <div className="grow" />
        <div className="pageaction">
          <a className="pagebtn" href="/">&larr; Back to home</a>
        </div>
        <div className="toolfoot">
          <a className="gh" href="https://github.com/shortcutsbin-netizen"
            target="_blank" rel="noopener noreferrer">GitHub - shortcutsbin-netizen</a>
        </div>
      </div>

      {showInstr ? (
        <div className="instr" role="dialog" aria-modal="true"
          aria-label="How to use the Trade Analyzer">
          <div className="instrwrap">
            <div className="instrhead">
              <h2>How this works</h2>
              <button className="ctlbtn" type="button" aria-label="Close"
                onClick={() => setShowInstr(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round">
                  <path d="M5 5l14 14M19 5L5 19" />
                </svg>
              </button>
            </div>
            {INSTRUCTIONS.map(([n, title, body]) => (
              <div className="istep" key={n}>
                <span className="inum">{n}</span>
                <span><b>{title}</b><p>{body}</p></span>
              </div>
            ))}
            <button className="primary" type="button"
              onClick={() => setShowInstr(false)}>Got it</button>
          </div>
        </div>
      ) : null}

      {buildReady ? (
        <div className="stickybar">
          <span className="s">{build.aOut.length} for {build.bOut.length}</span>
          <span className={"b band c-" + buildVerdict.v.key}>
            {buildVerdict.v.key === "none" ? buildVerdict.v.label
              : buildVerdict.v.plain
                + (buildVerdict.v.beneficiary ? " " + buildVerdict.v.beneficiary.n : "")}
          </span>
          <button className="minibtn sky" type="button"
            onClick={() => {
              setBuildOpen(true);
              const el = document.getElementById("buildsection");
              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
            }}>See it</button>
        </div>
      ) : null}
    </React.Fragment>
  );
}
