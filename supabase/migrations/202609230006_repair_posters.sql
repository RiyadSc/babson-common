-- Recover poster URLs uploaded before the suggestion action copied them onto the
-- normalized payload. The original sanitized public URL remains in raw metadata.
update public.events e
set image = coalesce(nullif(d.payload->>'image', ''), nullif(d.payload#>>'{raw,image}', ''))
from public.import_drafts d
where d.published_event_id = e.id
  and coalesce(nullif(d.payload->>'image', ''), nullif(d.payload#>>'{raw,image}', ''))
      ~* '^https://[^/]+/storage/v1/object/public/event-posters/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp(?:\?.*)?$';

-- Re-apply the known fraternity attribution in case the source refreshed the event
-- after the original one-shot correction ran.
update public.events e set organizer_id = o.id
from public.organizers o
where o.name = 'Sigma Phi Epsilon'
  and e.title ~* 'Businessmen\s*&\s*Bombshells'
  and e.location ~* 'Sigma Phi Epsilon|SigEp';

create or replace function public.apply_published_draft_poster() returns trigger
  language plpgsql security definer set search_path = public as $$
declare poster text;
begin
  if new.status = 'published' and new.published_event_id is not null then
    poster := coalesce(nullif(new.payload->>'image', ''), nullif(new.payload#>>'{raw,image}', ''));
    if poster is not null
       and poster ~* '^https://[^/]+/storage/v1/object/public/event-posters/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp(?:\?.*)?$'
       and char_length(poster) <= 500 then
      update public.events set image = poster where id = new.published_event_id;
    end if;
  end if;
  return new;
end $$;
