import { authorizedJob, runReminders } from '@/lib/jobs';
export async function GET(request: Request) {
  if (!authorizedJob(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return Response.json(await runReminders());
  } catch {
    return Response.json(
      { error: 'Reminder job failed. Check database and provider configuration.' },
      { status: 500 },
    );
  }
}
