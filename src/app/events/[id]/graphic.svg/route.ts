import { createHash } from 'node:crypto';
import { DateTime } from 'luxon';
import { studentClient } from '@/lib/supabase/server';

// Deterministic, publicly cacheable SVG poster for events without their own artwork.
// Colors and glyphs derive from the event id + title so the same event always renders
// the same graphic, without exposing PII beyond what event_feed already exposes.

const PALETTES: Array<[string, string, string]> = [
  ['#0f4d2e', '#7bc57a', '#f8fbf6'],
  ['#1c2540', '#8ea2ff', '#f4f6ff'],
  ['#4a1a3d', '#f28fbf', '#fdf3f8'],
  ['#3d2a00', '#f5c04a', '#fff9ec'],
  ['#0b3948', '#69c5d6', '#f2fbff'],
  ['#43241a', '#e88a5c', '#fff5ee'],
];
const GLYPHS: Record<string, string> = {
  'Social': '\u2661',
  'Food & drink': '\u2615',
  'Sports & outdoors': '\u26be',
  'Arts & culture': '\u25a0',
  'Learning': '\u25c6',
  'Wellness': '\u25cb',
};

function pick(id: string, mod: number) {
  return parseInt(createHash('sha256').update(id).digest('hex').slice(0, 8), 16) % mod;
}
function escapeXml(input: string) {
  return input.replace(/[<>&"']/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!,
  );
}
function wrap(text: string, perLine: number, maxLines: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > perLine) {
      if (current) lines.push(current.trim());
      current = word;
    } else {
      current = (current + ' ' + word).trim();
    }
    if (lines.length >= maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current.trim());
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\.*$/, '') + '\u2026';
  }
  return lines;
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return new Response('Not found', { status: 404 });
  }
  type Row = { title: string; category: string; starts_at: string; location: string };
  let data: Row | null = null;
  try {
    const { client } = await studentClient();
    const result = await client
      .from('event_feed')
      .select('title, category, starts_at, location')
      .eq('id', id)
      .single();
    data = (result.data as Row) ?? null;
  } catch {
    // Fall through to a generic poster so the SVG never gates on auth in a hard way;
    // titles and locations only render for verified students.
  }
  if (!data) return new Response('Not found', { status: 404 });
  const title = escapeXml(data.title || 'Campus plan');
  const category = data.category || 'Social';
  const location = escapeXml(data.location || 'Babson campus');
  const startsAt = data.starts_at;
  const dateLabel = startsAt
    ? DateTime.fromISO(startsAt).setZone('America/New_York').toFormat('ccc LLL d \u00b7 h:mma')
    : '';
  const [bg, accent, ink] = PALETTES[pick(id, PALETTES.length)];
  const glyph = GLYPHS[category] || GLYPHS.Social;
  const titleLines = wrap(title, 18, 3);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" role="img" aria-label="${title}">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="${bg}"/>
      <stop offset="100%" stop-color="${accent}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <circle cx="1000" cy="120" r="180" fill="${ink}" fill-opacity="0.08"/>
  <circle cx="120" cy="530" r="220" fill="${ink}" fill-opacity="0.06"/>
  <text x="80" y="130" font-family="Georgia, 'Times New Roman', serif" font-size="220" fill="${ink}" fill-opacity="0.55">${glyph}</text>
  <text x="80" y="200" font-family="'Helvetica Neue', Arial, sans-serif" font-size="26" letter-spacing="4" fill="${ink}" fill-opacity="0.75">${escapeXml(category.toUpperCase())}</text>
  ${titleLines
    .map(
      (line, i) =>
        `<text x="80" y="${300 + i * 78}" font-family="'Helvetica Neue', Arial, sans-serif" font-weight="700" font-size="76" fill="${ink}">${escapeXml(line)}</text>`,
    )
    .join('\n  ')}
  <text x="80" y="540" font-family="'Helvetica Neue', Arial, sans-serif" font-size="30" fill="${ink}" fill-opacity="0.9">${escapeXml(dateLabel)}</text>
  <text x="80" y="580" font-family="'Helvetica Neue', Arial, sans-serif" font-size="28" fill="${ink}" fill-opacity="0.75">${location}</text>
  <text x="1120" y="590" text-anchor="end" font-family="'Helvetica Neue', Arial, sans-serif" font-size="22" letter-spacing="6" fill="${ink}" fill-opacity="0.6">COMMON \u00b7 BABSON</text>
</svg>`;
  return new Response(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'private, max-age=300',
    },
  });
}
