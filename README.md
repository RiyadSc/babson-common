# Common · Babson

A mobile-first event hub for verified Babson students: discover campus plans, host open hangouts, join or waitlist, save a schedule, and meet someone new.

## Run the local preview

```sh
npm ci
npm run dev
```

Open **http://localhost:3000** for the public landing page. `/login` and `/signup` are separate email-link flows; `/app` requires a verified Babson session. With no Supabase keys, `/preview` provides the explicitly labeled browser-local sample experience. It returns 404 when Supabase is configured. Sample events and identities are fictional. Preview changes persist in this browser; use “How it works → Reset sample preview” to reset them. No preview action emails or contacts anyone.

Signed-in event links use `/events/[id]` and preserve that destination through email-link authentication. The local preview uses `/preview?event=[id]`. On mobile, Discover, My plans, and Create are the primary navigation; My plans groups Going, Saved, and Hosting.

## Run with Supabase

Requires Node 22+ and Docker for the Supabase local stack.

```sh
npx supabase start
npx supabase db reset
cp .env.example .env.local
```

Copy the local API URL and publishable/anon key from `supabase status` into `.env.local`, set `APP_URL=http://localhost:3000`, and restart the app. Keep email confirmation enabled. Sign in with a test `@babson.edu` address and open the magic link in the local SMTP inbox shown by `supabase status`. Never disable verification to test production access.

For staging/production, use separate Supabase projects and environment variables. Apply migrations only after the local checks pass. Set Auth's site URL and exact `/auth/callback` redirect URL to your HTTPS deployment origin. Configure Supabase custom SMTP for real sign-in email. The app has no usable live identity mode until both public Supabase settings are supplied.

The initial pilot moderator is `rscally1@babson.edu`. Migration `202609190001_bootstrap_moderator.sql` assigns that account the moderator role only after Supabase Auth creates it as a Babson user; email verification is still required. There is no student-accessible role assignment endpoint. Moderation appears after the verified account signs in and refreshes.

## Reminders and imports

Set the server-only `SUPABASE_SERVICE_ROLE_KEY`, a random `CRON_SECRET` of at least 32 characters, `RESEND_API_KEY`, and a verified `REMINDER_FROM` sender. Jobs require `Authorization: Bearer <CRON_SECRET>` and fail closed without it. Configure these values through the hosting provider's secret store, never through a committed file. The default deployment has no scheduler: Vercel Hobby cannot run the required frequent jobs. Schedule `/api/jobs` every 15 minutes and `/api/ingest` every 4 hours through an authenticated external scheduler before launch. `deployment/vercel.pro.json` preserves the optional native Vercel schedules for an account already on Pro; no upgrade has been requested or made. See [deployment status](docs/DEPLOYMENT.md).

- `GET /api/jobs`: enqueue reminders and deliver notification emails. In-app notices work even when email is unconfigured.
- `GET /api/ingest`: fetch enabled, allowlisted sources and create review drafts.
- `POST /api/ingest`: receive normalized forwarded-email events from a trusted mail adapter using the same job authorization. See [connector contract](docs/INGESTION.md).
- `GET /api/calendar`: authenticated private ICS export of saved/joined plans.

The three seeded sources are genuine Babson references, paused for manual curation. Automatic import must be enabled only after confirming a specific feed URL and permission to use it. No Instagram, Fizz, or WhatsApp scraping is included.

## Checks

```sh
npm run check
npx playwright install chromium
npm run test:e2e
```

On a Mac with Chrome installed, `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` uses that browser instead. Browser tests run the local sample preview; live sign-up/delivery smoke tests remain an operational release gate.

`npm test` executes domain and database tests with PGlite and a test-only Supabase Auth/Storage schema stand-in. `npm run test:db` additionally exercises simultaneous transactions against **an isolated local PostgreSQL server** using `TEST_DATABASE_URL`. It creates and drops its own test database and never accepts a remote hostname. CI starts a disposable Postgres service for this check.

```sh
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres npm run test:db
```

Do not point this at a shared developer database cluster; the suite creates its test roles if absent. The test bootstrap file must never be deployed as a migration.

## Project map

- `src/components/hub.tsx`: student experience and isolated local preview state
- `src/app/actions.ts`: authenticated student and moderator actions
- `src/lib/domain.ts`: validation, ranking, campus dates and ICS export
- `src/lib/ingestion.ts`: normalization and connector contracts
- `src/lib/jobs.ts`: import persistence and leased reminder delivery
- `supabase/migrations`: canonical schema, RLS, attendance transactions, curation, storage policies
- [Design](docs/superpowers/specs/2026-09-09-babson-events-design.md), [pilot gates](docs/PILOT.md), [verification record](docs/VERIFICATION.md)

## Current boundary

The hosted app is connected to Supabase; see [deployment status](docs/DEPLOYMENT.md). A campus pilot has not been run. Production readiness depends on the configuration and human-run gates in the pilot checklist. Private screenshot access is tested at the policy level; its Supabase Storage HTTP path still needs a configured-stack smoke test. The forwarded-email adapter accepts structured input; arbitrary email text and OCR are intentionally human-curated.
