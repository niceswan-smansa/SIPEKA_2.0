create function public.phase3_create_student(
  p_full_name text,
  p_nis text,
  p_nisn text,
  p_gender public.gender,
  p_grade public.grade_level,
  p_class_id uuid,
  p_year_entered integer,
  p_is_active boolean default true,
  p_request_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype := private.require_phase3_admin();
  assigned_class public.classes%rowtype;
  academic_year public.academic_years%rowtype;
  created public.students%rowtype;
  normalized_full_name text := regexp_replace(btrim(p_full_name), '\s+', ' ', 'g');
  normalized_nis text := btrim(p_nis);
  normalized_nisn text := btrim(p_nisn);
  violated_constraint text;
begin
  if normalized_full_name = '' or normalized_nis = '' or normalized_nisn = '' then
    raise exception using errcode = '22023', message = 'STUDENT_VALIDATION_ERROR';
  end if;
  if p_grade = 'ALUMNI' then
    raise exception using errcode = '22023', message = 'STUDENT_ALUMNI_NOT_ALLOWED';
  end if;
  if exists (select 1 from public.students where nis = normalized_nis) then
    raise exception using errcode = '23505', message = 'DUPLICATE_NIS';
  end if;
  if exists (select 1 from public.students where nisn = normalized_nisn) then
    raise exception using errcode = '23505', message = 'DUPLICATE_NISN';
  end if;

  select * into assigned_class from public.classes where id = p_class_id for share;
  if assigned_class.id is null or not assigned_class.is_active then
    raise exception using errcode = '23514', message = 'CLASS_INACTIVE_OR_NOT_FOUND';
  end if;
  if assigned_class.grade <> p_grade then
    raise exception using errcode = '23514', message = 'GRADE_CLASS_MISMATCH';
  end if;
  select * into academic_year
  from public.academic_years
  where id = assigned_class.academic_year_id and is_active;
  if academic_year.id is null then
    raise exception using errcode = '23514', message = 'CLASS_NOT_IN_ACTIVE_YEAR';
  end if;

  begin
    insert into public.students (
      nis, nisn, full_name, normalized_name, gender, current_grade, current_class_id,
      year_entered, graduation_year, is_active, created_by, updated_by
    ) values (
      normalized_nis, normalized_nisn, normalized_full_name, lower(normalized_full_name),
      p_gender, p_grade, assigned_class.id, p_year_entered, null, p_is_active, actor.id, actor.id
    ) returning * into created;
  exception when unique_violation then
    get stacked diagnostics violated_constraint = CONSTRAINT_NAME;
    if violated_constraint = 'students_nis_key' then
      raise exception using errcode = '23505', message = 'DUPLICATE_NIS';
    elsif violated_constraint = 'students_nisn_key' then
      raise exception using errcode = '23505', message = 'DUPLICATE_NISN';
    end if;
    raise;
  end;

  insert into public.student_enrollments (
    student_id, academic_year_id, class_id, grade, started_on, is_current, created_by
  ) values (
    created.id, academic_year.id, assigned_class.id, p_grade,
    greatest(academic_year.start_date, current_date), true, actor.id
  );

  insert into public.audit_logs (
    scope, actor_id, actor_name_snapshot, action, entity_type, entity_id,
    before_data, after_data, request_id
  ) values (
    'OPERATIONAL', actor.id, actor.full_name, 'STUDENT_CREATE', 'student', created.id::text,
    null,
    jsonb_build_object(
      'id', created.id, 'nis', created.nis, 'nisn', created.nisn,
      'full_name', created.full_name, 'gender', created.gender,
      'current_grade', created.current_grade, 'current_class_id', created.current_class_id,
      'year_entered', created.year_entered, 'is_active', created.is_active
    ),
    p_request_id
  );

  return jsonb_build_object(
    'id', created.id, 'nis', created.nis, 'nisn', created.nisn,
    'full_name', created.full_name, 'gender', created.gender,
    'current_grade', created.current_grade, 'current_class_id', created.current_class_id,
    'year_entered', created.year_entered, 'is_active', created.is_active
  );
end;
$$;

create function public.phase3_update_student_identity(
  p_id uuid,
  p_full_name text,
  p_nis text,
  p_nisn text,
  p_gender public.gender,
  p_year_entered integer,
  p_request_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype := private.require_phase3_admin();
  target public.students%rowtype;
  updated public.students%rowtype;
  normalized_full_name text := regexp_replace(btrim(p_full_name), '\s+', ' ', 'g');
  normalized_nis text := btrim(p_nis);
  normalized_nisn text := btrim(p_nisn);
begin
  select * into target from public.students where id = p_id for update;
  if target.id is null then
    raise exception using errcode = 'P0002', message = 'STUDENT_NOT_FOUND';
  end if;
  if normalized_full_name = '' or normalized_nis = '' or normalized_nisn = '' then
    raise exception using errcode = '22023', message = 'STUDENT_VALIDATION_ERROR';
  end if;
  if exists (select 1 from public.students where id <> p_id and nis = normalized_nis) then
    raise exception using errcode = '23505', message = 'DUPLICATE_NIS';
  end if;
  if exists (select 1 from public.students where id <> p_id and nisn = normalized_nisn) then
    raise exception using errcode = '23505', message = 'DUPLICATE_NISN';
  end if;

  update public.students
  set full_name = normalized_full_name,
      normalized_name = lower(normalized_full_name),
      nis = normalized_nis,
      nisn = normalized_nisn,
      gender = p_gender,
      year_entered = p_year_entered,
      updated_by = actor.id
  where id = p_id
  returning * into updated;

  insert into public.audit_logs (
    scope, actor_id, actor_name_snapshot, action, entity_type, entity_id,
    before_data, after_data, request_id
  ) values (
    'OPERATIONAL', actor.id, actor.full_name, 'STUDENT_UPDATE', 'student', updated.id::text,
    jsonb_build_object(
      'nis', target.nis, 'nisn', target.nisn, 'full_name', target.full_name,
      'gender', target.gender, 'year_entered', target.year_entered
    ),
    jsonb_build_object(
      'nis', updated.nis, 'nisn', updated.nisn, 'full_name', updated.full_name,
      'gender', updated.gender, 'year_entered', updated.year_entered
    ),
    p_request_id
  );

  return jsonb_build_object(
    'id', updated.id, 'nis', updated.nis, 'nisn', updated.nisn,
    'full_name', updated.full_name, 'gender', updated.gender,
    'year_entered', updated.year_entered
  );
end;
$$;

create function public.phase3_change_student_academic(
  p_id uuid,
  p_grade public.grade_level,
  p_class_id uuid,
  p_is_active boolean,
  p_request_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype := private.require_phase3_admin();
  target public.students%rowtype;
  current_enrollment public.student_enrollments%rowtype;
  assigned_class public.classes%rowtype;
  academic_year public.academic_years%rowtype;
  updated public.students%rowtype;
  action_name text;
begin
  if p_grade = 'ALUMNI' then
    raise exception using errcode = '22023', message = 'STUDENT_ALUMNI_NOT_ALLOWED';
  end if;

  select * into target from public.students where id = p_id for update;
  if target.id is null then
    raise exception using errcode = 'P0002', message = 'STUDENT_NOT_FOUND';
  end if;
  select * into current_enrollment
  from public.student_enrollments
  where student_id = p_id and is_current
  for update;

  select * into assigned_class from public.classes where id = p_class_id for share;
  if assigned_class.id is null or not assigned_class.is_active then
    raise exception using errcode = '23514', message = 'CLASS_INACTIVE_OR_NOT_FOUND';
  end if;
  if assigned_class.grade <> p_grade then
    raise exception using errcode = '23514', message = 'GRADE_CLASS_MISMATCH';
  end if;
  select * into academic_year
  from public.academic_years
  where id = assigned_class.academic_year_id and is_active;
  if academic_year.id is null then
    raise exception using errcode = '23514', message = 'CLASS_NOT_IN_ACTIVE_YEAR';
  end if;

  if current_enrollment.id is null
    or current_enrollment.class_id is distinct from assigned_class.id
    or current_enrollment.grade is distinct from p_grade
  then
    if current_enrollment.id is not null then
      update public.student_enrollments
      set is_current = false, ended_on = greatest(started_on, current_date)
      where id = current_enrollment.id;
    end if;

    insert into public.student_enrollments (
      student_id, academic_year_id, class_id, grade, started_on, is_current, created_by
    ) values (
      target.id, academic_year.id, assigned_class.id, p_grade,
      greatest(academic_year.start_date, current_date), true, actor.id
    );
  end if;

  action_name := case
    when target.is_active and not p_is_active then 'STUDENT_DEACTIVATE'
    when not target.is_active and p_is_active then 'STUDENT_ACTIVATE'
    when target.current_grade <> p_grade then 'STUDENT_CHANGE_GRADE'
    else 'STUDENT_MOVE_CLASS'
  end;

  update public.students
  set current_grade = p_grade,
      current_class_id = assigned_class.id,
      is_active = p_is_active,
      graduation_year = null,
      updated_by = actor.id
  where id = target.id
  returning * into updated;

  insert into public.audit_logs (
    scope, actor_id, actor_name_snapshot, action, entity_type, entity_id,
    before_data, after_data, request_id
  ) values (
    'OPERATIONAL', actor.id, actor.full_name, action_name, 'student', updated.id::text,
    jsonb_build_object(
      'current_grade', target.current_grade, 'current_class_id', target.current_class_id,
      'is_active', target.is_active
    ),
    jsonb_build_object(
      'current_grade', updated.current_grade, 'current_class_id', updated.current_class_id,
      'is_active', updated.is_active
    ),
    p_request_id
  );

  return jsonb_build_object(
    'id', updated.id, 'current_grade', updated.current_grade,
    'current_class_id', updated.current_class_id, 'is_active', updated.is_active
  );
end;
$$;

revoke all on function public.phase3_create_student(text, text, text, public.gender, public.grade_level, uuid, integer, boolean, uuid)
  from public, anon, authenticated;
revoke all on function public.phase3_update_student_identity(uuid, text, text, text, public.gender, integer, uuid)
  from public, anon, authenticated;
revoke all on function public.phase3_change_student_academic(uuid, public.grade_level, uuid, boolean, uuid)
  from public, anon, authenticated;

grant execute on function public.phase3_create_student(text, text, text, public.gender, public.grade_level, uuid, integer, boolean, uuid)
  to authenticated;
grant execute on function public.phase3_update_student_identity(uuid, text, text, text, public.gender, integer, uuid)
  to authenticated;
grant execute on function public.phase3_change_student_academic(uuid, public.grade_level, uuid, boolean, uuid)
  to authenticated;
