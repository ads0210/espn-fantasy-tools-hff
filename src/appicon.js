/**
 * Week 6 (plan P7, PD29, PD46): Install to Home Screen.
 *
 * The site can be added to a phone's home screen, named "League HQ", and opens full screen at the home page. The
 * icon is the tab icon redrawn full-bleed (the phone adds its own corners), with the letters drawn as shapes so it
 * renders the same on every device and in every build. `dev-tools/appicons.mjs` renders it to PNGs (180 for iPhone,
 * 192 and 512 for Android, and a maskable 512 with the letters inside the safe zone) and writes them, as base64, into
 * `src/appiconpng.js`: served from source like the favicon, so the icons travel with the code as text. A test checks
 * they were made from this exact drawing. The background is flat, which keeps each PNG to a few kilobytes.
 *
 * The manifest and the icons are served ahead of the League Password gate, like the favicon: a phone fetches them
 * without the page's cookies, and they hold no league data.
 */
export const APP_NAME = 'League HQ';

const LETTERS = [
  // E
  [70, 116, 44, 200], [70, 116, 120, 42], [70, 195, 106, 42], [70, 274, 120, 42],
  // F
  [206, 116, 44, 200], [206, 116, 112, 42], [206, 195, 98, 42],
  // T
  [328, 116, 118, 42], [365, 116, 44, 200],
];
const INK = '#E6F2E4', GREEN = '#63FF4A', BG = '#070A08';

/** The icon at 512 × 512. `maskable` shrinks the drawing into the centre 80% circle Android may crop to. */
export function appIconSvg({ maskable = false } = {}) {
  const rect = ([x, y, w, h], fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
  const letters = LETTERS.map((r, i) => rect(r, i >= 4 && i < 7 ? GREEN : INK)).join('');
  const art = `${letters}<rect x="136" y="346" width="240" height="30" rx="15" fill="${GREEN}"/>`;
  const body = maskable ? `<g transform="translate(256 256) scale(.72) translate(-256 -256)">${art}</g>` : art;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">`
    + `<rect width="512" height="512" fill="${BG}"/>${body}</svg>`;
}

/** The PNGs, as `dev-tools/appicons.mjs` writes them. */
export const APP_ICONS = [
  { file: 'apple-touch-icon.png', size: 180, maskable: false },
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
];

/** The web app manifest. `name` is fixed (PD46): at home-screen width a league's name is cut to about 11 letters. */
export function manifest() {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: BG,
    theme_color: BG,
    icons: APP_ICONS.filter((i) => i.file !== 'apple-touch-icon.png').map((i) => ({
      src: `/icons/${i.file}`, sizes: `${i.size}x${i.size}`, type: 'image/png', purpose: i.maskable ? 'maskable' : 'any',
    })),
  };
}

/** The tags every page's head carries: the manifest, the iPhone icon and name, and full screen when opened from it. */
export const APP_HEAD = '<link rel="manifest" href="/manifest.webmanifest">'
  + '<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">'
  + `<meta name="apple-mobile-web-app-title" content="${APP_NAME}">`
  + '<meta name="apple-mobile-web-app-capable" content="yes">'
  + '<meta name="mobile-web-app-capable" content="yes">'
  + '<meta name="apple-mobile-web-app-status-bar-style" content="black">';
