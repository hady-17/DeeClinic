// Builds the API for Vercel using the Build Output API (v3).
//
// Why not let Vercel compile it? The API imports @deeclinic/shared, a workspace package written in
// TypeScript. Bundling everything into one JavaScript file removes any dependence on how a builder
// treats workspace packages, and gives the same file in CI, locally and on Vercel.
//
//   npm run build:vercel -w @deeclinic/api
import { build } from 'esbuild';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '.vercel', 'output');
const fn = path.join(out, 'functions', 'index.func');

await rm(out, { recursive: true, force: true });
await mkdir(fn, { recursive: true });

const result = await build({
  entryPoints: [path.join(root, 'src', 'handler.ts')],
  outfile: path.join(fn, 'index.mjs'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: 'linked',
  legalComments: 'none',
  logLevel: 'warning',
  metafile: true,
  // Some dependencies still use require(). This lets them work inside an ES module bundle.
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
  // Optional native speed-ups for the websocket library. Not needed, and not installable on Vercel.
  external: ['bufferutil', 'utf-8-validate'],
});

await writeFile(path.join(fn, 'package.json'), JSON.stringify({ type: 'module' }));
await writeFile(
  path.join(fn, '.vc-config.json'),
  JSON.stringify(
    {
      runtime: 'nodejs22.x',
      handler: 'index.mjs',
      launcherType: 'Nodejs',
      // Express reads the raw request itself, so Vercel's body helpers stay off
      shouldAddHelpers: false,
      maxDuration: 30,
    },
    null,
    2,
  ),
);
// Every request goes to the one function, which does its own routing under /api/v1
await writeFile(
  path.join(out, 'config.json'),
  JSON.stringify({ version: 3, routes: [{ src: '/(.*)', dest: '/index' }] }, null, 2),
);

const bytes = Object.values(result.metafile.outputs).reduce((n, o) => n + o.bytes, 0);
console.log(`API bundle written to ${path.relative(process.cwd(), fn)} (${(bytes / 1024).toFixed(0)} KB)`);
