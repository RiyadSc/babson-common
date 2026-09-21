# Hosting and account setup

Updated September 21, 2026.

- Vercel account: `riyadsc`, team `riyadscs-projects`, project `babson-common`.
- Production app: https://babson-common.vercel.app (deployment `dpl_984EqTZMS5Sj9q5bn94gVRS5qe8B`, ready and HTTP 200). The Swiss-inspired redesign includes the public landing page, separate login/signup pages, and a protected `/app`.
- Supabase: linked to project `ktsiqcdorpffaxlhazss`; all five migrations are applied remotely.
- Moderator: Riyad Scally only. `rscally1@babson.edu` is promoted automatically after Supabase Auth creates and verifies the account.
- Email sender, SMTP, and reminder provider: not configured; no live email sent.
- Seven real event candidates prepared in `data/curation/2026-09-10-babson-review.json`; all pass ingestion normalization, none published. Price, capacity and registration review remain pending.

## Scheduler

The first deployment built successfully but Vercel rejected its cron configuration. [Vercel Hobby permits only daily cron schedules](https://vercel.com/docs/cron-jobs/usage-and-pricing). The default `vercel.json` therefore deploys the app without scheduled jobs. This is sufficient for a sample preview, not the student pilot.

The required cadence remains every 15 minutes for `/api/jobs` and every 4 hours for `/api/ingest`. A suitable option after database setup is [Supabase Cron with pg_net and Vault](https://supabase.com/docs/guides/functions/schedule-functions): store the app origin and job bearer secret in Vault, and call the authenticated GET endpoints. Configure and verify this against the actual project before enabling it; a scheduler must also be able to reach the deployment through any deployment protection.

`deployment/vercel.pro.json` is an alternative only for a project already using Pro. Do not activate both schedulers. No billing plan has been changed.

## Remaining live checks

Hosted smoke check: unauthenticated public requests to `/`, `/login`, and `/signup` return HTTP 200 with neither sidebar nor mobile app navigation. `/app` returns HTTP 307 to `/login`; `/preview` returns HTTP 404 in production; `/api/jobs` returns HTTP 401 without authorization. All checks passed September 21, 2026. No live email was sent during redesign verification.

See [authentication URL setup](AUTH-URLS.md) for the local and production callback origins.

Complete the [pilot release gates](PILOT.md), including real sign-in, private Storage access, moderator authorization, and an opted-in reminder delivery with retry verification. A successful frontend deployment does not establish these checks.
