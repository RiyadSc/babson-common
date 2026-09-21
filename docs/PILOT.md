# Closed-pilot release gates

**Current state: local implementation verified and hosted sample preview deployed; live pilot not launched.** See [deployment status](DEPLOYMENT.md). This file distinguishes shipped code from operational prerequisites. No person is assigned an operational obligation without agreeing to it.

## Pilot ownership

| Responsibility                 | Owner                  | Target during announced coverage hours                             |
| ------------------------------ | ---------------------- | ------------------------------------------------------------------ |
| Pilot lead / go-no-go decision | Unassigned             | Daily review of launch gates                                       |
| Primary moderator              | Riyad Scally           | Triage safety/harassment reports within 1 hour                     |
| Backup moderator               | None for initial pilot | Sole-moderator pilot, per Riyad’s instruction                      |
| Source curator                 | Unassigned             | Check sources daily; correct stale listings within 24 hours        |
| Technical operator             | Unassigned             | Review failed jobs daily; urgent incident response during coverage |

Riyad Scally is the sole moderator for the initial pilot, confirmed September 10, 2026. A backup moderator is not required for this initial scope. The moderator account is `rscally1@babson.edu`; the role is assigned automatically after verified sign-in. Coverage hours still need to be configured.

Publish coverage hours and escalation contacts before inviting students. Outside coverage, high-risk reports still hide events automatically. Common must not be described as an emergency service.

## Environment gates

- [ ] Dedicated staging and production Supabase projects and HTTPS app deployment.
- [ ] Exact Auth site/redirect URLs; email confirmation enabled; production SMTP working.
- [ ] Verify a real authorized `@babson.edu` sign-in link; reject personal-email access and replayed/expired links.
- [ ] Apply migrations to staging, verify RLS through the actual REST/Storage APIs, then apply reviewed migrations to production.
- [ ] Test two real accounts: one cannot read another's saves, notices, or private screenshot.
- [ ] Service role and random job secret configured only server-side.
- [ ] Verified reminder sender and provider key; schedule the jobs at the stated cadence.
- [ ] Send a reminder to an opted-in pilot tester. Confirm delivery and no duplicate on job retry.
- [ ] Verify preference opt-out, promoted waitlist notice, host cancellation and material-change notices.
- [ ] Verify iOS and Android installation, keyboard navigation, and VoiceOver/TalkBack with the deployed build.
- [ ] Confirm offline navigation does not reveal a previous student's data after sign-out.

## Source and community gates

- [ ] Seed at least 20 **real, reviewed upcoming** events across at least 4 categories and 5 organizers.
- [ ] Confirm source ownership/permission and each enabled machine-readable feed URL.
- [ ] Sample every seeded listing against its source, including timezone, cost, venue and external registration requirements.
- [ ] Name the moderation owners above and obtain agreement on coverage.
- [ ] Run safety-report → temporary hide → review → restore/cancel drills with a test event.
- [ ] Run blocking, spam-report and duplicate-resolution drills.
- [ ] Agree on data retention, operator access, deletion requests, and an incident contact. Set retention jobs according to that decision.

## Suggested pilot and decision thresholds

These are implementation suggestions for the pilot lead to approve, not observed results: start with 30–50 consenting students across several existing groups, run for two weeks, and review weekly.

Go/no-go requires all correctness/security gates above, zero known critical access-control defects, no duplicate email delivery in retry drills, and reliable source coverage. Suggested learning targets are at least 60% of testers joining a plan, at least 25% returning to another activity, and every day containing reviewed plans across multiple categories. A missed learning target prompts iteration; a broken safety or privacy gate pauses new invitations.

Measure weekly active attendees from self-reported check-ins and creators from creation records. Distinguish joining from actual attendance. Track repeat attendance/creation, cancellations and **self-reported** no-shows; absent check-in is not proof of absence. Cross-category and new-organizer participation are aggregate indicators, not social rankings. Coverage combines event/category/source counts with curator comparison against the original calendars.

## Production smoke record

Keep timestamps, build identifier, environment, operator, and evidence links here when the pilot is configured. All entries are currently pending:

| Check                                 | Result  | Evidence                                                        |
| ------------------------------------- | ------- | --------------------------------------------------------------- |
| Verified sign-up and onboarding       | Pending | Requires configured Auth/SMTP                                   |
| Multi-account join/cancel/promotion   | Pending | Local database race test passes; live client round trip not run |
| Reminder and retry delivery           | Pending | Requires verified sender and opted-in test recipient            |
| Screenshot upload and private preview | Pending | SQL policies and image decoder pass locally                     |
| Import/duplicate/correction drill     | Pending | Fixtures and database curation tests pass locally               |
| Moderator response drill              | Pending | Riyad assigned; verified moderator account setup still required |
| Analytics interpretation              | Pending | Requires pilot data and operator validation                     |

No campus-wide rollout until the pilot lead records the decision and supporting evidence.
