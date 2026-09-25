'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { DateTime } from 'luxon';
import {
  ArrowUpRight,
  ArrowRight,
  Bookmark,
  CalendarDays,
  Check,
  ChevronRight,
  Compass,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  MapPin,
  Clock,
  Users,
  ShieldCheck,
  Bell,
  Leaf,
  LogOut,
  Flag,
  Sun,
  Download,
  GraduationCap,
  Menu,
  Share2,
  CalendarPlus,
  ListChecks,
  BadgeCheck,
  LoaderCircle,
} from 'lucide-react';
import {
  activitySchema,
  calendar,
  campusDate,
  campusTime,
  CATEGORIES,
  CampusEvent,
  Club,
  ClubRequest,
  inWindow,
  Profile,
  rankEvents,
  TIMEZONE,
} from '@/lib/domain';
import { eventAnnouncements, eventAttendees, loadHub, mutate, signOut } from '@/app/actions';
import AuthScreen from './auth-screen';
import Modal from './modal';
import Moderation from './moderation';
import HostFlow from './host-flow';
import EventArtwork from './event-artwork';
import CalendarView from './calendar-view';
import {
  ClubEditForm,
  ClubProfile,
  ClubRequestForm,
  OrgAvatar,
  OrgFilter,
  VerifiedMark,
} from './club-panels';
type Notice = { id: string; message: string; kind: string; created_at: string };
type Initial = {
  events: CampusEvent[];
  profile: Profile;
  notifications: Notice[];
  clubs?: Club[];
  clubRequests?: ClubRequest[];
} | null;
type Attendee = { name: string; status: string; joined_at: string };
type Mode = 'Discover' | 'Plans' | 'Moderation';
type DiscoverView = 'grid' | 'calendar';
type PlanTab = 'Going' | 'Saved' | 'Hosting';
const previewProfile: Profile = {
  id: 'preview-student',
  name: 'You',
  interests: [],
  reminders: true,
  role: 'student',
};
const categoryImage: Record<string, string> = {
  Social: 'sunset',
  'Food & drink': 'coffee',
  'Sports & outdoors': 'basketball',
  'Arts & culture': 'art',
  Learning: 'ideas',
  Wellness: 'walk',
  Professional: 'ideas',
};
export default function Hub({
  live,
  initial,
  sample,
  initialError,
  initialEventId,
}: {
  live: boolean;
  initial: Initial;
  sample: CampusEvent[];
  initialError: string;
  initialEventId?: string;
}) {
  const router = useRouter();
  const [events, setEvents] = useState<CampusEvent[]>(initial?.events || sample);
  const [profile, setProfile] = useState<Profile>(initial?.profile || previewProfile);
  const [notices, setNotices] = useState<Notice[]>(initial?.notifications || []);
  const [mode, setMode] = useState<Mode>('Discover');
  const [discoverView, setDiscoverView] = useState<DiscoverView>('grid');
  const [planTab, setPlanTab] = useState<PlanTab>('Going');
  const [window, setWindow] = useState('This week');
  const [category, setCategory] = useState('All plans');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(false);
  const [free, setFree] = useState(false);
  const [kind, setKind] = useState('all');
  const [modal, setModal] = useState<string | null>(
    initialEventId ? 'detail' : initial?.profile.name === 'Babson student' ? 'profile' : null,
  );
  const [selected, setSelected] = useState<string | null>(initialEventId || null);
  const [toast, setToast] = useState('');
  const [formError, setFormError] = useState('');
  const [pending, startTransition] = useTransition();
  const [busyLabel, setBusyLabel] = useState('');
  const [ready, setReady] = useState(false);
  const [announcements, setAnnouncements] = useState<{ id: string; body: string }[]>([]);
  const [clubs, setClubs] = useState<Club[]>(initial?.clubs || []);
  const [clubRequests, setClubRequests] = useState<ClubRequest[]>(initial?.clubRequests || []);
  const [orgFilter, setOrgFilter] = useState<string[]>([]);
  const [clubView, setClubView] = useState<{ id: string | null; name: string } | null>(null);
  const [attendees, setAttendees] = useState<Attendee[] | null>(null);
  const openedFromHub = useRef(false);
  /* eslint-disable react-hooks/set-state-in-effect -- Hydrate browser-local preview storage after SSR. */
  useEffect(() => {
    if (!live) {
      try {
        const saved = localStorage.getItem('common-preview-v1');
        if (saved) {
          const d = JSON.parse(saved);
          if (Array.isArray(d.events) && d.profile) {
            setEvents(d.events);
            setProfile(d.profile);
            setNotices(d.notices || []);
          }
        }
      } catch {
        /* A blocked or stale storage area can start a new preview. */
      }
    }
    setReady(true);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, [live]);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (ready && !live) {
      try {
        localStorage.setItem('common-preview-v1', JSON.stringify({ events, profile, notices }));
      } catch {
        /* Private browsing may disable storage. */
      }
    }
  }, [events, profile, notices, ready, live]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 5500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const syncEventRoute = () => {
      const match = globalThis.location.pathname.match(/^\/events\/([^/]+)$/);
      const previewId = new URLSearchParams(globalThis.location.search).get('event');
      const id = match?.[1] || previewId;
      if (id && events.some((item) => item.id === id)) {
        setSelected(id);
        setModal('detail');
      } else if (modal === 'detail') {
        setSelected(null);
        setModal(null);
      }
    };
    globalThis.addEventListener('popstate', syncEventRoute);
    return () => globalThis.removeEventListener('popstate', syncEventRoute);
  }, [events, modal]);
  const event = events.find((e) => e.id === selected);
  const hasSession = !live || Boolean(initial);
  const refresh = async () => {
    const data = await loadHub();
    setEvents(data.events as CampusEvent[]);
    setProfile(data.profile as Profile);
    setNotices(data.notifications as Notice[]);
    setClubs(data.clubs);
    setClubRequests(data.clubRequests);
  };
  const managedClubs = clubs.filter((c) => c.owner_id === profile.id && c.verified_at);
  const publishesNow = profile.role === 'moderator' || managedClubs.length > 0;
  const managesEvent = (e: CampusEvent) =>
    e.host_id === profile.id || managedClubs.some((c) => c.id === e.organizer_id);
  const byOrg = (e: CampusEvent) => orgFilter.length === 0 || orgFilter.includes(e.organizer);
  const openClub = (e: Pick<CampusEvent, 'organizer' | 'organizer_id' | 'organizer_is_club'>) => {
    setClubView({ id: e.organizer_is_club ? e.organizer_id || null : null, name: e.organizer });
    if (modal === 'detail') {
      openedFromHub.current = false;
      setSelected(null);
      globalThis.history.replaceState(null, '', live ? '/app' : '/preview');
    }
    open('club');
  };
  const viewedClub = clubView?.id ? clubs.find((c) => c.id === clubView.id) : undefined;
  const open = (name: string) => {
    setFormError('');
    setModal(name);
  };
  const switchMode = (next: Mode, tab?: PlanTab) => {
    if (next === 'Moderation' && profile.role !== 'moderator') return;
    setMode(next);
    if (tab) setPlanTab(tab);
    requestAnimationFrame(() => globalThis.scrollTo({ top: 0, behavior: 'auto' }));
  };
  const close = () => {
    const closingDetail = modal === 'detail' && selected;
    setModal(null);
    setSelected(null);
    setFormError('');
    if (closingDetail) {
      if (openedFromHub.current) {
        openedFromHub.current = false;
        globalThis.history.back();
      } else {
        router.push(live ? '/app' : '/preview');
      }
    }
  };
  const showEvent = (e: CampusEvent) => {
    setSelected(e.id);
    open('detail');
    openedFromHub.current = true;
    globalThis.history.pushState(
      null,
      '',
      live ? `/events/${e.id}` : `/preview?event=${encodeURIComponent(e.id)}`,
    );
    setAnnouncements([]);
    setAttendees(null);
    if (live) {
      void mutate('view', { id: e.id });
      void eventAnnouncements(e.id)
        .then(setAnnouncements)
        .catch(() => setFormError('Could not load host updates.'));
    }
  };
  const shareEvent = async (item: CampusEvent) => {
    const url = `${globalThis.location.origin}${live ? `/events/${item.id}` : `/preview?event=${encodeURIComponent(item.id)}`}`;
    try {
      if (navigator.share)
        await navigator.share({
          title: item.title,
          text: `${campusDate(item.starts_at)} at ${campusTime(item.starts_at)} · ${item.location}`,
          url,
        });
      else {
        await navigator.clipboard.writeText(url);
        setToast('Event link copied.');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setFormError('Could not share this event. Please try again.');
    }
  };
  const doAction = (
    action: string,
    data: Record<string, unknown>,
    message: string,
    closeAfter = false,
  ) =>
    startTransition(async () => {
      const labels: Record<string, string> = {
        submit: 'Uploading poster and publishing event…', create: 'Publishing your hangout…',
        join: 'Adding this to your plans…', leave: 'Updating your plans…', save: 'Saving your change…',
        profile: 'Saving your preferences…', report: 'Sending your report…', cancel: 'Cancelling event…',
        announce: 'Posting update…', block: 'Updating your safety settings…', check_in: 'Recording attendance…', no_show: 'Recording attendance…',
      };
      setBusyLabel(labels[action] || 'Updating…');
      setFormError('');
      try {
        if (live) {
          const result = await mutate(action, data);
          if (result.error) throw new Error(result.error);
          await refresh();
        } else if (action === 'profile') {
          setProfile((p) => ({ ...p, ...data }) as Profile);
        } else if (action === 'create') {
          const parsed = activitySchema.parse(data);
          const newEvent: CampusEvent = {
            ...parsed,
            id: crypto.randomUUID(),
            host_id: profile.id,
            organizer: profile.name === 'You' ? 'You · sample host' : profile.name,
            kind: 'student',
            status: 'published',
            verified_at: new Date().toISOString(),
            source_name: 'Student hosted',
            attendance: 'joined',
            seats_left: parsed.capacity - 1,
          };
          setEvents((es) => [newEvent, ...es]);
        } else if (action === 'block') {
          setEvents((es) => es.filter((e) => e.host_id !== data.id));
        } else if (action === 'announce') {
          setAnnouncements((a) => [{ id: crypto.randomUUID(), body: String(data.body) }, ...a]);
        } else if (action === 'submit') {
          /* Local preview records a draft notice without sending it to a moderator. */
        } else if (action === 'check_in' || action === 'no_show') {
          /* Preview only. Production records authenticated attendance signals. */
        } else
          setEvents((es) =>
            es.map((e) => {
              if (e.id !== data.id) return e;
              if (action === 'save') return { ...e, saved: Boolean(data.saved) };
              if (action === 'join' && e.kind === 'campus')
                return { ...e, attendance: 'joined', going_count: (e.going_count || 0) + 1 };
              if (action === 'leave' && e.kind === 'campus')
                return {
                  ...e,
                  attendance: undefined,
                  going_count: Math.max(0, (e.going_count || 0) - 1),
                };
              if (action === 'join')
                return {
                  ...e,
                  attendance: (e.seats_left ?? e.capacity) > 0 ? 'joined' : 'waitlisted',
                  seats_left: Math.max(0, (e.seats_left ?? e.capacity) - 1),
                };
              if (action === 'leave')
                return {
                  ...e,
                  attendance: undefined,
                  seats_left: (e.seats_left ?? 0) + (e.attendance === 'joined' ? 1 : 0),
                };
              if (action === 'cancel') return { ...e, status: 'cancelled' };
              if (action === 'report' && ['safety', 'harassment'].includes(String(data.reason)))
                return { ...e, status: 'hidden' };
              return e;
            }),
          );
        if (['join', 'cancel', 'report', 'submit', 'announce'].includes(action) && !live)
          setNotices((ns) => [
            {
              id: crypto.randomUUID(),
              message,
              kind: action,
              created_at: new Date().toISOString(),
            },
            ...ns,
          ]);
        setToast(message);
        if (closeAfter) close();
      } catch (e) {
        setFormError(e instanceof Error ? e.message : 'Please try again.');
      } finally {
        setBusyLabel('');
      }
    });
  const shown = rankEvents(
    events.filter((e) => {
      if (e.status === 'hidden') return false;
      if (mode === 'Plans' && planTab === 'Going') return Boolean(e.attendance);
      if (mode === 'Plans' && planTab === 'Saved') return Boolean(e.saved);
      if (mode === 'Plans' && planTab === 'Hosting') return managesEvent(e);
      return (
        e.status === 'published' &&
        inWindow(e, window) &&
        (category === 'All plans' || e.category === category) &&
        (!free || e.cost === 0) &&
        (kind === 'all' || e.kind === kind) &&
        byOrg(e) &&
        `${e.title} ${e.description} ${e.location} ${e.organizer}`
          .toLowerCase()
          .includes(search.toLowerCase())
      );
    }),
    profile.interests,
  );
  const scheduled = events
    .filter((e) => e.attendance === 'joined' && e.status === 'published')
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const download = () => {
    if (live) {
      const a = document.createElement('a');
      a.href = '/api/calendar';
      a.download = 'common-my-week.ics';
      a.click();
      return;
    }
    const blob = new Blob([calendar(events.filter((e) => e.attendance || e.saved))], {
      type: 'text/calendar;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'common-my-week.ics';
    a.click();
    URL.revokeObjectURL(url);
  };
  const navigation = [
    { name: 'Discover' as Mode, icon: Compass },
    { name: 'Plans' as Mode, icon: ListChecks },
  ];
  const formSubmit = (e: React.FormEvent<HTMLFormElement>, action: string, message: string) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    if (action === 'create' || action === 'submit') {
      for (const k of ['starts_at', 'ends_at']) {
        if (data[k])
          data[k] = DateTime.fromISO(String(data[k]), { zone: TIMEZONE }).toUTC().toISO() || '';
      }
    }
    doAction(action, data, message, true);
  };
  if (!hasSession)
    return <AuthScreen mode="login" available={live} callbackError={Boolean(initialError)} />;
  return (
    <div className="app-shell" aria-busy={!ready}>
      {pending && busyLabel && (
        <div className="global-progress" role="status" aria-live="polite">
          <LoaderCircle className="loading-spinner" size={19} />
          <span>{busyLabel}</span>
        </div>
      )}
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar" aria-label="Campus navigation">
        <Link className="brand" href="/" aria-label="Common home">
          common<span className="brand-dot">✳</span>
        </Link>
        <div className="campus-label">
          <span className="green-dot" /> BABSON COLLEGE <ChevronRight size={13} />
        </div>
        <nav aria-label="Main navigation">
          {navigation.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={mode === name ? 'nav-item active' : 'nav-item'}
              onClick={() => switchMode(name)}
            >
              <Icon size={20} />
              {name === 'Plans' ? 'My plans' : name}
              {name === 'Plans' && scheduled.length > 0 && (
                <span className="nav-count" aria-hidden="true">
                  {scheduled.length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-divider" />
        <span className="sidebar-caption">MAKE IT HAPPEN</span>
        <button className="nav-item" onClick={() => open('create')}>
          <Plus size={20} />
          Host a hangout
        </button>
        <button className="nav-item" onClick={() => open('submit')}>
          <CalendarPlus size={20} />
          Suggest an event
        </button>
        {profile.role === 'moderator' && (
          <button className="nav-item" onClick={() => switchMode('Moderation')}>
            <ShieldCheck size={20} />
            Moderation
          </button>
        )}
        <div className="sidebar-note">
          <span className="note-spark">✳</span>
          <h3>
            A familiar face starts
            <br />
            with a hello.
          </h3>
          <p>
            Make room for someone new.
            <br />
            That’s what Common is for.
          </p>
          <button onClick={() => open('values')}>
            Our community promise <ArrowUpRight size={15} />
          </button>
        </div>
        <button className="profile-button" onClick={() => open('profile')}>
          <span className="avatar">
            {profile.name === 'You'
              ? 'Y'
              : profile.name
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')}
          </span>
          <span>
            <strong>{profile.name}</strong>
            <small>{live ? 'Babson student' : 'Local preview'}</small>
          </span>
          <ChevronRight size={17} />
        </button>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span className="topbar-title">Your campus, a little closer.</span>
          <span className="mobile-brand">common.</span>
          <div className="topbar-actions">
            <span className="school-badge">
              <ShieldCheck size={15} />
              {live ? 'Babson students only' : 'Sample campus preview'}
            </span>
            <button
              className="icon-button notification-button"
              aria-label="Notifications"
              onClick={() => open('notifications')}
            >
              <Bell size={19} />
              {notices.length > 0 && <span />}
            </button>
            <button
              className="mobile-profile icon-button"
              aria-label="Your profile"
              onClick={() => open('profile')}
            >
              <Menu size={21} />
            </button>
          </div>
        </header>
        {!live && (
          <div className="preview-banner" role="region" aria-label="Preview information">
            <span>YOU’RE EXPLORING A PREVIEW</span> Sample events. Your plans stay in this browser.
            <button onClick={() => open('preview')}>
              How it works <ArrowUpRight size={13} />
            </button>
          </div>
        )}
        {hasSession && (
          <main id="main" className="main-content">
            {mode === 'Discover' ? (
              <>
                <section className="discover-intro">
                  <div>
                    <div className="eyebrow">WHAT’S HAPPENING AT BABSON</div>
                    <h1>This week, within reach.</h1>
                    <p>Plans you can actually join, from people around campus.</p>
                  </div>
                  <div className="discover-intro-actions">
                    <div className="view-toggle" role="tablist" aria-label="Discover view">
                      <button
                        role="tab"
                        aria-selected={discoverView === 'grid'}
                        className={discoverView === 'grid' ? 'active' : ''}
                        onClick={() => setDiscoverView('grid')}
                      >
                        <ListChecks size={15} /> Grid
                      </button>
                      <button
                        role="tab"
                        aria-selected={discoverView === 'calendar'}
                        className={discoverView === 'calendar' ? 'active' : ''}
                        onClick={() => setDiscoverView('calendar')}
                      >
                        <CalendarDays size={15} /> Calendar
                      </button>
                    </div>
                    <button className="button primary" onClick={() => open('create')}>
                      <Plus size={18} />
                      Host a hangout
                    </button>
                  </div>
                </section>
                <OrgFilter events={events} selected={orgFilter} onChange={setOrgFilter} />
                {discoverView === 'calendar' ? (
                  <CalendarView events={events.filter(byOrg)} onShow={showEvent} />
                ) : (
                <section className="discovery-section" aria-label="Discover plans">
                  <div className="section-heading">
                    <div>
                      <h2>Find your next plan</h2>
                      <p>Time, place, and who it’s for—at a glance.</p>
                    </div>
                    <span className="date-label">
                      <Sun size={17} />
                      {DateTime.now().setZone(TIMEZONE).toFormat('cccc, LLLL d')}
                    </span>
                  </div>
                  <div className="discovery-toolbar">
                    <div className="date-tabs" aria-label="Event dates">
                      {['Today', 'Tomorrow', 'This week'].map((t) => (
                        <button
                          key={t}
                          aria-pressed={window === t}
                          className={window === t ? 'selected' : ''}
                          onClick={() => setWindow(t)}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <div className="search-controls">
                      <label className="search-input">
                        <Search size={18} />
                        <input
                          aria-label="Search events"
                          placeholder="Find your next plan"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </label>
                      <button
                        className={`filter-button ${filters ? 'selected' : ''}`}
                        aria-label="Event filters"
                        aria-expanded={filters}
                        onClick={() => setFilters(!filters)}
                      >
                        <SlidersHorizontal size={17} />
                        <span>Filters</span>
                        {(free || kind !== 'all') && <span className="green-dot" />}
                      </button>
                    </div>
                  </div>
                  {filters && (
                    <div className="filters-panel">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={free}
                          onChange={(e) => setFree(e.target.checked)}
                        />
                        Free plans only
                      </label>
                      <label>
                        Hosted by
                        <select value={kind} onChange={(e) => setKind(e.target.value)}>
                          <option value="all">Everyone</option>
                          <option value="student">Students</option>
                          <option value="campus">Campus organizations</option>
                        </select>
                      </label>
                      <button
                        className="text-button"
                        onClick={() => {
                          setFree(false);
                          setKind('all');
                          setCategory('All plans');
                          setSearch('');
                          setOrgFilter([]);
                        }}
                      >
                        Reset filters
                      </button>
                    </div>
                  )}
                  <div className="category-tabs" aria-label="Categories">
                    {['All plans', ...CATEGORIES].map((c, i) => (
                      <button
                        key={c}
                        aria-pressed={category === c}
                        className={category === c ? 'active' : ''}
                        onClick={() => setCategory(c)}
                      >
                        {i === 0 ? (
                          <Sparkles size={14} />
                        ) : (
                          <span className={`category-dot cat-${i}`} />
                        )}{' '}
                        {c}
                      </button>
                    ))}
                  </div>
                  <div className="results-line">
                    <span>{shown.length} ways to get out there</span>
                    <span>
                      <Leaf size={13} /> A mix of interests. A few new faces.
                    </span>
                  </div>
                </section>
                )}
              </>
            ) : mode === 'Moderation' && profile.role === 'moderator' ? (
              <Moderation />
            ) : mode === 'Moderation' ? null : (
              <>
                <section className="discover-intro plans-intro">
                  <div>
                    <div className="eyebrow">YOUR TIME, IN ONE PLACE</div>
                    <h1>My plans</h1>
                    <p>Going, saved, and hosting—without the calendar clutter.</p>
                  </div>
                  <button className="button secondary" onClick={download}>
                    <Download size={17} />
                    Export calendar
                  </button>
                </section>
                <div className="plan-tabs" role="group" aria-label="Plan type">
                  {(['Going', 'Saved', 'Hosting'] as PlanTab[]).map((tab) => (
                    <button
                      key={tab}
                      aria-pressed={planTab === tab}
                      className={planTab === tab ? 'active' : ''}
                      onClick={() => setPlanTab(tab)}
                    >
                      {tab}
                    </button>
                  ))}
                  {planTab === 'Hosting' && (
                    <button className="button primary plan-create" onClick={() => open('create')}>
                      <Plus size={17} /> New hangout
                    </button>
                  )}
                </div>
              </>
            )}
            {mode !== 'Moderation' && !(mode === 'Discover' && discoverView === 'calendar') && (
              <div className="content-columns">
                <div>
                  {mode !== 'Discover' && <h2 className="sr-only">Your plans</h2>}
                  <div className="event-grid">
                    {(mode === 'Discover'
                      ? shown
                      : [...shown].sort((a, b) => a.starts_at.localeCompare(b.starts_at))
                    ).map((e) => (
                      <article className="event-card" key={e.id}>
                        <div className={`event-image image-${categoryImage[e.category]}`}>
                          <button
                            className="image-open"
                            aria-label={`View ${e.title}`}
                            onClick={() => showEvent(e)}
                          >
                            <EventArtwork event={e} />
                          </button>
                          <span className="type-badge">
                            {e.kind === 'student' ? (
                              <Users size={12} />
                            ) : (
                              <GraduationCap size={13} />
                            )}{' '}
                            {e.kind === 'student' ? 'Student hangout' : 'Around campus'}
                          </span>
                          <button
                            className={`save-button ${e.saved ? 'saved' : ''}`}
                            aria-label={`${e.saved ? 'Unsave' : 'Save'} ${e.title}`}
                            aria-pressed={Boolean(e.saved)}
                            onClick={() =>
                              doAction(
                                'save',
                                { id: e.id, saved: !e.saved },
                                e.saved ? 'Removed from saved plans' : 'Saved for a little later',
                              )
                            }
                          >
                            <Bookmark size={17} fill={e.saved ? 'currentColor' : 'none'} />
                          </button>
                          {e.attendance && (
                            <span className="attendance-badge">
                              <Check size={12} />
                              {e.attendance === 'joined' ? 'You’re going' : 'On the waitlist'}
                            </span>
                          )}
                        </div>
                        <div className="event-body">
                          <div className="event-eyebrow">
                            <span>{e.category}</span>
                            <span>{e.cost === 0 ? 'Free' : `$${e.cost}`}</span>
                          </div>
                          <h3>
                            <button onClick={() => showEvent(e)}>{e.title}</button>
                          </h3>
                          <div className="event-meta">
                            <Clock size={14} />
                            {mode === 'Discover' && window === 'Today'
                              ? 'Today'
                              : campusDate(e.starts_at)}{' '}
                            · {campusTime(e.starts_at)}
                          </div>
                          <div className="event-meta">
                            <MapPin size={14} />
                            {e.location}
                          </div>
                          <div className="event-availability">
                            {e.status === 'cancelled'
                              ? 'Cancelled'
                              : e.kind === 'campus'
                                ? `${e.going_count || 0} going on Common`
                                : e.seats_left === 0
                                  ? 'Waitlist open'
                                  : `${e.seats_left ?? e.capacity} spots left`}
                            <span>·</span>
                            {e.organizer_verified
                              ? 'Verified organisation'
                              : e.kind === 'student'
                                ? 'Verified student host'
                                : 'Verified campus listing'}
                          </div>
                          <div className="card-actions">
                            <button
                              className="card-share"
                              aria-label={`Share ${e.title}`}
                              onClick={() => void shareEvent(e)}
                            >
                              <Share2 size={17} />
                            </button>
                            {e.kind === 'campus' && e.status === 'published' && (
                              <button
                                className={`card-going ${e.attendance ? 'active' : ''}`}
                                aria-pressed={Boolean(e.attendance)}
                                aria-label={`${e.attendance ? 'Not going to' : 'Going to'} ${e.title}`}
                                disabled={pending}
                                onClick={() =>
                                  doAction(
                                    e.attendance ? 'leave' : 'join',
                                    { id: e.id },
                                    e.attendance
                                      ? 'Removed from your plans.'
                                      : 'Marked as going. It’s in My plans — remember to register on the event site too.',
                                  )
                                }
                              >
                                <Check size={15} />
                                {e.attendance ? 'Going' : 'Going?'}
                              </button>
                            )}
                            {managesEvent(e) && mode === 'Plans' && planTab === 'Hosting' ? (
                              <button className="button card-primary" onClick={() => showEvent(e)}>
                                Manage <ArrowRight size={15} />
                              </button>
                            ) : (e.register_url || e.source_url) && e.kind === 'campus' ? (
                              <a
                                className="button card-primary"
                                href={e.register_url || e.source_url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Register <ArrowUpRight size={15} />
                              </a>
                            ) : e.attendance || e.host_id === profile.id ? (
                              <button className="button card-primary" onClick={() => showEvent(e)}>
                                {e.host_id === profile.id ? 'Manage' : 'View plan'}
                                <ArrowRight size={15} />
                              </button>
                            ) : (
                              <button
                                className="button card-primary"
                                aria-label={`${e.seats_left === 0 ? 'Join waitlist for' : 'Join'} ${e.title}`}
                                disabled={pending || e.status === 'cancelled'}
                                onClick={() =>
                                  doAction(
                                    'join',
                                    { id: e.id },
                                    e.seats_left === 0
                                      ? 'You’re on the waitlist. We’ll let you know when a spot opens.'
                                      : 'You’re going. This plan is now in My plans.',
                                  )
                                }
                              >
                                {e.seats_left === 0 ? 'Waitlist' : 'Join'}
                                <ArrowRight size={15} />
                              </button>
                            )}
                          </div>
                          <div className="card-bottom">
                            <button
                              className="card-organizer"
                              onClick={() => openClub(e)}
                              aria-label={`About ${e.organizer}`}
                            >
                              <OrgAvatar name={e.organizer} logo={e.organizer_logo} />
                              <span className="card-organizer-name">{e.organizer}</span>
                              {e.organizer_verified && <VerifiedMark label={false} />}
                            </button>
                            <span className="capacity-label">
                              {e.status === 'cancelled'
                                ? 'Cancelled'
                                : e.kind === 'campus'
                                  ? `${e.going_count || 0} going`
                                  : e.seats_left === 0
                                    ? 'Waitlist open'
                                    : `${e.seats_left ?? e.capacity} spots`}
                              <ArrowUpRight size={13} />
                            </span>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                  {shown.length === 0 && (
                    <div className="empty-state">
                      <Sun size={32} />
                      <h2>A little quiet here.</h2>
                      <p>
                        {mode === 'Discover'
                          ? 'Try another day or a different interest. Your next plan is out there.'
                          : 'Find something that feels like you, or make the first move and host.'}
                      </p>
                      <button
                        className="button secondary"
                        onClick={() => {
                          switchMode('Discover');
                          setWindow('This week');
                          setCategory('All plans');
                          setSearch('');
                          setFree(false);
                          setKind('all');
                          setOrgFilter([]);
                        }}
                      >
                        Explore this week <ArrowRight size={16} />
                      </button>
                    </div>
                  )}
                  <div className="bottom-note">
                    <span>✳</span>
                    <p>
                      You belong here.
                      <br />
                      <strong>Even if you don’t know anyone yet.</strong>
                    </p>
                    <button onClick={() => open('values')}>
                      A note on community <ArrowUpRight size={16} />
                    </button>
                  </div>
                </div>
                <aside className="right-rail" aria-label="Your upcoming plans">
                  <section className="your-week">
                    <div className="rail-heading">
                      <h3>Your little lineup</h3>
                      <CalendarDays size={18} />
                    </div>
                    <p>Good things to look forward to.</p>
                    {scheduled.length ? (
                      scheduled.slice(0, 3).map((e) => (
                        <button className="lineup-item" key={e.id} onClick={() => showEvent(e)}>
                          <span className="date-square">
                            {DateTime.fromISO(e.starts_at).setZone(TIMEZONE).toFormat('LLL')}
                            <b>{DateTime.fromISO(e.starts_at).setZone(TIMEZONE).toFormat('d')}</b>
                          </span>
                          <span>
                            <strong>{e.title}</strong>
                            <small>
                              {campusTime(e.starts_at)} · {e.location}
                            </small>
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="lineup-empty">
                        <div className="little-calendar">
                          <span />
                          <CalendarDays size={28} />
                        </div>
                        <strong>Leave space for a little yes.</strong>
                        <p>
                          Join a plan and we’ll keep
                          <br />
                          your week together here.
                        </p>
                      </div>
                    )}
                    <button className="rail-link" onClick={() => switchMode('Plans')}>
                      See my plans <ArrowRight size={15} />
                    </button>
                  </section>
                  <section className="host-prompt">
                    <span className="drawn-star">✴</span>
                    <span className="eyebrow">BE THE REASON</span>
                    <h3>
                      “Anyone down
                      <br />
                      for…?”
                    </h3>
                    <p>
                      That’s all it takes to start.
                      <br />A coffee, a walk, a wild idea.
                    </p>
                    <button onClick={() => open('create')}>
                      Make it a hangout <Plus size={16} />
                    </button>
                  </section>
                  <div className="trust-note">
                    <ShieldCheck size={19} />
                    <p>
                      <strong>A campus-sized circle.</strong>
                      <br />
                      School email verified. Open invitations.
                      <br />A little more looking out for each other.
                    </p>
                  </div>
                </aside>
              </div>
            )}
            <footer className="page-footer">
              <span>Made for the moments between classes.</span>
              <button onClick={() => open('values')}>
                Community & safety <ArrowUpRight size={13} />
              </button>
            </footer>
          </main>
        )}
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navigation.map(({ name, icon: Icon }) => (
          <button
            key={name}
            className={mode === name ? 'active' : ''}
            onClick={() => switchMode(name)}
          >
            <Icon size={21} />
            {name === 'Plans' ? 'My plans' : name}
          </button>
        ))}
        <button onClick={() => open('create-menu')}>
          <Plus size={22} />
          Create
        </button>
        {profile.role === 'moderator' && (
          <button
            className={mode === 'Moderation' ? 'active' : ''}
            onClick={() => switchMode('Moderation')}
          >
            <ShieldCheck size={21} />
            Review
          </button>
        )}
      </nav>
      {toast && (
        <div role="status" className="toast">
          <Check size={18} />
          <span>{toast}</span>
          {toast.includes('My plans') && (
            <button
              onClick={() => {
                setModal(null);
                setSelected(null);
                openedFromHub.current = false;
                globalThis.history.replaceState(null, '', live ? '/app' : '/preview');
                switchMode('Plans');
                setToast('');
              }}
            >
              View My plans
            </button>
          )}
        </div>
      )}
      {modal && (
        <Modal
          title={
            modal === 'detail'
              ? event?.title || 'Activity unavailable'
              : {
                  create: 'A small plan. A new connection.',
                  'create-menu': 'Make something happen.',
                  profile: 'Make yourself at home.',
                  submit: 'Found something worth sharing?',
                  notifications: 'A little heads-up.',
                  values: 'Everyone starts somewhere.',
                  preview: 'Welcome to the preview.',
                  report: 'Help keep Common welcoming.',
                  announce: 'Keep everyone in the loop.',
                  cancel: 'Plans change. That’s okay.',
                  club: clubView?.name || 'Organisation',
                  'club-request': 'Represent your organisation.',
                  'club-edit': 'Your club profile.',
                }[modal] || 'Common'
          }
          close={close}
          wide={modal === 'detail' || modal === 'create'}
        >
          {formError && (
            <p role="alert" className="form-error">
              {formError}
            </p>
          )}
          {modal === 'detail' && event && (
            <>
              <div className="detail-utility">
                <button className="button secondary" onClick={() => void shareEvent(event)}>
                  <Share2 size={17} /> Share
                </button>
                <button
                  className={`button secondary ${event.saved ? 'saved' : ''}`}
                  aria-label={event.saved ? 'Unsave event' : 'Save event'}
                  disabled={pending}
                  onClick={() =>
                    doAction(
                      'save',
                      { id: event.id, saved: !event.saved },
                      event.saved ? 'Removed from saved plans' : 'Saved to My plans',
                    )
                  }
                >
                  <Bookmark size={17} fill={event.saved ? 'currentColor' : 'none'} />
                  {event.saved ? 'Saved' : 'Save'}
                </button>
              </div>
              <div className="detail-tags">
                <span className="pill">{event.category}</span>
                <span className="pill">
                  {event.cost === 0 ? 'Free to join' : `Cost: $${event.cost}`}
                </span>
                <span className="pill">
                  {event.kind === 'student' ? 'Student hosted' : 'Campus event'}
                </span>
              </div>
              <p className="detail-description">{event.description}</p>
              <div className="detail-facts">
                <div>
                  <CalendarDays size={20} />
                  <span>
                    <strong>{campusDate(event.starts_at)}</strong>
                    {campusTime(event.starts_at)} – {campusTime(event.ends_at)} · Eastern time
                  </span>
                </div>
                <div>
                  <MapPin size={20} />
                  <span>
                    <strong>{event.location}</strong>Meet here when it’s time
                  </span>
                </div>
                <div>
                  <Users size={20} />
                  {event.kind === 'campus' ? (
                    <span>
                      <strong>{event.going_count || 0} going on Common</strong>
                      Register on the event site to hold your spot
                    </span>
                  ) : (
                    <span>
                      <strong>
                        {event.seats_left === 0
                          ? 'Full · waitlist open'
                          : `${event.seats_left ?? event.capacity} places available`}
                      </strong>
                      Capacity: {event.capacity}, including the host
                    </span>
                  )}
                </div>
                <button className="detail-organizer" onClick={() => openClub(event)}>
                  <OrgAvatar name={event.organizer} logo={event.organizer_logo} />
                  <span>
                    <strong>
                      Hosted by {event.organizer}{' '}
                      {event.organizer_verified && <VerifiedMark />}
                    </strong>
                    {!live
                      ? 'Sample host · preview only'
                      : event.organizer_verified
                        ? 'Verified Babson organisation · see profile'
                        : event.kind === 'student'
                          ? 'Verified Babson community member'
                          : 'From a Babson campus listing · see profile'}
                  </span>
                </button>
              </div>
              <div className="detail-actions">
                {event.status === 'cancelled' ? (
                  <p className="cancelled-note">This activity has been cancelled.</p>
                ) : event.kind === 'campus' ? (
                  <>
                    <button
                      className={`button ${event.attendance ? 'secondary saved' : 'secondary'}`}
                      aria-pressed={Boolean(event.attendance)}
                      disabled={pending}
                      onClick={() =>
                        doAction(
                          event.attendance ? 'leave' : 'join',
                          { id: event.id },
                          event.attendance
                            ? 'Removed from your plans.'
                            : 'Marked as going. It’s in My plans — remember to register on the event site too.',
                        )
                      }
                    >
                      <Check size={16} />
                      {event.attendance ? 'You’re going' : 'I’m going'}
                    </button>
                    {(event.register_url || event.source_url) && (
                      <a
                        className="button primary"
                        href={event.register_url || event.source_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Register on event site <ArrowUpRight size={16} />
                      </a>
                    )}
                  </>
                ) : event.host_id === profile.id ? (
                  <>
                    <button className="button primary" onClick={() => open('announce')}>
                      Post an update
                    </button>
                    <button className="button secondary" onClick={() => open('cancel')}>
                      Cancel activity
                    </button>
                  </>
                ) : event.attendance ? (
                  <button
                    className="button primary"
                    disabled={pending}
                    onClick={() =>
                      doAction(
                        'leave',
                        { id: event.id },
                        'You’ve left the activity. Your calendar export can now be refreshed.',
                      )
                    }
                  >
                    {event.attendance === 'waitlisted' ? 'Leave waitlist' : 'Leave activity'}
                  </button>
                ) : (
                  <button
                    className="button primary"
                    disabled={pending}
                    onClick={() =>
                      doAction(
                        'join',
                        { id: event.id },
                        event.seats_left === 0
                          ? 'You’re on the waitlist. We’ll let you know when a spot opens.'
                          : 'You’re in! Your plan is in My plans.',
                      )
                    }
                  >
                    {event.seats_left === 0 ? 'Join waitlist' : 'Join activity'}
                    <ArrowRight size={16} />
                  </button>
                )}
              </div>
              {event.kind === 'campus' && event.status === 'published' && (
                <p className="fine-print">
                  Marking yourself as going adds this to My plans and lets the organiser see you’re
                  coming. It doesn’t register you on the event site.
                </p>
              )}
              {live && managesEvent(event) && (
                <section className="organiser-tools">
                  <h3>Organiser tools</h3>
                  <div className="detail-actions">
                    {event.host_id !== profile.id && event.status === 'published' && (
                      <button className="button secondary" onClick={() => open('announce')}>
                        Post an update
                      </button>
                    )}
                    <button
                      className="button secondary"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          try {
                            setAttendees(await eventAttendees(event.id));
                          } catch (e) {
                            setFormError(e instanceof Error ? e.message : 'Could not load attendees.');
                          }
                        })
                      }
                    >
                      <Users size={16} /> See who’s going
                    </button>
                  </div>
                  {attendees && (
                    <div className="attendee-list">
                      <p>
                        <strong>{attendees.filter((a) => a.status === 'joined').length} going</strong>
                        {attendees.some((a) => a.status === 'waitlisted') &&
                          ` · ${attendees.filter((a) => a.status === 'waitlisted').length} waitlisted`}
                      </p>
                      {attendees.length ? (
                        <ul>
                          {attendees.map((a, i) => (
                            <li key={`${a.name}-${i}`}>
                              <OrgAvatar name={a.name} />
                              <span>{a.name}</span>
                              <small>
                                {a.status === 'waitlisted' ? 'Waitlist · ' : ''}
                                {campusDate(a.joined_at)}
                              </small>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="fine-print">No one yet. Share the event to get the word out.</p>
                      )}
                    </div>
                  )}
                </section>
              )}
              <h3>Before you come</h3>
              <p>{event.expectations}</p>
              <h3>If plans change</h3>
              <p>{event.cancellation_policy}</p>
              <div className="source-note">
                {event.source_url ? (
                  <a href={event.source_url} target="_blank" rel="noreferrer">
                    {event.source_name} <ArrowUpRight size={12} />
                  </a>
                ) : (
                  event.source_name
                )}{' '}
                · Last checked {campusDate(event.verified_at)}
                {!live && ' · Sample listing'}
              </div>
              {announcements.length > 0 && (
                <section>
                  <h3>From your host</h3>
                  {announcements.map((a) => (
                    <p className="announcement" key={a.id}>
                      {a.body}
                    </p>
                  ))}
                </section>
              )}
              {event.attendance === 'waitlisted' && (
                <p className="fine-print">
                  Places open in the order people joined the waitlist. We’ll notify you if you’re
                  promoted.
                </p>
              )}
              {event.attendance === 'joined' && new Date(event.starts_at) <= new Date() && (
                <div className="detail-actions">
                  <button
                    className="text-button"
                    onClick={() =>
                      doAction('check_in', { id: event.id }, 'Thanks for checking in.')
                    }
                  >
                    I attended
                  </button>
                  <button
                    className="text-button"
                    onClick={() =>
                      doAction('no_show', { id: event.id }, 'Thanks for letting us know.')
                    }
                  >
                    I couldn’t make it
                  </button>
                </div>
              )}
              <div className="safety-actions">
                <button onClick={() => open('report')}>
                  <Flag size={13} />
                  Report a concern
                </button>
                {event.host_id && event.host_id !== profile.id && (
                  <button
                    onClick={() =>
                      doAction(
                        'block',
                        { id: event.host_id },
                        'Host blocked. Their plans are now hidden from you.',
                        true,
                      )
                    }
                  >
                    Block this host
                  </button>
                )}
              </div>
            </>
          )}
          {modal === 'create-menu' && (
            <div className="create-menu">
              <p>Choose the kind of plan you want to add.</p>
              <button onClick={() => open('create')}>
                <span>
                  <Users size={22} />
                </span>
                <strong>Host a hangout</strong>
                <small>Make an open invitation students can join.</small>
                <ArrowRight size={18} />
              </button>
              <button onClick={() => open('submit')}>
                <span>
                  <CalendarPlus size={22} />
                </span>
                <strong>Suggest a campus event</strong>
                <small>
                  {publishesNow
                    ? 'Publish a campus listing.'
                    : 'Send a listing for moderator review.'}
                </small>
                <ArrowRight size={18} />
              </button>
            </div>
          )}
          {modal === 'create' && (
            <HostFlow
              pending={pending}
              clubs={managedClubs}
              publish={(data) => {
                switchMode('Plans', 'Hosting');
                doAction(
                  'create',
                  data,
                  'Your hangout is published. Share it with someone who should be there.',
                  true,
                );
              }}
            />
          )}
          {modal === 'profile' && (
            <form
              className="stack-form"
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                doAction(
                  'profile',
                  {
                    name: data.get('name'),
                    interests: data.getAll('interests'),
                    reminders: data.get('reminders') === 'on',
                  },
                  'Your profile is updated.',
                  true,
                );
              }}
            >
              <label>
                Your name
                <input
                  name="name"
                  defaultValue={profile.name}
                  required
                  minLength={2}
                  maxLength={80}
                />
              </label>
              <fieldset>
                <legend>What are you into?</legend>
                <div className="interest-options">
                  {CATEGORIES.map((c) => (
                    <label key={c} className="checkbox-label">
                      <input
                        type="checkbox"
                        name="interests"
                        value={c}
                        defaultChecked={profile.interests.includes(c)}
                      />
                      {c}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="checkbox-label">
                <input name="reminders" type="checkbox" defaultChecked={profile.reminders} />
                Email me reminders for joined plans and activity updates
              </label>
              <p className="fine-print">
                Your in-app updates are always available. Email delivery requires the live campus
                pilot.
              </p>
              <button className="button primary" disabled={pending}>
                Save preferences
              </button>
              {live && (
                <fieldset className="profile-clubs">
                  <legend>Clubs & organisations</legend>
                  {managedClubs.map((c) => (
                    <div key={c.id} className="profile-club">
                      <OrgAvatar name={c.name} logo={c.logo_path} />
                      <span>
                        <strong>{c.name}</strong> <VerifiedMark label={false} />
                        <small>You manage this organisation</small>
                      </span>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => {
                          setClubView({ id: c.id, name: c.name });
                          open('club-edit');
                        }}
                      >
                        Edit
                      </button>
                    </div>
                  ))}
                  {clubRequests
                    .filter((r) => r.status !== 'approved')
                    .slice(0, 3)
                    .map((r) => (
                      <p key={r.id} className="fine-print">
                        {r.club_name}:{' '}
                        {r.status === 'pending' ? 'waiting for verification' : 'not approved'}
                      </p>
                    ))}
                  <button type="button" className="button secondary" onClick={() => open('club-request')}>
                    <BadgeCheck size={16} /> Represent a club or organisation
                  </button>
                </fieldset>
              )}
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  close();
                  switchMode('Plans', 'Hosting');
                }}
              >
                View your hangouts
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  close();
                  open('submit');
                }}
              >
                Suggest an event
              </button>
              {live && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    startTransition(async () => {
                      await signOut();
                      router.replace('/');
                      router.refresh();
                    })
                  }
                >
                  <LogOut size={15} />
                  Sign out
                </button>
              )}
            </form>
          )}
          {modal === 'submit' && (
            <form
              className="stack-form"
              onSubmit={(e) =>
                formSubmit(
                  e,
                  'submit',
                  live
                    ? publishesNow
                      ? 'Published. It’s on Discover now.'
                      : 'Sent for review. A curator will verify it before it appears.'
                    : 'Sample suggestion saved in your preview updates.',
                )
              }
            >
              <p>
                {publishesNow
                  ? profile.role === 'moderator'
                    ? 'You’re the reviewer, so this publishes immediately.'
                    : 'Verified club managers publish without waiting for review.'
                  : 'Spotted a plan in an email, on a poster, or on a public page? Share the details. A curator checks each submission.'}
              </p>
              {managedClubs.length > 0 && (
                <label>
                  Post as
                  <select
                    name="organizer_id"
                    defaultValue={profile.role === 'moderator' ? '' : managedClubs[0].id}
                    required={profile.role !== 'moderator'}
                  >
                    {profile.role === 'moderator' && <option value="">Community listing</option>}
                    {managedClubs.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Event poster (optional)
                <input type="file" name="poster" accept="image/png,image/jpeg,image/webp" />
              </label>
              <p className="field-hint">
                PNG, JPEG, or WebP up to 5 MB. This becomes the event artwork when published.
              </p>
              <label>
                Source link
                <input name="source_url" type="url" placeholder="https://…" required />
              </label>
              <label>
                Event title
                <input name="title" minLength={4} required />
              </label>
              <label>
                Event details
                <textarea name="description" required minLength={15} />
              </label>
              <label>
                Location
                <input name="location" required />
              </label>
              <div className="form-row">
                <label>
                  Start time (Eastern)
                  <input type="datetime-local" name="starts_at" required />
                </label>
                <label>
                  End time (Eastern)
                  <input type="datetime-local" name="ends_at" />
                </label>
              </div>
              <p className="fine-print">
                Only share information you have permission to share. Don’t include private chats or
                other students’ personal information.
              </p>
              <button className="button primary" disabled={pending}>
                {pending ? (
                  <><LoaderCircle className="loading-spinner" size={17} /> {publishesNow ? 'Uploading & publishing…' : 'Uploading & sending…'}</>
                ) : (
                  <>{publishesNow ? 'Publish event' : 'Send for review'} <ArrowRight size={17} /></>
                )}
              </button>
            </form>
          )}
          {modal === 'notifications' && (
            <div className="notification-list">
              {notices.length ? (
                notices.map((n) => (
                  <div key={n.id}>
                    <Bell size={18} />
                    <p>
                      {n.message}
                      <small>{campusDate(n.created_at)}</small>
                    </p>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <Bell size={28} />
                  <h3>You’re all caught up.</h3>
                  <p>Reminders, host updates, and waitlist news will land here.</p>
                </div>
              )}
            </div>
          )}
          {modal === 'report' && event && (
            <form
              className="stack-form"
              onSubmit={(e) => {
                e.preventDefault();
                const data = Object.fromEntries(new FormData(e.currentTarget));
                doAction(
                  'report',
                  { ...data, id: event.id },
                  'Your report is recorded for review. Thank you for looking out for the community.',
                  true,
                );
              }}
            >
              <p>
                Reports are private to you and the moderation team. Safety and harassment reports
                temporarily hide the activity during review.
              </p>
              <label>
                What’s the concern?
                <select name="reason">
                  <option value="incorrect">Incorrect event details</option>
                  <option value="spam">Spam or misleading content</option>
                  <option value="harassment">Harassment or exclusion</option>
                  <option value="safety">Safety concern</option>
                </select>
              </label>
              <label>
                Tell us a little more
                <textarea name="details" required minLength={10} maxLength={2000} />
              </label>
              <button className="button primary" disabled={pending}>
                Submit report
              </button>
              <p className="fine-print">
                For immediate danger, contact emergency services. Common is not monitored as an
                emergency channel.
              </p>
            </form>
          )}
          {modal === 'announce' && event && (
            <form
              className="stack-form"
              onSubmit={(e) => {
                e.preventDefault();
                doAction(
                  'announce',
                  { id: event.id, body: new FormData(e.currentTarget).get('body') },
                  'Your update has been posted and attendees notified.',
                  true,
                );
              }}
            >
              <label>
                Update for your attendees
                <textarea name="body" minLength={5} maxLength={1000} required />
              </label>
              <button className="button primary" disabled={pending}>
                Post update
              </button>
            </form>
          )}
          {modal === 'cancel' && event && (
            <>
              <p>Everyone who joined or saved {event.title} will receive a cancellation update.</p>
              <button
                className="button danger"
                disabled={pending}
                onClick={() =>
                  doAction(
                    'cancel',
                    { id: event.id },
                    'Activity cancelled. Everyone with this plan has been notified.',
                    true,
                  )
                }
              >
                Confirm cancellation
              </button>
            </>
          )}
          {modal === 'club' && clubView && (
            <ClubProfile
              club={viewedClub}
              name={clubView.name}
              events={events.filter((e) =>
                clubView.id ? e.organizer_id === clubView.id : e.organizer === clubView.name,
              )}
              canEdit={Boolean(viewedClub && managedClubs.some((c) => c.id === viewedClub.id))}
              onShow={(e) => {
                setModal(null);
                showEvent(e);
              }}
              onFilter={() => {
                setOrgFilter([clubView.name]);
                setModal(null);
                setSelected(null);
                switchMode('Discover');
                setWindow('This week');
                setCategory('All plans');
                setSearch('');
                if (openedFromHub.current) {
                  openedFromHub.current = false;
                  globalThis.history.replaceState(null, '', live ? '/app' : '/preview');
                }
              }}
              onEdit={() => open('club-edit')}
            />
          )}
          {modal === 'club-request' && (
            <ClubRequestForm
              clubs={clubs.filter((c) => !managedClubs.some((m) => m.id === c.id))}
              done={() => {
                close();
                setToast('Request sent. A moderator will verify it and you’ll get a notification.');
                void refresh();
              }}
            />
          )}
          {modal === 'club-edit' && viewedClub && (
            <ClubEditForm
              club={viewedClub}
              done={() => {
                close();
                setToast('Club profile saved.');
                void refresh();
              }}
            />
          )}
          {modal === 'values' && (
            <div className="values-copy">
              <p className="detail-description">
                You don’t have to know the right people to belong.
              </p>
              <h3>Leave the invitation open.</h3>
              <p>
                Welcome first-timers. Be clear about cost, access, and expectations. Joining is
                first come, first served.
              </p>
              <h3>Be a good part of someone’s day.</h3>
              <p>
                Respect boundaries and identities. Harassment, discrimination, threats, illegal
                activities, and misleading promotions aren’t welcome.
              </p>
              <h3>Look out for each other.</h3>
              <p>
                Choose public meeting places. Report a concern from any event, or block a host to
                hide their activities. Moderators review reports and changes are logged.
              </p>
            </div>
          )}
          {modal === 'preview' && (
            <>
              <p className="detail-description">
                A working space to explore what Common could feel like.
              </p>
              <p>
                These events and people are fictional examples. Join, save, host, and try your
                schedule. Preview changes are stored only in this browser.
              </p>
              <p>
                The live pilot uses verified Babson email, shared attendance, waitlists, and
                moderator review. The project’s setup guide explains how to connect it.
              </p>
              <button
                className="button secondary"
                onClick={() => {
                  localStorage.removeItem('common-preview-v1');
                  globalThis.location.reload();
                }}
              >
                Reset sample preview
              </button>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
