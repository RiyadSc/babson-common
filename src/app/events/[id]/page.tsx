import Hub from '@/components/hub';
import { verifiedSession } from '@/lib/auth-navigation';
import { loadHubData } from '@/lib/hub-data';
import { notFound, redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await verifiedSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/events/${id}`)}`);

  const initial = await loadHubData(session);
  if (!initial.events.some((event) => event.id === id)) notFound();

  return <Hub live initial={initial} sample={[]} initialError="" initialEventId={id} />;
}
