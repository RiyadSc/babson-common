import { LoaderCircle } from 'lucide-react';

export default function AppLoading() {
  return (
    <main className="app-loading" aria-busy="true" aria-live="polite">
      <LoaderCircle className="loading-spinner" size={28} />
      <h1>Loading what’s happening at Babson…</h1>
      <p>Getting the latest events and your plans.</p>
      <div className="loading-card-grid" aria-hidden="true">
        <div /><div /><div /><div />
      </div>
    </main>
  );
}
