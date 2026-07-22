create function public.admin_mark_account_password_reset(
  p_actor_id uuid,
  p_target_id uuid,
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
begin
  select * into actor from public.profiles
  where id = p_actor_id and is_active and role = 'SUPER_ADMIN';
  if actor.id is null then
    raise exception using errcode = '42501', message = 'Actor Super Admin tidak valid.';
  end if;
  select * into target from public.profiles where id = p_target_id for update;
  if target.id is null then
    raise exception using errcode = 'P0002', message = 'Target akun tidak ditemukan.';
  end if;
  if target.id = actor.id or target.role = 'SUPER_ADMIN' then
    raise exception using errcode = '42501', message = 'Target akun dilindungi.';
  end if;

  update public.profiles
  set must_change_password = true
  where id = target.id
  returning * into updated;

  insert into public.audit_logs (
    scope, actor_id, actor_name_snapshot, action, entity_type, entity_id,
    before_data, after_data, metadata, request_id
  ) values (
    'ACCOUNT', actor.id, actor.full_name, 'RESET_PASSWORD', 'profile', updated.id::text,
    jsonb_build_object(
      'id', target.id, 'username', target.username, 'email', target.email,
      'full_name', target.full_name, 'role', target.role,
      'is_active', target.is_active, 'must_change_password', target.must_change_password
    ),
    jsonb_build_object(
      'id', updated.id, 'username', updated.username, 'email', updated.email,
      'full_name', updated.full_name, 'role', updated.role,
      'is_active', updated.is_active, 'must_change_password', updated.must_change_password
    ),
    jsonb_build_object('status', 'SUCCESS', 'credential_fields', 'omitted', 'session_guard', 'profile'),
    p_request_id
  );

  return jsonb_build_object(
    'id', updated.id, 'username', updated.username, 'email', updated.email,
    'full_name', updated.full_name, 'role', updated.role,
    'is_active', updated.is_active, 'must_change_password', updated.must_change_password,
    'last_login_at', updated.last_login_at, 'created_at', updated.created_at,
    'updated_at', updated.updated_at
  );
end;
$$;

create function public.admin_tombstone_account(
  p_actor_id uuid,
  p_target_id uuid,
  p_tombstone_username text,
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
begin
  select * into actor from public.profiles
  where id = p_actor_id and is_active and role = 'SUPER_ADMIN';
  if actor.id is null then
    raise exception using errcode = '42501', message = 'Actor Super Admin tidak valid.';
  end if;
  select * into target from public.profiles where id = p_target_id for update;
  if target.id is null then
    raise exception using errcode = 'P0002', message = 'Target akun tidak ditemukan.';
  end if;
  if target.id = actor.id or target.role = 'SUPER_ADMIN' then
    raise exception using errcode = '42501', message = 'Target akun dilindungi.';
  end if;
  if p_tombstone_username !~ '^deleted_[a-f0-9]{32}$' then
    raise exception using errcode = '22023', message = 'Tombstone akun tidak valid.';
  end if;

  update public.profiles
  set username = p_tombstone_username,
      email = null,
      is_active = false,
      must_change_password = true
  where id = target.id
  returning * into updated;

  insert into public.audit_logs (
    scope, actor_id, actor_name_snapshot, action, entity_type, entity_id,
    before_data, after_data, metadata, request_id
  ) values (
    'ACCOUNT', actor.id, actor.full_name, 'DELETE', 'profile', updated.id::text,
    jsonb_build_object(
      'id', target.id, 'username', target.username, 'email', target.email,
      'full_name', target.full_name, 'role', target.role,
      'is_active', target.is_active, 'must_change_password', target.must_change_password
    ),
    jsonb_build_object(
      'id', updated.id, 'username', updated.username, 'email', updated.email,
      'full_name', updated.full_name, 'role', updated.role,
      'is_active', updated.is_active, 'must_change_password', updated.must_change_password
    ),
    jsonb_build_object(
      'status', 'SUCCESS', 'semantics', 'ACCESS_TOMBSTONE',
      'credential_fields', 'omitted', 'session_guard', 'profile',
      'session_revocation', 'unsupported'
    ),
    p_request_id
  );

  return jsonb_build_object(
    'id', updated.id, 'username', updated.username, 'email', updated.email,
    'full_name', updated.full_name, 'role', updated.role,
    'is_active', updated.is_active, 'must_change_password', updated.must_change_password,
    'last_login_at', updated.last_login_at, 'created_at', updated.created_at,
    'updated_at', updated.updated_at
  );
end;
$$;

revoke all on function public.admin_mark_account_password_reset(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.admin_tombstone_account(uuid, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.admin_mark_account_password_reset(uuid, uuid, uuid)
  to service_role;
grant execute on function public.admin_tombstone_account(uuid, uuid, text, uuid)
  to service_role;
