/**
 * Matchup Insights: the rules. Every insight type is a small function from a week's facts to zero or more rows,
 * shared by the backend step (src/insightstep.js, which runs them and stores the rows) and the tests. Ported from
 * the approved design sample; the planning document "Matchup Insights — Planning Document" holds every decision
 * (D1–D58) and the catalogue (I numbers are permanent; 163 kept, then round 8: I229 and I231 added, I149 removed).
 *
 * Rows carry ids and figures, never formatted names, so the page applies team names, two-decimal points and the
 * reader's date style. A row = { type, cat, label, weight 1-10, when 'pre'|'live'|'post', teams [ids], about
 * 'matchup'|'team'|'player'|'league', parts [string | {t: teamId} | {v: text} | {p: 'Player · POS'} | {d: iso}],
 * predict, outcome 'held'|'broke'|'pending'|null }. The model (M) is built by src/insightmodel.js.
 */
import { bestLineup, POS_ID, allTimeBefore } from './insightmodel.js';

export const CATS = {
  stakes: { label: 'Stakes', order: 1 }, race: { label: 'The race', order: 2 }, rivalry: { label: 'Rivalry and history', order: 3 },
  form: { label: 'Form', order: 4 }, players: { label: 'Players and lineups', order: 5 }, avail: { label: 'Availability', order: 6 },
  records: { label: 'Records and milestones', order: 7 }, proj: { label: 'Projections', order: 8 }, live: { label: 'Live', order: 9 },
  moves: { label: 'Moves', order: 10 }, after: { label: 'After the final', order: 11 },
};

/* Every kept type: category, label (D41), base weight (D18), phase. Ids never change. */
export const TYPES = {
  I1: ['stakes', "Win and You're In", 3, 'pre'], I2: ['stakes', 'Must Win', 3, 'pre'], I3: ['stakes', 'Odds on the line', 3, 'pre'],
  I4: ['stakes', 'Most critical game', 2, 'pre'], I5: ['stakes', 'Watched from afar', 2, 'pre'], I6: ['stakes', 'Game of the week', 2, 'pre'],
  I7: ['stakes', 'Rooting guide', 2, 'pre'], I8: ['stakes', 'Season on the line', 2, 'pre'], I9: ['stakes', 'Nothing at stake', 1, 'pre'],
  I10: ['stakes', 'Spoiler', 2, 'pre'], I11: ['stakes', 'Own destiny', 2, 'pre'], I12: ['stakes', 'Clinch watch', 2, 'pre'],
  I13: ['stakes', 'Elimination watch', 2, 'pre'], I14: ['stakes', 'Finish on the line', 2, 'pre'], I16: ['stakes', 'Last place on the line', 1, 'pre'],
  I19: ['stakes', 'Semifinal', 3, 'pre'], I20: ['stakes', 'Championship', 3, 'pre'], I21: ['stakes', 'First title', 2, 'pre'],
  I22: ['stakes', 'Placement game', 2, 'pre'], I23: ['stakes', 'Halfway there', 2, 'live'], I178: ['stakes', 'Two-week matchup', 1, 'pre'],
  I24: ['race', 'Top of the Table', 3, 'pre'], I25: ['race', 'Bubble game', 3, 'pre'], I26: ['race', 'Playoff line', 2, 'pre'],
  I27: ['race', 'Into the playoffs', 2, 'pre'], I28: ['race', 'Out of the playoffs', 2, 'pre'], I29: ['race', 'Tiebreak watch', 2, 'pre'],
  I30: ['race', 'Games back', 1, 'pre'], I31: ['race', 'Magic number', 2, 'pre'], I33: ['race', 'Rise or fall', 1, 'pre'],
  I34: ['race', 'Bottom of the table', 1, 'pre'], I35: ['race', 'Top-four mainstay', 1, 'pre'], I37: ['race', 'Playoff odds', 2, 'pre'],
  I38: ['race', 'Power clash', 2, 'pre'], I39: ['race', 'Already settled', 1, 'pre'],
  I41: ['rivalry', 'Head to head', 2, 'pre'], I42: ['rivalry', 'Last meeting', 2, 'pre'], I43: ['rivalry', 'Revenge game', 2, 'pre'],
  I45: ['rivalry', 'Rivalry streak', 2, 'pre'], I46: ['rivalry', 'Never beaten', 2, 'pre'], I47: ['rivalry', 'Rivalry shootout', 1, 'pre'],
  I48: ['rivalry', 'Rivalry nail-biter', 1, 'pre'], I49: ['rivalry', 'Rivalry blowout', 1, 'pre'], I51: ['rivalry', 'Postseason history', 2, 'pre'],
  I52: ['rivalry', 'Final rematch', 2, 'pre'], I53: ['rivalry', 'Defending champion', 2, 'pre'], I56: ['rivalry', 'Favourite opponent', 1, 'pre'],
  I57: ['rivalry', 'First meeting', 1, 'pre'],
  I59: ['form', 'Streaks', 2, 'pre'], I60: ['form', 'Hot streak', 2, 'pre'], I61: ['form', 'Hottest team', 2, 'pre'], I62: ['form', 'Coldest team', 1, 'pre'],
  I63: ['form', 'All-play and luck', 2, 'pre'], I72: ['form', 'Close-game record', 1, 'pre'], I74: ['form', 'Against the top half', 1, 'pre'],
  I77: ['players', "League's top scorer", 2, 'pre'], I78: ['players', 'Top at his position', 1, 'pre'], I79: ['players', 'Soft matchup', 2, 'pre'],
  I80: ['players', 'Tough matchup', 2, 'pre'], I81: ['players', 'D/ST matchup', 1, 'pre'], I82: ['players', 'Stack', 1, 'pre'],
  I83: ['players', 'Facing each other', 2, 'pre'], I85: ['players', 'Hot hand', 1, 'pre'], I86: ['players', 'Cold spell', 1, 'pre'],
  I87: ['players', 'Bench pressure', 1, 'pre'], I88: ['players', 'Points on the bench', 2, 'pre'], I89: ['players', 'Rising projection', 1, 'pre'],
  I90: ['players', 'Top projected player', 1, 'pre'], I91: ['players', 'Former player', 2, 'pre'], I92: ['players', 'Nemesis', 1, 'pre'],
  I94: ['players', 'Position edges', 1, 'pre'], I97: ['players', 'Back from injury', 1, 'pre'], I98: ['players', 'Depth chart slip', 1, 'pre'],
  I99: ['players', 'Feasts on them', 1, 'pre'], I100: ['players', 'QB duel', 1, 'pre'], I174: ['players', 'Monday decides it', 2, 'pre'],
  I175: ['players', 'Kickoff spread', 1, 'pre'], I176: ['players', 'Points in the bank', 2, 'live'], I177: ['players', 'Early kickoff', 1, 'pre'],
  I181: ['players', 'Shootout game', 1, 'pre'], I182: ['players', 'Weather watch', 1, 'pre'],
  I102: ['avail', 'Questionable starter', 2, 'pre'], I103: ['avail', 'Starter ruled out', 3, 'pre'], I104: ['avail', 'Empty slot', 3, 'pre'],
  I105: ['avail', 'Starter on bye', 3, 'pre'], I106: ['avail', 'IR in the lineup', 2, 'pre'], I107: ['avail', 'Bye crunch', 2, 'pre'],
  I108: ['avail', 'No cover', 1, 'pre'], I109: ['avail', 'Status change', 2, 'pre'], I111: ['avail', 'Thin bench', 1, 'pre'],
  I112: ['avail', 'Back to full strength', 1, 'pre'],
  I113: ['records', 'Season-high watch', 2, 'pre'], I114: ['records', 'Shootout watch', 2, 'pre'], I115: ['records', 'Streak record watch', 2, 'pre'],
  I116: ['records', 'Losing streak watch', 1, 'pre'], I117: ['records', 'All-time high watch', 2, 'pre'], I118: ['records', 'All-time shootout watch', 2, 'pre'],
  I119: ['records', 'Best start ever', 3, 'pre'], I120: ['records', 'Winning season', 1, 'pre'], I121: ['records', 'Record pace', 2, 'pre'],
  I122: ['records', 'Player record watch', 1, 'pre'], I123: ['records', 'Record at risk', 1, 'pre'], I127: ['records', 'Season-low watch', 1, 'pre'],
  I128: ['records', 'First win', 2, 'pre'], I129: ['records', 'Unbeaten', 3, 'pre'], I130: ['records', 'Points lead', 1, 'pre'],
  I132: ['proj', "ESPN's projection", 2, 'pre'], I133: ['proj', 'Closest projected', 2, 'pre'], I134: ['proj', 'Projected mismatch', 1, 'pre'],
  I135: ['proj', 'Projected upset', 1, 'pre'], I136: ['proj', 'Beating projections', 1, 'pre'], I140: ['proj', 'Projection drop', 2, 'pre'],
  I141: ['proj', 'Win chance move', 1, 'pre'], I143: ['proj', 'Upset watch', 1, 'pre'],
  I145: ['live', 'Lead changes', 2, 'live'], I146: ['live', 'Still to play', 3, 'live'], I147: ['live', 'Momentum swing', 2, 'live'],
  I148: ['live', 'Comeback on', 3, 'live'], I150: ['live', 'Live projection', 2, 'live'],
  I151: ['live', 'All but over', 1, 'live'], I152: ['live', 'Going off', 2, 'live'], I153: ['live', 'Shootout pace', 3, 'live'],
  I154: ['live', 'Record in reach', 3, 'live'], I155: ['live', 'Bust', 1, 'live'], I158: ['live', 'Biggest lead', 1, 'live'],
  I159: ['live', 'Neck and neck', 1, 'live'], I161: ['live', 'Monday night', 2, 'live'],
  I163: ['moves', 'New arrival', 2, 'pre'], I164: ['moves', 'Trade partners', 1, 'pre'], I165: ['moves', 'Old team', 2, 'pre'], I167: ['moves', 'Dropped regular', 1, 'pre'],
  I186: ['after', 'Result', 2, 'post'], I187: ['after', 'Upset of the week', 2, 'post'], I188: ['after', 'Ripple effect', 2, 'post'],
  I189: ['after', 'Clinched or eliminated', 3, 'post'], I190: ['after', 'Predictions', 1, 'post'], I191: ['after', 'Record fell', 2, 'post'],
  I192: ['after', 'Bench could have won', 2, 'post'], I194: ['after', 'Top scorer', 1, 'post'],
  I195: ['after', 'Outscored the margin', 1, 'post'], I196: ['after', 'Garbage time', 1, 'post'], I197: ['after', 'Comeback', 2, 'post'],
  I199: ['after', 'Wire to wire', 1, 'post'], I200: ['after', 'Monday finish', 1, 'post'],
  I201: ['after', 'Kickers decided it', 1, 'post'], I202: ['after', 'Against the odds', 2, 'post'], I203: ['after', 'Against projection', 1, 'post'],
  I204: ['after', 'Standings move', 2, 'post'], I205: ['after', 'Streak update', 1, 'post'], I206: ['after', 'Head to head now', 1, 'post'],
  I207: ['after', 'Bad beat', 2, 'post'], I208: ['after', 'Lucky win', 1, 'post'], I209: ['after', 'Lineup grades', 1, 'post'], I220: ['after', 'Bench star', 1, 'post'],
  I221: ['stakes', 'Clinch day', 2, 'pre'], I222: ['proj', 'Close week', 1, 'pre'], I223: ['stakes', "Week's big game", 2, 'pre'],
  I224: ['live', 'Scoring pace', 1, 'live'], I225: ['after', 'Week in review', 2, 'post'], I226: ['race', 'Everyone alive', 1, 'pre'],
  I227: ['race', 'Field set', 2, 'post'], I228: ['race', 'Season milestone', 1, 'pre'],
  // Round 8 (27 Oct): Hall of Fame's all-time records, broken after the final and within reach while the game is on.
  I229: ['after', 'All-time record fell', 3, 'post'], I231: ['live', 'All-time record in reach', 3, 'live'],
};
/* Types that predict something, judged held / broke once the game is final (D13). */
export const PREDICTS = new Set(['I1', 'I2', 'I3', 'I11', 'I12', 'I13', 'I14', 'I16', 'I19', 'I27', 'I28', 'I113', 'I114', 'I115', 'I116', 'I117',
  'I118', 'I119', 'I127', 'I128', 'I129', 'I130', 'I132', 'I133', 'I134', 'I135', 'I143', 'I146', 'I148', 'I153', 'I154', 'I161', 'I174', 'I231']);


/* Text parts: plain strings, {t: teamId}, {v: '12.40'}, {p: 'Player · POS'}. */
/** The words after a team's name, with the possessive of a name ending in s written "Vipers'" (round 8). Every
    place that puts names into a row (the page, Site API, the LLM export, the home banner) calls it. */
