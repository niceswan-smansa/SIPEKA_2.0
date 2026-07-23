alter table public.academic_years
  drop constraint academic_years_valid_dates,
  add constraint academic_years_valid_dates check (start_date < end_date);

alter table public.students
  add constraint students_nis_trimmed check (nis = btrim(nis)),
  add constraint students_nisn_trimmed check (nisn = btrim(nisn)),
  add constraint students_active_class_required check (
    not is_active or current_grade = 'ALUMNI' or current_class_id is not null
  ),
  add constraint students_active_without_graduation_year check (
    not (is_active and current_grade <> 'ALUMNI' and graduation_year is not null)
  );

create index students_nis_trgm_idx
  on public.students using gin (nis extensions.gin_trgm_ops);
create index students_nisn_trgm_idx
  on public.students using gin (nisn extensions.gin_trgm_ops);

-- Phase 3 owns explicit, named audit events inside each transactional RPC.
drop trigger academic_years_audit_change on public.academic_years;
drop trigger classes_audit_change on public.classes;
drop trigger students_audit_change on public.students;
drop trigger student_enrollments_audit_change on public.student_enrollments;

create function private.require_phase3_admin()
returns public.profiles
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
begin
  select * into actor
  from public.profiles
  where id = auth.uid()
    and is_active
    and not must_change_password
    and role = 'ADMIN';

  if actor.id is null then
    raise exception using errcode = '42501', message = 'PHASE3_FORBIDDEN';
  end if;

  return actor;
end;
$$;

revoke all on function private.require_phase3_admin() from public, anon, authenticated;
