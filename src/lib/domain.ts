import { z } from 'zod';
import { DateTime } from 'luxon';
export const CATEGORIES = [
  'Social',
  'Food & drink',
  'Sports & outdoors',
  'Arts & culture',
  'Learning',
  'Wellness',
  'Professional',
] as const;
export type Category = (typeof CATEGORIES)[number];
export type CampusEvent = {
  id: string;
  title: string;
  description: string;
  category: string;
  organizer: string;
  organizer_id?: string | null;
  organizer_is_club?: boolean | null;
  organizer_verified?: boolean | null;
  organizer_logo?: string | null;
  organizer_category?: 'office' | 'greek' | 'club' | null;
  going_count?: number | null;
  host_id: string | null;
  location: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  cost: number;
  expectations: string;
  cancellation_policy: string;
  kind: 'student' | 'campus';
  status: 'published' | 'hidden' | 'cancelled';
  verified_at: string;
  source_name: string;
  source_url?: string;
  register_url?: string;
  image?: string;
  attendance?: 'joined' | 'waitlisted';
  saved?: boolean;
  seats_left?: number;
};
export type Profile = {
  id: string;
  name: string;
  interests: string[];
  reminders: boolean;
  role: 'student' | 'moderator';
};
export type Club = {
  id: string;
  name: string;
  acronym: string | null;
  bio: string | null;
  logo_path: string | null;
  instagram: string | null;
  website: string | null;
  verified_at: string | null;
  owner_id: string | null;
};
export type ClubRequest = {
  id: string;
  club_name: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
};
export function clubLogoUrl(path: string | null | undefined) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!path || !base) return null;
  return `${base}/storage/v1/object/public/club-logos/${path}`;
}
export const clubProfileSchema = z.object({
  bio: z.string().trim().max(600).optional().default(''),
  instagram: z
    .string()
    .trim()
    .transform((v) => v.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/$/, ''))
    .pipe(z.string().regex(/^[A-Za-z0-9._]{0,30}$/, 'Enter an Instagram handle like babsonfrisbee'))
    .optional()
    .default(''),
  website: z
    .string()
    .trim()
    .refine((v) => v === '' || (/^https:\/\//i.test(v) && v.length <= 300), 'Website must start with https://')
    .optional()
    .default(''),
});
export const isBabsonEmail = (email: string) => /^[^\s@]+@babson\.edu$/i.test(email.trim());
export const activitySchema = z
  .object({
    title: z.string().trim().min(4).max(100),
    description: z.string().trim().min(15).max(3000),
    category: z.enum(CATEGORIES),
    location: z.string().trim().min(3).max(200),
    starts_at: z.iso.datetime({ offset: true }),
    ends_at: z.iso.datetime({ offset: true }),
    capacity: z.coerce.number().int().min(2).max(500),
    cost: z.coerce.number().min(0).max(1000),
    expectations: z.string().trim().min(5).max(1000),
    cancellation_policy: z.string().trim().min(5).max(500),
    organizer_id: z.uuid().optional(),
  })
  .refine((x) => new Date(x.starts_at) > new Date(), {
    message: 'Choose a future start time',
    path: ['starts_at'],
  })
  .refine((x) => new Date(x.ends_at) > new Date(x.starts_at), {
    message: 'End must be after start',
    path: ['ends_at'],
  });
export const TIMEZONE = 'America/New_York';
export function inWindow(event: CampusEvent, window: string, now = new Date()) {
  const today = DateTime.fromJSDate(now).setZone(TIMEZONE).startOf('day');
  const start = DateTime.fromISO(event.starts_at).setZone(TIMEZONE);
  if (window === 'Today') return start.hasSame(today, 'day');
  if (window === 'Tomorrow') return start.hasSame(today.plus({ days: 1 }), 'day');
  return start >= today && start < today.plus({ days: 7 });
}
export function rankEvents(events: CampusEvent[], interests: string[]) {
  const remaining = [...events];
  const result: CampusEvent[] = [];
  const cats = new Map<string, number>();
  const hosts = new Map<string, number>();
  while (remaining.length) {
    remaining.sort((a, b) => {
      const score = (e: CampusEvent) =>
        (interests.includes(e.category) ? 2 : 0) -
        (cats.get(e.category) || 0) * 3 -
        (hosts.get(e.organizer) || 0) * 4 +
        new Date(e.verified_at).getTime() / 1e13;
      return (
        score(b) - score(a) || a.starts_at.localeCompare(b.starts_at) || a.id.localeCompare(b.id)
      );
    });
    const e = remaining.shift()!;
    result.push(e);
    cats.set(e.category, (cats.get(e.category) || 0) + 1);
    hosts.set(e.organizer, (hosts.get(e.organizer) || 0) + 1);
  }
  return result;
}
export function campusTime(iso: string) {
  return DateTime.fromISO(iso).setZone(TIMEZONE).toFormat('h:mm a');
}
export function campusDate(iso: string) {
  return DateTime.fromISO(iso).setZone(TIMEZONE).toFormat('ccc, LLL d');
}
export function calendar(events: CampusEvent[]) {
  const esc = (s: string) =>
    s
      .replace(/\\/g, '\\\\')
      .replace(/\r?\n|\r/g, '\\n')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,');
  const date = (s: string) =>
    new Date(s)
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z/, 'Z');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Common//Babson Events//EN',
    'CALSCALE:GREGORIAN',
    ...events.flatMap((e) => [
      'BEGIN:VEVENT',
      `UID:${esc(e.id)}@common.babson.local`,
      `DTSTAMP:${date(e.verified_at)}`,
      `DTSTART:${date(e.starts_at)}`,
      `DTEND:${date(e.ends_at)}`,
      `SUMMARY:${esc(e.title)}`,
      `LOCATION:${esc(e.location)}`,
      `DESCRIPTION:${esc(e.description)}`,
      `STATUS:${e.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`,
      'END:VEVENT',
    ]),
    'END:VCALENDAR',
  ];
  // RFC 5545 folds at 75 octets, including UTF-8 multi-byte characters.
  return (
    lines
      .map((line) => {
        let out = '',
          part = '';
        for (const c of line) {
          if (new TextEncoder().encode(part + c).length > 75) {
            out += part + '\r\n';
            part = ' ';
          }
          part += c;
        }
        return out + part;
      })
      .join('\r\n') + '\r\n'
  );
}
