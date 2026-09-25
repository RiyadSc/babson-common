import { Club, ClubRequest } from './domain';
import { studentClient } from './supabase/server';
import { runTransientQuery } from './transient-query';

export type StudentSession = Awaited<ReturnType<typeof studentClient>>;

export async function loadHubData({ client, user }: StudentSession) {
  const [events, profile, attendance, saves, notifications, clubs, clubRequests] =
    await Promise.all([
      runTransientQuery('event_feed', () =>
        client.from('event_feed').select('*').order('starts_at').limit(500),
      ),
      runTransientQuery('profiles', () =>
        client.from('profiles').select('*').eq('id', user.id).single(),
      ),
      runTransientQuery('attendance', () =>
        client.from('attendance').select('event_id,status').eq('user_id', user.id),
      ),
      runTransientQuery('saves', () =>
        client.from('saves').select('event_id').eq('user_id', user.id),
      ),
      runTransientQuery('notifications', () =>
        client.from('notifications').select('*').order('created_at', { ascending: false }).limit(50),
      ),
      runTransientQuery('organizers', () =>
        client
          .from('organizers')
          .select('id,name,acronym,bio,logo_path,instagram,website,verified_at,owner_id')
          .eq('kind', 'club')
          .order('name')
          .limit(1000),
      ),
      runTransientQuery('club_requests', () =>
        client
          .from('club_requests')
          .select('id,club_name,status,created_at')
          .eq('requester_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10),
      ),
    ]);

  return {
    events: events.map((event) => ({
      ...event,
      attendance: attendance.find((item) => item.event_id === event.id)?.status,
      saved: saves.some((item) => item.event_id === event.id),
    })),
    profile,
    notifications,
    clubs: clubs as Club[],
    clubRequests: clubRequests as ClubRequest[],
  };
}
