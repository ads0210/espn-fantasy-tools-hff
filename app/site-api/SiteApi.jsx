import React, { useCallback, useEffect, useRef, useState } from "react";
import ToolControls from "../shared/ToolControls.jsx";
import TeamSelect from "../shared/TeamSelect.jsx";
import { PALETTES, BASE_CSS, BACKDROP, TEAM_COOKIE } from "../../src/ui.js";
import { TOOL_CSS, PAGE_CSS } from "./css.js";
import * as PG from "./page.js";
import { freshenWhenStale } from "../shared/freshen.js";
import { watchScrollers } from "../../src/hscroll.js";

/**
 * Site API: the league's data for spreadsheets, scripts and phones.
 *
 * The page teaches people to use the API on the platforms they already have: the league's key, the five
 * endpoints with Try it, eleven platforms of guides, how often to ask, troubleshooting, the description file,
 * and downloads. React draws the header, the endpoint card and the team pickers with the site's shared
 * components; page.js draws the other sections as the design sample drew them. The page fetches its data on
 * load and again when the reader comes back to the tab; it does not poll.
 */

const ROUTE = "/apps/site-api/api";

function writeTeamCookie(id) {
  try {
    document.cookie = TEAM_COOKIE + "=" + encodeURIComponent(id == null ? "" : id) + "; path=/; max-age=31536000; samesite=lax";
  } catch (e) { /* the choice lasts this visit */ }
}

const PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12-7.5z"/></svg>';

function Head({ t, count, id }) {
  return (
    <div className="sechead" id={id || undefined}>
      <span className="t">{t}</span><span className="rule" />{count ? <span className="count">{count}</span> : null}
    </div>
  );
}

