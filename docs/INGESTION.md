# Ingestion contract

Imports produce unpublished drafts. Nothing in a connector can call the publishing RPC or modify an existing event directly.

## Normalized payload

```json
{
  "title": "Open campus coffee",
  "description": "Meet new people over an informal coffee.",
  "location": "Reynolds lounge",
  "starts_at": "2026-10-01T16:00:00-04:00",
  "ends_at": "2026-10-01T17:00:00-04:00",
  "external_id": "organizer-stable-identifier"
}
```

Dates must include an explicit timezone. Missing end/location reduce confidence and must be supplied by a curator before publication. Confidence is a transparent completeness heuristic, not a claim of factual verification.

ICS accepts explicitly zoned occurrences, including declared VTIMEZONE definitions. Floating, all-day and recurring items are rejected into the error list for manual clarification. RSS/Atom require `event:start`, `event:end`, and `event:location`; a publication date is never assumed to be an event start. The web connector accepts normalized JSON arrays, not arbitrary HTML scraping.

The server fetches only enabled source records on a Babson hostname allowlist (`*.babson.edu`, plus explicit external campus platforms — currently `campusgroups.com`), over HTTPS, with redirects forbidden, a ten-second timeout, and a one-megabyte streamed body limit. Add a new external hostname only after validating ownership and authorization. Sources can be paused by the operator in Supabase. The moderation page displays last-check time and errors.

## HTML (schema.org JSON-LD)

Babson's own event pages (`www.babson.edu/about/events/`, USE events, Belong, Athletics) render schema.org `Event` objects inside `<script type="application/ld+json">` tags. The `html` connector extracts those payloads only — it never executes HTML, never runs JavaScript, and ignores everything outside JSON-LD script bodies. Events must include `name`, `startDate`, `endDate`, and (ideally) `location`. Recurring events, floating times, and undated items are rejected into the error list for the moderator queue.

## Auto-publish

A source can be flagged `auto_publish=true`. Drafts from that source are published without moderator review only when **all** of the following hold:

- `confidence >= 0.9` (requires explicit end time and non-empty location)
- `external_id` is present (so revisions still route through moderator review — `auto_publish_draft` refuses to revise an existing event)
- start time is strictly in the future

Every auto-publish writes an `audit_log` row with `action='auto_publish'`. A moderator can hide or cancel the event through the existing moderation flow at any time. Drafts that don't meet the bar stay in `review` state and appear in the moderation queue.

## Forwarded email

A trusted mail adapter extracts candidate fields, then sends an authenticated POST to `/api/ingest`:

```json
{
  "source_id": "UUID-of-enabled-email-source",
  "event": {
    "title": "Open campus coffee",
    "description": "Meet new people over an informal coffee.",
    "location": "Reynolds lounge",
    "starts_at": "2026-10-01T16:00:00-04:00",
    "ends_at": "2026-10-01T17:00:00-04:00",
    "external_id": "stable-mail-message-event-id"
  }
}
```

The mail adapter is an external configuration responsibility. Do not forward entire private threads, contact lists, or school email inboxes. Students can instead paste relevant public event details into the suggestion form and optionally attach a screenshot. Screenshots are decoded, resized, metadata-stripped, and stored as private WebP objects. Their signed preview links expire after one minute. No OCR or automatic interpretation is claimed.

## Deduplication and source edits

A fingerprint matches normalized title + UTC start. A separate content hash tracks title, start, end, location and description. Retries have a unique `(source_id, fingerprint, content_hash)` key and do not reset review decisions. A same-source stable external ID identifies revisions; a moderator applies the changes to the original event, preserving attendance and creating change notices. An event moved to a different date still connects by external ID.

Cross-source matching candidates are held as duplicates and linked to the existing event. Other ambiguities are manually resolved using “Mark as duplicate” and an existing event UUID. This MVP uses exact normalized matching; semantic similarity and sophisticated entity resolution are future improvements.

## Starting references

- [Undergraduate Student Engagement events](https://www.babson.edu/office-of-undergraduate-student-engagement/undergraduate-events/)
- [Babson Belong calendar](https://belong.babson.edu/calendar)
- [Babson campus events](https://www.babson.edu/about/events/)

These references were verified as Babson event sources on September 9, 2026. The seed does not pretend an HTML page is an ICS/JSON feed. Arrange access to approved feeds with source owners before enabling automation.

### Import retry repair (2026-09-25)

Deploy the importer together with `202609250001_import_idempotency.sql`. Unchanged
imports now keep their existing review/publication state; unpublished review drafts
can still retry publication after a transient failure. The publisher serializes
publication and checks existing publication links independently of draft status.

The migration hides abandoned duplicates only when the auto-publish audit trail
links them to the same draft as a current published event with an identical source,
title, location, and schedule. It keeps copies with attendance, saves, reports,
announcements, notifications, or analytics for manual review. No events or user data
are deleted; each hidden copy receives a `hide_import_duplicate` audit entry.
