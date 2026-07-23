-- SIPEKA accounts use username/password. Auth keeps a hidden synthetic email,
-- while the application profile never stores a user email.
update public.profiles set email = null where email is not null;

create or replace function private.force_profile_email_null()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.email := null;
  return new;
end;
$$;

drop trigger if exists profiles_email_null on public.profiles;
create trigger profiles_email_null
before insert or update of email on public.profiles
for each row execute function private.force_profile_email_null();

alter table public.profiles
  drop constraint if exists profiles_email_must_be_null;

alter table public.profiles
  add constraint profiles_email_must_be_null check (email is null);
