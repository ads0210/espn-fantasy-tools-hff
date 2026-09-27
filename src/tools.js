/**
 * Tool registry.
 *
 * Every tool is always present in the build — visibility is a runtime KV flag,
 * never conditional compilation. Three states:
 *
 *   visible     shown on the dashboard, reachable by anyone with the League Password
 *   hidden      hidden from the dashboard and blocked at the route level for everyone
 *   admin       hidden and route-blocked for ordinary users, but shown and reachable
 *               once the Admin Password has been presented — the same mechanism
 *               that already gates Site Configuration, reused rather than reinvented
 */

export const VISIBILITY = { VISIBLE: 'visible', HIDDEN: 'hidden', ADMIN: 'admin' };

/* The order here is the default order everywhere: the home page's tiles (until an
   administrator arranges them in Site Configuration), the setup wizard, Site
   Configuration's lists and Site Backend's tabs. */
export const TOOLS = [
  {
    key: 'draft-helper',
    name: 'Draft Helper',
    description: 'Live draft board, roster needs and recommended targets.',
    href: '/apps/draft-helper/',
    defaultVisibility: VISIBILITY.VISIBLE,
  },
  {
    key: 'live-matchups',
    name: 'Live Matchups',
    description: "This week's scoreboard, lineups and live win probability.",
    href: '/apps/live-matchups/',
    defaultVisibility: VISIBILITY.VISIBLE,
  },
  {
    key: 'hall-of-fame',
    name: 'Hall of Fame',
    description: 'Champions, all-time standings and every team\u2019s record.',
    href: '/apps/hall-of-fame/',
    defaultVisibility: VISIBILITY.VISIBLE,
  },
  {
    key: 'fortune-teller',
    name: 'Fortune Teller',
    description: 'Every way the rest of the season can go, and where each leaves you.',
    href: '/apps/fortune-teller/',
    defaultVisibility: VISIBILITY.VISIBLE,
  },
  {
    key: 'trade-analyzer',
    name: 'Trade Analyzer',
    description: 'Every offer on the table, broken down for both sides.',
    href: '/apps/trade-analyzer/',
    defaultVisibility: VISIBILITY.VISIBLE,
  },
  {
    key: 'llm-export',
    name: 'LLM Data Export',
    description: 'For those who wish to outsource their thinking.',
    href: '/apps/llm-export/',
    defaultVisibility: VISIBILITY.VISIBLE,
  },
  /* The site's own workings. Admin-only by default, because it shows who visited
     and when, which members cannot see anywhere else. It never counts toward the
     rule that one tool must stay visible to the league: it is not a league tool. */
  {
    key: 'site-backend',
    name: 'Site Backend',
    description: 'How the site is running: health, data, traffic, and logs.',
    href: '/apps/site-backend/',
    defaultVisibility: VISIBILITY.ADMIN,
    backstage: true,
  },
];

/** The tools the league itself uses: everything but the site's own backend. */
export const LEAGUE_TOOLS = TOOLS.filter((t) => !t.backstage);

/**
 * Site Configuration is deliberately not in TOOLS: it is always present and
 * always admin-gated, so offering a visibility toggle for it would only create
 * a way to lock yourself out.
 */
export const SITE_CONFIG_TOOL = {
  key: 'site-config',
  name: 'Site Configuration',
  description: 'Passwords, ESPN connection, tools and data re-pulls.',
  href: '/config',
};

export function getTool(key) {
  return TOOLS.find((t) => t.key === key) || null;
}

export function visibilityOf(cfg, key) {
  const tool = getTool(key);
  if (!tool) return null;
  const stored = (cfg.toolVisibility || {})[key];
  return stored || tool.defaultVisibility;
}

/**
 * Tools to show on the dashboard. Admin-only tools appear only when the caller
 * has already proven the Admin Password for this request.
 */
/**
 * The tools a dashboard should list.
 *
 * Admin-only tools are listed for everyone, carrying the same restricted flag
 * Site Configuration does, and the Admin Password is asked for when one is
 * opened. Hiding them entirely conflated two different states: "not visible"
 * means gone, and "admin only" means present but locked. A tool that vanishes
 * cannot be told apart from one that was never installed, which left an owner
 * with no way to see what they had restricted.
 */
