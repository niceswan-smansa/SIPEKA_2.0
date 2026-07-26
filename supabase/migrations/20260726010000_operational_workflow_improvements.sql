-- Workflow improvements:
-- - transactional multi-file student import
-- - date-aware class dashboard for operational search
-- No existing student, enrollment, attendance, revision, batch, or audit data is deleted.

create or replace function public.phase13_import_students_bulk(
  p_batches jsonb,
  p_request_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype := private.require_phase3_admin();
  batch jsonb;
  target_year public.academic_years%rowtype;
  target_class public.classes%rowtype;
  import_result jsonb;
  batch_count integer;
  total_rows integer;
  total_created integer := 0;
  v_academic_year_id uuid;
  v_class_id uuid;
  results jsonb := '[]'::jsonb;
begin
  if p_batches is null or jsonb_typeof(p_batches) <> 'array' then
    raise exception using errcode = '22023', message = 'IMPORT_BULK_INVALID';
  end if;

  batch_count := jsonb_array_length(p_batches);
  if batch_count < 1 or batch_count > 30 then
    raise exception using errcode = '22023', message = 'IMPORT_BULK_BATCH_LIMIT';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_batches) item
    where jsonb_typeof(item->'rows') <> 'array'
  ) then
    raise exception using errcode = '22023', message = 'IMPORT_BULK_ROWS_INVALID';
  end if;

  select coalesce(sum(jsonb_array_length(item->'rows')), 0)
  into total_rows
  from jsonb_array_elements(p_batches) item;

  if total_rows < 1 or total_rows > 5000 then
    raise exception using errcode = '22023', message = 'IMPORT_BULK_ROW_LIMIT';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_batches) item
    group by item->>'academicYearId', item->>'classId'
    having count(*) > 1
  ) then
    raise exception using errcode = '23505', message = 'IMPORT_BULK_DUPLICATE_CLASS';
  end if;

  for batch in select value from jsonb_array_elements(p_batches)
  loop
    begin
      v_academic_year_id := (batch->>'academicYearId')::uuid;
      v_class_id := (batch->>'classId')::uuid;
    exception when others then
      raise exception using errcode = '22023', message = 'IMPORT_BULK_SCOPE_INVALID';
    end;

    select * into target_year
    from public.academic_years
    where id = v_academic_year_id
      and is_active
    for share;

    select * into target_class
    from public.classes
    where id = v_class_id
      and academic_year_id = v_academic_year_id
      and is_active
    for share;

    if target_year.id is null
      or target_class.id is null
      or target_class.academic_year_id <> target_year.id
    then
      raise exception using errcode = '23514', message = 'IMPORT_BULK_SCOPE_INVALID';
    end if;

    select public.phase7_import_students(
      target_class.id,
      batch->>'fileName',
      extract(year from target_year.start_date)::integer -
        case target_class.grade
          when 'X' then 0
          when 'XI' then 1
          when 'XII' then 2
          else 0
        end,
      batch->'rows',
      gen_random_uuid()
    )
    into import_result;

    total_created := total_created + coalesce((import_result->>'created')::integer, 0);
    results := results || jsonb_build_array(jsonb_build_object(
      'academic_year_id', target_year.id,
      'academic_year_name', target_year.name,
      'class_id', target_class.id,
      'grade', target_class.grade,
      'class_number', target_class.class_number,
      'file_name', batch->>'fileName',
      'created', coalesce((import_result->>'created')::integer, 0)
    ));
  end loop;

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
    'OPERATIONAL',
    actor.id,
    actor.full_name,
    'STUDENT_IMPORT_BULK',
    'import_bulk',
    p_request_id::text,
    jsonb_build_object(
      'batch_count', batch_count,
      'row_count', total_rows,
      'created', total_created,
      'results', results
    ),
    p_request_id
  );

  return jsonb_build_object(
    'batch_count', batch_count,
    'row_count', total_rows,
    'created', total_created,
    'results', results
  );
end;
$$;

