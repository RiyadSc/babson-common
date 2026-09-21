# Verification record

Final local verification: **September 10, 2026**. App: Common 0.1.0, Next.js 16.3.4, Node 22.13.1. No production rollout is implied by these results.

| Check                        | Result    | Evidence / scope                                                                                                                       |
| ---------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint                       | Passed    | `npm run lint`, no errors or warnings                                                                                                  |
| TypeScript                   | Passed    | `npm run typecheck`, strict checking                                                                                                   |
| Domain and database suite    | 25 passed | `npm test`, three test files                                                                                                           |
| Browser suite                | 6 passed  | `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`                                                                                           |
| Production compilation       | Passed    | `npm run build`; dynamic authenticated routes and static offline/manifest routes generated                                             |
| Real PostgreSQL transactions | Passed    | `npm run test:db`; 11 simultaneous last-seat claims, exactly one winner, FIFO promotion, role-escalation denial                        |
| Automated accessibility      | Passed    | Axe on desktop discovery, mobile discovery, personal schedule and hosting dialog; no detected violations                               |
| Keyboard and layout          | Passed    | Escape closes dialogs and restores focus; 390px viewport has no horizontal overflow; profile control reachable on a 720px-high desktop |
| Visual review                | Completed | Desktop, mobile, and event detail screenshots inspected                                                                                |

## What the tests exercise

The unit suite validates exact school-email domains; future dates, capacity and expectations; New York calendar boundaries; deterministic feed diversity; escaped and folded ICS export; malformed/floating/DST event timestamps; missing RSS event dates; retry and revision hashes; and screenshot decoder restrictions.

Database tests apply all four migrations with Supabase-style Auth/Storage schema stand-ins. They verify anonymous/unconfirmed access denial, role and membership write restrictions, capacity/idempotency, private attendance, waitlist promotion, report hiding, notification deduplication, private screenshot policies, moderator-only curation, reviewed source updates and change notices, restricted job execution, two-way block membership removal, and suppression of stale reminders after cancellation.

A separate PostgreSQL 17 instance tests actual competing transactions using twelve separate connections. The test creates and removes its own database. The user's existing PostgreSQL databases are untouched.

Browser tests use the explicitly labeled browser-local preview. They exercise discovery/search, hosting, joining, saves and persistence, waitlists, reports, blocking, calendar downloads, announcements, host cancellation, profile preferences, dialog focus, accessibility and fail-closed API routes. Authenticated Supabase functionality is verified at the database and server-code boundary, not through a deployed live account.

## Remaining live verification

A full Supabase stack could not be started here because Docker was unavailable. A dedicated local PostgreSQL installation and PGlite were used for database coverage instead. Supabase's actual Auth magic-link/SMTP and Storage HTTP flows still need a configured-stack smoke test. Real reminder-provider delivery, external mail-adapter integration, production cron cadence, physical-device PWA installation and screen-reader speech output were not tested.

No real student accounts, approved automated feed URLs, reminder sender, production deployment or named moderation owners were supplied. The source seed contains genuine references but no fabricated shared events. The closed pilot, production smoke tests and moderation drills remain pending in [PILOT.md](PILOT.md).

## Screenshots

- [Desktop discovery](preview-desktop.png)
- [Mobile discovery](preview-mobile.png)
- [Event details](preview-detail.png)

Original illustrations are editable SVGs under `public/images/`; `scripts/make-art.mjs` reproduces them and the app icons. `scripts/inspect-ui.mjs` captures the screenshots against the local server.
