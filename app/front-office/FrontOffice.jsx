import React, { useState, useEffect, useRef, useCallback } from "react";
import { PALETTES, BASE_CSS, BACKDROP, pts2, ptsSigned, dateText, dateTimeText } from "../../src/ui.js";
import ToolControls from "../shared/ToolControls.jsx";
import TeamLogo from "../shared/TeamLogo.jsx";
import ScrollBox from "../shared/ScrollBox.jsx";
import { noteBrake, pollDelay } from "../shared/brake.js";
import { SecHead, Placeholder, UI_FONT, HOF_CSS } from "../hall-of-fame/HallOfFame.jsx";
import { FO_CSS } from "./css.js";

/**
 * Front Office: one team's weekly roster desk (plan D1-D34), for the team chosen on the home page (D9): This week (who
 * to start, the checklist before lock), Pickups (free agents ranked by how they fit the roster) and Weeks ahead (the
 * road, who starts each week, stash candidates). Advice only: nothing is changed in ESPN.
 *
 * Every page is built on the backend (src/frontofficestep.js runs src/frontoffice.js over stored copies) and asked
 * for from /apps/front-office/api; each player's lock and live points are laid over at the time of asking. The page
 * asks again once a minute while one of the team's players is playing or a lock is within the hour, otherwise every
 * fifteen minutes, and rests in a hidden tab.
 */

