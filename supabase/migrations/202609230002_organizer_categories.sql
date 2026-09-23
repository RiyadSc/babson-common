-- Real hosts: university offices, Greek chapters, and student clubs.
-- Calendar source names stay off the organisation filter.

alter table public.organizers
  add column if not exists category text
  check (category is null or category in ('office', 'greek', 'club'));

create or replace function public.sync_belong_clubs(clubs jsonb, source_ids uuid[]) returns integer
  language plpgsql security definer set search_path = public as $$
declare
  r jsonb; org uuid; linked integer := 0; n integer;
  club_id integer; club_name text; club_category text;
begin
  for r in select * from jsonb_array_elements(clubs) loop
    if (r->>'club_id') !~ '^[0-9]{1,9}$' or char_length(trim(coalesce(r->>'name', ''))) < 2 then continue; end if;
    club_id := (r->>'club_id')::integer;
    club_name := left(trim(r->>'name'), 100);
    club_category := case r->>'category' when 'office' then 'office' when 'greek' then 'greek' else 'club' end;
    select id into org from organizers where belong_club_id = club_id;
    if org is null then
      select id into org from organizers
        where kind = 'club' and lower(name) = lower(club_name)
          and (belong_club_id is null or belong_club_id = club_id)
        order by verified_at desc nulls last, created_at
        limit 1;
    end if;
    if org is null then
      insert into organizers(name, kind, acronym, belong_club_id, category)
        values (club_name, 'club', nullif(left(r->>'acronym', 20), ''), club_id, club_category)
        returning id into org;
    else
      update organizers set
        belong_club_id = coalesce(belong_club_id, club_id),
        name = case when verified_at is null then club_name else name end,
        acronym = coalesce(acronym, nullif(left(r->>'acronym', 20), '')),
        category = club_category,
        kind = 'club'
      where id = org;
    end if;
    update events e set organizer_id = org
      from import_drafts d
      where d.published_event_id = e.id and d.source_id = any(source_ids)
        and d.external_id = r->>'uid' and e.organizer_id is distinct from org;
    get diagnostics n = row_count;
    linked := linked + n;
  end loop;
  delete from organizers o
    where o.kind = 'source' and not exists (select 1 from events e where e.organizer_id = o.id);
  return linked;
end $$;

drop view if exists public.event_feed;
create view public.event_feed with (security_invoker = true) as
  select
    e.id, e.title, e.description, e.category, e.host_id, e.organizer_id, e.venue_id,
    e.provenance_url, e.source_id, e.location, e.kind, e.cost, e.expectations,
    e.cancellation_policy, e.status, e.verified_at, e.created_at, e.version, e.register_url,
    o.starts_at, o.ends_at, o.capacity,
    coalesce(
      case when org.kind = 'club' then org.name end,
      case when e.kind = 'student' then p.name end,
      'Babson College'
    ) as organizer,
    (org.kind = 'club') as organizer_is_club,
    (org.verified_at is not null) as organizer_verified,
    org.logo_path as organizer_logo,
    org.category as organizer_category,
    coalesce(s.name, case when e.kind = 'student' then 'Student hosted' else 'Community curation' end) as source_name,
    coalesce(s.url, e.provenance_url) as source_url,
    coalesce(e.image, '/events/' || e.id || '/graphic.svg') as image,
    seats_left(e.id) as seats_left,
    going_count(e.id) as going_count
  from events e
  join occurrences o on o.event_id = e.id
  left join profiles p on p.id = e.host_id
  left join organizers org on org.id = e.organizer_id
  left join sources s on s.id = e.source_id;
grant select on public.event_feed to anon, authenticated;

create or replace function public.auto_publish_draft(draft_id uuid) returns uuid
  language plpgsql security definer set search_path = public as $$
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
  club_id integer;
  club_name text;
  club_category text;
  valid_categories constant text[] := array['Social','Food & drink','Sports & outdoors','Arts & culture','Learning','Wellness','Professional'];
begin
  select * into d from import_drafts where id = draft_id for update;
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
  loc := coalesce(nullif(d.payload->>'location', ''), s.url);
  if char_length(loc) < 3 then raise exception 'Location required'; end if;
  title := d.payload->>'title';
  if title is null or char_length(title) < 4 then raise exception 'Title too short'; end if;
  if char_length(title) > 100 then title := substr(title, 1, 100); end if;
  descr := coalesce(nullif(d.payload->>'description', ''), 'Details are on the source page. Please confirm before you head out.');
  if char_length(descr) < 15 then descr := descr || ' — see source for details.'; end if;
  if char_length(descr) > 3000 then descr := substr(descr, 1, 3000); end if;

  cat := coalesce(nullif(d.payload->>'category', ''), s.default_category, 'Social');
  if not (cat = any(valid_categories)) then cat := coalesce(s.default_category, 'Social'); end if;
  cap := s.default_capacity;
  cost_val := s.default_cost;
  img := nullif(d.payload->>'image', '');
  if img is not null and (img !~* '^https://' or char_length(img) > 500) then img := null; end if;
  reg := nullif(d.payload->>'register_url', '');
  if reg is not null and (reg !~* '^https://' or char_length(reg) > 500) then reg := null; end if;

  if exists (
    select 1 from import_drafts
    where source_id = d.source_id and external_id = d.external_id
      and status = 'published' and published_event_id is not null
  ) then
    update import_drafts set status = 'review' where id = draft_id;
    return null;
  end if;

  if coalesce(d.payload->>'club_id', '') ~ '^[0-9]{1,9}$'
     and char_length(trim(coalesce(d.payload->>'organizer', ''))) >= 2 then
    club_id := (d.payload->>'club_id')::integer;
    club_name := left(trim(d.payload->>'organizer'), 100);
    club_category := case d.payload->>'organizer_category'
      when 'office' then 'office' when 'greek' then 'greek' else 'club' end;
    select id into org from organizers where belong_club_id = club_id;
    if org is null then
      insert into organizers(name, kind, acronym, belong_club_id, category)
        values (
          club_name, 'club', nullif(left(coalesce(d.payload->>'acronym', ''), 20), ''),
          club_id, club_category
        )
        returning id into org;
    end if;
  else
    insert into organizers(name) values (s.name) returning id into org;
  end if;

  insert into events(
    title, description, category, organizer_id, source_id, provenance_url, location, kind, cost,
    expectations, cancellation_policy, verified_at, image, register_url
  ) values (
    title, descr, cat, org, d.source_id, d.payload->>'source_url', loc, 'campus', cost_val,
    'Details are drawn from the source listing. Confirm accessibility and RSVP requirements on the source page.',
    'Check the source and in-app updates before traveling. If plans change, update your RSVP so someone else can join.',
    now(), img, reg
  ) returning id into eid;
  insert into occurrences(event_id, starts_at, ends_at, capacity) values (eid, starts, ends, cap);
  update import_drafts set status = 'published', published_event_id = eid where id = draft_id;
  insert into audit_log(actor_id, event_id, action, details)
    values (null, eid, 'auto_publish', jsonb_build_object('draft_id', draft_id, 'source_id', d.source_id, 'category', cat));
  return eid;
end $$;
