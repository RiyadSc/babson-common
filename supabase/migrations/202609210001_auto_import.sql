-- Auto import from Babson-owned and pre-approved campus sources.
-- Drafts land in review by default. Sources marked auto_publish yield a system-published
-- event ONLY when confidence >= 0.9, external_id is present, and the start time is future.
-- Every auto-publish writes to audit_log with action='auto_publish' so a moderator can
-- reverse the decision using the existing moderate_event RPC.

alter table public.sources
  add column if not exists auto_publish boolean not null default false,
  add column if not exists default_category text
    check (default_category in ('Social','Food & drink','Sports & outdoors','Arts & culture','Learning','Wellness')),
  add column if not exists default_capacity integer not null default 60
    check (default_capacity between 2 and 500),
  add column if not exists default_cost numeric not null default 0
    check (default_cost between 0 and 1000);

-- Allow HTML JSON-LD source kind alongside existing feeds.
alter table public.sources drop constraint if exists sources_kind_check;
alter table public.sources
  add constraint sources_kind_check
  check (kind in ('ics','rss','web','html','email','submission'));

-- Optional per-event graphic. Nullable so the feed can fall back to a generated poster.
alter table public.events add column if not exists image text
  check (image is null or char_length(image) between 1 and 500);

-- Refresh event_feed to surface a stable image reference.
drop view if exists public.event_feed;
create view public.event_feed with(security_invoker=true) as
  select
    e.id, e.title, e.description, e.category, e.host_id, e.organizer_id, e.venue_id,
    e.provenance_url, e.source_id, e.location, e.kind, e.cost, e.expectations,
    e.cancellation_policy, e.status, e.verified_at, e.created_at, e.version,
    o.starts_at, o.ends_at, o.capacity,
    coalesce(org.name, p.name, 'Campus organizer') as organizer,
    coalesce(s.name, case when e.kind='student' then 'Student hosted' else 'Community curation' end) as source_name,
    coalesce(s.url, e.provenance_url) as source_url,
    coalesce(e.image, '/events/' || e.id || '/graphic.svg') as image,
    seats_left(e.id) as seats_left
  from events e
  join occurrences o on o.event_id = e.id
  left join profiles p on p.id = e.host_id
  left join organizers org on org.id = e.organizer_id
  left join sources s on s.id = e.source_id;
grant select on public.event_feed to anon, authenticated;

-- System auto-publish path. service_role only. Rules mirror review_draft(publish) but
-- do not require a moderator session and never revise an existing event.
create or replace function public.auto_publish_draft(draft_id uuid) returns uuid
  language plpgsql security definer set search_path=public as $$
declare
  d import_drafts;
  s sources;
  eid uuid;
  org uuid;
  cat text;
  cap integer;
  cost_val numeric;
  starts timestamptz;
  ends timestamptz;
  loc text;
  title text;
  descr text;
