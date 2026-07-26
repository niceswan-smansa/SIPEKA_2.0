create or replace function private.prevent_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  clear_function_owner name;
begin
  select pg_catalog.pg_get_userbyid(proc.proowner)
  into clear_function_owner
  from pg_catalog.pg_proc as proc
  where proc.oid = pg_catalog.to_regprocedure(
    'public.phase12_clear_operational_audit(uuid,text,uuid)'
  );

  if tg_op = 'DELETE'
    and old.scope = 'OPERATIONAL'
    and clear_function_owner is not null
    and current_user = clear_function_owner
    and nullif(
      pg_catalog.current_setting(
        'sipeka.operational_audit_clear_request',
        true
      ),
      ''
    ) is not null
  then
    return old;
  end if;

  raise exception using
    errcode = '55000',
    message = 'Audit log bersifat append-only.';
end;
$$;

create function public.phase12_clear_operational_audit(
  p_actor_id uuid,
  p_confirmation text,
  p_request_id uuid default gen_random_uuid()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  deleted_count integer := 0;
begin
  select * into actor
  from public.profiles
  where id = p_actor_id
    and role = 'SUPER_ADMIN'
    and is_active
    and not must_change_password
  for share;

  if actor.id is null then
    raise exception using errcode = '42501', message = 'SUPER_ADMIN_REQUIRED';
  end if;

  if p_confirmation is distinct from 'HAPUS SEMUA RIWAYAT OPERASIONAL' then
    raise exception using errcode = '22023', message = 'AUDIT_CLEAR_CONFIRMATION_INVALID';
  end if;

  perform pg_catalog.set_config(
    'sipeka.operational_audit_clear_request',
    p_request_id::text,
    true
  );

  delete from public.audit_logs
  where scope = 'OPERATIONAL';

  get diagnostics deleted_count = row_count;

  perform pg_catalog.set_config(
    'sipeka.operational_audit_clear_request',
    '',
    true
  );

  insert into public.audit_logs (
    scope,
    actor_id,
    actor_name_snapshot,
    action,
    entity_type,
    entity_id,
    metadata,
    request_id
  ) values (
    'ACCOUNT',
    actor.id,
    actor.full_name,
    'OPERATIONAL_AUDIT_CLEAR',
    'audit_scope',
    'OPERATIONAL',
    jsonb_build_object('deleted_count', deleted_count, 'status', 'SUCCESS'),
    p_request_id
  );

  return deleted_count;
end;
$$;

revoke all on function public.phase12_clear_operational_audit(uuid, text, uuid)
from public, anon, authenticated;
grant execute on function public.phase12_clear_operational_audit(uuid, text, uuid)
to service_role;
