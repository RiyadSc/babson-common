-- One-shot cleanup: remove auto-published campus events (and their drafts) so the next
-- ingest re-publishes them with the fixed category classifier, register_url, and flyer image.
-- Only touches events tied to auto_publish sources. Student-hosted events and manual campus
-- listings are untouched.

do $$
declare
  target_ids uuid[];
begin
  select coalesce(array_agg(id), '{}') into target_ids
  from public.events
  where kind = 'campus'
    and source_id in (select id from public.sources where auto_publish);

  if array_length(target_ids, 1) is null then
    return;
  end if;

  delete from public.notifications where event_id = any(target_ids);
  delete from public.analytics where event_id = any(target_ids);
  delete from public.event_status_history where event_id = any(target_ids);
  delete from public.audit_log where event_id = any(target_ids);
  delete from public.reports where event_id = any(target_ids);
  delete from public.announcements where event_id = any(target_ids);
  delete from public.attendance where event_id = any(target_ids);
  delete from public.saves where event_id = any(target_ids);
  delete from public.event_tags where event_id = any(target_ids);
  delete from public.occurrences where event_id = any(target_ids);

  -- Drop drafts that pointed at these events so the next ingest re-publishes cleanly.
  delete from public.import_drafts where published_event_id = any(target_ids);

  delete from public.events where id = any(target_ids);
end $$;