/** The endpoint card: tabs, what each answers, Try it, and its field guide. */
function Endpoints({ bump }) {
  const S = PG.S;
  const e = PG.endpoint(S.ep);
  const fmt = S.epFormat[e.key] || "json", team = S.epTeam[e.key] || "";
  const url = PG.endpointUrl(e.key, { team, format: fmt, logos: S.logos });
  const t = PG.tryState();
  const tryRef = useRef(null), fieldRef = useRef(null);
  useEffect(() => { if (tryRef.current) PG.attachViewers(tryRef.current); });
  const open = !!S.openField[e.key];
  const rows = e.key === "full" ? null : PG.endpointRows(e.key, team);
  const n = e.key === "full" ? 32 : PG.fieldCount(rows);
  const teams = PG.teams();
  const opts = [{ value: "", label: "All teams", logo: null }].concat(teams.map((x) => ({ value: String(x.teamId), label: x.name, logo: x.logo })));
  const set = (fn) => () => { fn(); bump(); };
  return (
    <div id="p-ep">
      <div className="eptabs" role="tablist" aria-label="Endpoints">
        {PG.endpoints().map((x) => (
          <button key={x.key} type="button" className="eptab" role="tab" aria-selected={S.ep === x.key} onClick={set(() => { S.ep = x.key; })}>
            <span className="m">GET</span><span className="p">{x.path}</span><span className="z">{x.csv ? "JSON · CSV" : "JSON"}</span>
          </button>
        ))}
      </div>
      <div className="panel epcard" role="tabpanel" id={e.key}>
        <p className="epsent">{e.sentence}{e.team ? <React.Fragment> <code>?team=</code> gives one team’s {e.key === "rosters" ? "roster" : "matchup"}.</React.Fragment> : null}</p>
        <div className="epfacts">
          <div className="fact wide"><span className="k">Made for</span><span className="v">{e.madeFor}</span></div>
          <div className="fact"><span className="k">Size</span><span className="v"><span className="valg">{PG.epSize(e.key) || e.size.replace("About ", "").replace(" of JSON; about 120 to 180 KB sent", "")}</span>{PG.epSize(e.key) ? <small> {e.key === "full" ? "of JSON now, without logos" : e.team ? "now, all teams" : "now"}</small> : null}</span></div>
          <div className="fact"><span className="k">Refreshes</span><span className="v"><span className="valg">{e.refreshWords()}</span></span></div>
          <div className="fact"><span className="k">Takes</span><span className="v"><span className="valg">{(e.team ? "team, " : "") + (e.csv ? "format, " : "") + (e.logos ? "logos, " : "") + "name, pretty"}</span></span></div>
        </div>
        <div className="epctl">
          {e.team ? (
            <div className="eppick">
              <TeamSelect label="Team" value={team} options={opts} placeholder="All teams"
                onChange={(v) => { S.epTeam[S.ep] = v == null ? "" : String(v); delete S.tries[S.ep]; bump(); }} />
            </div>
          ) : null}
          {e.csv ? (
            <div className="seg" role="group" aria-label="Format">
              <button type="button" aria-pressed={fmt === "json"} onClick={set(() => { S.epFormat[S.ep] = "json"; delete S.tries[S.ep]; })}>JSON</button>
              <button type="button" aria-pressed={fmt === "csv"} onClick={set(() => { S.epFormat[S.ep] = "csv"; delete S.tries[S.ep]; })}>CSV</button>
            </div>
          ) : null}
          {e.logos ? (
            <div className="seg" role="group" aria-label="Logos">
              <button type="button" aria-pressed={!S.logos} onClick={set(() => { S.logos = false; delete S.tries[S.ep]; })}>Without logos</button>
              <button type="button" aria-pressed={S.logos} onClick={set(() => { S.logos = true; delete S.tries[S.ep]; })}>With logos</button>
            </div>
          ) : null}
          <span className="grow" />
          <div className="tryrow">
            <button type="button" className="minibtn go" disabled={!t.ok || S.trying} onClick={() => PG.doTry(bump)} dangerouslySetInnerHTML={{ __html: PLAY + "Try it" }} />
            <span id="tryNote" dangerouslySetInnerHTML={{ __html: PG.tryNote() }} />
          </div>
        </div>
        <div className="urlline">
          <span className="meth">GET</span><span className="u" dangerouslySetInnerHTML={{ __html: PG.hlUrl(url) }} />
          <span className="ua"><button type="button" className="minibtn" data-act="copy" data-text={url} dangerouslySetInnerHTML={{ __html: PG.ICON.copy + "Copy" }} /></span>
        </div>
        <p className="small" style={{ marginTop: "8px" }}>
          Send the key as the header <code>Authorization: Bearer eft_…</code>
          {S.inAddress ? <React.Fragment>, or add <code>&amp;key=eft_…</code> for tools that can’t send headers, such as a Google Sheets formula.</React.Fragment> : ". This site takes the key in a header only."}
          {" "}Add <code>name=</code> to give each program its own turn.
        </p>
        <div id="tryOut" ref={tryRef} dangerouslySetInnerHTML={{ __html: PG.tryOut() }} />
        <button type="button" className="more inline" aria-expanded={open}
          onClick={() => { const next = !S.openField[e.key]; S.openField[e.key] = next; bump(); requestAnimationFrame(() => { if (fieldRef.current) PG.disclose(fieldRef.current, next); }); }}>
          Field guide · {n}{e.key === "full" ? " sections" : " fields"}<i />
        </button>
        <div className="fguide disc" ref={fieldRef} hidden={!open} dangerouslySetInnerHTML={{ __html: open ? PG.fieldsHtml(e.key) : "" }} />
      </div>
    </div>
  );
}

