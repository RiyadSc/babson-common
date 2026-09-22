import { describe, expect, it } from 'vitest';
import { activitySchema, isBabsonEmail, rankEvents, calendar, inWindow } from '../src/lib/domain';
import { normalizeInput, parseFeed, fingerprint } from '../src/lib/ingestion';
const event = {
  id: 'a',
  title: 'Coffee, connections',
  description: 'Say hello and meet new people',
  category: 'Social',
  organizer: 'Sam',
  host_id: 'sam',
  location: 'Reynolds',
  starts_at: '2026-09-10T00:00:00Z',
  ends_at: '2026-09-10T01:00:00Z',
  capacity: 8,
  cost: 0,
  expectations: 'Come as you are',
  cancellation_policy: 'Cancel if plans change',
  kind: 'student',
  status: 'published',
  verified_at: '2026-09-09T12:00:00Z',
  source_name: 'Student hosted',
} as const;
describe('identity and activities', () => {
  it('only accepts exact school domain', () => {
    expect(isBabsonEmail('A@BABSON.EDU')).toBe(true);
    for (const s of ['a@babson.edu.evil.com', 'a@gmail.com', '@babson.edu', 'a b@babson.edu'])
      expect(isBabsonEmail(s)).toBe(false);
  });
  it('requires safe capacity and ordered future dates', () => {
    expect(
      activitySchema.safeParse({
        ...event,
        starts_at: '2099-01-01T18:00:00Z',
        ends_at: '2099-01-01T19:00:00Z',
      }).success,
    ).toBe(true);
    expect(activitySchema.safeParse({ ...event, capacity: 0 }).success).toBe(false);
    expect(activitySchema.safeParse({ ...event, ends_at: '2020-01-01' }).success).toBe(false);
  });
});
describe('discovery and calendar', () => {
  it('uses campus dates across UTC midnight', () => {
    expect(inWindow(event, 'Today', new Date('2026-09-09T12:00:00Z'))).toBe(true);
    expect(inWindow(event, 'Tomorrow', new Date('2026-09-09T12:00:00Z'))).toBe(false);
  });
  it('diversifies organizers and categories deterministically', () => {
    const b = { ...event, id: 'b' };
    const c = { ...event, id: 'c', organizer: 'Ari', category: 'Arts' };
    expect(rankEvents([event, b, c], []).map((x) => x.id)).toEqual(['a', 'c', 'b']);
    expect(rankEvents([c, b, event], []).map((x) => x.id)).toEqual(['a', 'c', 'b']);
  });
  it('escapes calendar injection and includes UTC dates', () => {
    const ics = calendar([{ ...event, title: 'Hello\nBEGIN:VEVENT,hi;there' }]);
    expect(ics).toContain('DTSTART:20260910T000000Z');
    expect(ics).toContain('SUMMARY:Hello\\nBEGIN:VEVENT\\,hi\\;there');
    expect(ics.match(/\r\nBEGIN:VEVENT/g)).toHaveLength(1);
  });
});
describe('ingestion review boundary', () => {
  it('rejects malformed dates', () =>
    expect(() =>
      normalizeInput({ ...event, starts_at: 'no date' }, 'https://www.babson.edu'),
    ).toThrow());
  it('deduplicates title case and punctuation', () =>
    expect(fingerprint(event)).toBe(fingerprint({ ...event, title: ' COFFEE connections! ' })));
  it('parses UTC ICS and rejects floating dates', () => {
    const text =
      'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:1\r\nDTSTART:20260910T180000Z\r\nDTEND:20260910T190000Z\r\nSUMMARY:Lunch\r\nLOCATION:Campus\r\nEND:VEVENT\r\nEND:VCALENDAR';
    expect(parseFeed(text, 'ics', 'https://www.babson.edu').drafts[0].starts_at).toBe(
      '2026-09-10T18:00:00.000Z',
    );
    expect(
      parseFeed(text.replaceAll('0000Z', '0000'), 'ics', 'https://www.babson.edu').errors,
    ).toHaveLength(1);
  });
  it('keeps missing information in human review', () => {
    expect(
      normalizeInput(
        { title: 'Event', starts_at: '2026-09-10T18:00:00Z' },
        'https://www.babson.edu',
      ).confidence,
    ).toBeLessThan(1);
  });
});

