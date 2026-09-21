-- Preserve block semantics for memberships that existed before the block.
create function public.remove_attendance(eid uuid,uid uuid) returns void language plpgsql security definer set search_path=public as $$declare e events;old_status text;promoted uuid;begin
 select * into e from events where id=eid for update;if not found then raise exception 'Unknown activity';end if;if e.host_id=uid then raise exception 'Hosts must cancel their activity';end if;
 delete from attendance where event_id=eid and user_id=uid returning status into old_status;if old_status is null then return;end if;
 insert into analytics(user_id,event_id,action) values(uid,eid,'leave');
 if old_status='joined' and e.status='published' and exists(select 1 from occurrences where event_id=eid and starts_at>now()) then
 select a.user_id into promoted from attendance a join auth.users u on u.id=a.user_id where a.event_id=eid and a.status='waitlisted' and u.email_confirmed_at is not null and u.email ~* '^[^\s@]+@babson\.edu$' and not exists(select 1 from blocks b where (b.user_id=a.user_id and b.blocked_id=e.host_id) or (b.blocked_id=a.user_id and b.user_id=e.host_id)) order by a.queued_at,a.user_id limit 1;
 if promoted is not null then update attendance set status='joined' where event_id=eid and user_id=promoted;insert into notifications(user_id,event_id,kind,message,dedupe_key) values(promoted,eid,'promotion','A spot opened up! You are now joining '||e.title,'promotion:'||eid||':'||promoted||':'||clock_timestamp());end if;end if;end$$;

create or replace function public.leave_activity(eid uuid) returns void language plpgsql security definer set search_path=public as $$begin perform remove_attendance(eid,require_student());end$$;
create or replace function public.block_student(target uuid) returns void language plpgsql security definer set search_path=public as $$declare uid uuid:=require_student();membership record;begin
 insert into blocks(user_id,blocked_id) values(uid,target) on conflict do nothing;
 for membership in select a.event_id,a.user_id from attendance a join events e on e.id=a.event_id where (a.user_id=uid and e.host_id=target) or (a.user_id=target and e.host_id=uid) order by a.event_id loop perform remove_attendance(membership.event_id,membership.user_id);end loop;
 insert into audit_log(actor_id,action,details) values(uid,'block',jsonb_build_object('target',target));
end$$;
create or replace function public.notify_change(eid uuid,kind text,body text,key text) returns void language sql security definer set search_path=public as $$
 insert into notifications(user_id,event_id,kind,message,dedupe_key)
 select recipients.user_id,$1,$2,$3,$4||':'||recipients.user_id from
 (select user_id from attendance where event_id=eid union select user_id from saves where event_id=eid) recipients
 join events e on e.id=eid
 where not exists(select 1 from blocks b where (b.user_id=recipients.user_id and b.blocked_id=e.host_id) or (b.blocked_id=recipients.user_id and b.user_id=e.host_id))
 on conflict(dedupe_key) do nothing
$$;
alter table profiles add constraint profile_interest_limit check(cardinality(interests)<=6 and interests <@ array['Social','Food & drink','Sports & outdoors','Arts & culture','Learning','Wellness']::text[]);
create function public.limit_submissions() returns trigger language plpgsql security definer set search_path=public as $$begin
 if auth.uid() is not null then
 perform 1 from profiles where id=auth.uid() for update;
 if (select count(*) from import_drafts where submitted_by=auth.uid() and created_at>now()-interval '1 day')>=20 then raise exception 'Daily suggestion limit reached';end if;
 end if;return new;
end$$;
create trigger draft_rate_limit before insert on import_drafts for each row execute function limit_submissions();
revoke execute on function remove_attendance(uuid,uuid),limit_submissions() from public,anon,authenticated;
grant execute on function remove_attendance(uuid,uuid),limit_submissions() to service_role;
