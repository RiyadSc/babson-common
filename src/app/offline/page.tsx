import Link from 'next/link';
export default function Offline() {
  return (
    <main className="offline">
      <h1>You’re a little off the grid.</h1>
      <p>
        Reconnect to see the latest plans and your schedule. Your place in an activity won’t change
        while you’re offline.
      </p>
      <Link href="/">Try again</Link>
    </main>
  );
}
