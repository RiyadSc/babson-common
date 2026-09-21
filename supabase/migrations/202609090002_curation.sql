create function public.review_draft(draft_id uuid,decision text,input jsonb,duplicate_id uuid default null) returns uuid language plpgsql security definer set search_path=public as $$declare d import_drafts;eid uuid;org uuid;begin
 if not is_moderator() then raise exception 'Moderator required';end if;
 select * into d from import_drafts where id=draft_id for update;if not found then raise exception 'Draft not found';end if;if d.status<>'review' then return d.published_event_id;end if;
 if decision='publish' then
 if (input->>'starts_at')::timestamptz<=now() then raise exception 'Choose a future start';end if;
 -- Source edits with a stable external ID revise their original event after human review.
 if d.external_id is not null and d.source_id is not null then select published_event_id into eid from import_drafts where source_id=d.source_id and external_id=d.external_id and status='published' and published_event_id is not null order by created_at desc limit 1;end if;
 if eid is null then
 insert into organizers(name) values(coalesce((select name from sources where id=d.source_id),'Community curation')) returning id into org;
 insert into events(title,description,category,organizer_id,source_id,provenance_url,location,kind,cost,expectations,cancellation_policy) values(input->>'title',input->>'description',input->>'category',org,d.source_id,d.payload->>'source_url',input->>'location','campus',(input->>'cost')::numeric,input->>'expectations',input->>'cancellation_policy') returning id into eid;
 insert into occurrences(event_id,starts_at,ends_at,capacity) values(eid,(input->>'starts_at')::timestamptz,(input->>'ends_at')::timestamptz,(input->>'capacity')::integer);
 else
 perform 1 from events where id=eid for update;
 if (input->>'capacity')::integer<(select count(*) from attendance where event_id=eid and status='joined') then raise exception 'Capacity cannot fall below confirmed attendees';end if;
 update events set title=input->>'title',description=input->>'description',category=input->>'category',location=input->>'location',cost=(input->>'cost')::numeric,expectations=input->>'expectations',cancellation_policy=input->>'cancellation_policy',verified_at=now(),version=version+1 where id=eid;
 update occurrences set starts_at=(input->>'starts_at')::timestamptz,ends_at=(input->>'ends_at')::timestamptz,capacity=(input->>'capacity')::integer where event_id=eid;
 perform notify_change(eid,'change','Details have changed for '||(input->>'title')||'. Check your plans before heading out.','change:'||eid||':'||(select version from events where id=eid));
 end if;
 update import_drafts set status='published',published_event_id=eid where id=draft_id;
 elsif decision='reject' then update import_drafts set status='rejected' where id=draft_id;
 elsif decision='duplicate' then
 if not exists(select 1 from events where id=duplicate_id) then raise exception 'Existing event required';end if;
 update import_drafts set status='duplicate',duplicate_of=duplicate_id where id=draft_id;
 else raise exception 'Unknown review decision';end if;
 insert into audit_log(actor_id,event_id,action,details) values(auth.uid(),eid,'review_draft',jsonb_build_object('draft_id',draft_id,'decision',decision,'duplicate_of',duplicate_id));return eid;end$$;

create function public.pilot_metrics() returns jsonb language plpgsql stable security definer set search_path=public as $$declare result jsonb;begin if not is_moderator() then raise exception 'Moderator required';end if;
 select jsonb_build_object(
 'weekly_active_attendees',(select count(distinct user_id) from analytics where action='check_in' and created_at>now()-interval '7 days'),
 'weekly_active_creators',(select count(distinct user_id) from analytics where action='create' and created_at>now()-interval '7 days'),
 'events_this_week',(select count(*) from events e join occurrences o on o.event_id=e.id where e.status='published' and o.starts_at between now() and now()+interval '7 days'),
 'view_to_join_percent',(select coalesce(round(100.0*count(*) filter(where exists(select 1 from analytics j where j.user_id=v.user_id and j.event_id=v.event_id and j.action='join' and j.created_at>=v.first_view))/nullif(count(*),0),1),0) from (select user_id,event_id,min(created_at) as first_view from analytics where action='view' and created_at>now()-interval '7 days' group by user_id,event_id) v),
 'repeat_attendees',(select count(*) from (select user_id from analytics where action='check_in' and created_at>now()-interval '28 days' group by user_id having count(distinct event_id)>1) t),
 'repeat_creators',(select count(*) from (select user_id from analytics where action='create' and created_at>now()-interval '28 days' group by user_id having count(distinct event_id)>1) t),
 'cancellations',(select count(*) from analytics where action='cancel' and created_at>now()-interval '7 days'),
 'reported_no_shows',(select count(*) from analytics where action='no_show' and created_at>now()-interval '7 days'),
 'cross_category_attendees',(select count(*) from (select a.user_id from analytics a join events e on e.id=a.event_id where a.action='check_in' and a.created_at>now()-interval '28 days' group by a.user_id having count(distinct e.category)>1) t),
 'new_organizer_participation',(select count(*) from analytics a join events e on e.id=a.event_id where a.action='check_in' and a.created_at>now()-interval '7 days' and not exists(select 1 from analytics prior join events pe on pe.id=prior.event_id where prior.user_id=a.user_id and prior.action='check_in' and prior.created_at<a.created_at and coalesce(pe.organizer_id,pe.host_id)=coalesce(e.organizer_id,e.host_id))),
 'healthy_sources',(select count(*) from sources where enabled and last_success_at>now()-interval '48 hours' and last_error is null)
 ) into result;return result;end$$;
revoke execute on function review_draft(uuid,text,jsonb,uuid),pilot_metrics() from public,anon;
grant execute on function review_draft(uuid,text,jsonb,uuid),pilot_metrics() to authenticated,service_role;
