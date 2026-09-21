import Hub from '@/components/hub';
import { redirect } from 'next/navigation';
import { verifiedSession } from '@/lib/auth-navigation';
import { loadHub } from '../actions';
import Link from 'next/link';
export const dynamic = 'force-dynamic';
export default async function AppPage() {
  if (!(await verifiedSession())) redirect('/login');
  let initial;
  try {
    initial = await loadHub();
  } catch {
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
