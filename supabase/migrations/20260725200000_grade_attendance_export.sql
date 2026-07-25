create function public.phase12_get_grade_attendance_export(
  p_grade public.grade_level,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  active_year public.academic_years%rowtype;
  jakarta_today date := (now() at time zone 'Asia/Jakarta')::date;
  result jsonb;
begin
  if not private.is_admin() then
    raise exception using errcode = '42501', message = 'GRADE_ATTENDANCE_EXPORT_FORBIDDEN';
  end if;

  if p_grade is null or p_grade = 'ALUMNI' then
    raise exception using errcode = '22023', message = 'GRADE_ATTENDANCE_EXPORT_GRADE_INVALID';
  end if;

  select *
  into active_year
  from public.academic_years
  where is_active;

  if active_year.id is null then
    raise exception using errcode = 'P0002', message = 'ACTIVE_ACADEMIC_YEAR_NOT_FOUND';
  end if;

  if p_start_date is null
    or p_end_date is null
    or p_start_date > p_end_date
    or p_end_date - p_start_date >= 366
  then
    raise exception using errcode = '22023', message = 'GRADE_ATTENDANCE_EXPORT_RANGE_INVALID';
  end if;

  if p_start_date < active_year.start_date
    or p_end_date > active_year.end_date
    or p_end_date > jakarta_today
  then
    raise exception using
      errcode = '22023',
      message = 'GRADE_ATTENDANCE_EXPORT_RANGE_OUTSIDE_ACTIVE_YEAR';
  end if;

  select jsonb_build_object(
    'academic_year', jsonb_build_object(
      'id', active_year.id,
      'name', active_year.name,
      'start_date', active_year.start_date,
      'end_date', active_year.end_date
    ),
    'grade', p_grade,
    'start_date', p_start_date,
    'end_date', p_end_date,
    'classes', coalesce(jsonb_agg(
      jsonb_build_object(
        'id', class_row.id,
        'class_number', class_row.class_number,
        'homeroom_teacher', class_row.homeroom_teacher,
        'students', class_row.students
      )
      order by class_row.class_number
    ), '[]'::jsonb)
  )
  into result
  from (
    select
      c.id,
      c.class_number,
      c.homeroom_teacher,
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'nis', s.nis,
            'nisn', s.nisn,
            'full_name', s.full_name,
            'gender', s.gender,
            'attendance', coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'date', attendance_day.attendance_date,
                  'status', attendance_day.status
                )
                order by attendance_day.attendance_date, attendance_day.status
              )
              from (
                select distinct ar.attendance_date, ar.status
                from public.attendance_records ar
                where ar.student_id = s.id
                  and ar.attendance_date between p_start_date and p_end_date
              ) attendance_day
            ), '[]'::jsonb)
          )
          order by s.full_name, s.id
        )
        from public.student_enrollments e
        join public.students s on s.id = e.student_id
        where e.academic_year_id = active_year.id
          and e.class_id = c.id
          and e.grade = p_grade
          and e.is_current
          and s.is_active
      ), '[]'::jsonb) as students
    from public.classes c
    where c.academic_year_id = active_year.id
      and c.grade = p_grade
      and c.is_active
    order by c.class_number
  ) class_row;

  return coalesce(result, jsonb_build_object(
    'academic_year', jsonb_build_object(
      'id', active_year.id,
      'name', active_year.name,
      'start_date', active_year.start_date,
      'end_date', active_year.end_date
    ),
    'grade', p_grade,
    'start_date', p_start_date,
    'end_date', p_end_date,
    'classes', '[]'::jsonb
  ));
end;
$$;

create function public.phase12_record_grade_attendance_export(
  p_grade public.grade_level,
  p_start_date date,
  p_end_date date,
  p_class_count integer,
  p_student_count integer,
  p_impacted_student_count integer,
  p_request_id uuid default gen_random_uuid()
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype := private.require_phase4_admin();
  active_year public.academic_years%rowtype;
begin
  if p_grade is null or p_grade = 'ALUMNI' then
    raise exception using errcode = '22023', message = 'GRADE_ATTENDANCE_EXPORT_GRADE_INVALID';
  end if;

  if p_start_date is null or p_end_date is null or p_start_date > p_end_date then
    raise exception using errcode = '22023', message = 'GRADE_ATTENDANCE_EXPORT_RANGE_INVALID';
  end if;

  select *
  into active_year
  from public.academic_years
  where is_active;

  insert into public.audit_logs (
    scope,
    actor_id,
    actor_name_snapshot,
    action,
    entity_type,
    entity_id,
    metadata,
    request_id
  )
  values (
    'OPERATIONAL',
    actor.id,
    actor.full_name,
    'GRADE_ATTENDANCE_EXPORT',
    'grade',
    p_grade::text,
    jsonb_build_object(
      'academic_year_id', active_year.id,
      'academic_year_name', active_year.name,
      'start_date', p_start_date,
      'end_date', p_end_date,
      'class_count', greatest(coalesce(p_class_count, 0), 0),
      'student_count', greatest(coalesce(p_student_count, 0), 0),
      'impacted_student_count', greatest(coalesce(p_impacted_student_count, 0), 0),
      'format', 'xlsx'
    ),
    p_request_id
  );
end;
$$;

revoke all on function public.phase12_get_grade_attendance_export(
  public.grade_level,
  date,
  date
) from public, anon, authenticated;

grant execute on function public.phase12_get_grade_attendance_export(
  public.grade_level,
  date,
  date
) to authenticated;

revoke all on function public.phase12_record_grade_attendance_export(
  public.grade_level,
  date,
  date,
  integer,
  integer,
  integer,
  uuid
) from public, anon, authenticated;

grant execute on function public.phase12_record_grade_attendance_export(
  public.grade_level,
  date,
  date,
  integer,
  integer,
  integer,
  uuid
) to authenticated;
