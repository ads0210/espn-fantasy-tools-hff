/**
 * Shared UI shell — "Broadcast Chalkboard".
 *
 * Structural decisions worth knowing:
 *
 *   Display type is fitted by measurement, not by textLength alone. iOS Safari
 *   does not honour lengthAdjust="spacingAndGlyphs" reliably, so a long league
 *   name rendered at its natural width and was clipped on both sides. The
 *   declarative attribute stays as the baseline; a measuring pass corrects it
 *   wherever the browser ignored it.
 *
 *   Both palettes ship in every response, scoped to html[data-theme]. Switching
 *   flips an attribute rather than reloading, because a reload would discard
 *   the in-memory Admin Password on Site Configuration.
 *
 *   Motion is layered and every layer is suppressible. A site-wide "reduce
 *   motion" setting is stored in a cookie and applied server-side, so a device
 *   that wants stillness never paints a single frame of animation.
 *
 *   Nothing loads an external font, script or stylesheet: no asset may be
 *   fetched before the League Password gate has run.
 */

export const THEME_COOKIE = 'eft_theme';
export const TEAM_COOKIE = 'eft_team';
export const MOTION_COOKIE = 'eft_motion';
export const TZ_COOKIE = 'eft_tz';

export const GITHUB_URL = 'https://github.com/shortcutsbin-netizen';
export const GITHUB_LABEL = 'GitHub - shortcutsbin-netizen';

export const PALETTES = `
  html[data-theme="dark"] {
    --field:#070A08; --field-2:#0B100C; --panel:#111713; --panel-2:#161D18;
    --inset:#0A0F0B; --line:#1F2A21; --line-2:#2C3B2E;
    --ink:#E6F2E4; --ink-2:#93A695; --ink-3:#5A6A5C;
    --accent:#63FF4A; --accent-2:#B6FF3C; --accent-deep:#2BB81C;
    --accent-glow:rgba(99,255,74,.16);
    --flag:#FF5C5C; --flag-soft:rgba(255,92,92,.13);
    --signal:#FFB020; --signal-soft:rgba(255,176,32,.13);
    --sky:#5BA8FF;
    --grid-opacity:.55; --ghost-opacity:.05; --bloom-a:.20; --bloom-b:.13;
    --scan:rgba(255,255,255,.016); --mote:rgba(190,255,180,.62); --grain-opacity:.055;
    color-scheme:dark;
  }
  html[data-theme="light"] {
    --field:#EBF1E9; --field-2:#F7FAF6; --panel:#FFFFFF; --panel-2:#F4F8F3;
    --inset:#F3F8F2; --line:#D4E0D3; --line-2:#B4C6B3;
    --ink:#0D140C; --ink-2:#48564A; --ink-3:#75846F;
    --accent:#12762E; --accent-2:#4FA524; --accent-deep:#0A5220;
    --accent-glow:rgba(18,118,46,.13);
    --flag:#BF2231; --flag-soft:rgba(191,34,49,.08);
    --signal:#8A5406; --signal-soft:rgba(138,84,6,.10);
    --sky:#20629E;
    --grid-opacity:1; --ghost-opacity:.08; --bloom-a:.22; --bloom-b:.16;
    --scan:rgba(0,0,0,.018); --mote:rgba(18,118,46,.5); --grain-opacity:.05;
    color-scheme:light;
  }
`;

/**
 * The field. Yard lines and hash marks drift diagonally by exactly one pattern
 * tile, which makes the loop seamless. The rects are oversized so the drift
 * never exposes an edge, and the whole thing is a single composited transform.
 */
const FIELD_SVG = `
<svg class="field" aria-hidden="true" preserveAspectRatio="none">
  <defs>
    <pattern id="yard" width="96" height="96" patternUnits="userSpaceOnUse">
      <path d="M0 0 V96" stroke="currentColor" stroke-width="1" opacity=".6"/>
      <path d="M0 0 H96" stroke="currentColor" stroke-width="1" opacity=".22"/>
      <path d="M0 24 h9 M0 48 h14 M0 72 h9" stroke="currentColor" stroke-width="1" opacity=".45"/>
      <path d="M48 20 v6 M48 44 v6 M48 68 v6" stroke="currentColor" stroke-width="1" opacity=".3"/>
    </pattern>
    <pattern id="numbers" width="1536" height="384" patternUnits="userSpaceOnUse"><text x="30" y="118" font-size="86" font-weight="900" fill="currentColor" opacity=".17" letter-spacing="-4" font-family="ui-sans-serif,system-ui,sans-serif">10</text><text x="222" y="118" font-size="86" font-weight="900" fill="currentColor" opacity=".17" letter-spacing="-4" font-family="ui-sans-serif,system-ui,sans-serif">20</text><text x="414" y="118" font-size="86" font-weight="900" fill="currentColor" opacity=".17" letter-spacing="-4" font-family="ui-sans-serif,system-ui,sans-serif">30</text><text x="606" y="118" font-size="86" font-weight="900" fill="currentColor" opacity=".17" letter-spacing="-4" font-family="ui-sans-serif,system-ui,sans-serif">40</text><text x="798" y="118" font-size="86" font-weight="900" fill="currentColor" opacity=".17" letter-spacing="-4" font-family="ui-sans-serif,system-ui,sans-serif">50</text><text x="990" y="118" font-size="86" font-weight="900" fill="currentColor" opacity=".17" letter-spacing="-4" font-family="ui-sans-serif,system-ui,sans-serif">40</text><text x="1182" y="118" font-size="86" font-weight="900" fill="currentColor" opacity=".17" letter-spacing="-4" font-family="ui-sans-serif,system-ui,sans-serif">30</text><text x="1374" y="118" font-size="86" font-weight="900" fill="currentColor" opacity=".17" letter-spacing="-4" font-family="ui-sans-serif,system-ui,sans-serif">20</text><text x="30" y="330" font-size="86" font-weight="900" fill="currentColor" opacity=".13" letter-spacing="-4" font-family="ui-sans-serif,system-ui,sans-serif" transform="rotate(180 60 302)">10</text><text x="222" y="330" font-size="86" font-weight="900" fill="currentColor" opacity=".13" letter-spacing="-4" font-family="ui-sans-serif,system-ui,sans-serif" transform="rotate(180 252 302)">20</text><text x="414" y="330" font-size="86" font-weight="900" fill="currentColor" opacity=".13" letter-spacing="-4" font-family="ui-sans-serif,system-ui,sans-serif" transform="rotate(180 444 302)">30</text><text x="606" y="330" font-size="86" font-weight="900" fill="currentColor" opacity=".13" letter-spacing="-4" font-family="ui-sans-serif,system-ui,sans-serif" transform="rotate(180 636 302)">40</text><text x="798" y="330" font-size="86" font-weight="900" fill="currentColor" opacity=".13" letter-spacing="-4" font-family="ui-sans-serif,system-ui,sans-serif" transform="rotate(180 828 302)">50</text><text x="990" y="330" font-size="86" font-weight="900" fill="currentColor" opacity=".13" letter-spacing="-4" font-family="ui-sans-serif,system-ui,sans-serif" transform="rotate(180 1020 302)">40</text><text x="1182" y="330" font-size="86" font-weight="900" fill="currentColor" opacity=".13" letter-spacing="-4" font-family="ui-sans-serif,system-ui,sans-serif" transform="rotate(180 1212 302)">30</text><text x="1374" y="330" font-size="86" font-weight="900" fill="currentColor" opacity=".13" letter-spacing="-4" font-family="ui-sans-serif,system-ui,sans-serif" transform="rotate(180 1404 302)">20</text></pattern>
    <pattern id="yardFine" width="19.2" height="96" patternUnits="userSpaceOnUse">
      <path d="M0 44 v8" stroke="currentColor" stroke-width="1" opacity=".3"/>
    </pattern>
    <radialGradient id="vig" cx="50%" cy="30%" r="80%">
      <stop offset="0%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="1"/>
    </radialGradient>
    <mask id="vigMask">
      <rect width="100%" height="100%" fill="#fff"/>
      <rect width="100%" height="100%" fill="url(#vig)"/>
    </mask>
  </defs>
  <g mask="url(#vigMask)">
    <g class="drift">
      <rect x="-12%" y="-12%" width="124%" height="124%" fill="url(#yardFine)"/>
      <rect x="-12%" y="-12%" width="124%" height="124%" fill="url(#yard)"/>
      <rect x="-12%" y="-12%" width="124%" height="124%" fill="url(#numbers)"/>
    </g>
  </g>
</svg>`;

export const BACKDROP = `
<div class="fieldwash"></div>
${FIELD_SVG}
<div class="bloom bloom-a"></div>
<div class="bloom bloom-b"></div>
<div class="scanlines"></div>
<div class="grain"></div>
<div class="sweeplight"></div>
<div class="sweeplight b"></div>
<div class="motes" aria-hidden="true">${Array.from({ length: 22 }, () => '<i></i>').join('')}</div>
<div class="livebar"><i></i></div>`;