begin
  select * into d from import_drafts where id=draft_id for update;
  if not found or d.status <> 'review' then return d.published_event_id; end if;
  select * into s from sources where id = d.source_id;
  if not found or not s.auto_publish then raise exception 'Source not auto-publish'; end if;
  if d.external_id is null then raise exception 'External id required'; end if;
  if d.confidence < 0.9 then raise exception 'Confidence too low'; end if;

  starts := (d.payload->>'starts_at')::timestamptz;
  ends := (d.payload->>'ends_at')::timestamptz;
  if starts is null or ends is null or starts <= now() or ends <= starts then
    raise exception 'Invalid schedule';
  end if;
  loc := coalesce(nullif(d.payload->>'location',''), s.url);
  if char_length(loc) < 3 then raise exception 'Location required'; end if;
  title := d.payload->>'title';
  if title is null or char_length(title) < 4 then raise exception 'Title too short'; end if;
  if char_length(title) > 100 then title := substr(title, 1, 100); end if;
  descr := coalesce(nullif(d.payload->>'description',''), 'Details are on the source page. Please confirm before you head out.');
  if char_length(descr) < 15 then descr := descr || ' — see source for details.'; end if;
  if char_length(descr) > 3000 then descr := substr(descr, 1, 3000); end if;
  cat := coalesce(s.default_category, 'Social');
  cap := s.default_capacity;
  cost_val := s.default_cost;

  -- Do not auto-revise an existing event; revisions still route through moderator review.
  if exists (
    select 1 from import_drafts
    where source_id = d.source_id and external_id = d.external_id
      and status = 'published' and published_event_id is not null
  ) then
    update import_drafts set status='review' where id=draft_id;
    return null;
  end if;

  insert into organizers(name) values(s.name) returning id into org;
  insert into events(title,description,category,organizer_id,source_id,provenance_url,location,kind,cost,expectations,cancellation_policy,verified_at)
    values(title, descr, cat, org, d.source_id, d.payload->>'source_url', loc, 'campus', cost_val,
      'Details are drawn from the source listing. Confirm accessibility and RSVP requirements on the source page.',
      'Check the source and in-app updates before traveling. If plans change, update your RSVP so someone else can join.',
      now())
    returning id into eid;
  insert into occurrences(event_id, starts_at, ends_at, capacity) values (eid, starts, ends, cap);
  update import_drafts set status='published', published_event_id=eid where id=draft_id;
  insert into audit_log(actor_id, event_id, action, details)
    values (null, eid, 'auto_publish', jsonb_build_object('draft_id', draft_id, 'source_id', d.source_id));
  return eid;
end $$;
revoke execute on function public.auto_publish_draft(uuid) from public, anon, authenticated;
grant execute on function public.auto_publish_draft(uuid) to service_role;

-- Moderator source management. Adds and toggles sources without a raw DB session.
create or replace function public.upsert_source(
  source_id uuid, source_name text, source_url text, source_kind text,
  enable boolean, auto boolean, category text, capacity integer
) returns uuid language plpgsql security definer set search_path=public as $$
declare host text; new_id uuid; begin
  if not is_moderator() then raise exception 'Moderator required'; end if;
  if source_url !~* '^https://' then raise exception 'HTTPS required'; end if;
  host := lower(split_part(split_part(source_url, '://', 2), '/', 1));
  if host !~ '(^|\.)babson\.edu$' and host <> 'campusgroups.com' and host !~ '\.campusgroups\.com$' then
    raise exception 'Host not on the campus allowlist';
  end if;
  if source_kind not in ('ics','rss','web','html','email','submission') then
    raise exception 'Unsupported source kind';
  end if;
  if capacity is not null and (capacity < 2 or capacity > 500) then
    raise exception 'Capacity out of range';
  end if;
  if source_id is null then
    insert into sources(name, url, kind, enabled, auto_publish, default_category, default_capacity)
      values (source_name, source_url, source_kind, enable, auto,
              nullif(category, ''), coalesce(capacity, 60))
      returning id into new_id;
  else
    update sources set
      name = source_name, url = source_url, kind = source_kind,
      enabled = enable, auto_publish = auto,
      default_category = nullif(category, ''),
      default_capacity = coalesce(capacity, default_capacity)
    where id = source_id
    returning id into new_id;
    if new_id is null then raise exception 'Source not found'; end if;
  end if;
  insert into audit_log(actor_id, action, details)
    values (auth.uid(), 'upsert_source',
      jsonb_build_object('source_id', new_id, 'url', source_url, 'kind', source_kind,
                         'enabled', enable, 'auto_publish', auto));
  return new_id;
end $$;
revoke execute on function public.upsert_source(uuid,text,text,text,boolean,boolean,text,integer)
  from public, anon, authenticated;
grant execute on function public.upsert_source(uuid,text,text,text,boolean,boolean,text,integer)
  to authenticated, service_role;