describe('import revisions and timezones', () => {
  it('accepts explicit DST offsets and normalizes to UTC', () => {
    expect(
      normalizeInput(
        { title: 'Fall walk', starts_at: '2026-11-01T01:30:00-04:00' },
        'https://www.babson.edu',
      ).starts_at,
    ).toBe('2026-11-01T05:30:00.000Z');
    expect(
      normalizeInput(
        { title: 'Fall walk', starts_at: '2026-11-01T01:30:00-05:00' },
        'https://www.babson.edu',
      ).starts_at,
    ).toBe('2026-11-01T06:30:00.000Z');
  });
  it('rejects invalid calendar dates rather than repairing them', () =>
    expect(() =>
      normalizeInput(
        { title: 'Bad date', starts_at: '2026-02-30T18:00:00Z' },
        'https://www.babson.edu',
      ),
    ).toThrow());
  it('rejects ordinary RSS publish dates as event start times', () => {
    const r = parseFeed(
      '<rss><channel><item><title>Campus event</title><pubDate>Wed, 09 Sep 2026 10:00:00 GMT</pubDate></item></channel></rss>',
      'rss',
      'https://www.babson.edu',
    );
    expect(r.drafts).toHaveLength(0);
    expect(r.errors).toHaveLength(1);
  });
  it('extracts schema.org Event JSON-LD from HTML pages', () => {
    const html = `<!doctype html><html><head>
      <script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Event',
            '@id': 'https://www.babson.edu/e/1',
            name: 'Open coffee',
            description: 'A relaxed coffee.',
            startDate: '2026-10-01T16:00:00-04:00',
            endDate: '2026-10-01T17:00:00-04:00',
            location: { '@type': 'Place', name: 'Reynolds lounge' },
          },
        ],
      })}</script>
    </head><body>irrelevant <script>alert(1)</script></body></html>`;
    const result = parseFeed(html, 'html', 'https://www.babson.edu/about/events/');
    expect(result.drafts).toHaveLength(1);
    expect(result.drafts[0].title).toBe('Open coffee');
    expect(result.drafts[0].location).toBe('Reynolds lounge');
    expect(result.drafts[0].external_id).toBe('https://www.babson.edu/e/1');
    expect(result.drafts[0].confidence).toBeGreaterThanOrEqual(0.9);
  });
  it('reads Babson event cards that are not JSON-LD', () => {
    const html = `<ul><li class="event-item snippet event clearfix">
      <div class="month">Oct</div><div class="day">03</div><div class="year">2026</div>
      <p class="title">Babson Park, MA: Sigma Phi Epsilon Anniversary</p>
      <span class="datelisting">6:00 PM</span> - <span class="datelisting">9:00 PM</span>
      <div class="image">A chapter anniversary on campus. <a href="https://www.babson.edu/e/sigep">more</a></div>
    </li></ul>`;
    const result = parseFeed(html, 'html', 'https://www.babson.edu/about/events/');
    expect(result.drafts).toHaveLength(1);
    expect(result.drafts[0].title).toContain('Sigma Phi Epsilon');
    expect(result.drafts[0].location).toBe('Babson Park, MA');
    expect(result.drafts[0].starts_at).toBe('2026-10-03T22:00:00.000Z');
  });
  it('captures the Register Now href from a real Babson card, not the find-out-more link', () => {
    const html = `<ul><li class="event-item snippet event clearfix">
      <div class="month">Sep</div><div class="day">25</div><div class="year">2026</div>
      <p class="title">Babson Park, MA: The Babson Network Effect</p>
      <span class="datelisting">4:00 PM</span> - <span class="datelisting">6:00 PM</span>
      <a class="btn btn--med-green-BG" href="https://www.cvent.com/d/ydzllh/4W" target="_blank" title="Register">Register Now</a>
      <div class="image">The Babson Network Effect brings alumni together.
        <a class="find-out-more" href="https://www.cvent.com/d/ydzllh">Find out more</a>
      </div>
    </li></ul>`;
    const result = parseFeed(html, 'html', 'https://www.babson.edu/about/events/');
    expect(result.drafts).toHaveLength(1);
    expect(result.drafts[0].register_url).toBe('https://www.cvent.com/d/ydzllh/4W');
    expect(result.drafts[0].external_id).toBe('https://www.cvent.com/d/ydzllh/4W');
  });
  it('reads Belong CampusGroups calendar JSON', () => {
    const body = JSON.stringify({
      events: [{
        title: 'House dinner',
        eventDateStr: '2026-10-04',
        eventEndDateStr: '2026-10-04',
        startTime: '5:30pm',
        endTime: '7:00pm EDT (GMT-4)',
        event_location: 'Canfield Hall',
        eventUID: 'house-1',
        groupName: 'Canfield',
      }],
    });
    const result = parseFeed(body, 'html', 'https://belong.babson.edu/calendar');
    expect(result.drafts).toHaveLength(1);
    expect(result.drafts[0].location).toBe('Canfield Hall');
    expect(result.drafts[0].external_id).toBe('house-1');
    expect(result.drafts[0].starts_at).toBe('2026-10-04T21:30:00.000Z');
  });
  it('ignores non-Event JSON-LD nodes on the page', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@type': 'Organization',
      name: 'Babson',
    })}</script>`;
    const result = parseFeed(html, 'html', 'https://www.babson.edu/');
    expect(result.drafts).toHaveLength(0);
  });
  it('separates retry identity from content edits', () => {
    const a = normalizeInput({ ...event }, 'https://www.babson.edu');
    const b = normalizeInput({ ...event, location: 'Olin Hall' }, 'https://www.babson.edu');
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(a.content_hash).not.toBe(b.content_hash);
    expect(a.content_hash).toBe(
      normalizeInput({ ...event }, 'https://www.babson.edu').content_hash,
    );
  });
});
