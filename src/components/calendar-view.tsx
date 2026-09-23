'use client';
import { useMemo, useState } from 'react';
import { DateTime } from 'luxon';
import { CalendarDays, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { CATEGORIES, CampusEvent, TIMEZONE } from '@/lib/domain';

type Props = {
  events: CampusEvent[];
  onShow: (event: CampusEvent) => void;
};

const CATEGORY_INDEX: Record<string, number> = {
  Social: 1,
  'Food & drink': 2,
  'Sports & outdoors': 3,
  'Arts & culture': 4,
  Learning: 5,
  Wellness: 6,
  Professional: 7,
};

function fmtMonth(dt: DateTime) {
  return dt.toFormat('LLLL yyyy');
}
function isoDay(dt: DateTime) {
  return dt.toFormat('yyyy-LL-dd');
}

export default function CalendarView({ events, onShow }: Props) {
  const today = useMemo(() => DateTime.now().setZone(TIMEZONE).startOf('day'), []);
  const [cursor, setCursor] = useState(() => today.startOf('month'));
  const [selected, setSelected] = useState<string>(isoDay(today));
  const [filter, setFilter] = useState<string>('All plans');

  const byDay = useMemo(() => {
    const map = new Map<string, CampusEvent[]>();
    for (const e of events) {
      if (filter !== 'All plans' && e.category !== filter) continue;
      const key = isoDay(DateTime.fromISO(e.starts_at).setZone(TIMEZONE));
      const list = map.get(key) || [];
      list.push(e);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    return map;
  }, [events, filter]);

  const monthStart = cursor.startOf('month');
  const monthEnd = cursor.endOf('month');
  const gridStart = monthStart.startOf('week').minus({ days: (monthStart.weekday % 7) === 0 ? 0 : 0 });
  // Luxon weekdays: 1=Mon..7=Sun. We want a Sun-start grid.
  const firstOffset = monthStart.weekday % 7; // Sun=0, Mon=1, ...
  const gridDays: DateTime[] = [];
  const start = monthStart.minus({ days: firstOffset });
  for (let i = 0; i < 42; i++) gridDays.push(start.plus({ days: i }));

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const selectedList = byDay.get(selected) || [];
  const selectedDt = DateTime.fromISO(selected, { zone: TIMEZONE });

  return (
    <section className="calendar-view" aria-label="Events calendar">
      <div className="calendar-header">
        <div>
          <div className="eyebrow">
            <CalendarDays size={13} /> CALENDAR
          </div>
          <h1>{fmtMonth(cursor)}</h1>
          <p>Every plan around Babson, month by month.</p>
        </div>
        <div className="calendar-controls">
          <button
            className="button secondary"
            onClick={() => setCursor(cursor.minus({ months: 1 }))}
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            className="button secondary"
            onClick={() => {
              setCursor(today.startOf('month'));
              setSelected(isoDay(today));
            }}
          >
            Today
          </button>
          <button
            className="button secondary"
            onClick={() => setCursor(cursor.plus({ months: 1 }))}
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="category-tabs" aria-label="Filter by category">
        {['All plans', ...CATEGORIES].map((c, i) => (
          <button
            key={c}
            aria-pressed={filter === c}
            className={filter === c ? 'active' : ''}
            onClick={() => setFilter(c)}
          >
            {i === 0 ? <Sparkles size={14} /> : <span className={`category-dot cat-${i}`} />} {c}
          </button>
        ))}
      </div>

      <div className="calendar-grid" role="grid">
        {weekdays.map((w) => (
          <div key={w} className="calendar-weekday" role="columnheader">
            {w}
          </div>
        ))}
        {gridDays.map((day) => {
          const key = isoDay(day);
          const inMonth = day.month === cursor.month;
          const list = byDay.get(key) || [];
          const isToday = key === isoDay(today);
          const isSelected = key === selected;
          return (
            <button
              key={key}
              type="button"
              role="gridcell"
              aria-selected={isSelected}
              onClick={() => setSelected(key)}
              className={[
                'calendar-day',
                inMonth ? '' : 'is-outside',
                isToday ? 'is-today' : '',
                isSelected ? 'is-selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="calendar-day-num">{day.day}</span>
              {list.length > 0 && (
                <span className="calendar-day-count">{list.length}</span>
              )}
              <span className="calendar-day-pills">
                {list.slice(0, 3).map((e) => (
                  <span
                    key={e.id}
                    className="calendar-pill"
                    title={e.title}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onShow(e);
                    }}
                  >
                    <span
                      className={`category-dot cat-${CATEGORY_INDEX[e.category] || 1}`}
                      aria-hidden="true"
                    />
                    <span className="calendar-pill-time">
                      {DateTime.fromISO(e.starts_at).setZone(TIMEZONE).toFormat('h:mma').toLowerCase()}
                    </span>
                    <span className="calendar-pill-title">{e.title}</span>
                  </span>
                ))}
                {list.length > 3 && <span className="calendar-more">+{list.length - 3} more</span>}
              </span>
            </button>
          );
        })}
      </div>

      <div className="calendar-agenda" aria-live="polite">
        <div className="section-heading">
          <div>
            <h2>{selectedDt.toFormat('cccc, LLLL d')}</h2>
            <p>
              {selectedList.length === 0
                ? 'No plans on this day — pick another.'
                : `${selectedList.length} plan${selectedList.length === 1 ? '' : 's'} that day.`}
            </p>
          </div>
        </div>
        <ul className="calendar-agenda-list">
          {selectedList.map((e) => (
            <li key={e.id}>
              <button className="calendar-agenda-item" onClick={() => onShow(e)}>
                <span className="calendar-agenda-time">
                  {DateTime.fromISO(e.starts_at).setZone(TIMEZONE).toFormat('h:mma').toLowerCase()}
                </span>
                <span className="calendar-agenda-body">
                  <span className="calendar-agenda-title">{e.title}</span>
                  <span className="calendar-agenda-meta">
                    <span className={`category-dot cat-${CATEGORY_INDEX[e.category] || 1}`} />
                    {e.category} · {e.location}
                  </span>
                </span>
                <span className="calendar-agenda-cost">
                  {e.cost === 0 ? 'Free' : `$${e.cost}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