export const afterName = (name, str) => (typeof str === 'string' && /^'s\b/.test(str) && /s$/i.test(String(name || '')) ? `'${str.slice(2)}` : str);
const T = (id) => ({ t: id });
const V = (x) => ({ v: x });
/* A player's name with his position; a D/ST's name already says it ("Vikings D/ST"). */
export const playerLabel = (name, pos) => (pos && !String(name).endsWith(pos) ? `${name} · ${pos}` : String(name));
const P = (name, pos) => ({ p: playerLabel(name, pos) });
const pts = (x) => (Math.round(Number(x) * 100 + 1e-9) / 100).toFixed(2);
const pct = (x) => `${(Math.round(Number(x) * 1000 + 1e-6) / 10).toFixed(1)}%`;
const recOf = (s) => (s ? `${s.w}–${s.l}${s.t ? `–${s.t}` : ''}` : '0–0');
const NUM = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const num = (n) => (n >= 0 && n < NUM.length && n > 0 ? NUM[n] : String(n));
const ord = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;

/* Weight runs 1-10 (round 8, 27 Oct; was 1-5): 10 an all-time record or the title itself, 9 decides a season or a game,
   8 a season record or a game's lineup broken, 7 a headline (the least a home banner's third tier takes), 5-6 notable,
   3-4 context, 1-2 colour. A type's base is its first catalogue weight mapped onto the 1-5 scale of review 3
   (3 -> 4, 2 -> 3, 1 -> 2, the lists below a step either way), then doubled less one; a few types are set directly
   (TEN). A row's `bump` moves it a step (two points) for a large effect, `adj` a single point. A type that fires for
   every game (I132, I186, I178) stays at 5 or below, and so does a streak (I59). */
const TOP = new Set(['I1', 'I2', 'I19', 'I20', 'I103', 'I104', 'I105', 'I119', 'I129', 'I189']);
const DOWN = new Set(['I42', 'I63', 'I37', 'I133', 'I88', 'I176', 'I109', 'I107', 'I30', 'I47', 'I48', 'I49', 'I9', 'I90', 'I175', 'I228',
  'I203', 'I209', 'I194', 'I190', 'I206', 'I178', 'I222', 'I226']);
const TEN = {
  I20: 10, I229: 10, I231: 8, I191: 8, I103: 8, I104: 8, I105: 8, I117: 6, I118: 6,
  I187: 6, I197: 6,
  // Spread so that a game's rows before kickoff do not all sit on 5: what fires for nearly every game a point lower,
  // what moves the race or chases a record a point higher.
  I41: 4, I79: 4, I80: 4, I163: 4, I102: 4, I27: 6, I28: 6, I115: 6, I129: 7,
};
/* The rules' version: raise it with any change to what a row says or weighs, so played weeks are rebuilt once with it. */
export const RULES_VERSION = 10;
export const WEIGHT_MAX = 10;
export const BANNER_MIN = 7;
const CAP = new Set(['I132', 'I186', 'I178', 'I59']);
export const CAP_WEIGHT = 5;
export const baseWeight = (type) => {
  if (TEN[type] != null) return TEN[type];
  const old = TYPES[type][2];
  const w5 = old === 3 ? (TOP.has(type) ? 5 : 4) : old === 2 ? (DOWN.has(type) ? 2 : 3) : (DOWN.has(type) ? 1 : 2);
  return 2 * w5 - 1;
};
/** A row stored on the 1-5 scale (before round 8) on the 1-10 scale: doubled less one, or the type's own set weight. */
export function rescaleRow(r) {
  if (!r || !TYPES[r.type]) return r;
  let weight = TEN[r.type] != null ? TEN[r.type] : Math.max(1, Math.min(WEIGHT_MAX, 2 * r.weight - 1));
  if (CAP.has(r.type)) weight = Math.min(CAP_WEIGHT, weight);
  return { ...r, weight, label: TYPES[r.type][1] };
}
function row(type, o) {
  const [cat, label, , when] = TYPES[type];
  let weight = Math.max(1, Math.min(WEIGHT_MAX, baseWeight(type) + 2 * (o.bump || 0) + (o.adj || 0)));
  if (CAP.has(type)) weight = Math.min(CAP_WEIGHT, weight);
  return { type, cat, label, weight, when: o.when || when, teams: o.teams || [],
    about: o.about || 'matchup', parts: o.parts, predict: PREDICTS.has(type) ? (o.predict || null) : null, outcome: null };
}

/* ------------------------------------------------------------------ the week's facts */
function standingsMap(part) {
  const m = {};
  for (const s of (part && part.standings) || []) m[s.team] = s;
  return m;
}
const record = (part, id) => (part ? (part.records || []).find((r) => r.id === id) : null);

/* Seeds after a set of results, by wins then points for (this league's rule). */
function seedsWith(S, wins, pfAdd) {
  const ids = Object.keys(S).map(Number);
  return ids.map((id) => ({ id, w: S[id].w + (wins[id] || 0), pf: S[id].pf + (pfAdd[id] || 0) }))
    .sort((a, b) => b.w - a.w || b.pf - a.pf).map((x, i) => [x.id, i + 1]);
}

/* ------------------------------------------------------------------ Pre rows: standings, rivalry, form, records */
export function preRows(M, week, fx, opts = {}) {
  const before = M.partBefore(week);
  const S = standingsMap(before);
  const out = [];
  const h = fx.home, a = fx.away;
  const sh = S[h], sa = S[a];
  const gp = sh ? sh.w + sh.l + sh.t : 0;
  const left = M.regWeeks - (week - 1);
  const reg = week <= M.regWeeks;

  if (sh && sa && reg && gp >= 2) {
    const pair = [sh, sa].sort((x, y) => x.seed - y.seed);
    if (pair[0].seed === 1 && pair[1].seed === 2) out.push(row('I24', { teams: [pair[0].team, pair[1].team], parts: ['First plays second: ', T(pair[0].team), ` (${recOf(pair[0])}) against `, T(pair[1].team), ` (${recOf(pair[1])}).`] }));
    if (pair[0].seed === M.places && pair[1].seed === M.places + 1) out.push(row('I25', { teams: [pair[0].team, pair[1].team],
      parts: ['A bubble game: ', T(pair[0].team), `, ${ord(M.places)} and the last playoff place, plays `, T(pair[1].team), `, ${ord(M.places + 1)}.`] }));
    else {
      const cut = Object.values(S).find((s) => s.seed === M.places);
      const near = (s) => Math.abs(s.w - cut.w) <= 1;
      if (gp >= 4 && near(sh) && near(sa) && Math.max(sh.seed, sa.seed) <= M.places + 3) out.push(row('I26', { teams: [h, a],
        parts: ['Both teams are within a game of the playoff line: ', T(h), ` ${ord(sh.seed)}, `, T(a), ` ${ord(sa.seed)}.`] }));
    }
    if (pair[0].seed >= Object.keys(S).length - 1) out.push(row('I34', { teams: [pair[0].team, pair[1].team], parts: ['The bottom of the table: ', T(pair[0].team), ` (${ord(pair[0].seed)}) plays `, T(pair[1].team), ` (${ord(pair[1].seed)}).`] }));
    // Into or out of a playoff place if today's other results hold (no other game moves). These, the tiebreak and
    // the rise-or-fall rows seed by wins then points for, so they run only in a league that seeds that way.
    if (gp >= 3 && M.seedByPoints !== false) {
      for (const [w, l] of [[h, a], [a, h]]) {
        const seeds = Object.fromEntries(seedsWith(S, { [w]: 1 }, {}));
        if (S[w].seed > M.places && seeds[w] <= M.places) out.push(row('I27', { teams: [w], about: 'team',
          parts: ['A win would lift ', T(w), ` into a playoff place (${ord(seeds[w])}) as things stand.`],
          predict: { kind: 'into', team: w } }));
        if (S[l].seed <= M.places && seeds[l] > M.places) out.push(row('I28', { teams: [l], about: 'team',
          parts: ['A loss would drop ', T(l), ` out of a playoff place (${ord(seeds[l])}) as things stand.`],
          predict: { kind: 'out', team: l } }));
      }
    }
    // Tiebreak watch: level on record with the team next to it, near the line.
    for (const s of (M.seedByPoints !== false ? [sh, sa] : [])) {
      const nb = Object.values(S).filter((o) => o.team !== s.team && o.w === s.w && o.l === s.l && Math.abs(o.seed - s.seed) === 1);
      for (const o of nb) {
        if (Math.min(s.seed, o.seed) <= M.places && Math.max(s.seed, o.seed) >= M.places - 1 && gp >= 4) {
          const ahead = s.pf >= o.pf ? s : o, behind = ahead === s ? o : s;
          out.push(row('I29', { teams: [s.team, o.team], about: 'team',
            parts: [T(s.team), ' and ', T(o.team), ` are level at ${recOf(s)}; `, T(ahead.team), ' is ahead on points by ', V(pts(ahead.pf - behind.pf)), ', so every point counts here, win or lose.'] }));
        }
      }
    }
    const cut = Object.values(S).find((s) => s.seed === M.places);
    for (const s of [sh, sa]) {
      const gb = cut.w - s.w;
      if (s.seed > M.places && gb >= 2 && gb <= left && left <= 7) out.push(row('I30', { teams: [s.team], about: 'team',
        parts: [T(s.team), ` is ${num(gb)} games out of a playoff place with ${num(left)} to play.`] }));
      if (s.seed <= M.places && left <= 6) {
        const chaser = Object.values(S).find((o) => o.seed === M.places + 1);
        const magic = chaser.w + left - s.w + 1;
        if (magic >= 1 && magic <= left) out.push(row('I31', { teams: [s.team], about: 'team',
          parts: [T(s.team), "'s magic number is ", V(String(magic)), `: any ${num(magic)} of its wins and `, T(chaser.team), "'s losses guarantee a playoff place (before the points tiebreak)."] }));
      }
    }
    // Rise or fall: every result of the week's other games.
    if (gp >= 3 && M.seedByPoints !== false) {
      const others = M.fixtures.filter((f) => f.week === week && f.id !== fx.id);
      let best = { [h]: 99, [a]: 99 }, worst = { [h]: 0, [a]: 0 };
      for (const winner of [h, a]) {
        for (let mask = 0; mask < (1 << others.length); mask++) {
          const wins = { [winner]: 1 };
          others.forEach((f, i) => { const x = mask & (1 << i) ? f.home : f.away; wins[x] = (wins[x] || 0) + 1; });
          const seeds = Object.fromEntries(seedsWith(S, wins, {}));
          const loser = winner === h ? a : h;
          best[winner] = Math.min(best[winner], seeds[winner]);
          worst[loser] = Math.max(worst[loser], seeds[loser]);
        }
      }
      const up = [h, a].map((id) => S[id].seed - best[id]).reduce((x, y) => Math.max(x, y), 0);
      if (up >= 2 || worst[h] - S[h].seed >= 2 || worst[a] - S[a].seed >= 2) out.push(row('I33', { teams: [h, a],
        parts: ['Rise or fall: a win could lift ', T(h), ` as high as ${ord(best[h])} and `, T(a), ` as high as ${ord(best[a])}; a loss could drop them to ${ord(worst[h])} and ${ord(worst[a])}.`] }));
    }
    // Top four all season, from every "after week N" part.
    for (const s of [sh, sa]) {
      let all = week - 1 >= 4;
      for (let w = 1; w < week && all; w++) { const st = standingsMap(M.ss[`w${w}`])[s.team]; if (!st || st.seed > M.places) all = false; }
      if (all) out.push(row('I35', { teams: [s.team], about: 'team', parts: [T(s.team), ` has not been outside the top ${num(M.places)} all season.`] }));
    }
    // ESPN's playoff odds as recorded after last week.
    const ow = M.oddsWeeks[String(week - 1)], ow0 = M.oddsWeeks[String(week - 2)];
    if (ow && ow[h] != null && ow[a] != null) {
      const ch = (id) => (ow0 && ow0[id] != null ? ow[id] - ow0[id] : null);
      const moved = [h, a].map(ch).filter((x) => x != null).reduce((m, x) => Math.max(m, Math.abs(x)), 0);
      const mid = [h, a].some((id) => ow[id] > 0.1 && ow[id] < 0.9);
      if (mid) {
        const part = (id) => { const c = ch(id); return [T(id), ` ${pct(ow[id])}`, c != null && Math.abs(c) >= 0.05 ? ` (${c > 0 ? 'up' : 'down'} ${(Math.abs(c) * 100).toFixed(1)} points since last week)` : '']; };
        out.push(row('I37', { teams: [h, a], parts: ["ESPN's playoff odds: ", ...part(h), ', ', ...part(a), '.'] }));
      }
    }
    if ([sh.powerRank, sa.powerRank].sort().join() === '1,2') out.push(row('I38', { teams: [h, a], parts: ['The power ranking’s top two meet: ', T(sh.powerRank === 1 ? h : a), ' is 1st, ', T(sh.powerRank === 1 ? a : h), ' 2nd.'] }));
  }

  // ---------------------------------------------------------------- rivalry
  const past = M.h2h(h, a).filter((g) => g.season < M.season || g.week < week);
  const wl = (id, other) => past.reduce((acc, g) => { const d = g[id] - g[other]; if (d > 0) acc.w++; else if (d < 0) acc.l++; else acc.t++; return acc; }, { w: 0, l: 0, t: 0 });
  if (!past.length) out.push(row('I57', { teams: [h, a], parts: ['A first meeting: ', T(h), ' and ', T(a), ' have never played each other.'] }));
  else {
    const rh = wl(h, a);
    if (past.length >= 3) {
      const lead = rh.w === rh.l ? null : rh.w > rh.l ? h : a;
      const lr = lead === h ? rh : { w: rh.l, l: rh.w, t: rh.t };
      out.push(row('I41', { teams: [h, a],
        parts: lead ? ['All-time head to head: ', T(lead), ` leads ${lr.w}–${lr.l}${lr.t ? `–${lr.t}` : ''}.`] : [`All-time head to head: level at ${rh.w}–${rh.l}.`] }));
    }
    const last = past[past.length - 1];
    const lw = last[h] > last[a] ? h : a, ll = lw === h ? a : h;
    out.push(row('I42', { teams: [lw, ll], parts: [`Last meeting (${last.season === M.season ? `week ${last.week} this season` : `${last.season} week ${last.week}`}${last.round ? `, ${last.round.toLowerCase()}` : ''}): `, T(lw), ' won by ', V(pts(Math.abs(last[h] - last[a]))), '.'] }));
    const thisSeason = past.filter((g) => g.season === M.season);
    if (thisSeason.length) {
      const g = thisSeason[thisSeason.length - 1];
      const loser = g[h] < g[a] ? h : a;
      out.push(row('I43', { teams: [loser], about: 'team', parts: ['Revenge game: ', T(loser), ` lost the first meeting this season, in week ${g.week}.`] }));
    }
    let run = 0, runner = null;
    for (let i = past.length - 1; i >= 0; i--) { const w = past[i][h] > past[i][a] ? h : past[i][a] > past[i][h] ? a : 0; if (runner == null) runner = w; if (w !== runner || !w) break; run++; }
    if (run >= 3) out.push(row('I45', { teams: [runner], about: 'team', parts: [T(runner), ` has won the last ${num(run)} meetings.`] }));
    for (const [x, y] of [[h, a], [a, h]]) { const r = wl(x, y); if (past.length >= 3 && r.w === 0 && !r.t) out.push(row('I46', { teams: [x, y], about: 'team', parts: [T(x), ' has never beaten ', T(y), ` (0–${r.l}).`] })); }
    // Per scoring period, as Hall of Fame counts games: a two-week postseason matchup is two weeks here.
    const meets = past.flatMap((g) => (g.periods || [{ period: g.week, [h]: g[h], [a]: g[a] }]).map((p) => ({ season: g.season, week: p.period, [h]: p[h], [a]: p[a] })));
    if (past.length >= 2) {
      const comb = [...meets].sort((x, y) => (y[h] + y[a]) - (x[h] + x[a]))[0];
      out.push(row('I47', { teams: [h, a], parts: ["The rivalry's highest-scoring meeting: ", V(pts(comb[h] + comb[a])), ` combined, ${comb.season} week ${comb.week}.`] }));
      const close = [...meets].sort((x, y) => Math.abs(x[h] - x[a]) - Math.abs(y[h] - y[a]))[0];
      if (Math.abs(close[h] - close[a]) < 10) out.push(row('I48', { teams: [h, a], parts: ["The rivalry's closest meeting: ", V(pts(Math.abs(close[h] - close[a]))), ` in ${close.season} week ${close.week}.`] }));
      const blow = [...meets].sort((x, y) => Math.abs(y[h] - y[a]) - Math.abs(x[h] - x[a]))[0];
      const bw = blow[h] > blow[a] ? h : a;
      if (Math.abs(blow[h] - blow[a]) >= 30) out.push(row('I49', { teams: [bw], parts: ["The rivalry's biggest blowout: ", T(bw), ' by ', V(pts(Math.abs(blow[h] - blow[a]))), `, ${blow.season} week ${blow.week}.`] }));
    }
    const posts = past.filter((g) => g.post);
    if (posts.length) {
      const g = posts[posts.length - 1], w = g[h] > g[a] ? h : a;
      out.push(row('I51', { teams: [h, a], parts: [`They have met in the postseason${posts.length > 1 ? ` ${num(posts.length)} times` : ''}: most recently the ${g.season} ${(g.round || 'postseason').toLowerCase()}, won by `, T(w), '.'] }));
      const finals = posts.filter((x) => x.round === 'Championship');
      if (finals.length) { const f = finals[finals.length - 1]; out.push(row('I52', { teams: [h, a], parts: [`A rematch of the ${f.season} championship game, won by `, T(f[h] > f[a] ? h : a), '.'] })); }
    }
    // Favourite opponent: a team's best record against anyone (3+ meetings), and dominant.
    for (const [x, y] of [[h, a], [a, h]]) {
      const r = wl(x, y);
      if (past.length < 3 || r.w / past.length < 0.75) continue;
      let bestOther = 0;
      for (const o of M.ids) { if (o === x || o === y) continue; const g = M.h2h(x, o).filter((m) => m.season < M.season || m.week < week); if (g.length < 3) continue; const ww = g.filter((m) => m[x] > m[o]).length / g.length; bestOther = Math.max(bestOther, ww); }
      if (r.w / past.length > bestOther) out.push(row('I56', { teams: [x, y], about: 'team', parts: [T(x), ' does better against ', T(y), ` than against any other opponent (${r.w}–${r.l}${r.t ? `–${r.t}` : ''}).`] }));
    }
  }
  const champ = (M.champions || []).filter((c) => !c.placeholder && c.teamId).sort((x, y) => y.year - x.year)[0];
  if (champ && (champ.teamId === h || champ.teamId === a)) out.push(row('I53', { teams: [champ.teamId], about: 'team', parts: ['The defending champion plays here: ', T(champ.teamId), ` won the ${champ.year} title.`] }));

  // ---------------------------------------------------------------- form
  if (sh && sa) {
    const st = [sh, sa].filter((s) => s.streak && s.streak.n >= 3 && !(s.streak.type === 'L' && s.w === 0));
    if (st.length) out.push(row('I59', { teams: st.map((s) => s.team), about: 'team', bump: st.some((s) => s.streak.n >= 5) ? 1 : 0,
      parts: st.flatMap((s, i) => [i ? '; ' : '', T(s.team), s.streak.type === 'W' ? ` has won ${num(s.streak.n)} in a row` : ` has lost ${num(s.streak.n)} straight`]).concat('.') }));
    const luck = [sh, sa].filter((s) => Math.abs(s.luck) >= 1);
    if (luck.length && gp >= 4) {
      const parts = ['All-play: '];
      [sh, sa].forEach((s, i) => parts.push(i ? ', ' : '', T(s.team), ` ${s.allPlay.w}–${s.allPlay.l}`));
      const l = luck.sort((x, y) => Math.abs(y.luck) - Math.abs(x.luck))[0];
      parts.push('; by all-play ', T(l.team), l.luck < 0 ? ` deserves better than its ${recOf(l)} record.` : ` has done better than its scores deserve (${recOf(l)}).`);
      out.push(row('I63', { teams: [h, a], parts }));
    }
  }
  const tws = (id, n) => { const o = []; for (let w = week - 1; w >= 1 && o.length < n; w--) { const tw = M.teamWeeks[`${id}:${w}`]; if (tw) o.push(tw); } return o; };
  if (week - 1 >= 4) {
    const avg3 = (id) => tws(id, 3).reduce((x, t) => x + t.pts, 0) / 3;
    const avgAll = (id) => { const all = tws(id, 99); return all.reduce((x, t) => x + t.pts, 0) / all.length; };
    const all3 = M.ids.map((id) => [id, avg3(id)]).sort((x, y) => y[1] - x[1]);
    for (const id of [h, a]) {
      const d = avg3(id) - avgAll(id);
      if (d >= 12) out.push(row('I60', { teams: [id], about: 'team', parts: ['Hot streak: ', T(id), ' has scored ', V(pts(d)), ' a week above its season average over the last three weeks.'] }));
    }
    if ([h, a].includes(all3[0][0])) out.push(row('I61', { teams: [all3[0][0]], about: 'team', parts: [T(all3[0][0]), ' is the hottest team in the league over the last three weeks: ', V(pts(all3[0][1])), ' a week.'] }));
    const cold = all3[all3.length - 1];
    if ([h, a].includes(cold[0])) out.push(row('I62', { teams: [cold[0]], about: 'team', parts: [T(cold[0]), ' is the coldest team in the league over the last three weeks: ', V(pts(cold[1])), ' a week.'] }));
    for (const id of [h, a]) {
      const close = M.settled.filter((f) => f.week < week && (f.home === id || f.away === id) && Math.abs(f.hp - f.ap) < 10);
      const won = close.filter((f) => f.winner === id).length;
      if (close.length >= 3 && (won === close.length || won === 0)) out.push(row('I72', { teams: [id], about: 'team', parts: ['Close games: ', T(id), ` is ${won}–${close.length - won} in games decided by under 10 points.`] }));
    }
  }
  if (sh && sa && gp >= 4) {
    const half = Object.keys(S).length / 2;
    for (const [x, y] of [[h, a], [a, h]]) {
      if (S[y].seed > half) continue;
      const games = M.settled.filter((f) => f.week < week && (f.home === x || f.away === x));
      const vsTop = games.filter((f) => { const o = f.home === x ? f.away : f.home; return S[o] && S[o].seed <= half; });
      const w = vsTop.filter((f) => f.winner === x).length;
      if (vsTop.length >= 3 && (w === vsTop.length || w === 0)) out.push(row('I74', { teams: [x], about: 'team', parts: ['Against the top half: ', T(x), ` is ${w}–${vsTop.length - w} this season.`] }));
    }
  }

  // ---------------------------------------------------------------- records (standings-based; projection-based ones live in lineupRows)
  if (sh && sa) {
    const rs = record(before, 'S11.win'), rl = record(before, 'S11.loss');
    for (const s of [sh, sa]) {
      if (s.streak && s.streak.type === 'W' && rs && rs.entries[0] && s.streak.n + 1 >= rs.entries[0].value) out.push(row('I115', { teams: [s.team], about: 'team',
        parts: ['A win would extend ', T(s.team), `'s winning streak to ${num(s.streak.n + 1)}, ${s.streak.n + 1 > rs.entries[0].value ? 'the longest this season' : 'level with the season’s longest'}.`], predict: { kind: 'win', team: s.team } }));
      if (s.streak && s.streak.type === 'L' && rl && rl.entries[0] && s.streak.n + 1 >= rl.entries[0].value) out.push(row('I116', { teams: [s.team], about: 'team',
        parts: ['A loss would give ', T(s.team), ` ${num(s.streak.n + 1)} straight, ${s.streak.n + 1 > rl.entries[0].value ? 'the longest losing streak' : 'level with the longest losing streak'} this season.`], predict: { kind: 'loss', team: s.team } }));
      if (s.w === 0 && gp >= 3) out.push(row('I128', { teams: [s.team], about: 'team', parts: [T(s.team), ` is still looking for its first win (${recOf(s)}).`], predict: { kind: 'win', team: s.team } }));
      if (s.l === 0 && !s.t && gp >= 3) out.push(row('I129', { teams: [s.team], about: 'team', parts: [T(s.team), `'s unbeaten record is on the line (${recOf(s)}).`], predict: { kind: 'win', team: s.team } }));
    }
    const pfTop = Object.values(S).sort((x, y) => y.pf - x.pf);
    if ([h, a].includes(pfTop[0].team) && [h, a].includes(pfTop[1].team)) out.push(row('I130', { teams: [pfTop[0].team, pfTop[1].team],
      parts: ['The league’s top two in points for meet: ', T(pfTop[0].team), ' leads ', T(pfTop[1].team), ' by ', V(pts(pfTop[0].pf - pfTop[1].pf)), '.'], predict: { kind: 'pfLead', team: pfTop[0].team } }));
    // Best start in league history (S110): would a win beat every start through the same number of games?
    const bestPast = bestStart(M, gp + 1);
    for (const s of [sh, sa]) if (gp >= 3 && s.w + 1 > bestPast) out.push(row('I119', { teams: [s.team], about: 'team',
      parts: ['A win gives ', T(s.team), ` the best start in league history: ${s.w + 1}–${s.l} through ${num(gp + 1)} games.`], predict: { kind: 'win', team: s.team } }));
  }
  return out;
}

