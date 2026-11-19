# DeeClinic

A web app for running a beauty clinic: bookings, clients, packages, payments in USD and LBP, and (coming) automatic WhatsApp reminders. Built for one clinic and one owner today, with room for staff roles and more branches later.

## Status

| Phase | What | State |
|---|---|---|
| 0 | Setup: monorepo, login, health check | Done, except error tracking and the Meta WhatsApp verification |
| 1 | Clinic settings, services, clients, calendar, visit notes, client history, CSV import, audit log | Done |
| Auth | Owner-managed users, roles and permissions, deactivation, rate limiting, password reset | Done |
| 2 | Packages, exchange rates, payments, voiding with a passcode | Done |
| 3 | WhatsApp reminders and the daily job | Not started |
| 4 | Dashboard and polish | Not started |
| 5 | Pilot and launch | Not started |

The full plan is in [docs/02-plan.md](docs/02-plan.md).

## How it fits together

```
Browser ──► Web app (Next.js) ──► API (Express) ──► Supabase Postgres
                 │                    │
                 └── session only     └── Supabase Auth, WhatsApp Cloud API (later)
```

- **The browser never touches the database.** The web app talks only to the API, and only the API holds the Supabase secret key.
- **Business rules live in the API and the database.** Overlapping bookings, double use of a package session and overpayment are refused by database constraints and functions, so a bug in the app cannot break them.
- **Money is exact.** Amounts are stored as decimals. Each LBP payment keeps the exchange rate it was taken at.

More detail: [docs/03-architecture.md](docs/03-architecture.md) and [docs/04-database.md](docs/04-database.md).

## What's in the repository

```
apps/
  web/            Next.js app: screens for the owner and staff
  api/            Express API: rules, permissions, database access
packages/
  shared/         Types and validation shared by web and API (one source of truth)
supabase/
  migrations/     Database changes, applied in order. Never edit one that has been applied
docs/             Project description, plan, architecture, database, CI/CD
.github/          CI workflow, migrations workflow, Dependabot, PR template
```

## Tech

Next.js 16, React 19, Tailwind 4 (with light and dark themes), Express 5, TypeScript 6, Zod 4, Supabase (Postgres and Auth), Vitest. npm workspaces. Deployed on Vercel.

## Getting started

You need **Node 22.13 or newer**, npm, and a Supabase project.

```bash
git clone https://github.com/hady-17/DeeClinic.git
cd DeeClinic
npm install
```

### 1. Environment files

Copy [.env.example](.env.example) and fill it in. The values go in two places:

**`.env` in the repository root, for the API**

| Variable | What it is |
|---|---|
| `SUPABASE_URL` | Your project URL |
| `SUPABASE_SECRET_KEY` | The secret (service role) key. **Server only, never in the browser** |
| `SUPABASE_PUBLISHABLE_KEY` | The publishable (anon) key. Used only to check passwords |
| `CRON_SECRET` | Any random string of 16 or more characters |
| `PASSCODE_PEPPER` | A random string of 32 or more characters. Protects passcodes. See below |
| `WEB_ORIGIN` | Where the web app runs. Defaults to `http://localhost:3000` |
| `PORT` | API port. Defaults to `4000` |
| `WHATSAPP_*` | Not needed until Phase 3 |

The older names `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_ANON_KEY` also work.

**`apps/web/.env.local`, for the web app** (Next only reads env files from inside `apps/web`)

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...        # the publishable key
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Generate a pepper with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Keep it safe: if it is lost or changed, every passcode stops working and each owner and manager sets a new one.

> The API reads `.env` only when it starts. After changing it, stop and restart `npm run dev:api`.

### 2. The database

Apply the files in [supabase/migrations](supabase/migrations) to your Supabase project, in order. With the Supabase CLI:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

In the Supabase dashboard, also:

1. **Authentication > Sign In / Providers:** turn off "Allow new users to sign up". Users are created from the app.
2. **Authentication > URL Configuration:** add `http://localhost:3000/reset-password` to the redirect URLs, so password-reset and invite links work.
3. **Authentication > SMTP:** set up a custom email provider. Supabase's built-in email only reaches your own team and is heavily limited, so invite and reset emails will not reach staff without it.

