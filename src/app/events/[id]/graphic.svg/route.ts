import { createHash } from 'node:crypto';
import { DateTime } from 'luxon';
import { studentClient } from '@/lib/supabase/server';

// Swiss-style event poster generated per event. Grid, restrained typography, one geometric
// mark, and a duotone palette derived from the event category. Deterministic on event id.

type Palette = { bg: string; ink: string; accent: string; muted: string };
const PALETTES: Record<string, Palette> = {
  Social: { bg: '#F3EFE7', ink: '#101010', accent: '#D63530', muted: '#5B564F' },
  'Food & drink': { bg: '#101010', ink: '#F1E6C8', accent: '#E5B12B', muted: '#8B8069' },
  'Sports & outdoors': { bg: '#F5EEE1', ink: '#141414', accent: '#D96020', muted: '#5A5147' },
  'Arts & culture': { bg: '#EFE7DE', ink: '#141414', accent: '#7C1E23', muted: '#605349' },
  Learning: { bg: '#F4F2EC', ink: '#0E1730', accent: '#1E3EDF', muted: '#4A5064' },
  Wellness: { bg: '#E6EDDF', ink: '#0F2A1A', accent: '#1F4630', muted: '#546957' },
  Professional: { bg: '#0F172A', ink: '#F4F1E8', accent: '#1AA26B', muted: '#93A1B8' },
};
const MARKS: Record<string, 'ring' | 'square' | 'triangle' | 'grid' | 'bar' | 'wedge' | 'chevron'> = {
  Social: 'ring',
  'Food & drink': 'wedge',
  'Sports & outdoors': 'chevron',
  'Arts & culture': 'square',
  Learning: 'grid',
  Wellness: 'ring',
  Professional: 'bar',
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

function renderMark(kind: string, accent: string, ink: string) {
  switch (kind) {
    case 'ring':
      return `<circle cx="980" cy="180" r="130" fill="none" stroke="${accent}" stroke-width="18"/>`;
    case 'square':
      return `<rect x="860" y="80" width="220" height="220" fill="${accent}"/>`;
    case 'triangle':
      return `<polygon points="1080,80 1080,300 870,300" fill="${accent}"/>`;
    case 'grid':
      return `
      <g stroke="${accent}" stroke-width="6" fill="none">
        <line x1="860" y1="80" x2="1080" y2="80"/>
        <line x1="860" y1="180" x2="1080" y2="180"/>
        <line x1="860" y1="280" x2="1080" y2="280"/>
        <line x1="860" y1="80" x2="860" y2="280"/>
        <line x1="970" y1="80" x2="970" y2="280"/>
        <line x1="1080" y1="80" x2="1080" y2="280"/>
      </g>`;
    case 'bar':
      return `
      <g fill="${accent}">
        <rect x="860" y="90" width="220" height="34"/>
        <rect x="900" y="150" width="180" height="34" fill-opacity="0.6"/>
        <rect x="940" y="210" width="140" height="34" fill-opacity="0.35"/>
      </g>`;
    case 'wedge':
      return `<path d="M860,80 L1080,80 L1080,300 Z" fill="${accent}"/>`;
    case 'chevron':
      return `
      <g fill="none" stroke="${accent}" stroke-width="20" stroke-linecap="square">
        <polyline points="860,120 970,220 1080,120"/>
        <polyline points="860,220 970,320 1080,220" stroke-opacity="0.55"/>
      </g>`;
    default:
      return `<circle cx="980" cy="180" r="120" fill="${accent}"/>`;
  }
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
    // Fall through so the SVG never blocks on auth; only verified students see full details.
  }
  if (!data) return new Response('Not found', { status: 404 });
  const title = data.title || 'Campus plan';
  const category = data.category || 'Social';
  const location = escapeXml(data.location || 'Babson campus');
  const startsAt = data.starts_at
    ? DateTime.fromISO(data.starts_at).setZone('America/New_York')
    : null;
  const day = startsAt ? startsAt.toFormat('dd') : '\u2014';
  const monthYear = startsAt ? startsAt.toFormat("LLL '\u2019'yy").toUpperCase() : '';
  const weekday = startsAt ? startsAt.toFormat('cccc').toUpperCase() : '';
  const time = startsAt ? startsAt.toFormat('h:mma').toLowerCase() : '';
  const palette = PALETTES[category] ?? PALETTES.Social;
  const mark = MARKS[category] ?? 'ring';
  const titleLines = wrap(title, 16, 3);
  const idx = pick(id, 4);
  const rotate = ['0', '-2', '2', '0'][idx];
  const font = `'Neue Haas Grotesk Text', 'Helvetica Neue', Helvetica, Arial, sans-serif`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" role="img" aria-label="${escapeXml(title)}">
  <rect width="1200" height="630" fill="${palette.bg}"/>
  <g font-family="${font}" fill="${palette.ink}">
    <line x1="80" y1="82" x2="1120" y2="82" stroke="${palette.ink}" stroke-width="2"/>
    <text x="80" y="70" font-size="22" letter-spacing="6">COMMON \u2014 BABSON</text>
    <text x="1120" y="70" text-anchor="end" font-size="22" letter-spacing="6" fill="${palette.muted}">${escapeXml(category.toUpperCase())}</text>

    ${renderMark(mark, palette.accent, palette.ink)}

    <g transform="translate(80 240) rotate(${rotate})">
      <text font-size="240" font-weight="800" letter-spacing="-8" fill="${palette.ink}">${escapeXml(day)}</text>
    </g>
    <text x="80" y="290" font-size="26" letter-spacing="4" fill="${palette.muted}">${escapeXml(weekday)}</text>
    <text x="80" y="322" font-size="26" letter-spacing="4" fill="${palette.muted}">${escapeXml(monthYear)} \u00b7 ${escapeXml(time)}</text>

    ${titleLines
      .map(
        (line, i) =>
          `<text x="80" y="${400 + i * 56}" font-size="52" font-weight="700" letter-spacing="-1">${escapeXml(line)}</text>`,
      )
      .join('\n    ')}

    <line x1="80" y1="562" x2="1120" y2="562" stroke="${palette.ink}" stroke-width="2"/>
    <text x="80" y="595" font-size="22" letter-spacing="2">${location}</text>
    <text x="1120" y="595" text-anchor="end" font-size="22" letter-spacing="4" fill="${palette.accent}" font-weight="700">N\u00b0 ${String(idx + 1).padStart(2, '0')} / 24</text>
  </g>
</svg>`;
  return new Response(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'private, max-age=300',
    },
  });
}