/* The most wins any team has had through n games, in any past season (Hall of Fame's seasons). */
function bestStart(M, n) {
  let best = 0;
  for (const yr of Object.keys(M.past || {})) {
    const games = M.past[yr];
    for (const id of new Set(games.flatMap((g) => [g.home, g.away]))) {
      const mine = games.filter((g) => g.home === id || g.away === id).sort((x, y) => x.week - y.week).slice(0, n);
      if (mine.length === n) best = Math.max(best, mine.filter((g) => g.winner === id).length);
    }
  }
  return best;
}

/* ------------------------------------------------------------------ Pre rows from this week's lineups (current week only, D25) */
export function lineupRows(M, game, opts = {}) {
  const out = [];
  const week = M.now.week;
  const before = M.partBefore(week);
  const S = standingsMap(before);
  const H = game.sides.home, A = game.sides.away;
  const h = H.team, a = A.team;
  const side = { [h]: H, [a]: A };
  const other = (id) => (id === h ? a : h);
  const name = (p) => P(p.name, p.pos);
  const unplayed = (p) => p.gameStatus === 'pre';
  const isOut = (p) => p.injury === 'OUT' && unplayed(p);
  const posOf = (p) => (p.pos === 'D/ST' ? 'D/ST' : p.pos);
  const capture = Date.parse(M.capturedAt);
  const all = M.now.games.flatMap((g) => [g.sides.home, g.sides.away]);

  // ESPN's projection (every game, so never above weight 2).
  const fav = H.projected >= A.projected ? h : a, dog = other(fav);
  const margin = Math.abs(H.projected - A.projected);
  out.push(row('I132', { teams: [fav, dog], parts: ['ESPN projects ', T(fav), ' by ', V(pts(margin)), `; win chance ${Math.round(side[fav].winProb)}%.`], predict: { kind: 'win', team: fav } }));
  if (S[fav] && S[dog] && S[fav].w < S[dog].w) out.push(row('I135', { teams: [fav, dog], parts: ['ESPN projects ', T(fav), ` (${recOf(S[fav])}) to beat `, T(dog), ` (${recOf(S[dog])}) despite the worse record.`], predict: { kind: 'win', team: fav } }));
  const margins = M.now.games.map((g) => [g.id, Math.abs(g.sides.home.projected - g.sides.away.projected)]).sort((x, y) => x[1] - y[1]);
  if (margins[0][0] === game.id) out.push(row('I133', { teams: [h, a], parts: ['The closest projected game of the week: ', V(pts(margin)), ' between them.'] }));
  if (margins[margins.length - 1][0] === game.id) out.push(row('I134', { teams: [fav, dog], parts: ["The week's biggest projected mismatch: ", T(fav), ' by ', V(pts(margin)), '.'] }));
  const s53 = record(before, 'S53');
  if (s53 && s53.entries[0] && margin > s53.entries[0].value) out.push(row('I143', { teams: [dog, fav],
    parts: ['A win for ', T(dog), ' would be the season’s biggest upset by projection (the record is ', V(pts(s53.entries[0].value)), ').'], predict: { kind: 'win', team: dog } }));
  // Beating projections, from the box scores.
  for (const id of [h, a]) {
    let n = 0;
    for (let w = week - 1; w >= 1; w--) { const tw = M.teamWeeks[`${id}:${w}`]; if (!tw || tw.pts <= tw.proj) break; n++; }
    if (n >= 3) out.push(row('I136', { teams: [id], about: 'team', parts: [T(id), ` has beaten its projection ${num(n)} weeks running.`] }));
  }

  // Records within reach (Season Statistics' current holders, Hall of Fame's book).
  const hi = record(before, 'S21.high'), lo = record(before, 'S21.low'), comb = record(before, 'S26');
  for (const id of [h, a]) {
    const p = side[id].projected;
    if (hi && hi.entries[0] && p >= hi.entries[0].value - 15) out.push(row('I113', { teams: [id], about: 'team', bump: p >= hi.entries[0].value ? 1 : 0,
      parts: [T(id), ' is projected for ', V(pts(p)), '; ', V(pts(hi.entries[0].value + 0.01)), ' would set the season’s highest weekly score.'], predict: { kind: 'score>=', team: id, value: hi.entries[0].value + 0.01 } }));
    if (lo && lo.entries[0] && p <= lo.entries[0].value + 15) out.push(row('I127', { teams: [id], about: 'team',
      parts: [T(id), ' is projected for ', V(pts(p)), '; under ', V(pts(lo.entries[0].value)), ' would be the season’s lowest weekly score.'], predict: { kind: 'score<', team: id, value: lo.entries[0].value } }));
    const hofHi = (M.hof.records.highestSingleGame || [])[0];
    if (hofHi && p >= hofHi.points - 30) out.push(row('I117', { teams: [id], about: 'team', parts: [T(id), ' needs ', V(pts(hofHi.points + 0.01)), ' for the league’s all-time single-game record.'], predict: { kind: 'score>=', team: id, value: hofHi.points + 0.01 } }));
  }
  if (comb && comb.entries[0] && H.projected + A.projected >= comb.entries[0].value - 25) out.push(row('I114', { teams: [h, a],
    parts: ['Projected for ', V(pts(H.projected + A.projected)), ' combined; ', V(pts(comb.entries[0].value + 0.01)), ' would be the season’s highest-scoring matchup.'], predict: { kind: 'combined>=', value: comb.entries[0].value + 0.01 } }));
  const s71 = record(before, 'S71'), s70 = record(before, 'S70'), s86 = record(before, 'S86');

  // A lineup problem days before kickoff is a reminder; within a day of the team's first kickoff it is urgent
  // (round 8: on a Tuesday last week's lineups still stand, and every team had a starter on bye).
  const DAY = 24 * 3600e3;
  const firstKick = (sd) => sd.starters.map((p) => p.kickoff).filter(Boolean).sort()[0] || null;
  const notYet = (iso) => Boolean(iso) && Date.parse(iso) - capture > DAY;
  for (const id of [h, a]) {
    const sd = side[id], opp = side[other(id)];
    const st = sd.starters.filter((p) => p.id != null);
    const later = notYet(firstKick(sd)) ? -1 : 0;
    // Availability.
    for (const p of st) {
      if ((p.injury === 'QUESTIONABLE' || p.injury === 'DOUBTFUL') && unplayed(p)) out.push(row('I102', { teams: [id], about: 'player', parts: [T(id), ' starts ', name(p), `, listed ${p.injury === 'DOUBTFUL' ? 'Doubtful' : 'Questionable'}.`] }));
      if (isOut(p)) out.push(row('I103', { teams: [id], about: 'player', bump: notYet(p.kickoff) ? -1 : 0, parts: [T(id), ' starts ', name(p), ', who is listed Out.'] }));
      if (p.injury === 'INJURY_RESERVE') out.push(row('I106', { teams: [id], about: 'player', parts: [T(id), ' has ', name(p), ', on injured reserve, in its starting lineup.'] }));
      if (M.byes.byes && M.byes.byes[p.nfl] === week) out.push(row('I105', { teams: [id], about: 'player', bump: later, parts: [T(id), ' starts ', name(p), ', whose team is on bye.'] }));
      const inj = M.injuries[String(p.id)];
      if (inj && p.injury && unplayed(p) && capture - Date.parse(inj.date) < 36 * 3600e3) out.push(row('I109', { teams: [id], about: 'player', parts: ['Status change: ', name(p), ` was listed ${inj.status.charAt(0) + inj.status.slice(1).toLowerCase().replace('_', ' ')} on `, { d: inj.date }, '.'] }));
    }
    const slots = M.startSlots.reduce((x, [, n]) => x + n, 0);
    const empty = slots - st.length;
    if (empty > 0) out.push(row('I104', { teams: [id], about: 'team', bump: later, parts: [T(id), ` has ${empty === 1 ? 'an empty starting slot' : `${num(empty)} empty starting slots`}.`] }));
    // Bye crunch: regular starters (3 of the last 4 weeks) whose team is off this week.
    const reg = {};
    for (let w = week - 1; w >= Math.max(1, week - 4); w--) { const tw = M.teamWeeks[`${id}:${w}`]; for (const p of (tw ? tw.starters : [])) reg[p.pid] = (reg[p.pid] || 0) + 1; }
    const onBye = [...sd.starters, ...sd.bench].filter((p) => reg[p.id] >= 3 && M.byes.byes && M.byes.byes[p.nfl] === week);
    if (onBye.length >= 2) out.push(row('I107', { teams: [id], about: 'team', parts: ['Bye crunch: ', T(id), ` has ${num(onBye.length)} regular starters on bye this week.`] }));
    const healthyBench = (pos) => sd.bench.filter((p) => p.pos === pos && !['OUT', 'INJURY_RESERVE', 'DOUBTFUL'].includes(p.injury)).length;
    for (const p of st) if ((p.injury === 'QUESTIONABLE' || p.injury === 'DOUBTFUL') && unplayed(p) && healthyBench(p.pos) === 0 && Date.parse(p.kickoff) - Date.parse(sd.starters.reduce((m, x) => (x.kickoff && x.kickoff < m ? x.kickoff : m), '9999')) > 3 * 3600e3)
      out.push(row('I108', { teams: [id], about: 'player', parts: [name(p), ' is questionable for a late kickoff and ', T(id), ` has no healthy ${p.pos} on the bench to cover.`] }));
    for (const pos of ['RB', 'WR']) if (st.filter((p) => p.pos === pos).length >= 2 && healthyBench(pos) === 0) out.push(row('I111', { teams: [id], about: 'team', parts: [T(id), ` has no healthy ${pos} on its bench.`] }));
    // Players and lineups.
    if (s70 && s70.entries[0] && st.some((p) => p.id === s70.entries[0].pid)) out.push(row('I77', { teams: [id], about: 'player', parts: [T(id), ' starts the league’s top scorer, ', P(s70.entries[0].player.name, s70.entries[0].player.pos), ' (', V(pts(s70.entries[0].value)), ').'] }));
    for (const p of st) {
      const tp = record(before, `S70.${p.pos}`);
      if (tp && tp.entries[0] && tp.entries[0].pid === p.id && !(s70 && s70.entries[0] && s70.entries[0].pid === p.id)) out.push(row('I78', { teams: [id], about: 'player', parts: [T(id), ' starts the top-scoring ', p.pos, ' in the league this season, ', name(p), ' (', V(pts(tp.entries[0].value)), ').'] }));
      const o = M.nfl[p.nfl];
      const pr = o && M.posr[posOf(p)] && M.posr[posOf(p)][o.opp];
      if (pr && unplayed(p) && p.pos !== 'D/ST' && p.pos !== 'K' && pr.rank >= 30) out.push(row('I79', { teams: [id], about: 'player',
        parts: [name(p), ' faces ', `${o.opp}, the defence that gives up the ${pr.rank === 32 ? 'most' : `${ord(33 - pr.rank)}-most`} points to ${p.pos}s in this league’s scoring (`, V(pts(pr.avg)), ' a game).'] }));
      if (pr && unplayed(p) && p.pos !== 'D/ST' && p.pos !== 'K' && pr.rank <= 2) out.push(row('I80', { teams: [id], about: 'player',
        parts: [name(p), ' faces ', `${o.opp}, the ${pr.rank === 1 ? 'stingiest' : '2nd-stingiest'} defence against ${p.pos}s (`, V(pts(pr.avg)), ' a game).'] }));
      if (pr && unplayed(p) && p.pos === 'D/ST' && pr.rank >= 30) out.push(row('I81', { teams: [id], about: 'player',
        parts: [name(p), ` plays ${o.opp}, the offence that gives up the ${pr.rank === 32 ? 'most' : `${ord(33 - pr.rank)}-most`} D/ST points (`, V(pts(pr.avg)), ' a game).'] }));
    }
    const qb = st.find((p) => p.pos === 'QB');
    if (qb) {
      const mates = st.filter((p) => p !== qb && p.nfl === qb.nfl && (p.pos === 'WR' || p.pos === 'TE'));
      if (mates.length) out.push(row('I82', { teams: [id], about: 'team', parts: ['A stack: ', T(id), ' starts ', name(qb), ' with ', ...mates.flatMap((m, i) => [i ? ' and ' : '', name(m)]), ` (${qb.nfl}).`] }));
      const oq = opp.starters.find((p) => p.pos === 'QB');
      if (id === h && oq && M.nfl[qb.nfl] && M.nfl[qb.nfl].opp === oq.nfl) out.push(row('I100', { teams: [h, a], about: 'player', parts: ['QB duel: ', name(qb), ' and ', name(oq), ` meet in ${M.nfl[qb.nfl].key}.`] }));
      const big = Object.values(M.nfl).filter((g) => g.overUnder).sort((x, y) => y.overUnder - x.overUnder)[0];
      if (big && unplayed(qb) && (qb.nfl === big.home || qb.nfl === big.away)) out.push(row('I181', { teams: [id], about: 'player', parts: [name(qb), ` plays in the week's highest over/under game, ${big.key} (`, V(String(big.overUnder)), ').'] }));
    }
    const dst = opp.starters.find((p) => p.pos === 'D/ST');
    if (dst) for (const p of st.filter((x) => ['QB', 'RB', 'WR', 'TE'].includes(x.pos))) {
      if (M.nfl[p.nfl] && M.nfl[p.nfl].opp === dst.nfl && unplayed(p)) out.push(row('I83', { teams: [id, other(id)], about: 'player', parts: ['Facing each other: ', T(id), "'s ", name(p), ' plays against ', T(other(id)), "'s ", name(dst), '.'] }));
    }
    // Player form from the box scores.
    for (const p of st) {
      const pw = M.playerWeeks[p.id];
      if (!pw) continue;
      const recent = [week - 1, week - 2, week - 3].map((w) => pw.weeks[w]).filter(Boolean);
      if (recent.length === 3 && recent.every((x) => x.pts >= 20)) out.push(row('I85', { teams: [id], about: 'player', parts: ['Hot hand: ', name(p), ' has scored 20 or more in three straight weeks.'] }));
      if (recent.length === 3 && recent.every((x) => x.proj > 0 && x.pts < x.proj) && p.proj >= 8) out.push(row('I86', { teams: [id], about: 'player', parts: ['Cold spell: ', name(p), ' has missed his projection three weeks running.'] }));
      const last = pw.weeks[week - 1];
      if (last && last.proj >= 5 && p.proj >= 10 && p.proj >= last.proj * 1.3) out.push(row('I89', { teams: [id], about: 'player', parts: ['Rising projection: ', name(p), ' is projected for ', V(pts(p.proj)), `, up ${Math.round((p.proj / last.proj - 1) * 100)}% on last week.`] }));
      const wks = Object.entries(pw.weeks).map(([w, x]) => ({ w: Number(w), ...x })).filter((x) => x.slot !== 20 && x.slot !== 21 && x.w < week);
      if (wks.length >= 3) { const best = wks.sort((x, y) => y.pts - x.pts)[0]; if (best.opp === other(id) && best.pts >= 15) out.push(row('I99', { teams: [id, other(id)], about: 'player', parts: [name(p), ` had his best week of the season against `, T(other(id)), ': ', V(pts(best.pts)), ` in week ${best.w}.`] })); }
      // Former player: on the other team's roster earlier this season.
      const held = M.heldBy[p.id] || {};
      const before = Object.entries(held).filter(([w, t]) => Number(w) < week && t === other(id));
      if (before.length) out.push(row('I91', { teams: [id, other(id)], about: 'player', parts: ['Former player: ', T(id), ' starts ', name(p), `, who was on `, T(other(id)), `'s roster until week ${Math.max(...before.map(([w]) => Number(w)))}.`] }));
      const d = M.depth[p.id], d0 = (M.depthBefore || {})[p.id];
      if (d && d0 && d.d >= 2 && d0.d < d.d && ['RB', 'WR', 'TE'].includes(p.pos) && p.proj >= 8) out.push(row('I98', { teams: [id], about: 'player', parts: ['Depth chart: ', name(p), ` has slipped from ${ord(d0.d)} to ${ord(d.d)} at ${p.pos} on ${p.nfl}'s chart.`] }));
      const wasIr = [week - 1, week - 2].some((w) => pw.weeks[w] && pw.weeks[w].slot === 21 && pw.weeks[w].team === id);
      if (wasIr) out.push(row('I97', { teams: [id], about: 'player', parts: ['Back from injury: ', name(p), ' starts after time on injured reserve.'] }));
    }
    if (s86 && s86.entries[0] && s86.entries[0].team === other(id)) {
      const e = s86.entries[0];
      if (st.some((p) => p.name === e.player.name)) out.push(row('I92', { teams: [id, other(id)], about: 'player', parts: ['The player who has hurt ', T(other(id)), ' most this season, ', P(e.player.name, e.player.pos), ' (', V(pts(e.value)), '), starts for ', T(id), '.'] }));
    }
    // Bench pressure: a bench player who outscored a starter at his position in each of the last three weeks.
    for (const b of sd.bench) {
      const pw = M.playerWeeks[b.id];
      if (M.byes.byes && M.byes.byes[b.nfl] === week) continue;
      if (!pw) continue;
      for (const s of st.filter((x) => x.pos === b.pos)) {
        const sw = M.playerWeeks[s.id];
        const ok = [1, 2, 3].every((k) => { const x = pw.weeks[week - k], y = sw && sw.weeks[week - k]; return x && y && x.team === id && y.team === id && x.pts > y.pts; });
        if (ok) out.push(row('I87', { teams: [id], about: 'player', parts: ['Bench pressure: ', name(b), ' has outscored ', name(s), ' three weeks running, and sits again.'] }));
      }
    }
    // Points on the bench: ESPN's best lineup by projection (played games count what they scored).
    const pool = [...sd.starters, ...sd.bench].filter((p) => p.id != null).map((p) => ({ pid: p.id, posId: POS_ID[p.pos], v: p.gameStatus === 'pre' ? p.proj : p.points }));
    const set = sd.starters.filter((p) => p.id != null).reduce((x, p) => x + (p.gameStatus === 'pre' ? p.proj : p.points), 0);
    const bestV = bestLineup(pool, M.startSlots, 'v');
    if (bestV - set >= 5) out.push(row('I88', { teams: [id], about: 'team', parts: [T(id), "'s lineup leaves ", V(pts(bestV - set)), " projected points on its bench (ESPN's best lineup differs)."] }));
    // Points in the bank: starters whose game is over.
    const done = st.filter((p) => p.gameStatus === 'final');
    const bank = done.reduce((x, p) => x + p.points, 0);
    if (done.length && bank >= 15) {
      const top = done.sort((x, y) => y.points - x.points)[0];
      out.push(row('I176', { teams: [id], about: 'team', parts: done.length === 1 ? ['Points in the bank: ', T(id), ' already has ', V(pts(bank)), ' from ', name(top), ', whose game is over.']
        : ['Points in the bank: ', T(id), ' already has ', V(pts(bank)), ` from ${num(done.length)} starters whose games are over, `, name(top), ' ', V(pts(top.points)), ' of it.'] }));
    }
    const early = st.filter((p) => p.kickoff && unplayed(p) && etHour(p.kickoff) < 11);
    if (early.length) out.push(row('I177', { teams: [id], about: 'player', parts: ['Early kickoff: ', T(id), ' has ', ...early.flatMap((p, i) => [i ? ' and ' : '', name(p)]), ` in the ${etTime(early[0].kickoff)} game (${early[0].game}).`] }));
    if (s71 && s71.entries[0]) for (const p of st) if (unplayed(p) && p.proj >= s71.entries[0].value - 18) out.push(row('I122', { teams: [id], about: 'player', parts: [name(p), ' is projected for ', V(pts(p.proj)), '; ', V(pts(s71.entries[0].value + 0.01)), ' would be the season’s best single-week performance.'] }));
    // Moves this week touching the starters.
    for (const x of M.tx.filter((t) => (t.kind === 'waiver' || t.kind === 'add') && t.scoringPeriod === week && t.teams.some((tm) => tm.id === id))) {
      for (const pl of x.adds || []) if (st.some((p) => p.id === pl.id)) out.push(row('I163', { teams: [id], about: 'player', bump: pl.pos === 'K' || pl.pos === 'D/ST' ? -1 : 0,
        parts: ['New arrival: ', T(id), ` picked up `, P(pl.name, pl.pos), pl.pos === 'D/ST' ? ' this week and starts them.' : ' this week and starts him.'] }));
    }
    for (const x of M.tx.filter((t) => t.kind === 'trade' && t.status === 'completed')) {
      for (const sdx of x.sides || []) {
        if (sdx.team.id !== other(id)) continue;
        for (const pl of sdx.players) if (opp.starters.some((p) => p.id === pl.id) || st.some((p) => p.id === pl.id)) {
          const holder = st.some((p) => p.id === pl.id) ? id : other(id);
          const was = (M.heldBy[pl.id] && Object.entries(M.heldBy[pl.id]).find(([w, t]) => t !== holder)) || null;
          if (was && Number(was[1]) === other(holder)) out.push(row('I165', { teams: [holder, other(holder)], about: 'player', parts: ['Old team: ', P(pl.name, pl.pos), ' faces ', T(other(holder)), ', who traded him away.'] }));
        }
      }
    }
  }
  // Both teams at once.
  if (M.tx.some((t) => t.kind === 'trade' && t.status === 'completed' && t.teams.some((x) => x.id === h) && t.teams.some((x) => x.id === a)))
    out.push(row('I164', { teams: [h, a], parts: [T(h), ' and ', T(a), ' have traded with each other this season.'] }));
  for (const id of [h, a]) for (const p of side[id].starters.filter((x) => (x.pos === 'K' || x.pos === 'QB') && unplayed(x))) {
    const g = M.nfl[p.nfl];
    const wx = g && !g.indoor && g.weather;
    if (wx && (/rain|snow|storm|shower|wind/i.test(wx.displayValue || '') || wx.temperature <= 32)) out.push(row('I182', { teams: [id], about: 'player',
      parts: ['Weather: ', String(wx.displayValue || '').toLowerCase(), ` and ${wx.temperature}\u00b0 forecast where `, name(p), ` plays (${g.key}).`] }));
  }
  const allSt = [...H.starters, ...A.starters].filter((p) => p.id != null);
  const top = [...allSt].sort((x, y) => y.proj - x.proj)[0];
  if (top) out.push(row('I90', { teams: [H.starters.includes(top) ? h : a], about: 'matchup', parts: ['The highest-projected player in this game: ', name(top), ', ', V(pts(top.proj)), '.'] }));
  const lastKick = all.flatMap((s) => s.starters).map((p) => p.kickoff).filter(Boolean).sort().pop();
  const mon = (s) => s.starters.filter((p) => p.kickoff === lastKick);
  if (lastKick && mon(H).length && mon(A).length) out.push(row('I174', { teams: [h, a], parts: ['Monday night could decide it: both teams have players in the last game of the week (', ...mon(H).concat(mon(A)).flatMap((p, i) => [i ? ', ' : '', name(p)]), ').'] }));
  const windows = (s) => new Set(s.starters.filter((p) => p.kickoff).map((p) => p.kickoff)).size;
  const wh = windows(H), wa = windows(A);
  if (Math.abs(wh - wa) >= 3) out.push(row('I175', { teams: [h, a], parts: [T(h), `'s starters play in ${num(wh)} kickoff slots, `, T(a), `'s in ${num(wa)}.`] }));
  // Position edges.
  const byPos = (s) => { const m = {}; for (const p of s.starters) if (p.id != null) m[p.pos] = (m[p.pos] || 0) + (p.gameStatus === 'pre' ? p.proj : p.points); return m; };
  const ph = byPos(H), pa = byPos(A);
  const edges = Object.keys({ ...ph, ...pa }).map((k) => [k, (ph[k] || 0) - (pa[k] || 0)]).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]));
  if (edges[0] && Math.abs(edges[0][1]) >= 8) { const [k, d] = edges[0]; const lead = d > 0 ? h : a; out.push(row('I94', { teams: [lead], parts: ['Position edges: ', T(lead), `'s ${k}s are projected `, V(pts(Math.abs(d))), ' more than ', T(other(lead)), "'s."] })); }
  return out;
}