/** Build something: the introduction and the team the examples are filled in for. */
function GuidesIntro({ bump }) {
  const S = PG.S;
  const c = PG.guideCounts();
  const teams = PG.teams();
  return (
    <React.Fragment>
      <Head t="Build something" count={`${c.platforms} platforms · ${c.jobs} jobs`} id="guides" />
      <div className="panel">
        <div className="gintro">
          <p className="lede">Pick the platform you already use, then the job you want done. Every example has <b>the league’s key and your team filled in</b>, asks no more often than the site allows, and <b>pauses or stops itself</b> when the site says it asked too soon. The key shows as <code>eft_…</code> until you press Show above; Copy always copies the working version.</p>
          <TeamSelect label="Examples for" value={S.guideTeam == null ? "" : String(S.guideTeam)} placeholder="Select a team"
            options={teams.map((x) => ({ value: String(x.teamId), label: x.name, logo: x.logo }))}
            onChange={(v) => { S.guideTeam = Number(v) || null; writeTeamCookie(S.guideTeam); PG.renderPart("plats"); bump(); }} />
        </div>
      </div>
    </React.Fragment>
  );
}

export default function SiteApi() {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [theme, setTheme] = useState(() => (typeof document !== "undefined" ? document.documentElement.getAttribute("data-theme") : "dark") || "dark");
  const [, setTick] = useState(0);
  const [toast, setToast] = useState(null);
  const bump = useCallback(() => setTick((n) => n + 1), []);
  const pageRef = useRef(null);
  const freshRef = useRef(null);
  useEffect(() => () => { if (freshRef.current) freshRef.current(); }, []);
  const refs = { strip: useRef(null), alert: useRef(null), key: useRef(null), plats: useRef(null), pace: useRef(null), err: useRef(null), schema: useRef(null), dl: useRef(null) };

  const load = useCallback(() => {
    return fetch(ROUTE, { credentials: "same-origin", cache: "no-store" })
      .then((r) => r.json().then((j) => ({ status: r.status, j })))
      .then(({ status, j }) => {
        if (status === 401 && j && j.locked) { location.reload(); return; }
        if (!j || !j.ok) { setFailed(true); return; }
        PG.setPayload(j, {
          onChange: () => bump(),
          toast: (text) => { setToast(text); clearTimeout(load.t); load.t = setTimeout(() => setToast(null), 3200); },
        });
        setData(j);
        // Answered from what was stored: while a rebuild runs behind it, ask again until the new build arrives.
        if (freshRef.current) { freshRef.current(); freshRef.current = null; }
        if (j.ready && j.refreshing) {
          freshRef.current = freshenWhenStale({
            stamp: j.builtAt, ttlMs: 0,
            refetch: () => fetch(ROUTE, { credentials: "same-origin", cache: "no-store" }).then((r) => r.json()),
            stampOf: (p) => (p && p.ok ? p.builtAt : null),
            apply: (p) => { PG.setPayload(p); setData(p); },
            done: () => { const p = PG.payload(); if (p && p.refreshing) { p.refreshing = false; PG.renderPart("strip"); } },
          });
        }
      })
      .catch(() => setFailed(true));
  }, [bump]);

  useEffect(() => { load(); }, [load]);
  // Fetched again when the reader comes back to the tab, never on a timer.
  useEffect(() => {
    const on = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, [load]);
  useEffect(() => {
    const on = () => bump();
    window.addEventListener("tzchange", on);
    return () => window.removeEventListener("tzchange", on);
  }, [bump]);

  // The drawn sections: redrawn whenever the payload changes.
  useEffect(() => {
    if (!data) return;
    PG.mount(Object.fromEntries(Object.entries(refs).map(([k, r]) => [k, r.current])));
    PG.renderAll();
    if (typeof window !== "undefined") window.__SITEAPI_SEEN__ = { ready: Boolean(data.ready), sections: Object.keys(data.sizes || {}).length };
  }, [data]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Every drawn scroller on the page stays attached however its part was drawn.
  useEffect(() => (data ? watchScrollers(pageRef.current) : undefined), [Boolean(data)]);   // eslint-disable-line react-hooks/exhaustive-deps

  // The clock: ages and the Try it note every second, the pace meter's sweep, and the strip every 15 seconds.
  useEffect(() => {
    if (!data) return undefined;
    const a = setInterval(() => { PG.tick(); bump(); }, 1000);
    const b = setInterval(() => PG.tickMeters(), 120);
    const c = setInterval(() => PG.renderPart("strip"), 15000);
    return () => { clearInterval(a); clearInterval(b); clearInterval(c); };
  }, [data, bump]);

  const styleTag = <style dangerouslySetInnerHTML={{ __html: `${PALETTES}\n${BASE_CSS}\n${TOOL_CSS}\n${PAGE_CSS}` }} />;
  const league = (data && data.league && data.league.name) || "League";
  const Header = (
    <div className="toolhead">
      <a className="toolmark homelink" href="/" aria-label="Back to home">
        <svg className="mark" viewBox="0 0 1000 150" role="img" aria-label="ESPN Fantasy Tools">
          <text x="500" y="74" textAnchor="middle" textLength="980" lengthAdjust="spacingAndGlyphs" fontSize="86" fontWeight="900" letterSpacing="-2"
            fontFamily="ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif">
            <tspan className="m1">ESPN</tspan><tspan className="m2"> FANTASY TOOLS</tspan>
          </text>
          <path className="rule" d="M10 100 H990" /><path className="rulelive" d="M10 100 H360" />
          <text x="500" y="137" textAnchor="middle" fontSize="30" fontWeight="700" letterSpacing="14" fill="var(--ink-3)"
            fontFamily="ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif">LEAGUE HQ</text>
        </svg>
      </a>
      <div className="toolid"><p className="eyebrow">Site API</p><div className="toolleague">{league}</div></div>
      <div className="toolctl"><ToolControls steps={PG.HELP_API} label="How to use Site API" theme={theme} onTheme={setTheme} /></div>
    </div>
  );
  const Foot = (
    <React.Fragment>
      <div className="grow" />
      <div className="pageaction"><a className="pagebtn" href="/">&larr; Back to home</a></div>
      <div className="toolfoot"><a className="gh" href="https://github.com/shortcutsbin-netizen" target="_blank" rel="noopener noreferrer">GitHub - shortcutsbin-netizen</a></div>
    </React.Fragment>
  );

  if (!data) {
    return (
      <React.Fragment>
        {styleTag}
        <div dangerouslySetInnerHTML={{ __html: BACKDROP }} />
        <div className="wrap v-api">
          {Header}
          {failed ? (
            <div className="placeholder" style={{ marginTop: "40px" }}><b>Site API could not load</b><span>The page’s data could not be fetched just now. Reload to try again.</span></div>
          ) : <div className="loadbox"><i />Opening Site API</div>}
          {Foot}
        </div>
      </React.Fragment>
    );
  }

  return (
    <React.Fragment>
      {styleTag}
      <div dangerouslySetInnerHTML={{ __html: BACKDROP }} />
      <div className="wrap v-api" ref={pageRef} onClick={(e) => PG.handleClick(e)}>
        {Header}
        <div ref={refs.alert} />
        <div ref={refs.strip} id="p-strip" />
        {!data.ready ? (
          <div className="placeholder" style={{ marginTop: "14px" }}><b>No league data yet</b><span>The API answers from the league pull. If that has not run yet, whoever administers this site can start it from Site Configuration. The endpoints and guides are all here for when it has.</span></div>
        ) : null}
        <Head t="Your league’s key" count="One for the whole league · opens the API only" id="key" />
        <div ref={refs.key} id="p-key" />
        <Head t="What you can ask for" count="Five endpoints · one key · read-only" id="endpoints" />
        <Endpoints bump={bump} />
        <div id="p-guides">
          <GuidesIntro bump={bump} />
          <div className="plats" ref={refs.plats} />
        </div>
        <div ref={refs.pace} id="p-pace" />
        <div ref={refs.err} id="p-err" />
        <div ref={refs.schema} id="p-schema" />
        <div ref={refs.dl} id="p-dl" />
        {Foot}
      </div>
      {toast ? <div className="apitoast" role="status">{toast}</div> : null}
    </React.Fragment>
  );
}
