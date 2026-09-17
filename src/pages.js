/**
 * The site's server-rendered pages.
 *
 * A re-export only. This held the login page, the dashboard's markup, its
 * stylesheet and its whole client script in one file, which grew past the point
 * where editing it by anchor was safe — most of a run of near-misses landed
 * here. Each concern now sits in its own module; this keeps the import path
 * every caller already uses, so nothing else had to change.
 */
export { linkTools } from './pages/linktools.js';
export { loginPage } from './pages/login.js';
export { TOOL_ICONS } from './pages/icons.js';
export { dashboardPage } from './pages/dashboard.js';
export { idleAwarePoller } from './pages/poller.js';
export { DASHBOARD_CSS } from './pages/dashboard-css.js';
export { dashboardClientJs } from './pages/dashboard-client.js';
export { THEME_COOKIE, TEAM_COOKIE } from './ui.js';
