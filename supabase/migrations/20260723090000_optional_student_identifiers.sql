alter table public.students
  drop constraint if exists students_nis_key,
  drop constraint if exists students_nisn_key,
  drop constraint if exists students_nis_not_blank,
  drop constraint if exists students_nisn_not_blank,
  drop constraint if exists students_nis_trimmed,
  drop constraint if exists students_nisn_trimmed,
  alter column nis drop not null,
  alter column nisn drop not null;

drop index if exists public.students_nis_idx;
drop index if exists public.students_nisn_idx;

alter table public.students
  add constraint students_nis_format
    check (nis is null or (nis = btrim(nis) and nis ~ '^[0-9]+$')),
  add constraint students_nisn_format
    check (nisn is null or (nisn = btrim(nisn) and nisn ~ '^[0-9]{10}$'));

create unique index students_nis_unique_not_null_idx
  on public.students (nis) where nis is not null;
create unique index students_nisn_unique_not_null_idx
  on public.students (nisn) where nisn is not null;

create or replace function public.phase3_create_student(
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
  normalized_nis text := nullif(btrim(p_nis), '');
  normalized_nisn text := nullif(btrim(p_nisn), '');
begin
  if normalized_full_name = '' then
    raise exception using errcode = '22023', message = 'STUDENT_VALIDATION_ERROR';
  end if;
  if normalized_nis is not null and normalized_nis !~ '^[0-9]+$' then
    raise exception using errcode = '22023', message = 'NIS_FORMAT_INVALID';
  end if;
  if normalized_nisn is not null and normalized_nisn !~ '^[0-9]{10}$' then
    raise exception using errcode = '22023', message = 'NISN_FORMAT_INVALID';
  end if;
  if p_grade = 'ALUMNI' then
    raise exception using errcode = '22023', message = 'STUDENT_ALUMNI_NOT_ALLOWED';
  end if;
  if normalized_nis is not null and exists (
    select 1 from public.students where nis = normalized_nis
  ) then
    raise exception using errcode = '23505', message = 'DUPLICATE_NIS';
  end if;
  if normalized_nisn is not null and exists (
    select 1 from public.students where nisn = normalized_nisn
  ) then
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
    if exists (select 1 from public.students where nis = normalized_nis) then
      raise exception using errcode = '23505', message = 'DUPLICATE_NIS';
    end if;
    if exists (select 1 from public.students where nisn = normalized_nisn) then
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
  return to_jsonb(created);
end;
$$;

create or replace function public.phase3_update_student_identity(
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
  normalized_nis text := nullif(btrim(p_nis), '');
  normalized_nisn text := nullif(btrim(p_nisn), '');
begin
  select * into target from public.students where id = p_id for update;
  if target.id is null then
    raise exception using errcode = 'P0002', message = 'STUDENT_NOT_FOUND';
  end if;
  if normalized_full_name = '' then
    raise exception using errcode = '22023', message = 'STUDENT_VALIDATION_ERROR';
  end if;
  if normalized_nis is not null and normalized_nis !~ '^[0-9]+$' then
    raise exception using errcode = '22023', message = 'NIS_FORMAT_INVALID';
  end if;
  if normalized_nisn is not null and normalized_nisn !~ '^[0-9]{10}$' then
    raise exception using errcode = '22023', message = 'NISN_FORMAT_INVALID';
  end if;
  if normalized_nis is not null and exists (
    select 1 from public.students where id <> p_id and nis = normalized_nis
  ) then
    raise exception using errcode = '23505', message = 'DUPLICATE_NIS';
  end if;
  if normalized_nisn is not null and exists (
    select 1 from public.students where id <> p_id and nisn = normalized_nisn
  ) then
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
  return to_jsonb(updated);
end;
$$;

create or replace function public.phase3_search_students(
  p_search text default null,
  p_grade public.grade_level default null,
  p_class_id uuid default null,
  p_is_active boolean default null,
  p_year_entered integer default null,
  p_page integer default 1,
  p_page_size integer default 20
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  normalized_search text := lower(regexp_replace(btrim(coalesce(p_search, '')), '\s+', ' ', 'g'));
  result jsonb;
begin
  if p_page < 1 or p_page_size < 1 or p_page_size > 50 then
    raise exception using errcode = '22023', message = 'PAGINATION_INVALID';
  end if;
  with filtered as (
    select
      s.id, s.nis, s.nisn, s.full_name, s.gender, s.current_grade,
      s.current_class_id, s.year_entered, s.graduation_year, s.is_active,
      c.class_number, c.homeroom_teacher, c.academic_year_id
    from public.students s
    left join public.classes c on c.id = s.current_class_id
    where (
      normalized_search = ''
      or s.normalized_name ilike '%' || normalized_search || '%'
      or (s.nis is not null and s.nis ilike '%' || btrim(coalesce(p_search, '')) || '%')
      or (s.nisn is not null and s.nisn ilike '%' || btrim(coalesce(p_search, '')) || '%')
    )
      and (p_grade is null or s.current_grade = p_grade)
      and (p_class_id is null or s.current_class_id = p_class_id)
      and (p_is_active is null or s.is_active = p_is_active)
      and (p_year_entered is null or s.year_entered = p_year_entered)
  ), paged as (
    select * from filtered
    order by full_name asc, id asc
    offset (p_page - 1) * p_page_size
    limit p_page_size
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(to_jsonb(paged) order by full_name, id) from paged), '[]'::jsonb),
    'total', (select count(*) from filtered),
    'page', p_page,
    'page_size', p_page_size
  ) into result;
  return result;
end;
$$;

create or replace function public.phase7_import_students(
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
    select 1 from jsonb_array_elements(p_rows) r
    where nullif(btrim(r->>'nis'), '') is not null
    group by nullif(btrim(r->>'nis'), '')
    having count(*) > 1
  ) then
    raise exception using errcode = '23505', message = 'IMPORT_DUPLICATE_NIS_FILE';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_rows) r
    where nullif(btrim(r->>'nisn'), '') is not null
    group by nullif(btrim(r->>'nisn'), '')
    having count(*) > 1
  ) then
    raise exception using errcode = '23505', message = 'IMPORT_DUPLICATE_NISN_FILE';
  end if;

  for row_data in select value from jsonb_array_elements(p_rows)
  loop
    normalized_name := regexp_replace(btrim(coalesce(row_data->>'name', '')), '\s+', ' ', 'g');
    normalized_nis := nullif(btrim(row_data->>'nis'), '');
    normalized_nisn := nullif(btrim(row_data->>'nisn'), '');
    if normalized_name = ''
      or coalesce(row_data->>'gender', '') not in ('L', 'P')
      or left(normalized_name, 1) in ('=', '+', '-', '@')
      or (normalized_nis is not null and normalized_nis !~ '^[0-9]+$')
      or (normalized_nisn is not null and normalized_nisn !~ '^[0-9]{10}$')
    then
      raise exception using errcode = '22023', message = 'IMPORT_ROW_INVALID';
    end if;
    if normalized_nis is not null and exists (
      select 1 from public.students where nis = normalized_nis
    ) then
      raise exception using errcode = '23505', message = 'DUPLICATE_NIS';
    end if;
    if normalized_nisn is not null and exists (
      select 1 from public.students where nisn = normalized_nisn
    ) then
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
    normalized_nis := nullif(btrim(row_data->>'nis'), '');
    normalized_nisn := nullif(btrim(row_data->>'nisn'), '');
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

