import { DateTime } from 'luxon';
import { adminClient, authorizedJob, storeImport } from '@/lib/jobs';
import { ConnectorKind } from '@/lib/ingestion';
// Only pre-approved hosts are fetched; redirects are forbidden.
// Babson-owned subdomains match *.babson.edu. CampusGroups is the campus platform many
// Babson clubs, houses, and Greek chapters publish their events on; enable specific
// per-chapter feeds through the moderator source registration flow.
const ALLOWED_EXTERNAL_HOSTS = new Set(['campusgroups.com', 'babsonathletics.com']);
function belongFeed() {
  const start = DateTime.now().setZone('America/New_York').toISODate();
  const end = DateTime.now().setZone('America/New_York').plus({ days: 60 }).toISODate();
  return new URL(
    `https://belong.babson.edu/mobile_ws/v17/mobile_calendar.aspx?view=list&calendarView=list&range=0&limit=200&start_date=${start}&end_date=${end}`,
  );
}
// Belong's public calendar page is a shell. The events are in its CampusGroups JSON API.
// The placeholder CampusGroups login URL is the same calendar, so it uses that API too.
function fetchUrl(sourceUrl: string) {
  const url = new URL(sourceUrl);
  if (url.hostname === 'belong.babson.edu') return belongFeed();
  if (url.hostname === 'campusgroups.com') return belongFeed();
  return url;
}
function isAllowedHost(hostname: string) {
  const h = hostname.toLowerCase();
  if (h === 'babson.edu' || h.endsWith('.babson.edu')) return true;
  if (ALLOWED_EXTERNAL_HOSTS.has(h)) return true;
  for (const external of ALLOWED_EXTERNAL_HOSTS) if (h.endsWith(`.${external}`)) return true;
  return false;
}
export async function GET(request: Request) {
  if (!authorizedJob(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const db = adminClient();
  const { data: sources, error } = await db
    .from('sources')
    .select('*')
    .eq('enabled', true)
    .in('kind', ['ics', 'rss', 'web', 'html']);
  if (error) return Response.json({ error: 'Sources unavailable' }, { status: 500 });
  const results = [];
  for (const source of sources || []) {
    try {
      const url = fetchUrl(source.url);
      if (
        url.protocol !== 'https:' ||
        url.port ||
        url.username ||
        url.password ||
        !isAllowedHost(url.hostname)
      )
        throw new Error('Source host is not allowlisted');
      const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`Source returned ${response.status}`);
      if (Number(response.headers.get('content-length')) > 1_000_000)
        throw new Error('Feed too large');
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Empty feed');
      let size = 0;
      const chunks: Uint8Array[] = [];
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 1_000_000) {
          await reader.cancel();
          throw new Error('Feed too large');
        }
        chunks.push(value);
      }
      const content = Buffer.concat(chunks).toString('utf8');
      const result = await storeImport(
        source.id,
        content,
        source.kind as ConnectorKind,
        source.url,
      );
      await db
        .from('sources')
        .update({
          last_checked_at: new Date().toISOString(),
          last_success_at: result.errors.length ? source.last_success_at : new Date().toISOString(),
          last_error: result.errors.join('; ').slice(0, 1000) || null,
        })
        .eq('id', source.id);
      results.push({ source: source.name, ...result });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Import failed';
      await db
        .from('sources')
        .update({ last_checked_at: new Date().toISOString(), last_error: message })
        .eq('id', source.id);
      results.push({ source: source.name, error: message });
    }
  }
  return Response.json({ results });
}
export async function POST(request: Request) {
  if (!authorizedJob(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    if (Number(request.headers.get('content-length')) > 1_000_000)
      return Response.json({ error: 'Payload too large' }, { status: 413 });
    const raw = await request.text();
    if (raw.length > 1_000_000)
      return Response.json({ error: 'Payload too large' }, { status: 413 });
    const body = JSON.parse(raw);
    const db = adminClient();
    const { data: source } = await db
      .from('sources')
      .select('*')
      .eq('id', body.source_id)
      .eq('enabled', true)
      .eq('kind', 'email')
      .single();
    if (!source) throw new Error('Forwarded-email source is not enabled');
    return Response.json(
      await storeImport(source.id, JSON.stringify(body.event), 'email', source.url),
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Invalid forwarded event' },
      { status: 400 },
    );
  }
}