export function visibleTools(cfg) {
  const out = [];
  for (const tool of TOOLS) {
    const vis = visibilityOf(cfg, tool.key);
    if (vis === VISIBILITY.VISIBLE) out.push({ ...tool, adminOnly: false });
    else if (vis === VISIBILITY.ADMIN) out.push({ ...tool, adminOnly: true });
  }
  return out;
}

/** Can this request reach the tool's own routes? */
export function toolReachable(cfg, key, { adminVerified = false } = {}) {
  const vis = visibilityOf(cfg, key);
  if (vis === VISIBILITY.VISIBLE) return true;
  if (vis === VISIBILITY.ADMIN) return adminVerified;
  return false;
}

/**
 * Apply a visibility change, refusing any change that would leave the dashboard
 * with nothing on it. Site Config is always reachable regardless, but a site
 * whose grid is empty for every ordinary member is a configuration mistake
 * rather than a legitimate state.
 */
export function applyVisibility(cfg, key, visibility) {
  if (!getTool(key)) return { ok: false, error: `Unknown tool "${key}".` };
  if (!Object.values(VISIBILITY).includes(visibility)) {
    return { ok: false, error: `Unknown visibility "${visibility}".` };
  }
  const next = { ...(cfg.toolVisibility || {}), [key]: visibility };
  const anyVisible = LEAGUE_TOOLS.some((t) => (next[t.key] || t.defaultVisibility) === VISIBILITY.VISIBLE);
  if (!anyVisible) {
    return { ok: false, error: 'At least one tool must stay visible to your league.' };
  }
  return { ok: true, toolVisibility: next };
}

export function describeTools(cfg) {
  return TOOLS.map((t) => ({
    key: t.key,
    name: t.name,
    description: t.description,
    href: t.href,
    visibility: visibilityOf(cfg, t.key),
    ...(t.backstage ? { backstage: true } : {}),
  }));
}

/* ---------------------------------------------------------------- home page order */

/** Every tile the home page can carry, in the default order: the tools, then Site Configuration. */
export function defaultTileOrder() {
  return [...TOOLS.map((t) => t.key), SITE_CONFIG_TOOL.key];
}

/**
 * An administrator's order made whole: unknown and repeated keys dropped, and any
 * tile missing from it (a tool added in a later release) placed where the default
 * order puts it, just after the nearest tile that precedes it there.
 */
export function normaliseTileOrder(saved) {
  const def = defaultTileOrder();
  const known = new Set(def);
  const out = [];
  for (const k of Array.isArray(saved) ? saved : []) if (known.has(k) && !out.includes(k)) out.push(k);
  for (let i = 0; i < def.length; i++) {
    const k = def[i];
    if (out.includes(k)) continue;
    let at = 0;
    for (let j = i - 1; j >= 0; j--) { const p = out.indexOf(def[j]); if (p >= 0) { at = p + 1; break; } }
    out.splice(at, 0, k);
  }
  return out;
}

/** The home page's tiles in this site's order. */
export function orderTiles(cfg, tiles) {
  const order = normaliseTileOrder(cfg.toolOrder);
  const rank = new Map(order.map((k, i) => [k, i]));
  return tiles.slice().sort((a, b) => (rank.get(a.key) ?? 999) - (rank.get(b.key) ?? 999));
}

/** The order as Site Configuration draws it: every tile, with whether it reaches the home page. */
export function describeTileOrder(cfg) {
  const custom = Array.isArray(cfg.toolOrder) && cfg.toolOrder.length > 0;
  return {
    custom,
    tiles: normaliseTileOrder(cfg.toolOrder).map((k) => {
      if (k === SITE_CONFIG_TOOL.key) return { key: k, name: SITE_CONFIG_TOOL.name, visibility: 'always' };
      const t = getTool(k);
      return { key: k, name: t.name, visibility: visibilityOf(cfg, k) };
    }),
  };
}