const etParts = (iso) => Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: false, weekday: 'short' }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
const etHour = (iso) => { const p = etParts(iso); return Number(p.hour) + Number(p.minute) / 60; };
const etTime = (iso) => { const p = etParts(iso); const hh = Number(p.hour); return `${hh % 12 || 12}:${p.minute} ${hh < 12 ? 'AM' : 'PM'} ET`; };

/* ------------------------------------------------------------------ After the final */
export function postRows(M, week, fx, facts, ctx) {
  const out = [];
  const h = fx.home, a = fx.away;
  const th = M.teamWeeks[`${h}:${week}`], ta = M.teamWeeks[`${a}:${week}`];
  if (!th || !ta) return out;
  const tw = { [h]: th, [a]: ta };
  // A tie (a league whose tie rule allows one): the result and the lineups only; nothing that needs a winner.
  if (!fx.winner) {
    out.push(row('I186', { teams: [h, a], parts: ['Result: ', T(h), ' and ', T(a), ' tied at ', V(pts(th.pts)), '.'] }));
    out.push(row('I203', { teams: [h, a], parts: ['Against projection: ', T(h), ' ', V(signed(th.pts - th.proj)), ', ', T(a), ' ', V(signed(ta.pts - ta.proj)), '.'] }));
    if (th.optimal > 0 && ta.optimal > 0) out.push(row('I209', { teams: [h, a], parts: ['Lineups: ', T(h), ' used ', V(pct(th.pts / th.optimal)), ' of its best possible score, ', T(a), ' ', V(pct(ta.pts / ta.optimal)), '.'] }));
    return out;
  }
  const w = fx.winner, l = w === h ? a : h;
  const marginAbs = Math.abs(th.pts - ta.pts);
  const wk = M.settled.filter((f) => f.week === week);
  const margins = wk.map((f) => [f.id, Math.abs(f.hp - f.ap)]).sort((x, y) => x[1] - y[1]);
  const tag = margins[0][0] === fx.id ? ', the closest game of the week' : margins[margins.length - 1][0] === fx.id ? ', the biggest margin of the week' : '';
  out.push(row('I186', { teams: [w, l], parts: ['Result: ', T(w), ' beat ', T(l), ' ', V(pts(tw[w].pts)), ' to ', V(pts(tw[l].pts)), `${tag}.`] }));
  const before = M.partBefore(week), after = M.partAfter(week);
  const Sb = standingsMap(before), Sa = standingsMap(after);
  out.push(...recordRows(M, week, fx, tw, facts, w, l));
  // Bench.
  // I192 and I193 merged (review 3): one row says the loser's bench could have won and, when one bench player alone
  // would have done it, names him.
  if (tw[l].optimal > tw[w].pts) {
    const gap = tw[w].pts - tw[l].pts;
    const hero = tw[l].bench.filter((b) => tw[l].starters.some((s) => s.posId === b.posId && b.pts - s.pts > gap)).sort((x, y) => y.pts - x.pts)[0];
    out.push(row('I192', { teams: [l], about: 'team', adj: hero ? 1 : 0, parts: hero
      ? [T(l), ' lost with ', P(hero.name, hero.pos), "'s ", V(pts(hero.pts)), ' on the bench; starting him would have won it.']
      : [T(l), "'s best possible lineup (", V(pts(tw[l].optimal)), ') would have won.'] }));
  }
  const top = [...th.starters.map((p) => ({ ...p, team: h })), ...ta.starters.map((p) => ({ ...p, team: a }))].sort((x, y) => y.pts - x.pts)[0];
  if (top) {
    out.push(row('I194', { teams: [top.team], about: 'player', parts: ['Top scorer of the game: ', P(top.name, top.pos), ' for ', T(top.team), ', ', V(pts(top.pts)), '.'] }));
    if (top.team === w && top.pts > marginAbs && marginAbs < 20) out.push(row('I195', { teams: [w], about: 'player', parts: [P(top.name, top.pos), ' alone (', V(pts(top.pts)), ') outscored the margin.'] }));
  }
  for (const id of [h, a]) {
    const bench = tw[id].bench.sort((x, y) => y.pts - x.pts)[0];
    if (bench && tw[id].starters.length && tw[id].starters.every((p) => bench.pts > p.pts)) out.push(row('I220', { teams: [id], about: 'player', parts: ['Bench star: ', P(bench.name, bench.pos), ' (', V(pts(bench.pts)), ') outscored every ', T(id), ' starter from the bench.'] }));
  }
  // Timeline facts (lead changes, comebacks, the Monday finish), as Season Statistics stores them.
  if (facts) {
    const homeWon = w === h;
    const maxDef = homeWon ? facts.maxAwayLead : facts.maxHomeLead;
    if (maxDef >= 15) out.push(row('I197', { teams: [w, l], adj: maxDef >= 45 ? 1 : 0, parts: ['Comeback: ', T(w), ' won from ', V(pts(maxDef)), ' down; ', T(l), ' let the lead go.'] }));
    if (facts.wire && marginAbs >= 1) out.push(row('I199', { teams: [w], about: 'team', parts: ['Wire to wire: ', T(w), ' never trailed.'] }));
    if (facts.monday) out.push(row('I200', { teams: [w, l], parts: ['Decided on Monday night.'] }));
    if (facts.minWinWp <= 25) out.push(row('I202', { teams: [w], about: 'team', bump: facts.minWinWp <= 10 ? 1 : 0, parts: ['Against the odds: ', T(w), "'s win chance fell as low as ", V(`${Math.round(facts.minWinWp)}%`), '.'] }));
    const garb = facts.garbH + facts.garbA;
    if (garb >= 15) out.push(row('I196', { teams: [w, l], parts: ['Garbage time: ', V(pts(garb)), ' points after the game was decided.'] }));
  }
  const kick = tw[w].starters.find((p) => p.pos === 'K');
  if (kick && marginAbs < kick.pts) out.push(row('I201', { teams: [w, l], parts: ['Decided by the kickers: the margin (', V(pts(marginAbs)), ') was less than ', P(kick.name, 'K'), "'s ", V(pts(kick.pts)), '.'] }));
  out.push(row('I203', { teams: [h, a], parts: ['Against projection: ', T(h), ' ', V(signed(th.pts - th.proj)), ', ', T(a), ' ', V(signed(ta.pts - ta.proj)), '.'] }));
  // Seeds moved only once every game of the week is over (round 8: the standings may be the insights' own count).
  const weekDone = wk.length === M.fixtures.filter((f) => f.week === week).length;
  if (weekDone && Sb[h] && Sa[h]) for (const id of [w, l]) { const d = Sb[id].seed - Sa[id].seed; if (Math.abs(d) >= 2) out.push(row('I204', { teams: [id], about: 'team', parts: ['Standings: ', T(id), ` ${d > 0 ? 'moves up' : 'drops'} to ${ord(Sa[id].seed)} (from ${ord(Sb[id].seed)}).`] })); }
  if (Sa[w] && Sa[w].streak && Sa[w].streak.type === 'W' && Sa[w].streak.n >= 3) out.push(row('I205', { teams: [w], about: 'team', parts: [T(w), `'s winning streak is now ${num(Sa[w].streak.n)}.`] }));
  if (Sb[l] && Sb[l].streak && Sb[l].streak.type === 'W' && Sb[l].streak.n >= 3) out.push(row('I205', { teams: [l, w], about: 'team', parts: [T(w), ' snapped ', T(l), `'s ${num(Sb[l].streak.n)}-game winning streak.`] }));
  const meet = M.h2h(h, a).filter((g) => g.season < M.season || g.week <= week);
  if (meet.length >= 3) {
    const ww = meet.filter((g) => g[w] > g[l]).length, lw = meet.filter((g) => g[l] > g[w]).length;
    out.push(row('I206', { teams: [w, l], parts: ww === lw ? [`Head to head: now level at ${ww}–${lw}.`] : ['Head to head: ', T(ww > lw ? w : l), ` now leads ${Math.max(ww, lw)}–${Math.min(ww, lw)}.`] }));
  }
  const scores = wk.flatMap((f) => [f.hp, f.ap]).sort((x, y) => y - x);
  if (tw[l].pts >= scores[2]) out.push(row('I207', { teams: [l], about: 'team', parts: ['Bad beat: ', T(l), "'s ", V(pts(tw[l].pts)), ` was the week's ${ord(scores.indexOf(tw[l].pts) + 1)}-highest score, and lost.`] }));
  const median = (scores[4] + scores[5]) / 2;
  if (tw[w].pts < median) out.push(row('I208', { teams: [w], about: 'team', parts: ['Lucky win: ', T(w), ' won with ', V(pts(tw[w].pts)), ', below the week’s median.'] }));
  if (th.optimal > 0 && ta.optimal > 0) out.push(row('I209', { teams: [h, a], parts: ['Lineups: ', T(h), ' used ', V(pct(th.pts / th.optimal)), ' of its best possible score, ', T(a), ' ', V(pct(ta.pts / ta.optimal)), '.'] }));
  if (ctx && ctx.upsetId === fx.id) out.push(row('I187', { teams: [w, l], parts: ["The upset of the week: ", T(w), ' won from a ', V(`${Math.round(ctx.upsetWp)}%`), ' win chance at kickoff.'] }));
  return out;
}
const signed = (x) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${pts(Math.abs(x))}`;

/* ------------------------------------------------------------------ records that fell (round 8)
   Every single-game record Season Statistics keeps (I191) and Hall of Fame's all-time single-game records (I229),
   each as it stood before the week, against this game's figures. A record matched rather than beaten weighs a point
   less. A mark that is an all-time record is not repeated as a season one. Where another game of the same week did
   better, that game reports the record, not this one. A two-week postseason matchup is skipped for the per-week
   records (Season Statistics and Hall of Fame count those week by week). */
const SEASON_RECORDS = [
  // id, phrase, better ('high'|'low'), major (a headline record), what it measures
  ['S21.high', 'the highest weekly score this season', 'high', true, 'team'],
  ['S21.low', 'the lowest weekly score this season', 'low', true, 'team'],
  ['S26', 'the highest-scoring matchup this season', 'high', true, 'combined'],
  ['S27', 'the lowest-scoring matchup this season', 'low', false, 'combined'],
  ['S59', 'the biggest blowout this season', 'high', true, 'margin'],
  ['S58', 'the closest game this season', 'low', true, 'margin'],
  ['S28', 'the highest score in a loss this season', 'high', false, 'loser'],
  ['S29', 'the lowest score in a win this season', 'low', false, 'winner'],
  ['S47', 'the biggest bench blunder this season', 'high', false, 'blunder'],
  ['S50.beat', 'the biggest beat of projection this season', 'high', false, 'overProj'],
  ['S50.miss', 'the biggest miss of projection this season', 'low', false, 'overProj'],
  ['S53', 'the biggest upset by projection this season', 'high', false, 'upset'],
  ['S60', 'the biggest comeback this season', 'high', false, 'comeback'],
  ['S62', 'the unlikeliest win this season', 'low', false, 'winWp'],
  ['S63', 'the most in a game this season', 'high', false, 'changes'],
  ['S71', 'the best single-week performance by a player this season', 'high', true, 'player'],
  ['S48', 'the best bench week by a player this season', 'high', false, 'benchPlayer'],
];
const UNIT = { winWp: (x) => `${Math.round(x)}%`, changes: (x) => String(x), overProj: (x) => signed(x) };
export function recordRows(M, week, fx, tw, facts, w, l) {
  const out = [];
  const h = fx.home, a = fx.away, th = tw[h], ta = tw[a];
  const perWeek = !((th.periods && th.periods.length > 1) || (ta.periods && ta.periods.length > 1));
  const before = M.partBefore(week);
  const margin = Math.abs(th.pts - ta.pts), combined = th.pts + ta.pts;
  const others = M.settled.filter((f) => f.week === week && f.id !== fx.id);
  const fmt = (k, x) => (UNIT[k] ? UNIT[k](x) : pts(x));
  const beats = (better, x, rec) => (better === 'high' ? x > rec + 1e-9 : x < rec - 1e-9);
  const equal = (x, rec) => Math.abs(x - rec) < 0.005;
  // Hall of Fame's records, as they stood before this week.
  const at = allTimeBefore(M, week);
  const allTime = {};
  if (perWeek) {
    const tops = [[h, th.pts], [a, ta.pts]];
    const best = (better, list) => list.sort((x, y) => (better === 'high' ? y[1] - x[1] : x[1] - y[1]))[0];
    const hiT = best('high', [...tops]), loT = best('low', [...tops]);
    const otherScores = others.flatMap((f) => [f.hp, f.ap]), otherMargins = others.map((f) => Math.abs(f.hp - f.ap));
    const cand = [
      ['team.high', at.high, 'high', hiT[1], hiT[0], 'the highest score in league history', [T(hiT[0]), "'s ", V(pts(hiT[1])), ' is ']],
      ['team.low', at.low, 'low', loT[1], loT[0], 'the lowest score in league history', [T(loT[0]), "'s ", V(pts(loT[1])), ' is ']],
      ['margin.high', at.blow, 'high', margin, w, 'the biggest blowout in league history', [T(w), ' by ', V(pts(margin)), ' is ']],
      ['margin.low', at.close, 'low', margin, w, 'the closest game in league history', [T(w), ' by ', V(pts(margin)), ' is ']],
    ];
    for (const [key, rec, better, x, holder, phrase, lead] of cand) {
      if (!rec || !holder) continue;
      const pool = key.startsWith('team') ? otherScores : otherMargins;
      if (pool.some((y) => beats(better, y, x))) continue;
      const tie = equal(x, rec.value);
      if (!tie && !beats(better, x, rec.value)) continue;
      allTime[key] = true;
      out.push(row('I229', { teams: key.startsWith('margin') ? [w, l] : [holder], adj: tie ? -1 : 0,
        parts: tie ? ['An all-time record matched: ', ...lead, `level with ${phrase}, set in ${rec.season} week ${rec.week}.`]
          : ['An all-time record fell: ', ...lead, `${phrase} (the old record was `, V(pts(rec.value)), `, ${rec.season} week ${rec.week}).`] }));
    }
  }
  if (!before) return out;
  const value = (k) => {
    switch (k) {
      case 'combined': return perWeek ? [[combined, null]] : [];
      case 'margin': return perWeek ? [[margin, w]] : [];
      case 'team': return perWeek ? [[th.pts, h], [ta.pts, a]] : [];
      case 'loser': return perWeek ? [[tw[l].pts, l]] : [];
      case 'winner': return perWeek ? [[tw[w].pts, w]] : [];
      case 'blunder': return perWeek ? [[th.optimal - th.pts, h], [ta.optimal - ta.pts, a]].filter((x) => x[0] > 0) : [];
      case 'overProj': return perWeek ? [[th.pts - th.proj, h], [ta.pts - ta.proj, a]] : [];
      case 'upset': return perWeek && tw[l].proj > tw[w].proj ? [[tw[l].proj - tw[w].proj, w]] : [];
      case 'comeback': return facts ? [[w === h ? facts.maxAwayLead : facts.maxHomeLead, w]] : [];
      case 'winWp': return facts ? [[facts.minWinWp, w]] : [];
      case 'changes': return facts ? [[facts.changes, null]] : [];
      default: return [];
    }
  };
  const ALLTIME_OF = { 'S21.high': 'team.high', 'S21.low': 'team.low', S59: 'margin.high', S58: 'margin.low' };
  for (const [id, phrase, better, major, k] of SEASON_RECORDS) {
    if (ALLTIME_OF[id] && allTime[ALLTIME_OF[id]]) continue;
    const r = record(before, id);
    const rec = r && r.entries && r.entries[0];
    if (!rec || rec.value == null) continue;
    let cands;
    if (k === 'player' || k === 'benchPlayer') {
      const list = k === 'player' ? [...th.starters.map((p) => [p, h]), ...ta.starters.map((p) => [p, a])] : [...th.bench.map((p) => [p, h]), ...ta.bench.map((p) => [p, a])];
      const top = list.sort((x, y) => y[0].pts - x[0].pts)[0];
      if (!top || !perWeek) continue;
      const tie = equal(top[0].pts, rec.value);
      if (!tie && !beats(better, top[0].pts, rec.value)) continue;
      out.push(row('I191', { teams: [top[1]], about: 'player', adj: (major ? 0 : -1) + (tie ? -1 : 0),
        parts: [tie ? 'A season record matched: ' : 'A season record fell: ', P(top[0].name, top[0].pos), "'s ", V(pts(top[0].pts)), ' for ', T(top[1]),
          ...(tie ? [` equals ${phrase}, set in week ${rec.week}.`] : [` is ${phrase} (the old record was `, V(pts(rec.value)), `, week ${rec.week}).`])] }));
      continue;
    }
    cands = value(k).filter(([x]) => Number.isFinite(x));
    const pick = cands.sort((x, y) => (better === 'high' ? y[0] - x[0] : x[0] - y[0]))[0];
    if (!pick) continue;
    const [x, who] = pick;
    // Another game this week did better on the same measure: it reports the record.
    if (k === 'team' && others.some((f) => [f.hp, f.ap].some((y) => beats(better, y, x)))) continue;
    if (k === 'margin' && others.some((f) => beats(better, Math.abs(f.hp - f.ap), x))) continue;
    if (k === 'combined' && others.some((f) => beats(better, f.hp + f.ap, x))) continue;
    const tie = equal(x, rec.value);
    if (!tie && !beats(better, x, rec.value)) continue;
    const lead = k === 'combined' ? [V(pts(x)), ' combined'] : k === 'changes' ? [V(String(x)), ' lead changes'] : k === 'margin' ? [T(w), ' by ', V(pts(x))]
      : k === 'upset' ? [T(w), ' winning from ', V(pts(x)), ' behind on projection'] : k === 'comeback' ? [T(w), ' winning from ', V(pts(x)), ' down']
      : k === 'winWp' ? [T(w), ' winning from a ', V(fmt(k, x)), ' win chance'] : k === 'blunder' ? [T(who), ' leaving ', V(pts(x)), ' on its bench']
      : k === 'overProj' ? [T(who), ' at ', V(signed(x)), ' against projection'] : [T(who), "'s ", V(pts(x))];
    out.push(row('I191', { teams: who != null ? (k === 'team' || k === 'loser' || k === 'winner' || k === 'blunder' || k === 'overProj' ? [who] : [w, l]) : [h, a],
      adj: (major ? 0 : -1) + (tie ? -1 : 0),
      parts: [tie ? 'A season record matched: ' : 'A season record fell: ', ...lead,
        ...(tie ? [` equals ${phrase}, set in week ${rec.week}.`] : [` is ${phrase} (the old record was `, V(fmt(k, rec.value)), `, week ${rec.week}).`])] }));
  }
  // The season's longest streaks, from the standings after the game.
  const after = M.partAfter(week);
  const Sa = standingsMap(after);
  for (const [id, type, phrase] of [['S11.win', 'W', 'the longest winning streak this season'], ['S11.loss', 'L', 'the longest losing streak this season']]) {
    const r = record(before, id);
    const rec = r && r.entries && r.entries[0];
    const who = type === 'W' ? w : l;
    const st = Sa[who] && Sa[who].streak;
    if (!rec || !st || st.type !== type || st.n < rec.value) continue;
    const tie = st.n === rec.value;
    out.push(row('I191', { teams: [who], about: 'team', adj: -1 + (tie ? -1 : 0),
      parts: [tie ? 'A season record matched: ' : 'A season record fell: ', T(who), ` has ${type === 'W' ? 'won' : 'lost'} ${num(st.n)} in a row, `, tie ? `level with ${phrase}.` : `${phrase} (the old record was ${num(rec.value)}).`] }));
  }
  return out;
}

/* Outcome of a prediction row once the game is final (D13). */
export function judge(r, fx, tw) {
  if (!r.predict) return null;
  const p = r.predict;
  const won = (id) => fx.winner === id;
  switch (p.kind) {
    case 'win': return won(p.team) ? 'held' : 'broke';
    case 'loss': return won(p.team) ? 'broke' : 'held';
    case 'score>=': return tw[p.team] && tw[p.team].pts >= p.value ? 'held' : 'broke';
    case 'score<': return tw[p.team] && tw[p.team].pts < p.value ? 'held' : 'broke';
    case 'combined>=': return (tw[fx.home].pts + tw[fx.away].pts) >= p.value ? 'held' : 'broke';
    case 'into': case 'out': return p.result || null;
    case 'pfLead': return p.result || null;
    default: return null;
  }
}

/* ------------------------------------------------------------------ Live rows (during the games)
   lv: { series: [[t, home, away, homeWp]] up to now, sides: { [teamId]: { pts, projLeft, left: [players], done: [players], monday: [players] } } } */
export function liveRows(M, week, fx, lv) {
  const out = [];
  const h = fx.home, a = fx.away;
  const s = lv.series;
  if (!s.length) return out;
  const last = s[s.length - 1];
  const sh = lv.sides[h], sa = lv.sides[a];
  const score = { [h]: last[1], [a]: last[2] };
  const lead = score[h] >= score[a] ? h : a, trail = lead === h ? a : h;
  const gap = Math.abs(score[h] - score[a]);
  const wp = { [h]: last[3], [a]: 100 - last[3] };
  const live = { [h]: score[h] + sh.projLeft, [a]: score[a] + sa.projLeft };
  let changes = 0, prev = 0, maxH = 0, maxA = 0;
  for (const r of s) { const g = Math.sign(r[1] - r[2]); if (g) { if (prev && g !== prev) changes++; prev = g; } maxH = Math.max(maxH, r[1] - r[2]); maxA = Math.max(maxA, r[2] - r[1]); }
  if (changes >= 3) out.push(row('I145', { teams: [h, a], bump: changes >= 6 ? 1 : 0, parts: [`The lead has changed hands ${num(changes)} times.`] }));
  if (sh.left.length + sa.left.length) {
    const tl = lv.sides[trail];
    if (tl.projLeft > gap && gap > 0) // Weight 4 only late (three players or fewer left to play) and when the trailing side is projected to come back:
    // early in a week nearly every game has a side behind with players to come, and that is not news (r231).
    out.push(row('I146', { teams: [trail, lead], bump: (tl.left.length <= 3 ? 0 : -1) + (live[trail] > live[lead] ? 0 : -1),
      parts: [T(trail), ' trails by ', V(pts(gap)), ' with ', V(pts(tl.projLeft)), ` projected still to play (${num(tl.left.length)} player${tl.left.length === 1 ? '' : 's'}).`], predict: { kind: 'win', team: trail } }));
    out.push(row('I150', { teams: [h, a], parts: ['Live projection: ', T(h), ' ', V(pts(live[h])), ', ', T(a), ' ', V(pts(live[a])), '.'] }));
  }
  const back = (id) => (id === h ? maxA : maxH);
  if (back(lead) >= 20 && gap < back(lead)) out.push(row('I148', { teams: [lead, trail], parts: ['Comeback on: ', T(lead), ' was down ', V(pts(back(lead))), ' and now leads by ', V(pts(gap)), '.'], predict: { kind: 'win', team: lead } }));
  else if (back(trail) >= 20 && gap <= 5) out.push(row('I148', { teams: [trail, lead], parts: ['Comeback on: ', T(trail), ' was down ', V(pts(back(trail))), ' and is within ', V(pts(gap)), '.'], predict: { kind: 'win', team: trail } }));
  // Momentum: the win chance's biggest move inside the last hour of play.
  let swing = 0, from = null;
  for (let i = s.length - 1; i >= 0 && last[0] - s[i][0] <= 3600e3; i--) if (Math.abs(last[3] - s[i][3]) > swing) { swing = Math.abs(last[3] - s[i][3]); from = s[i]; }
  if (swing >= 30) { const up = last[3] > from[3] ? h : a; out.push(row('I147', { teams: [up], parts: ['Momentum: ', T(up), "'s win chance has moved from ", V(`${Math.round(up === h ? from[3] : 100 - from[3])}%`), ' to ', V(`${Math.round(wp[up])}%`), ' in the last hour.'] })); }
  if (wp[lead] >= 98 && sh.left.length + sa.left.length > 0) out.push(row('I151', { teams: [lead], parts: ['All but over: ', T(lead), "'s win chance is ", V(`${Math.round(wp[lead])}%`), '.'] }));
  // Records within reach while the game is on (round 8): the season's (I154, I153) and Hall of Fame's (I231), on the
  // live projection; a record already passed with players still to come says so and weighs a point more.
  const pb = M.partBefore(week);
  const at = lv.allTime || allTimeBefore(M, week);
  const comb = record(pb, 'S26'), hi = record(pb, 'S21.high'), lo = record(pb, 'S21.low'), blow = record(pb, 'S59');
  const marginLive = Math.abs(live[h] - live[a]), aheadLive = live[h] >= live[a] ? h : a;
  const playing = sh.left.length + sa.left.length > 0;
  const allTimeHit = {};
  if (playing) {
    for (const id of [h, a]) {
      if (at.high && live[id] > at.high.value) {
        allTimeHit[`high${id}`] = true;
        const past = score[id] > at.high.value;
        out.push(row('I231', { teams: [id], adj: past ? 1 : 0, parts: [past ? 'All-time record falling: ' : 'All-time record in reach: ', T(id), past ? ' already has ' : ' is on course for ', V(pts(past ? score[id] : live[id])), '; the league’s all-time high is ', V(pts(at.high.value)), ` (${at.high.season} week ${at.high.week}).`],
          predict: { kind: 'score>=', team: id, value: at.high.value + 0.01 } }));
      }
    }
    if (at.blow && marginLive > at.blow.value) {
      allTimeHit.blow = true;
      out.push(row('I231', { teams: [aheadLive, aheadLive === h ? a : h], parts: ['All-time record in reach: ', T(aheadLive), ' is on course to win by ', V(pts(marginLive)), '; the biggest blowout in league history is ', V(pts(at.blow.value)), ` (${at.blow.season} week ${at.blow.week}).`] }));
    }
    if (comb && comb.entries[0] && live[h] + live[a] > comb.entries[0].value) out.push(row('I153', { teams: [h, a], parts: ['Shootout pace: on course for ', V(pts(live[h] + live[a])), ' combined; the season’s record is ', V(pts(comb.entries[0].value)), '.'], predict: { kind: 'combined>=', value: comb.entries[0].value + 0.01 } }));
    for (const id of [h, a]) {
      if (!allTimeHit[`high${id}`] && hi && hi.entries[0] && live[id] > hi.entries[0].value) {
        const past = score[id] > hi.entries[0].value;
        out.push(row('I154', { teams: [id], adj: past ? 1 : 0, parts: [past ? 'Record falling: ' : 'Record in reach: ', T(id), past ? ' already has ' : ' is on course for ', V(pts(past ? score[id] : live[id])), '; the season’s high is ', V(pts(hi.entries[0].value)), '.'], predict: { kind: 'score>=', team: id, value: hi.entries[0].value + 0.01 } }));
      }
      if (lo && lo.entries[0] && live[id] < lo.entries[0].value && lv.sides[id].left.length <= 3) out.push(row('I154', { teams: [id], adj: -1, parts: ['Record in reach: ', T(id), ' is on course for ', V(pts(live[id])), ', under the season’s lowest score (', V(pts(lo.entries[0].value)), ').'], predict: { kind: 'score<', team: id, value: lo.entries[0].value } }));
    }
    if (!allTimeHit.blow && blow && blow.entries[0] && marginLive > blow.entries[0].value) out.push(row('I154', { teams: [aheadLive, aheadLive === h ? a : h], parts: ['Record in reach: ', T(aheadLive), ' is on course to win by ', V(pts(marginLive)), '; the season’s biggest blowout is ', V(pts(blow.entries[0].value)), '.'] }));
  }
  const big = Math.max(maxH, maxA);
  if (big >= 25) out.push(row('I158', { teams: [maxH >= maxA ? h : a], parts: ['Biggest lead so far: ', T(maxH >= maxA ? h : a), ' by ', V(pts(big)), '.'] }));
  if (gap <= 3 && sh.left.length + sa.left.length > 0) out.push(row('I159', { teams: [h, a], parts: ['Neck and neck: ', V(pts(gap)), ' between them, with players still to play.'] }));
  for (const id of [h, a]) {
    for (const p of lv.sides[id].done) {
      if (p.pts >= p.proj + 15) out.push(row('I152', { teams: [id], about: 'player', parts: ['Going off: ', P(p.name, p.pos), ' scored ', V(pts(p.pts)), ' against a projection of ', V(pts(p.proj)), '.'] }));
      if (p.proj >= 10 && p.pts <= p.proj - 8) out.push(row('I155', { teams: [id], about: 'player', parts: ['Bust: ', P(p.name, p.pos), ' finished with ', V(pts(p.pts)), ' against a projection of ', V(pts(p.proj)), '.'] }));
    }
  }
  const mon = [...sh.monday, ...sa.monday];
  if (sh.monday.length && sa.monday.length && gap < sh.projLeft + sa.projLeft) out.push(row('I161', { teams: [h, a], parts: ['Down to Monday night: ', ...mon.flatMap((p, i) => [i ? ', ' : '', P(p.name, p.pos)]), ' still to play.'] }));
  return out;
}

/* ------------------------------------------------------------------ Across the league (D15: at most 6) */
export function leagueRows(M, week, kind, facts) {
  const out = [];
  if (kind === 'pre' && facts.margins) {
    const close = facts.margins.filter((m) => m < 10).length;
    if (close >= 3) out.push(row('I222', { about: 'league', parts: [`${num(close).replace(/^./, (c) => c.toUpperCase())} of ${num(facts.margins.length)} games are projected within 10 points.`] }));
  }
  if (kind === 'pre' && week === Math.ceil(M.regWeeks / 2)) out.push(row('I228', { about: 'league', parts: [`Week ${week} of ${M.regWeeks}: the regular season passes halfway this week.`] }));
  if (kind === 'pre' && facts.odds) {
    const alive = Object.values(facts.odds).every((x) => x > 0);
    if (alive && week > M.regWeeks / 2) out.push(row('I226', { about: 'league', parts: ['Every team still has a playoff chance by ESPN’s odds.'] }));
  }
  if (facts.clinch && facts.clinch.length) out.push(row('I221', { teams: facts.clinch, about: 'league', bump: facts.clinch.length >= 3 ? 1 : 0,
    parts: [`${num(facts.clinch.length).replace(/^./, (c) => c.toUpperCase())} team${facts.clinch.length === 1 ? '' : 's'} can clinch a playoff place this week: `, ...facts.clinch.flatMap((id, i) => [i ? ', ' : '', T(id)]), '.'] }));
  if (facts.bigGame) out.push(row('I223', { teams: facts.bigGame.teams, about: 'league', parts: ["The week's big game: ", T(facts.bigGame.teams[0]), ' v ', T(facts.bigGame.teams[1]), ' moves the league’s playoff odds most (', V((Math.round(facts.bigGame.swing * 1000 + 1e-6) / 10).toFixed(1)), ' percentage points in all).'] }));
  if (kind === 'live' && facts.pace) out.push(row('I224', { about: 'league', parts: ['Scoring pace: the league is on course for ', V(pts(facts.pace.now)), ' a team this week, against a season average of ', V(pts(facts.pace.avg)), '.'] }));
  if (kind === 'post' && facts.review) {
    const r = facts.review;
    out.push(row('I225', { teams: r.close.w ? [r.high.team, r.close.w] : [r.high.team], about: 'league', parts: ['Week in review: ', T(r.high.team), "'s ", V(pts(r.high.pts)), ...(r.close.w ? [' was the top score; the closest game went to ', T(r.close.w), ' by ', V(pts(r.close.m))] : [' was the top score; the closest game was a tie']), `; ${r.upsets ? `${num(r.upsets)} projected favourite${r.upsets === 1 ? '' : 's'} lost` : 'every projected favourite won'}.`] }));
  }
  if (facts.fieldSet) out.push(row('I227', { teams: facts.fieldSet, about: 'league', parts: ['The playoff field is set: ', ...facts.fieldSet.flatMap((id, i) => [i ? ', ' : '', T(id)]), '.'] }));
  return out.sort(byOrder).slice(0, 6);
}

/* ------------------------------------------------------------------ Stakes, from Fortune Teller's swing table (D33)
   sw: { odds: {team: p}, game: {fxId: {home: {team: p}, away: {team: p}}}, winOut: {team: p}, critical: {team: fxId} } */
export function stakesRows(M, week, fx, sw) {
  const out = [];
  const h = fx.home, a = fx.away;
  const g = sw.game[fx.id];
  if (!g) return out;
  const res = (id, won) => (won ? (id === h ? g.home : g.away) : (id === h ? g.away : g.home));
  for (const id of [h, a]) {
    const p = sw.odds[id], pw = res(id, true)[id], pl = res(id, false)[id];
    if (p > 0 && p < 1 && pw >= 0.9995) out.push(row('I1', { teams: [id], about: 'team', parts: ["Win and You're In: a win clinches a playoff place for ", T(id), ', whatever else happens.'], predict: { kind: 'win', team: id } }));
    if (p > 0 && p < 1 && pl <= 0.0005) out.push(row('I2', { teams: [id], about: 'team', parts: ['Must Win: a loss ends ', T(id), "'s playoff hopes."], predict: { kind: 'win', team: id } }));
    else if (p > 0.05 && pl > 0 && pl < 0.05) out.push(row('I8', { teams: [id], about: 'team', parts: ['Season on the line: a loss leaves ', T(id), ' a ', V(pct(pl)), ' playoff chance.'] }));
    if (p > 0 && p < 1 && Math.abs(pw - pl) >= 0.05) out.push(row('I3', { teams: [id], about: 'team', bump: pw - pl >= 0.4 ? 1 : 0, parts: [T(id), ': ', V(pct(pw)), ' with a win, ', V(pct(pl)), ' with a loss (', V(pct(p)), ' now).'] }));
    if (sw.critical[id] === fx.id && p > 0 && p < 1) out.push(row('I4', { teams: [id], about: 'team', bump: 1, parts: ['Most critical: no game ', T(id), ' has left moves its playoff chances more.'] }));
    if (p > 0 && p < 1 && sw.winOut[id] >= 0.9995) out.push(row('I11', { teams: [id], about: 'team', parts: [T(id), ' controls its own destiny: win out and it is in.'] }));
    if (p <= 0.0005) {
      const o = id === h ? a : h;
      if (sw.odds[o] > 0 && sw.odds[o] < 1) out.push(row('I10', { teams: [id, o], parts: ['Spoiler: ', T(id), ' is out of the race, and a win would hurt ', T(o), ' (', V(pct(res(o, false)[o])), ' with a loss).'] }));
    }
  }
  // Teams not playing in this game.
  const far = M.ids.filter((id) => id !== h && id !== a).map((id) => [id, g.home[id] - g.away[id]]).filter(([, d]) => Math.abs(d) >= 0.08).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]));
  for (const [id, d] of far.slice(0, 2)) out.push(row('I5', { teams: [id, d > 0 ? h : a], about: 'team', bump: Math.abs(d) >= 0.25 ? 1 : 0,
    parts: ['Watched from afar: ', T(id), ' is ', V(pct(g.home[id])), ' if ', T(h), ' wins and ', V(pct(g.away[id])), ' if ', T(a), ' wins.'] }));
  const moved = M.ids.reduce((x, id) => x + Math.abs(g.home[id] - g.away[id]), 0);
  if (sw.bigGame === fx.id) out.push(row('I6', { teams: [h, a], parts: ['Game of the week: no game moves the league’s playoff odds more.'] }));
  if (moved < 0.02) out.push(row('I9', { teams: [h, a], parts: ['Nothing at stake: no team’s playoff chance moves by more than a point either way.'] }));
  return out;
}

/* ------------------------------------------------------------------ the bracket (postseason) */
export function bracketRows(M, fx, b) {
  const out = [];
  const h = fx.home, a = fx.away;
  if (b.round === 'semi') out.push(row('I19', { teams: [h, a], parts: ['Playoff Semifinal: the winner plays for the Championship.'] }));
  if (b.round === 'championship') out.push(row('I20', { teams: [h, a], parts: ['The Championship: the winner takes the league.'] }));
  if (b.round === 'third' || b.round === 'consolation' || b.round === 'place') out.push(row('I22', { teams: [h, a], bump: b.round === 'third' ? 1 : 0, parts: [b.place ? `Plays for ${ord(b.place)} place.` : 'Consolation: this game decides the final places.'] }));
  if (b.periods && b.periods.length > 1) out.push(row('I178', { teams: [h, a], parts: [`A two-week matchup: weeks ${b.periods[0]} and ${b.periods[1]} of the NFL season count together.`] }));
  const champs = new Set((M.champions || []).filter((c) => c.teamId).map((c) => c.teamId));
  if (b.round === 'semi' || b.round === 'championship') for (const id of [h, a]) if (!champs.has(id)) out.push(row('I21', { teams: [id], about: 'team', bump: b.round === 'championship' ? 1 : 0, parts: [T(id), ` has never won the league; ${b.round === 'championship' ? 'a win' : 'two more wins'} would be its first title.`] }));
  return out;
}

/* ------------------------------------------------------------------ order and the home banner (D30, D36-D41) */
/* A game's phase (round 8): what its rows are shown for by default. Final -> After the final, live -> Live, else Before. */
export const phaseOf = (state) => (state === 'final' ? 'post' : state === 'live' ? 'live' : 'pre');
/** A game's headline: its weightiest row of the game's phase (D48 for a finished game), else its weightiest row. */
export function headlineOf(rows, state) {
  const sorted = [...rows].sort(byOrder);
  return sorted.find((r) => r.when === phaseOf(state)) || sorted[0] || null;
}
export const byOrder = (x, y) => y.weight - x.weight || CATS[x.cat].order - CATS[y.cat].order || Number(x.type.slice(1)) - Number(y.type.slice(1));

// Postseason labels keep today's medal tones on the home page only (D36); every other banner takes its row's
// category colour. Glyphs (D40): today's for the rows that had a banner, the category's for the rest.
const ROUND_TONE = { championship: 'gold', third: 'bronze', semi: 'silver', quarter: 'silver', consolation: 'muted' };
const ROUND_LABEL = { championship: 'Championship', third: 'Third Place Game', semi: 'Playoff Semifinal', quarter: 'Playoff Quarterfinal', consolation: 'Consolation' };
const TYPE_GLYPH = { I20: 'trophy', I19: 'bracket', I22: 'ladder', I2: 'alert', I1: 'check', I4: 'target', I24: 'crown' };
export function bannerFor(rows, teamId, round, state = 'pre') {
  if (!teamId) return null;
  // Once a game is final its banner speaks of what happened (as its card's headline does, review 3): pre-game rows,
  // a prediction that broke among them, no longer qualify for tiers 2 and 3. Round 8: while it is on, the third tier
  // reads the live rows, as the page does by default (Must Win and Win and You're In still count, tier 2).
  if (state === true || state === 'final') rows = rows.filter((r) => r.when === 'post');
  const phase = state === true || state === 'final' ? 'post' : state === 'live' ? 'live' : 'pre';
  // A row is the team's when the team is its subject: a matchup row naming it, or a team or player row led by it.
  const mine = rows.filter((r) => (r.about === 'matchup' ? r.teams.includes(teamId) : r.teams[0] === teamId));
  if (round) {
    const r = rows.find((x) => x.type === 'I20' || x.type === 'I19' || x.type === 'I22');
    return { tier: 1, label: ROUND_LABEL[round], tone: ROUND_TONE[round], glyph: round === 'third' ? 'medal' : TYPE_GLYPH[r ? r.type : 'I22'] || 'bracket', row: r || null };
  }
  const t2 = mine.find((r) => r.type === 'I2') || mine.find((r) => r.type === 'I1');
  if (t2) return { tier: 2, label: TYPES[t2.type][1], tone: t2.cat, glyph: TYPE_GLYPH[t2.type], row: t2 };
  // Review 4 (G41): a headline or more qualifies for tier 3 (weight 7 of 10 since round 8); the weightiest wins.
  const t3 = mine.filter((r) => r.weight >= BANNER_MIN && r.when === phase).sort(byOrder)[0];
  if (t3) return { tier: 3, label: TYPES[t3.type][1], tone: t3.cat, glyph: TYPE_GLYPH[t3.type] || t3.cat, row: t3 };
  return null;
}
