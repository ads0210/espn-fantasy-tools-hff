/**
 * A polling loop that stops on its own.
 *
 * Refresh cost scales with how long a page keeps polling, not with how many
 * people are watching, so an abandoned tab is the only real cost risk. Polling
 * pauses while the tab is hidden and stops entirely after four hours without
 * interaction — long enough to sit through a full slate of games, short enough
 * that a forgotten tab can never poll indefinitely.
 */
export function idleAwarePoller(fnName, intervalMs, idleMs = 4 * 60 * 60 * 1000) {
  return `
(function () {
  var lastActive = Date.now(), timer = null, stopped = false;
  ['pointerdown','keydown','scroll','focus','touchstart'].forEach(function (evt) {
    window.addEventListener(evt, function () {
      lastActive = Date.now();
      if (stopped) { stopped = false; hideResume(); tick(); }
    }, { passive: true });
  });
  function hideResume() { var b = document.getElementById('resumebar'); if (b) b.remove(); }
  function showResume() {
    if (document.getElementById('resumebar')) return;
    var b = document.createElement('div');
    b.id = 'resumebar'; b.className = 'msg info'; b.style.display = 'block';
    b.textContent = 'Live updates paused after 4 hours idle. Tap anywhere to resume.';
    var host = document.querySelector('.main');
    if (host) host.insertBefore(b, host.firstChild);
  }
  function tick() {
    if (timer) clearTimeout(timer);
    if (Date.now() - lastActive > ${idleMs}) { stopped = true; showResume(); return; }
    if (!document.hidden) { try { ${fnName}(); } catch (e) {} }
    timer = setTimeout(tick, ${intervalMs});
  }
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && !stopped) { lastActive = Date.now(); tick(); }
  });
  timer = setTimeout(tick, ${intervalMs});
})();`;
}