### 3. The first owner

A fresh project has nobody who can log in. Create the first owner once:

1. In Supabase, **Authentication > Users > Add user**, with an email and password and "Auto Confirm User" ticked.
2. Link it to a profile, using that user's id:

```sql
insert into profiles (id, full_name, role, email)
values ('<user-id>', 'Your Name', 'owner', 'you@example.com');
```

After that, the owner adds everyone else from the **Users** screen in the app.

### 4. Run it

Two terminals:

```bash
npm run dev:api     # http://localhost:4000, health check at /api/v1/health
npm run dev:web     # http://localhost:3000
```

Log in, then set your **passcode** under *My passcode*. You need one to void a payment.

## Everyday commands

| Command | What it does |
|---|---|
| `npm run ci` | Typecheck, lint, test and build. The same as the pipeline. Run it before pushing |
| `npm test` | Unit tests |
| `npm run typecheck` / `lint` / `build` | Each check on its own |
| `npm run format` | Format the code with Prettier |
| `npm run preview -w @deeclinic/web` | Review every screen in light and dark against sample data, with no login. Opens `http://localhost:3100` |
| `npm run test:e2e-auth -w @deeclinic/api` | Live check of login, users and password reset |
| `npm run test:e2e-phase2 -w @deeclinic/api` | Live check of packages, payments, rates and the passcode |

The two `e2e` scripts run against the real Supabase project from your `.env`. They create their own throwaway users and data and remove them afterwards, but run them against a development project, never production. The API must be running first on port 4000. Set `API=<url>/api/v1` to point at another address.

## Roles and permissions

Routes never check roles. They ask for a named permission, and one table in [packages/shared/src/schemas/permissions.ts](packages/shared/src/schemas/permissions.ts) says which role has which.

| | Owner | Manager | Staff |
|---|---|---|---|
| Calendar, clients, visit notes | yes | yes | yes |
| Sell packages, take payments | yes | yes | yes |
| Services, package offers, settings, CSV import | yes | yes | read only |
| Exchange rate, void a payment (with passcode) | yes | yes | no |
| Manage users | yes | no | no |

## Security in short

- Every route needs a valid login for an **active** account. Deactivating a user locks them out on their next request.
- Sign-in goes through the API, which locks an account after repeated wrong passwords and records every attempt.
- Rate limits are stored in the database, so they hold across serverless instances.
- Voiding a payment needs the permission **and** the person's own 6-digit passcode.
- Every write is recorded in the audit log. Personal data and passcodes are never logged.

## Deployment

Vercel deploys both apps from this repository (a push to `main` goes to production, and each pull request gets a preview). GitHub Actions runs the checks and the database migrations. Setup steps, environment variables and rollback are in [docs/05-ci-cd.md](docs/05-ci-cd.md).

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| "Something went wrong" on a passcode or other action | The API started before `.env` changed. Restart `npm run dev:api` |
| `Invalid environment configuration: ...` when the API starts | A required variable in `.env` is missing or empty |
| Web app says the URL and key are required | `apps/web/.env.local` is missing. Restart `npm run dev:web` after creating it |
| Reset and invite emails never arrive | Custom SMTP is not set up in Supabase |
| Reset link says it has expired | The redirect URL is not allowed in Supabase, or the link was already used |
| "Set the exchange rate before taking a payment in LBP" | No rate has been entered yet. Add one under *Exchange rate* |

## Documentation

- [01 Project description](docs/01-project-description.md)
- [02 Delivery plan](docs/02-plan.md)
- [03 Architecture](docs/03-architecture.md)
- [04 Database](docs/04-database.md)
- [05 CI/CD](docs/05-ci-cd.md)
- [06 Design system](docs/06-design-system.md)

## Rules for changing the code

- A database change is a **new migration file**. Never edit one that has already been applied.
- New tables have row-level security on, with no access for the browser keys.
- Every write goes through the audit log, and money moves only through the database functions (`record_payment`, `sell_package`, `complete_appointment`).
- Use the pull request checklist in [.github/pull_request_template.md](.github/pull_request_template.md).
