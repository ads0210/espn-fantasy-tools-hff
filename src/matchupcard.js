/**
 * The home page's matchup card: its stylesheet, shared by the home page (src/pages/dashboard-css.js) and Matchup
 * Insights, which draws every game as this card (plan D54). The markup contract is the dashboard's: .vsrow with
 * .vsme / .vsmid / .vsopp, .cardlogo, .vsid (.vsname, .vsowner, .cardstats), .vsgrid (.vslabel, .vsscore, .vsmargin,
 * .wgauge) and .countdown. Moved here unchanged, byte for byte.
 */
export const MATCHUP_CARD_CSS = `    .cardlogo { width:38px; height:38px; object-fit:contain; flex:none; }
    .cardstats { display:flex; gap:18px; margin-top:9px; }
    .stat b { display:block; font-size:19px; font-weight:900; font-variant-numeric:tabular-nums;
              color:var(--accent); letter-spacing:-.02em; }
    .stat span { display:block; font-size:9.5px; font-weight:900; letter-spacing:.15em;
                 text-transform:uppercase; color:var(--ink-3); margin-top:1px; }
    .vsrow { display:flex; align-items:center; gap:14px; min-height:104px; }
    .vsme, .vsopp { display:flex; align-items:center; gap:11px; min-width:0; flex:1; }
    .vsopp { justify-content:flex-end; text-align:right; }
    /* The opponent's line mirrors the reader's own, hard against the far edge,
       so the two seasons read as a pair rather than as a list. */
    .vsopp .cardstats { justify-content:flex-end; }
    .vsid { min-width:0; }
    /* Wraps rather than truncating: the full team name is the point, and a
       clipped one is no more readable than a wrapped one is untidy. */
    .vsname { display:block; font-size:13px; font-weight:900; letter-spacing:.1em;
      text-transform:uppercase; overflow-wrap:anywhere; hyphens:auto;
      background:linear-gradient(94deg,var(--ink) 10%,var(--accent) 155%);
      -webkit-background-clip:text; background-clip:text;
      color:transparent; -webkit-text-fill-color:transparent; }
    .vsowner { display:block; font-size:10.5px; font-weight:800; letter-spacing:.14em;
      text-transform:uppercase; color:var(--ink-3); margin-top:3px; }
    .vsopp .vsid { text-align:right; }
    /* Below this the three-across arrangement stops working: a 38px crest and a
       fixed centre column either side of two names leaves each name about two
       characters of room, and both teams render as an ellipsis. Stacking keeps
       the DOM order — you, the state of the game, then them — which is how a
       fixture reads anyway, and gives each name the full width. */
    @media (max-width:620px) {
      .vsrow { flex-direction:column; align-items:stretch; gap:12px; min-height:0; }
      /* Centred on the card, not on what is left over beside the crest.
         With the logo in the flow it took its width out of the centring, so a
         team's name and figures sat measurably left of the countdown directly
         beneath them. The crest is pinned to the edge and the text centres on
         the full width, which is the same axis the scores use. */
      .vsme, .vsopp { position:relative; justify-content:center; text-align:center;
                      width:100%; min-height:44px; }
      .vsme .cardlogo, .vsopp .cardlogo { position:absolute; left:0; top:50%;
                      margin:0; transform:translateY(-50%); }
      .vsme .vsid, .vsopp .vsid { text-align:center; width:100%; min-width:0;
                      padding:0 44px; }
      .vsme .cardstats, .vsopp .cardstats { justify-content:center; }
      /* Scoped through .vsrow deliberately: the base .vsmid rule is declared
         after this block, and at equal specificity source order would win. */
      .vsrow .vsmid { min-width:0; width:100%; text-align:center; padding:10px 0;
               border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
      .cardstats { gap:14px; }
      .stat b { font-size:16px; }
    }
    .vsmid { flex:none; text-align:center; min-width:150px; }
    .cdnote { margin-top:5px; font-size:10px; font-weight:700; color:var(--ink-3);
              letter-spacing:.04em; }
    .vslabel { font-size:9.5px; font-weight:900; letter-spacing:.15em; text-transform:uppercase;
               color:var(--ink-3); margin-top:2px; }
    /* The dial sits between the two scores, each on the side its team is on and
       in that team's colour, with the state of the game above it. Stacking both
       scores on one side and putting the dial next to them read as two separate
       readouts of the same fixture. */
    .vsgrid { display:grid; grid-template-columns:1fr auto 1fr;
              align-items:center; justify-items:center; column-gap:clamp(8px,2vw,20px); }
    .vsgrid .vslabel { grid-area:1 / 2; margin:0 0 5px; white-space:nowrap; }
    .vsscore { grid-row:2; display:flex; flex-direction:column; align-items:center;
               gap:2px; min-width:0; }
    .vsscore.mine { grid-column:1; }
    .vsscore.theirs { grid-column:3; }
    .vsgrid .wgauge { grid-area:2 / 2; }
    .vsscore b { font-size:clamp(19px,2.6vw,25px); font-weight:900;
                 font-variant-numeric:tabular-nums; letter-spacing:-.02em;
                 line-height:1.1; }
    .smine { color:var(--accent); }
    .stheirs { color:var(--sky); }
    /* The projection trails its own score: what has happened, then where it is
       heading, in that order and never the same weight. */
    .sproj { font-size:10.5px; font-weight:800; font-variant-numeric:tabular-nums;
             color:var(--ink-2); }

    /* A decided matchup. Gold is the site's settled-result colour, and the
       margin is the thing a reader wants that neither score gives on its own. */
    .vslabel.isfinal { color:var(--gold); }
    .vsscore.won b { color:var(--gold); text-shadow:0 0 18px var(--gold-glow); }
    .vsmargin { grid-area:2 / 2; font-size:11px; font-weight:900; letter-spacing:.1em;
                text-transform:uppercase; white-space:nowrap; padding:6px 11px;
                border:1px solid var(--gold); color:var(--gold);
                box-shadow:0 0 16px -2px var(--gold-glow); }
    .vsmargin.lost { border-color:var(--line-2); color:var(--ink-3); box-shadow:none; }
    .vsmargin.tied { border-color:var(--line-2); color:var(--ink-2); box-shadow:none; }
    @media (max-width:560px) {
      .vsgrid { column-gap:8px; }
      .vsmargin { font-size:9.5px; padding:5px 8px; letter-spacing:.06em; }
    }

    .wgauge { position:relative; flex:none; width:52px; height:52px; }
    .wgauge svg { width:100%; height:100%; transform:rotate(0deg); }
    .wgauge circle { fill:none; stroke-width:9; }
    .wgtrack { stroke:var(--line-2); }
    .wgmine { stroke:var(--accent); }
    .wgtheirs { stroke:var(--sky); }
    .wgmid { position:absolute; inset:0; display:flex; align-items:center;
             justify-content:center; font-size:12px; font-weight:900;
             font-variant-numeric:tabular-nums; letter-spacing:-.02em; }
    .wgmid i { font-style:normal; font-size:8px; margin-left:1px; }
    .countdown { font-size:19px; font-weight:900; font-variant-numeric:tabular-nums;
                 letter-spacing:.02em; color:var(--ink); }
    .countdown em { font-style:normal; color:var(--ink-3); font-size:12px; margin:0 1px 0 1px; }`;