export const BASE_CSS = `
  *, *::before, *::after { box-sizing:border-box; }

  /* The hidden attribute is enforced only by a UA rule of the same specificity
     as any author display declaration, so one layout rule elsewhere can
     silently reveal a hidden section. That is exactly how the Site
     Configuration panels came to render before the Admin Password was entered.
     Making it important means hidden always means hidden, everywhere. */
  [hidden] { display:none !important; }

  body { margin:0; min-height:100svh; background:var(--field); color:var(--ink);
    font:15px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
    -webkit-font-smoothing:antialiased; overflow-x:hidden; }

  /* --- backdrop ------------------------------------------------------------ */
  .field { position:fixed; inset:0; width:100%; height:100%; z-index:0;
           color:var(--line-2); opacity:var(--grid-opacity); pointer-events:none; }
  .drift { animation:drift 46s linear infinite; will-change:transform; }
  @keyframes drift { to { transform:translate3d(96px,96px,0); } }

  .fieldwash { position:fixed; inset:0; z-index:0; pointer-events:none;
    background:linear-gradient(180deg, var(--field-2) 0%, var(--field) 46%); }

  /* Stadium blooms: two very large, very slow radial washes. Opacity and
     transform only, so they composite on the GPU and cost nothing to animate. */
  .bloom { position:fixed; z-index:0; pointer-events:none; border-radius:50%;
           filter:blur(42px); will-change:transform,opacity; }
  .bloom-a { top:-28vmax; left:-14vmax; width:72vmax; height:52vmax;
    background:radial-gradient(closest-side, var(--accent-glow), transparent 70%);
    opacity:var(--bloom-a); animation:floatA 34s ease-in-out infinite alternate; }
  .bloom-b { bottom:-34vmax; right:-18vmax; width:64vmax; height:48vmax;
    background:radial-gradient(closest-side, var(--accent-glow), transparent 72%);
    opacity:var(--bloom-b); animation:floatB 44s ease-in-out infinite alternate; }
  @keyframes floatA { to { transform:translate3d(9vmax,5vmax,0) scale(1.12); } }
  @keyframes floatB { to { transform:translate3d(-8vmax,-6vmax,0) scale(1.09); } }

  .scanlines { position:fixed; inset:0; z-index:0; pointer-events:none;
    background:repeating-linear-gradient(0deg, var(--scan) 0 1px, transparent 1px 3px); }

  /* Film grain, tiled from a single generated 160px swatch so the expensive
     turbulence is rasterised once rather than across the whole viewport. */
  .grain { position:fixed; inset:0; z-index:0; pointer-events:none;
    opacity:var(--grain-opacity);
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='160' height='160' filter='url(%23n)'/></svg>");
    background-size:160px 160px; }

  /* A stadium light travelling the length of the field. */
  .sweeplight { position:fixed; top:-46%; left:-70%; width:46%; height:200%;
    z-index:0; pointer-events:none;
    background:linear-gradient(90deg, transparent, var(--accent-glow) 46%, transparent);
    filter:blur(30px);
    animation:lightsweep 26s linear infinite; }
  .sweeplight.b { animation-delay:-13s; }
  @keyframes lightsweep {
    from { transform:translate3d(0,0,0) rotate(14deg); }
    to   { transform:translate3d(250vw,0,0) rotate(14deg); }
  }

  /* Chalk motes: fourteen elements, transform-only, staggered. */
  .motes { position:fixed; inset:0; z-index:0; pointer-events:none; overflow:hidden; }
  .motes i { position:absolute; bottom:-12px; width:2px; height:2px; border-radius:50%;
    background:var(--mote); opacity:0; animation:rise linear infinite; }
  @keyframes rise {
    0% { opacity:0; transform:translate3d(0,0,0); }
    12% { opacity:.85; }
    88% { opacity:.5; }
    100% { opacity:0; transform:translate3d(var(--dx,14px),-102vh,0); }
  }
  ${Array.from({ length: 22 }, (_, i) => {
    const left = (i * 4.6 + 2) % 98;
    const dur = 19 + ((i * 7) % 24);
    const delay = (i * 1.9) % 26;
    const dx = ((i % 7) - 3) * 14;
    const size = 1 + (i % 4) * 0.6;
    return `.motes i:nth-child(${i + 1}) { left:${left}%; animation-duration:${dur}s;
      animation-delay:-${delay}s; --dx:${dx}px; width:${size}px; height:${size}px; }`;
  }).join('\n  ')}

  .livebar { position:fixed; top:0; left:0; right:0; height:2px; z-index:40;
    overflow:hidden; background:transparent; }
  .livebar > i { position:absolute; inset:0; display:block;
    background-image:repeating-linear-gradient(90deg,
      transparent 0 210px, var(--accent-deep) 250px, var(--accent) 290px,
      var(--accent-deep) 330px, transparent 370px 640px);
    background-size:640px 100%;
    animation:sweep 11s linear infinite; }
  @keyframes sweep { from { background-position:0 0; } to { background-position:640px 0; } }

  /* --- layout --------------------------------------------------------------- */
  /* One content measure for every surface on the site — shell pages, the setup
     wizard and the client-rendered tools alike. Draft Helper set this by hand
     and everything else picked its own, so two tabs at the same viewport were
     visibly different widths. */
  .wrap { position:relative; z-index:1; width:100%; max-width:1180px; margin:0 auto;
    padding:clamp(18px,3.2vw,42px) clamp(16px,3.4vw,46px) 12px;
    min-height:100svh; display:flex; flex-direction:column; }
  .pagegrid { display:grid; grid-template-columns:1fr; gap:clamp(18px,2.6vw,40px);
              align-items:start; }
  .pagegrid > * { min-width:0; }
  .main { min-width:0; }
  @media (min-width:960px) {
    .pagegrid { grid-template-columns:minmax(300px,0.9fr) minmax(420px,1.1fr); }
    .rail { position:sticky; top:clamp(18px,3.2vw,42px); }
    /* Sign-in style pages read better with the two columns optically centred. */
    .pagegrid.centred { align-items:center; min-height:calc(100svh - 190px); }
  }
  .pagegrid.band { grid-template-columns:1fr; }
  /* A single centred column: the identity sits above the work rather than
     beside it, for pages whose panels want the full measure. */
  /* A single column: the identity sits above the work rather than beside it,
     for pages whose panels want the full measure. It keeps the full page width
     — capping it at a phone-ish 820px on a 1440px display left most of the
     screen empty and made the densest surface in the site look like the
     narrowest. Width is given back to the panels below, which lay themselves
     out in columns rather than growing into one very wide list. */
  .pagegrid.stack { grid-template-columns:1fr; }
  .pagegrid.stack .rail { position:static; max-width:820px; }
  @media (min-width:960px) {
    .pagegrid.band .rail { position:static; display:flex; align-items:center;
      justify-content:space-between; gap:32px; border-bottom:1px solid var(--line);
      padding-bottom:16px; }
    .pagegrid.band .titlebar { flex:none; width:min(48%,650px);
                               padding-right:0; margin-bottom:0; }
    .pagegrid.band .railmark { width:100%; max-width:none; }
    .pagegrid.band .railtext { text-align:right; flex:1; min-width:0; padding-right:46px; }
    .pagegrid.band .railtext .display { width:min(100%,560px); margin-left:auto; }
    .pagegrid.band .railtext .sub { margin-left:auto; }
  }
  .grow { flex:1; min-height:10px; }

  /* --- wordmark -------------------------------------------------------------- */
  .titlebar { position:relative; margin-bottom:16px; padding-right:76px; }
  .railmark { width:min(100%,360px); }
  .mark { width:100%; height:auto; display:block; overflow:hidden; }
  .mark .m1 { fill:var(--accent); }
  .mark .m2 { fill:var(--ink); }
  .mark .rule { stroke:var(--line-2); stroke-width:3; fill:none;
    stroke-dasharray:1000; stroke-dashoffset:1000;
    animation:draw 1.1s cubic-bezier(.2,.7,.3,1) .1s forwards; }
  .mark .rulelive { stroke:var(--accent); stroke-width:3; fill:none;
    stroke-dasharray:1000; stroke-dashoffset:1000;
    animation:draw 1.5s cubic-bezier(.2,.7,.3,1) .28s forwards; }
  @keyframes draw { to { stroke-dashoffset:0; } }

  /* --- controls cluster ------------------------------------------------------- */
  .controls { position:absolute; z-index:20; display:flex; align-items:center; gap:4px;
    right:clamp(16px,3.4vw,46px); top:clamp(18px,3.2vw,42px); }
  .ctlbtn { background:none; border:0; padding:0; color:var(--ink-3); cursor:pointer;
    line-height:0; width:26px; height:26px; display:flex; align-items:center;
    justify-content:center; transition:color .18s ease, transform .3s ease; }
  .ctlbtn:hover { color:var(--accent); }
  #gearBtn:hover { transform:rotate(50deg); }
  .ctlbtn svg { width:100%; height:100%; }

  /* The instructions overlay. Same shape on every surface, including the tools,
     so "how this works" is one thing the reader learns once. */
  .instr { position:fixed; inset:0; z-index:80; background:var(--field); overflow-y:auto; }
  .instr[hidden] { display:none !important; }
  .instrwrap { max-width:640px; margin:0 auto; padding:26px 18px 40px; }
  .instrhead { display:flex; align-items:center; gap:12px; margin-bottom:20px; }
  .instrhead h2 { flex:1; margin:0; font-size:20px; font-weight:900; letter-spacing:-.02em;
    background:linear-gradient(96deg,var(--ink) 30%,var(--accent) 130%);
    -webkit-background-clip:text; background-clip:text;
    color:transparent; -webkit-text-fill-color:transparent; }
  .istep { display:flex; gap:14px; padding:15px 0; border-bottom:1px solid var(--line); }
  .istep:last-of-type { border-bottom:0; }
  .inum { flex:none; font-size:22px; font-weight:900; color:var(--ink); opacity:.2;
    font-variant-numeric:tabular-nums; }
  .istep b { display:block; font-size:11px; font-weight:900; letter-spacing:.16em;
    text-transform:uppercase; margin-bottom:5px;
    background:linear-gradient(94deg,var(--ink) 10%,var(--accent) 160%);
    -webkit-background-clip:text; background-clip:text;
    color:transparent; -webkit-text-fill-color:transparent; }
  .istep p { margin:0; font-size:13.5px; color:var(--ink-2); line-height:1.6; }

  .settings { position:absolute; right:0; top:34px; width:264px; z-index:30;
    background:var(--panel); border:1px solid var(--line-2); padding:14px;
    box-shadow:0 18px 46px -22px rgba(0,0,0,.75);
    opacity:0; transform:translateY(-6px) scale(.98); pointer-events:none;
    transition:opacity .18s ease, transform .18s ease; }
  .settings.open { opacity:1; transform:none; pointer-events:auto; }
  .settings::before { content:""; position:absolute; left:-1px; right:-1px; top:-1px;
    height:2px; background:linear-gradient(90deg,var(--accent),transparent 75%); }
  .setttl { font-size:9.5px; font-weight:900; letter-spacing:.2em; text-transform:uppercase;
            color:var(--ink-3); margin-bottom:10px; }
  .setrow { display:flex; align-items:center; justify-content:space-between; gap:12px;
            padding:8px 0; border-bottom:1px solid var(--line); }
  .setrow:last-child { border-bottom:0; }
  .setlab { font-size:12px; font-weight:700; color:var(--ink); }
  .setlab small { display:block; font-size:10px; font-weight:600; color:var(--ink-3);
                  letter-spacing:.03em; margin-top:1px; }
  .sw { flex:none; width:36px; height:20px; border:1px solid var(--line-2);
        background:var(--inset); cursor:pointer; position:relative; padding:0; }
  .sw::after { content:""; position:absolute; top:2px; left:2px; width:14px; height:14px;
    background:var(--ink-3); transition:transform .18s ease, background .18s ease; }
  .sw[aria-checked="true"] { border-color:var(--accent); }
  .sw[aria-checked="true"]::after { transform:translateX(16px); background:var(--accent); }

  /* Time zone picker. The list is every zone the engine knows about, so it
     needs a filter to be usable; the row itself stays the same height as the
     switches above it so the menu keeps one rhythm. */
  .setrow.tzrow { border-bottom:0; padding-bottom:2px; }
  .tzpick { padding-bottom:4px; }
  .tzpick .xsel { width:100%; }
  .tzpick .xselbtn { padding:9px 11px; }
  .tzpick .xselval { font-size:11.5px; }
  .tzpick .xsellist { max-height:250px; }
  .tzfilterrow { position:sticky; top:-4px; z-index:1; padding:4px !important;
    background:var(--panel); border-left-color:transparent !important; cursor:default; }
  .tzfilterrow:hover { background:var(--panel); }
  .tzfilter { width:100%; padding:8px 9px; font-size:12px; font-family:inherit;
    background:var(--inset); border:1px solid var(--line-2); color:var(--ink); }
  .tzfilter:focus { outline:none; border-color:var(--accent); }
  .tzauto { display:block; width:100%; margin-top:7px; background:none;
    border:1px solid var(--line); color:var(--ink-3); font-family:inherit;
    font-size:9.5px; font-weight:900; letter-spacing:.14em; text-transform:uppercase;
    padding:7px; cursor:pointer; transition:border-color .16s ease, color .16s ease; }
  .tzauto:hover { border-color:var(--sky); color:var(--sky); }

  /* --- display typography ------------------------------------------------------- */
  /* The league name is drawn rather than set: it takes a gradient no plain text
     can, and a measuring pass guarantees it fits its box on every engine. */
  .display { width:100%; height:auto; display:block; overflow:hidden; margin:2px 0 12px; }
  .display text { font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
                  font-weight:900; letter-spacing:-2; }
  .display .underline { stroke:var(--accent); stroke-width:4; fill:none;
    stroke-dasharray:1000; stroke-dashoffset:1000;
    animation:draw 1.3s cubic-bezier(.2,.7,.3,1) .35s forwards; }
  .display .gstop-a { stop-color:var(--accent); }
  .display .gstop-b { stop-color:var(--ink); }
  .display .gstop-c { stop-color:var(--accent-2); }
  /* The sweep keeps the gradient legible in both themes and at any width — a
     single static ramp all but disappears on a wide light-theme viewport. */

  .eyebrow { font-size:10.5px; font-weight:900; letter-spacing:.24em;
    text-transform:uppercase; color:var(--accent); margin:0 0 10px;
    display:flex; align-items:center; gap:9px; }
  .eyebrow::before { content:""; width:6px; height:6px; background:currentColor;
                     transform:rotate(45deg); flex:none; }
  .eyebrow::after { content:""; flex:1; height:1px;
    background:linear-gradient(90deg,var(--line-2),transparent); }

  h1 { font-size:clamp(23px,4.4vw,34px); line-height:1.06; margin:0 0 9px;
       font-weight:900; letter-spacing:-.025em; text-wrap:balance; }
  h2 { font-size:clamp(15px,1.6vw,18px); font-weight:900; letter-spacing:-.015em;
       margin:0 0 10px; }
  .sub { color:var(--ink-2); font-size:clamp(13.5px,1.15vw,15px); margin:0 0 22px;
         max-width:52ch; text-wrap:pretty; }

  /* Gradient text for secondary headings, so nothing sits as flat ink. */
  .grad { background:linear-gradient(96deg, var(--ink) 0%, var(--ink) 42%, var(--accent) 108%);
    -webkit-background-clip:text; background-clip:text; color:transparent;
    -webkit-text-fill-color:transparent; }

  /* --- panels ------------------------------------------------------------------- */
  .panel { position:relative; background:var(--panel); border:1px solid var(--line);
           padding:clamp(18px,1.7vw,24px) clamp(16px,1.6vw,22px); margin-bottom:14px; }
  .panel::before { content:""; position:absolute; left:-1px; right:-1px; top:-1px; height:2px;
    background:linear-gradient(90deg, var(--accent) 0%, var(--accent-deep) 34%, transparent 78%); }
  .panel::after { content:""; position:absolute; right:9px; bottom:8px; width:11px; height:11px;
    border-right:1px solid var(--line-2); border-bottom:1px solid var(--line-2); }
  .panel.plain::before { background:linear-gradient(90deg,var(--line-2),transparent 70%); }
  .panel.tight { padding:13px clamp(14px,1.4vw,18px) 12px; }
  .panel.tight::after { display:none; }

  .panelhead { display:flex; align-items:center; gap:10px; margin:-2px 0 14px; }
  .panelhead .t { font-size:11px; font-weight:900; letter-spacing:.16em;
    text-transform:uppercase;
    background:linear-gradient(94deg,var(--ink) 10%,var(--accent) 150%);
    -webkit-background-clip:text; background-clip:text;
    color:transparent; -webkit-text-fill-color:transparent; }
  .panelhead::before { content:""; width:6px; height:6px; flex:none;
    background:var(--accent); transform:rotate(45deg); }

  /* A panel ends just past its last line, not a whole row below it. */
  .panel > *:last-child { margin-bottom:0; }
  .panel .hint:last-child, .panel .note:last-child { margin-bottom:0; }

  .ghostmark { position:absolute; right:14px; top:-4px; width:62px; height:62px;
               color:var(--ink); opacity:var(--ghost-opacity); pointer-events:none; }
  .ghostmark svg { width:100%; height:100%; }
  .ghostnum { position:absolute; right:14px; top:-8px; font-size:66px; font-weight:900;
    letter-spacing:-.06em; color:var(--ink); opacity:var(--ghost-opacity);
    pointer-events:none; user-select:none; line-height:1;
    font-variant-numeric:tabular-nums; }

  .reveal { opacity:0; transform:translateY(10px);
    transition:opacity .5s cubic-bezier(.2,.7,.3,1), transform .5s cubic-bezier(.2,.7,.3,1); }
  .reveal.in { opacity:1; transform:none; }

  /* --- form controls -------------------------------------------------------------- */
  label { display:block; font-size:10.5px; font-weight:900; color:var(--ink-2);
          text-transform:uppercase; letter-spacing:.17em; margin-bottom:7px; }
  input[type=password], input[type=text], select {
    width:100%; background:var(--inset); border:1px solid var(--line-2); color:var(--ink);
    border-radius:0; padding:13px; font-size:16px; font-family:inherit;
    transition:border-color .16s ease, box-shadow .16s ease; }
  select {
    -webkit-appearance:none; appearance:none; cursor:pointer;
    font-weight:800; letter-spacing:.02em; padding-right:38px;
    background-image:linear-gradient(45deg, transparent 50%, currentColor 50%),
                     linear-gradient(135deg, currentColor 50%, transparent 50%);
    background-position:calc(100% - 19px) 55%, calc(100% - 13px) 55%;
    background-size:6px 6px, 6px 6px; background-repeat:no-repeat; }
  select:hover { border-color:var(--accent); }
  input::placeholder { color:var(--ink-3); }
  input:focus, select:focus { outline:none; border-color:var(--accent);
    box-shadow:0 0 0 1px var(--accent), 0 0 18px -6px var(--accent); }
  .field-row + .field-row { margin-top:17px; }
  .hint { font-size:12px; color:var(--ink-3); margin-top:7px; line-height:1.55; }

  .pwwrap { position:relative; }
  .pwwrap input { padding-right:46px; letter-spacing:.06em; }
  .pweye { position:absolute; right:2px; top:50%; transform:translateY(-50%);
    background:none; border:0; color:var(--ink-3); cursor:pointer; width:40px; height:40px;
    display:flex; align-items:center; justify-content:center; padding:0;
    transition:color .16s ease; }
  .pweye:hover { color:var(--accent); }
  .pweye svg { width:19px; height:19px; }

  /* --- buttons ---------------------------------------------------------------------- */
  button.primary { position:relative; width:100%; margin-top:18px; border:0; cursor:pointer;
    background:var(--accent); color:#04170A; border-radius:0; padding:14px;
    font-size:12.5px; font-weight:900; font-family:inherit; text-transform:uppercase;
    letter-spacing:.14em; overflow:hidden;
    clip-path:polygon(0 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%);
    transition:filter .16s ease, transform .12s ease; }
  button.primary::after { content:""; position:absolute; inset:0;
    background:linear-gradient(105deg, transparent 38%, rgba(255,255,255,.42) 50%, transparent 62%);
    transform:translateX(-140%); }
  button.primary:hover:not(:disabled) { filter:brightness(1.1); }
  button.primary:hover:not(:disabled)::after { animation:sheen .75s ease; }
  @keyframes sheen { to { transform:translateX(140%); } }
  button.primary:active:not(:disabled) { transform:translateY(1px); }
  button.primary:disabled { opacity:.5; cursor:default; }

  button.ghost { width:100%; background:none; border:1px solid var(--line-2);
    color:var(--ink-2); border-radius:0; padding:12px 14px; font-size:11.5px;
    font-weight:900; font-family:inherit; cursor:pointer; text-transform:uppercase;
    letter-spacing:.14em; transition:border-color .16s ease, color .16s ease; }
  button.ghost:hover { border-color:var(--accent); color:var(--accent); }

  button.minor { background:none; border:1px solid var(--flag); color:var(--flag);
    font-family:inherit; font-size:10.5px; font-weight:900; letter-spacing:.15em;
    text-transform:uppercase; cursor:pointer; padding:10px 26px; border-radius:0;
    transition:background .16s ease, color .16s ease; }
  button.minor:hover { background:var(--flag); color:var(--field); }

  :focus-visible { outline:2px solid var(--accent); outline-offset:2px; }

  /* --- listbox ---------------------------------------------------------------
     A native select renders its value in the platform's own plain type and
     ignores background-clip, so anywhere the selected value has to carry the
     site's treatment it is replaced by this. */
  .xsel { position:relative; }
  .xselbtn { width:100%; display:flex; align-items:center; gap:10px;
    background:var(--inset); border:1px solid var(--line-2); color:var(--ink);
    padding:11px 13px; font-family:inherit; font-size:14px; cursor:pointer;
    text-align:left; transition:border-color .16s ease, box-shadow .16s ease; }
  .xselbtn:hover { border-color:var(--accent); }
  .xsel.open .xselbtn { border-color:var(--accent);
    box-shadow:0 0 0 1px var(--accent), 0 0 18px -6px var(--accent); }
  .xselval { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis;
    white-space:nowrap; font-weight:900; letter-spacing:.06em; text-transform:uppercase;
    font-size:12.5px;
    background:linear-gradient(94deg,var(--ink) 10%,var(--accent) 150%);
    -webkit-background-clip:text; background-clip:text;
    color:transparent; -webkit-text-fill-color:transparent; }
  .xsel.empty .xselval { background:none; -webkit-text-fill-color:initial;
    color:var(--ink-3); font-weight:800; }
  .xselchev { flex:none; width:9px; height:9px; border-right:2px solid var(--accent);
    border-bottom:2px solid var(--accent); transform:rotate(45deg) translate(-2px,-2px);
    transition:transform .18s ease; }
  .xsel.open .xselchev { transform:rotate(225deg) translate(-2px,-2px); }
  .xsellist { position:absolute; left:0; right:0; top:calc(100% + 4px); z-index:30;
    background:var(--panel); border:1px solid var(--line-2); margin:0; padding:4px;
    list-style:none; max-height:290px; overflow-y:auto; display:none;
    box-shadow:0 20px 46px -24px rgba(0,0,0,.8); }
  .xsel.open .xsellist { display:block; animation:slidein .16s ease; }
  .xsellist li { padding:9px 11px; font-size:13px; font-weight:700; cursor:pointer;
    display:flex; align-items:center; gap:9px; border-left:2px solid transparent; }
  .xsellist li:hover { background:var(--inset); border-left-color:var(--line-2); }
  .xsellist li.on { border-left-color:var(--accent); color:var(--accent); }
  .xsellist li small { margin-left:auto; font-size:10.5px; font-weight:800;
    letter-spacing:.1em; text-transform:uppercase; color:var(--ink-3); }

  /* --- messages --------------------------------------------------------------------- */
  .msg { margin-top:15px; font-size:13px; padding:11px 13px; display:none;
         border-left:2px solid transparent; line-height:1.55; }
  .msg.err  { display:block; background:var(--flag-soft); color:var(--flag); border-left-color:var(--flag); }
  .msg.ok   { display:block; background:var(--accent-glow); color:var(--accent); border-left-color:var(--accent); }
  .msg.info { display:block; background:var(--signal-soft); color:var(--signal); border-left-color:var(--signal); }

  .note { margin-top:14px; margin-bottom:0; font-size:12px; color:var(--ink-3);
          line-height:1.6; }

  /* Empty states are designed, not apologetic: a marked-out area of field. */
  .placeholder { position:relative; overflow:hidden; padding:20px 16px; text-align:center;
    border:1px dashed var(--line-2); background:
      repeating-linear-gradient(135deg, transparent 0 9px, var(--accent-glow) 9px 10px); }
  .placeholder b { display:block; font-size:11.5px; font-weight:900; letter-spacing:.18em;
    text-transform:uppercase; color:var(--ink-2); }
  .placeholder span { display:block; font-size:12px; color:var(--ink-3); margin-top:5px; }
  .placeholder::after { content:""; position:absolute; top:0; bottom:0; width:34%;
    background:linear-gradient(90deg, transparent, var(--accent-glow), transparent);
    animation:sweepBox 5.2s linear infinite; }
  @keyframes sweepBox { from { transform:translateX(-120%); } to { transform:translateX(320%); } }

  /* --- help disclosure ----------------------------------------------------------------- */
  .helpbtn { background:none; border:0; color:var(--sky); font-size:11px; font-weight:900;
    font-family:inherit; cursor:pointer; padding:0; margin-top:9px; text-transform:uppercase;
    letter-spacing:.12em; display:inline-flex; align-items:center; gap:6px; }
  .helpbtn::before { content:"+"; font-size:14px; line-height:1; }
  .helpbtn.open::before { content:"\\2212"; }
  .helpbox { display:none; margin-top:11px; background:var(--inset);
    border-left:2px solid var(--line-2); padding:13px 14px; font-size:12.5px;
    color:var(--ink-2); line-height:1.65; }
  .helpbox.open { display:block; animation:slidein .22s ease; }
  @keyframes slidein { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:none; } }
  .helpbox ol { margin:9px 0 0; padding-left:17px; }
  .helpbox li { margin-bottom:6px; }
  .helpbox b { color:var(--ink); }
  .helpbox p { margin:9px 0 0; }

  .bar { height:3px; background:var(--inset); overflow:hidden; margin-top:14px;
         border:1px solid var(--line); }
  .bar > i { display:block; height:100%; background:var(--accent); width:0%;
             transition:width .35s cubic-bezier(.3,.8,.4,1); }

  /* --- ticker ------------------------------------------------------------------------ */
  .tickstrip { position:relative; overflow:hidden; margin:0 -2px;
    -webkit-mask-image:linear-gradient(90deg, transparent 0, #000 34px, #000 calc(100% - 34px), transparent 100%);
            mask-image:linear-gradient(90deg, transparent 0, #000 34px, #000 calc(100% - 34px), transparent 100%); }
  .tickrun { display:flex; width:max-content; will-change:transform;
             animation:marquee var(--dur,48s) linear infinite; }
  /* The strip runs continuously. Hovering does not pause it — a ticker that
     stops when a cursor crosses it reads as broken, not interactive. Painting
     is suspended only when the tab is hidden, which nobody can observe. */
  body.tabhidden .tickrun { animation-play-state:paused; }
  @keyframes marquee {
    from { transform:translate3d(0,0,0); }
    to   { transform:translate3d(var(--shift,-50%),0,0); }
  }

  /* --- footer -------------------------------------------------------------------------- */
  .sitefoot { margin-top:10px; padding:10px 0 4px; text-align:center;
              border-top:1px solid var(--line); }
  .sitefoot a { color:var(--ink-3); font-size:10px; text-decoration:none;
    text-transform:uppercase; letter-spacing:.16em; font-weight:900;
    display:inline-flex; align-items:center; gap:7px; transition:color .16s ease; }
  .sitefoot a:hover { color:var(--accent); }
  .sitefoot a::before { content:""; width:5px; height:5px; background:currentColor;
                        transform:rotate(45deg); }

  /* One page-level action, one position, on every surface. It sits directly
     under the content and above the footer rule, so it is where the eye
     already is when a page runs out — and any space left over falls below it
     rather than pushing it off the fold. */
  .pageaction { display:flex; justify-content:center; margin:22px 0 4px; }
  .pagebtn { background:none; border:1px solid var(--sky); color:var(--sky);
    font-family:inherit; font-size:10.5px; font-weight:900; letter-spacing:.15em;
    text-transform:uppercase; cursor:pointer; padding:10px 26px; border-radius:0;
    text-decoration:none; display:inline-flex; align-items:center; gap:9px;
    transition:background .16s ease, color .16s ease; }
  .pagebtn:hover { background:var(--sky); color:var(--field); }
  .pagebtn.danger { border-color:var(--flag); color:var(--flag); }
  .pagebtn.danger:hover { background:var(--flag); color:var(--field); }

  .homelink { display:block; text-decoration:none; color:inherit; }
  .homelink:hover .mark .m2 { fill:var(--accent); }
  .homelink .mark { transition:opacity .16s ease; }
  .homelink:hover .mark { opacity:.92; }

  .backlink { color:var(--sky); font-size:11px; font-weight:900; text-transform:uppercase;
    letter-spacing:.13em; text-decoration:none; display:inline-block; }
  .backlink:hover { color:var(--accent); }

  /* One switch silences every layer of motion at once. */
  html.stillness .drift, html.stillness .bloom, html.stillness .livebar,
  html.stillness .motes i, html.stillness .sweeplight,
  html.stillness .placeholder::after, html.stillness button.primary::after {
    animation:none !important;
  }
  /* Tickers keep running under reduce-motion: they carry information rather
     than decoration, and a frozen scoreboard reads as stale data. */
  html.stillness .grain, html.stillness .sweeplight { display:none; }
  html.stillness .motes { display:none; }
  html.stillness .reveal { opacity:1; transform:none; transition:none; }
  html.stillness .mark .rule, html.stillness .mark .rulelive,
  html.stillness .display .underline { animation:none; stroke-dashoffset:0; }

  @media (prefers-reduced-motion: reduce) {
    .drift, .bloom, .livebar > i, .motes i, .sweeplight,
    .placeholder::after, button.primary::after { animation:none !important; }
    .motes, .grain, .sweeplight { display:none; }
    .mark .rule, .mark .rulelive, .display .underline { animation:none; stroke-dashoffset:0; }
    .reveal { opacity:1; transform:none; transition:none; }
    *, *::before, *::after { transition-duration:.01ms !important; }
  }
`;