create or replace function public.phase7_tombstone_alumni(
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
  if target.id is null or target.current_grade <> 'ALUMNI' or target.is_active then
    raise exception using errcode = '22023', message = 'ALUMNI_TOMBSTONE_INVALID';
  end if;
  update public.students
  set nis = null,
      nisn = null,
      full_name = 'Alumni dihapus',
      normalized_name = 'alumni dihapus',
      archived_at = coalesce(archived_at, now()),
      updated_by = actor.id
  where id = target.id;
  insert into public.audit_logs (
    scope, actor_id, actor_name_snapshot, action, entity_type, entity_id,
    before_data, after_data, request_id
  ) values (
    'OPERATIONAL', actor.id, actor.full_name, 'ALUMNI_TOMBSTONE', 'student', target.id::text,
    jsonb_build_object('full_name', target.full_name, 'nis', target.nis, 'nisn', target.nisn),
    jsonb_build_object('full_name', 'Alumni dihapus', 'tombstoned', true),
    p_request_id
  );
  return jsonb_build_object('id', target.id, 'tombstoned', true);
end;
$$;

revoke all on function public.phase3_create_student(text, text, text, public.gender, public.grade_level, uuid, integer, boolean, uuid)
  from public, anon;
revoke all on function public.phase3_update_student_identity(uuid, text, text, text, public.gender, integer, uuid)
  from public, anon;
revoke all on function public.phase7_import_students(uuid, text, integer, jsonb, uuid)
  from public, anon;
revoke all on function public.phase7_tombstone_alumni(uuid, uuid)
  from public, anon;
grant execute on function public.phase3_create_student(text, text, text, public.gender, public.grade_level, uuid, integer, boolean, uuid)
  to authenticated;
grant execute on function public.phase3_update_student_identity(uuid, text, text, text, public.gender, integer, uuid)
  to authenticated;
grant execute on function public.phase7_import_students(uuid, text, integer, jsonb, uuid)
  to authenticated;
grant execute on function public.phase7_tombstone_alumni(uuid, uuid)
  to authenticated;

create function public.phase9_import_existing_students(
  p_rows jsonb,
  p_batch_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_year public.academic_years%rowtype;
  row_data jsonb;
  target_class public.classes%rowtype;
  student_id uuid;
  imported integer := 0;
  normalized_nis text;
  normalized_nisn text;
  normalized_name text;
begin
  if current_user not in ('service_role', 'postgres') then
    raise exception using errcode = '42501', message = 'MIGRATION_FORBIDDEN';
  end if;
  if jsonb_typeof(p_rows) <> 'array'
    or jsonb_array_length(p_rows) < 1
    or jsonb_array_length(p_rows) > 2000
    or btrim(coalesce(p_batch_key, '')) = ''
  then
    raise exception using errcode = '22023', message = 'MIGRATION_PAYLOAD_INVALID';
  end if;
  if exists (
    select 1 from public.audit_logs
    where action = 'STUDENT_MIGRATION'
      and metadata->>'batch_key' = p_batch_key
  ) then
    return jsonb_build_object('imported', 0, 'already_applied', true);
  end if;
  select * into target_year
  from public.academic_years
  where name = '2026/2027' and is_active
  for share;
  if target_year.id is null then
    raise exception using errcode = '23514', message = 'MIGRATION_YEAR_INVALID';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_rows) r
    where nullif(btrim(r->>'nis'), '') is not null
    group by nullif(btrim(r->>'nis'), '')
    having count(*) > 1
  ) then
    raise exception using errcode = '23505', message = 'MIGRATION_DUPLICATE_NIS';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_rows) r
    where nullif(btrim(r->>'nisn'), '') is not null
    group by nullif(btrim(r->>'nisn'), '')
    having count(*) > 1
  ) then
    raise exception using errcode = '23505', message = 'MIGRATION_DUPLICATE_NISN';
  end if;

  for row_data in select value from jsonb_array_elements(p_rows)
  loop
    normalized_name := regexp_replace(btrim(coalesce(row_data->>'name', '')), '\s+', ' ', 'g');
    normalized_nis := nullif(btrim(row_data->>'nis'), '');
    normalized_nisn := nullif(btrim(row_data->>'nisn'), '');
    if normalized_name = ''
      or coalesce(row_data->>'gender', '') not in ('L', 'P')
      or coalesce(row_data->>'grade', '') not in ('X', 'XI', 'XII')
      or coalesce((row_data->>'class_number')::integer, 0) not between 1 and 10
      or (normalized_nis is not null and normalized_nis !~ '^[0-9]+$')
      or (normalized_nisn is not null and normalized_nisn !~ '^[0-9]{10}$')
    then
      raise exception using errcode = '22023', message = 'MIGRATION_ROW_INVALID';
    end if;
    select * into target_class
    from public.classes
    where academic_year_id = target_year.id
      and grade = (row_data->>'grade')::public.grade_level
      and class_number = (row_data->>'class_number')::integer
      and is_active;
    if target_class.id is null then
      raise exception using errcode = '23514', message = 'MIGRATION_CLASS_INVALID';
    end if;
    insert into public.students (
      nis, nisn, full_name, normalized_name, gender, current_grade, current_class_id,
      year_entered, is_active
    ) values (
      normalized_nis, normalized_nisn, normalized_name, lower(normalized_name),
      (row_data->>'gender')::public.gender, target_class.grade, target_class.id, 2026, true
    ) returning id into student_id;
    insert into public.student_enrollments (
      student_id, academic_year_id, class_id, grade, started_on, is_current
    ) values (
      student_id, target_year.id, target_class.id, target_class.grade,
      target_year.start_date, true
    );
    imported := imported + 1;
  end loop;
  insert into public.audit_logs (
    scope, actor_name_snapshot, action, entity_type, metadata
  ) values (
    'OPERATIONAL', 'Local migration tool', 'STUDENT_MIGRATION', 'migration_batch',
    jsonb_build_object('batch_key', p_batch_key, 'row_count', imported)
  );
  return jsonb_build_object('imported', imported, 'already_applied', false);
end;
$$;

revoke all on function public.phase9_import_existing_students(jsonb, text)
  from public, anon, authenticated;
grant execute on function public.phase9_import_existing_students(jsonb, text)
  to service_role;
