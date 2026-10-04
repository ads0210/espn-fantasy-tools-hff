/**
 * Site API page: its stylesheet. The tool look is LLM Data Export's (the header, sections, panels and the
 * code viewer); the page's own rules are the design sample's, scoped under .v-api on the page's root.
 */
export const TOOL_CSS = `
:root {
  --fs-micro: 9px; --fs-small: 11px; --fs-base: 13px; --fs-lg: 16px;
  --sp-1: 6px; --sp-2: 14px; --sp-3: 26px; --sp-4: clamp(36px, 5vw, 58px);
  --ease-out: cubic-bezier(.22,.7,.3,1); --ease-io: cubic-bezier(.5,0,.2,1);
  --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
}
* { box-sizing:border-box; }
button { -webkit-tap-highlight-color:transparent; font-family:inherit; }
.wrap { display:flex; flex-direction:column; }

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
.sechead { display:flex; flex-wrap:wrap; align-items:center; gap:10px var(--sp-2);
  margin:var(--sp-4) 0 var(--sp-3); }
.sechead::before { content:""; width:9px; height:9px; background:var(--accent);
  transform:rotate(45deg); flex:none; }
.sechead .t { font-size:clamp(15px,2.2vw,21px); font-weight:900; letter-spacing:.18em;
  text-transform:uppercase; line-height:1.1; flex:0 1 auto; min-width:0; overflow-wrap:anywhere;
  background:linear-gradient(94deg,var(--ink) 10%,var(--accent) 150%);
  -webkit-background-clip:text; background-clip:text;
  color:transparent; -webkit-text-fill-color:transparent; }
.sechead .rule { flex:1 1 32px; min-width:32px; height:1px;
  background:linear-gradient(90deg,var(--line-2),transparent); }
/* The subtitle drops to its own line rather than pushing past the edge. */
.sechead .count { flex:0 1 auto; max-width:100%; font-size:var(--fs-micro); font-weight:900;
  letter-spacing:.14em; text-transform:uppercase; color:var(--ink-3); line-height:1.3;
  overflow-wrap:anywhere; }

/* --- buttons -------------------------------------------------------------- */
.minibtn { display:inline-flex; align-items:center; justify-content:center; gap:7px;
  background:none; border:1px solid var(--line-2); color:var(--ink-2); cursor:pointer;
  font-size:var(--fs-micro); font-weight:900; letter-spacing:.14em; text-transform:uppercase;
  padding:9px 14px; min-height:34px; white-space:nowrap;
  transition:border-color .16s ease, color .16s ease, background .16s ease; }
.minibtn svg { width:13px; height:13px; flex:none; }
.minibtn:hover { border-color:var(--accent); color:var(--accent); }
.minibtn.go { border-color:var(--accent); color:var(--accent); }
.minibtn.go:hover { background:var(--accent); color:var(--field); }
.minibtn.done, .minibtn.done:hover { border-color:var(--accent); background:var(--accent);
  color:var(--field); }
.minibtn.fail, .minibtn.fail:hover { border-color:var(--flag); color:var(--flag); background:none; }
.minibtn:focus-visible, .seg button:focus-visible, .mapkey:focus-visible,
.more:focus-visible { outline:1px solid var(--accent); outline-offset:2px; }


/* --- your team ------------------------------------------------------------ */
.teampick { display:grid; grid-template-columns:minmax(0,380px) minmax(0,1fr);
  gap:var(--sp-2) var(--sp-3); align-items:center; }
.teamfacts { display:flex; flex-wrap:wrap; gap:0; min-width:0; }
.fact { padding:2px 16px 2px 0; margin-right:16px; border-right:1px solid var(--line); min-width:0; }
.fact:last-child { border-right:0; margin-right:0; }
.fact .k { display:block; font-size:var(--fs-micro); font-weight:900; letter-spacing:.14em;
  text-transform:uppercase; color:var(--ink-3); }
.fact .v { display:block; font-size:var(--fs-lg); font-weight:900; color:var(--ink);
  font-variant-numeric:tabular-nums; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  max-width:260px; }
.fact .v.acc { color:var(--accent); }
.fact .v small { display:block; margin-top:2px; font-size:11px; font-weight:600; letter-spacing:0; color:var(--ink-3); }
.callout { display:flex; align-items:flex-start; gap:10px; min-width:0; padding:10px 12px;
  border:1px solid var(--signal); background:var(--signal-soft); }
.callout svg { width:16px; height:16px; flex:none; margin-top:1px; color:var(--signal); }
.callout b { display:block; font-size:var(--fs-micro); font-weight:900; letter-spacing:.14em;
  text-transform:uppercase; color:var(--signal); margin-bottom:2px; }
.callout span { display:block; font-size:12.5px; line-height:1.5; color:var(--ink-2); }
@media (max-width:760px) {
  .teampick { grid-template-columns:1fr; }
  .teamfacts, .stats { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:12px 0; }
  .fact { margin-right:12px; padding-right:12px; }
  .fact:nth-child(3n), .fact:nth-last-child(2), .fact:last-child { border-right:0; margin-right:0; }
  .fact:last-child { grid-column:1 / -1; }
  .fact { display:flex; flex-direction:column; justify-content:space-between; }
  .fact .v { max-width:100%; }
}
@media (max-width:400px) {
  .fact { margin-right:8px; padding-right:8px; }
  .fact .k { letter-spacing:.08em; }
}

/* --- panel toolbars ------------------------------------------------------- */
.ctlrow { display:flex; align-items:center; flex-wrap:wrap; gap:10px var(--sp-2);
  margin-bottom:var(--sp-2); }
.ctlrow .grow { flex:1 1 auto; }
.stats { display:flex; flex-wrap:wrap; gap:10px 0; margin:var(--sp-2) 0 0; padding:10px 0 0;
  border-top:1px solid var(--line); min-width:0; }
.stats .fact .v { font-size:var(--fs-base); }
.stats .fact.file { flex:1 1 220px; min-width:0; }
.stats .fact.file .v { font:700 12px/1.45 var(--mono); color:var(--sky); white-space:normal;
  overflow-wrap:anywhere; max-width:none; }
.actions { display:flex; gap:8px; flex:none; }
@media (max-width:560px) {
  .actions { width:100%; }
  .actions .minibtn { flex:1 1 0; }
}

/* --- pills: what a prompt or a file carries ----------------------------- */
.pillrow { display:flex; flex-wrap:wrap; align-items:center; gap:6px; min-width:0; }
.pillrow + .pillrow { margin-top:8px; }
.plab { flex:none; width:74px; font-size:var(--fs-micro); font-weight:900; letter-spacing:.14em;
  text-transform:uppercase; color:var(--ink-3); }
.pill { display:inline-flex; align-items:center; gap:6px; max-width:100%; padding:5px 9px;
  border:1px solid var(--line-2); background:var(--panel-2); color:var(--ink-2);
  font-size:var(--fs-micro); font-weight:900; letter-spacing:.1em; text-transform:uppercase;
  line-height:1.3; overflow-wrap:anywhere; }
.pill::before { content:""; flex:none; width:5px; height:5px; background:currentColor;
  transform:rotate(45deg); }
.pill.ok::before { background:var(--accent); }
.pill.me { color:var(--accent); border-color:currentColor; background:var(--accent-glow); }
.pill.warn { color:var(--signal); border-color:currentColor; background:var(--signal-soft); }
.pill.off { color:var(--ink-3); background:none; border-style:dashed;
  text-decoration:line-through; text-decoration-thickness:1px; }
.pill.off::before { background:none; border:1px solid currentColor; }
.pill b { color:inherit; font-weight:900; font-variant-numeric:tabular-nums; }
@media (max-width:560px) { .plab { width:100%; } }

/* --- prompt --------------------------------------------------------------- */
.promptbox { position:relative; overflow:hidden; border:1px solid var(--line);
  background:var(--inset); }
.pv { padding:16px 18px 18px; font-size:13px; line-height:1.65; color:var(--ink-2);
  max-width:88ch; overflow-wrap:anywhere; }
.pv p { margin:0 0 10px; }
.pv p.lead { color:var(--ink); font-size:14px; }
.pv h4 { display:flex; align-items:center; gap:10px; margin:20px 0 9px; font-size:var(--fs-micro);
  font-weight:900; letter-spacing:.18em; text-transform:uppercase; color:var(--accent); }
.pv h4::before { content:""; width:6px; height:6px; flex:none; background:currentColor;
  transform:rotate(45deg); }
.pv h4::after { content:""; flex:1; height:1px; background:linear-gradient(90deg,var(--line-2),transparent); }
.pv ul, .pv ol { list-style:none; margin:0 0 10px; padding:0; }
.pv li { position:relative; margin:0 0 6px; padding-left:18px; }
.pv ul li::before { content:""; position:absolute; left:3px; top:.62em; width:5px; height:5px;
  border:1px solid var(--ink-3); transform:rotate(45deg); }
.pv ol li { padding-left:30px; }
.pv ol li::before { content:attr(data-n); position:absolute; left:0; top:0; width:22px;
  text-align:right; font-weight:900; color:var(--accent); font-variant-numeric:tabular-nums; }
.pv .key { font:700 12px var(--mono); color:var(--sky); }
.pv code { font:12px var(--mono); color:var(--sky); }
.pv .q { color:var(--ink); font-weight:700; }
.pv strong.q { font-weight:800; }
.pv .sep { color:var(--ink-3); }
.promptbox.shut::after { content:""; position:absolute; left:0; right:0; bottom:0; height:96px;
  background:linear-gradient(180deg, transparent, var(--inset) 88%); pointer-events:none; }
.more { display:flex; align-items:center; justify-content:center; gap:8px; width:100%;
  margin-top:-1px; padding:10px; background:none; border:1px solid var(--line);
  color:var(--sky); cursor:pointer; font-size:var(--fs-micro); font-weight:900;
  letter-spacing:.14em; text-transform:uppercase; }
.more:hover { border-color:var(--sky); }
.more i { width:7px; height:7px; border-right:1.5px solid currentColor;
  border-bottom:1.5px solid currentColor; transform:translateY(-2px) rotate(45deg);
  transition:transform .2s var(--ease-out); }
.more[aria-expanded="true"] i { transform:translateY(2px) rotate(-135deg); }

/* --- version switch ------------------------------------------------------- */
.seg { display:inline-flex; border:1px solid var(--line-2); flex:none; }
.seg button { background:none; border:0; cursor:pointer; padding:7px 14px; min-height:34px;
  color:var(--ink-3); font-size:var(--fs-micro); font-weight:900; letter-spacing:.14em;
  text-transform:uppercase; display:inline-flex; align-items:baseline; gap:7px; }
.seg button + button { border-left:1px solid var(--line-2); }
.seg button small { font-size:var(--fs-micro); font-weight:800; letter-spacing:.06em;
  color:var(--ink-3); text-transform:none; }
.seg button[aria-pressed="true"] { background:var(--accent); color:var(--field); }
.seg button[aria-pressed="true"] small { color:var(--field); opacity:.75; }

/* --- file map: the file drawn to scale ------------------------------------ */
.map { margin:var(--sp-2) 0 var(--sp-2); }
.mapbar { display:flex; height:14px; gap:2px; }
.mapbar i { display:block; min-width:3px; background:var(--line-2);
  transition:background .16s ease, transform .16s var(--ease-out); cursor:pointer;
  transform-origin:50% 100%; }
.mapbar i:nth-child(even) { background:var(--ink-3); opacity:.55; }
.mapbar i.on { background:var(--accent); opacity:1; transform:scaleY(1.45); }
.mapkeys { display:flex; flex-wrap:wrap; gap:4px 2px; margin-top:10px; }
.mapkey { display:inline-flex; align-items:baseline; gap:6px; background:none;
  border:1px solid transparent; cursor:pointer; padding:4px 8px; color:var(--ink-2);
  font:12px/1.2 var(--mono); }
.mapkey small { font:800 var(--fs-micro)/1 ui-sans-serif,system-ui,sans-serif;
  letter-spacing:.08em; color:var(--ink-3); font-variant-numeric:tabular-nums; }
.mapkey:hover { border-color:var(--line-2); }
.mapkey.on { border-color:var(--accent); color:var(--accent); }
.mapkey.empty { color:var(--ink-3); }

/* --- the viewer ----------------------------------------------------------- */
.viewer { position:relative; border:1px solid var(--line); background:var(--inset); }
.viewer .vbar { top:6px; bottom:6px; right:4px; }
.jsonview { position:relative; max-height:min(72vh, 780px); overflow-y:auto; overflow-x:hidden;
  padding:12px 12px 16px 0;
  font:12px/1.62 var(--mono); color:var(--ink-2); --gut:48px; --ind:1ch;
  /* One rule down the gutter, painted once, rather than a pseudo-element on
     every line: a few thousand of those, plus a CSS counter recalculated on
     every style change, is most of what made a long file scroll badly. */
  background-image:linear-gradient(90deg, transparent calc(var(--gut) + 6px),
    var(--line) calc(var(--gut) + 6px), var(--line) calc(var(--gut) + 7px),
    transparent calc(var(--gut) + 7px)); }
.jline { position:relative; white-space:pre-wrap; contain:layout paint;
  overflow-wrap:anywhere; word-break:normal;
  padding-left:calc(var(--gut) + 12px + (var(--d) * var(--ind) + 2ch)); text-indent:-2ch; }
.jnum { position:absolute; left:0; width:var(--gut); text-align:right; text-indent:0;
  color:var(--ink-3); opacity:.55; font-variant-numeric:tabular-nums;
  user-select:none; -webkit-user-select:none; }
.jk { color:var(--sky); }
.js { color:var(--accent); }
.jn { color:var(--gold); }
.jl { color:var(--signal); }
.jp { color:var(--ink-3); }
@media (max-width:560px) {
  .jsonview { font-size:11px; --gut:34px; --ind:.5ch; max-height:68vh; }
}

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
`;

