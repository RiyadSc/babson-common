-- Moderator control plane. Destructive work stays behind security-definer RPCs so
-- the browser never receives broad table-write privileges.

create or replace function public.delete_event(eid uuid, note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare doomed public.events;
begin
  if not public.is_moderator() then raise exception 'Moderator required'; end if;
  if char_length(trim(coalesce(note, ''))) < 10 then
    raise exception 'Provide a deletion reason of at least 10 characters';
  end if;
  select * into doomed from public.events where id = eid for update;
  if not found then raise exception 'Event not found'; end if;

  insert into public.notifications(user_id, event_id, kind, message, dedupe_key)
  select recipient, null, 'moderation', doomed.title || ' was removed by the moderation team.',
    'deleted:' || eid || ':' || recipient
  from (
    select user_id as recipient from public.attendance where event_id = eid
    union select user_id from public.saves where event_id = eid
  ) affected on conflict (dedupe_key) do nothing;

  delete from public.deliveries where notification_id in
    (select id from public.notifications where event_id = eid);
  delete from public.notifications where event_id = eid;
  update public.import_drafts set published_event_id = null where published_event_id = eid;
  update public.import_drafts set duplicate_of = null where duplicate_of = eid;
  delete from public.analytics where event_id = eid;
  delete from public.event_status_history where event_id = eid;
  delete from public.audit_log where event_id = eid;
  delete from public.reports where event_id = eid;
  delete from public.announcements where event_id = eid;
  delete from public.attendance where event_id = eid;
  delete from public.saves where event_id = eid;
  delete from public.event_tags where event_id = eid;
  delete from public.occurrences where event_id = eid;
  delete from public.events where id = eid;

  insert into public.audit_log(actor_id, action, details)
  values (auth.uid(), 'delete_event', jsonb_build_object(
    'event_id', eid, 'title', doomed.title, 'organizer_id', doomed.organizer_id,
    'source_id', doomed.source_id, 'reason', trim(note)));
  return jsonb_build_object('id', eid, 'title', doomed.title, 'image', doomed.image);
end $$;

create or replace function public.set_source_enabled(source_id uuid, should_enable boolean, note text)
returns void language plpgsql security definer set search_path = public as $$
declare source_name text;
begin
  if not public.is_moderator() then raise exception 'Moderator required'; end if;
  if char_length(trim(coalesce(note, ''))) < 10 then
    raise exception 'Provide a reason of at least 10 characters';
  end if;
  update public.sources set enabled = should_enable,
    auto_publish = case when should_enable then auto_publish else false end
  where id = source_id returning name into source_name;
  if not found then raise exception 'Source not found'; end if;
  insert into public.audit_log(actor_id, action, details)
  values (auth.uid(), 'set_source_enabled', jsonb_build_object(
    'source_id', source_id, 'source_name', source_name,
    'enabled', should_enable, 'reason', trim(note)));
end $$;

revoke execute on function public.delete_event(uuid, text) from public, anon, authenticated;
revoke execute on function public.set_source_enabled(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.delete_event(uuid, text) to authenticated, service_role;
grant execute on function public.set_source_enabled(uuid, boolean, text) to authenticated, service_role;

create policy event_posters_moderator_delete on storage.objects for delete to authenticated
  using (bucket_id = 'event-posters' and public.is_moderator());
