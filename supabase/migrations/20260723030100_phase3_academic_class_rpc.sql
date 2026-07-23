create function public.phase3_create_academic_year(
  p_name text,
  p_start_date date,
  p_end_date date,
  p_is_active boolean default false,
  p_request_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype := private.require_phase3_admin();
  previous_year public.academic_years%rowtype;
  created public.academic_years%rowtype;
begin
  if btrim(p_name) = '' or p_start_date >= p_end_date then
    raise exception using errcode = '22023', message = 'ACADEMIC_YEAR_INVALID';
  end if;
  if exists (select 1 from public.academic_years where lower(name) = lower(btrim(p_name))) then
    raise exception using errcode = '23505', message = 'ACADEMIC_YEAR_DUPLICATE';
  end if;

  if p_is_active then
    select * into previous_year
    from public.academic_years
    where is_active
    for update;

    if previous_year.id is not null and exists (
      select 1
      from public.students s
      join public.student_enrollments e on e.student_id = s.id and e.is_current
      where s.is_active and e.academic_year_id = previous_year.id
    ) then
      raise exception using errcode = '55000', message = 'ACADEMIC_YEAR_SWITCH_REQUIRES_PROMOTION';
    end if;

    update public.academic_years set is_active = false where is_active;
  end if;

  insert into public.academic_years (name, start_date, end_date, is_active)
  values (btrim(p_name), p_start_date, p_end_date, p_is_active)
  returning * into created;

  insert into public.classes (academic_year_id, grade, class_number, is_active)
  select created.id, slot.grade, class_number, true
  from (values ('X'::public.grade_level), ('XI'::public.grade_level), ('XII'::public.grade_level)) slot(grade)
  cross join generate_series(1, 10) class_number;

  insert into public.audit_logs (
    scope, actor_id, actor_name_snapshot, action, entity_type, entity_id,
    before_data, after_data, metadata, request_id
  ) values (
    'OPERATIONAL', actor.id, actor.full_name, 'ACADEMIC_YEAR_CREATE', 'academic_year', created.id::text,
    null,
    jsonb_build_object(
      'id', created.id, 'name', created.name, 'start_date', created.start_date,
      'end_date', created.end_date, 'is_active', created.is_active
    ),
    jsonb_build_object('class_slots_created', 30, 'previous_active_year_id', previous_year.id),
    p_request_id
  );

  return jsonb_build_object(
    'id', created.id, 'name', created.name, 'start_date', created.start_date,
    'end_date', created.end_date, 'is_active', created.is_active
  );
end;
$$;

create function public.phase3_update_academic_year(
  p_id uuid,
  p_name text,
  p_start_date date,
  p_end_date date,
  p_request_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype := private.require_phase3_admin();
  target public.academic_years%rowtype;
  updated public.academic_years%rowtype;
begin
  select * into target from public.academic_years where id = p_id for update;
  if target.id is null then
    raise exception using errcode = 'P0002', message = 'ACADEMIC_YEAR_NOT_FOUND';
  end if;
  if btrim(p_name) = '' or p_start_date >= p_end_date then
    raise exception using errcode = '22023', message = 'ACADEMIC_YEAR_INVALID';
  end if;
  if exists (
    select 1 from public.academic_years
    where id <> p_id and lower(name) = lower(btrim(p_name))
  ) then
    raise exception using errcode = '23505', message = 'ACADEMIC_YEAR_DUPLICATE';
  end if;

  update public.academic_years
  set name = btrim(p_name), start_date = p_start_date, end_date = p_end_date
  where id = p_id
  returning * into updated;

  insert into public.audit_logs (
    scope, actor_id, actor_name_snapshot, action, entity_type, entity_id,
    before_data, after_data, request_id
  ) values (
    'OPERATIONAL', actor.id, actor.full_name, 'ACADEMIC_YEAR_UPDATE', 'academic_year', updated.id::text,
    jsonb_build_object('name', target.name, 'start_date', target.start_date, 'end_date', target.end_date),
    jsonb_build_object('name', updated.name, 'start_date', updated.start_date, 'end_date', updated.end_date),
    p_request_id
  );

  return jsonb_build_object(
    'id', updated.id, 'name', updated.name, 'start_date', updated.start_date,
    'end_date', updated.end_date, 'is_active', updated.is_active
  );
end;
$$;

create function public.phase3_activate_academic_year(
  p_id uuid,
  p_request_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype := private.require_phase3_admin();
  target public.academic_years%rowtype;
  previous_year public.academic_years%rowtype;
begin
  select * into target from public.academic_years where id = p_id for update;
  if target.id is null then
    raise exception using errcode = 'P0002', message = 'ACADEMIC_YEAR_NOT_FOUND';
  end if;
  if target.is_active then
    return jsonb_build_object('id', target.id, 'is_active', true);
  end if;

  select * into previous_year
  from public.academic_years
  where is_active
  for update;

  if previous_year.id is not null and exists (
    select 1
    from public.students s
    join public.student_enrollments e on e.student_id = s.id and e.is_current
    where s.is_active and e.academic_year_id = previous_year.id
  ) then
    raise exception using errcode = '55000', message = 'ACADEMIC_YEAR_SWITCH_REQUIRES_PROMOTION';
  end if;

  update public.academic_years set is_active = false where is_active;
  update public.academic_years set is_active = true where id = target.id;

  insert into public.audit_logs (
    scope, actor_id, actor_name_snapshot, action, entity_type, entity_id,
    before_data, after_data, metadata, request_id
  ) values (
    'OPERATIONAL', actor.id, actor.full_name, 'ACADEMIC_YEAR_ACTIVATE', 'academic_year', target.id::text,
    jsonb_build_object('is_active', false), jsonb_build_object('is_active', true),
    jsonb_build_object('previous_active_year_id', previous_year.id), p_request_id
  );

  return jsonb_build_object('id', target.id, 'is_active', true);
end;
$$;

create function public.phase3_update_class(
  p_id uuid,
  p_homeroom_teacher text,
  p_notes text,
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
  target public.classes%rowtype;
  updated public.classes%rowtype;
  action_name text;
begin
  select * into target from public.classes where id = p_id for update;
  if target.id is null then
    raise exception using errcode = 'P0002', message = 'CLASS_NOT_FOUND';
  end if;

  if target.is_active and not p_is_active and exists (
    select 1
    from public.student_enrollments e
    where e.is_current and e.class_id = target.id
  ) then
    raise exception using errcode = '55000', message = 'CLASS_HAS_ACTIVE_STUDENTS';
  end if;

  action_name := case
    when not target.is_active and p_is_active then 'CLASS_ACTIVATE'
    when target.is_active and not p_is_active then 'CLASS_DEACTIVATE'
    else 'CLASS_UPDATE'
  end;

  update public.classes
  set homeroom_teacher = nullif(btrim(p_homeroom_teacher), ''),
      notes = nullif(btrim(p_notes), ''),
      is_active = p_is_active
  where id = p_id
  returning * into updated;

  insert into public.audit_logs (
    scope, actor_id, actor_name_snapshot, action, entity_type, entity_id,
    before_data, after_data, request_id
  ) values (
    'OPERATIONAL', actor.id, actor.full_name, action_name, 'class', updated.id::text,
    jsonb_build_object(
      'homeroom_teacher', target.homeroom_teacher, 'notes', target.notes,
      'is_active', target.is_active
    ),
    jsonb_build_object(
      'homeroom_teacher', updated.homeroom_teacher, 'notes', updated.notes,
      'is_active', updated.is_active
    ),
    p_request_id
  );

  return jsonb_build_object(
    'id', updated.id, 'academic_year_id', updated.academic_year_id,
    'grade', updated.grade, 'class_number', updated.class_number,
    'homeroom_teacher', updated.homeroom_teacher, 'notes', updated.notes,
    'is_active', updated.is_active
  );
end;
$$;

revoke all on function public.phase3_create_academic_year(text, date, date, boolean, uuid)
  from public, anon, authenticated;
revoke all on function public.phase3_update_academic_year(uuid, text, date, date, uuid)
  from public, anon, authenticated;
revoke all on function public.phase3_activate_academic_year(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.phase3_update_class(uuid, text, text, boolean, uuid)
  from public, anon, authenticated;

grant execute on function public.phase3_create_academic_year(text, date, date, boolean, uuid)
  to authenticated;
grant execute on function public.phase3_update_academic_year(uuid, text, date, date, uuid)
  to authenticated;
grant execute on function public.phase3_activate_academic_year(uuid, uuid)
  to authenticated;
grant execute on function public.phase3_update_class(uuid, text, text, boolean, uuid)
  to authenticated;
