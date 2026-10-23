/**
 * Season Statistics' own rules (the period rail, record panels' refinements, the sections' expand bar, Record
 * Holders' tally and the matchup emphasis), made only of the site's tokens and type. Written under .scr-ss, the
 * page's root, so they outrank Hall of Fame's rules, which the page uses as they are.
 */
export const SS_CSS = `
/* ---- the period rail ---------------------------------------------------------------------------------- */
.ssrail { position:relative; max-width:760px; margin:6px auto 0; padding:18px 18px 12px; text-align:center;
  background:var(--panel-2); border:1px solid var(--line); }
.ssrail::before { content:""; position:absolute; left:-1px; right:-1px; top:-1px; height:2px;
  background:linear-gradient(90deg,transparent,var(--accent) 22%,var(--accent) 78%,transparent); opacity:.85; }
.ssrailhead { display:flex; flex-direction:column; align-items:center; gap:4px; margin-bottom:14px; }
.ssraileye { font-size:9.5px; font-weight:900; letter-spacing:.2em; text-transform:uppercase; color:var(--ink-3); }
.ssrailnow { font-size:clamp(24px,4.2vw,34px); font-weight:900; letter-spacing:-.02em; line-height:1.05; }
.ssrailmeta { display:inline-flex; flex-wrap:wrap; justify-content:center; align-items:center; gap:6px; font-size:10.5px; font-weight:800;
  letter-spacing:.06em; color:var(--ink-2); }
.scr-ss .ssphase { margin:0 0 16px; }
.sstrackwrap { position:relative; padding:4px 0 0; }
.sstracklbl { display:block; margin-bottom:8px; font-size:9px; font-weight:900; letter-spacing:.2em; text-transform:uppercase; color:var(--ink-3); }
.sstrack { display:grid; align-items:start; }
.sstick { position:relative; display:flex; flex-direction:column; align-items:center; gap:7px; min-width:0; padding:4px 0 2px; margin:0;
  background:none; border:0; color:var(--ink-3); font:inherit; cursor:pointer; }
.sstick:disabled { cursor:default; }
.sstick .seg { position:absolute; left:0; right:0; top:11px; height:2px; background:var(--line-2); }
.sstick.in .seg { background:var(--accent); box-shadow:0 0 8px var(--accent-glow); }
.sstick.in.from .seg { left:50%; }
.sstick.in.to .seg { right:50%; }
.sstick.in.from.to .seg { display:none; }
.sstick.post.in .seg { background:var(--gold); box-shadow:0 0 8px var(--gold-glow); }
.sstick .dot { position:relative; z-index:1; width:10px; height:10px; transform:rotate(45deg); background:var(--panel-2);
  border:1.5px solid var(--ink-3); transition:transform .16s ease, background .16s ease, border-color .16s ease; }
.sstick.future .dot { border-style:dashed; border-color:var(--line-2); }
.sstick.in .dot { background:var(--accent); border-color:var(--accent); }
.sstick.post.in .dot { background:var(--gold); border-color:var(--gold); }
.sstick.end .dot { transform:rotate(45deg) scale(1.45); box-shadow:0 0 0 3px var(--panel-2), 0 0 0 4.5px var(--accent), 0 0 14px var(--accent-glow); }
.sstick .n { font-size:10px; font-weight:900; font-variant-numeric:tabular-nums; letter-spacing:.02em; }
.sstick.in .n { color:var(--ink); }
.sstick.end .n { color:var(--accent); transform:translateY(4px); }
.sstick.future .n { opacity:.55; }
.sstick:not(:disabled):hover .dot { border-color:var(--accent); }
.sstick:not(:disabled):hover .n { color:var(--accent); }
.sstick:focus-visible { outline:2px solid var(--sky); outline-offset:2px; }
.ssgap { position:relative; display:flex; justify-content:center; padding-top:9px; }
.ssgap i { width:1px; height:14px; background:var(--line-2); }
.sstrackfoot { display:grid; margin-top:8px; font-size:8.5px; font-weight:900; letter-spacing:.16em; text-transform:uppercase; color:var(--ink-3); }
.sstrackfoot span { border-top:1px solid var(--line); padding-top:5px; }
.sstrackfoot span:nth-child(2) { border:0; }
.sstrackfoot .post { color:var(--gold); border-top-color:color-mix(in srgb,var(--gold) 45%,transparent); }
@media (max-width:520px) {
  .ssrail { padding:16px 10px 10px; }
  .sstick .n { font-size:9px; }
  .sstick .dot { width:8px; height:8px; }
  .sstick .seg { top:10px; }
}

/* ---- record panels -------------------------------------------------------------------------------------- */
.scr-ss .ssrec { overflow:visible; }
.scr-ss .ssrec .tlabel { color:var(--ink-2); }
.scr-ss .ssrec .sstitle { background:linear-gradient(94deg,var(--ink) 10%,var(--accent) 150%);
  -webkit-background-clip:text; background-clip:text; color:transparent; -webkit-text-fill-color:transparent; }
.scr-ss .ssrec.ssbad .tvalue.gradv { background-image:linear-gradient(100deg,var(--ink) 0%,var(--ink) 24%,color-mix(in srgb,var(--flag) 70%,var(--ink)) 64%,var(--flag) 100%); }
.scr-ss .ssrec.ssbad .sstitle { background-image:linear-gradient(94deg,var(--ink) 10%,var(--flag) 160%); }
.scr-ss .ssrec .rankline { color:var(--ink-2); }
.ssline { display:flex; flex-wrap:wrap; justify-content:center; align-items:center; gap:4px 6px; }
.sswk { display:inline-block; padding:2px 7px; font-size:8.5px; font-weight:900; letter-spacing:.14em; text-transform:uppercase;
  color:var(--ink); border:1px solid color-mix(in srgb,var(--accent) 55%,transparent); background:color-mix(in srgb,var(--accent) 10%,transparent); }
.ssbad .sswk { border-color:color-mix(in srgb,var(--flag) 55%,transparent); background:color-mix(in srgb,var(--flag) 9%,transparent); }
.ssunit { font-size:10px; font-weight:800; letter-spacing:.05em; color:var(--ink-2); }
.ssmeta { font-size:9.5px; font-weight:800; letter-spacing:.04em; color:var(--ink-2); }
.sslivechip { display:inline-flex; align-items:center; gap:5px; padding:2px 7px; font-size:8.5px; font-weight:900; letter-spacing:.14em;
  text-transform:uppercase; color:var(--on-accent); background:var(--accent); }
.sslivechip::before { content:""; width:5px; height:5px; border-radius:50%; background:currentColor; animation:sspulse 1.6s ease-in-out infinite; }
@keyframes sspulse { 50% { opacity:.25; } }
html.stillness .sslivechip::before { animation:none; }
.scr-ss .tile.sslive { border-color:color-mix(in srgb,var(--accent) 60%,var(--line)); box-shadow:0 0 22px -8px var(--accent-glow); }
/* Holders: the name in the site's gradient, as every standings table draws a team. */
.scr-ss .ssrec .tname { border-color:color-mix(in srgb,var(--accent) 22%,var(--line-2)); }
.scr-ss .ssrec .tname i b { background:linear-gradient(94deg,var(--ink) 30%,var(--accent) 165%);
  -webkit-background-clip:text; background-clip:text; color:transparent; -webkit-text-fill-color:transparent; }
.scr-ss .ssrec .tname i em { color:var(--ink-2); }
.scr-ss .tnote .ssnext { display:block; margin-top:7px; padding-top:6px; border-top:1px solid var(--line); color:var(--ink-2); }
.scr-ss .tnote .ssnext b { margin-right:6px; font-size:8.5px; font-weight:900; letter-spacing:.16em; text-transform:uppercase; color:var(--accent); }
/* Record Holders: the split behind the score. */
.sstally { display:flex; flex-direction:column; align-items:center; gap:4px; width:100%; }
.sstallybar { display:flex; gap:2px; width:min(150px,80%); height:5px; }
.sstallybar i { display:block; min-width:0; flex-basis:0; }
.sstallybar i.g { background:var(--accent); box-shadow:0 0 8px var(--accent-glow); }
.sstallybar i.b { background:var(--flag); }
.sstallytxt { font-size:9.5px; font-weight:800; letter-spacing:.06em; color:var(--ink-2); text-transform:uppercase; }
.sstallytxt b { font-size:11px; font-weight:900; margin-left:4px; }
.sstallytxt b:first-child { margin-left:0; }
.sstallytxt b.g { color:var(--accent); } .sstallytxt b.b { color:var(--flag); }

/* ---- sections and the bar that opens the rest ------------------------------------------------------------ */
.sssec { margin-bottom:4px; }
.scr-ss .sssec .rowgrid + .rowgrid { margin-top:11px; }
.ssrest { animation:ssreveal .32s ease both; }
@keyframes ssreveal { from { opacity:0; transform:translateY(6px); } }
html.stillness .ssrest { animation:none; }
.ssmore { position:relative; display:flex; align-items:center; justify-content:center; gap:12px; width:100%; margin:14px 0 0; padding:13px 16px;
  background:var(--panel-2); border:1px solid var(--line-2); color:var(--ink); font:inherit; cursor:pointer;
  transition:border-color .16s ease, box-shadow .16s ease; }
.ssmore::before, .ssmore::after { content:""; position:absolute; top:50%; width:calc(50% - 150px); max-width:240px; height:1px;
  background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--accent) 55%,transparent)); }
.ssmore::before { left:16px; }
.ssmore::after { right:16px; transform:scaleX(-1); }
.ssmore:hover { border-color:var(--accent); box-shadow:0 0 22px -10px var(--accent-glow); }
.ssmore:focus-visible { outline:2px solid var(--sky); outline-offset:2px; }
.ssmoret { font-size:10.5px; font-weight:900; letter-spacing:.17em; text-transform:uppercase;
  background:linear-gradient(94deg,var(--ink) 10%,var(--accent) 150%); -webkit-background-clip:text; background-clip:text;
  color:transparent; -webkit-text-fill-color:transparent; }
.ssmoren { padding:2px 8px; font-size:10px; font-weight:900; font-variant-numeric:tabular-nums; letter-spacing:.06em;
  color:var(--on-accent); background:var(--accent); }
.ssmore.open .ssmoren { color:var(--ink-2); background:none; border:1px solid var(--line-2); }
.ssmorechev { width:8px; height:8px; border-right:2px solid var(--accent); border-bottom:2px solid var(--accent); transform:translateY(-2px) rotate(45deg);
  transition:transform .2s ease; }
.ssmore.open .ssmorechev { transform:translateY(2px) rotate(-135deg); }
@media (max-width:560px) { .ssmore::before, .ssmore::after { display:none; } .ssmoret { letter-spacing:.12em; } }

.scr-ss .ssstandpanel { padding:14px 14px 10px; margin-bottom:22px; }
@media (max-width:440px) { .scr-ss .ssphase .phasetab { padding:8px 9px; letter-spacing:.08em; } }

/* A matchup record with a winner: the winner's chip outlined green, the other team's red (D63 for the good ones,
   and every neutral matchup record too, like Closest game). Outline and a soft inner glow on the chip only, so it
   reads apart from the panel's live glow and the value's gradient; the panel's note names both again (For / Against,
   or Won / Lost), so colour is never the only cue. A tie, or a pair with no side ahead, has neither. */
.scr-ss .ssrec .tname.sswin { border-color:var(--accent);
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--accent) 45%,transparent), 0 0 12px -3px var(--accent-glow); }
.scr-ss .ssrec .tname.sslose { border-color:color-mix(in srgb,var(--flag) 75%,transparent);
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--flag) 30%,transparent), 0 0 12px -4px color-mix(in srgb,var(--flag) 70%,transparent); }
.scr-ss .ssrec .tname.sslose i b { background-image:linear-gradient(94deg,var(--ink) 30%,var(--flag) 165%); }

/* One panel, five fixed areas (title, value, subtitle, week label, holders), each centred in its own band, so a
   title that wraps, a smaller value or a missing subtitle never shifts the rest: every panel's value, subtitle and
   week sit at the same height. The bands are sized for the longest title and subtitle the page has at each width
   (test/browser.mjs fails any panel whose content outgrows its band). */
.scr-ss .ssrec { --ss-t:28px; --ss-v:48px; --ss-s:30px; --ss-w:20px; --ss-n:32px;
  display:grid; grid-template-rows:var(--ss-t) var(--ss-v) var(--ss-s) var(--ss-w) var(--ss-n); row-gap:5px;
  align-items:stretch; min-height:0; padding:14px 12px 12px; }
.scr-ss .ssrec > [class*="ssarea-"] { display:flex; align-items:center; justify-content:center; min-width:0; width:100%; }
/* The title clears the info button with two small floats on its first line only, so a long title keeps the
   panel's full width on its later lines and stays centred. */
.scr-ss .ssrec .ssarea-t { padding:0; }
.scr-ss .ssrec .sstbox { display:block; width:100%; text-align:center; }
.scr-ss .ssrec .ssfl, .scr-ss .ssrec .ssfr { display:block; width:18px; height:12px; }
.scr-ss .ssrec .ssfl { float:left; } .scr-ss .ssrec .ssfr { float:right; }
.scr-ss .ssrec .ssarea-v .tvalue { width:100%; }
.scr-ss .ssrec .ssarea-e { grid-row:2 / 5; }
.scr-ss .ssrec .ssarea-e .placeholder { width:100%; padding:14px 10px; }
.scr-ss .ssrec .ssarea-s { line-height:1.3; text-align:center; }
.scr-ss .ssrec .ssarea-w { gap:6px; }
.scr-ss .ssrec .ssarea-n > .tfootnames { width:100%; }
@media (max-width:860px) {
  .scr-ss .ssrec { --ss-t:28px; --ss-v:34px; --ss-s:30px; }
}
@media (max-width:520px) {
  .scr-ss .ssrec { --ss-t:41px; --ss-s:42px; padding:12px 8px 10px; }
}
@media (max-width:359px) {
  .scr-ss .ssrec { --ss-t:55px; --ss-s:55px; }
}
.scr-ss .tnote .ssnext b.ssagainst { margin-left:8px; color:var(--flag); }
`;
