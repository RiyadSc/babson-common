'use client';
import { useEffect, useState, useTransition } from 'react';
import { loadModeration, moderate, reviewDraft, screenshotUrl } from '@/app/actions';
export default function Moderation() {
  const [data, setData] = useState<Awaited<ReturnType<typeof loadModeration>> | null>(null);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const [imageUrl, setImageUrl] = useState('');
  const [edit, setEdit] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const refresh = () =>
    loadModeration()
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    void refresh();
  }, []);
  const run = (fn: () => Promise<void>) =>
    start(async () => {
      setError('');
      try {
        await fn();
        setEditing(null);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not complete review');
      }
    });
  return (
    <section className="moderation-grid">
      {imageUrl && (
        <a href={imageUrl} target="_blank" rel="noreferrer">
          Open screenshot (link expires in one minute) ↗
        </a>
      )}
      <div className="welcome">
        <div>
          <div className="eyebrow">CARE FOR THE COMMUNITY</div>
          <h1>Behind the good plans.</h1>
          <p>Every review leaves a record. Resolve concerns and keep listings trustworthy.</p>
        </div>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {!data ? (
        <p>Loading moderation queue…</p>
      ) : (
        <>
          <div className="metrics">
            {Object.entries(data.metrics || {}).map(([k, v]) => (
              <div key={k} className="metric">
                <strong>{String(v)}</strong>
                <span>{k.replaceAll('_', ' ')}</span>
              </div>
            ))}
          </div>
          <section className="moderation-card">
            <h2>Open reports</h2>
            {!data.reports?.length && <p>No open reports.</p>}
            {data.reports?.map((r) => (
              <div className="moderation-row" key={r.id}>
                <h3>{r.reason}</h3>
                <p>{r.details}</p>
                <p>Event: {r.event_id}</p>
                <label>
                  Review reason
                  <input
                    aria-label={`Review reason ${r.id}`}
                    value={notes[r.id] || ''}
                    onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                  />
                </label>
                <div>
                  {['published', 'hidden', 'cancelled'].map((res) => (
                    <button
                      key={res}
                      disabled={pending || !notes[r.id] || notes[r.id].length < 10}
                      className="button secondary"
                      onClick={() => run(() => moderate(r.event_id, res, notes[r.id]))}
                    >
                      {res === 'published'
                        ? 'Restore'
                        : res === 'hidden'
                          ? 'Keep hidden'
                          : 'Cancel event'}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>
          <section className="moderation-card">
            <h2>Import review</h2>
            <p>
              Check the original source, dates, venue, cost, and expectations before publishing.
            </p>
            {!data.drafts?.length && <p>No drafts awaiting review.</p>}
            {data.drafts?.map((d) => (
              <div className="moderation-row" key={d.id}>
                <h3>{d.payload.title || 'New submission'}</h3>
                <p>
                  Confidence: {Math.round(d.confidence * 100)}% · Fingerprint:{' '}
                  {d.fingerprint.slice(0, 12)}
                </p>
                {d.payload.source_url && (
                  <a href={d.payload.source_url} target="_blank" rel="noreferrer">
                    Open original source ↗
                  </a>
                )}
                {d.raw.screenshot_path && (
                  <button
                    className="text-button"
                    onClick={() =>
                      run(async () => {
                        setImageUrl(await screenshotUrl(d.raw.screenshot_path));
                      })
                    }
                  >
                    View private screenshot
                  </button>
                )}
                <pre>{JSON.stringify(d.payload, null, 2)}</pre>
                {editing === d.id ? (
                  <>
                    <label>
                      Verified event fields (JSON)
                      <textarea value={edit} onChange={(e) => setEdit(e.target.value)} />
                    </label>
                    <button
                      disabled={pending}
                      className="button primary"
                      onClick={() => run(() => reviewDraft(d.id, 'publish', JSON.parse(edit)))}
                    >
                      Publish verified event
                    </button>
                  </>
                ) : (
                  <button
                    className="button secondary"
                    onClick={() => {
                      setEditing(d.id);
                      setEdit(
                        JSON.stringify(
                          {
                            ...d.payload,
                            category: 'Social',
                            capacity: 30,
                            cost: 0,
                            expectations:
                              'Everyone is welcome. Check the source for accessibility details.',
                            cancellation_policy:
                              'Check source and in-app updates before traveling.',
                          },
                          null,
                          2,
                        ),
                      );
                    }}
                  >
                    Review & complete
                  </button>
                )}
                <button
                  disabled={pending}
                  className="text-button"
                  onClick={() => run(() => reviewDraft(d.id, 'reject', {}))}
                >
                  Reject
                </button>
                <label>
                  Existing event ID (for duplicates)
                  <input
                    aria-label={`Duplicate event ${d.id}`}
                    value={notes[d.id] || ''}
                    onChange={(e) => setNotes((n) => ({ ...n, [d.id]: e.target.value }))}
                  />
                </label>
                <button
                  disabled={pending || !notes[d.id]}
                  className="text-button"
                  onClick={() => run(() => reviewDraft(d.id, 'duplicate', {}, notes[d.id]))}
                >
                  Mark as duplicate
                </button>
              </div>
            ))}
          </section>
          <section className="moderation-card">
            <h2>Source health</h2>
            {data.sources?.map((s) => (
              <div className="moderation-row" key={s.id}>
                <h3>{s.name}</h3>
                <p>
                  {s.enabled ? 'Enabled' : 'Paused'} · Last checked: {s.last_checked_at || 'Never'}
                </p>
                <p>{s.last_error || 'No recorded errors'}</p>
              </div>
            ))}
          </section>
          <section className="moderation-card">
            <h2>Recent audit history</h2>
            {data.audit?.map((a) => (
              <div className="moderation-row" key={a.id}>
                <strong>{a.action}</strong> · {new Date(a.created_at).toLocaleString()}
                <pre>{JSON.stringify(a.details)}</pre>
              </div>
            ))}
          </section>
        </>
      )}
    </section>
  );
}
