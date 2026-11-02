/**
 * Front Office's stylesheet, made only of the site's tokens and type, plus its own position colours (--fo-*). The page
 * reads as a desk: a team header with this week's three totals, three tabs, then the work of the tab. Tones are the
 * site's: red (--flag) act now, amber (--signal) worth a look, blue (--sky) context, green (--accent) in your favour.
 * Every player is a compact card built around his season bars (actual against projection, one scale per position)
 * and a defence meter (rank 1-32 against his position, tough left, soft right); a chevron opens the detail (D33, D34).
 * Class names carry the fo prefix where a site sheet already styles the plain name (.rail is sticky in BASE_CSS, Hall
 * of Fame styles .chev, .sub and .bar).
 */
export const FO_CSS = `
.fowrap { margin-top:18px; }
.foasof { margin:-6px 0 14px; text-align:center; font-size:10.5px; font-weight:700; color:var(--ink-2); }
.foasof b { color:var(--ink); font-weight:800; }

/* ---- the team header ------------------------------------------------------------------------------------------- */
.fohead { display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:14px 18px; align-items:center; padding:16px clamp(14px,1.8vw,22px); }
.fohead .fologo { width:58px; height:58px; border-radius:50%; object-fit:cover; border:1px solid var(--line-2); background:var(--inset); }
.foteam { min-width:0; }
.foteam .n { display:block; width:fit-content; max-width:100%; font-size:clamp(19px,2.4vw,26px); font-weight:900; letter-spacing:-.01em; line-height:1.15;
  background:linear-gradient(96deg,var(--ink) 0%,var(--ink) 34%,var(--accent) 104%); -webkit-background-clip:text; background-clip:text; color:transparent; -webkit-text-fill-color:transparent; }
.foteam .m { display:block; margin-top:4px; font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:var(--ink-2); }
.foteam .m b { color:var(--ink); font-variant-numeric:tabular-nums; }
.fototals { display:grid; grid-template-columns:repeat(3,auto); gap:0; border:1px solid var(--line-2); background:var(--inset); }
.fototal { padding:8px 14px; text-align:center; border-right:1px solid var(--line); min-width:92px; }
.fototal:last-child { border-right:0; }
.fototal .k { display:block; font-size:9.5px; font-weight:900; letter-spacing:.16em; text-transform:uppercase; color:var(--ink-2); }
.fototal .v { display:block; margin-top:3px; font-size:19px; font-weight:900; font-variant-numeric:tabular-nums; color:var(--ink); }
.fototal .v .g { background:linear-gradient(96deg,var(--ink) 0%,var(--ink) 18%,var(--accent) 100%); -webkit-background-clip:text; background-clip:text; color:transparent; -webkit-text-fill-color:transparent; }
.fototal.best .v .g { background-image:linear-gradient(96deg,var(--ink) -30%,var(--accent) 70%); }
.fototal .o { display:flex; align-items:center; justify-content:center; gap:5px; margin-top:2px; font-size:10px; font-weight:700; color:var(--ink-2); }
.fototal .o img { width:14px; height:14px; border-radius:50%; }
@media (max-width:760px) {
  .fohead { grid-template-columns:auto minmax(0,1fr); }
  .fototals { grid-column:1 / -1; }
  .fototal { min-width:0; padding:8px 6px; }
}

/* ---- the tabs ---------------------------------------------------------------------------------------------------- */
.fotabs { display:grid; grid-template-columns:repeat(3,1fr); margin:16px 0 18px; border:1px solid var(--line-2); background:var(--panel-2); }
.fotab { position:relative; padding:12px 8px; background:none; border:0; border-right:1px solid var(--line); color:var(--ink-2);
  font:inherit; font-size:11px; font-weight:900; letter-spacing:.16em; text-transform:uppercase; cursor:pointer; transition:color .16s ease, background .16s ease; }
.fotab:last-child { border-right:0; }
.fotab:hover { color:var(--ink); }
.fotab[aria-selected="true"] { color:var(--ink); background:color-mix(in srgb,var(--accent) 12%,var(--panel-2)); }
.fotab[aria-selected="true"]::after { content:""; position:absolute; left:0; right:0; top:0; height:3px; background:var(--accent); box-shadow:0 0 12px var(--accent-glow); }
.fotab .c { display:inline-block; margin-left:6px; min-width:18px; padding:1px 5px; font-size:10px; letter-spacing:0; border-radius:9px; background:var(--flag); color:#fff; }
.fotab .c.amber { background:var(--signal); color:#1A1300; }
.fotab:focus-visible { outline:2px solid var(--sky); outline-offset:-2px; }

/* ---- the checklist ----------------------------------------------------------------------------------------------- */
.fochk { list-style:none; margin:0; padding:0; display:grid; gap:6px; }
.fochk li { display:grid; grid-template-columns:auto minmax(0,1fr); gap:10px; align-items:center; padding:8px 12px; background:var(--inset);
  border-left:3px solid var(--tone); font-size:13.5px; line-height:1.4; color:var(--ink); }
.fochk li.red { --tone:var(--flag); background:color-mix(in srgb,var(--flag) 8%,var(--inset)); }
.fochk li.amber { --tone:var(--signal); }
.fochk li.info { --tone:var(--sky); }
.fochk .tone { font-size:9px; font-weight:900; letter-spacing:.16em; text-transform:uppercase; min-width:46px; color:var(--tone);
  background:linear-gradient(96deg,var(--ink) -30%,var(--tone) 70%); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; }
.foclean { display:flex; align-items:center; gap:10px; padding:10px 12px; border-left:3px solid var(--accent); background:var(--inset); font-weight:800; color:var(--ink); }
.foclean::before { content:"✓"; color:var(--accent); font-weight:900; }
.foswap { display:flex; flex-wrap:wrap; gap:6px 14px; align-items:center; margin:0 0 14px; padding:10px 14px; border:1px solid var(--signal);
  background:color-mix(in srgb,var(--signal) 9%,var(--panel)); font-size:13px; font-weight:700; color:var(--ink); }
.foswap b { color:var(--signal); font-weight:900; letter-spacing:.08em; text-transform:uppercase; font-size:10.5px; }

/* Hall of Fame's sheet styles .sub and .bar for its own panels; Front Office's are reset here. */
.focard .sub { margin-bottom:0; }
.fofitbar .bar, .fodetail .trade .bar { margin:0; }

/* ---- small parts ------------------------------------------------------------------------------------------------ */
.foinj { margin-left:2px; font-size:9.5px; font-weight:900; letter-spacing:.08em; padding:1px 5px; border:1px solid currentColor; }
.foinj.q { color:var(--signal); } .foinj.d, .foinj.o { color:var(--flag); }
.fonotes { display:flex; flex-wrap:wrap; gap:4px; }
.fonote { display:inline-flex; align-items:center; gap:4px; padding:2px 7px; font-size:10.5px; font-weight:800; line-height:1.35; border:1px solid var(--line-2); color:var(--ink-2); background:var(--inset); cursor:help; font-family:inherit; }
.fonote::before { content:""; width:6px; height:6px; border-radius:50%; background:var(--ink-3); flex:none; }
.fonote.up { color:var(--ink); border-color:color-mix(in srgb,var(--accent) 45%,var(--line-2)); } .fonote.up::before { background:var(--accent); }
.fonote.down { color:var(--ink); border-color:color-mix(in srgb,var(--flag) 50%,var(--line-2)); } .fonote.down::before { background:var(--flag); }
.fonote[aria-expanded="true"] { background:var(--panel-2); color:var(--ink); }
.fonotetext { display:block; margin-top:6px; font-size:12px; line-height:1.45; color:var(--ink-2); }
.fonotetext b { color:var(--ink); }

/* ---- the tape and the defence meter (shared by every player card) --------------------------------------------- */
.fotape { margin:0; display:flex; flex-direction:column; gap:4px; min-width:0; }
.fotape svg { display:block; overflow:visible; max-width:100%; height:auto; }
.fotape .tb { stroke:var(--line-2); stroke-width:1; }
.fotape .tu { fill:var(--accent); }
.fotape .td { fill:color-mix(in srgb,var(--flag) 72%,var(--panel)); }
.fotape .tp { stroke:var(--ink); stroke-width:1.6; stroke-linecap:square; }
.fotape .tn { fill:color-mix(in srgb,var(--sky) 14%,transparent); stroke:var(--sky); stroke-width:1.5; stroke-dasharray:3 2; }
.fotape .tl { fill:var(--signal); }
.fotape .ta { fill:none; stroke:var(--sky); stroke-width:1.2; stroke-dasharray:2 2; opacity:.85; }
.fotape .ty, .fotape .tz { fill:var(--ink-3); }
.fotape figcaption { font-size:10.5px; font-weight:700; color:var(--ink-2); }
.fotape figcaption b { color:var(--ink); font-variant-numeric:tabular-nums; }
.fotapekey { display:flex; flex-wrap:wrap; gap:6px 14px; margin:0 0 10px; font-size:10.5px; font-weight:800; color:var(--ink-2); }
.fotapekey i { display:inline-block; width:9px; height:12px; margin-right:5px; vertical-align:-2px; }
.fotapekey i.tu { background:var(--accent); } .fotapekey i.td { background:color-mix(in srgb,var(--flag) 72%,var(--panel)); }
.fotapekey i.tp { height:2px; width:13px; vertical-align:3px; background:var(--ink); }
.fotapekey i.tn { border:1.5px dashed var(--sky); background:color-mix(in srgb,var(--sky) 14%,transparent); }
.fotapekey i.ta { border:1.2px dashed var(--sky); opacity:.85; }
.fotapekey i.ty { width:4px; height:4px; border-radius:50%; vertical-align:1px; background:var(--ink-3); }

.fometer { display:inline-flex; flex-direction:column; gap:4px; font-size:11px; font-weight:800; color:var(--ink-2); min-width:0; }
.fometer .trk { position:relative; display:block; width:112px; height:6px;
  background:linear-gradient(90deg,color-mix(in srgb,var(--flag) 70%,var(--inset)),var(--line-2) 50%,color-mix(in srgb,var(--accent) 75%,var(--inset))); }
.fometer .trk i { position:absolute; top:50%; width:11px; height:11px; margin:-5.5px 0 0 -5.5px; border-radius:50%; background:var(--panel); border:2.5px solid var(--ink); box-sizing:border-box; }
.fometer.tough { color:var(--flag); } .fometer.tough .trk i { border-color:var(--flag); }
.fometer.soft { color:var(--accent); } .fometer.soft .trk i { border-color:var(--accent); }
.fometer .lbl b { color:var(--ink); margin-right:5px; }
.fometer.sm .trk { width:100%; min-width:58px; height:4px; }
.fometer.sm .trk i { width:9px; height:9px; margin:-4.5px 0 0 -4.5px; border-width:2px; }
.fometer.sm { font-size:10px; }
.fometer.none { color:var(--ink-3); font-size:10.5px; }

/* ---- the player card (round 3): compact, expandable, two accents ---------------------------------------------- */
/* Position colours: Front Office's own, taken from the site's validated chart palette (app/shared/teamcolours.js),
   picked to stay clear of the status colours (green starting, grey bench, red IR). Colour never carries meaning
   alone: the rail names the slot and the subline names the position. */
html[data-theme="dark"] { --fo-qb:#b672d8; --fo-rb:#0aa6bb; --fo-wr:#db7508; --fo-te:#e16386; --fo-flex:#5c90f5; --fo-dst:#9b7102; --fo-k:#7665d0; }
html[data-theme="light"] { --fo-qb:#af66d2; --fo-rb:#019cb0; --fo-wr:#ce6d02; --fo-te:#db557d; --fo-flex:#4f86f0; --fo-dst:#906801; --fo-k:#6e59cc; }
.pk-qb { --pc:var(--fo-qb); } .pk-rb { --pc:var(--fo-rb); } .pk-wr { --pc:var(--fo-wr); } .pk-te { --pc:var(--fo-te); }
.pk-flex { --pc:var(--fo-flex); } .pk-dst { --pc:var(--fo-dst); } .pk-k { --pc:var(--fo-k); } .pk-none { --pc:var(--line-2); }
.st-start { --sc:var(--accent); } .st-bench { --sc:var(--ink-3); } .st-ir { --sc:var(--flag); }
.st-fa { --sc:var(--accent); } .st-wv { --sc:var(--signal); } .st-none { --sc:var(--line-2); }

.foboard { display:grid; grid-template-columns:repeat(auto-fill,minmax(272px,1fr)); gap:12px; margin-bottom:22px; align-items:start; }
.focard { position:relative; display:grid; grid-template-columns:30px minmax(0,1fr); background:var(--panel); min-width:0;
  border:1px solid color-mix(in srgb,var(--pc) 55%,var(--line-2));
  box-shadow:0 0 0 1px color-mix(in srgb,var(--pc) 18%,transparent), 0 0 18px -4px color-mix(in srgb,var(--pc) 55%,transparent); }
.focard::before { content:""; position:absolute; left:30px; right:0; top:0; height:2px; background:var(--pc); opacity:.85; }
.focard.open { grid-column:1 / -1; }
.focard .forail { display:flex; flex-direction:column; align-items:center; gap:8px; padding:10px 0; position:relative;
  background:color-mix(in srgb,var(--sc) 14%,var(--inset)); border-right:3px solid var(--sc); }
.focard.st-ir .forail { background:repeating-linear-gradient(135deg,var(--inset) 0 4px,color-mix(in srgb,var(--flag) 20%,var(--inset)) 4px 7px); }
.focard .forail .sl { writing-mode:vertical-rl; transform:rotate(180deg); font-size:11.5px; font-weight:900; letter-spacing:.18em; color:var(--ink); white-space:nowrap; }
.focard .forail .st { writing-mode:vertical-rl; transform:rotate(180deg); font-size:8.5px; font-weight:900; letter-spacing:.14em; text-transform:uppercase; color:var(--ink-2); }
.focard.live .forail .st { color:var(--signal); }
.focard .body { display:flex; flex-direction:column; gap:7px; padding:10px 12px 8px; min-width:0; }
.focard .id { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:2px 10px; align-items:start; }
.focard .nm { margin:0; font-size:14.5px; font-weight:900; line-height:1.2; color:var(--ink); }
.focard .nm span { background:linear-gradient(96deg,var(--ink) 0%,var(--ink) 38%,var(--accent) 106%); -webkit-background-clip:text; background-clip:text; color:transparent; -webkit-text-fill-color:transparent; }
.focard .sub { display:flex; flex-wrap:wrap; gap:3px 6px; align-items:center; margin-top:2px; font-size:10.5px; font-weight:800; color:var(--ink-2); }
.focard .pv { text-align:right; }
.focard .pv .v { display:block; font-size:20px; font-weight:900; line-height:1; font-variant-numeric:tabular-nums;
  background:linear-gradient(100deg,var(--ink) 25%,var(--accent) 135%); -webkit-background-clip:text; background-clip:text; color:transparent; -webkit-text-fill-color:transparent; }
.focard .pv.live .v { background:none; -webkit-text-fill-color:var(--signal); color:var(--signal); }
.focard .pv.nil .v { background:none; -webkit-text-fill-color:var(--flag); color:var(--flag); font-size:16px; }
.focard .pv.zero .v { background:none; -webkit-text-fill-color:var(--ink-2); color:var(--ink-2); }
.focard .pv .k { display:block; margin-top:3px; font-size:8.5px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; color:var(--ink-2); }
.focard .mid { display:grid; grid-template-columns:auto minmax(0,1fr); gap:10px; align-items:end; }
.focard .gl { font-size:11px; font-weight:700; color:var(--ink-2); text-align:right; line-height:1.4; }
.focard .gl b { color:var(--ink); font-weight:900; }
.focard .gl .rk { display:block; }
.focard .gl .rk.tough { color:var(--flag); } .focard .gl .rk.soft { color:var(--accent); }
.fostate { font-size:10px; font-weight:900; letter-spacing:.1em; text-transform:uppercase; }
.fostate.live { color:var(--signal); } .fostate.final { color:var(--ink-2); }
.fotags { display:flex; flex-wrap:wrap; gap:4px; }
.fotags .fonote { cursor:default; font-size:10px; padding:1px 6px; }
.focard .lead { margin:0; font-size:11.5px; line-height:1.4; color:var(--ink); }
.focard .swap { display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:8px; align-items:center; margin:0 -12px -8px; padding:7px 12px;
  border-top:1px solid var(--tone); background:color-mix(in srgb,var(--tone) 11%,var(--panel)); font-size:12px; color:var(--ink); }
.focard .swap.go { --tone:var(--accent); } .focard .swap.maybe { --tone:var(--signal); }
.focard .swap .ic { font-size:15px; font-weight:900; color:var(--tone); }
.focard .swap .t b { font-weight:900; }
.focard .swap .g { font-size:14px; font-weight:900; font-variant-numeric:tabular-nums; }
.focard .fochev { grid-column:1 / -1; display:flex; align-items:center; justify-content:center; height:20px; padding:0; margin:0; cursor:pointer;
  background:color-mix(in srgb,var(--pc) 7%,var(--inset)); border:0; border-top:1px solid var(--line); color:var(--ink-2); }
.focard .fochev svg { fill:none; stroke:currentColor; stroke-width:2.2; stroke-linecap:round; stroke-linejoin:round; transition:transform .18s ease; }
.focard .fochev[aria-expanded="true"] svg { transform:rotate(180deg); }
.focard .fochev:hover { color:var(--ink); background:color-mix(in srgb,var(--pc) 16%,var(--inset)); }
.focard .fochev:focus-visible { outline:2px solid var(--sky); outline-offset:-2px; }
.vh { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
@media (prefers-reduced-motion: reduce) { .focard .fochev svg { transition:none; } }

/* the key above a board */
.focardkey { display:grid; grid-template-columns:max-content minmax(0,1fr); gap:6px 12px; align-items:center; margin:0 0 8px; font-size:10.5px; font-weight:800; color:var(--ink-2); }
.focardkey .row { display:flex; flex-wrap:wrap; gap:6px 12px; align-items:center; min-width:0; }
.focardkey .grp { font-size:9.5px; font-weight:900; letter-spacing:.14em; text-transform:uppercase; color:var(--ink); }
.focardkey i.g { display:inline-block; width:11px; height:11px; margin-right:5px; vertical-align:-1px; border:1.5px solid var(--pc); box-shadow:0 0 6px var(--pc); background:var(--panel); }
.focardkey i.s { display:inline-block; width:4px; height:12px; margin-right:5px; vertical-align:-2px; background:var(--sc); }

/* the detail, open across the board */
.focard .more { grid-column:1 / -1; border-top:1px dashed color-mix(in srgb,var(--pc) 45%,var(--line)); background:color-mix(in srgb,var(--pc) 4%,var(--panel)); }
.fodetail { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:16px 22px; padding:14px 16px 16px 42px; }
.fodetail section { min-width:0; display:flex; flex-direction:column; gap:8px; }
.fodetail section.wide { grid-column:1 / -1; }
.fodetail h4 { margin:0; font-size:9.5px; font-weight:900; letter-spacing:.14em; text-transform:uppercase; color:var(--ink-2); }
.fodnote { margin:0; font-size:11.5px; line-height:1.45; color:var(--ink-2); }
.fostats2 { display:grid; grid-template-columns:repeat(auto-fill,minmax(104px,1fr)); gap:6px; margin:0; }
/* Every figure has fixed areas, as Season Statistics' panels do: a title band two lines tall and a value band, each
   item centred in its own band, so a title that wraps never pushes its value out of line with its neighbours. */
.fostats2 { --fo-ft:24px; --fo-fv:22px; }
.fostats2 > div { display:grid; grid-template-rows:var(--fo-ft) var(--fo-fv); row-gap:4px; padding:7px 8px; background:var(--inset); border:1px solid var(--line); text-align:center; }
.fostats2 dt { display:flex; align-items:center; justify-content:center; min-width:0; overflow:hidden; font-size:9px; line-height:12px; font-weight:900; letter-spacing:.1em; text-transform:uppercase; color:var(--ink-2); }
.fostats2 dd { display:flex; align-items:center; justify-content:center; min-width:0; margin:0; white-space:nowrap; font-size:15px; font-weight:900; font-variant-numeric:tabular-nums; color:var(--ink); }
.fostats2 dd small { margin-left:5px; font-size:10px; font-weight:700; color:var(--ink-2); }
.fogame { margin:0; font-size:12.5px; } .fogame .gl { text-align:left; font-size:12.5px; }
.fofacts { list-style:none; margin:0; padding:0; display:flex; flex-wrap:wrap; gap:4px 14px; font-size:11.5px; font-weight:700; color:var(--ink-2); }
.fofacts b { color:var(--ink); font-variant-numeric:tabular-nums; }
.fofacts .up { color:var(--accent); } .fofacts .down { color:var(--flag); }
.focoming { list-style:none; margin:0; padding:0; display:grid; gap:6px; }
.focoming li { display:grid; grid-template-columns:44px minmax(0,1fr) minmax(70px,1fr) 46px; gap:8px; align-items:center; padding:6px 8px; background:var(--inset); font-size:11.5px; color:var(--ink-2); }
.focoming .w { font-size:9.5px; font-weight:900; letter-spacing:.1em; text-transform:uppercase; }
.focoming .o b { color:var(--ink); }
.focoming .byew { grid-column:2 / span 2; font-weight:800; color:var(--ink-2); }
.focoming .p small { font-size:9.5px; font-weight:800; color:var(--ink-2); }
.focoming .p { text-align:right; font-weight:900; font-variant-numeric:tabular-nums; color:var(--ink); }
.focmp { list-style:none; margin:0; padding:0; display:grid; gap:5px; }
.focmp li { display:grid; grid-template-columns:minmax(0,1.4fr) minmax(40px,1fr) 46px 50px; gap:8px; align-items:center; padding:5px 8px; background:var(--inset); }
.focmp li.me { background:color-mix(in srgb,var(--pc) 14%,var(--inset)); box-shadow:inset 3px 0 0 var(--pc); }
.focmp .n { font-size:12px; font-weight:900; color:var(--ink); line-height:1.25; }
.focmp .n small { display:block; font-size:10px; font-weight:700; color:var(--ink-2); }
.focmp .bar { display:block; height:5px; background:var(--panel); } .focmp .bar i { display:block; height:100%; background:var(--ink-2); }
.focmp li.me .bar i { background:var(--pc); }
.focmp .v { text-align:right; font-size:12px; font-weight:900; font-variant-numeric:tabular-nums; color:var(--ink); }
.focmp .d { text-align:right; font-size:11.5px; font-weight:900; font-variant-numeric:tabular-nums; color:var(--ink-2); }
.focmp .d.up { color:var(--accent); } .focmp .d.down { color:var(--flag); }
.fonotelist { list-style:none; margin:0; padding:0; display:grid; gap:5px; font-size:12px; line-height:1.45; color:var(--ink-2); }
.fonotelist li { padding:6px 10px; background:var(--inset); border-left:3px solid var(--line-2); }
.fonotelist li.up { border-left-color:var(--accent); } .fonotelist li.down { border-left-color:var(--flag); }
.fonotelist b { color:var(--ink); }
.fotape.big svg { max-width:100%; }
@media (max-width:560px) {
  .fodetail { padding:12px 12px 14px; grid-template-columns:minmax(0,1fr); }
  .focoming li { grid-template-columns:40px minmax(0,1fr) 46px; }
  .focoming li .fometer { grid-column:2; grid-row:2; }
  .focoming li .p { grid-column:3; grid-row:1 / span 2; }
  .focmp li { grid-template-columns:minmax(0,1fr) 46px 50px; }
  .focmp .bar { grid-column:1 / -1; grid-row:2; }
}

/* the boards on Weeks ahead take the position colour on their row heads */
.foboardw th.sl { box-shadow:inset 3px 0 0 var(--pc); }
.foheat th.pl { box-shadow:inset 3px 0 0 var(--pc); }

/* ---- pickups ---------------------------------------------------------------------------------------------------- */
.foneeds { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px; }
.foneed { padding:5px 10px; font-size:11.5px; font-weight:800; border-left:3px solid var(--tone); background:var(--inset); color:var(--ink); }
.foneed.red { --tone:var(--flag); } .foneed.amber { --tone:var(--signal); } .foneed.ok { --tone:var(--accent); }
.fowaiver { display:flex; flex-wrap:wrap; gap:6px 18px; align-items:center; margin-bottom:12px; font-size:12px; font-weight:700; color:var(--ink-2); }
.fowaiver b { color:var(--ink); font-size:14px; font-variant-numeric:tabular-nums; }
.fofilters { display:flex; flex-wrap:wrap; gap:8px 12px; align-items:center; margin-bottom:14px; }
.foseg { display:inline-flex; flex-wrap:wrap; border:1px solid var(--line-2); }
.foseg button { background:none; border:0; border-right:1px solid var(--line); padding:7px 11px; color:var(--ink-2); font:inherit; font-size:10.5px; font-weight:900; letter-spacing:.1em; cursor:pointer; }
.foseg button:last-child { border-right:0; }
.foseg button[aria-pressed="true"] { color:var(--on-accent); background:var(--accent); }
.foseg button:focus-visible, .fonote:focus-visible, .foshowall:focus-visible { outline:2px solid var(--sky); outline-offset:-2px; }
.fostatus { font-size:9.5px; font-weight:900; letter-spacing:.1em; text-transform:uppercase; padding:1px 6px; border:1px solid var(--line-2); color:var(--ink-2); }
.fostatus.fa { color:var(--accent); border-color:color-mix(in srgb,var(--accent) 50%,transparent); }
.fokind { display:inline-block; margin-top:4px; padding:1px 6px; font-size:9.5px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; color:var(--sky); border:1px solid color-mix(in srgb,var(--sky) 55%,transparent); }
.fofitbar .p-benchdepth { --c:var(--sky); }
.fofitbar .bar { display:flex; gap:2px; height:8px; background:var(--inset); }
.fofitbar .bar i { display:block; min-width:3px; }
.fofitbar .lg { display:flex; flex-wrap:wrap; gap:3px 12px; margin-top:6px; font-size:10.5px; font-weight:700; color:var(--ink-2); }
.fofitbar .lg span i { display:inline-block; width:8px; height:8px; margin-right:4px; vertical-align:0; }
.fofitbar .lg b { color:var(--ink); font-variant-numeric:tabular-nums; }
.fofitbar .p-next3 { --c:var(--accent); } .fofitbar .p-rest { --c:var(--sky); } .fofitbar .p-postseason { --c:var(--gold); }
.fofitbar .p-rising, .fofitbar .p-form, .fofitbar .p-handcuff, .fofitbar .p-block, .fofitbar .p-questionable { --c:var(--violet); }
.fofitbar .bar i, .fofitbar .lg span i { background:var(--c); }
.fodetail .trade { display:grid; gap:6px; padding:10px 12px; background:var(--inset); border:1px solid var(--line); }
.fodetail .trade > div { display:grid; grid-template-columns:38px minmax(0,1fr) 72px 52px; gap:10px; align-items:center; }
.fodetail .trade .k { font-size:9.5px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; }
.fodetail .trade .in .k { color:var(--accent); } .fodetail .trade .out .k { color:var(--flag); }
.fodetail .trade .n { font-size:12.5px; font-weight:900; color:var(--ink); }
.fodetail .trade .n small { font-size:10.5px; font-weight:700; color:var(--ink-2); }
.fodetail .trade .bar { display:block; height:6px; background:var(--panel); }
.fodetail .trade .bar i { display:block; height:100%; }
.fodetail .trade .in .bar i { background:var(--accent); } .fodetail .trade .out .bar i { background:color-mix(in srgb,var(--flag) 72%,var(--panel)); }
.fodetail .trade .v { text-align:right; font-size:12.5px; font-weight:900; font-variant-numeric:tabular-nums; color:var(--ink); }
.fodetail .trade .cap { font-size:10px; font-weight:700; color:var(--ink-2); }
.foreasons { margin:0; padding:0; list-style:none; display:grid; gap:4px; font-size:12.5px; line-height:1.4; color:var(--ink); }
.foreasons li { position:relative; padding-left:14px; }
.foreasons li::before { content:""; position:absolute; left:2px; top:.55em; width:5px; height:5px; background:var(--accent); transform:rotate(45deg); }
.foshowall { display:block; width:100%; margin-top:14px; padding:11px; background:var(--panel-2); border:1px solid var(--line-2); color:var(--ink-2);
  font:inherit; font-size:10.5px; font-weight:900; letter-spacing:.16em; text-transform:uppercase; cursor:pointer; }
.foshowall:hover { color:var(--ink); border-color:var(--accent); }

/* ---- weeks ahead: the road ------------------------------------------------------------------------------------ */
.foroad { list-style:none; margin:0; padding:2px 0 6px; display:flex; gap:8px; }
.foroad li { flex:0 0 184px; display:flex; flex-direction:column; gap:7px; padding:12px 12px 11px; background:var(--panel); border:1px solid var(--line-2); border-top:3px solid var(--line-2); }
.foroad li.post { border-top-color:var(--gold); }
.foroad li.hole { border-top-color:var(--flag); }
.foroad .wk { display:flex; justify-content:space-between; gap:6px; font-size:10px; font-weight:900; letter-spacing:.14em; text-transform:uppercase; color:var(--ink-2); }
.foroad .wk em { font-style:normal; color:var(--gold); letter-spacing:.08em; }
.foroad .vs { display:flex; align-items:center; gap:7px; min-height:34px; font-size:13px; font-weight:900; line-height:1.2; color:var(--ink); }
.foroad .vs .rl { flex:none; width:24px; height:24px; border-radius:50%; object-fit:cover; background:var(--inset); }
.foroad .vs .tbd { font-size:12px; font-weight:700; color:var(--ink-2); }
.foroad .nums { font-size:12px; font-weight:700; color:var(--ink-2); font-variant-numeric:tabular-nums; }
.foroad .nums b { font-size:16px; font-weight:900; color:var(--ink); }
.foroad .nums .vsk { font-size:10px; }
.foroad .tug { position:relative; height:8px; background:var(--inset); }
.foroad .tug::before { content:""; position:absolute; left:50%; top:-3px; bottom:-3px; width:2px; margin-left:-1px; background:var(--ink-2); }
.foroad .tug i { position:absolute; top:0; bottom:0; }
.foroad .tug i.a { left:50%; background:var(--accent); }
.foroad .tug i.b { right:50%; background:color-mix(in srgb,var(--flag) 75%,var(--panel)); }
.foroad .verdict { font-size:11.5px; font-weight:900; color:var(--ink-2); }
.foroad .verdict.a { color:var(--accent); } .foroad .verdict.b { color:var(--flag); }
.foroad .holes { font-size:10.5px; font-weight:900; color:var(--flag); }
.foroad .odds { font-size:10.5px; font-weight:700; line-height:1.35; color:var(--ink-2); }
.foroad .odds b { color:var(--ink); font-variant-numeric:tabular-nums; }
.foroad .crit { align-self:flex-start; padding:1px 6px; font-size:9.5px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; color:var(--signal); border:1px solid var(--signal); }
/* The race (Fortune Teller's odds for this team) */
.forace { display:grid; grid-template-columns:minmax(0,1.1fr) minmax(0,1fr); gap:14px; margin:0 0 6px; }
.foracenums { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); margin:0; border:1px solid var(--line-2); background:var(--inset); }
.foracenums { --fo-ft:26px; --fo-fv:30px; }
.foracenums div { display:grid; grid-template-rows:var(--fo-ft) var(--fo-fv); row-gap:5px; padding:12px 8px; text-align:center; border-right:1px solid var(--line); }
.foracenums div:last-child { border-right:0; }
.foracenums dt { display:flex; align-items:center; justify-content:center; min-width:0; overflow:hidden; font-size:9.5px; line-height:13px; font-weight:900; letter-spacing:.14em; text-transform:uppercase; color:var(--ink-2); }
.foracenums dd { display:flex; align-items:center; justify-content:center; min-width:0; margin:0; white-space:nowrap; font-size:22px; font-weight:900; font-variant-numeric:tabular-nums; }
.foracenums .g { background:linear-gradient(96deg,var(--ink) 0%,var(--ink) 18%,var(--accent) 100%); -webkit-background-clip:text; background-clip:text; color:transparent; -webkit-text-fill-color:transparent; }
.foracenums .down .g { background-image:linear-gradient(96deg,var(--ink) 0%,var(--ink) 18%,var(--flag) 100%); }
.foraceside { display:flex; flex-direction:column; gap:8px; min-width:0; }
.foraceside .k { display:block; font-size:9.5px; font-weight:900; letter-spacing:.14em; text-transform:uppercase; color:var(--ink-2); margin-bottom:3px; }
.foraceside .big { margin:0; }
.foraceside .big .v { display:flex; align-items:center; gap:6px; font-size:13px; font-weight:800; color:var(--ink); }
.foraceside .rl { flex:none; width:20px; height:20px; border-radius:50%; object-fit:cover; background:var(--inset); }
.foraceside .root ul { list-style:none; margin:0; padding:0; }
.foraceside .root li { display:flex; align-items:center; gap:6px; padding:4px 0; border-top:1px solid var(--line); font-size:12.5px; color:var(--ink); }
.foraceside .root li b { font-weight:900; }
.foraceside .root .ov { color:var(--ink-2); font-size:11px; }
.foraceside .root .ag { color:var(--ink-2); font-weight:700; min-width:0; }
.foraceside .root .gn { margin-left:auto; font-weight:900; color:var(--accent); font-variant-numeric:tabular-nums; }
.foraceside .src { margin:0; font-size:11px; color:var(--ink-2); }
@media (max-width:760px) { .forace { grid-template-columns:1fr; } .foracenums { grid-template-columns:repeat(2,minmax(0,1fr)); } .foracenums div:nth-child(2) { border-right:0; } .foracenums div:nth-child(-n+2) { border-bottom:1px solid var(--line); } }

/* ---- weeks ahead: the boards ---------------------------------------------------------------------------------- */
.fogridtools { display:flex; flex-wrap:wrap; gap:8px 14px; align-items:center; margin-bottom:12px; }
.fokey { display:flex; flex-wrap:wrap; gap:6px 12px; font-size:10.5px; font-weight:800; color:var(--ink-2); align-items:center; }
.fokey i { display:inline-block; width:14px; height:10px; margin-right:5px; vertical-align:-1px; border:1px solid var(--line-2); }
.fokey i.soft { background:color-mix(in srgb,var(--accent) 22%,var(--inset)); }
.fokey i.tough { background:color-mix(in srgb,var(--flag) 20%,var(--inset)); }
.fokey i.bye { background:var(--line); }
.fokey i.out { background:repeating-linear-gradient(135deg,var(--inset) 0 3px,color-mix(in srgb,var(--flag) 40%,var(--inset)) 3px 5px); }
.fokey i.on { background:var(--inset); box-shadow:inset 3px 0 0 var(--accent); }
table.foboardw, table.foheat { border-collapse:separate; border-spacing:3px; min-width:100%; font-size:12px; margin:0 -3px; }
.foboardw th, .foboardw td, .foheat th, .foheat td { text-align:center; }
.foboardw thead th, .foheat thead th { padding:6px 4px 4px; font-size:10.5px; font-weight:900; letter-spacing:.1em; text-transform:uppercase; color:var(--ink-2); }
.foboardw thead th.post, .foheat thead th.post { color:var(--gold); }
.foboardw th.sl { position:sticky; left:0; z-index:1; width:56px; padding:0 8px; background:var(--inset); font-size:11px; font-weight:900; letter-spacing:.16em; color:var(--ink); }
.foboardw thead th.sl { color:var(--ink-2); font-size:9.5px; }
.foboardw tr.flex th.sl { color:var(--sky); }
.foboardw td { min-width:122px; padding:8px 8px 7px; background:var(--inset); vertical-align:top; border-top:2px solid transparent; }
.foboardw td .n { display:block; font-size:12px; font-weight:900; line-height:1.25; color:var(--ink); }
.foboardw td .m { display:block; margin-top:3px; font-size:10.5px; font-weight:700; color:var(--ink-2); font-variant-numeric:tabular-nums; }
.foboardw td .m b { color:var(--ink); }
.foboardw td.soft, .foheat td.c.soft { background:color-mix(in srgb,var(--accent) 16%,var(--inset)); border-top-color:var(--accent); }
.foboardw td.tough, .foheat td.c.tough { background:color-mix(in srgb,var(--flag) 13%,var(--inset)); border-top-color:var(--flag); }
.foboardw td.hole { background:repeating-linear-gradient(135deg,var(--inset) 0 5px,color-mix(in srgb,var(--flag) 24%,var(--inset)) 5px 8px); vertical-align:middle; }
.foboardw td.hole .n { color:var(--flag); }
.foboardw tfoot th, .foboardw tfoot td { padding:8px 6px; background:var(--panel-2); font-weight:900; font-variant-numeric:tabular-nums; color:var(--ink); font-size:13px; }
.foboardw tfoot th.sl { font-size:9.5px; color:var(--ink-2); background:var(--panel-2); }
.foheat th.pl { position:sticky; left:0; z-index:1; min-width:170px; max-width:220px; padding:6px 10px; background:var(--panel); text-align:center; }
.foheat thead th.pl, .foheat thead th.sc { background:var(--panel); }
.foheat th.pl .nm { display:block; font-size:12.5px; font-weight:900; color:var(--ink); line-height:1.25; }
.foheat th.pl .sub { display:block; font-size:10px; font-weight:700; color:var(--ink-2); letter-spacing:0; text-transform:none; }
.foheat td.sc { min-width:50px; padding:4px; background:var(--panel-2); font-variant-numeric:tabular-nums; }
.foheat td.sc b { display:block; font-size:15px; font-weight:900; color:var(--ink); }
.foheat td.sc span { font-size:9.5px; font-weight:700; color:var(--ink-2); }
.foheat td.c { position:relative; min-width:70px; padding:6px 4px 9px; background:var(--inset); border-top:2px solid transparent; }
.foheat td.c .v { display:block; font-weight:900; font-variant-numeric:tabular-nums; color:var(--ink); }
.foheat td.c .o { display:block; font-size:9.5px; font-weight:700; color:var(--ink-2); }
.foheat td.c .fill { position:absolute; left:4px; right:4px; bottom:3px; height:3px; background:color-mix(in srgb,var(--ink) 8%,transparent); }
.foheat td.c .fill i { display:block; height:100%; background:var(--ink-2); }
.foheat td.c.on { box-shadow:inset 3px 0 0 var(--accent); }
.foheat td.c.on .fill i { background:var(--accent); }
.foheat td.c.bye { background:var(--line); } .foheat td.c.bye .v { color:var(--ink-2); font-size:10px; letter-spacing:.1em; text-transform:uppercase; }
.foheat td.c.out { background:repeating-linear-gradient(135deg,var(--inset) 0 4px,color-mix(in srgb,var(--flag) 22%,var(--inset)) 4px 7px); }
.foheat td.c.out .v { color:var(--flag); font-size:10px; letter-spacing:.1em; text-transform:uppercase; }

`;
