import { notFound } from 'next/navigation';
import Hub from '@/components/hub';
import { configured } from '@/lib/env';
import { sampleEvents } from '@/lib/seed';
export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  if (configured()) notFound();
  const { event } = await searchParams;
  return (
    <Hub
      live={false}
      initial={null}
      sample={sampleEvents()}
      initialError=""
      initialEventId={event}
    />
  );
}
