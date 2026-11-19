// Loads the built Vercel bundle the way Vercel's Node launcher does (import the module, call its
// default export with a request and response) and checks that it answers. Needs no database.
//
//   npm run smoke:vercel -w @deeclinic/api     (after build:vercel)
import { existsSync, readFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fnDir = path.join(root, '.vercel', 'output', 'functions', 'index.func');
const bundle = path.join(fnDir, 'index.mjs');

const fail = (msg) => {
  console.error(`SMOKE TEST FAILED: ${msg}`);
  process.exit(1);
};

if (!existsSync(bundle)) fail('the bundle is missing. Run build:vercel first.');
const config = JSON.parse(readFileSync(path.join(fnDir, '.vc-config.json'), 'utf8'));
if (config.handler !== 'index.mjs' || config.launcherType !== 'Nodejs') fail('.vc-config.json is not set up for Node');

// Only what the health check needs. Real secrets are not required to start the app.
process.env.NODE_ENV = 'test';
const mod = await import(pathToFileURL(bundle).href);
if (typeof mod.default !== 'function') fail('the bundle does not export a request handler as its default');

const server = http.createServer(mod.default);
await new Promise((resolve) => server.listen(0, resolve));
const base = `http://127.0.0.1:${server.address().port}`;

try {
  const health = await fetch(`${base}/api/v1/health`);
  const body = await health.json();
  if (health.status !== 200 || body.status !== 'ok') fail(`/health answered ${health.status} ${JSON.stringify(body)}`);

  const missing = await fetch(`${base}/api/v1/nope`);
  const err = await missing.json();
  if (missing.status !== 404 || err.error?.code !== 'NOT_FOUND') fail('unknown routes do not use the error format');

  const noLogin = await fetch(`${base}/api/v1/clients`);
  if (noLogin.status !== 401) fail(`a protected route answered ${noLogin.status} instead of 401`);

  // Shared code (validation schemas) must be inside the bundle, not a missing import
  const badLogin = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'nope', password: '' }),
  });
  if (badLogin.status !== 400) fail(`login validation answered ${badLogin.status} instead of 400`);

  console.log('Smoke test passed: health, error format, login required, and shared validation all work from the bundle.');
} finally {
  server.close();
}
process.exit(0);
