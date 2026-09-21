# Common: Babson events and open hangouts

Recorded from the user's discussion and authorized implementation plan, September 9, 2026.

## The problem and first promise

Babson students encounter fragmented event information across Instagram, Fizz, websites, WhatsApp, and school email. The resulting uncertainty makes it harder to get out, meet people beyond existing groups, and follow through on plans. The first release puts discovery and participation in one mobile-first, installable web app.

Students can find a campus event or student hangout, understand the host, location, cost and expectations, join openly, and see the plan in their schedule. No host approval or social graph is required. Full activities have an ordered waitlist. Leaving a place automatically promotes the first eligible student.

The working product name is **Common**. The visual direction uses warm paper colors, campus green, approachable editorial typography, and original vector illustrations. Sample events and people are explicitly fictional and limited to a browser-local preview when Supabase is unconfigured.

## Accepted scope

- Verified `@babson.edu` email through Supabase Auth. Name and optional interests onboarding. Student/moderator roles.
- Today, Tomorrow, and rolling seven-day discovery in America/New_York. Search, category, cost and host-type filters.
- A deterministic relevance/freshness feed with category and organizer diversity penalties. No popularity input.
- Transparent open-capacity hosting, saves, attendance, FIFO waitlists, cancellation, announcements and private personal schedules.
- ICS export, persistent in-app notifications, preference-controlled email reminders and delivery records.
- Public/authorized ICS, RSS with event fields, structured web JSON, normalized forwarded email, and student link/text/screenshot submissions. All imports pass human review.
- Reporting, two-way visibility blocking, temporary hiding for high-risk reports, auditable moderation and correction history.
- Aggregate pilot analytics, accessibility checks, integration tests and a closed-pilot release checklist.

Exclude direct messages, chat, follows, public popularity counts, anonymous posting, native apps, payments, and scraping private platforms. Cost is informational. External campus registration is still governed by the original organizer.

## Architecture and boundaries

Next.js App Router and TypeScript form the application boundary. Server actions authenticate through `getUser()` before querying Supabase. Database helpers re-check confirmed school email against `auth.users`, rather than trusting user-editable metadata. A cookie-refresh proxy handles expired sessions. Data pages are dynamic/private, and the service worker never caches authenticated content.

Postgres stores profiles, organizers, sources, venues, canonical events, occurrences, tags, attendance, saves, blocks, announcements, reports, draft imports, notifications, delivery records, status history and audit records. All public tables have RLS. Moderators receive audited RPCs rather than general-purpose write permissions. Role changes require an operator-level database action.

The MVP creates one explicit occurrence per event. Recurrence rules require manual expansion and review; an ICS series is never silently treated as a single accurate occurrence. Events and occurrences are separate so a later recurrence UI does not change event identity.

Attendance changes lock the parent event row. Capacity includes the student host. Confirmation, cancellation and promotion commit in a single transaction. A service role is used only by authenticated scheduled jobs; browser code never receives it.

Import fingerprinting identifies a likely event by normalized title and start timestamp. A separate content hash distinguishes a retry from a source edit. A stable source/external ID connects approved revisions to their published event. Cross-source matches become duplicate candidates rather than new public listings. Ambiguous items remain in review. Original links, raw normalized input and screenshot evidence are retained.

Reminders create uniquely keyed in-app notices in Postgres. A leased email outbox uses a stable provider idempotency key, bounded retries, and a maximum 23-hour delivery window to remain within the provider's 24-hour idempotency window. Exported ICS files are snapshots, not subscribed calendars; students must re-export after changes.

## Verification and release

The checked-in tests cover domain validation, timezones, malformed feeds, revisions, database permissions, waitlists, concurrent last-seat claims, imports, private screenshot policies, notifications, student flows and automated accessibility. Full Supabase Auth and Storage HTTP integration and real email delivery require the configured local Supabase stack or staging project.

The implementation is available locally. A live closed pilot requires service configuration, named operational owners, verified real event seeding, production smoke tests and moderation drills. See `docs/PILOT.md`; these gates are not represented as completed.
