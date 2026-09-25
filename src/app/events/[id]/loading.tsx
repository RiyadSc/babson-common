import { LoaderCircle } from 'lucide-react';

export default function EventLoading() {
  return (
    <main className="offline" aria-busy="true">
      <LoaderCircle className="loading-spinner" size={26} />
      <h1>Opening this plan…</h1>
      <p>Checking the latest details.</p>
    </main>
  );
}