export const PAGE_CSS = `/* ========================================================================
   Site API: the tool page, in the site's language.
   ======================================================================== */
.v-api { --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace; }
.v-api .wrap { min-height:0; }
.v-api .sechead:first-of-type { margin-top:var(--sp-3); }
.v-api .panel { margin-bottom:0; }
.v-api .panel + .panel { margin-top:14px; }
.v-api p { margin:0; }
.v-api .lede { color:var(--ink-2); font-size:13.5px; line-height:1.6; max-width:78ch; }
.v-api .lede + .lede { margin-top:8px; }
.v-api .lede b { color:var(--ink); }
.v-api code, .v-api .mono { font-family:var(--mono); font-size:.92em; }
.v-api .lede code, .v-api .small code { color:var(--sky); }
.v-api .small { font-size:12px; color:var(--ink-3); line-height:1.55; }
.v-api .minibtn[disabled] { opacity:.45; cursor:not-allowed; }
.v-api .minibtn[disabled]:hover { border-color:var(--line-2); color:var(--ink-2); }
.v-api .minibtn.warnb { border-color:var(--signal); color:var(--signal); }

/* --- the status strip ------------------------------------------------------ */
.apistrip { display:grid; grid-template-columns:minmax(0,1.9fr) repeat(3,minmax(0,1fr)); margin-top:var(--sp-3);
  border:1px solid var(--line); background:var(--panel); position:relative; }
.apistrip::before { content:""; position:absolute; left:-1px; right:-1px; top:-1px; height:2px;
  background:linear-gradient(90deg,var(--pc,var(--accent)) 0%,color-mix(in srgb,var(--pc,var(--accent)) 55%,transparent) 34%,transparent 78%); }
.scell { padding:14px 16px 13px; min-width:0; border-left:1px solid var(--line); display:flex; flex-direction:column; gap:3px; }
.scell:first-child { border-left:0; }
.scell .k { font-size:var(--fs-micro); font-weight:900; letter-spacing:.16em; text-transform:uppercase; color:var(--ink-3); }
.scell .v { font-size:15px; font-weight:900; color:var(--ink); display:flex; align-items:center; gap:7px; min-width:0; flex-wrap:wrap; }
.scell .s { font-size:12px; color:var(--ink-3); line-height:1.45; }
.scell .s b { color:var(--ink-2); font-weight:800; }
.scell .v .dot { width:7px; height:7px; transform:rotate(45deg); background:var(--c,var(--accent)); flex:none; }
.scell.warn .s { color:var(--signal); }
.pacecell { display:grid; grid-template-columns:auto minmax(0,1fr); gap:4px 16px; align-items:center; }
.pacecell .k { grid-column:1 / -1; }
.pacemeter { width:78px; height:78px; flex:none; position:relative; }
.pacemeter svg { width:100%; height:100%; display:block; overflow:visible; }
.pacemeter .ring { fill:none; stroke:var(--line-2); stroke-width:3; }
.pacemeter .sweep { fill:none; stroke:var(--pc,var(--accent)); stroke-width:3; stroke-linecap:butt;
  transform:rotate(-90deg); transform-origin:33px 33px; }
.pacemeter .round { fill:none; stroke:var(--pc,var(--accent)); stroke-width:7; opacity:.45; transform:rotate(-90deg); transform-origin:33px 33px; }
.pacemeter .tick { fill:var(--pc,var(--accent)); }
.pacemeter .lbl { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center;
  font-weight:900; line-height:1; color:var(--ink); }
.pacemeter .lbl b { font-size:17px; letter-spacing:-.02em; }
.pacemeter .lbl small { font-size:8.5px; letter-spacing:.14em; text-transform:uppercase; color:var(--ink-3); margin-top:3px; }
.pacetext { display:flex; flex-direction:column; gap:5px; min-width:0; }
.pacetext .v { font-size:clamp(15px,1.7vw,19px); letter-spacing:-.01em; }
.pacetext .s { font-size:12.5px; }
.pacechip { display:inline-flex; align-items:center; gap:6px; padding:2px 8px; border:1px solid currentColor;
  font-size:var(--fs-micro); font-weight:900; letter-spacing:.14em; text-transform:uppercase; color:var(--pc,var(--accent)); }
.pacechip::before { content:""; width:5px; height:5px; background:currentColor; transform:rotate(45deg); }
@media (max-width:900px) {
  .apistrip { grid-template-columns:repeat(3,minmax(0,1fr)); }
  .scell.pacecell { grid-column:1 / -1; border-left:0; border-bottom:1px solid var(--line); }
  .scell:nth-child(2) { border-left:0; }
}
@media (max-width:520px) {
  .apistrip { grid-template-columns:1fr; }
  .scell { border-left:0; border-top:1px solid var(--line); }
  .scell.pacecell { border-bottom:0; border-top:0; }
  .scell:not(.pacecell) { display:grid; grid-template-columns:92px minmax(0,1fr); gap:2px 10px; padding:10px 16px; }
  .scell:not(.pacecell) .k { padding-top:4px; }
  .scell:not(.pacecell) .s { grid-column:2; }
}

/* --- your key ---------------------------------------------------------------- */
.keygrid { display:grid; grid-template-columns:minmax(0,1fr); gap:12px; }
.keyrow { display:grid; grid-template-columns:92px minmax(0,1fr) auto; align-items:stretch; border:1px solid var(--line-2); background:var(--inset); min-width:0; }
.keyrow .kl { display:flex; align-items:center; gap:8px; padding:0 12px; border-right:1px solid var(--line-2);
  font-size:var(--fs-micro); font-weight:900; letter-spacing:.16em; text-transform:uppercase; color:var(--ink-2); }
.keyrow .kl::before { content:""; width:5px; height:5px; background:var(--accent); transform:rotate(45deg); flex:none; }
.keyrow .kv2 { padding:11px 13px; font:700 13.5px/1.35 var(--mono); color:var(--ink); overflow-wrap:anywhere; min-width:0; letter-spacing:.02em; }
.keyrow .kv2 .pre { color:var(--accent); }
.keyrow .kv2.masked { display:flex; align-items:baseline; min-width:0; }
.keyrow .kv2 .dots { color:var(--ink-3); letter-spacing:.12em; flex:0 1 auto; min-width:0; overflow:hidden; white-space:nowrap; }
.keyrow .kv2 .pre, .keyrow .kv2 .tail { flex:none; }
.keyrow .kv2 .tail { color:var(--ink-2); }
.keyrow .kact { display:flex; align-items:center; gap:6px; padding:6px; border-left:1px solid var(--line-2); }
.keyrow .kact .minibtn { min-height:32px; padding:7px 11px; }
.keyrow.base .kv2 { color:var(--sky); font-weight:600; }
@media (max-width:560px) {
  .keyrow { grid-template-columns:minmax(0,1fr) auto; }
  .keyrow .kl { grid-column:1 / -1; border-right:0; border-bottom:1px solid var(--line-2); padding:7px 12px; }
  .keyrow .kact { border-left:0; }
}
.keyfacts { display:flex; flex-wrap:wrap; gap:10px 0; padding-top:12px; border-top:1px solid var(--line); }
.keyfacts .fact .v { font-size:var(--fs-base); }
.keyfacts .fact .v.warn { color:var(--signal); }
.infonote { display:flex; gap:10px; align-items:flex-start; padding:10px 12px; border:1px solid var(--line-2); background:var(--inset); }
.infonote svg { width:16px; height:16px; flex:none; margin-top:1px; color:var(--sky); }
.infonote b { display:block; font-size:var(--fs-micro); font-weight:900; letter-spacing:.14em; text-transform:uppercase; color:var(--sky); margin-bottom:2px; }
.infonote span { display:block; font-size:12.5px; line-height:1.5; color:var(--ink-2); }
.infonote.warn { border-color:var(--signal); background:var(--signal-soft); }
.infonote.warn svg, .infonote.warn b { color:var(--signal); }
.infonote.bad { border-color:var(--flag); background:var(--flag-soft); }
.infonote.bad svg, .infonote.bad b { color:var(--flag); }
.infonote.ok { border-color:color-mix(in srgb,var(--accent) 60%,transparent); background:var(--accent-glow); }
.infonote.ok svg, .infonote.ok b { color:var(--accent); }

/* --- endpoints --------------------------------------------------------------------- */
.eptabs { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:6px; margin-bottom:14px; }
.eptab { position:relative; display:flex; flex-direction:column; align-items:flex-start; gap:5px; min-width:0; text-align:left;
  padding:11px 12px 10px; background:var(--panel); border:1px solid var(--line); cursor:pointer; color:var(--ink-2);
  transition:border-color .16s ease, background .16s ease; font-family:inherit; }
.eptab:hover { border-color:var(--line-2); }
.eptab[aria-selected="true"] { border-color:var(--accent); background:linear-gradient(180deg,var(--accent-glow),transparent 70%), var(--panel); color:var(--ink); }
.eptab[aria-selected="true"]::after { content:""; position:absolute; left:50%; bottom:-8px; width:10px; height:10px; background:var(--panel);
  border-right:1px solid var(--accent); border-bottom:1px solid var(--accent); transform:translateX(-50%) rotate(45deg); }
.eptab .m { font:900 9px/1 var(--mono); letter-spacing:.1em; color:var(--field); background:var(--accent); padding:3px 5px 2px; }
.eptab[aria-selected="false"] .m { background:var(--line-2); color:var(--ink-2); }
.eptab .p { font:800 13.5px/1.2 var(--mono); color:inherit; overflow-wrap:anywhere; }
.eptab .z { font-size:var(--fs-micro); font-weight:900; letter-spacing:.12em; text-transform:uppercase; color:var(--ink-3); line-height:1.3; }
@media (max-width:760px) { .eptabs { grid-template-columns:repeat(3,minmax(0,1fr)); } .eptab[aria-selected="true"]::after { display:none; } }
@media (max-width:420px) { .eptabs { grid-template-columns:repeat(2,minmax(0,1fr)); } }
.epcard .epsent { font-size:14.5px; line-height:1.55; color:var(--ink); max-width:80ch; }
.epfacts { display:flex; flex-wrap:wrap; gap:10px 0; margin-top:14px; }
.epfacts .fact .v { font-size:var(--fs-base); white-space:normal; max-width:none; }
.epfacts .fact.wide { flex:1 1 260px; }
.epfacts .fact.wide .v { font-weight:700; color:var(--ink-2); font-size:12.5px; line-height:1.45; }
.urlline { display:flex; align-items:stretch; margin-top:16px; border:1px solid var(--line-2); background:var(--inset); min-width:0; }
.urlline .meth { flex:none; display:flex; align-items:center; padding:0 10px; font:900 10px/1 var(--mono); letter-spacing:.1em; color:var(--field); background:var(--accent); }
.urlline .u { flex:1; min-width:0; padding:10px 12px; font:600 12.5px/1.45 var(--mono); color:var(--ink-2); overflow-wrap:anywhere; }
.urlline .u .h { color:var(--ink-3); }
.urlline .u .pth { color:var(--ink); font-weight:800; }
.urlline .u .q { color:var(--gold); }
.urlline .u .kk { color:var(--sky); }
.urlline .ua { flex:none; display:flex; align-items:center; padding:5px; border-left:1px solid var(--line-2); }
.urlline .ua .minibtn { min-height:30px; padding:6px 10px; }
.epctl { display:flex; flex-wrap:wrap; align-items:center; gap:10px 14px; margin-top:14px; }
.epctl .eppick { flex:0 1 360px; min-width:min(100%,260px); }
.epctl .grow { flex:1 1 auto; }
.tryrow { display:flex; flex-wrap:wrap; align-items:center; gap:8px 12px; }
.trynote { font-size:11.5px; color:var(--ink-3); line-height:1.4; max-width:44ch; }
.trynote b { color:var(--ink-2); }
.trynote.wait b { color:var(--signal); }
.tryout { margin-top:14px; }
.tryhead { display:flex; flex-wrap:wrap; align-items:center; gap:8px 12px; margin-bottom:10px; }
.status { display:inline-flex; align-items:center; gap:8px; font:800 12px/1 var(--mono); padding:7px 10px; border:1px solid var(--accent); color:var(--accent); }
.status.e4 { border-color:var(--signal); color:var(--signal); }
.status.e5 { border-color:var(--flag); color:var(--flag); }
.tryhead .meta { font:600 11.5px/1.4 var(--mono); color:var(--ink-3); }
.tryhead .grow { flex:1 1 auto; }
.hdrs { border:1px solid var(--line); background:var(--inset); padding:12px 14px; font:12px/1.7 var(--mono); color:var(--ink-2); overflow-wrap:anywhere; }
.hdrs b { color:var(--sky); font-weight:600; }
.hdrs .st { color:var(--accent); font-weight:800; }
.tview { max-height:min(62vh,560px); border:1px solid var(--line); }
.tview table { border-collapse:collapse; width:max-content; min-width:100%; font-size:12px; }
.tview th { position:sticky; top:0; z-index:1; background:var(--panel-2); color:var(--ink-3); text-align:center; font-size:var(--fs-micro);
  font-weight:900; letter-spacing:.12em; text-transform:uppercase; padding:8px 10px; border-bottom:1px solid var(--line-2); white-space:nowrap; }
.tview td { padding:7px 10px; border-bottom:1px solid var(--line); white-space:nowrap; color:var(--ink-2); font-variant-numeric:tabular-nums; }
.tview td.num { color:var(--ink); }
.tview td.txt { color:var(--ink); }
.tview td.nul { color:var(--ink-3); font-style:italic; }
.tview tr:nth-child(even) td { background:color-mix(in srgb,var(--inset) 60%,transparent); }
.jsonview .jline .jk { color:var(--sky); }
.more.inline { margin-top:10px; }
.fguide { margin-top:14px; }
.fgtable { width:100%; border-collapse:collapse; font-size:12.5px; }
.fgtable th { text-align:center; font-size:var(--fs-micro); font-weight:900; letter-spacing:.14em; text-transform:uppercase; color:var(--ink-3);
  padding:8px 10px; border-bottom:1px solid var(--line-2); white-space:nowrap; }
.fgtable td { padding:8px 10px; border-bottom:1px solid var(--line); vertical-align:top; color:var(--ink-2); line-height:1.45; }
.fgtable td:first-child { font:700 12px/1.45 var(--mono); color:var(--sky); white-space:nowrap; }
.fgtable td.ty { font-size:var(--fs-micro); font-weight:900; letter-spacing:.12em; text-transform:uppercase; color:var(--ink-3); white-space:nowrap; }
.fgtable td.ex { font:12px/1.45 var(--mono); color:var(--gold); max-width:220px; overflow-wrap:anywhere; }
.fgtable td.ex.t { color:var(--accent); }
@media (max-width:640px) {
  .fgtable thead { display:none; }
  .fgtable tr { display:grid; grid-template-columns:minmax(0,1fr) auto; padding:9px 0; border-bottom:1px solid var(--line); }
  .fgtable td { border:0; padding:2px 2px; }
  .fgtable td.me { grid-column:1 / -1; }
  .fgtable td.ex { grid-column:1 / -1; max-width:none; }
}
.disc { overflow:hidden; }

/* --- platform guides ------------------------------------------------------------------ */
.gintro { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,430px); gap:14px 26px; align-items:center; }
@media (max-width:760px) { .gintro { grid-template-columns:1fr; } }
.plats { margin-top:14px; display:flex; flex-direction:column; gap:10px; }
.plat { border:1px solid var(--line); background:var(--panel); position:relative; scroll-margin-top:60px; }
.plat.open { border-color:var(--line-2); }
.plat.open::before { content:""; position:absolute; left:-1px; top:-1px; bottom:-1px; width:2px; background:linear-gradient(180deg,var(--accent),var(--accent-deep) 40%,transparent); }
.plathead { width:100%; display:grid; grid-template-columns:auto minmax(0,1fr) auto; grid-template-rows:auto auto; gap:0 16px; align-items:center; padding:16px 18px;
  background:none; border:0; cursor:pointer; text-align:left; color:var(--ink); font-family:inherit; }
.plathead .gl { grid-row:1 / span 2; width:48px; height:48px; padding:9px; color:var(--accent); border:1px solid color-mix(in srgb,var(--accent) 45%,var(--line));
  background:radial-gradient(circle at 50% 30%,color-mix(in srgb,var(--accent) 16%,transparent),transparent 72%),var(--inset);
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--accent) 8%,transparent); transition:border-color .16s ease, box-shadow .16s ease; }
.plathead .gl svg { width:100%; height:100%; display:block; }
.plathead:hover .gl, .plat.open .plathead .gl { border-color:var(--accent); box-shadow:0 0 18px -6px var(--accent-glow), inset 0 0 0 1px color-mix(in srgb,var(--accent) 16%,transparent); }
.plathead .pk { grid-column:2; font-size:var(--fs-micro); font-weight:900; letter-spacing:.2em; text-transform:uppercase; color:var(--ink-3); line-height:1.3; }
.plathead .nm { grid-column:2; justify-self:start; font-size:clamp(17px,2vw,21px); letter-spacing:.04em; text-transform:uppercase; line-height:1.18; margin:2px 0 0; overflow-wrap:anywhere; }
.plathead .sm { grid-column:2; display:flex; flex-wrap:wrap; align-items:stretch; justify-self:start; max-width:100%; border:1px solid color-mix(in srgb,var(--flag) 40%,var(--line)); font-size:12px; line-height:1.4; }
.plathead .smk { display:inline-flex; align-items:center; gap:6px; padding:4px 9px; background:var(--flag-soft); color:var(--flag); font-size:var(--fs-micro); font-weight:900; letter-spacing:.14em; text-transform:uppercase; white-space:nowrap; }
.plathead .smk svg { width:12px; height:12px; flex:none; }
.plathead .smv { padding:4px 10px; color:var(--ink-2); font-weight:700; min-width:0; }
.plathead .cnt { grid-column:3; grid-row:1 / span 2; display:flex; align-items:center; gap:14px; }
.plathead .jc { padding:4px 9px; border:1px solid var(--line-2); font-size:var(--fs-micro); font-weight:900; letter-spacing:.14em; text-transform:uppercase; color:var(--ink-2); white-space:nowrap; }
.chev { width:8px; height:8px; border-right:2px solid var(--accent); border-bottom:2px solid var(--accent); transform:rotate(45deg) translate(-2px,-2px); transition:transform .2s var(--ease-out); flex:none; }
[aria-expanded="true"] > .cnt .chev, [aria-expanded="true"] .chev.own { transform:rotate(225deg) translate(-2px,-2px); }
@media (max-width:560px) {
  .plathead { gap:0 12px; padding:14px 14px; }
  .plathead .gl { width:40px; height:40px; padding:7px; grid-row:1 / span 2; }
  .plathead .sm { grid-column:1 / -1; margin-top:10px; }
  .plathead .cnt { grid-row:1 / span 2; }
  .plathead .jc { display:none; }
}
.platbody { padding:0 18px 18px; }
@media (max-width:560px) { .platbody { padding:0 12px 14px; } }
.platnote { display:flex; flex-wrap:wrap; gap:6px 14px; align-items:center; padding:10px 12px; margin-bottom:12px; border:1px dashed var(--line-2); font-size:12px; color:var(--ink-2); line-height:1.5; }
.platnote .pacechip { flex:none; }
.jobs { display:flex; flex-direction:column; gap:8px; }
.job { border:1px solid var(--line); background:color-mix(in srgb,var(--inset) 55%,transparent); transition:border-color .16s ease; }
.job.open { border-color:var(--line-2); background:var(--inset); }
.jobhead { width:100%; display:grid; grid-template-columns:34px minmax(0,1fr) auto auto; gap:3px 14px; align-items:center; padding:13px 14px;
  background:none; border:0; cursor:pointer; text-align:left; color:var(--ink); font-family:inherit; }
.jobhead .ix { grid-row:1 / span 2; width:34px; height:34px; display:grid; place-items:center; font:900 12px/1 var(--mono); color:var(--accent);
  border:1px solid color-mix(in srgb,var(--accent) 50%,var(--line)); background:color-mix(in srgb,var(--accent) 7%,transparent); }
.job.open .jobhead .ix { background:var(--accent); color:var(--field); border-color:var(--accent); }
.jobhead .jt { grid-column:2; font-size:15px; font-weight:900; letter-spacing:.01em; line-height:1.3; transition:color .16s ease; }
.jobhead .jh { grid-column:2; font-size:12.5px; color:var(--ink-3); line-height:1.45; }
.jobhead .jrun { grid-column:3; grid-row:1 / span 2; display:inline-flex; align-items:center; gap:6px; padding:4px 9px; border:1px solid var(--line-2);
  font-size:var(--fs-micro); font-weight:900; letter-spacing:.12em; text-transform:uppercase; color:var(--ink-2); white-space:nowrap; }
.jobhead .jrun svg { width:12px; height:12px; color:var(--sky); flex:none; }
.jobhead .chev { grid-column:4; grid-row:1 / span 2; }
.jobhead:hover .jt { color:var(--accent); }
@media (max-width:760px) {
  .jobhead { grid-template-columns:34px minmax(0,1fr) auto; }
  .jobhead .jrun { grid-column:2; grid-row:3; justify-self:start; margin-top:6px; white-space:normal; }
  .jobhead .chev { grid-column:3; }
}
.jobbody { padding:6px 16px 20px 62px; border-top:1px solid var(--line); }
@media (max-width:760px) { .jobbody { padding:6px 12px 16px; } }
.jobgrid { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,340px); gap:0 26px; align-items:start; }
@media (max-width:980px) { .jobgrid { grid-template-columns:minmax(0,1fr); } }
.jcol { min-width:0; }
.jsec { padding-top:22px; }
.v-api .jlab, .jlab { display:flex; align-items:center; gap:8px; font-size:var(--fs-micro); font-weight:900; letter-spacing:.16em; text-transform:uppercase; color:var(--accent); margin:0 0 12px; }
.jlab::before { content:""; width:5px; height:5px; background:currentColor; transform:rotate(45deg); flex:none; }
.jlab::after { content:""; flex:1; height:1px; background:linear-gradient(90deg,var(--line-2),transparent); }
.jlab.stoplab { color:var(--flag); }
.steps { list-style:none; margin:0; padding:0; counter-reset:st; display:flex; flex-direction:column; gap:10px; }
.steps li { position:relative; padding:0 0 0 34px; font-size:13px; line-height:1.55; color:var(--ink-2); counter-increment:st; }
.steps li::before { content:counter(st,decimal-leading-zero); position:absolute; left:0; top:0; width:22px; height:20px; display:grid; place-items:center;
  font:900 10.5px/1 var(--mono); color:var(--accent); border:1px solid color-mix(in srgb,var(--accent) 40%,var(--line)); }
.steps li b { color:var(--ink); }
.steps li code { color:var(--sky); font-size:12px; }
.codebox { border:1px solid var(--line); background:var(--inset); }
.codebox + .codebox { margin-top:12px; }
.codebar { display:flex; align-items:center; gap:10px; padding:7px 8px 7px 12px; border-bottom:1px solid var(--line); background:color-mix(in srgb,var(--panel) 60%,transparent); }
.codebar .fn { flex:1; min-width:0; font:800 11.5px/1.3 var(--mono); color:var(--ink); overflow-wrap:anywhere; }
.codebar .fn::before { content:"▸ "; color:var(--accent); }
.codebar .fn small { color:var(--ink-3); font-weight:600; margin-left:6px; }
.codebar .minibtn { min-height:28px; padding:5px 10px; }
.codepane { max-height:520px; }
.code.wrapcode { white-space:pre-wrap; overflow-wrap:anywhere; width:auto; }
.codebox .xywrap .sbar { margin:0; border-left:0; border-right:0; }
.code { margin:0; padding:12px 14px 14px; font:12px/1.62 var(--mono); color:var(--ink-2); white-space:pre; tab-size:4; width:max-content; min-width:100%; box-sizing:border-box; }
.code .c { color:var(--ink-3); font-style:italic; }
.code .s { color:var(--accent); }
.code .n { color:var(--gold); }
.code .k { color:var(--sky); }
.code .key { color:var(--signal); }
.code .kw { color:#C792EA; }
html[data-theme="light"] .code .kw { color:#7A3E9D; }
@media (max-width:560px) { .code { font-size:11px; } }
.stopbox { border:1px solid var(--flag); background:var(--flag-soft); }
.stopbox .sbh { display:flex; align-items:center; gap:8px; padding:9px 14px; border-bottom:1px solid color-mix(in srgb,var(--flag) 35%,transparent); background:color-mix(in srgb,var(--flag) 10%,transparent); }
.stopbox .sbh svg { width:15px; height:15px; flex:none; color:var(--flag); }
.stopbox .sbh b { font-size:var(--fs-micro); font-weight:900; letter-spacing:.14em; text-transform:uppercase; color:var(--flag); }
.stopbox p { padding:12px 14px 13px; font-size:12.5px; line-height:1.6; color:var(--ink-2); }
.stopbox p code { color:var(--ink); }
.stopbox p b { color:var(--ink); }
.jobnote { margin-top:10px; }

/* "What it looks like working": small drawn stand-ins for each platform. */
.looks { border:1px solid var(--line); background:var(--inset); padding:14px; }
.looks .cap { font-size:11px; color:var(--ink-3); margin-top:10px; line-height:1.45; }
.term { background:#070907; border:1px solid #1d251e; padding:10px 12px; font:11.5px/1.6 var(--mono); color:#B9D6BA; white-space:pre-wrap; overflow-wrap:anywhere; }
.term .pr { color:#63FF4A; }
.term .dim { color:#5E7260; }
.term .err { color:#FF7070; }
html[data-theme="light"] .term { background:#0E130F; }
.sheet { border:1px solid var(--line-2); background:var(--panel); font-size:11px; overflow:hidden; }
.sheet .sbar { margin:0; border-left:0; border-right:0; }
.sheet table { border-collapse:collapse; width:max-content; min-width:100%; }
.sheet td, .sheet th { border:1px solid var(--line); padding:3px 7px; white-space:nowrap; text-align:center; font-variant-numeric:tabular-nums; }
.sheet th { background:var(--panel-2); color:var(--ink-3); font-weight:700; text-align:center; font-size:10px; }
.sheet td.hd { font-weight:800; color:var(--ink); background:color-mix(in srgb,var(--accent) 7%,transparent); }
.sheet td.rn { color:var(--ink-3); background:var(--panel-2); text-align:center; font-size:10px; width:18px; }
.sheet .fx { display:flex; gap:8px; align-items:center; padding:4px 7px; border-bottom:1px solid var(--line); font:11px/1.3 var(--mono); color:var(--ink-2); background:var(--panel); overflow:hidden; white-space:nowrap; }
.sheet .fx i { font-style:italic; color:var(--ink-3); font-family:Georgia,serif; }
.sheet td.err { color:var(--flag); }
.phone { width:min(100%,290px); margin:0 auto; border-radius:26px; padding:14px 12px 16px; background:linear-gradient(160deg,#1f2a22,#0b100c); border:1px solid #2c3b2e; }
.notif { background:rgba(245,248,244,.93); color:#111; border-radius:14px; padding:10px 12px; font:12.5px/1.35 -apple-system,system-ui,sans-serif; }
.notif .ap { display:flex; justify-content:space-between; font-size:10.5px; color:#555; text-transform:uppercase; letter-spacing:.04em; margin-bottom:3px; }
.notif b { display:block; font-size:13px; }
.notif + .notif { margin-top:8px; }
.notif.stop { background:rgba(255,236,236,.96); }
.widget { margin-top:10px; background:rgba(20,28,22,.92); border:1px solid #33443a; border-radius:18px; padding:12px; color:#e7f2e6; font:12px/1.35 -apple-system,system-ui,sans-serif; }
.widget .wt { font-size:10px; text-transform:uppercase; letter-spacing:.08em; color:#8fa593; }
.widget .ws { display:flex; justify-content:space-between; font-weight:700; margin-top:6px; gap:8px; }
.widget .ws span:first-child { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.toast { display:inline-block; background:#2b2b2b; color:#fff; border-radius:18px; padding:8px 14px; font:12.5px/1.35 system-ui,sans-serif; }
.adlg { background:#fff; color:#1c1c1c; border-radius:10px; padding:14px 16px; font:12.5px/1.45 system-ui,sans-serif; box-shadow:0 8px 20px rgba(0,0,0,.25); }
.adlg b { display:block; font-size:14px; margin-bottom:6px; }
.adlg .ab { text-align:right; color:#2a6be0; font-weight:700; font-size:12px; margin-top:10px; letter-spacing:.04em; }
.chat { background:#1e1f24; border-radius:8px; padding:12px; font:13px/1.45 system-ui,sans-serif; color:#dcdde1; }
html[data-theme="light"] .chat { background:#f3f3f5; color:#26272b; }
.chat .who { display:flex; align-items:center; gap:8px; font-weight:700; color:#fff; }
html[data-theme="light"] .chat .who { color:#111; }
.chat .who i { width:26px; height:26px; border-radius:50%; background:var(--accent); display:inline-block; flex:none; }
.chat .who small { font-weight:400; font-size:11px; color:#8e9096; }
.chat .emb { margin:6px 0 0 34px; border-left:3px solid var(--accent); background:rgba(0,0,0,.18); border-radius:4px; padding:8px 10px; }
html[data-theme="light"] .chat .emb { background:#fff; }
.chat .emb + .emb { margin-top:6px; }
.chat .emb > b:first-child { display:block; }
.chat .emb div b { font-weight:800; }
.hacard { background:#1c1c1c; color:#e1e1e1; border-radius:12px; padding:12px 14px; font:13px/1.4 system-ui,sans-serif; }
html[data-theme="light"] .hacard { background:#fff; color:#212121; border:1px solid #ddd; }
.hacard .hr { display:flex; align-items:center; gap:10px; padding:6px 0; }
.hacard .hr + .hr { border-top:1px solid rgba(128,128,128,.2); }
.hacard .hr i { width:28px; height:28px; border-radius:50%; background:rgba(99,255,74,.18); color:var(--accent); display:flex; align-items:center; justify-content:center; font-style:normal; font-weight:800; font-size:12px; flex:none; }
.hacard .hr span { flex:1; min-width:0; }
.hacard .hr b { font-weight:600; white-space:nowrap; }
.mail { background:#fff; color:#222; border-radius:6px; padding:12px; font:12px/1.45 system-ui,sans-serif; }
.mail .mh { font-size:11px; color:#666; border-bottom:1px solid #eee; padding-bottom:6px; margin-bottom:8px; }
.mail .mh b { color:#222; }
.mail table { border-collapse:collapse; width:100%; font-size:11px; }
.mail td, .mail th { border-bottom:1px solid #eee; padding:3px 4px; text-align:center; white-space:nowrap; }
.mail th { color:#666; font-weight:600; }
.files { font:12px/1.7 var(--mono); color:var(--ink-2); }
.files div { display:flex; justify-content:space-between; gap:12px; border-bottom:1px dashed var(--line); padding:2px 0; }
.files div span:last-child { color:var(--ink-3); }
.files div.stop span:first-child { color:var(--flag); }
.minichart { width:100%; height:auto; display:block; }
.minichart .ax { stroke:var(--line-2); }
.minichart text { fill:var(--ink-3); font-size:9px; font-family:var(--mono); }
.shortcut { display:flex; flex-direction:column; gap:5px; }
.shortcut .act { display:flex; gap:9px; align-items:flex-start; padding:8px 10px; background:var(--panel); border:1px solid var(--line); border-left:3px solid var(--c,var(--sky)); font-size:12px; line-height:1.45; color:var(--ink-2); }
.shortcut .act b { color:var(--ink); font-weight:800; }
.shortcut .act code { color:var(--sky); font-size:11px; overflow-wrap:anywhere; }
.shortcut .act.ind { margin-left:18px; }
.shortcut .act.ind2 { margin-left:36px; }
.shortcut .act.cond { --c:var(--signal); }
.shortcut .act.stop { --c:var(--flag); }
.shortcut .act.ok { --c:var(--accent); }
.shortcut .act .ix { font:900 10px/1.6 var(--mono); color:var(--ink-3); flex:none; width:16px; }

/* --- how often to ask ------------------------------------------------------------------ */
.pacenote { font-size:14px; line-height:1.65; color:var(--ink-2); max-width:84ch; }
.pacehero { display:grid; grid-template-columns:minmax(0,300px) minmax(0,1fr); gap:14px 26px; align-items:start; }
@media (max-width:760px) { .pacehero { grid-template-columns:minmax(0,1fr); } }
.phfig { border:1px solid var(--line); border-top:2px solid var(--pc,var(--accent)); background:var(--inset); padding:14px 16px 15px; display:flex; flex-direction:column; align-items:flex-start; gap:6px; }
.phfig .k { font-size:var(--fs-micro); font-weight:900; letter-spacing:.16em; text-transform:uppercase; color:var(--ink-3); }
.phfig .v { font-size:clamp(22px,2.6vw,28px); line-height:1.15; }
.phtext p { font-size:13.5px; line-height:1.6; color:var(--ink-2); max-width:80ch; }
.phtext p + p { margin-top:8px; }
.phtext p code { color:var(--sky); }
.v-api .tabhead { display:flex; align-items:center; gap:10px; margin:22px 0 4px; font-size:var(--fs-micro); font-weight:900; letter-spacing:.16em; text-transform:uppercase; color:var(--accent); }
.v-api .tabhead::after { content:""; flex:1; height:1px; background:linear-gradient(90deg,var(--line-2),transparent); }
.levels td.on { color:var(--ink); font-weight:900; }
.pacenote b.lead { color:var(--ink); font-size:15px; }
.pacenote code { color:var(--sky); }
.levels { width:100%; border-collapse:collapse; margin-top:16px; font-size:12.5px; }
.levels th { text-align:center; font-size:var(--fs-micro); font-weight:900; letter-spacing:.14em; text-transform:uppercase; color:var(--ink-3); padding:8px 10px; border-bottom:1px solid var(--line-2); }
.levels td { padding:9px 10px; border-bottom:1px solid var(--line); color:var(--ink-2); vertical-align:top; line-height:1.45; }
.levels td b { color:var(--ink); }
.levels tr.now td { background:color-mix(in srgb,var(--pc,var(--accent)) 10%,transparent); }
.levels tr.now td:first-child { box-shadow:inset 3px 0 0 var(--pc,var(--accent)); }
.levels .nowtag { display:inline-block; margin-left:8px; padding:1px 6px; font-size:9px; font-weight:900; letter-spacing:.14em; text-transform:uppercase; color:var(--field); background:var(--pc,var(--accent)); vertical-align:1px; }
@media (max-width:560px) { .levels th:nth-child(3), .levels td:nth-child(3) { display:none; } }
.rwbox { margin-top:18px; }
.rwdiag { width:100%; min-width:680px; height:auto; display:block; }
.rwdiag .axis { stroke:var(--line-2); }
.rwdiag .tk { stroke:var(--line-2); }
.rwdiag text { font:9.5px var(--mono); fill:var(--ink-3); }
.rwdiag .rnd { fill:var(--accent); opacity:.28; }
.rwdiag .rndl { stroke:var(--accent); stroke-width:1.5; }
.rwdiag .shut { fill:color-mix(in srgb,var(--ink) 7%,transparent); stroke:var(--line); stroke-width:1; }
.rwdiag .busy { fill:var(--signal); opacity:.1; }
.rwdiag .busyl { stroke:var(--signal); stroke-dasharray:3 3; }
.rwdiag .ok { fill:var(--accent); }
.rwdiag .pc { fill:var(--signal); }
.rwdiag .tf { fill:var(--flag); }
.rwdiag .held { stroke:var(--flag); stroke-width:2; opacity:.6; }
.rwdiag .stopline { stroke:var(--flag); stroke-width:1.5; stroke-dasharray:2 3; }
.rwdiag .lbl { font:900 9px var(--mono); letter-spacing:.08em; text-transform:uppercase; }
.rwdiag .lbl.acc { fill:var(--accent); } .rwdiag .lbl.sig { fill:var(--signal); } .rwdiag .lbl.flag { fill:var(--flag); }
.simctl { display:flex; flex-wrap:wrap; gap:10px 16px; align-items:flex-end; margin:14px 0 12px; }
.simctl .sf { display:flex; flex-direction:column; gap:5px; }
.simctl .sf > span { font-size:var(--fs-micro); font-weight:900; letter-spacing:.14em; text-transform:uppercase; color:var(--ink-3); }
.simctl .seg button { padding:7px 11px; }
.simctl .sf { min-width:0; max-width:100%; }
.simctl .seg { max-width:100%; flex-wrap:wrap; }
.simlog { border:1px solid var(--line); background:var(--inset); max-height:220px; font:11.5px/1.6 var(--mono); }
.simsum + .xywrap { margin-top:10px; }
.simlog div { display:grid; grid-template-columns:48px 64px minmax(0,1fr); gap:10px; padding:3px 10px; border-bottom:1px solid var(--line); color:var(--ink-2); }
.simlog div:last-child { border-bottom:0; }
.simlog .t { color:var(--ink-3); }
.simlog .ok { color:var(--accent); } .simlog .pc { color:var(--signal); } .simlog .tf { color:var(--flag); }
.simsum { margin-top:10px; font-size:12.5px; color:var(--ink-2); line-height:1.55; }
.simsum b { color:var(--ink); }
.twocol { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:14px; margin-top:14px; }
@media (max-width:760px) { .twocol { grid-template-columns:1fr; } }
.twocol .panel + .panel { margin-top:0; }

/* --- the rate window's rules ------------------------------------------------------------ */
.rwrules { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; margin-top:12px; }
@media (max-width:1180px) { .rwrules { grid-template-columns:repeat(3,minmax(0,1fr)); } }
@media (max-width:980px) { .rwrules { grid-template-columns:repeat(2,minmax(0,1fr)); } }
@media (max-width:560px) { .rwrules { grid-template-columns:1fr; } }
.rwrule { border:1px solid var(--line); background:var(--inset); padding:12px 14px 13px; position:relative; }
.rwrule::before { content:""; position:absolute; left:-1px; top:-1px; width:22px; height:2px; background:var(--accent); }
.rwrule .n { display:block; font:900 10.5px/1 var(--mono); color:var(--accent); margin-bottom:8px; }
.rwrule b { display:block; font-size:13.5px; font-weight:900; color:var(--ink); margin-bottom:5px; }
.rwrule p { font-size:12.5px; line-height:1.55; color:var(--ink-2); }
.rwrule code { color:var(--sky); }
.v-api .rwsub { display:flex; align-items:center; gap:10px; margin:22px 0 10px; font-size:var(--fs-micro); font-weight:900; letter-spacing:.16em; text-transform:uppercase; color:var(--ink-3); }
.rwsub::after { content:""; flex:1; height:1px; background:linear-gradient(90deg,var(--line-2),transparent); }
.rwsub code { color:var(--ink-2); letter-spacing:.04em; text-transform:none; }
.rwkinds { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
@media (max-width:760px) { .rwkinds { grid-template-columns:1fr; } }
.rwkind { border:1px solid var(--line); border-top:2px solid var(--c); background:var(--inset); padding:12px 14px 13px; }
.rwkind.pc { --c:var(--signal); } .rwkind.tf { --c:var(--flag); }
.rwkind .kh { display:flex; flex-wrap:wrap; align-items:center; gap:8px 12px; margin-bottom:8px; }
.rwkind .kn { font:900 14px/1.2 var(--mono); color:var(--c); }
.xs { display:inline-block; padding:2px 7px; font:800 10.5px/1.4 var(--mono); color:var(--c,var(--ink-2)); border:1px solid color-mix(in srgb,var(--c,var(--ink)) 45%,transparent); white-space:nowrap; }
.xs.pause { --c:var(--signal); } .xs.exit { --c:var(--flag); }
.rwkind p { font-size:12.5px; line-height:1.55; color:var(--ink-2); }
.rwkind p b { color:var(--ink); }
.rwkind p + p { margin-top:6px; }
.rwkind .kd span { display:inline-block; margin-right:7px; font-size:var(--fs-micro); font-weight:900; letter-spacing:.14em; text-transform:uppercase; color:var(--c); }
.rwkind code { color:var(--sky); }
.rwcallouts { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin-top:10px; }
@media (max-width:760px) { .rwcallouts { grid-template-columns:1fr; } }
.rwcallouts .infonote { margin:0; }
.rwcallouts .infonote svg.gls { color:var(--accent); }
.simlegend { display:flex; flex-wrap:wrap; gap:6px 16px; margin-top:6px; font-size:12px; color:var(--ink-3); }
.simlegend .lg { display:inline-block; width:14px; height:10px; vertical-align:-1px; margin-right:2px; }
.simlegend .lg.rnd { background:color-mix(in srgb,var(--accent) 35%,transparent); }
.simlegend .lg.shut { background:color-mix(in srgb,var(--ink) 9%,transparent); border:1px solid var(--line-2); }

/* --- troubleshooting ---------------------------------------------------------------------- */
.symgrid { margin-top:14px; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
@media (max-width:760px) { .symgrid { grid-template-columns:1fr; } }
.sym { border:1px solid var(--line); background:var(--panel); padding:13px 15px 12px; display:flex; flex-direction:column; gap:7px; }
.symh { display:flex; flex-direction:column; gap:6px; padding-bottom:9px; border-bottom:1px dashed var(--line-2); }
.symh .where { align-self:flex-start; padding:2px 7px; font-size:var(--fs-micro); font-weight:900; letter-spacing:.14em; text-transform:uppercase; color:var(--sky); border:1px solid color-mix(in srgb,var(--sky) 40%,transparent); }
.symh b { font-size:14.5px; font-weight:900; color:var(--ink); line-height:1.35; }
.sym p { font-size:12.5px; line-height:1.55; color:var(--ink-2); }
.sym p code { color:var(--sky); }
.sym p b { color:var(--ink); }
.sym p { display:grid; grid-template-columns:52px minmax(0,1fr); gap:0 8px; }
.sym .lab { padding-top:2px; font-size:var(--fs-micro); font-weight:900; letter-spacing:.14em; text-transform:uppercase; color:var(--ink-3); }
.sym .lab.do { color:var(--accent); }
.tgroup { border:1px solid var(--line); background:var(--panel); scroll-margin-top:60px; }
.tgroup + .tgroup { margin-top:12px; }
.tgh { display:flex; gap:14px; align-items:flex-start; padding:14px 16px; border-bottom:1px solid var(--line); background:linear-gradient(90deg,color-mix(in srgb,var(--accent) 6%,transparent),transparent 60%); }
.tgi { flex:none; width:36px; height:36px; padding:7px; color:var(--accent); border:1px solid color-mix(in srgb,var(--accent) 45%,var(--line)); background:var(--inset); }
.tgi svg { width:100%; height:100%; display:block; }
.tgh b { display:block; font-size:16px; font-weight:900; letter-spacing:.04em; text-transform:uppercase; color:var(--ink); }
.tgh p { font-size:12.5px; line-height:1.55; color:var(--ink-2); margin-top:3px; max-width:90ch; }
.tgh code { color:var(--sky); }
.tcards { display:flex; flex-wrap:wrap; align-items:stretch; gap:10px; padding:12px; }
.tcard { flex:0 0 calc((100% - 20px) / 3); min-width:0; border:1px solid var(--line); border-left:3px solid var(--c); background:var(--inset); overflow:hidden; }
.tcards.n2 .tcard { flex-basis:calc((100% - 10px) / 2); }
@media (max-width:980px) { .tcard, .tcards.n2 .tcard { flex-basis:calc((100% - 10px) / 2); } }
@media (max-width:640px) { .tcard, .tcards.n2 .tcard { flex-basis:100%; } }
.tcard.expanded { flex-basis:100% !important; border-color:color-mix(in srgb,var(--c) 55%,var(--line)); }
.tcin { height:100%; padding:12px 14px 12px; display:flex; flex-direction:column; gap:8px; }
.tcard.e4 { --c:var(--signal); } .tcard.e5 { --c:var(--flag); } .tcard.e429 { --c:var(--flag); }
.tcard .errbody:not([hidden]) { display:grid; grid-template-columns:minmax(0,320px) minmax(0,1fr); gap:10px; align-items:start; margin-top:4px; }
@media (max-width:760px) { .tcard .errbody:not([hidden]) { grid-template-columns:minmax(0,1fr); } }
.tcard .errbody .hdrs { margin:0; }
.tch { display:flex; flex-wrap:wrap; align-items:center; gap:6px 12px; }
.tch .c3 { font:900 28px/1 var(--mono); letter-spacing:-.04em; color:var(--c); }
.tch .cn { display:flex; flex-direction:column; min-width:0; }
.tch .cn code { font:800 13px/1.3 var(--mono); color:var(--ink); overflow-wrap:anywhere; }
.tch .cn small { font:700 11px/1.3 var(--mono); color:var(--ink-3); }
.tch .xs { margin-left:auto; }
.tcard .wh { font-size:12px; color:var(--ink-3); line-height:1.45; }
.tcard .msgq { padding:8px 10px; background:var(--field); border:1px solid var(--line); font-size:12.5px; line-height:1.5; color:var(--ink); }
.tcard .msgq .ml { display:block; font:800 10px/1.4 var(--mono); color:var(--ink-3); margin-bottom:2px; }
.tcard .fix { display:flex; gap:8px; align-items:flex-start; font-size:12.5px; line-height:1.5; color:var(--ink-2); }
.tcard .fix svg { width:14px; height:14px; flex:none; margin-top:3px; color:var(--accent); }
.tcard .fix code { color:var(--sky); }
.tcard .fix b { color:var(--ink); }
.tcard .helpbtn { align-self:flex-start; margin-top:auto; }

/* --- downloads ---------------------------------------------------------------------------------- */
.dlall { display:flex; flex-wrap:wrap; align-items:center; gap:12px 20px; padding-bottom:16px; margin-bottom:6px; border-bottom:1px solid var(--line); }
.dlall .t { flex:1 1 280px; }
.dlall .t b { display:block; font-size:15px; font-weight:900; color:var(--ink); }
.dlall .t > span { display:block; font-size:12px; color:var(--ink-3); margin-top:3px; line-height:1.45; }
.dlgrp { margin-top:16px; }
.dlgrp > .jlab { margin-bottom:4px; }
.dlrow { display:grid; grid-template-columns:150px minmax(0,1fr) 74px 116px 206px; gap:4px 14px; align-items:center; padding:9px 0; border-bottom:1px solid var(--line); }
.dlrow .sn { font:800 12.5px/1.3 var(--mono); color:var(--sky); overflow-wrap:anywhere; }
.dlrow .sd2 { font-size:12px; line-height:1.45; color:var(--ink-2); min-width:0; }
.dlrow .sd2 small { display:block; color:var(--ink-3); font-size:11px; margin-top:2px; }
.dlrow .sz { font:700 11.5px/1.3 var(--mono); color:var(--ink-3); text-align:right; }
.dlrow .rf { font-size:11px; color:var(--ink-3); line-height:1.35; }
.dlrow .ba { display:flex; gap:5px; justify-content:flex-end; flex-wrap:wrap; }
.dlrow .ba .minibtn { min-height:28px; padding:5px 9px; }
.dlrow.off .sn { color:var(--ink-3); text-decoration:line-through; text-decoration-thickness:1px; }
.dlrow .wk { display:inline-flex; margin-top:5px; }
.dlrow .wk.seg button { padding:3px 8px; min-height:24px; }
.dlprev { grid-column:1 / -1; padding:10px 0 4px; min-width:0; }
.dlprev .pg > div { min-width:0; }
.dlprev .pg { display:grid; grid-template-columns:minmax(0,1.5fr) minmax(0,1fr); gap:14px; }
@media (max-width:900px) { .dlprev .pg { grid-template-columns:1fr; } }
.dlprev .tview { max-height:300px; }
.dlprev .fglist { max-height:300px; border:1px solid var(--line); }
.dlprev .fglist .fgtable td { padding:5px 8px; }
@media (max-width:760px) {
  .dlrow { grid-template-columns:minmax(0,1fr) auto; }
  .dlrow .sd2 { grid-column:1 / -1; }
  .dlrow .sz { text-align:left; }
  .dlrow .rf { display:none; }
  .dlrow .ba { grid-column:1 / -1; justify-content:flex-start; }
}


/* --- values worth reading: the league title's gradient ------------------------------------ */
.valg { font-weight:900; letter-spacing:-.01em; background:linear-gradient(96deg,var(--ink) 30%,var(--accent) 130%);
  -webkit-background-clip:text; background-clip:text; color:transparent; -webkit-text-fill-color:transparent; }
.keyfacts .fact .v.warn .valg { background:linear-gradient(96deg,var(--ink) 10%,var(--signal) 110%); -webkit-background-clip:text; background-clip:text; }
.dlrow .sz .valg { font-size:12.5px; }
/* --- a job that won't work with the site's settings ---------------------------------------- */
.jobhead .jflag { grid-column:3; grid-row:1 / span 2; display:inline-flex; align-items:center; gap:6px; padding:4px 9px; border:1px solid var(--flag); background:var(--flag-soft);
  font-size:var(--fs-micro); font-weight:900; letter-spacing:.12em; text-transform:uppercase; color:var(--flag); white-space:nowrap; }
.jobhead .jflag svg { width:12px; height:12px; flex:none; }
.jobhead.flagged { grid-template-columns:34px minmax(0,1fr) auto auto auto; }
.jobhead.flagged .jrun { grid-column:4; } .jobhead.flagged .chev { grid-column:5; }
@media (max-width:760px) {
  .jobhead.flagged { grid-template-columns:34px minmax(0,1fr) auto; }
  .jobhead .jflag { grid-column:2; grid-row:4; justify-self:start; margin-top:6px; white-space:normal; }
  .jobhead.flagged .jrun { grid-column:2; } .jobhead.flagged .chev { grid-column:3; }
}
/* --- the new jobs' pictures ------------------------------------------------------------------ */
.nbtable { width:100%; border-collapse:collapse; font:11.5px/1.5 var(--mono); color:var(--ink-2); }
.nbtable th, .nbtable td { padding:4px 8px; border-bottom:1px solid var(--line); text-align:center; }
.nbtable tr:first-child th { color:var(--ink); border-bottom:1px solid var(--line-2); }
.nbtable tr:nth-child(even) td, .nbtable tr:nth-child(even) th { background:color-mix(in srgb,var(--ink) 4%,transparent); }
.calmock { border:1px solid var(--line); background:var(--panel); }
.calrow { display:grid; grid-template-columns:52px minmax(0,1fr); align-items:center; border-bottom:1px solid var(--line); }
.calrow:last-child { border-bottom:0; }
.calrow .wk { padding:8px 0; text-align:center; font:900 10.5px/1 var(--mono); color:var(--ink-3); border-right:1px solid var(--line); align-self:stretch; display:grid; place-items:center; }
.calrow .ev { margin:6px 8px; padding:5px 9px; font-size:12px; font-weight:800; color:var(--ink); background:color-mix(in srgb,var(--sky) 18%,transparent); border-left:3px solid var(--sky); }
.calrow .ev.done { background:color-mix(in srgb,var(--accent) 14%,transparent); border-left-color:var(--accent); }


/* --- the page's own notice: a copy that was blocked, a fetch that failed ------------------------------------ */
.apitoast { position:fixed; left:50%; bottom:18px; transform:translateX(-50%); z-index:120; max-width:calc(100vw - 32px);
  background:var(--panel); color:var(--ink); border:1px solid color-mix(in srgb,var(--accent) 55%,transparent); border-radius:10px;
  padding:9px 14px; font-size:13px; line-height:1.45; box-shadow:0 12px 30px rgba(0,0,0,.35); text-align:center; }

`;
