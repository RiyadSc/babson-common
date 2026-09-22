-- Add the Professional category, per-event register links, and let auto-publish honor
-- classifier hints so imported items land in the right bucket instead of everything as Social.

alter table public.events drop constraint if exists events_category_check;
alter table public.events
  add constraint events_category_check
  check (category in ('Social','Food & drink','Sports & outdoors','Arts & culture','Learning','Wellness','Professional'));

alter table public.sources drop constraint if exists sources_default_category_check;
alter table public.sources
  add constraint sources_default_category_check
  check (default_category is null or default_category in ('Social','Food & drink','Sports & outdoors','Arts & culture','Learning','Wellness','Professional'));

alter table public.events add column if not exists register_url text
  check (register_url is null or (register_url ~* '^https://' and char_length(register_url) between 8 and 500));

drop view if exists public.event_feed;
create view public.event_feed with(security_invoker=true) as
  select
    e.id, e.title, e.description, e.category, e.host_id, e.organizer_id, e.venue_id,
    e.provenance_url, e.source_id, e.location, e.kind, e.cost, e.expectations,
    e.cancellation_policy, e.status, e.verified_at, e.created_at, e.version, e.register_url,
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
  img text;
  reg text;
  valid_categories constant text[] := array['Social','Food & drink','Sports & outdoors','Arts & culture','Learning','Wellness','Professional'];
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

  cat := coalesce(nullif(d.payload->>'category',''), s.default_category, 'Social');
  if not (cat = any(valid_categories)) then cat := coalesce(s.default_category, 'Social'); end if;
  cap := s.default_capacity;
  cost_val := s.default_cost;
  img := nullif(d.payload->>'image','');
  if img is not null and (img !~* '^https://' or char_length(img) > 500) then img := null; end if;
  reg := nullif(d.payload->>'register_url','');
  if reg is not null and (reg !~* '^https://' or char_length(reg) > 500) then reg := null; end if;

  if exists (
    select 1 from import_drafts
    where source_id = d.source_id and external_id = d.external_id
      and status = 'published' and published_event_id is not null
  ) then
    update import_drafts set status='review' where id=draft_id;
    return null;
  end if;

  insert into organizers(name) values(s.name) returning id into org;
  insert into events(title,description,category,organizer_id,source_id,provenance_url,location,kind,cost,expectations,cancellation_policy,verified_at,image,register_url)
    values(title, descr, cat, org, d.source_id, d.payload->>'source_url', loc, 'campus', cost_val,
      'Details are drawn from the source listing. Confirm accessibility and RSVP requirements on the source page.',
      'Check the source and in-app updates before traveling. If plans change, update your RSVP so someone else can join.',
      now(), img, reg)
    returning id into eid;
  insert into occurrences(event_id, starts_at, ends_at, capacity) values (eid, starts, ends, cap);
  update import_drafts set status='published', published_event_id=eid where id=draft_id;
  insert into audit_log(actor_id, event_id, action, details)
    values (null, eid, 'auto_publish', jsonb_build_object('draft_id', draft_id, 'source_id', d.source_id, 'category', cat));
  return eid;
end $$;
revoke execute on function public.auto_publish_draft(uuid) from public, anon, authenticated;
grant execute on function public.auto_publish_draft(uuid) to service_role;

-- One-shot reclassification of already-published events. Keeps hosts' student events untouched.
update public.events e
set category = case
  when e.title ~* '(career fair|internship|recruit|info session|networking|resume|linkedin|employer|corporate|industry|panel|case competition|trek|mba|consulting|banking|finance|investment|venture|entrepreneur|startup|interview|professional|business)' then 'Professional'
  when e.title ~* '(tournament|athletics|sports|hockey|basketball|soccer|tennis|swim|golf|pickleball|frisbee|run|hike|outdoor|fitness|cup|game|match)' then 'Sports & outdoors'
  when e.title ~* '(yoga|meditation|wellness|mental health|mindful|self-care|wellbeing|therapy)' then 'Wellness'
  when e.title ~* '(concert|music|art|film|movie|poetry|dance|gallery|theater|heritage|festival|exhibit|culture)' then 'Arts & culture'
  when e.title ~* '(coffee|dinner|lunch|brunch|tea|boba|food|ice cream|breakfast|tasting|cafe|bake|meal)' then 'Food & drink'
  when e.title ~* '(lecture|seminar|workshop|study|tutor|research|class|reading|book club|training)' then 'Learning'
  else e.category
end
where e.kind = 'campus'
  and e.category = 'Social';
