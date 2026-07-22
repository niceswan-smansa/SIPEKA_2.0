create function public.admin_create_account_profile(
  p_actor_id uuid,
  p_target_id uuid,
  p_full_name text,
  p_username text,
  p_email text,
  p_role public.app_role,
  p_is_active boolean,
  p_must_change_password boolean,
  p_request_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  created public.profiles%rowtype;
begin
  select * into actor
  from public.profiles
  where id = p_actor_id and is_active and role = 'SUPER_ADMIN';
  if actor.id is null then
    raise exception using errcode = '42501', message = 'Actor Super Admin tidak valid.';
  end if;
  if p_target_id = p_actor_id or p_role = 'SUPER_ADMIN' then
    raise exception using errcode = '42501', message = 'Target akun dilindungi.';
  end if;

  insert into public.profiles (
    id, username, email, full_name, role, is_active, must_change_password, created_by
  ) values (
    p_target_id, lower(btrim(p_username)), lower(btrim(p_email)), btrim(p_full_name),
    p_role, p_is_active, p_must_change_password, p_actor_id
  ) returning * into created;

  insert into public.audit_logs (
    scope, actor_id, actor_name_snapshot, action, entity_type, entity_id,
    before_data, after_data, metadata, request_id
  ) values (
    'ACCOUNT', actor.id, actor.full_name, 'CREATE', 'profile', created.id::text,
    null,
    jsonb_build_object(
      'id', created.id, 'username', created.username, 'email', created.email,
      'full_name', created.full_name, 'role', created.role,
      'is_active', created.is_active, 'must_change_password', created.must_change_password
    ),
    jsonb_build_object('status', 'SUCCESS'), p_request_id
  );

  return jsonb_build_object(
    'id', created.id, 'username', created.username, 'email', created.email,
    'full_name', created.full_name, 'role', created.role,
    'is_active', created.is_active, 'must_change_password', created.must_change_password,
    'last_login_at', created.last_login_at, 'created_at', created.created_at,
    'updated_at', created.updated_at
  );
end;
$$;

revoke all on function public.admin_create_account_profile(
  uuid, uuid, text, text, text, public.app_role, boolean, boolean, uuid
) from public, anon, authenticated;
grant execute on function public.admin_create_account_profile(
  uuid, uuid, text, text, text, public.app_role, boolean, boolean, uuid
) to service_role;
