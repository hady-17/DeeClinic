# DeeClinic

DeeClinic is a small TypeScript Node.js project demonstrating a Neon/Postgres-backed repository layer for user management and related domain models (appointments, services, offers, feedback, schedules, WhatsApp messages).

**Status**: development

**Key features**
- TypeScript + Node.js (CommonJS)
- Postgres (`pg`) connection management with simple validation
- Repository pattern (NeonUserRepository)
- Jest tests (under `tests/`)
- ESLint for linting
- Winston for structured logging

**Prerequisites**
- Node.js 18+ (or Node 22 in this workspace)
- npm
- A Postgres-compatible database (Neon, Heroku Postgres, local Postgres)

Environment variables
- `NEON_DATABASE_URL` or `DATABASE_URL` (one is required)
- `NODE_ENV` (optional; `development` enables console logging)
- `LOG_DIR` (optional; default is configured in `src/config`)

Quickstart

1. Install dependencies

```bash
npm install
```

2. Provide database URL in your environment (example .env):

```
NEON_DATABASE_URL=postgres://user:pass@host:5432/dbname
NODE_ENV=development
```

3. Development (fast reload with ts-node-dev)

```bash
npm run dev
```

4. Build and run (production-like)

```bash
npm run build
npm start
```

Scripts

- `npm run dev` — run with `ts-node-dev` (auto-restart)
- `npm run build` — runs `tsc` (prebuild runs lint and clean)
- `npm start` — runs `node build/index.js` (prestart runs `npm run build`)
- `npm test` — run Jest tests
- `npm run lint` — run ESLint on `src`

Debugging in VS Code

The workspace `.vscode/launch.json` is configured to attach to the compiled JS under `build/`. Use the "Debug TypeScript" configuration (F5) which will run the preLaunch task (`tsc`) then launch `build/index.js`.

Common issues & fixes

- Error: "bind message supplies N parameters, but prepared statement requires M"
  - Cause: number of `$` placeholders in the SQL string doesn't match the length of the `values` array passed to `pg`.
  - Fix: inspect the query string and values. Example debug snippet:

  ```js
  console.log('placeholders:', (text.match(/\$\d+/g) || []).length, 'values:', values.length, values);
  pool.query({ text, values });
  ```

- Error: "Cannot find module 'build/index.js'"
  - Cause: `tsc` emitted files to a different directory than expected (or rootDir/outDir mismatch).
  - Fix: ensure `tsconfig.json` sets `rootDir` to `src` and `outDir` to `build`; run `npm run build`.

- tsc error TS6059 about files not under `rootDir`
  - Cause: `tests/` were included in `tsconfig` while `rootDir` is set to `src`.
  - Fix: keep `tests` out of the `tsc` `include` for production build (Jest will run tests separately).

- Duplicate email / "User already exists" while creating users in `src/index.ts` demo
  - Cause: demo creates users each run; if the random suffix collides or the DB already has the email, the insert will be rejected.
  - Fix: either clear the table between runs, use a larger random range, or handle `UNIQUE` conflicts gracefully.

Logging

- Logs are written via `winston`. In development `console` transport is enabled. Log files are placed under the configured `LOG_DIR`.

Tests

- Run unit tests with:

```bash
npm test
```

Contributing

- Please open an issue or PR.
- Follow the existing TypeScript and eslint conventions.

License

This project has no license specified. Add a `LICENSE` file if you intend to open-source it.
