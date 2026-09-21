---
name: babson-events-mvp
overview: Build a verified Babson-only, mobile-first event hub that combines reliable campus event discovery with open-capacity student-created activities. Deliver it incrementally so the discovery-and-attendance loop can be piloted before adding broader social-network features.
todos:
  - id: foundation
    content: Scaffold the PWA and establish verified identity, schema, roles, policies, and automated checks
    status: completed
  - id: discovery
    content: Implement the canonical event model, diverse feed, search, filters, and event details
    status: completed
  - id: attendance
    content: Build student activity creation, open joining, transactional capacity, saves, and waitlists
    status: completed
  - id: scheduling
    content: Add personal schedules, calendar export, announcements, and idempotent reminders
    status: completed
  - id: ingestion
    content: Create curated and automated ingestion connectors with provenance, deduplication, and review
    status: completed
  - id: moderation
    content: Implement reporting, blocking, moderation, source health, and audit tools
    status: completed
  - id: pilot
    content: Complete accessibility, end-to-end verification, analytics, seeding, and closed-pilot readiness
    status: in_progress
isProject: false
---

# Babson Events MVP Implementation Plan

## Product boundary
Build a mobile-first PWA for verified Babson students. Phase 1 includes discovery, student hosting, open joining, waitlists, schedules, reminders, curated/imported events, reporting, and moderation. Exclude DMs, group chat, followers, public popularity scores, payments, native apps, anonymous posting, and private-platform scraping.

## Architecture
- Use Next.js and TypeScript for the PWA and server-side application boundary.
- Use Supabase Auth, Postgres, Storage, and row-level security for identity and canonical data.
- Keep source connectors behind a normalized ingestion interface so imports cannot directly mutate published event records.
- Use scheduled jobs for ingestion and reminders; require review for ambiguous or risky submissions.

## Implementation sequence
1. **Foundation and trust boundary**
   - Record the approved design in [`docs/superpowers/specs/2026-09-09-babson-events-design.md`](docs/superpowers/specs/2026-09-09-babson-events-design.md).
   - Scaffold the Next.js PWA, automated checks, environment validation, Supabase local development, and deployment environments.
   - Implement `@babson.edu` verification, profile/interests onboarding, authorization roles, audit logging, and database policies.

2. **Canonical event model and discovery**
   - Add organizers, sources, venues, events, occurrences, tags, and event-status history through versioned migrations under [`supabase/migrations/`](supabase/migrations/).
   - Build Today/Tomorrow/This Week feeds, search, filters, source attribution, last-verification indicators, and event details.
   - Implement a deterministic feed service that balances relevance, freshness, and category/organizer diversity without raw-popularity ranking.

3. **Student activities and attendance**
   - Build guided activity creation with validation, visible host identity, capacity, cost, location, expectations, and cancellation rules.
   - Implement transactional join/cancel operations, waitlist ordering, automatic promotion, saves, and host announcements.
   - Cover concurrent last-seat claims and authorization boundaries with integration tests.

4. **Schedule and reminders**
   - Add a personal saved/joined schedule, calendar export, reminder preferences, and material-change/cancellation notices.
   - Implement idempotent scheduled reminder delivery and delivery records to prevent duplicates.

5. **Ingestion and curation**
   - Define connector contracts for ICS/RSS/web feeds, forwarded email, and user-submitted links/text/screenshots.
   - Normalize drafts, retain provenance, calculate confidence, detect duplicates, and route uncertain records into review.
   - Begin with a small allowlist of reliable sources; do not scrape private WhatsApp content or bypass Instagram controls.

6. **Safety and moderation**
   - Build report/block flows, prohibited-content rules, temporary hiding for high-risk reports, moderator review, source-health monitoring, duplicate resolution, and correction history.
   - Verify that students can access only appropriate records and moderators have auditable elevated actions.

7. **Pilot readiness and measurement**
   - Track weekly active attendees, weekly active creators, coverage, view-to-join conversion, repeat attendance/creation, cancellations/no-shows, and aggregate cross-category or new-organizer participation.
   - Add unit, integration, accessibility, and end-to-end coverage for sign-up, discovery, creation, joining, cancellation, promotion, reminders, imports, and reporting.
   - Run a closed pilot with named moderation ownership, response-time expectations, seeded event sources, and explicit go/no-go criteria before campus-wide rollout.

## Verification gates
- Every feature begins with a failing test and ends with focused tests plus the full quality suite.
- Database migrations and row-level policies are tested locally before any remote application.
- Accessibility checks cover keyboard use, screen readers, contrast, and reduced motion.
- Ingestion fixtures cover malformed dates, timezone handling, duplicate events, source edits, and retries.
- Pilot release requires successful production smoke tests, reminder-delivery checks, moderation drills, and analytics validation.

## Implementation record — September 9, 2026

The local application is implemented as **Common**. Foundation, discovery, attendance, scheduling, ingestion, and moderation code are complete, with migrations and automated checks in the workspace. The pilot item remains in progress because it includes real service configuration and human operational work.

- Local preview: `http://localhost:3000` (`npm run dev`).
- Approved design recorded in `docs/superpowers/specs/2026-09-09-babson-events-design.md`.
- Setup and service configuration: `README.md`.
- Test evidence and limits: `docs/VERIFICATION.md`.
- Outstanding launch gates and unassigned owners: `docs/PILOT.md`.

No remote schema was applied, real emails sent, or campus pilot conducted. The verification gates above remain mandatory for the live release.