const THEME_COOKIE = "eft_theme";
const TEAM_COOKIE = "eft_team";
const readCookie = (name) => {
  try { const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`)); return m ? decodeURIComponent(m[1]) : null; } catch { return null; }
};
const IDLE_LIMIT_MS = 4 * 60 * 60 * 1000;
/* Set from each answer before the page renders: the league's teams (names, logos) and the players a page names by id. */
let T = {};
let PL = {};
const SL = { 0: "QB", 2: "RB", 4: "WR", 6: "TE", 23: "FLEX", 16: "D/ST", 17: "K", 20: "Bench", 21: "IR" };
const DAY = { MONDAY: "Monday", TUESDAY: "Tuesday", WEDNESDAY: "Wednesday", THURSDAY: "Thursday", FRIDAY: "Friday", SATURDAY: "Saturday", SUNDAY: "Sunday" };
const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
function waiverText(w) {
  if (!w) return "";
  const parts = [];
  if (w.days && w.days.length) {
    const missing = DAYS.filter((d) => !w.days.includes(d));
    parts.push(missing.length === 0 ? "Claims process every day" : missing.length <= 2 ? `Claims process every day but ${missing.map((d) => DAY[d]).join(" and ")}` : `Claims process on ${DAYS.filter((d) => w.days.includes(d)).map((d) => DAY[d]).join(", ")}`);
  }
  if (w.hours) parts.push(`a dropped player is on waivers for ${w.hours} hours`);
  return parts.join(" · ");
}

const HELP_STEPS = [
  [1, "Your team", "Front Office shows the team chosen on the home page. To see another team, choose it there."],
  [2, "The three totals", "At the top: what your lineup is projected to score, the best lineup you could set (players already locked stay where they are), and your opponent's projection."],
  [3, "Before lock", "The checklist at the top of This week lists what needs doing before kickoff: Act now means a starter out or on a bye, or an empty slot; Look is worth a look; Note is context. When nothing comes up it says your lineup is clean."],
  [4, "Your lineup", "Every player has a card: his slot down the side, ESPN's projection on the right, his game and how that defence ranks against his position. The glow around a card is the colour of its position (for a starter, the slot he fills); the stripe down the side says starting, bench or IR. When a bench player projects at least 2.00 more, or a note makes him worth a look, the card ends with Start him instead."],
  [5, "Open a card", "The chevron at the foot of a card opens the detail: his season in numbers, this week's game with the line, over/under and weather, the next three weeks, everyone who could fill the same place, and his notes in full."],
  [6, "The bars", "The bars on every card are his season so far: green where he beat ESPN's projection, red where he fell short, the line across each bar what ESPN projected, and this week drawn hollow until he plays. Every player at a position is drawn on the same scale."],
  [7, "Notes", "Small tags under a player point out what the projection may not show: running hot or cold, his quarterback out, a weakened defence, a shootout. Open the card to read each one in full."],
  [8, "Once games start", "Each player locks at his own kickoff. Locked players show their points as the game goes; a bar names the slots still open and when the next lock comes."],
  [9, "Pickups", "Free agents ranked by how much they would add to your best lineup, in points per week, with the player you would drop and the main reason. After them come bench upgrades, tagged as such: players who would not start but project better than a bench player at their position, who is the suggested drop. Open a card for where the fit comes from (the next three weeks, the rest of the regular season, the postseason, and any adjustment, or the bench depth), his next three games, and both players' rest of season side by side."],
  [10, "Waivers", "Your place in the waiver order and whether a player is free now or on waivers, with when your league's claims process."],
  [11, "Weeks ahead", "Once Fortune Teller is running late in the season, The race shows your playoff odds now, with a win or a loss this week and if you win out, your biggest game left and which other games to root for. The road shows every week left: your best lineup against your opponent's, ahead or behind. Below it, Best lineup lists who would start each week and Every player shows your whole roster. Green is a soft matchup, red a tough one, grey a bye, striped an injury; a red cell is a slot you cannot fill."],
  [12, "The postseason", "The postseason weeks show your postseason games once the bracket is set, or your consolation games. Before then they read Postseason, if you qualify."],
  [13, "Nothing changes in ESPN", "Front Office only advises. Set your lineup and make claims in the ESPN app."],
];

const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th"}`;
const INJ = { QUESTIONABLE: ["Q", "q"], DOUBTFUL: ["D", "d"], OUT: ["Out", "o"], INJURY_RESERVE: ["IR", "o"], SUSPENSION: ["SSPD", "o"] };


const Logo = ({ id, cls = "tklogo" }) => (T[id] ? <TeamLogo src={T[id].logo} className={cls} alt="" /> : null);
function Inj({ s }) { const x = INJ[s]; return x ? <span className={`foinj ${x[1]}`}>{x[0]}</span> : null; }

/* ------------------------------------------------------------------ the header */
function Header({ team, tw }) {
  const opp = tw && tw.oppId;
  return (
    <div className="panel fohead">
      <TeamLogo src={team.logo} className="fologo" alt="" />
      <div className="foteam">
        <span className="n">{team.name}</span>
        <span className="m">Record <b>{team.record}</b>{team.seed ? <> · Seed <b>{team.seed}</b></> : null}{team.waiverRank ? <> · Waivers <b>{ordinal(team.waiverRank)}</b> of {Object.keys(T).length}</> : null}</span>
      </div>
      {tw && (
        <div className="fototals" aria-label="This week's totals">
          <div className="fototal"><span className="k">Your lineup</span><span className="v"><span className="g">{pts2(tw.totals.lineup)}</span></span><span className="o">Week {tw.week}</span></div>
          <div className="fototal best"><span className="k">Best possible</span><span className="v"><span className="g">{pts2(tw.totals.best)}</span></span><span className="o">{tw.totals.best - tw.totals.lineup >= 0.005 ? ptsSigned(tw.totals.best - tw.totals.lineup) : "You're set"}</span></div>
          <div className="fototal"><span className="k">Opponent</span><span className="v"><span className="g">{tw.totals.opp != null ? pts2(tw.totals.opp) : "—"}</span></span><span className="o">{opp && T[opp] ? <><Logo id={opp} />{T[opp].name}</> : "No game"}</span></div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ shared pieces of a player card (round 2) */
// The tape: every week of his season as a bar of what he scored, a tick at what ESPN projected, this week drawn hollow
// (or filling in while he plays). One scale per position so two cards side by side compare honestly.
const SCALE = { QB: 36, RB: 32, WR: 32, TE: 24, K: 18, "D/ST": 20 };
function Tape({ tape, pos, compact = false, big = false, ahead = [], caption = !compact }) {
  if (!tape || !tape.length) return null;
  const cap = Math.max(SCALE[pos] || 30, ...tape.map((t) => Math.max(t.a || 0, t.p || 0)), ...ahead.map((t) => t.p || 0));
  const bw = big ? 20 : compact ? 9 : 13, gap = big ? 6 : compact ? 3 : 4, H = big ? 64 : compact ? 30 : 44, base = H - 1;
  const W = (tape.length + ahead.length) * (bw + gap) - gap + (ahead.length ? 6 : 0);
  const y = (v) => base - Math.max(0, v) / cap * (H - 4);
  const played = tape.filter((t, i) => i < tape.length - 1 && t.a != null && t.p > 0);
  const beat = played.filter((t) => t.a >= t.p).length;
  const label = `Weeks 1 to ${tape.length - 1}: beat his projection in ${beat} of ${played.length}${played.length ? `, averaging ${pts2(played.reduce((s, t) => s + t.a, 0) / played.length)}` : ""}.`;
  return (
    <figure className={`fotape${compact ? " sm" : ""}${big ? " big" : ""}`}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={label}>
        <line x1="0" x2={W} y1={base + 0.5} y2={base + 0.5} className="tb" />
        {tape.map((t, i) => {
          const x = i * (bw + gap), last = i === tape.length - 1;
          if (t.bye) return <circle key={i} cx={x + bw / 2} cy={base - 3} r="1.6" className="ty" />;
          if (last && t.a == null) return <rect key={i} x={x + 0.75} y={y(t.p)} width={bw - 1.5} height={Math.max(1, base - y(t.p))} className="tn" />;
          if (t.a == null) return <rect key={i} x={x} y={base - 1.5} width={bw} height="1.5" className="tz" />;
          const up = t.a >= t.p;
          return (
            <g key={i}>
              <rect x={x} y={y(t.a)} width={bw} height={Math.max(1.5, base - y(t.a))} className={last ? "tl" : up ? "tu" : "td"} />
              {t.p > 0 && <line x1={x - 1.5} x2={x + bw + 1.5} y1={y(t.p)} y2={y(t.p)} className="tp" />}
            </g>
          );
        })}
        {ahead.map((t, j) => { const x = (tape.length + j) * (bw + gap) + 6; return t.bye || !(t.p > 0) ? <circle key={`a${j}`} cx={x + bw / 2} cy={base - 3} r="1.6" className="ty" /> : <rect key={`a${j}`} x={x + 0.75} y={y(t.p)} width={bw - 1.5} height={Math.max(1, base - y(t.p))} className="ta" />; })}
      </svg>
      {caption && <figcaption>{played.length ? <>Beat projection <b>{beat}</b> of {played.length} · avg <b>{pts2(played.reduce((s, t) => s + t.a, 0) / played.length)}</b></> : "No games yet"}</figcaption>}
    </figure>
  );
}
// The defence meter: where his opponent ranks against his position, tough on the left, soft on the right.
function Meter({ r, pos, opp, small = false }) {
  if (!r) return <span className="fometer none">{opp ? `${opp}: no rating` : "No game"}</span>;
  const word = r <= 8 ? "tough" : r >= 25 ? "soft" : "";
  const txt = r === 32 ? "Softest" : r === 1 ? "Toughest" : r >= 25 ? `${ordinal(33 - r)}-softest` : r <= 8 ? `${ordinal(r)}-toughest` : `${ordinal(r)} of 32`;
  return (
    <span className={`fometer ${word}${small ? " sm" : ""}`} title={`${opp} ranks ${r} of 32 against ${pos}s (32 gives up the most)`}>
      <span className="trk" aria-hidden="true"><i style={{ left: `${((r - 1) / 31) * 100}%` }} /></span>
      <span className="lbl">{small ? <b>{opp}</b> : null}{txt}{small ? null : <> vs {pos}</>}</span>
    </span>
  );
}
const OUTS = ["OUT", "INJURY_RESERVE", "SUSPENSION"];

/* ------------------------------------------------------------------ the card shell (round 3) */
// Every player card shares one shell: a rail down the left, a compact face, and a chevron at the foot that opens the
// detail across the full width of the board. Two accents: a glow in the colour of the position (for a starter, the
// slot he fills, FLEX included) and the rail's stripe for where he stands (starting, bench, IR; on pickups, free now
// or on waivers).
const SLOT_POS = { 0: [1], 2: [2], 4: [3], 6: [4], 23: [2, 3, 4], 16: [16], 17: [5] };
const PKEY = { QB: "qb", RB: "rb", WR: "wr", TE: "te", FLEX: "flex", "D/ST": "dst", K: "k" };
const posKey = (label) => PKEY[label] || "none";
let cardSeq = 0;
function Card({ pos, status, rail, railSub, bad, live, children, detail, label }) {
  const [open, setOpen] = useState(false);
  const [id] = useState(() => `focd${++cardSeq}`);
  return (
    <article className={`focard pk-${pos} st-${status}${open ? " open" : ""}${bad ? " bad" : ""}${live ? " live" : ""}`}>
      <div className="forail"><span className="sl">{rail}</span>{railSub ? <span className="st">{railSub}</span> : null}</div>
      <div className="body">{children}</div>
      {open && <div className="more" id={id}>{detail}</div>}
      <button type="button" className="fochev" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
        <span className="vh">{open ? `Hide the detail for ${label}` : `Show the detail for ${label}`}</span>
        <svg viewBox="0 0 16 10" width="16" height="10" aria-hidden="true"><path d="M2 2l6 6 6-6" /></svg>
      </button>
    </article>
  );
}
const val = (c) => (c.bye || OUTS.includes(c.inj) ? 0 : c.proj);
const whereOf = (c) => (c.slot === 20 ? "Bench" : c.slot === 21 ? "IR" : `Starting at ${SL[c.slot]}`);
function GameLine({ c, full = false }) {
  if (c.bye) return <span className="gl">On a bye this week</span>;
  if (!c.opp) return <span className="gl">No game</span>;
  const word = c.rank ? (c.rank >= 25 ? "soft" : c.rank <= 8 ? "tough" : "") : "";
  return (
    <span className="gl">
      {c.home ? "vs" : "at"} <b>{c.opp}</b>
      {c.state === "pre" ? <> · {dateTimeText(c.kickoff)}</> : <> · <span className={`fostate ${c.state}`}>{c.state === "live" ? "Live" : "Final"}</span></>}
      {!full && c.rank ? <span className={`rk ${word}`}>{c.rank === 32 ? "softest" : c.rank === 1 ? "toughest" : c.rank >= 25 ? `${ordinal(33 - c.rank)}-softest` : c.rank <= 8 ? `${ordinal(c.rank)}-toughest` : `${ordinal(c.rank)} of 32`} vs {c.pos}</span> : null}
    </span>
  );
}
function Stats({ tape }) {
  const played = tape.slice(0, -1).filter((t) => t.a != null && t.p > 0);
  if (!played.length) return <p className="fodnote">No games with a score and a projection yet.</p>;
  const avg = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const best = played.reduce((a, b) => (b.a > a.a ? b : a)), worst = played.reduce((a, b) => (b.a < a.a ? b : a));
  const last3 = played.slice(-3);
  return (
    <dl className="fostats2">
      <div><dt>Avg scored</dt><dd>{pts2(avg(played.map((t) => t.a)))}</dd></div>
      <div><dt>Avg projected</dt><dd>{pts2(avg(played.map((t) => t.p)))}</dd></div>
      <div><dt>Last 3 avg</dt><dd>{pts2(avg(last3.map((t) => t.a)))}</dd></div>
      <div><dt>Best</dt><dd>{pts2(best.a)}<small>wk {best.w}</small></dd></div>
      <div><dt>Worst</dt><dd>{pts2(worst.a)}<small>wk {worst.w}</small></dd></div>
      <div><dt>Beat projection</dt><dd>{played.filter((t) => t.a >= t.p).length}<small>of {played.length}</small></dd></div>
    </dl>
  );
}
function Coming({ ahead, pos }) {
  if (!ahead || !ahead.length) return <p className="fodnote">No weeks left to show.</p>;
  return (
    <ul className="focoming">
      {ahead.map((a) => (
        <li key={a.w}><span className="w">Wk {a.w}</span>
          {a.bye || !a.opp ? <span className="byew">Bye</span> : <><span className="o">{a.home ? "vs" : "at"} <b>{a.opp}</b></span><Meter r={a.rank} pos={pos} opp={a.opp} small /></>}
          <span className="p">{a.bye || !a.opp ? "—" : a.p > 0 ? pts2(a.p) : <small>Not projected</small>}</span></li>
      ))}
    </ul>
  );
}
/** Who else could fill this card's place this week (a starter), or whose place he could take (bench and IR). */
function Compare({ c, roster }) {
  const me = val(c);
  if (c.slot !== 20 && c.slot !== 21) {
    const pool = roster.filter((x) => (SLOT_POS[c.slot] || []).includes(x.posId)).sort((a, b) => val(b) - val(a)).slice(0, 7);
    const top = Math.max(1, ...pool.map(val));
    return (
      <ul className="focmp">
        {pool.map((x) => (
          <li key={x.pid} className={x.pid === c.pid ? "me" : ""}>
            <span className="n">{x.name}<small>{x.pid === c.pid ? "This card" : whereOf(x)}{x.locked ? " · locked" : ""}</small></span>
            <span className="bar" aria-hidden="true"><i style={{ width: `${(val(x) / top) * 100}%` }} /></span>
            <span className="v">{x.bye ? "Bye" : OUTS.includes(x.inj) ? "Out" : pts2(x.proj)}</span>
            <span className={`d ${val(x) - me > 0.005 ? "up" : val(x) - me < -0.005 ? "down" : ""}`}>{x.pid === c.pid ? "" : Math.abs(val(x) - me) < 0.005 ? "level" : ptsSigned(val(x) - me)}</span>
          </li>
        ))}
      </ul>
    );
  }
  const starters = roster.filter((x) => x.slot !== 20 && x.slot !== 21 && (SLOT_POS[x.slot] || []).includes(c.posId)).sort((a, b) => val(a) - val(b));
  if (!starters.length) return <p className="fodnote">No starting slot takes a {c.pos}.</p>;
  const top = Math.max(1, me, ...starters.map(val));
  return (
    <>
      {c.slot === 21 && <p className="fodnote">In the IR spot: he cannot start until he is moved to the bench.</p>}
      <ul className="focmp">
        <li className="me"><span className="n">{c.name}<small>This card</small></span><span className="bar" aria-hidden="true"><i style={{ width: `${(me / top) * 100}%` }} /></span><span className="v">{c.bye ? "Bye" : OUTS.includes(c.inj) ? "Out" : pts2(c.proj)}</span><span className="d" /></li>
        {starters.map((x) => (
          <li key={x.pid}>
            <span className="n">{x.name}<small>{whereOf(x)}{x.locked ? " · locked" : ""}</small></span>
            <span className="bar" aria-hidden="true"><i style={{ width: `${(val(x) / top) * 100}%` }} /></span>
            <span className="v">{x.bye ? "Bye" : OUTS.includes(x.inj) ? "Out" : pts2(x.proj)}</span>
            <span className={`d ${me - val(x) > 0.005 ? "up" : me - val(x) < -0.005 ? "down" : ""}`} title="What starting this card instead would change">{Math.abs(me - val(x)) < 0.005 ? "level" : ptsSigned(me - val(x))}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
function RosterDetail({ c, roster }) {
  return (
    <div className="fodetail">
      <section className="wide">
        <h4>Season so far and the next three weeks</h4>
        <Tape tape={c.tape} pos={c.pos} ahead={c.ahead || []} big caption />
        <Stats tape={c.tape} />
      </section>
      <section>
        <h4>This week's game</h4>
        <p className="fogame"><GameLine c={c} full /></p>
        {c.opp && !c.bye && <Meter r={c.rank} pos={c.pos} opp={c.opp} />}
        <ul className="fofacts">
          {c.line && <li>Line <b>{c.line}</b></li>}
          {c.ou != null && <li>Over/under <b>{c.ou}</b></li>}
          {c.indoorGame ? <li>Indoors</li> : c.weather ? <li>{c.weather}</li> : null}
          {c.locked && c.live != null && <li>So far <b>{pts2(c.live)}</b> of <b>{pts2(c.proj)}</b> projected</li>}
          {c.depth ? <li><b>{ordinal(c.depth)}</b> on {c.nfl}'s depth chart</li> : null}
          {c.own != null && <li>ESPN owned <b>{Number(c.own).toFixed(1)}%</b>{c.chg ? <span className={c.chg > 0 ? "up" : "down"}> {c.chg > 0 ? "+" : ""}{c.chg.toFixed(1)}</span> : null}</li>}
        </ul>
      </section>
      <section>
        <h4>Coming weeks</h4>
        <Coming ahead={c.ahead} pos={c.pos} />
      </section>
      <section>
        <h4>{c.slot === 20 || c.slot === 21 ? "Could start instead of" : `Everyone who can play ${SL[c.slot]}`}</h4>
        <Compare c={c} roster={roster} />
      </section>
      {c.notes && c.notes.length ? (
        <section className="wide">
          <h4>Notes</h4>
          <ul className="fonotelist">{c.notes.map((n) => <li key={n.id} className={n.tag}><b>{n.label}.</b> {n.text}</li>)}</ul>
        </section>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ Tab 1: this week */
function PlayerCard({ c, alt, roster }) {
  const kind = c.slot === 20 ? "bench" : c.slot === 21 ? "ir" : "start";
  const live = c.locked && c.live != null;
  const out = OUTS.includes(c.inj);
  const value = live ? c.live : c.bye || out ? null : c.proj;
  const altP = alt ? PL[alt.b] || {} : null;
  const pos = kind === "start" ? posKey(SL[c.slot]) : posKey(c.pos);
  return (
    <Card pos={pos} status={kind} label={c.name} rail={kind === "start" ? SL[c.slot] : kind === "ir" ? "IR" : "Bench"}
      railSub={c.locked ? (c.state === "live" ? "Live" : c.state === "final" ? "Final" : "Locked") : null}
      bad={kind === "start" && (c.bye || out)} live={c.state === "live" && c.locked} detail={<RosterDetail c={c} roster={roster} />}>
      <header className="id">
        <div>
          <h3 className="nm"><span>{c.name}</span></h3>
          <span className="sub">{c.pos} · {c.nfl}<Inj s={c.inj} /></span>
        </div>
        <div className={`pv${live ? " live" : ""}${value == null ? " nil" : ""}`}>
          <span className="v">{value == null ? (c.bye ? "Bye" : "Out") : pts2(value)}</span>
          <span className="k">{live ? (c.state === "final" ? "Scored" : "So far") : value == null ? "No points" : "Projected"}</span>
        </div>
      </header>
      <div className="mid">
        <Tape tape={c.tape} pos={c.pos} compact />
        <GameLine c={c} />
      </div>
      {c.notes && c.notes.length ? <div className="fotags">{c.notes.map((n) => <span key={n.id} className={`fonote ${n.tag}`}>{n.label}</span>)}</div> : null}
      {alt && (
        <div className={`swap ${alt.gain >= 2 ? "go" : "maybe"}`}>
          <span className="ic" aria-hidden="true">⇅</span>
          <span className="t">Start <b>{altP.name}</b> instead</span>
          <span className="g">{alt.gain >= 0.005 ? ptsSigned(alt.gain) : alt.gain <= -0.005 ? pts2(alt.gain) : "Level"}</span>
        </div>
      )}
    </Card>
  );
}
function CardKey({ statuses }) {
  return (
    <div className="focardkey" aria-label="What the card colours mean">
      <span className="grp">Glow</span>
      <span className="row">{["QB", "RB", "WR", "TE", "FLEX", "D/ST", "K"].map((p) => <span key={p} className={`pk-${posKey(p)}`}><i className="g" />{p}</span>)}</span>
      <span className="grp">Side</span>
      <span className="row">{statuses.map(([k, l]) => <span key={k} className={`st-${k}`}><i className="s" />{l}</span>)}</span>
    </div>
  );
}
function ThisWeek({ tw }) {
  const roster = [...tw.starters, ...tw.bench, ...tw.ir];
  return (
    <>
      <SecHead>Before lock</SecHead>
      {tw.checklist.length ? (
        <ul className="fochk">
          {tw.checklist.map((c, i) => (
            <li key={i} className={c.tone}><span className="tone">{c.tone === "red" ? "Act now" : c.tone === "amber" ? "Look" : "Note"}</span>
              <span>{c.text}{c.at ? <> <b>{dateTimeText(c.at)}</b>.</> : null}</span></li>
          ))}
        </ul>
      ) : <div className="foclean">Your lineup is clean: nothing to fix before kickoff.</div>}
      <SecHead>Your lineup</SecHead>
      {tw.lateSwap && <div className="foswap"><b>Late swaps</b><span>{tw.lateSwap.open.length > 3 ? `${tw.lateSwap.open.length} of ${tw.starters.length} slots` : tw.lateSwap.open.join(", ")} still open · next lock {dateTimeText(tw.lateSwap.nextLock)}</span></div>}
      {tw.over && <div className="foswap"><b>Week over</b><span>Next week's lineup opens when ESPN moves to week {tw.week + 1} on Tuesday.</span></div>}
      <CardKey statuses={[["start", "Starting"], ["bench", "Bench"], ["ir", "IR"]]} />
      <div className="fotapekey" aria-hidden="true">
        <span><i className="tu" />Beat projection</span><span><i className="td" />Fell short</span><span><i className="tp" />ESPN's projection</span><span><i className="tn" />This week</span><span><i className="ta" />Weeks ahead</span><span><i className="ty" />Bye</span>
      </div>
      <div className="foboard">{tw.starters.map((s) => <PlayerCard key={s.pid} c={s} alt={s.alt} roster={roster} />)}</div>
      <SecHead>Bench{tw.ir.length ? " and IR" : ""}</SecHead>
      <div className="foboard">{[...tw.bench, ...tw.ir].map((b) => <PlayerCard key={b.pid} c={b} roster={roster} />)}</div>
    </>
  );
}

/* ------------------------------------------------------------------ Tab 2: pickups */
const POSES = ["All", "QB", "RB", "WR", "TE", "K", "D/ST"];
function FitBar({ x }) {
  // Where the fit comes from: the three weighted lineup gains, then the adjustments, on one line.
  const parts = x.kind === "bench"
    ? [["Bench depth", x.fit]]
    : [["Next 3", 0.5 * x.gain.next], ["Rest", 0.3 * x.gain.rest], ["Postseason", 0.2 * x.gain.post], ...x.adj.filter((a) => Math.abs(a[1]) >= 0.01)];
  const pos = parts.filter((p) => p[1] > 0), tot = pos.reduce((s, p) => s + p[1], 0);
  if (!(x.fit > 0) || tot <= 0) return <p className="fodnote">He would not start for you in any week ahead and projects no better than your bench at {x.pos}, so his fit is zero however he is playing.</p>;
  return (
    <div className="fofitbar">
      <div className="bar" aria-hidden="true">{pos.map(([k, v]) => <i key={k} className={`p-${k.replace(/\W/g, "").toLowerCase()}`} style={{ flexGrow: v }} />)}</div>
      <div className="lg">{parts.map(([k, v]) => <span key={k} className={`p-${k.replace(/\W/g, "").toLowerCase()}`}><i />{k} <b>{ptsSigned(v)}</b></span>)}</div>
      {x.kind === "bench" && <p className="fodnote">He would not start for you, but he projects {pts2(x.gain.bench)} a week more than {x.drop.name} on your bench. A bench upgrade counts a quarter of that, so it ranks below pickups that would start.</p>}
    </div>
  );
}
function PickDetail({ x }) {
  const maxRos = Math.max(x.ros, x.drop.ros, 1);
  return (
    <div className="fodetail">
      <section className="wide"><h4>Where the fit comes from</h4><FitBar x={x} /></section>
      <section className="wide">
        <h4>Season so far and the next three weeks</h4>
        <Tape tape={x.tape} pos={x.pos} ahead={x.opps.slice(1)} big caption />
        <Stats tape={x.tape} />
      </section>
      <section>
        <h4>Next three games</h4>
        <ul className="focoming">{x.opps.map((o) => <li key={o.w}><span className="w">Wk {o.w}</span>{o.opp ? <><span className="o"><b>{o.opp}</b></span><Meter r={o.rank} pos={x.pos} opp={o.opp} small /></> : <span className="byew">Bye</span>}<span className="p">{o.opp ? pts2(o.p) : "—"}</span></li>)}</ul>
      </section>
      <section>
        <h4>Add and drop</h4>
        <div className="trade">
          <div className="in"><span className="k">Add</span><span className="n">{x.name}</span><span className="bar"><i style={{ width: `${(x.ros / maxRos) * 100}%` }} /></span><span className="v">{pts2(x.ros)}</span></div>
          <div className="out"><span className="k">Drop</span><span className="n">{x.drop.name} <small>{x.drop.pos} · {x.drop.nfl}</small></span><span className="bar"><i style={{ width: `${(x.drop.ros / maxRos) * 100}%` }} /></span><span className="v">{pts2(x.drop.ros)}</span></div>
          <span className="cap">Projected points for the rest of the regular season</span>
        </div>
        <ul className="fofacts"><li>ESPN owned <b>{x.own.toFixed(1)}%</b>{x.chg ? <span className={x.chg > 0 ? "up" : "down"}> {x.chg > 0 ? "+" : ""}{x.chg.toFixed(1)} this week</span> : null}</li></ul>
      </section>
      <section className="wide">
        <h4>Why</h4>
        <ul className="foreasons">{x.reasons.length ? x.reasons.map((r, j) => <li key={j}>{r}</li>) : <li>Would not crack your best lineup or beat your bench in the weeks ahead.</li>}</ul>
      </section>
    </div>
  );
}
function Pickups({ pk }) {
  const [pos, setPos] = useState("All");
  const [view, setView] = useState("fit");
  const [freeOnly, setFreeOnly] = useState(false);
  const [all, setAll] = useState(false);
  let list = pk.list.filter((x) => (pos === "All" || x.pos === pos) && (!freeOnly || x.status === "FREEAGENT"));
  if (view === "hot") list = [...list].sort((a, b) => b.chg - a.chg);
  const fits = list.filter((x) => x.fit > 0);
  const shown = view === "hot" ? list.slice(0, all ? 60 : 12) : all ? list.slice(0, 60) : fits;
  return (
    <>
      <SecHead>Pickups</SecHead>
      <div className="foneeds">{pk.needs.length ? pk.needs.map((n, i) => <span key={i} className={`foneed ${n.tone}`}>{n.text}</span>) : <span className="foneed ok">Every slot covered for the next three weeks</span>}</div>
      <div className="fowaiver"><span>Waiver order <b>{pk.waiverRank ? ordinal(pk.waiverRank) : "—"}</b> of {pk.teams}</span>{waiverText(pk.waiver) && <span>{waiverText(pk.waiver)}</span>}</div>
      <div className="fofilters">
        <div className="foseg" role="group" aria-label="Position">{POSES.map((p) => <button key={p} type="button" aria-pressed={pos === p} onClick={() => setPos(p)}>{p}</button>)}</div>
        <div className="foseg" role="group" aria-label="View"><button type="button" aria-pressed={view === "fit"} onClick={() => setView("fit")}>Best fit</button><button type="button" aria-pressed={view === "hot"} onClick={() => setView("hot")}>Hot</button></div>
        <div className="foseg" role="group" aria-label="Status"><button type="button" aria-pressed={freeOnly} onClick={() => setFreeOnly((v) => !v)}>Free agents only</button></div>
      </div>
      <CardKey statuses={[["fa", "Free now"], ["wv", "On waivers"]]} />
      {shown.length ? (
        <div className="foboard">
          {shown.map((x, i) => (
            <Card key={x.pid} pos={posKey(x.pos)} status={x.status === "FREEAGENT" ? "fa" : "wv"} label={x.name} rail={`${i + 1}`} railSub={x.pos} detail={<PickDetail x={x} />}>
              <header className="id">
                <div>
                  <h3 className="nm"><span>{x.name}</span></h3>
                  <span className="sub">{x.pos} · {x.nfl} · {x.status === "FREEAGENT" ? "Free now" : "On waivers"}<Inj s={x.inj} /></span>
                  {x.kind === "bench" && x.fit > 0 ? <span className="fokind">Bench upgrade</span> : null}
                </div>
                <div className={`pv fitv${x.fit > 0 ? "" : " zero"}`}><span className="v">{x.fit > 0 ? ptsSigned(x.fit) : pts2(x.fit)}</span><span className="k">Fit a week</span></div>
              </header>
              <div className="mid">
                <Tape tape={x.tape} pos={x.pos} ahead={x.opps.slice(1)} compact />
                <span className="gl">Drop <b>{x.drop.name}</b></span>
              </div>
              <p className="lead">{x.reasons[0] || "Would not crack your best lineup or beat your bench in the weeks ahead."}</p>
            </Card>
          ))}
        </div>
      ) : <Placeholder title="No pickup would improve your roster" note={pos === "All" ? "Every free agent at this depth projects below the players you would start and the bench players you could drop. Show all lists them anyway." : `No ${pos} here would start for you or beat your bench. Show all lists them anyway.`} />}
      {!all && <button type="button" className="foshowall" onClick={() => setAll(true)}>Show all free agents</button>}
    </>
  );
}

/* ------------------------------------------------------------------ Tab 3: weeks ahead */
/* Playoff odds as the site writes every percentage: half up, one decimal (a decided race in words). */
const oddsText = (x) => (x == null ? "\u2014" : x >= 0.9995 ? "Clinched" : x <= 0.0005 ? "Out" : `${(Math.round(x * 1000 + 1e-6) / 10).toFixed(1)}%`);
const oddsGain = (x) => `+${(Math.round(x * 1000 + 1e-6) / 10).toFixed(1)}`;
function Race({ race }) {
  // Fortune Teller's exact odds for this team at its last update: now, with a win or a loss this week, if it wins out;
  // its biggest game left; the other games this week worth rooting in.
  const tiles = [["Now", race.odds, ""], ["With a win", race.win, "up"], ["With a loss", race.loss, "down"], ["Win out", race.winOut, ""]];
  return (
    <div className="forace">
      <dl className="foracenums">
        {tiles.map(([k, v, cls]) => <div key={k} className={cls}><dt>{k}</dt><dd><span className="g">{oddsText(v)}</span></dd></div>)}
      </dl>
      <div className="foraceside">
        {race.critical ? <p className="big"><span className="k">Biggest game left</span><span className="v">Week {race.critical.week}{race.critical.oppId && T[race.critical.oppId] ? <> v <Logo id={race.critical.oppId} cls="rl" /><b>{T[race.critical.oppId].name}</b></> : null}</span></p> : null}
        {race.rootFor.length ? (
          <div className="root"><span className="k">Root for, this week</span>
            <ul>{race.rootFor.map((x) => (
              <li key={`${x.forId}-${x.againstId}`}><Logo id={x.forId} cls="rl" /><b>{(T[x.forId] || {}).name}</b><span className="ov">over</span><span className="ag">{(T[x.againstId] || {}).name}</span><span className="gn">{oddsGain(x.gain)}</span></li>
            ))}</ul>
          </div>
        ) : null}
        <p className="src">Playoff odds from Fortune Teller, counted exactly over every way the rest of the season can go. Root for figures are points of playoff odds.</p>
      </div>
    </div>
  );
}
const tint = (c) => (!c ? "" : c.bye ? "bye" : c.out ? "out" : c.rank >= 25 ? "soft" : c.rank && c.rank <= 8 ? "tough" : "");
function Road({ wa, idx, bracket, race }) {
  // The road: one tile per week left, your best lineup against your opponent's, as a tug of war from the centre.
  const span = Math.max(20, ...idx.map((i) => (wa.cols[i].oppBest != null ? Math.abs(wa.cols[i].best - wa.cols[i].oppBest) : 0)));
  return (
    <ScrollBox>
      <ol className="foroad">
        {idx.map((i) => {
          const c = wa.cols[i], m = c.oppBest != null ? c.best - c.oppBest : null;
          return (
            <li key={i} className={`${c.post ? "post" : ""}${c.holes.length ? " hole" : ""}`}>
              <span className="wk">Week {c.w}{c.post ? <em>{bracket ? c.round || "TBD" : "Postseason"}</em> : null}</span>
              <span className="vs">{c.oppId ? <><Logo id={c.oppId} cls="rl" /><span>{T[c.oppId].name}</span></> : <span className="tbd">{c.post ? (bracket ? "Opponent to be set" : "If you qualify") : "No game"}</span>}</span>
              <span className="nums"><b>{pts2(c.best)}</b>{c.oppBest != null ? <> <span className="vsk">vs</span> {pts2(c.oppBest)}</> : null}</span>
              <span className="tug" aria-hidden="true">{m != null && <i className={m >= 0 ? "a" : "b"} style={{ width: `${Math.min(50, (Math.abs(m) / span) * 50)}%` }} />}</span>
              <span className={`verdict ${m == null ? "" : m >= 0 ? "a" : "b"}`}>{m == null ? "Best lineup" : Math.abs(m) < 0.005 ? "Level" : m > 0 ? `Ahead by ${pts2(m)}` : `Behind by ${pts2(-m)}`}</span>
              {c.holes.length ? <span className="holes">No {c.holes.join(", ")}</span> : null}
              {race && race.week === c.w && race.win != null ? <span className="odds">Playoff odds <b>{oddsText(race.win)}</b> with a win, <b>{oddsText(race.loss)}</b> with a loss</span> : null}
              {race && race.critical && race.critical.week === c.w ? <span className="crit">Biggest game left</span> : null}
            </li>
          );
        })}
      </ol>
    </ScrollBox>
  );
}
function LineupBoard({ wa, idx }) {
  const rowsBy = Object.fromEntries(wa.rows.map((r) => [r.pid, r]));
  const slots = wa.cols[idx[0]].lineup.map((x) => x.slot);
  return (
    <ScrollBox>
      <table className="foboardw">
        <thead><tr><th className="sl">Slot</th>{idx.map((i) => <th key={i} className={wa.cols[i].post ? "post" : ""}>Wk {wa.cols[i].w}</th>)}</tr></thead>
        <tbody>
          {slots.map((s, si) => (
            <tr key={si} className={s === 23 ? "flex" : ""}>
              <th className={`sl pk-${posKey(SL[s])}`} scope="row">{SL[s]}</th>
              {idx.map((i) => {
                const x = wa.cols[i].lineup[si], r = x && x.pid ? rowsBy[x.pid] : null;
                const cell = r ? r.cells[i] : null;
                return (
                  <td key={i} className={r ? tint(cell) : "hole"}>
                    {r ? <><span className="n">{r.name}</span><span className="m"><b>{pts2(x.proj)}</b> {cell.opp ? `${cell.opp}` : ""}</span></> : <span className="n">No {SL[s]}</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot><tr><th className="sl">Total</th>{idx.map((i) => <td key={i}>{pts2(wa.cols[i].best)}</td>)}</tr></tfoot>
      </table>
    </ScrollBox>
  );
}
function PlayerHeat({ wa, idx }) {
  const n = idx.length;
  return (
    <ScrollBox>
      <table className="foheat">
        <thead><tr><th className="pl">Player</th><th className="sc">Starts</th>{idx.map((i) => <th key={i} className={wa.cols[i].post ? "post" : ""}>Wk {wa.cols[i].w}</th>)}</tr></thead>
        <tbody>
          {wa.rows.map((r) => {
            const starts = idx.filter((i) => wa.cols[i].lineup.some((x) => x.pid === r.pid)).length;
            const cap = SCALE[r.pos] || 30;
            return (
              <tr key={r.pid} className={r.slot === 20 ? "bn" : r.slot === 21 ? "ir" : ""}>
                <th className={`pl pk-${posKey(r.pos)}`} scope="row"><span className="nm">{r.name}</span><span className="sub">{r.slot === 20 ? "Bench" : SL[r.slot]} · {r.pos} · {r.nfl}</span></th>
                <td className="sc"><b>{starts}</b><span>of {n}</span></td>
                {idx.map((i) => {
                  const c = r.cells[i], on = wa.cols[i].lineup.some((x) => x.pid === r.pid);
                  return (
                    <td key={i} className={`c ${tint(c)}${on ? " on" : ""}`} title={c.rank ? `${c.opp}: rank ${c.rank} of 32 against ${r.pos}s` : undefined}>
                      {c.bye ? <span className="v">Bye</span> : c.out ? <span className="v">Out</span> : <>
                        <span className="fill" aria-hidden="true"><i style={{ width: `${Math.min(100, (c.proj / cap) * 100)}%` }} /></span>
                        <span className="v">{pts2(c.proj)}</span><span className="o">{c.opp}</span>
                      </>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </ScrollBox>
  );
}
function WeeksAhead({ wa, bracket }) {
  const [view, setView] = useState("lineup");
  const [onlyPost, setOnlyPost] = useState(false);
  const idx = wa.weeks.map((w, i) => i).filter((i) => !onlyPost || wa.weeks[i] >= 14);
  const anyPost = wa.weeks.some((w) => w >= 14);
  return (
    <>
      {wa.race ? <><SecHead>The race</SecHead><Race race={wa.race} /></> : null}
      <SecHead>The road</SecHead>
      <Road wa={wa} idx={idx} bracket={bracket} race={wa.race} />
      <SecHead>Week by week</SecHead>
      <div className="fogridtools">
        <div className="foseg" role="group" aria-label="View"><button type="button" aria-pressed={view === "lineup"} onClick={() => setView("lineup")}>Best lineup</button><button type="button" aria-pressed={view === "all"} onClick={() => setView("all")}>Every player</button></div>
        {anyPost && <div className="foseg" role="group" aria-label="Weeks"><button type="button" aria-pressed={!onlyPost} onClick={() => setOnlyPost(false)}>Every week</button><button type="button" aria-pressed={onlyPost} onClick={() => setOnlyPost(true)}>Postseason weeks</button></div>}
        <div className="fokey"><span><i className="soft" />Soft matchup</span><span><i className="tough" />Tough</span><span><i className="bye" />Bye</span><span><i className="out" />Injured or not projected</span>{view === "all" && <span><i className="on" />In the best lineup</span>}</div>
      </div>
      {view === "lineup" ? <LineupBoard wa={wa} idx={idx} /> : <PlayerHeat wa={wa} idx={idx} />}
      <SecHead>Worth a stash</SecHead>
      {wa.stash.length ? (
        <div className="foboard">
          {wa.stash.map((st) => (
            <Card key={st.pid} pos={posKey(st.pos)} status="none" label={st.name} rail={st.pos} detail={
              <div className="fodetail">
                <section className="wide"><h4>Season so far and the weeks ahead</h4><Tape tape={st.tape} pos={st.pos} ahead={st.next.slice(1)} big caption /><Stats tape={st.tape} /></section>
                <section className="wide"><h4>Form against outlook</h4>
                  <dl className="fostats2">
                    <div><dt>Next 4 avg</dt><dd>{pts2(st.ahead)}</dd></div>
                    <div><dt>Postseason avg</dt><dd>{pts2(st.post)}</dd></div>
                    <div><dt>ESPN owned</dt><dd>{st.own.toFixed(1)}%</dd></div>
                  </dl>
                  <p className="fodnote">A stash is a player to add now for later: his projections for the coming weeks or the postseason clearly beat what he has scored lately.</p>
                </section>
              </div>}>
              <header className="id">
                <div><h3 className="nm"><span>{st.name}</span></h3><span className="sub">{st.pos} · {st.nfl} · {st.own.toFixed(1)}% owned</span></div>
                <div className="pv fitv"><span className="v">{ptsSigned(st.lift)}</span><span className="k">Over his form</span></div>
              </header>
              <div className="mid"><Tape tape={st.tape} pos={st.pos} ahead={st.next.slice(1)} compact /><span className="gl">Next 4 avg <b>{pts2(st.ahead)}</b></span></div>
            </Card>
          ))}
        </div>
      ) : <Placeholder title="No stash candidates" note="No free agent's coming weeks clearly beat his recent form." />}
    </>
  );
}

/* ------------------------------------------------------------------ sample chrome and scenarios */
/* ------------------------------------------------------------------ the page */
const hasLive = (pg) => Boolean(pg && pg.tw && [...pg.tw.starters, ...pg.tw.bench].some((c) => c.state === "live"));
const lockSoon = (pg, now) => Boolean(pg && pg.tw && pg.tw.starters.some((c) => !c.locked && c.kickoff && Date.parse(c.kickoff) - now < 3600e3 && Date.parse(c.kickoff) > now - 600e3));

export default function FrontOffice() {
  const [theme, setTheme] = useState(() =>
    (typeof document !== "undefined" && document.documentElement.dataset.theme) || (readCookie(THEME_COOKIE) === "light" ? "light" : "dark"));
  const [leagueName, setLeagueName] = useState("");
  const [data, setData] = useState({ ready: null });
  const [tab, setTab] = useState("week");
  const [error, setError] = useState("");
  const [, setZone] = useState(0);
  const team = useRef(Number(readCookie(TEAM_COOKIE)) || null);
  const tag = useRef(null);
  const lastActive = useRef(Date.now());
  const pageRef = useRef(null);

  useEffect(() => {
    fetch("/api/meta", { credentials: "same-origin" })
      .then((r) => r.json()).then((j) => { if (j && j.leagueName) setLeagueName(j.leagueName); })
      .catch(() => { /* the header simply stays blank */ });
    const tz = () => setZone((x) => x + 1);
    window.addEventListener("tzchange", tz);
    return () => window.removeEventListener("tzchange", tz);
  }, []);

  const load = useCallback(async () => {
    const res = await fetch(`/apps/front-office/api${team.current ? `?team=${encodeURIComponent(team.current)}` : ""}`, {
      credentials: "same-origin", headers: tag.current ? { "if-none-match": tag.current } : {} });
    noteBrake(res);
    if (res.status === 304) return;
    if (!res.ok) throw new Error(res.status === 403 ? "Front Office is switched off on this site." : "Your team's page could not be loaded. It will be asked for again shortly.");
    const et = res.headers.get("etag");
    const j = await res.json();
    if (et) tag.current = et;
    pageRef.current = j.page || null;
    setData(j);
    setError("");
  }, []);

  // Asked for at once; again once a minute while a player is playing or a lock is within the hour, otherwise every
  // fifteen minutes. A hidden tab rests, and a tab left alone for four hours stops asking.
  useEffect(() => {
    let timer = null, dead = false;
    const tick = async () => {
      if (dead) return;
      if (!document.hidden && Date.now() - lastActive.current < IDLE_LIMIT_MS) {
        try { await load(); } catch (e) { setError(String(e.message || e)); }
      }
      const pg = pageRef.current;
      const fast = hasLive(pg) || lockSoon(pg, Date.now());
      if (!dead) timer = setTimeout(tick, pollDelay(fast ? 60000 : 900000, { live: fast }));
    };
    tick();
    const wake = () => { const idle = Date.now() - lastActive.current >= IDLE_LIMIT_MS; lastActive.current = Date.now(); if (idle) { clearTimeout(timer); tick(); } };
    const evs = ["pointerdown", "keydown", "scroll", "touchstart"];
    for (const ev of evs) window.addEventListener(ev, wake, { passive: true });
    const vis = () => { if (!document.hidden) { clearTimeout(timer); tick(); } };
    document.addEventListener("visibilitychange", vis);
    return () => { dead = true; clearTimeout(timer); for (const ev of evs) window.removeEventListener(ev, wake); document.removeEventListener("visibilitychange", vis); };
  }, [load]);

  const pg = data.page || null;
  if (pg) { T = pg.teams || {}; PL = pg.players || {}; }
  else if (data.index) T = data.index.teams || {};
  const cal = (pg && pg.calendar) || {};
  const over = pg && cal.postLast && pg.week > cal.postLast;
  const reds = pg ? pg.tw.checklist.filter((c) => c.tone === "red").length : 0;
  const ambers = pg ? pg.tw.checklist.filter((c) => c.tone === "amber").length : 0;

  let body;
  if (data.ready === null) body = <><SecHead>Your team</SecHead><Placeholder title="Loading your team" note="Reading your roster and this week's projections." /></>;
  else if (data.ready === false) body = <><SecHead>Your team</SecHead><Placeholder title="Your team's page is being built" note="Front Office reads every roster and ESPN's projections for every week left; this page fills in as soon as it is done." /></>;
  else if (!data.team || !pg) body = <><SecHead>Your team</SecHead><Placeholder title="Choose your team first" note="Front Office works on the team chosen on the home page. Choose yours there, under the tickers, and come back." /></>;
  else if (over) body = <><SecHead>Your team</SecHead><Placeholder title="The season is over" note={`Front Office returns when ESPN posts next season's rosters and projections, after the ${dateText(`${Number(pg.season || new Date().getFullYear()) + 1}-08-01T12:00:00Z`, undefined, { year: true })} rollover.`} /></>;
  else body = (
    <>
      <Header team={pg.team} tw={pg.tw} />
      <div className="fotabs" role="tablist" aria-label="Front Office">
        <button type="button" role="tab" className="fotab" aria-selected={tab === "week"} onClick={() => setTab("week")}>This week{reds ? <span className="c">{reds}</span> : ambers ? <span className="c amber">{ambers}</span> : null}</button>
        <button type="button" role="tab" className="fotab" aria-selected={tab === "pick"} onClick={() => setTab("pick")}>Pickups</button>
        <button type="button" role="tab" className="fotab" aria-selected={tab === "ahead"} onClick={() => setTab("ahead")}>Weeks ahead</button>
      </div>
      <p className="foasof">As of <b>{dateTimeText(pg.asOf || pg.builtAt)}</b></p>
      {tab === "week" && <ThisWeek tw={pg.tw} />}
      {tab === "pick" && <Pickups key={pg.team.id} pk={pg.pk} />}
      {tab === "ahead" && <WeeksAhead key={pg.team.id} wa={pg.wa} bracket={pg.wa.bracket} />}
    </>
  );

  return (
    <div style={{ minHeight: "100svh", fontFamily: UI_FONT }}>
      <div dangerouslySetInnerHTML={{ __html: BACKDROP }} />
      <style>{`
        ${PALETTES}
        ${BASE_CSS}
${HOF_CSS}
${FO_CSS}
      `}</style>
      <div className="wrap scr-fo">
        <div className="toolhead">
          <a className="toolmark homelink" href="/" aria-label="Back to home">
            <svg className="mark" viewBox="0 0 1000 150" role="img" aria-label="ESPN Fantasy Tools">
              <text className="fit" x="500" y="74" textAnchor="middle" textLength="980" lengthAdjust="spacingAndGlyphs" fontSize="86" fontWeight="900" letterSpacing="-2" fontFamily={UI_FONT}>
                <tspan className="m1">ESPN</tspan><tspan className="m2"> FANTASY TOOLS</tspan>
              </text>
              <path className="rule" d="M10 100 H990" /><path className="rulelive" d="M10 100 H360" />
              <text x="500" y="137" textAnchor="middle" fontSize="30" fontWeight="700" letterSpacing="14" fill="var(--ink-3)" fontFamily={UI_FONT}>LEAGUE HQ</text>
            </svg>
          </a>
          <div className="toolid"><p className="eyebrow">Front Office</p><div className="toolleague">{leagueName}</div></div>
          <div className="toolctl"><ToolControls steps={HELP_STEPS} label="How to use Front Office" theme={theme} onTheme={setTheme} /></div>
        </div>

        {error && <div className="msg err" style={{ display: "block" }}>{error}</div>}
        <div className="fowrap">{body}</div>

        <div className="grow" />
        <div className="pageaction"><a className="pagebtn" href="/">&larr; Back to home</a></div>
        <div className="toolfoot">
          <a className="gh" href="https://github.com/shortcutsbin-netizen" target="_blank" rel="noopener noreferrer">GitHub - shortcutsbin-netizen</a>
        </div>
      </div>
    </div>
  );
}
