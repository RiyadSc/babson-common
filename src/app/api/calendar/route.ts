import { loadHub } from '@/app/actions';
import { calendar, CampusEvent } from '@/lib/domain';
export async function GET() {
  try {
    const data = await loadHub();
    return new Response(
      calendar((data.events as CampusEvent[]).filter((e) => e.saved || e.attendance)),
      {
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Disposition': 'attachment; filename="common-my-week.ics"',
          'Cache-Control': 'private, no-store',
        },
      },
    );
  } catch {
    return Response.json({ error: 'Sign in to export your calendar' }, { status: 401 });
  }
}
