import Hub from '@/components/hub';
import { redirect } from 'next/navigation';
import { verifiedSession } from '@/lib/auth-navigation';
import { loadHub } from '../actions';
import Link from 'next/link';
export const dynamic = 'force-dynamic';

// The first load right after the magic-link callback can fail transiently while the new
// session and database connection warm up; one quick retry avoids showing an error page.
async function loadHubWithRetry() {
  try {
    return await loadHub();
  } catch (first) {
    console.error('loadHub failed, retrying:', first instanceof Error ? first.message : first);
    await new Promise((r) => setTimeout(r, 400));
    return await loadHub();
  }
}

export default async function AppPage() {
  if (!(await verifiedSession())) redirect('/login');
  let initial;
  try {
    initial = await loadHubWithRetry();
  } catch (error) {
    console.error('loadHub failed after retry:', error instanceof Error ? error.message : error);
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
