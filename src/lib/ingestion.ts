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
  return {
    title,
    description: String(input.description || '').slice(0, 3000),
    location,
    starts_at,
    ends_at,
    source_url: url.toString(),
    external_id: input.external_id ? String(input.external_id) : null,
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
      // Extract schema.org Event objects from JSON-LD script tags. No HTML is executed;
      // only <script type="application/ld+json"> payloads are parsed, then filtered by @type.
      for (const item of extractJsonLdEvents(content, sourceUrl)) add(item);
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
      results.push({
        title: record.name,
        description: record.description,
        location: locationName,
        starts_at: record.startDate,
        ends_at: record.endDate,
        external_id: externalId,
      });
    }
  }
  return results;
}
function summarizeAddress(address: unknown): string {
  if (typeof address === 'string') return address;
  if (!address || typeof address !== 'object') return '';
  const a = address as Record<string, unknown>;
  return [a.streetAddress, a.addressLocality, a.addressRegion].filter(Boolean).join(', ');
}
