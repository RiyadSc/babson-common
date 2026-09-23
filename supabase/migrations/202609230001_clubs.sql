-- Clubs and organisations: verified club accounts, Belong club linking, and "Going" on
-- imported campus events so organisers can see who plans to attend.

alter table public.organizers
  add column if not exists kind text not null default 'source' check (kind in ('source','club')),
  add column if not exists acronym text check (acronym is null or char_length(acronym) <= 20),
  add column if not exists bio text check (bio is null or char_length(bio) <= 600),
  add column if not exists logo_path text
    check (logo_path is null or logo_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'),
  add column if not exists instagram text
    check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  add column if not exists website text
    check (website is null or (website ~* '^https://' and char_length(website) <= 300)),
  add column if not exists belong_club_id integer unique,
  add column if not exists verified_at timestamptz,
  add column if not exists created_at timestamptz not null default now();
alter table public.organizers
  add constraint organizers_club_name check (kind = 'source' or char_length(name) between 2 and 100);
create index if not exists organizers_club_name_idx on public.organizers (lower(name)) where kind = 'club';

create table public.club_requests(
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid references public.organizers(id),
  club_name text not null check (char_length(club_name) between 2 and 100),
  role_title text not null check (char_length(role_title) between 2 and 80),
  note text check (note is null or char_length(note) <= 500),
  logo_path text check (logo_path is null or logo_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'),
  requester_id uuid not null references public.profiles(id),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  decision_note text check (decision_note is null or char_length(decision_note) <= 500),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index club_requests_one_pending
  on public.club_requests (requester_id, lower(club_name)) where status = 'pending';
alter table public.club_requests enable row level security;
create policy club_requests_read on public.club_requests
  for select using (is_verified() and (requester_id = auth.uid() or is_moderator()));
grant select on public.club_requests to authenticated;
grant all on public.club_requests to service_role;

-- Logos are public images, uploaded into the uploader's own folder.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
  values ('club-logos', 'club-logos', true, 1048576, array['image/webp'])
  on conflict (id) do nothing;
create policy club_logos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'club-logos' and public.is_verified()
              and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.manages_organizer(org uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select is_verified() and exists (
    select 1 from organizers where id = org and owner_id = auth.uid() and verified_at is not null
  )
$$;

create or replace function public.going_count(eid uuid) returns integer
  language sql stable security definer set search_path = public as $$
  select case when can_view_event(eid)
    then (select count(*)::integer from attendance a where a.event_id = eid and a.status = 'joined')
    else null end
$$;

drop view if exists public.event_feed;
create view public.event_feed with (security_invoker = true) as
  select
    e.id, e.title, e.description, e.category, e.host_id, e.organizer_id, e.venue_id,
    e.provenance_url, e.source_id, e.location, e.kind, e.cost, e.expectations,
    e.cancellation_policy, e.status, e.verified_at, e.created_at, e.version, e.register_url,
    o.starts_at, o.ends_at, o.capacity,
    coalesce(org.name, p.name, 'Campus organizer') as organizer,
    (org.kind = 'club') as organizer_is_club,
    (org.verified_at is not null) as organizer_verified,
    org.logo_path as organizer_logo,
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

create or replace function public.create_activity(input jsonb) returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  uid uuid := require_student();
  eid uuid;
  org uuid := nullif(input->>'organizer_id', '')::uuid;
begin
  if (select count(*) from events where host_id = uid and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Daily hosting limit reached';
  end if;
  if (input->>'starts_at')::timestamptz <= now() then raise exception 'Choose a future start'; end if;
  if org is not null and not manages_organizer(org) then
    raise exception 'You can only post as a club you manage';
  end if;
  insert into events(title, description, category, host_id, organizer_id, location, kind, cost, expectations, cancellation_policy)
    values (input->>'title', input->>'description', input->>'category', uid, org, input->>'location', 'student',
            (input->>'cost')::numeric, input->>'expectations', input->>'cancellation_policy')
    returning id into eid;
  insert into occurrences(event_id, starts_at, ends_at, capacity)
    values (eid, (input->>'starts_at')::timestamptz, (input->>'ends_at')::timestamptz, (input->>'capacity')::integer);
  insert into attendance(event_id, user_id, status) values (eid, uid, 'joined');
  insert into analytics(user_id, event_id, action) values (uid, eid, 'create');
  return eid;
end $$;

-- Campus events are RSVP'd on their own site; "Going" here is a signal, not a seat.
create or replace function public.join_activity(eid uuid) returns text
  language plpgsql security definer set search_path = public as $$
declare uid uuid := require_student(); e events; o occurrences; result text;
begin
  select * into e from events where id = eid for update;
  if not found or not can_view_event(eid) or e.status <> 'published' then raise exception 'Activity unavailable'; end if;
  select * into o from occurrences where event_id = eid;
  if o.starts_at <= now() then raise exception 'Activity has already started'; end if;
  select status into result from attendance where event_id = eid and user_id = uid;
  if found then return result; end if;
  if e.kind = 'campus' or (select count(*) from attendance where event_id = eid and status = 'joined') < o.capacity then
    result := 'joined';
  else
    result := 'waitlisted';
  end if;
  insert into attendance(event_id, user_id, status) values (eid, uid, result);
  insert into analytics(user_id, event_id, action) values (uid, eid, 'join');
  return result;
end $$;

create or replace function public.post_announcement(eid uuid, body text) returns void
  language plpgsql security definer set search_path = public as $$
declare uid uuid := require_student(); aid uuid;
begin
  if not exists (
    select 1 from events e
    where e.id = eid and e.status = 'published'
      and (e.host_id = uid or (e.organizer_id is not null and manages_organizer(e.organizer_id)))
  ) then
    raise exception 'Only the host or organiser can post updates';
  end if;
  insert into announcements(event_id, author_id, body) values (eid, uid, body) returning id into aid;
  perform notify_change(eid, 'announcement', body, 'announcement:' || aid);
  insert into audit_log(actor_id, event_id, action) values (uid, eid, 'announcement');
end $$;

create or replace function public.event_attendees(eid uuid)
  returns table(name text, status text, joined_at timestamptz)
  language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (
    select 1 from events e
    where e.id = eid
      and (is_moderator() or (is_verified() and e.host_id = auth.uid())
           or (e.organizer_id is not null and manages_organizer(e.organizer_id)))
  ) then
    raise exception 'Only the host or organiser can see attendees';
  end if;
  return query
    select p.name, a.status, a.queued_at
    from attendance a join profiles p on p.id = a.user_id
    where a.event_id = eid
    order by a.status, a.queued_at;
end $$;

create or replace function public.request_club(
  p_organizer uuid, p_name text, p_role text, p_note text, p_logo text
) returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := require_student(); club_name text := trim(p_name); rid uuid;
begin
  if (select count(*) from club_requests where requester_id = uid and status = 'pending') >= 3 then
    raise exception 'You already have pending club requests';
  end if;
  if p_organizer is not null then
    select name into club_name from organizers where id = p_organizer and kind = 'club';
    if not found then raise exception 'Club not found'; end if;
    if manages_organizer(p_organizer) then raise exception 'You already manage this club'; end if;
    if exists (
      select 1 from organizers
      where id = p_organizer and verified_at is not null and owner_id is not null and owner_id <> uid
    ) then
      raise exception 'This club already has a verified manager';
    end if;
  end if;
  if p_logo is not null and split_part(p_logo, '/', 1) <> uid::text then
    raise exception 'Invalid logo';
  end if;
  insert into club_requests(organizer_id, club_name, role_title, note, logo_path, requester_id)
    values (p_organizer, club_name, trim(p_role), nullif(trim(coalesce(p_note, '')), ''), p_logo, uid)
    returning id into rid;
  insert into audit_log(actor_id, action, details)
    values (uid, 'club_request', jsonb_build_object('request_id', rid, 'club', club_name));
  return rid;
end $$;

create or replace function public.pending_club_requests()
  returns table(id uuid, organizer_id uuid, club_name text, role_title text, note text,
                logo_path text, requester_name text, requester_email text, created_at timestamptz,
                current_owner text)
  language plpgsql stable security definer set search_path = public as $$
begin
  if not is_moderator() then raise exception 'Moderator required'; end if;
  return query
    select r.id, r.organizer_id, r.club_name, r.role_title, r.note, r.logo_path,
           p.name, u.email::text, r.created_at, owner.name
    from club_requests r
    join profiles p on p.id = r.requester_id
    join auth.users u on u.id = r.requester_id
    left join organizers o on o.id = r.organizer_id
    left join profiles owner on owner.id = o.owner_id and o.verified_at is not null
    where r.status = 'pending'
    order by r.created_at;
end $$;

create or replace function public.review_club_request(rid uuid, decision text, p_note text default null)
  returns uuid language plpgsql security definer set search_path = public as $$
declare r club_requests; org uuid;
begin
  if not is_moderator() then raise exception 'Moderator required'; end if;
  select * into r from club_requests where id = rid for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status <> 'pending' then return r.organizer_id; end if;
  if decision = 'approve' then
    perform pg_advisory_xact_lock(hashtext(lower(r.club_name)));
    org := r.organizer_id;
    if org is null then
      select id into org from organizers where kind = 'club' and lower(name) = lower(r.club_name) limit 1;
    end if;
    if org is not null and exists (
      select 1 from organizers
      where id = org and verified_at is not null and owner_id is not null and owner_id <> r.requester_id
    ) then
      raise exception 'This club already has a verified manager. Remove them before approving someone new.';
    end if;
    if org is null then
      insert into organizers(name, kind) values (r.club_name, 'club') returning id into org;
    end if;
    update organizers
      set owner_id = r.requester_id, verified_at = coalesce(verified_at, now()),
          logo_path = coalesce(r.logo_path, logo_path), kind = 'club'
      where id = org;
    update club_requests
      set status = 'approved', organizer_id = org, reviewed_by = auth.uid(), reviewed_at = now(),
          decision_note = p_note
      where id = rid;
    insert into notifications(user_id, kind, message, dedupe_key)
      values (r.requester_id, 'club',
              'You''re now the verified manager of ' || r.club_name || '. You can post as the club and see who''s going.',
              'club:' || rid);
  elsif decision = 'reject' then
    update club_requests
      set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), decision_note = p_note
      where id = rid;
    insert into notifications(user_id, kind, message, dedupe_key)
      values (r.requester_id, 'club',
              'Your request to manage ' || r.club_name || ' wasn''t approved.' ||
              coalesce(' ' || p_note, ''),
              'club:' || rid);
  else
    raise exception 'Unknown decision';
  end if;
  insert into audit_log(actor_id, action, details)
    values (auth.uid(), 'review_club_request',
            jsonb_build_object('request_id', rid, 'decision', decision, 'organizer_id', org));
  return org;
end $$;

create or replace function public.revoke_club(org uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_moderator() then raise exception 'Moderator required'; end if;
  update organizers set owner_id = null, verified_at = null where id = org and kind = 'club';
  insert into audit_log(actor_id, action, details)
    values (auth.uid(), 'revoke_club', jsonb_build_object('organizer_id', org));
end $$;

create or replace function public.update_club(
  org uuid, p_bio text, p_instagram text, p_website text, p_logo text
) returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := require_student();
begin
  if not (manages_organizer(org) or is_moderator()) then
    raise exception 'Only the club manager can edit this profile';
  end if;
  if p_logo is not null and split_part(p_logo, '/', 1) <> uid::text then
    raise exception 'Invalid logo';
  end if;
  update organizers set
    bio = nullif(trim(coalesce(p_bio, '')), ''),
    instagram = nullif(ltrim(trim(coalesce(p_instagram, '')), '@'), ''),
    website = nullif(trim(coalesce(p_website, '')), ''),
    logo_path = coalesce(p_logo, logo_path)
  where id = org;
  insert into audit_log(actor_id, action, details)
    values (uid, 'update_club', jsonb_build_object('organizer_id', org));
end $$;

-- Links imported Belong events to their club using Belong's stable club id.
create or replace function public.sync_belong_clubs(clubs jsonb, source_ids uuid[]) returns integer
  language plpgsql security definer set search_path = public as $$
declare r jsonb; org uuid; linked integer := 0; n integer; club_id integer; club_name text;
begin
  for r in select * from jsonb_array_elements(clubs) loop
    if (r->>'club_id') !~ '^[0-9]{1,9}$' or char_length(trim(coalesce(r->>'name', ''))) < 2 then continue; end if;
    club_id := (r->>'club_id')::integer;
    club_name := left(trim(r->>'name'), 100);
    select id into org from organizers where belong_club_id = club_id;
    if org is null then
      select id into org from organizers
        where kind = 'club' and lower(name) = lower(club_name)
          and (belong_club_id is null or belong_club_id = club_id)
        order by verified_at desc nulls last, created_at
        limit 1;
    end if;
    if org is null then
      insert into organizers(name, kind, acronym, belong_club_id)
        values (club_name, 'club', nullif(left(r->>'acronym', 20), ''), club_id)
        returning id into org;
    else
      update organizers set
        belong_club_id = coalesce(belong_club_id, club_id),
        name = case when verified_at is null then club_name else name end,
        acronym = coalesce(acronym, nullif(left(r->>'acronym', 20), ''))
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

revoke execute on function
  public.manages_organizer(uuid), public.going_count(uuid), public.create_activity(jsonb),
  public.join_activity(uuid), public.post_announcement(uuid, text), public.event_attendees(uuid),
  public.request_club(uuid, text, text, text, text), public.pending_club_requests(),
  public.review_club_request(uuid, text, text), public.revoke_club(uuid),
  public.update_club(uuid, text, text, text, text), public.sync_belong_clubs(jsonb, uuid[])
  from public, anon, authenticated;
grant execute on function public.manages_organizer(uuid), public.going_count(uuid) to anon, authenticated;
grant execute on function
  public.create_activity(jsonb), public.join_activity(uuid), public.post_announcement(uuid, text),
  public.event_attendees(uuid), public.request_club(uuid, text, text, text, text),
  public.pending_club_requests(), public.review_club_request(uuid, text, text),
  public.revoke_club(uuid), public.update_club(uuid, text, text, text, text)
  to authenticated;
grant execute on function
  public.manages_organizer(uuid), public.going_count(uuid), public.create_activity(jsonb),
  public.join_activity(uuid), public.post_announcement(uuid, text), public.event_attendees(uuid),
  public.request_club(uuid, text, text, text, text), public.pending_club_requests(),
  public.review_club_request(uuid, text, text), public.revoke_club(uuid),
  public.update_club(uuid, text, text, text, text), public.sync_belong_clubs(jsonb, uuid[])
  to service_role;
