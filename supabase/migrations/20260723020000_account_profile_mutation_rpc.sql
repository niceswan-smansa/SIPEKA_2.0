create function public.admin_update_account_profile(
  p_actor_id uuid,
  p_target_id uuid,
  p_full_name text,
  p_username text,
  p_email text,
  p_role public.app_role,
  p_is_active boolean,
  p_action text,
  p_request_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  target public.profiles%rowtype;
  updated public.profiles%rowtype;
  before_data jsonb;
begin
  select * into actor
  from public.profiles
  where id = p_actor_id and is_active and role = 'SUPER_ADMIN';

  if actor.id is null then
    raise exception using errcode = '42501', message = 'Actor Super Admin tidak valid.';
  end if;

  select * into target
  from public.profiles
  where id = p_target_id
  for update;

  if target.id is null then
    raise exception using errcode = 'P0002', message = 'Target akun tidak ditemukan.';
  end if;
  if target.id = actor.id or target.role = 'SUPER_ADMIN' then
    raise exception using errcode = '42501', message = 'Target akun dilindungi.';
  end if;
  if p_role = 'SUPER_ADMIN' then
    raise exception using errcode = '42501', message = 'Role Super Admin tidak dapat dibuat atau dipilih.';
  end if;
  if p_action not in ('UPDATE', 'ROLE_CHANGE', 'ACTIVATE', 'DEACTIVATE') then
    raise exception using errcode = '22023', message = 'Action account tidak valid.';
  end if;

  before_data := jsonb_build_object(
    'id', target.id,
    'username', target.username,
    'email', target.email,
    'full_name', target.full_name,
    'role', target.role,
    'is_active', target.is_active,
    'must_change_password', target.must_change_password
  );

  update public.profiles
  set full_name = btrim(p_full_name),
      username = lower(btrim(p_username)),
      email = case when p_email is null or btrim(p_email) = '' then null else lower(btrim(p_email)) end,
      role = p_role,
      is_active = p_is_active
  where id = p_target_id
  returning * into updated;

  insert into public.audit_logs (
    scope,
    actor_id,
    actor_name_snapshot,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data,
    metadata,
    request_id
  )
  values (
    'ACCOUNT',
    actor.id,
    actor.full_name,
    p_action,
    'profile',
    updated.id::text,
    before_data,
    jsonb_build_object(
      'id', updated.id,
      'username', updated.username,
      'email', updated.email,
      'full_name', updated.full_name,
      'role', updated.role,
      'is_active', updated.is_active,
      'must_change_password', updated.must_change_password
    ),
    jsonb_build_object('status', 'SUCCESS'),
    p_request_id
  );

  return jsonb_build_object(
    'id', updated.id,
    'username', updated.username,
    'email', updated.email,
    'full_name', updated.full_name,
    'role', updated.role,
    'is_active', updated.is_active,
    'must_change_password', updated.must_change_password,
    'last_login_at', updated.last_login_at,
    'created_at', updated.created_at,
    'updated_at', updated.updated_at
  );
end;
$$;

revoke all on function public.admin_update_account_profile(
  uuid, uuid, text, text, text, public.app_role, boolean, text, uuid
) from public, anon, authenticated;
grant execute on function public.admin_update_account_profile(
  uuid, uuid, text, text, text, public.app_role, boolean, text, uuid
) to service_role;