const SUN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.6v2.1M12 19.3v2.1M4.6 4.6l1.5 1.5M17.9 17.9l1.5 1.5M2.6 12h2.1M19.3 12h2.1M4.6 19.4l1.5-1.5M17.9 6.1l1.5-1.5"/></svg>`;
const MOON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.6A8.4 8.4 0 1 1 9.6 4.2a6.7 6.7 0 0 0 10.4 10.4z"/></svg>`;
const CLOSE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>`;
const HELP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.4"/><path d="M9.2 9.3a2.8 2.8 0 1 1 3.9 2.9c-.9.5-1.4 1-1.4 2.1"/><circle cx="12" cy="17.2" r=".55" fill="currentColor" stroke="none"/></svg>`;
const GEAR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.1"/><path d="M19.1 14.6a1.5 1.5 0 0 0 .3 1.7l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.5 1.5 0 0 0-1.7-.3 1.5 1.5 0 0 0-.9 1.4v.2a2 2 0 1 1-4 0v-.1a1.5 1.5 0 0 0-1-1.4 1.5 1.5 0 0 0-1.7.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.5 1.5 0 0 0 .3-1.7 1.5 1.5 0 0 0-1.4-.9H3a2 2 0 1 1 0-4h.1a1.5 1.5 0 0 0 1.4-1 1.5 1.5 0 0 0-.3-1.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.5 1.5 0 0 0 1.7.3H9a1.5 1.5 0 0 0 .9-1.4V3a2 2 0 1 1 4 0v.1a1.5 1.5 0 0 0 .9 1.4 1.5 1.5 0 0 0 1.7-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.5 1.5 0 0 0-.3 1.7V9a1.5 1.5 0 0 0 1.4.9h.2a2 2 0 1 1 0 4h-.1a1.5 1.5 0 0 0-1.4.9z"/></svg>`;
const EYE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M1.8 12S5.5 5.2 12 5.2 22.2 12 22.2 12 18.5 18.8 12 18.8 1.8 12 1.8 12z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_OFF = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9.9 5.4A9.7 9.7 0 0 1 12 5.2c6.5 0 10.2 6.8 10.2 6.8a18 18 0 0 1-3.3 4.3M6.3 6.3A18 18 0 0 0 1.8 12S5.5 18.8 12 18.8a9.6 9.6 0 0 0 4-.8"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M2 2l20 20"/></svg>`;

/**
 * Wordmark. viewBox height is tuned so the mark and the league name opposite it
 * resolve to the same cap height when both are laid out in the header band.
 */
function wordmark() {
  return `
  <svg class="mark" viewBox="0 0 1000 150" role="img" aria-label="ESPN Fantasy Tools">
    <text class="fit" x="500" y="74" text-anchor="middle" textLength="980"
          lengthAdjust="spacingAndGlyphs" font-size="86" font-weight="900" letter-spacing="-2"
          font-family="ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">
      <tspan class="m1">ESPN</tspan><tspan class="m2"> FANTASY TOOLS</tspan>
    </text>
    <path class="rule" d="M10 100 H990"/>
    <path class="rulelive" d="M10 100 H360"/>
    <text x="500" y="137" text-anchor="middle" font-size="30" font-weight="700"
          letter-spacing="14" fill="var(--ink-3)"
          font-family="ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">
      LEAGUE HQ
    </text>
  </svg>`;
}

let gradSeq = 0;

/**
 * Draw a display title: gradient fill, drawn underline, and a measured fit so
 * the type always occupies its box exactly.
 */
export function displayTitle(text, { underline = true, sub = '' } = {}) {
  const value = String(text || '').toUpperCase();
  const id = `dg${++gradSeq}`;
  const long = value.length > 20;
  const subLine = sub ? String(sub).toUpperCase() : '';
  // The rule sits between the name and the season line rather than through it.
  const ruleY = subLine ? 142 : 152;
  const subY = long ? 196 : 200;
  const h = subLine ? 224 : (underline ? 186 : 148);
  return `
  <svg class="display" viewBox="0 0 1000 ${h}" role="img"
       aria-label="${esc(text)}${subLine ? ' ' + esc(sub) : ''}" preserveAspectRatio="xMidYMid meet">
    <defs>
      <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0.5">
        <stop class="gstop-a" offset="0%"/>
        <stop class="gstop-b" offset="52%"/>
        <stop class="gstop-c" offset="100%"/>
      </linearGradient>
    </defs>
    <text class="fit" x="500" y="${long ? 106 : 112}" text-anchor="middle"
          fill="url(#${id})" font-size="${long ? 100 : 124}">${esc(value)}</text>
    ${underline ? `<path class="underline" d="M10 ${ruleY} H430"/>` : ''}
    ${subLine ? `<text class="subfit" x="500" y="${subY}" text-anchor="middle"
          fill="url(#${id})" font-size="52" opacity=".78">${esc(subLine)}</text>` : ''}
  </svg>`;
}

/**
 * A listbox that can carry the site's type treatment on its selected value.
 * Emits a bubbling `xselect` event carrying the chosen value.
 */
export function selectField({ id, value = '', placeholder = 'Select', options = [] }) {
  const current = options.find((o) => String(o.value) === String(value));
  return `
  <div class="xsel${current ? '' : ' empty'}" id="${id}" data-value="${esc(value)}">
    <button type="button" class="xselbtn" aria-haspopup="listbox" aria-expanded="false">
      <span class="xselval">${esc(current ? current.label : placeholder)}</span>
      <span class="xselchev" aria-hidden="true"></span>
    </button>
    <ul class="xsellist" role="listbox">
      ${options.map((o) => `<li role="option" data-v="${esc(o.value)}"
        class="${String(o.value) === String(value) ? 'on' : ''}">${esc(o.label)}
        ${o.note ? `<small>${esc(o.note)}</small>` : ''}</li>`).join('')}
    </ul>
  </div>`;
}

export function passwordField({ id, label: labelText, hint = '', autofocus = false, autocomplete = 'new-password' }) {
  return `
    <div class="field-row">
      <label for="${id}">${esc(labelText)}</label>
      <div class="pwwrap">
        <input id="${id}" type="password" autocomplete="${autocomplete}"
               data-nopaste="1" spellcheck="false" ${autofocus ? 'autofocus' : ''}>
        <button type="button" class="pweye" data-toggle="${id}"
                aria-label="Show or hide password" title="Show or hide password">${EYE}</button>
      </div>
      ${hint ? `<p class="hint">${hint}</p>` : ''}
    </div>`;
}

function settingsMenu() {
  return `
  <div class="settings" id="settings" role="dialog" aria-label="Site settings">
    <div class="setttl">Site settings</div>
    <div class="setrow">
      <span class="setlab">Reduce motion<small>Stills the background</small></span>
      <button class="sw" id="swMotion" role="switch" aria-checked="false"
              aria-label="Reduce motion"></button>
    </div>
    <div class="setrow">
      <span class="setlab">Light theme<small>Evil. Dark mode is superior</small></span>
      <button class="sw" id="swTheme" role="switch" aria-checked="false"
              aria-label="Light theme"></button>
    </div>
    <div class="setrow tzrow">
      <span class="setlab">Time zone<small id="tzNow">Detecting</small></span>
    </div>
    <div class="tzpick">
      <div class="xsel" id="tzSel" data-value="">
        <button type="button" class="xselbtn" aria-haspopup="listbox" aria-expanded="false">
          <span class="xselval">Detecting</span>
          <span class="xselchev" aria-hidden="true"></span>
        </button>
        <ul class="xsellist" role="listbox">
          <li class="tzfilterrow" aria-hidden="true">
            <input class="tzfilter" type="text" placeholder="Search zones"
                   autocomplete="off" spellcheck="false" aria-label="Search time zones">
          </li>
        </ul>
      </div>
      <button type="button" class="tzauto" id="tzAuto">Use my device zone</button>
    </div>
  </div>`;
}

/**
 * Per-page instructions, in the same shape the tools use.
 *
 * Every surface now carries the same pair of controls — help, then settings —
 * and the help content is the only part that differs between them. Sharing the
 * dialog rather than letting each page invent one is what stops "how this works"
 * meaning something different depending on where you opened it.
 */
function instructionsDialog(steps) {
  if (!Array.isArray(steps) || !steps.length) return '';
  return `
  <div class="instr" id="instr" hidden role="dialog" aria-modal="true"
       aria-label="How this page works">
    <div class="instrwrap">
      <div class="instrhead">
        <h2>How this works</h2>
        <button class="ctlbtn" id="instrClose" aria-label="Close">${CLOSE}</button>
      </div>
      ${steps.map(([n, t, b]) => `
      <div class="istep"><span class="inum">${esc(n)}</span>
        <span><b>${esc(t)}</b><p>${esc(b)}</p></span></div>`).join('')}
      <button class="primary" id="instrDone">Got it</button>
    </div>
  </div>`;
}

export const SHARED_JS = `
(function () {
  var SUN = ${JSON.stringify(SUN)}, MOON = ${JSON.stringify(MOON)};
  var root = document.documentElement;

  function setCookie(k, v) {
    document.cookie = k + '=' + v + '; path=/; max-age=31536000; samesite=lax';
  }
  function applyTheme(next) {
    root.dataset.theme = next;
    setCookie('${THEME_COOKIE}', next);
    var b = document.getElementById('themeBtn');
    if (b) b.innerHTML = next === 'light' ? MOON : SUN;
    var sw = document.getElementById('swTheme');
    if (sw) sw.setAttribute('aria-checked', String(next === 'light'));
    var meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.setAttribute('content', next === 'light' ? '#EBF1E9' : '#070A08');
  }
  function applyMotion(reduced) {
    root.classList.toggle('stillness', reduced);
    setCookie('${MOTION_COOKIE}', reduced ? 'reduce' : 'full');
    var sw = document.getElementById('swMotion');
    if (sw) sw.setAttribute('aria-checked', String(reduced));
    // Tickers are laid out in script, so they must be rebuilt for the new mode.
    if (typeof window.__relayout === 'function') window.__relayout();
  }

  /* --- time zone ---------------------------------------------------------
     Every timestamp on the site is rendered from an ISO instant in the browser
     rather than baked into a string upstream, so switching zones is a repaint
     rather than a reload. ESPN's own kickoff strings are Eastern regardless of
     who is reading them, which is why they are rebuilt here instead of shown.
     The default is whatever the device reports; an explicit choice overrides
     it and is remembered. */
  var DEVICE_TZ = '';
  try { DEVICE_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}

  function readCookie(k) {
    var m = document.cookie.match(new RegExp('(^|; )' + k + '=([^;]*)'));
    return m ? decodeURIComponent(m[2]) : '';
  }
  var tzChoice = readCookie('eft_tz');

  window.siteTz = function () { return tzChoice || DEVICE_TZ || 'UTC'; };
  window.siteTzIsAuto = function () { return !tzChoice; };

  function zoneList() {
    try {
      if (typeof Intl.supportedValuesOf === 'function') {
        var v = Intl.supportedValuesOf('timeZone');
        if (v && v.length) return v;
      }
    } catch (e) {}
    /* Older engines do not enumerate zones. A representative spread beats an
       empty menu, and the device zone is always added on top of it. */
    return ['UTC','America/New_York','America/Chicago','America/Denver',
      'America/Phoenix','America/Los_Angeles','America/Anchorage','Pacific/Honolulu',
      'America/Halifax','America/Sao_Paulo','Europe/London','Europe/Dublin',
      'Europe/Paris','Europe/Berlin','Europe/Madrid','Europe/Rome','Europe/Athens',
      'Europe/Moscow','Africa/Lagos','Africa/Johannesburg','Africa/Cairo',
      'Asia/Jerusalem','Asia/Dubai','Asia/Karachi','Asia/Kolkata','Asia/Dhaka',
      'Asia/Bangkok','Asia/Shanghai','Asia/Hong_Kong','Asia/Singapore','Asia/Tokyo',
      'Asia/Seoul','Australia/Perth','Australia/Adelaide','Australia/Sydney',
      'Pacific/Auckland'];
  }

  function tzOffsetLabel(zone) {
    try {
      var parts = new Intl.DateTimeFormat('en-US',
        { timeZone: zone, timeZoneName: 'shortOffset' }).formatToParts(new Date());
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].type === 'timeZoneName') return parts[i].value;
      }
    } catch (e) {}
    return '';
  }
  /* split/join rather than a regex: this whole block is emitted from inside a
     template literal, where a backslash escape is consumed before it ever
     reaches the browser. A slash character class written as a regex lost its
     escape, arrived as the start of a line comment, and took the rest of the
     file with it. */
  function tzLabel(zone) { return String(zone).split('_').join(' ').split('/').join(' / '); }

  /* Formatting helpers used by every surface. */
  function tzFmt(iso, opts) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var o = { timeZone: window.siteTz() };
    for (var k in opts) o[k] = opts[k];
    try { return new Intl.DateTimeFormat(undefined, o).format(d); } catch (e) { return ''; }
  }
  window.fmtDate = function (iso) {
    return tzFmt(iso, { month: 'short', day: 'numeric' });
  };
  window.fmtDateTime = function (iso) {
    var d = tzFmt(iso, { month: 'numeric', day: 'numeric' });
    var t = tzFmt(iso, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
    return d && t ? d + ' - ' + t : (d || t);
  };
  window.fmtClock = function (iso) {
    return tzFmt(iso, { hour: 'numeric', minute: '2-digit' });
  };

  function paintTzLabel() {
    var now = document.getElementById('tzNow');
    var val = document.querySelector('#tzSel .xselval');
    var zone = window.siteTz();
    var off = tzOffsetLabel(zone);
    var text = tzLabel(zone) + (off ? ' (' + off + ')' : '');
    if (now) now.textContent = window.siteTzIsAuto() ? 'Detected - ' + text : text;
    if (val) val.textContent = text;
  }

  function buildTzList() {
    var sel = document.getElementById('tzSel');
    if (!sel) return;
    var list = sel.querySelector('.xsellist');
    var filterRow = list.querySelector('.tzfilterrow');
    var zones = zoneList().slice();
    if (DEVICE_TZ && zones.indexOf(DEVICE_TZ) === -1) zones.unshift(DEVICE_TZ);
    var current = window.siteTz();
    var html = '';
    for (var i = 0; i < zones.length; i++) {
      var z = zones[i];
      var off = tzOffsetLabel(z);
      html += '<li role="option" data-v="' + z + '" data-search="' + z.toLowerCase() + '"' +
        (z === current ? ' class="on"' : '') + '>' + tzLabel(z) +
        (off ? '<small>' + off + '</small>' : '') + '</li>';
    }
    list.innerHTML = '';
    list.appendChild(filterRow);
    list.insertAdjacentHTML('beforeend', html);

    var input = list.querySelector('.tzfilter');
    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase();
      list.querySelectorAll('li[data-v]').forEach(function (li) {
        li.hidden = q ? li.dataset.search.indexOf(q) === -1 : false;
      });
    });
    /* The filter lives inside the listbox, so its clicks must not be read as
       a selection or as a click outside that closes the menu. */
    filterRow.addEventListener('click', function (e) { e.stopPropagation(); });
  }

  function applyTz(zone, isAuto) {
    tzChoice = isAuto ? '' : zone;
    setCookie('eft_tz', isAuto ? '' : zone);
    paintTzLabel();
    var sel = document.getElementById('tzSel');
    if (sel) {
      sel.dataset.value = window.siteTz();
      sel.querySelectorAll('li[data-v]').forEach(function (li) {
        li.classList.toggle('on', li.dataset.v === window.siteTz());
      });
    }
    window.dispatchEvent(new CustomEvent('tzchange', { detail: { zone: window.siteTz() } }));
  }
  window.__applyTz = applyTz;

  var help = document.getElementById('helpBtn'), instr = document.getElementById('instr');
  function showInstr(open) {
    if (!instr) return;
    instr.hidden = !open;
    document.body.style.overflow = open ? 'hidden' : '';
  }
  if (help) help.addEventListener('click', function () { showInstr(true); });
  var instrClose = document.getElementById('instrClose');
  var instrDone = document.getElementById('instrDone');
  if (instrClose) instrClose.addEventListener('click', function () { showInstr(false); });
  if (instrDone) instrDone.addEventListener('click', function () { showInstr(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && instr && !instr.hidden) showInstr(false);
  });
  /* A page with nothing worth explaining should not offer to explain it. */
  if (help && !instr) help.hidden = true;

  var gear = document.getElementById('gearBtn'), menu = document.getElementById('settings');
  if (gear && menu) {
    gear.addEventListener('click', function (e) {
      e.stopPropagation(); menu.classList.toggle('open');
    });
    document.addEventListener('click', function (e) {
      if (!menu.contains(e.target) && e.target !== gear) menu.classList.remove('open');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') menu.classList.remove('open');
    });
    var swM = document.getElementById('swMotion');
    swM.setAttribute('aria-checked', String(root.classList.contains('stillness')));
    swM.addEventListener('click', function () {
      applyMotion(swM.getAttribute('aria-checked') !== 'true');
    });
    var swT = document.getElementById('swTheme');
    swT.setAttribute('aria-checked', String(root.dataset.theme === 'light'));
    swT.addEventListener('click', function () {
      applyTheme(swT.getAttribute('aria-checked') === 'true' ? 'dark' : 'light');
    });

    buildTzList();
    paintTzLabel();
    document.getElementById('tzSel').addEventListener('xselect', function (e) {
      if (e.detail && e.detail.value) applyTz(e.detail.value, false);
    });
    document.getElementById('tzAuto').addEventListener('click', function () {
      applyTz(DEVICE_TZ, true);
    });
  }

  // Guarantee display type fits its box. textLength is honoured by Chrome and
  // Firefox but not reliably by iOS Safari, where a long league name rendered
  // at natural width and was clipped on both sides. Measure, then correct.
  function fitText() {
    document.querySelectorAll('svg .subfit').forEach(function (t) {
      t.removeAttribute('transform');
      var w; try { w = t.getComputedTextLength(); } catch (e) { return; }
      if (!w || w <= 900) return;
      var sx = 900 / w;
      t.setAttribute('transform', 'translate(500 0) scale(' + sx.toFixed(4) + ' 1) translate(-500 0)');
    });
    document.querySelectorAll('svg .fit').forEach(function (t) {
      t.removeAttribute('transform');
      var target = 980, w;
      try { w = t.getComputedTextLength(); } catch (e) { return; }
      // Shrink to fit, never stretch: a short title should sit at its natural
      // width rather than being pulled across the full box.
      if (!w || w <= target + 4) return;
      var sx = target / w;
      if (sx < 0.6) {
        var fs = parseFloat(t.getAttribute('font-size')) || 100;
        t.setAttribute('font-size', String(fs * sx / 0.6));
        try { w = t.getComputedTextLength(); } catch (e) {}
        sx = w ? target / w : 1;
      }
      t.setAttribute('transform', 'translate(500 0) scale(' + sx.toFixed(4) + ' 1) translate(-500 0)');
    });
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitText);
  fitText();
  window.addEventListener('resize', fitText, { passive: true });

  var EYE = ${JSON.stringify(EYE)}, EYE_OFF = ${JSON.stringify(EYE_OFF)};
  document.querySelectorAll('.pweye').forEach(function (b) {
    b.addEventListener('click', function () {
      var input = document.getElementById(b.dataset.toggle);
      if (!input) return;
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      b.innerHTML = show ? EYE_OFF : EYE;
      input.focus();
    });
  });

  document.querySelectorAll('[data-nopaste]').forEach(function (el) {
    ['paste', 'drop'].forEach(function (evt) {
      el.addEventListener(evt, function (e) { e.preventDefault(); });
    });
  });

  document.querySelectorAll('[data-help]').forEach(function (b) {
    b.addEventListener('click', function () {
      var box = document.getElementById(b.dataset.help);
      if (box) { box.classList.toggle('open'); b.classList.toggle('open'); }
    });
  });

  var reveals = document.querySelectorAll('.reveal');
  if (reveals.length) {
    if (!('IntersectionObserver' in window)) {
      reveals.forEach(function (el) { el.classList.add('in'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e, i) {
          if (!e.isIntersecting) return;
          var el = e.target;
          setTimeout(function () { el.classList.add('in'); }, Math.min(i * 55, 220));
          io.unobserve(el);
        });
      }, { rootMargin: '0px 0px -40px 0px' });
      reveals.forEach(function (el) { io.observe(el); });
      // Safety net: never leave content invisible because an observer did not
      // fire — on a slow device that reads as a broken page, not an animation.
      setTimeout(function () {
        reveals.forEach(function (el) { el.classList.add('in'); });
      }, 900);
    }
  }

  document.addEventListener('visibilitychange', function () {
    document.body.classList.toggle('tabhidden', document.hidden);
  });

  // Listbox behaviour, delegated so dynamically rendered ones work too.
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.xselbtn');
    var opt = e.target.closest('.xsellist li');

    document.querySelectorAll('.xsel.open').forEach(function (x) {
      if (btn && x.contains(btn)) return;
      x.classList.remove('open');
      var b = x.querySelector('.xselbtn');
      if (b) b.setAttribute('aria-expanded', 'false');
    });

    if (btn) {
      var host = btn.closest('.xsel');
      var open = host.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
      return;
    }

    if (opt) {
      var sel = opt.closest('.xsel');
      var v = opt.dataset.v;
      sel.dataset.value = v;
      sel.classList.toggle('empty', !v);
      sel.querySelector('.xselval').textContent =
        opt.childNodes[0].textContent.trim() || opt.textContent.trim();
      sel.querySelectorAll('li').forEach(function (li) {
        li.classList.toggle('on', li === opt);
      });
      sel.classList.remove('open');
      sel.querySelector('.xselbtn').setAttribute('aria-expanded', 'false');
      sel.dispatchEvent(new CustomEvent('xselect', { bubbles: true, detail: { value: v } }));
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.xsel.open').forEach(function (x) {
      x.classList.remove('open');
      x.querySelector('.xselbtn').setAttribute('aria-expanded', 'false');
    });
  });
})();
`;

/**
 * @param rail      identity column: wordmark plus page context
 * @param band      lay the rail out as a full-width header band
 * @param centred   optically centre the two columns (sign-in style pages)
 * @param settings  show the settings menu; authenticated surfaces only
 */
/**
 * The historical pull, driven from the browser.
 *
 * The pull is thousands of ESPN calls and cannot be one request, so the browser
 * walks it a batch at a time. That makes the browser responsible for keeping it
 * going, and the previous runner abandoned the whole job the moment a single
 * batch came back unhappy — one transient platform hiccup a thousand steps in
 * meant reopening a page and clicking Resume.
 *
 * So: transient failures are retried with widening backoff, batches are paced
 * so the pull never runs flat out, and the only outcomes are finished or
 * genuinely broken. Once dispatched it runs to the end on its own.
 *
 * Fatal statuses are not retried. A 401, 403 or 404 means the session, the
 * password or the route is wrong, and hammering it changes nothing.
 */
export const HISTORY_RUNNER_JS = `
var HIST_PACE_MS = 200;
var HIST_MAX_RETRIES = 12;
var HIST_FATAL = [400, 401, 403, 404, 409];

