import Hub from '@/components/hub';
import { redirect } from 'next/navigation';
import { verifiedSession } from '@/lib/auth-navigation';
import { loadHubData } from '@/lib/hub-data';
import Link from 'next/link';
export const dynamic = 'force-dynamic';

export default async function AppPage() {
  const session = await verifiedSession();
  if (!session) redirect('/login');
  let initial;
  try {
    initial = await loadHubData(session);
  } catch (error) {
    console.error('loadHub failed:', error instanceof Error ? error.message : error);
    return (
      <main className="offline">
        <h1>Your plans couldn’t load.</h1>
        <p>Please try again in a moment.</p>
        <Link href="/app">Try again</Link>
      </main>
    );
  }
  return <Hub live initial={initial} sample={[]} initialError="" />;
}
