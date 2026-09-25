-- Keep scheduled import retries from publishing the same event again.
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
  -- Serialize publishers, including different drafts for the same source event.
  perform pg_advisory_xact_lock(hashtextextended('public.auto_publish_draft', 0));
  select * into d from import_drafts where id = draft_id for update;
  if not found or d.status <> 'review' then return d.published_event_id; end if;
  if d.published_event_id is not null then
    update import_drafts set status = 'published' where id = draft_id;
    return d.published_event_id;
  end if;
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
      and published_event_id is not null
  ) then
    update import_drafts set status = 'review' where id = draft_id;
    return null;
  end if;

  -- Match across sources inside the same transaction as publication.
  select published_event_id into eid from import_drafts
    where fingerprint = d.fingerprint and published_event_id is not null
    order by created_at, id limit 1;
  if eid is not null then
    update import_drafts set status = 'duplicate', duplicate_of = eid where id = draft_id;
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

-- The old importer overwrote published_event_id on each replay. Only retire
-- abandoned copies whose audit trail proves they came from that same draft.
-- Keep the currently linked event and every copy with user activity intact.
with retired as (
  update public.events e set status = 'hidden', version = e.version + 1
  where e.status = 'published'
    and exists (
      select 1 from public.audit_log a
      join public.import_drafts d on d.id::text = a.details->>'draft_id'
      join public.events canonical on canonical.id = d.published_event_id
      join public.occurrences original_time on original_time.event_id = e.id
      join public.occurrences canonical_time on canonical_time.event_id = canonical.id
      where a.action = 'auto_publish' and a.event_id = e.id
        and canonical.id <> e.id and canonical.status = 'published'
        and canonical.source_id = e.source_id
        and canonical.title = e.title and canonical.location = e.location
        and canonical_time.starts_at = original_time.starts_at
        and canonical_time.ends_at = original_time.ends_at
    )
    and not exists (select 1 from public.attendance where event_id = e.id)
    and not exists (select 1 from public.saves where event_id = e.id)
    and not exists (select 1 from public.reports where event_id = e.id)
    and not exists (select 1 from public.announcements where event_id = e.id)
    and not exists (select 1 from public.notifications where event_id = e.id)
    and not exists (select 1 from public.analytics where event_id = e.id)
  returning e.id
)
insert into public.audit_log(event_id, action, details)
select id, 'hide_import_duplicate', '{"reason":"Repeated publication of the same import draft"}'::jsonb
from retired;
