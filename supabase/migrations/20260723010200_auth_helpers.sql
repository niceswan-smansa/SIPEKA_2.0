create function private.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid();
$$;

create function private.current_profile_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles as p
  where p.id = auth.uid() and p.is_active;
$$;

create function private.is_active_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as p
    where p.id = auth.uid() and p.is_active
  );
$$;

create function private.requires_password_change()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select p.must_change_password
    from public.profiles as p
    where p.id = auth.uid() and p.is_active
  ), false);
$$;

create function private.can_access_operational()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as p
    where p.id = auth.uid()
      and p.is_active
      and not p.must_change_password
      and p.role in ('ADMIN', 'USER')
  );
$$;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as p
    where p.id = auth.uid()
      and p.is_active
      and not p.must_change_password
      and p.role = 'ADMIN'
  );
$$;

create function private.can_access_account_portal()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as p
    where p.id = auth.uid()
      and p.is_active
      and not p.must_change_password
      and p.role = 'SUPER_ADMIN'
  );
$$;

create function public.complete_password_change()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_name text;
begin
  update public.profiles as p
  set must_change_password = false
  where p.id = actor_id and p.is_active
  returning p.full_name into actor_name;

  if actor_name is null then
    raise exception using errcode = '42501', message = 'Akun aktif tidak ditemukan.';
  end if;

  insert into public.audit_logs (
    scope,
    actor_id,
    actor_name_snapshot,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    'ACCOUNT',
    actor_id,
    actor_name,
    'CHANGE_PASSWORD',
    'profile',
    actor_id::text,
    jsonb_build_object('source', 'self_service')
  );
end;
$$;

revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.complete_password_change() from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.current_user_id() to authenticated;
grant execute on function private.current_profile_role() to authenticated;
grant execute on function private.is_active_account() to authenticated;
grant execute on function private.requires_password_change() to authenticated;
grant execute on function private.can_access_operational() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.can_access_account_portal() to authenticated;
grant execute on function public.complete_password_change() to authenticated;