revoke all on function public.phase13_import_students_bulk(jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.phase13_import_students_bulk(jsonb, uuid)
  to authenticated;

create or replace function public.phase13_get_class_dashboard(
  p_class_id uuid,
  p_selected_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_class public.classes%rowtype;
  target_year public.academic_years%rowtype;
  total_students jsonb;
  izin_students jsonb;
  sakit_students jsonb;
  tanpa_keterangan_students jsonb;
  monthly jsonb;
  month_start date := date_trunc('month', p_selected_date)::date;
  month_end date :=
    (date_trunc('month', p_selected_date) + interval '1 month - 1 day')::date;
begin
  if not private.can_access_operational() then
    raise exception using errcode = '42501', message = 'CLASS_DASHBOARD_FORBIDDEN';
  end if;

  select * into target_class
  from public.classes
  where id = p_class_id;

  if target_class.id is null then
    raise exception using errcode = 'P0002', message = 'CLASS_NOT_FOUND';
  end if;

  select * into target_year
  from public.academic_years
  where id = target_class.academic_year_id;

  if target_year.id is null
    or p_selected_date not between target_year.start_date and target_year.end_date
  then
    raise exception using errcode = '23514', message = 'DATE_OUTSIDE_ACADEMIC_YEAR';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'student_id', grouped.student_id,
    'full_name', grouped.full_name
  ) order by grouped.full_name, grouped.student_id), '[]'::jsonb)
  into total_students
  from (
    select distinct s.id as student_id, s.full_name
    from public.attendance_records ar
    join public.students s on s.id = ar.student_id
    where ar.class_id = p_class_id
      and ar.attendance_date = p_selected_date
  ) grouped;

  select coalesce(jsonb_agg(jsonb_build_object(
    'student_id', grouped.student_id,
    'full_name', grouped.full_name,
    'periods', grouped.periods
  ) order by grouped.full_name, grouped.student_id), '[]'::jsonb)
  into izin_students
  from (
    select
      s.id as student_id,
      s.full_name,
      array_agg(distinct ar.period_number order by ar.period_number) as periods
    from public.attendance_records ar
    join public.students s on s.id = ar.student_id
    where ar.class_id = p_class_id
      and ar.attendance_date = p_selected_date
      and ar.status = 'IZIN'
    group by s.id, s.full_name
  ) grouped;

  select coalesce(jsonb_agg(jsonb_build_object(
    'student_id', grouped.student_id,
    'full_name', grouped.full_name,
    'periods', grouped.periods
  ) order by grouped.full_name, grouped.student_id), '[]'::jsonb)
  into sakit_students
  from (
    select
      s.id as student_id,
      s.full_name,
      array_agg(distinct ar.period_number order by ar.period_number) as periods
    from public.attendance_records ar
    join public.students s on s.id = ar.student_id
    where ar.class_id = p_class_id
      and ar.attendance_date = p_selected_date
      and ar.status = 'SAKIT'
    group by s.id, s.full_name
  ) grouped;

  select coalesce(jsonb_agg(jsonb_build_object(
    'student_id', grouped.student_id,
    'full_name', grouped.full_name,
    'periods', grouped.periods
  ) order by grouped.full_name, grouped.student_id), '[]'::jsonb)
  into tanpa_keterangan_students
  from (
    select
      s.id as student_id,
      s.full_name,
      array_agg(distinct ar.period_number order by ar.period_number) as periods
    from public.attendance_records ar
    join public.students s on s.id = ar.student_id
    where ar.class_id = p_class_id
      and ar.attendance_date = p_selected_date
      and ar.status = 'TANPA_KETERANGAN'
    group by s.id, s.full_name
  ) grouped;

  select coalesce(jsonb_agg(jsonb_build_object(
    'date', grouped.day,
    'label', (extract(day from grouped.day)::integer)::text,
    'izin', grouped.izin,
    'sakit', grouped.sakit,
    'tanpa_keterangan', grouped.tanpa_keterangan
  ) order by grouped.day), '[]'::jsonb)
  into monthly
  from (
    select
      days.day::date as day,
      count(distinct ar.student_id) filter (where ar.status = 'IZIN') as izin,
      count(distinct ar.student_id) filter (where ar.status = 'SAKIT') as sakit,
      count(distinct ar.student_id)
        filter (where ar.status = 'TANPA_KETERANGAN') as tanpa_keterangan
    from generate_series(month_start, month_end, interval '1 day') days(day)
    left join public.attendance_records ar
      on ar.class_id = p_class_id
      and ar.attendance_date = days.day::date
    group by days.day
  ) grouped;

  return jsonb_build_object(
    'class_id', target_class.id,
    'academic_year_id', target_year.id,
    'selected_date', p_selected_date,
    'total', total_students,
    'izin', izin_students,
    'sakit', sakit_students,
    'tanpa_keterangan', tanpa_keterangan_students,
    'monthly', monthly
  );
end;
$$;

revoke all on function public.phase13_get_class_dashboard(uuid, date)
  from public, anon;
grant execute on function public.phase13_get_class_dashboard(uuid, date)
  to authenticated;
