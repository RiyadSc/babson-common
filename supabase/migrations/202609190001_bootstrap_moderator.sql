create or replace function public.bootstrap_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email ~* '^[^\s@]+@babson\.edu$' then
    insert into profiles (id, role)
    values (
      new.id,
      case
        when lower(new.email) = 'rscally1@babson.edu' then 'moderator'
        else 'student'
      end
    )
    on conflict (id) do update
      set role = 'moderator'
      where lower(new.email) = 'rscally1@babson.edu';
  end if;

  return new;
end
$$;

-- Promote the account if it was created before this migration was applied.
update public.profiles p
set role = 'moderator'
from auth.users u
where p.id = u.id
  and lower(u.email) = 'rscally1@babson.edu'
  and u.email_confirmed_at is not null;
