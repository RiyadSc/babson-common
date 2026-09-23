'use client';
import { useMemo, useState, useTransition } from 'react';
import { ArrowRight, AtSign, BadgeCheck, Building2, Check, Globe, Search, X } from 'lucide-react';
import { campusDate, campusTime, CampusEvent, Club, clubLogoUrl } from '@/lib/domain';
import { requestClub, updateClub } from '@/app/actions';

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter((w) => /^[\p{L}\p{N}]/u.test(w))
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function OrgAvatar({
  name,
  logo,
  size = 'sm',
}: {
  name: string;
  logo?: string | null;
  size?: 'sm' | 'lg';
}) {
  const url = clubLogoUrl(logo);
  return (
    <span className={`org-avatar org-avatar-${size}`} aria-hidden="true">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- Logos come from Supabase public storage.
        <img src={url} alt="" loading="lazy" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

export function VerifiedMark({ label = true }: { label?: boolean }) {
  return (
    <span className="verified-mark" title="Verified organisation">
      <BadgeCheck size={15} aria-hidden="true" />
      {label ? 'Verified' : <span className="sr-only">Verified organisation</span>}
    </span>
  );
}

export function OrgFilter({
  events,
  selected,
  onChange,
}: {
  events: CampusEvent[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const options = useMemo(() => {
    const counts = new Map<
      string,
      { count: number; verified: boolean; logo: string | null; category: 'office' | 'greek' | 'club' }
    >();
    for (const e of events) {
      if (e.status !== 'published' || new Date(e.ends_at) < new Date() || !e.organizer_is_club) continue;
      const prev = counts.get(e.organizer);
      counts.set(e.organizer, {
        count: (prev?.count || 0) + 1,
        verified: Boolean(prev?.verified || e.organizer_verified),
        logo: prev?.logo || e.organizer_logo || null,
        category: prev?.category || e.organizer_category || 'club',
      });
    }
    return [...counts.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => Number(b.verified) - Number(a.verified) || a.name.localeCompare(b.name));
  }, [events]);
  const visible = options.filter((o) => o.name.toLowerCase().includes(query.toLowerCase()));
  const groups = (
    [
      ['office', 'University offices'],
      ['greek', 'Greek life'],
      ['club', 'Clubs'],
    ] as const
  )
    .map(([id, label]) => ({ id, label, items: visible.filter((o) => o.category === id) }))
    .filter((g) => g.items.length);
  const toggle = (name: string) =>
    onChange(selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name]);
  return (
    <div className="org-filter">
      <div className="org-filter-bar">
        <button
          className={`filter-button ${open || selected.length ? 'selected' : ''}`}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <Building2 size={16} />
          <span>{selected.length ? `Organisations · ${selected.length}` : 'All organisations'}</span>
        </button>
        {selected.map((name) => (
          <button key={name} className="org-chip" onClick={() => toggle(name)}>
            {name}
            <X size={13} aria-label={`Remove ${name}`} />
          </button>
        ))}
        {selected.length > 0 && (
          <button className="text-button" onClick={() => onChange([])}>
            Clear
          </button>
        )}
      </div>
      {open && (
        <div className="org-filter-panel">
          <label className="search-input">
            <Search size={16} />
            <input
              aria-label="Search organisations"
              placeholder="Search clubs, frats, offices…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </label>
          <div className="org-filter-list" role="group" aria-label="Organisations">
            {groups.map((group) => (
              <div key={group.id}>
                <p className="org-group-label">{group.label}</p>
                {group.items.map((o) => (
                  <label key={o.name} className="org-option">
                    <input
                      type="checkbox"
                      checked={selected.includes(o.name)}
                      onChange={() => toggle(o.name)}
                    />
                    <OrgAvatar name={o.name} logo={o.logo} />
                    <span className="org-option-name">
                      {o.name}
                      {o.verified && <VerifiedMark label={false} />}
                    </span>
                    <small>{o.count}</small>
                  </label>
                ))}
              </div>
            ))}
            {!visible.length && <p className="fine-print">No organisations match “{query}”.</p>}
          </div>
          <div className="org-filter-actions">
            <button className="button secondary" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ClubProfile({
  club,
  name,
  events,
  canEdit,
  onShow,
  onFilter,
  onEdit,
}: {
  club: Club | undefined;
  name: string;
  events: CampusEvent[];
  canEdit: boolean;
  onShow: (e: CampusEvent) => void;
  onFilter: () => void;
  onEdit: () => void;
}) {
  const upcoming = events
    .filter((e) => e.status === 'published' && new Date(e.ends_at) >= new Date())
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return (
    <div className="club-profile">
      <div className="club-header">
        <OrgAvatar name={name} logo={club?.logo_path} size="lg" />
        <div>
          <h3>
            {name} {club?.verified_at && <VerifiedMark />}
          </h3>
          {club?.acronym && <small>{club.acronym}</small>}
          {!club?.verified_at && (
            <p className="fine-print">
              Not yet managed on Common. Events are imported from the club’s public listings.
            </p>
          )}
        </div>
      </div>
      {club?.bio && <p className="detail-description">{club.bio}</p>}
      {(club?.instagram || club?.website) && (
        <div className="club-links">
          {club.instagram && (
            <a href={`https://instagram.com/${club.instagram}`} target="_blank" rel="noreferrer">
              <AtSign size={15} /> {club.instagram}
            </a>
          )}
          {club.website && (
            <a href={club.website} target="_blank" rel="noreferrer">
              <Globe size={15} /> {new URL(club.website).hostname.replace(/^www\./, '')}
            </a>
          )}
        </div>
      )}
      <div className="club-actions">
        <button className="button secondary" onClick={onFilter}>
          Only show their events
        </button>
        {canEdit && (
          <button className="button primary" onClick={onEdit}>
            Edit club profile
          </button>
        )}
      </div>
      <h3>Upcoming ({upcoming.length})</h3>
      {upcoming.length ? (
        <div className="club-events">
          {upcoming.map((e) => (
            <button key={e.id} className="lineup-item" onClick={() => onShow(e)}>
              <span>
                <strong>{e.title}</strong>
                <small>
                  {campusDate(e.starts_at)} · {campusTime(e.starts_at)} · {e.location}
                </small>
              </span>
              <ArrowRight size={15} />
            </button>
          ))}
        </div>
      ) : (
        <p className="fine-print">Nothing scheduled right now.</p>
      )}
    </div>
  );
}

export function ClubRequestForm({ clubs, done }: { clubs: Club[]; done: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [choice, setChoice] = useState('');
  return (
    <form
      className="stack-form"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        start(async () => {
          setError('');
          const result = await requestClub(form);
          if (result.error) setError(result.error);
          else done();
        });
      }}
    >
      <p>
        Run comms for a club, society, frat or office? Request to manage it. Once a moderator
        verifies you, you can post as the club, add its logo, and see who’s going to its events.
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <label>
        Your organisation
        <select name="organizer_id" value={choice} onChange={(e) => setChoice(e.target.value)}>
          <option value="">It’s not listed — I’ll type the name</option>
          {clubs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.verified_at ? ' (verified)' : ''}
            </option>
          ))}
        </select>
      </label>
      {!choice && (
        <label>
          Organisation name
          <input name="club_name" minLength={2} maxLength={100} required />
        </label>
      )}
      <label>
        Your role
        <input
          name="role_title"
          placeholder="e.g. VP Communications"
          minLength={2}
          maxLength={80}
          required
        />
      </label>
      <label>
        Logo (optional)
        <input type="file" name="logo" accept="image/png,image/jpeg,image/webp" />
      </label>
      <p className="field-hint">Square works best. PNG, JPEG, or WebP up to 5 MB.</p>
      <label>
        Anything that helps us verify you (optional)
        <textarea
          name="note"
          maxLength={500}
          placeholder="e.g. link to your officer listing on Belong"
        />
      </label>
      <button className="button primary" disabled={pending}>
        {pending ? 'Sending…' : 'Send request'} <ArrowRight size={17} />
      </button>
    </form>
  );
}

export function ClubEditForm({ club, done }: { club: Club; done: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  return (
    <form
      className="stack-form"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        start(async () => {
          setError('');
          const result = await updateClub(form);
          if (result.error) setError(result.error);
          else done();
        });
      }}
    >
      <input type="hidden" name="organizer_id" value={club.id} />
      <div className="club-header">
        <OrgAvatar name={club.name} logo={club.logo_path} size="lg" />
        <div>
          <h3>
            {club.name} <VerifiedMark />
          </h3>
        </div>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <label>
        New logo (optional)
        <input type="file" name="logo" accept="image/png,image/jpeg,image/webp" />
      </label>
      <label>
        About
        <textarea
          name="bio"
          maxLength={600}
          defaultValue={club.bio || ''}
          placeholder="What does your club do, and who is it for?"
        />
      </label>
      <label>
        Instagram
        <input name="instagram" defaultValue={club.instagram || ''} placeholder="babsonclub" />
      </label>
      <label>
        Website
        <input
          name="website"
          type="url"
          defaultValue={club.website || ''}
          placeholder="https://…"
        />
      </label>
      <button className="button primary" disabled={pending}>
        {pending ? (
          'Saving…'
        ) : (
          <>
            <Check size={17} /> Save club profile
          </>
        )}
      </button>
    </form>
  );
}
