-- Moderators and verified club managers publish suggestions themselves.
-- Everyone else waits in a suggestion queue, separate from imported feeds.

create or replace function public.publish_suggestion_draft(rid uuid) returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  d import_drafts;
  eid uuid;
  org uuid;
  cat text;
  starts timestamptz;
  ends timestamptz;
  title text;
  descr text;
  loc text;
  reg text;
  valid_categories constant text[] := array['Social','Food & drink','Sports & outdoors','Arts & culture','Learning','Wellness','Professional'];
begin
  select * into d from import_drafts where id = rid for update;
  if not found or d.status <> 'review' or d.submitted_by is null then
    raise exception 'Suggestion not awaiting review';
  end if;
  title := left(trim(d.payload->>'title'), 100);
  descr := trim(d.payload->>'description');
  loc := left(trim(d.payload->>'location'), 200);
  if char_length(title) < 4 or char_length(descr) < 15 or char_length(loc) < 3 then
    raise exception 'Title, details, and location are required';
  end if;
  if char_length(descr) > 3000 then descr := substr(descr, 1, 3000); end if;
  starts := (d.payload->>'starts_at')::timestamptz;
  ends := nullif(d.payload->>'ends_at', '')::timestamptz;
  if starts is null or starts <= now() then raise exception 'Choose a future start'; end if;
  if ends is null then ends := starts + interval '2 hours'; end if;
  if ends <= starts then raise exception 'End must be after start'; end if;
  cat := coalesce(nullif(d.payload->>'category', ''), 'Social');
  if not (cat = any(valid_categories)) then cat := 'Social'; end if;
  reg := nullif(d.payload->>'source_url', '');
  if reg is not null and (reg !~* '^https://' or char_length(reg) > 500) then reg := null; end if;
  org := nullif(d.payload->>'organizer_id', '')::uuid;
  if org is not null and not exists (select 1 from organizers where id = org and kind = 'club') then
    raise exception 'Club not found';
  end if;
  if org is null then
    insert into organizers(name) values ('Community suggestion') returning id into org;
  end if;
  insert into events(
    title, description, category, host_id, organizer_id, provenance_url, location, kind, cost,
    expectations, cancellation_policy, verified_at, register_url
  ) values (
    title, descr, cat, d.submitted_by, org, reg, loc, 'campus', 0,
    'Details come from a community suggestion. Confirm the plan on the source page.',
    'Check the source before you go. Update your plans here if you can no longer attend.',
    now(), reg
  ) returning id into eid;
  insert into occurrences(event_id, starts_at, ends_at, capacity) values (eid, starts, ends, 200);
  update import_drafts set status = 'published', published_event_id = eid where id = rid;
  insert into audit_log(actor_id, event_id, action, details)
    values (d.submitted_by, eid, 'suggestion_publish', jsonb_build_object('draft_id', rid));
  return eid;
end $$;

create or replace function public.submit_suggestion(payload jsonb) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  uid uuid := require_student();
  trusted boolean;
  org uuid := nullif(payload->>'organizer_id', '')::uuid;
  rid uuid;
  eid uuid;
begin
  trusted := is_moderator() or exists (
    select 1 from organizers
    where owner_id = uid and kind = 'club' and verified_at is not null
  );
  if org is not null and not (is_moderator() or manages_organizer(org)) then
    raise exception 'You can only post as a club you manage';
  end if;
  if not trusted and org is not null then
    raise exception 'Choose a club only after it is verified';
  end if;
  insert into import_drafts(submitted_by, fingerprint, content_hash, payload, raw, confidence, status)
    values (
      uid,
      coalesce(nullif(payload->>'fingerprint', ''), md5(payload::text)),
      coalesce(nullif(payload->>'content_hash', ''), md5(payload::text)),
      payload,
      coalesce(payload->'raw', payload),
      least(1, greatest(0, coalesce((payload->>'confidence')::numeric, 0.5))),
      'review'
    )
    returning id into rid;
  if trusted then
    eid := publish_suggestion_draft(rid);
    return jsonb_build_object('published', true, 'event_id', eid);
  end if;
  return jsonb_build_object('published', false, 'draft_id', rid);
end $$;

revoke execute on function public.publish_suggestion_draft(uuid), public.submit_suggestion(jsonb)
  from public, anon, authenticated;
grant execute on function public.submit_suggestion(jsonb) to authenticated;
grant execute on function public.publish_suggestion_draft(uuid), public.submit_suggestion(jsonb) to service_role;

-- The reviewer's own waiting suggestion should not sit in the queue.
do $$
declare rid uuid;
begin
  for rid in
    select d.id from import_drafts d
    join profiles p on p.id = d.submitted_by
    where d.status = 'review' and d.source_id is null and p.role = 'moderator'
  loop
    perform publish_suggestion_draft(rid);
  end loop;
end $$;
