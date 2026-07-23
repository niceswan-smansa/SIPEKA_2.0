create function public.phase10_list_classes(
  p_academic_year_id uuid default null,
  p_grade public.grade_level default null
)
returns table (
  id uuid,
  academic_year_id uuid,
  academic_year_name text,
  academic_year_active boolean,
  grade public.grade_level,
  class_number integer,
  homeroom_teacher text,
  notes text,
  is_active boolean,
  active_student_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.academic_year_id, y.name, y.is_active, c.grade, c.class_number,
    c.homeroom_teacher, c.notes, c.is_active,
    count(e.id) filter (where e.is_current and s.is_active) as active_student_count
  from public.classes c
  join public.academic_years y on y.id = c.academic_year_id
  left join public.student_enrollments e on e.class_id = c.id and e.is_current
  left join public.students s on s.id = e.student_id and s.is_active
  where private.can_access_operational()
    and (p_academic_year_id is null or c.academic_year_id = p_academic_year_id)
    and (p_grade is null or c.grade = p_grade)
  group by c.id, y.id
  order by c.academic_year_id desc,
    array_position(array['X','XI','XII'], c.grade::text), c.class_number;
$$;

create function public.phase10_preview_promotion(p_to_academic_year_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  from_year public.academic_years%rowtype;
  to_year public.academic_years%rowtype;
  missing jsonb;
  summary jsonb;
begin
  perform private.require_phase3_admin();
  select * into from_year from public.academic_years where is_active;
  select * into to_year from public.academic_years where id = p_to_academic_year_id;
  if from_year.id is null or to_year.id is null or from_year.id = to_year.id then
    raise exception using errcode = '22023', message = 'PROMOTION_YEAR_INVALID';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'grade', required.grade, 'class_number', required.class_number
  ) order by required.grade, required.class_number), '[]'::jsonb)
  into missing
  from (
    select distinct
      case s.current_grade when 'X' then 'XI'::public.grade_level
        else 'XII'::public.grade_level end as grade,
      c.class_number
    from public.students s
    join public.student_enrollments e on e.student_id = s.id and e.is_current
    join public.classes c on c.id = e.class_id
    where s.is_active and e.academic_year_id = from_year.id
      and s.current_grade in ('X', 'XI')
  ) required
  where not exists (
    select 1 from public.classes destination
    where destination.academic_year_id = to_year.id
      and destination.grade = required.grade
      and destination.class_number = required.class_number
      and destination.is_active
  );

  select jsonb_build_object(
    'from_year_id', from_year.id,
    'from_year_name', from_year.name,
    'to_year_id', to_year.id,
    'to_year_name', to_year.name,
    'total', count(*),
    'x_to_xi', count(*) filter (where s.current_grade = 'X'),
    'xi_to_xii', count(*) filter (where s.current_grade = 'XI'),
    'xii_to_alumni', count(*) filter (where s.current_grade = 'XII'),
    'missing_destination_classes', missing,
    'safe_to_apply', jsonb_array_length(missing) = 0
  ) into summary
  from public.students s
  join public.student_enrollments e on e.student_id = s.id and e.is_current
  where s.is_active and e.academic_year_id = from_year.id;
  return summary;
end;
$$;

create function public.phase10_get_student_report(
  p_student_id uuid,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.can_access_operational() then
    raise exception using errcode = '42501', message = 'STUDENT_REPORT_FORBIDDEN';
  end if;
  if not exists (select 1 from public.students where id = p_student_id) then
    raise exception using errcode = 'P0002', message = 'STUDENT_NOT_FOUND';
  end if;
  if p_start_date > p_end_date or p_end_date - p_start_date > 365 then
    raise exception using errcode = '22023', message = 'REPORT_DATE_RANGE_INVALID';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'date', ar.attendance_date, 'period_number', ar.period_number, 'status', ar.status,
      'note', ar.note, 'created_at', ar.created_at, 'updated_at', ar.updated_at,
      'recorded_by', coalesce(profile.full_name, 'Akun dihapus')
    ) order by ar.attendance_date, ar.period_number)
    from public.attendance_records ar
    left join public.profiles profile on profile.id = ar.updated_by
    where ar.student_id = p_student_id and ar.attendance_date between p_start_date and p_end_date
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.phase10_list_classes(uuid, public.grade_level)
  from public, anon;
grant execute on function public.phase10_list_classes(uuid, public.grade_level)
  to authenticated;
revoke all on function public.phase10_preview_promotion(uuid)
  from public, anon;
grant execute on function public.phase10_preview_promotion(uuid)
  to authenticated;
revoke all on function public.phase10_get_student_report(uuid, date, date)
  from public, anon;
grant execute on function public.phase10_get_student_report(uuid, date, date)
  to authenticated;
