create schema if not exists private;

create function private.redact_student_audit_snapshot(value jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case when value is null then null else
    value - array['nis', 'nisn', 'full_name', 'normalized_name'] end;
$$;

create function private.redact_student_audit_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.scope = 'OPERATIONAL' and new.entity_type in ('student', 'students') then
    new.before_data := private.redact_student_audit_snapshot(new.before_data);
    new.after_data := private.redact_student_audit_snapshot(new.after_data);
  end if;
  return new;
end;
$$;

create trigger audit_logs_redact_student_before_insert
before insert on public.audit_logs
for each row execute function private.redact_student_audit_insert();

create index attendance_preview_tokens_expiry_idx
  on public.attendance_preview_tokens (expires_at);

create function private.cleanup_attendance_preview_tokens()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.attendance_preview_tokens
  where id in (
    select id from public.attendance_preview_tokens
    where expires_at < clock_timestamp() - interval '1 day'
      or used_at < clock_timestamp() - interval '1 day'
    order by expires_at
    limit 100
  );
  return new;
end;
$$;

create trigger attendance_preview_tokens_cleanup_before_insert
before insert on public.attendance_preview_tokens
for each statement execute function private.cleanup_attendance_preview_tokens();

revoke all on function private.redact_student_audit_snapshot(jsonb) from public;
revoke all on function private.redact_student_audit_insert() from public;
revoke all on function private.cleanup_attendance_preview_tokens() from public;
