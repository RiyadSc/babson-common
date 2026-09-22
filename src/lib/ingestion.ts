import ICAL from 'ical.js';
import { XMLParser } from 'fast-xml-parser';
import { DateTime } from 'luxon';
import { createHash } from 'node:crypto';
export type Draft = {
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string | null;
  source_url: string;
  external_id: string | null;
  category: string | null;
  image: string | null;
  register_url: string | null;
  confidence: number;
  fingerprint: string;
  content_hash: string;
  raw: unknown;
};
export type ConnectorKind = 'ics' | 'rss' | 'web' | 'html' | 'email' | 'submission';
export interface Connector {
  kind: ConnectorKind;
  parse(content: string, sourceUrl: string): { drafts: Draft[]; errors: string[] };
}
export function fingerprint(x: { title: string; starts_at: string }) {
  return createHash('sha256')
    .update(
      x.title.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '') +
        '|' +
        new Date(x.starts_at).toISOString(),
    )
    .digest('hex');
}
export function classifyEvent(text: string): string | null {
  const t = text.toLowerCase();
  const hit = (patterns: RegExp) => patterns.test(t);
  if (
    hit(
      /\b(career fair|career center|internship|recruit|info session|information session|networking|resume|linkedin|employer|corporate|industry night|panel|case competition|trek|mba|consulting|banking|finance|investment|venture|entrepreneur|startup|interview prep|professional|business fraternity|pitch(?:ing)?)\b/,
    )
  )
    return 'Professional';
  if (
    hit(
      /\b(tournament|athletics|sports?|hockey|basketball|soccer|tennis|swim|golf|pickleball|frisbee|running|hike|outdoor|fitness|cup|match|marathon|climbing|kayak|volleyball|lacrosse|baseball|softball|field day)\b/,
    )
  )
    return 'Sports & outdoors';
  if (
    hit(/\b(yoga|meditation|wellness|mental health|mindful|self-care|wellbeing|therapy|breathwork)\b/)
  )
    return 'Wellness';
  if (
    hit(
      /\b(concert|music|band|dj|art|film|movie|screening|poetry|dance|gallery|theater|theatre|heritage|festival|exhibit|culture|open mic|showcase)\b/,
    )
  )
    return 'Arts & culture';
  if (
    hit(
      /\b(coffee|dinner|lunch|brunch|tea|boba|food|ice cream|breakfast|tasting|cafe|caf\u00e9|bake sale|meal|pot\s?luck|snack)\b/,
    )
  )
    return 'Food & drink';
  if (
    hit(/\b(lecture|seminar|workshop|study|tutor|research|reading|book club|training|masterclass|talk|colloquium)\b/)
  )
    return 'Learning';
  return null;
}
function normalizeUrl(candidate: unknown): string | null {
  if (typeof candidate !== 'string') return null;
  const trimmed = candidate.trim();
  if (!/^https:\/\//i.test(trimmed) || trimmed.length > 500) return null;
  try {
    return new URL(trimmed).toString();
  } catch {
    return null;
  }
}
export function normalizeInput(input: Record<string, unknown>, sourceUrl: string): Draft {
  const title = String(input.title || '').trim();
  if (title.length < 3 || title.length > 200) throw new Error('Missing or invalid title');
  const date = (x: unknown) => {
    if (
      typeof x !== 'string' ||
      !/(Z|[+-]\d{2}:\d{2})$/.test(x) ||
      !DateTime.fromISO(x, { setZone: true }).isValid
    )
      throw new Error('A valid date with timezone is required');
    return new Date(x).toISOString();
  };
  const starts_at = date(input.starts_at);
  const ends_at = input.ends_at ? date(input.ends_at) : null;
  if (ends_at && ends_at <= starts_at) throw new Error('End precedes start');
  const url = new URL(sourceUrl);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Invalid source URL');
  const location = String(input.location || '').slice(0, 200);
  const description = String(input.description || '').slice(0, 3000);
  const category =
    typeof input.category === 'string' && input.category
      ? input.category
      : classifyEvent(`${title} ${description}`);
  const image = normalizeUrl(input.image);
  const register_url = normalizeUrl(input.register_url);
  return {
    title,
    description,
    location,
    starts_at,
    ends_at,
    source_url: url.toString(),
    external_id: input.external_id ? String(input.external_id) : null,
    category,
    image,
    register_url,
    confidence: ends_at && location ? 0.95 : 0.5,
    fingerprint: fingerprint({ title, starts_at }),
    content_hash: createHash('sha256')
      .update(
        JSON.stringify({
          title,
          starts_at,
          ends_at,
          location,
          description: String(input.description || ''),
        }),
      )
      .digest('hex'),
    raw: input,
  };
}
export function parseFeed(content: string, kind: ConnectorKind, sourceUrl: string) {
  const drafts: Draft[] = [];
  const errors: string[] = [];
  const add = (x: Record<string, unknown>) => {
    try {
      drafts.push(normalizeInput(x, sourceUrl));
    } catch (e) {
      errors.push(e instanceof Error ? e.message : 'Invalid item');
    }
  };
  if (content.length > 1_000_000) throw new Error('Feed exceeds 1 MB');
  try {
    if (kind === 'ics') {
      const component = new ICAL.Component(ICAL.parse(content));
      for (const zone of component.getAllSubcomponents('vtimezone')) {
        const id = zone.getFirstPropertyValue('tzid');
        if (id) ICAL.TimezoneService.register(zone);
      }
      for (const c of component.getAllSubcomponents('vevent')) {
        try {
          const e = new ICAL.Event(c);
          if (e.isRecurring()) throw new Error('Recurring event requires manual occurrence review');
          if (e.startDate.isDate || e.startDate.zone.tzid === 'floating')
            throw new Error('Date requires an explicit timezone');
          const tzid = c.getFirstProperty('dtstart')?.getParameter('tzid');
          if (tzid && tzid !== 'UTC' && !ICAL.TimezoneService.has(String(tzid)))
            throw new Error('Unknown timezone');
          add({
            title: e.summary,
            description: e.description,
            location: e.location,
            starts_at: e.startDate.toJSDate().toISOString(),
            ends_at: e.endDate.toJSDate().toISOString(),
            external_id: e.uid,
          });
        } catch (e) {
          errors.push(e instanceof Error ? e.message : 'Invalid ICS');
        }
      }
    } else if (kind === 'rss') {
      const doc = new XMLParser({ ignoreAttributes: false, processEntities: false }).parse(content);
      const items = doc.rss?.channel?.item || doc.feed?.entry || [];
      for (const item of Array.isArray(items) ? items : [items])
        add({
          title: item.title,
          description: item.description || item.summary,
          starts_at: item['event:start'],
          ends_at: item['event:end'],
          location: item['event:location'],
          external_id: item.guid || item.id,
        });
    } else if (kind === 'web') {
      // Structured event JSON from an allowlisted endpoint, never arbitrary HTML execution.
      const json = JSON.parse(content);
      for (const item of Array.isArray(json) ? json : [json]) add(item);
    } else if (kind === 'html') {
      // JSON-LD when a page publishes it, otherwise Babson's own event cards or the
      // CampusGroups calendar JSON that Belong loads. No HTML or script is executed.
      const items = [
        ...extractJsonLdEvents(content, sourceUrl),
        ...extractBabsonCards(content, sourceUrl),
        ...extractCampusGroupsEvents(content, sourceUrl),
      ];
      for (const item of items) add(item);
    } else {
      const input = JSON.parse(content);
      add(input);
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : 'Could not parse feed');
  }
  return { drafts, errors };
}

function extractJsonLdEvents(html: string, sourceUrl: string): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRegex.exec(html)) !== null) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(match[1].trim());
    } catch {
      continue;
    }
    const queue: unknown[] = Array.isArray(parsed) ? [...parsed] : [parsed];
    while (queue.length) {
      const node = queue.shift();
      if (!node || typeof node !== 'object') continue;
      const record = node as Record<string, unknown>;
      const graph = record['@graph'];
      if (Array.isArray(graph)) {
        for (const g of graph) queue.push(g);
        continue;
      }
      const rawType = record['@type'];
      const types = Array.isArray(rawType) ? rawType : [rawType];
      const isEvent = types.some(
        (t) => typeof t === 'string' && /event$/i.test(t.replace(/^schema:/, '')),
      );
      if (!isEvent) continue;
      const loc = record.location;
      let locationName = '';
      if (typeof loc === 'string') locationName = loc;
      else if (loc && typeof loc === 'object') {
        const l = loc as Record<string, unknown>;
        locationName = String(l.name || '') || (l.address ? summarizeAddress(l.address) : '');
      }
      const externalId =
        typeof record['@id'] === 'string'
          ? String(record['@id'])
          : typeof record.url === 'string'
            ? String(record.url)
            : `${sourceUrl}#${String(record.name || record.startDate || '')}`;
      const jsonLdImage = Array.isArray(record.image)
        ? String(record.image[0] || '')
        : typeof record.image === 'string'
          ? record.image
          : '';
      results.push({
        title: record.name,
        description: record.description,
        location: locationName,
        starts_at: record.startDate,
        ends_at: record.endDate,
        external_id: externalId,
        image: jsonLdImage || null,
        register_url: typeof record.url === 'string' ? record.url : null,
      });
    }
  }
  return results;
}
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '—', ndash: '–', rsquo: "'", lsquo: "'", hellip: '…',
};
function decodeHtml(value: string) {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => NAMED_ENTITIES[name.toLowerCase()] ?? match)
    .replace(/\s+/g, ' ')
    .trim();
}
function easternInstant(year: number, month: number, day: number, label: string) {
  const clock = DateTime.fromFormat(label.trim(), 'h:mm a', { zone: 'America/New_York' });
  if (!clock.isValid) return null;
  const instant = DateTime.fromObject(
    { year, month, day, hour: clock.hour, minute: clock.minute },
    { zone: 'America/New_York' },
  );
  return instant.isValid ? instant.toISO() : null;
}
function extractBabsonCards(html: string, sourceUrl: string): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  const cards = html.match(/<li class="event-item[\s\S]*?<\/li>/gi) || [];
  for (const card of cards) {
    const title = decodeHtml((card.match(/<p class="title">([\s\S]*?)<\/p>/i) || [])[1] || '');
    if (!title) continue;
    const stamps = [...card.matchAll(/<div class="month">(\w+)<\/div>\s*<div class="day">(\d+)<\/div>\s*<div class="year">(\d+)<\/div>/gi)];
    const times = [...card.matchAll(/<span class="datelisting">([^<]+)<\/span>/gi)].map((m) => m[1]);
    if (!stamps.length || !times.length) continue;
    const startMonth = MONTHS[stamps[0][1].slice(0, 3).toLowerCase()];
    const endStamp = stamps[1] || stamps[0];
    const endMonth = MONTHS[endStamp[1].slice(0, 3).toLowerCase()];
    if (!startMonth || !endMonth) continue;
    const starts_at = easternInstant(Number(stamps[0][3]), startMonth, Number(stamps[0][2]), times[0]);
    const endLabel = times[1] || times[0];
    let ends_at = easternInstant(Number(endStamp[3]), endMonth, Number(endStamp[2]), endLabel);
    if (starts_at && ends_at && !times[1] && stamps.length < 2) {
      ends_at = DateTime.fromISO(starts_at, { setZone: true }).plus({ hours: 2 }).toISO();
    }
    const link = (card.match(/href="(https?:\/\/[^"]+)"/i) || [])[1] || '';
    const image =
      (card.match(/<img[^>]+src="(https?:\/\/[^"]+)"/i) || [])[1] ||
      (card.match(/<div class="image"[^>]*>\s*<img[^>]+src="([^"]+)"/i) || [])[1] ||
      '';
    const place = title.match(/^([^:]{3,40},\s*[A-Za-z]{2}):\s+/)?.[1];
    const location = /^virtual/i.test(title) ? 'Online' : place || 'Babson College';
    results.push({
      title,
      description: decodeHtml((card.match(/<div class="image">([\s\S]*?)<a /i) || [])[1] || ''),
      location,
      starts_at,
      ends_at,
      external_id: link || `${sourceUrl}#${title}`,
      register_url: link || null,
      image: image || null,
    });
  }
  return results;
}
function extractCampusGroupsEvents(content: string, sourceUrl: string): Record<string, unknown>[] {
  const trimmed = content.trim();
  if (!trimmed.startsWith('{')) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return [];
  }
  const events = (parsed as { events?: unknown }).events;
  if (!Array.isArray(events)) return [];
  return events.flatMap((event) => {
    if (!event || typeof event !== 'object') return [];
    const row = event as Record<string, unknown>;
    const title = decodeHtml(String(row.title || ''));
    const startDate = String(row.eventDateStr || '');
    const endDate = String(row.eventEndDateStr || startDate);
    const startLabel = String(row.startTime || '').replace(/\s+.*$/, '');
    const endLabel = String(row.endTime || '').replace(/\s+.*$/, '');
    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return [];
    const clock = (day: string, label: string) => {
      const parsedClock = DateTime.fromFormat(`${day} ${label}`, 'yyyy-MM-dd h:mma', {
        zone: 'America/New_York',
      });
      return parsedClock.isValid ? parsedClock.toISO() : null;
    };
    const starts_at = clock(startDate, startLabel);
    let ends_at = clock(endDate, endLabel || startLabel);
    if (starts_at && ends_at && !endLabel) {
      ends_at = DateTime.fromISO(starts_at, { setZone: true }).plus({ hours: 2 }).toISO();
    }
    const location = String(row.event_location || row.event_address || row.groupName || 'Babson College');
    const rsvp = typeof row.rsvpLinkCalendar === 'string' ? row.rsvpLinkCalendar : '';
    const flyer = typeof row.eventFlyer === 'string' && row.eventFlyer ? row.eventFlyer : '';
    const flyerUrl = flyer
      ? flyer.startsWith('//')
        ? `https:${flyer}`
        : flyer.startsWith('/')
          ? `https://belong.babson.edu${flyer}`
          : flyer
      : '';
    return [{
      title,
      description: decodeHtml(String(row.eventDescription || row.groupName || '')),
      location: decodeHtml(location),
      starts_at,
      ends_at,
      external_id: String(row.eventUID || row.id || `${sourceUrl}#${title}`),
      register_url: rsvp || null,
      image: flyerUrl || null,
    }];
  });
}
function summarizeAddress(address: unknown): string {
  if (typeof address === 'string') return address;
  if (!address || typeof address !== 'object') return '';
  const a = address as Record<string, unknown>;
  return [a.streetAddress, a.addressLocality, a.addressRegion].filter(Boolean).join(', ');
}
