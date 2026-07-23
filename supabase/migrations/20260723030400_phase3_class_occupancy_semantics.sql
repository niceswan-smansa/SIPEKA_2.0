create or replace function private.prevent_referenced_class_breakage()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.grade, new.academic_year_id) is distinct from (old.grade, old.academic_year_id)
    and (
      exists (select 1 from public.students as s where s.current_class_id = old.id)
      or exists (
        select 1 from public.student_enrollments as e
        where e.class_id = old.id and e.is_current
      )
    )
  then
    raise exception using errcode = '23514', message = 'Kelas yang masih digunakan tidak dapat dipindahkan.';
  end if;

  if old.is_active and not new.is_active
    and exists (
      select 1
      from public.student_enrollments e
      join public.students s on s.id = e.student_id
      where e.class_id = old.id
        and e.is_current
        and s.is_active
    )
  then
    raise exception using errcode = '23514', message = 'Kelas dengan siswa aktif tidak dapat dinonaktifkan.';
  end if;

  return new;
end;
$$;

create or replace function public.phase3_update_class(
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
    join public.students s on s.id = e.student_id
    where e.is_current
      and e.class_id = target.id
      and s.is_active
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

revoke all on function public.phase3_update_class(uuid, text, text, boolean, uuid)
  from public, anon, authenticated;
grant execute on function public.phase3_update_class(uuid, text, text, boolean, uuid)
  to authenticated;