function histSleep(ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
}

/* opts: { call, onProgress, onNote, restart } */
/* Hold the screen awake for the length of a pull.
   A phone that locks its screen suspends timers and fetches, so a pull that was
   running perfectly well came back looking like a string of network failures
   and burned its retry budget. Best effort: the API is absent on some browsers
   and the lock is refused in some states, and neither is worth reporting. */
async function histWakeLock() {
  try {
    if (!navigator.wakeLock || !navigator.wakeLock.request) return null;
    var lock = await navigator.wakeLock.request('screen');
    /* Re-taken on return to the foreground: the system drops the lock whenever
       the page is hidden, and never reissues it by itself. */
    document.addEventListener('visibilitychange', async function () {
      if (document.visibilityState === 'visible' && lock && lock.released) {
        try { lock = await navigator.wakeLock.request('screen'); } catch (e) {}
      }
    });
    return lock;
  } catch (e) { return null; }
}

/* Wait until the tab is actually in front before doing more work.
   Background tabs are throttled hard on mobile, so a batch fired while hidden
   fails on a timer rather than on anything real. Waiting is not a delay, it is
   the difference between resuming cleanly and recording a false failure. */
function histVisible() {
  if (typeof document === 'undefined' || document.visibilityState === 'visible') {
    return Promise.resolve();
  }
  return new Promise(function (resolve) {
    document.addEventListener('visibilitychange', function once() {
      if (document.visibilityState !== 'visible') return;
      document.removeEventListener('visibilitychange', once);
      resolve();
    });
  });
}