/**
 * Matchup Insights' eleven category colours (D17, D30), shared by the tool and the home card's banner: a banner from a
 * Matchup Insights row takes its category's colour (tone 'cat-<category>'); the postseason labels keep their medal
 * tones (D36). Each is measured to 4.5:1 for text on the panel and on its tint in both themes.
 */
export const INSIGHT_TONES_CSS = `html[data-theme="dark"] {
  --c-stakes:var(--violet); --c-race:var(--sky); --c-rivalry:#FF86B0; --c-form:var(--accent); --c-players:#3FE0C5;
  --c-avail:var(--flag); --c-records:var(--gold); --c-proj:#5ED8FF; --c-live:var(--signal); --c-moves:#A9B6C8; --c-after:#D9B866;
  --c-chipink:#07110A; --mi-tint:10%;
}
html[data-theme="light"] {
  --c-stakes:var(--violet); --c-race:var(--sky); --c-rivalry:#B0245B; --c-form:var(--accent); --c-players:#0B6E62;
  --c-avail:var(--flag); --c-records:var(--gold); --c-proj:#0A6587; --c-live:var(--signal); --c-moves:#4A5668; --c-after:#7A6420;
  --c-chipink:#FFFFFF; --mi-tint:8%;
}
.cat-stakes { --c:var(--c-stakes); } .cat-race { --c:var(--c-race); } .cat-rivalry { --c:var(--c-rivalry); } .cat-form { --c:var(--c-form); }
.cat-players { --c:var(--c-players); } .cat-avail { --c:var(--c-avail); } .cat-records { --c:var(--c-records); } .cat-proj { --c:var(--c-proj); }
.cat-live { --c:var(--c-live); } .cat-moves { --c:var(--c-moves); } .cat-after { --c:var(--c-after); }
`;

/* The home card's tones for a Matchup Insights banner: the ribbon, its label and glyph in the category's colour. */
export const CARD_TONE_CSS = ['stakes', 'race', 'rivalry', 'form', 'players', 'avail', 'records', 'proj', 'live', 'moves', 'after']
  .map((c) => `    #cardPanel[data-tone="cat-${c}"] { --b:var(--c-${c}); --bt:var(--c-${c}); }`).join('\n');
