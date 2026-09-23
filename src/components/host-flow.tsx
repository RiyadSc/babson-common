'use client';

import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Clock, MapPin, Sparkles } from 'lucide-react';
import { CATEGORIES, Club, TIMEZONE } from '@/lib/domain';
import { DateTime } from 'luxon';

type Draft = {
  title: string;
  location: string;
  starts_at: string;
  ends_at: string;
  description: string;
  category: string;
  capacity: string;
  cost: string;
  expectations: string;
  cancellation_policy: string;
};

const initialDraft: Draft = {
  title: '',
  location: '',
  starts_at: '',
  ends_at: '',
  description: '',
  category: 'Social',
  capacity: '8',
  cost: '0',
  expectations: 'Come as you are. No experience is needed, and first-timers are welcome.',
  cancellation_policy:
    'Plans change. Please leave the activity as soon as you know so someone else can join.',
};

export default function HostFlow({
  pending,
  publish,
  clubs = [],
}: {
  pending: boolean;
  publish: (data: Record<string, unknown>) => void;
  clubs?: Club[];
}) {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState(initialDraft);
  const [postAs, setPostAs] = useState('');
  const update = (name: keyof Draft, value: string) =>
    setDraft((current) => ({ ...current, [name]: value }));

  const updateStart = (value: string) => {
    const next = { ...draft, starts_at: value };
    if (value && !draft.ends_at) {
      next.ends_at = DateTime.fromISO(value, { zone: TIMEZONE })
        .plus({ hour: 1 })
        .toFormat("yyyy-LL-dd'T'HH:mm");
    }
    setDraft(next);
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step < 3) {
      setStep((current) => current + 1);
      return;
    }
    publish({
      ...draft,
      ...(postAs ? { organizer_id: postAs } : {}),
      starts_at: DateTime.fromISO(draft.starts_at, { zone: TIMEZONE }).toUTC().toISO() || '',
      ends_at: DateTime.fromISO(draft.ends_at, { zone: TIMEZONE }).toUTC().toISO() || '',
    });
  };

  return (
    <form className="stack-form host-flow" onSubmit={submit}>
      <div className="flow-progress" aria-label={`Step ${step} of 3`}>
        {[1, 2, 3].map((number) => (
          <span key={number} className={number <= step ? 'active' : ''}>
            {number < step ? <Check size={13} /> : number}
          </span>
        ))}
        <strong>{step === 1 ? 'The plan' : step === 2 ? 'The vibe' : 'Review'}</strong>
      </div>

      {step === 1 && (
        <div className="flow-step">
          <p>Start with the details someone needs to say yes.</p>
          <label>
            Activity name
            <input
              name="title"
              value={draft.title}
              onChange={(event) => update('title', event.target.value)}
              placeholder="Coffee and a little conversation"
              required
              minLength={4}
              maxLength={100}
              autoFocus
            />
          </label>
          <label>
            Location
            <span className="input-with-icon">
              <MapPin size={18} />
              <input
                name="location"
                value={draft.location}
                onChange={(event) => update('location', event.target.value)}
                placeholder="A clear, public meeting spot"
                required
                minLength={3}
              />
            </span>
          </label>
          <div className="form-row">
            <label>
              Starts
              <input
                type="datetime-local"
                name="starts_at"
                value={draft.starts_at}
                onChange={(event) => updateStart(event.target.value)}
                required
              />
            </label>
            <label>
              Ends
              <input
                type="datetime-local"
                name="ends_at"
                value={draft.ends_at}
                onChange={(event) => update('ends_at', event.target.value)}
                required
              />
            </label>
          </div>
          <p className="field-hint">
            <Clock size={14} /> Times use Babson campus time. End defaults to one hour later.
          </p>
        </div>
      )}

      {step === 2 && (
        <div className="flow-step">
          <p>Give people enough context to know whether it feels right.</p>
          <label>
            What’s the plan?
            <textarea
              name="description"
              value={draft.description}
              onChange={(event) => update('description', event.target.value)}
              placeholder="What will you do, and what will it feel like?"
              required
              minLength={15}
              maxLength={3000}
              autoFocus
            />
          </label>
          <div className="form-row">
            <label>
              Category
              <select
                name="category"
                value={draft.category}
                onChange={(event) => update('category', event.target.value)}
              >
                {CATEGORIES.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>
            <label>
              Capacity, including you
              <input
                type="number"
                name="capacity"
                min={2}
                max={500}
                required
                value={draft.capacity}
                onChange={(event) => update('capacity', event.target.value)}
              />
            </label>
          </div>
          <label>
            Cost per person ($)
            <input
              name="cost"
              type="number"
              min={0}
              max={1000}
              step="0.01"
              required
              value={draft.cost}
              onChange={(event) => update('cost', event.target.value)}
            />
          </label>
        </div>
      )}

      {step === 3 && (
        <div className="flow-step">
          <div className="host-review">
            <Sparkles size={20} />
            <div>
              <strong>{draft.title}</strong>
              <span>
                {draft.location} ·{' '}
                {draft.starts_at
                  ? DateTime.fromISO(draft.starts_at).toFormat('ccc, LLL d · h:mm a')
                  : ''}
              </span>
            </div>
          </div>
          {clubs.length > 0 && (
            <label>
              Post as
              <select value={postAs} onChange={(event) => setPostAs(event.target.value)}>
                <option value="">Myself</option>
                {clubs.map((club) => (
                  <option key={club.id} value={club.id}>
                    {club.name} (verified)
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            What should people know?
            <textarea
              name="expectations"
              value={draft.expectations}
              onChange={(event) => update('expectations', event.target.value)}
              required
              minLength={5}
            />
          </label>
          <label>
            If plans change
            <textarea
              name="cancellation_policy"
              value={draft.cancellation_policy}
              onChange={(event) => update('cancellation_policy', event.target.value)}
              required
              minLength={5}
            />
          </label>
          <p className="fine-print">
            {postAs
              ? 'This plan appears under your club’s name and logo. You stay the host and can manage it.'
              : 'Your name is visible to the verified Babson community.'}{' '}
            Anyone can join until the plan is full.
          </p>
        </div>
      )}

      <div className="flow-actions">
        {step > 1 && (
          <button
            type="button"
            className="button secondary"
            onClick={() => setStep((current) => current - 1)}
          >
            <ArrowLeft size={17} /> Back
          </button>
        )}
        <button className="button primary" disabled={pending}>
          {step === 3 ? 'Publish hangout' : 'Continue'} <ArrowRight size={17} />
        </button>
      </div>
    </form>
  );
}