async function runHistoryPull(opts) {
  var sentRestart = false;
  var retries = 0;
  var stalled = 0;
  var lastDone = '';

  var wake = await histWakeLock();
  /* Nothing about this pull should be lost to a stray back gesture. */
  var guardUnload = function (e) { e.preventDefault(); e.returnValue = ''; return ''; };
  window.addEventListener('beforeunload', guardUnload);

  try {
  for (var guard = 0; guard < 6000; guard++) {
    await histVisible();
    var r = await opts.call({ restart: Boolean(opts.restart) && !sentRestart });

    if (r && r.ok) {
      sentRestart = true;
      retries = 0;
      opts.onProgress(r);

      if (r.complete) return { ok: true, status: r };

      /* A run of batches that moves nothing is a loop, not slow progress.
         The completed count deliberately does not move while items are being
         retried — something on its second attempt has not been dealt with yet —
         so the signal has to include the retry state, or a long retry sweep
         would look exactly like a hang and be abandoned just as it was about
         to recover. */
      var mark = String(r.done) + ':' + String(r.retrying || 0) + ':' + String(r.retryRound || 0);
      if (mark === lastDone) { stalled++; } else { stalled = 0; lastDone = mark; }
      if (stalled >= 8) {
        return { ok: false, error: 'The pull stopped making progress. Try resuming it again.' };
      }

      await histSleep(HIST_PACE_MS);
      continue;
    }

    var status = (r && r.status) || 0;
    if (HIST_FATAL.indexOf(status) !== -1) {
      return { ok: false, error: (r && r.error) || 'The pull could not continue.' };
    }
    if (retries >= HIST_MAX_RETRIES) {
      return { ok: false, error: (r && r.error) || 'The pull stopped after repeated failures.' };
    }

    /* A failure recorded while the tab was in the background is the browser
       throttling us, not the server refusing. It costs nothing to check again
       in the foreground before spending an attempt on it. */
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      await histVisible();
      continue;
    }

    retries++;
    var wait = Math.min(30000, 1000 * Math.pow(2, retries - 1));
    /* Say what went wrong, not only that something did. A counter climbing
       against a meter that never moves is indistinguishable from a hang unless
       the cause is on screen. */
    var why = (r && r.error) ? (' - ' + r.error) : '';
    opts.onNote('Paused, retrying in ' + Math.round(wait / 1000) + 's (attempt ' +
      retries + ' of ' + HIST_MAX_RETRIES + ')' + why);
    await histSleep(wait);
  }
  return { ok: false, error: 'The pull ran longer than expected. Resume it to carry on.' };
  } finally {
    window.removeEventListener('beforeunload', guardUnload);
    try { if (wake && wake.release) wake.release(); } catch (e) {}
  }
}
`;

/**
 * @param home    true on the dashboard itself. Everywhere else the wordmark
 *                becomes a link back to it — on a tool page the site identity
 *                is the most obvious thing to click to get out.
 * @param action  the one page-level button, sitting between the content and
 *                the footer rule. Every surface has exactly one: the dashboard
 *                signs you out, every other page returns you to it. Keeping it
 *                in the shell rather than in each page is what stops the next
 *                tool inventing its own position for it.
 */
export function shell({
  title, theme, body, rail = '', band = false, centred = false, stack = false,
  settings = false, reduceMotion = false, extraCss = '', extraJs = '',
  home = false, action = '', instructions = null,
}) {
  const light = theme === 'light';
  const cls = [light ? 'light' : 'dark'];
  return `<!doctype html><html lang="en" data-theme="${light ? 'light' : 'dark'}"${reduceMotion ? ' class="stillness"' : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="${light ? '#EBF1E9' : '#070A08'}">
<title>${esc(title)}</title>
<style>
  ${PALETTES}
  ${BASE_CSS}
  ${extraCss}
</style>
</head>
<body>
${BACKDROP}
<div class="wrap">
  <div class="controls">
    <button class="ctlbtn" id="helpBtn" title="How this page works"
            aria-label="How this page works" aria-haspopup="dialog">${HELP}</button>
    <button class="ctlbtn" id="gearBtn" title="Site settings"
            aria-label="Site settings" aria-haspopup="dialog">${GEAR}</button>
    ${settingsMenu()}${instructionsDialog(instructions)}
  </div>
  <div class="pagegrid${band ? ' band' : ''}${centred ? ' centred' : ''}${stack ? ' stack' : ''}">
    <div class="rail">
      <div class="titlebar"><div class="railmark">${
        home ? wordmark() : `<a class="homelink" href="/" aria-label="Back to home">${wordmark()}</a>`
      }</div></div>
      <div class="railtext">${rail}</div>
    </div>
    <main class="main">${body}</main>
  </div>
  ${action ? `<div class="pageaction">${action}</div>` : ''}
  <div class="grow"></div>
  <footer class="sitefoot">
    <a href="${GITHUB_URL}" target="_blank" rel="noopener noreferrer">${esc(GITHUB_LABEL)}</a>
  </footer>
</div>
<script>${SHARED_JS}${extraJs}</script>
</body></html>`;
}

/** The standard return-to-dashboard action. */
export function backAction() {
  return '<a class="pagebtn" href="/">&larr; Back to home</a>';
}

export function esc(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
