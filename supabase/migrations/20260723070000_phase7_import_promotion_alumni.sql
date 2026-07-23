create function public.phase7_import_students(
  p_class_id uuid,
  p_file_name text,
  p_year_entered integer,
  p_rows jsonb,
  p_request_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype := private.require_phase3_admin();
  target_class public.classes%rowtype;
  target_year public.academic_years%rowtype;
  batch public.import_batches%rowtype;
  row_data jsonb;
  row_count integer;
  created_count integer := 0;
  student_id uuid;
  normalized_name text;
  normalized_nis text;
  normalized_nisn text;
  row_gender public.gender;
begin
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception using errcode = '22023', message = 'IMPORT_ROWS_INVALID';
  end if;
  row_count := jsonb_array_length(p_rows);
  if row_count < 1 or row_count > 500 then
    raise exception using errcode = '22023', message = 'IMPORT_ROW_LIMIT';
  end if;
  if btrim(coalesce(p_file_name, '')) = '' or length(p_file_name) > 160 then
    raise exception using errcode = '22023', message = 'IMPORT_FILE_NAME_INVALID';
  end if;

  select * into target_class from public.classes where id = p_class_id for share;
  select * into target_year
  from public.academic_years
  where id = target_class.academic_year_id and is_active
  for share;
  if target_class.id is null or not target_class.is_active or target_year.id is null then
    raise exception using errcode = '23514', message = 'IMPORT_CLASS_INVALID';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_rows) r
    group by btrim(r->>'nis')
    having count(*) > 1
  ) then
    raise exception using errcode = '23505', message = 'IMPORT_DUPLICATE_NIS_FILE';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_rows) r
    group by btrim(r->>'nisn')
    having count(*) > 1
  ) then
    raise exception using errcode = '23505', message = 'IMPORT_DUPLICATE_NISN_FILE';
  end if;

  for row_data in select value from jsonb_array_elements(p_rows)
  loop
    normalized_name := regexp_replace(btrim(coalesce(row_data->>'name', '')), '\s+', ' ', 'g');
    normalized_nis := btrim(coalesce(row_data->>'nis', ''));
    normalized_nisn := btrim(coalesce(row_data->>'nisn', ''));
    if normalized_name = '' or normalized_nis = '' or normalized_nisn = ''
      or coalesce(row_data->>'gender', '') not in ('L', 'P')
      or left(normalized_name, 1) in ('=', '+', '-', '@')
      or left(normalized_nis, 1) in ('=', '+', '-', '@')
      or left(normalized_nisn, 1) in ('=', '+', '-', '@')
    then
      raise exception using errcode = '22023', message = 'IMPORT_ROW_INVALID';
    end if;
    if exists (select 1 from public.students where nis = normalized_nis) then
      raise exception using errcode = '23505', message = 'DUPLICATE_NIS';
    end if;
    if exists (select 1 from public.students where nisn = normalized_nisn) then
      raise exception using errcode = '23505', message = 'DUPLICATE_NISN';
    end if;
  end loop;

  insert into public.import_batches (
    class_id, file_name, row_count, summary, status, created_by
  ) values (
    target_class.id, btrim(p_file_name), row_count,
    jsonb_build_object('valid', row_count, 'invalid', 0), 'COMPLETED', actor.id
  ) returning * into batch;

  for row_data in select value from jsonb_array_elements(p_rows)
  loop
    normalized_name := regexp_replace(btrim(row_data->>'name'), '\s+', ' ', 'g');
    normalized_nis := btrim(row_data->>'nis');
    normalized_nisn := btrim(row_data->>'nisn');
    row_gender := (row_data->>'gender')::public.gender;
    insert into public.students (
      nis, nisn, full_name, normalized_name, gender, current_grade, current_class_id,
      year_entered, is_active, created_by, updated_by
    ) values (
      normalized_nis, normalized_nisn, normalized_name, lower(normalized_name), row_gender,
      target_class.grade, target_class.id, p_year_entered, true, actor.id, actor.id
    ) returning id into student_id;
    insert into public.student_enrollments (
      student_id, academic_year_id, class_id, grade, started_on, is_current, created_by
    ) values (
      student_id, target_year.id, target_class.id, target_class.grade,
      target_year.start_date, true, actor.id
    );
    created_count := created_count + 1;
  end loop;

  insert into public.audit_logs (
    scope, actor_id, actor_name_snapshot, action, entity_type, entity_id, metadata, request_id
  ) values (
    'OPERATIONAL', actor.id, actor.full_name, 'STUDENT_IMPORT', 'import_batch', batch.id::text,
    jsonb_build_object('class_id', target_class.id, 'row_count', created_count), p_request_id
  );
  return jsonb_build_object('batch_id', batch.id, 'created', created_count);
