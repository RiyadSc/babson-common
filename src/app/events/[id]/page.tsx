import Hub from '@/components/hub';
import { loadHub } from '@/app/actions';
import { verifiedSession } from '@/lib/auth-navigation';
import { notFound, redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await verifiedSession())) redirect(`/login?next=${encodeURIComponent(`/events/${id}`)}`);

  const initial = await loadHub();
  if (!initial.events.some((event) => event.id === id)) notFound();

  return <Hub live initial={initial} sample={[]} initialError="" initialEventId={id} />;
}
