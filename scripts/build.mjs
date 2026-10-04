#!/usr/bin/env node
/**
 * Build step.
 *
 * Runs via npm's `prepare` hook, which Cloudflare's build machine triggers
 * during install. That matters: Workers Builds does not honour the `build`
 * block in the Wrangler configuration file, so a repo-local hook is the only
 * way to run a build step without every forked deployment having to configure
 * a build command in the dashboard by hand.
 *
 * Two jobs:
 *   1. Generate the one-time setup code (printed here, hashed into the bundle).
 *   2. Compile each front-end tool: JSX through esbuild, Tailwind through its CLI.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync, writeFileSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { generateSetupCode } from './generate-setup-code.mjs';
import { LIMIT_JS } from '../src/pages/limitnotice.js';

const TOOLS = [
  {
    key: 'draft-helper',
    title: 'Draft Helper',
    entry: 'app/draft-helper/main.jsx',
    css: 'app/draft-helper/styles.css',
  },
  {
    key: 'live-matchups',
    title: 'Live Matchups',
    entry: 'app/live-matchups/main.jsx',
    css: 'app/live-matchups/styles.css',
  },
  {
    key: 'trade-analyzer',
    title: 'Trade Analyzer',
    entry: 'app/trade-analyzer/main.jsx',
    css: 'app/trade-analyzer/styles.css',
  },
  {
    key: 'hall-of-fame',
    title: 'Hall of Fame',
    entry: 'app/hall-of-fame/main.jsx',
    css: 'app/hall-of-fame/styles.css',
  },
  {
    key: 'fortune-teller',
    title: 'Fortune Teller',
    entry: 'app/fortune-teller/main.jsx',
    css: 'app/fortune-teller/styles.css',
    worker: 'app/fortune-teller/worker.js',
  },
  {
    key: 'llm-export',
    title: 'LLM Data Export',
    entry: 'app/llm-export/main.jsx',
    css: 'app/llm-export/styles.css',
  },
  {
    key: 'site-api',
    title: 'Site API',
    entry: 'app/site-api/main.jsx',
    css: 'app/site-api/styles.css',
  },
  {
    key: 'site-backend',
    title: 'Site Backend',
    entry: 'app/site-backend/main.jsx',
    css: 'app/site-backend/styles.css',
  },
];

/**
 * The tool shell. Deliberately minimal and self-contained — no external fonts,
 * scripts or styles — so nothing loads before the Worker's auth gate has run.
 */
function shellHtml(tool) {
  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<title>${tool.title}</title>
<link rel="stylesheet" href="./styles.css">
<style>html,body{margin:0;background:#0A0D0B;}</style>
<script>
/* The palette is keyed off html[data-theme]. Setting it here rather than in a
   React effect means the first paint is already themed: an effect runs after
   paint, so the tool flashed with every colour variable unresolved. Light mode
   is honoured before any bundle loads. */
try{var m=document.cookie.match(/(?:^|; )eft_theme=([^;]*)/);
document.documentElement.dataset.theme=(m&&decodeURIComponent(m[1])==='light')?'light':'dark';
var r=document.cookie.match(/(?:^|; )eft_motion=([^;]*)/);
if(r&&decodeURIComponent(r[1])==='reduce')document.documentElement.classList.add('stillness');}catch(e){}
</script>
<script>${LIMIT_JS.split('</script').join('<\\/script')}</script>
</head>
<body>
<div id="root"></div>
<script src="./bundle.js" defer></script>
</body>
</html>
`;
}

function run(cmd, args) {
  execFileSync(cmd, args, { stdio: 'inherit' });
}

generateSetupCode();

for (const tool of TOOLS) {
  const outDir = `public/apps/${tool.key}`;
  mkdirSync(outDir, { recursive: true });

  console.log(`\nBuilding ${tool.key}…`);
  run('npx', [
    'esbuild', tool.entry,
    '--bundle',
    '--format=iife',
    '--target=es2020',
    '--jsx=automatic',
    '--minify',
    '--loader:.js=jsx',
    `--outfile=${outDir}/bundle.js`,
    '--log-level=warning',
  ]);

  if (tool.worker && existsSync(tool.worker)) {
    run('npx', ['esbuild', tool.worker, '--bundle', '--format=iife', '--target=es2020', '--minify', `--outfile=${outDir}/worker.js`, '--log-level=warning']);
  }

  if (existsSync(tool.css)) {
    run('npx', [
      '@tailwindcss/cli',
      '-i', tool.css,
      '-o', `${outDir}/styles.css`,
      '--minify',
    ]);
  }
  writeFileSync(`${outDir}/index.html`, shellHtml(tool));
  console.log(`  -> ${outDir}/bundle.js, styles.css, index.html`);
}

writeBuildInfo();
console.log('\nBuild complete.\n');

/** Wrangler's config is JSON with comments; comments are dropped outside strings. */
function readJsonc(path) {
  const src = readFileSync(path, 'utf8');
  let out = '', inStr = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inStr) { out += c; if (c === '\\') { out += src[++i]; } else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; out += c; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; out += '\n'; continue; }
    if (c === '/' && src[i + 1] === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i++; continue; }
    out += c;
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

/**
 * What this deploy was built from, for Site Backend's Deployment panel: the size of
 * every client bundle and the Worker's settings as the config file declares them.
 * Written the way the setup code is, over a committed placeholder.
 */
function writeBuildInfo() {
  const bundles = [];
  for (const tool of TOOLS) {
    for (const file of ['bundle.js', 'styles.css', 'worker.js']) {
      const path = `public/apps/${tool.key}/${file}`;
      if (!existsSync(path)) continue;
      const buf = readFileSync(path);
      bundles.push({ name: `${tool.key}/${file}`, bytes: statSync(path).size, gzip: gzipSync(buf).length,
        hash: createHash('sha256').update(buf).digest('hex').slice(0, 12) });
    }
  }
  let worker = null;
  try {
    const w = readJsonc('wrangler.jsonc');
    worker = {
      name: w.name || null,
      compatibilityDate: w.compatibility_date || null,
      crons: (w.triggers && w.triggers.crons) || [],
      observability: Boolean(w.observability && w.observability.enabled),
      migrations: (w.migrations || []).map((m) => ({ tag: m.tag, classes: [...(m.new_sqlite_classes || []), ...(m.new_classes || [])] })),
      bindings: {
        durableObjects: ((w.durable_objects && w.durable_objects.bindings) || []).map((b) => ({ name: b.name, class: b.class_name })),
        kv: (w.kv_namespaces || []).map((k) => k.binding), r2: (w.r2_buckets || []).map((b) => b.binding),
        versionMetadata: (w.version_metadata && w.version_metadata.binding) || null,
      },
    };
  } catch (err) {
    console.log('  (could not read wrangler.jsonc for build info: ' + String(err && err.message) + ')');
  }
  const info = { placeholder: false, builtAt: new Date().toISOString(), worker, bundles };
  writeFileSync('src/generated/build-info.js',
    '// Generated by scripts/build.mjs. Do not commit a real copy: the placeholder is what belongs in the repo.\n'
    + 'export const BUILD_INFO = ' + JSON.stringify(info, null, 2) + ';\n');
  console.log(`  -> src/generated/build-info.js (${bundles.length} files)`);
}