end;
$$;

create function public.phase7_promote_academic_year(
  p_to_academic_year_id uuid,
  p_request_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype := private.require_phase3_admin();
  from_year public.academic_years%rowtype;
  to_year public.academic_years%rowtype;
  batch public.promotion_batches%rowtype;
  item record;
  destination_class public.classes%rowtype;
  after_grade public.grade_level;
  after_enrollment_id uuid;
  promoted_count integer := 0;
begin
  select * into from_year from public.academic_years where is_active for update;
  select * into to_year
  from public.academic_years
  where id = p_to_academic_year_id
  for update;
  if from_year.id is null or to_year.id is null or from_year.id = to_year.id then
    raise exception using errcode = '22023', message = 'PROMOTION_YEAR_INVALID';
  end if;

  insert into public.promotion_batches (
    from_academic_year_id, to_academic_year_id, status, created_by
  ) values (from_year.id, to_year.id, 'COMPLETED', actor.id)
  returning * into batch;

  for item in
    select s.*, e.id as enrollment_id, e.started_on, c.class_number
    from public.students s
    join public.student_enrollments e on e.student_id = s.id and e.is_current
    join public.classes c on c.id = e.class_id
    where s.is_active and e.academic_year_id = from_year.id
    order by s.id
    for update of s, e
  loop
    after_grade := case item.current_grade
      when 'X' then 'XI'::public.grade_level
      when 'XI' then 'XII'::public.grade_level
      else 'ALUMNI'::public.grade_level
    end;
    destination_class := null;
    after_enrollment_id := null;
    if after_grade <> 'ALUMNI' then
      select * into destination_class
      from public.classes
      where academic_year_id = to_year.id
        and grade = after_grade
        and class_number = item.class_number
        and is_active
      for share;
      if destination_class.id is null then
        raise exception using errcode = '23514', message = 'PROMOTION_TARGET_CLASS_MISSING';
      end if;
    end if;

    update public.student_enrollments
    set is_current = false, ended_on = greatest(started_on, to_year.start_date - 1)
    where id = item.enrollment_id;

    if after_grade <> 'ALUMNI' then
      insert into public.student_enrollments (
        student_id, academic_year_id, class_id, grade, started_on, is_current, created_by
      ) values (
        item.id, to_year.id, destination_class.id, after_grade, to_year.start_date, true, actor.id
      ) returning id into after_enrollment_id;
    end if;

    update public.students
    set current_grade = after_grade,
        current_class_id = destination_class.id,
        graduation_year = case when after_grade = 'ALUMNI' then
          extract(year from to_year.start_date)::integer else null end,
        updated_by = actor.id
    where id = item.id;

    insert into public.promotion_batch_items (
      batch_id, student_id, before_grade, before_class_id, before_enrollment_id,
      after_grade, after_class_id, after_enrollment_id
    ) values (
      batch.id, item.id, item.current_grade, item.current_class_id, item.enrollment_id,
      after_grade, destination_class.id, after_enrollment_id
    );
    promoted_count := promoted_count + 1;
  end loop;

  update public.academic_years set is_active = false where id = from_year.id;
  update public.academic_years set is_active = true where id = to_year.id;
  insert into public.audit_logs (
    scope, actor_id, actor_name_snapshot, action, entity_type, entity_id, metadata, request_id
  ) values (
    'OPERATIONAL', actor.id, actor.full_name, 'STUDENT_PROMOTION_APPLY',
    'promotion_batch', batch.id::text,
    jsonb_build_object('from_year_id', from_year.id, 'to_year_id', to_year.id, 'student_count', promoted_count),
    p_request_id
  );
  return jsonb_build_object('batch_id', batch.id, 'promoted', promoted_count);
end;
$$;

create function public.phase7_rollback_promotion(
  p_batch_id uuid,
  p_request_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype := private.require_phase3_admin();
  batch public.promotion_batches%rowtype;
  item record;
  current_enrollment_id uuid;
  restored_count integer := 0;
begin
  select * into batch from public.promotion_batches where id = p_batch_id for update;
  if batch.id is null or batch.status <> 'COMPLETED' then
    raise exception using errcode = '55000', message = 'PROMOTION_ROLLBACK_UNAVAILABLE';
  end if;
  if not exists (
    select 1 from public.academic_years where id = batch.to_academic_year_id and is_active
  ) then
    raise exception using errcode = '55000', message = 'PROMOTION_ROLLBACK_STALE';
  end if;

  for item in
    select i.*, s.current_grade, s.current_class_id
    from public.promotion_batch_items i
    join public.students s on s.id = i.student_id
    where i.batch_id = batch.id
    order by i.student_id
    for update of s
  loop
    select id into current_enrollment_id
    from public.student_enrollments
    where student_id = item.student_id and is_current
    for update;
    if item.current_grade <> item.after_grade
      or item.current_class_id is distinct from item.after_class_id
      or current_enrollment_id is distinct from item.after_enrollment_id
    then
      raise exception using errcode = '55000', message = 'PROMOTION_ROLLBACK_STALE';
    end if;
    if item.after_enrollment_id is not null then
      update public.student_enrollments
      set is_current = false, ended_on = greatest(started_on, current_date)
      where id = item.after_enrollment_id;
    end if;
    update public.student_enrollments
    set is_current = true, ended_on = null
    where id = item.before_enrollment_id;
    update public.students
    set current_grade = item.before_grade,
        current_class_id = item.before_class_id,
        graduation_year = null,
        updated_by = actor.id
    where id = item.student_id;
    restored_count := restored_count + 1;
  end loop;

  update public.academic_years set is_active = false where id = batch.to_academic_year_id;
  update public.academic_years set is_active = true where id = batch.from_academic_year_id;
  update public.promotion_batches
  set status = 'REVERTED', reverted_by = actor.id, reverted_at = now()
  where id = batch.id;
  insert into public.audit_logs (
    scope, actor_id, actor_name_snapshot, action, entity_type, entity_id, metadata, request_id
  ) values (
    'OPERATIONAL', actor.id, actor.full_name, 'STUDENT_PROMOTION_ROLLBACK',
    'promotion_batch', batch.id::text,
    jsonb_build_object('student_count', restored_count), p_request_id
  );
  return jsonb_build_object('batch_id', batch.id, 'restored', restored_count);
end;
$$;

create function public.phase7_archive_alumni(
  p_student_id uuid,
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
begin
  select * into target from public.students where id = p_student_id for update;
  if target.id is null or target.current_grade <> 'ALUMNI' then
    raise exception using errcode = '22023', message = 'ALUMNI_INVALID';
  end if;
  update public.students
  set is_active = false, archived_at = coalesce(archived_at, now()), updated_by = actor.id
  where id = target.id;
  insert into public.audit_logs (
    scope, actor_id, actor_name_snapshot, action, entity_type, entity_id, before_data, after_data, request_id
  ) values (
    'OPERATIONAL', actor.id, actor.full_name, 'ALUMNI_ARCHIVE', 'student', target.id::text,
    jsonb_build_object('is_active', target.is_active, 'archived_at', target.archived_at),
    jsonb_build_object('is_active', false, 'archived_at', coalesce(target.archived_at, now())),
    p_request_id
  );
  return jsonb_build_object('id', target.id, 'archived', true);
end;
$$;

create function public.phase7_tombstone_alumni(
  p_student_id uuid,
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
  suffix text;
begin
  select * into target from public.students where id = p_student_id for update;
  if target.id is null or target.current_grade <> 'ALUMNI' or target.is_active then
    raise exception using errcode = '22023', message = 'ALUMNI_TOMBSTONE_INVALID';
  end if;
  suffix := replace(target.id::text, '-', '');
  update public.students
  set nis = 'deleted_' || suffix,
      nisn = 'deleted_' || suffix,
      full_name = 'Alumni dihapus',
      normalized_name = 'alumni dihapus',
      archived_at = coalesce(archived_at, now()),
      updated_by = actor.id
  where id = target.id;
  insert into public.audit_logs (
    scope, actor_id, actor_name_snapshot, action, entity_type, entity_id, before_data, after_data, request_id
  ) values (
    'OPERATIONAL', actor.id, actor.full_name, 'ALUMNI_TOMBSTONE', 'student', target.id::text,
    jsonb_build_object('full_name', target.full_name, 'nis', target.nis, 'nisn', target.nisn),
    jsonb_build_object('full_name', 'Alumni dihapus', 'tombstoned', true),
    p_request_id
  );
  return jsonb_build_object('id', target.id, 'tombstoned', true);
end;
$$;

revoke all on function public.phase7_import_students(uuid, text, integer, jsonb, uuid)
  from public, anon, authenticated;
revoke all on function public.phase7_promote_academic_year(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.phase7_rollback_promotion(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.phase7_archive_alumni(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.phase7_tombstone_alumni(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.phase7_import_students(uuid, text, integer, jsonb, uuid)
  to authenticated;
grant execute on function public.phase7_promote_academic_year(uuid, uuid)
  to authenticated;
grant execute on function public.phase7_rollback_promotion(uuid, uuid)
  to authenticated;
grant execute on function public.phase7_archive_alumni(uuid, uuid)
  to authenticated;
grant execute on function public.phase7_tombstone_alumni(uuid, uuid)
  to authenticated;
