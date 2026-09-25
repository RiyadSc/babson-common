-- Current Babson social and professional fraternities, verified against the public
-- Babson Belong Fraternity & Sorority Life directory on 2026-09-23.
-- https://belong.babson.edu/club_signup?group_type=81067
-- https://www.babson.edu/undergraduate/student-life/activities/clubs-and-organizations/
do $$
declare
  r record;
  existing uuid;
begin
  for r in select * from (values
    ('31000000-0000-0000-0000-000000000001'::uuid, 'Alpha Kappa Psi', 'AKPsi', 'Professional business fraternity'),
    ('31000000-0000-0000-0000-000000000002'::uuid, 'Delta Sigma Pi Fraternity', 'DSP', 'Professional business fraternity'),
    ('31000000-0000-0000-0000-000000000003'::uuid, 'Eta Omega Chi', 'EOX', 'Professional entrepreneurship fraternity'),
    ('31000000-0000-0000-0000-000000000004'::uuid, 'Phi Gamma Nu', 'PGN', 'Professional business fraternity'),
    ('31000000-0000-0000-0000-000000000005'::uuid, 'Delta Tau Delta', 'DTD', 'Social fraternity'),
    ('31000000-0000-0000-0000-000000000006'::uuid, 'Phi Delta Theta', 'PDT', 'Social fraternity'),
    ('31000000-0000-0000-0000-000000000007'::uuid, 'Sigma Phi Epsilon', 'SigEp', 'Social fraternity'),
    ('31000000-0000-0000-0000-000000000008'::uuid, 'Theta Chi', 'Theta Chi', 'Social fraternity')
  ) as fraternities(id, name, acronym, description)
  loop
    select id into existing from organizers where lower(name) = lower(r.name) limit 1;
    if existing is null and r.name = 'Delta Sigma Pi Fraternity' then
      select id into existing from organizers where lower(name) = 'delta sigma pi' limit 1;
    end if;
    if existing is null then
      insert into organizers(id, name, kind, acronym, bio, category)
        values (r.id, r.name, 'club', r.acronym, r.description, 'greek');
    else
      update organizers set
        kind = 'club', category = 'greek', acronym = coalesce(acronym, r.acronym),
        bio = coalesce(bio, r.description),
        name = case when lower(r.name) = 'delta sigma pi fraternity' then r.name else name end
      where id = existing;
    end if;
  end loop;
end $$;

-- Event posters are sanitized to WebP by the server action before upload. The URL is
-- intentionally public because the published event card must be able to display it.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
  values ('event-posters', 'event-posters', true, 5242880, array['image/webp'])
  on conflict (id) do update set public = true, file_size_limit = 5242880,
    allowed_mime_types = array['image/webp'];
create policy event_posters_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'event-posters' and public.is_verified()
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy event_posters_public_read on storage.objects for select
  using (bucket_id = 'event-posters');
create policy event_posters_owner_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'event-posters' and public.is_verified()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Whenever a reviewed suggestion is published, promote its uploaded poster to the
-- canonical event. Imported source flyers already use the same events.image field.
create or replace function public.apply_published_draft_poster() returns trigger
  language plpgsql security definer set search_path = public as $$
declare poster text;
begin
  if new.status = 'published' and new.published_event_id is not null then
    poster := nullif(new.payload->>'image', '');
    if poster is not null and poster ~* '^https://[^/]+/storage/v1/object/public/event-posters/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'
       and char_length(poster) <= 500 then
      update events set image = poster where id = new.published_event_id;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists import_draft_promote_poster on public.import_drafts;
create trigger import_draft_promote_poster
  after update of status, published_event_id on public.import_drafts
  for each row execute function public.apply_published_draft_poster();

-- Repair the already-imported listing that was previously attributed to the calendar source.
update events e set organizer_id = o.id
from organizers o
where o.name = 'Sigma Phi Epsilon'
  and e.title ~* '^Businessmen\s*&\s*Bombshells$'
  and e.location ~* 'Sigma Phi Epsilon|SigEp';
