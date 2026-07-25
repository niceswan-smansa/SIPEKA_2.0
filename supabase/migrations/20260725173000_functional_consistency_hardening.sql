-- Functional consistency hardening.
-- Tidak menghapus siswa, enrollment, presensi, revision, batch, atau audit.

insert into public.periods (number, label, is_active)
select n, 'Jam ' || n, true
from generate_series(1, 10) n
on conflict (number) do update
set label = excluded.label, is_active = true;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.students'::regclass
      and conname = 'students_year_entered_range'
  ) then
    alter table public.students
      add constraint students_year_entered_range
      check (year_entered is null or year_entered between 1900 and 2200)
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.attendance_records'::regclass
      and conname = 'attendance_records_note_length'
  ) then
    alter table public.attendance_records
      add constraint attendance_records_note_length
      check (note is null or char_length(note) <= 500)
      not valid;
  end if;
end;
$$;

create or replace function private.enforce_academic_year_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Defer invalid/null date pairs to the existing table constraints so
  -- their stable constraint names and error contracts remain unchanged.
  if new.start_date is null
    or new.end_date is null
    or new.start_date >= new.end_date
  then
    return new;
  end if;

  if exists (
    select 1
    from public.academic_years y
    where y.id <> new.id
      and daterange(y.start_date, y.end_date, '[]')
          && daterange(new.start_date, new.end_date, '[]')
  ) then
    raise exception using errcode = '23514', message = 'ACADEMIC_YEAR_OVERLAP';
  end if;

  if tg_op = 'UPDATE'
    and (old.start_date is distinct from new.start_date
      or old.end_date is distinct from new.end_date)
    and (
      exists (
        select 1
        from public.attendance_records ar
        join public.classes c on c.id = ar.class_id
        where c.academic_year_id = old.id
          and ar.attendance_date not between new.start_date and new.end_date
      )
      or exists (
        select 1
        from public.student_enrollments e
        where e.academic_year_id = old.id
          and (
            e.started_on < new.start_date
            or e.started_on > new.end_date
            or (e.ended_on is not null and e.ended_on > new.end_date)
          )
      )
    )
  then
    raise exception using errcode = '23514', message = 'ACADEMIC_YEAR_RANGE_CONFLICT';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_academic_year_integrity()
  from public, anon, authenticated;

drop trigger if exists academic_years_integrity_guard on public.academic_years;
create trigger academic_years_integrity_guard
before insert or update of start_date, end_date
on public.academic_years
for each row execute function private.enforce_academic_year_integrity();

create or replace function private.enforce_promotion_year_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_year public.academic_years%rowtype;
  destination_year public.academic_years%rowtype;
begin
  select * into source_year
  from public.academic_years where id = new.from_academic_year_id;
  select * into destination_year
  from public.academic_years where id = new.to_academic_year_id;

  if source_year.id is null
    or destination_year.id is null
    or destination_year.is_active
    or destination_year.start_date <= source_year.end_date
    or exists (
      select 1 from public.student_enrollments e
      where e.academic_year_id = destination_year.id and e.is_current
    )
  then
    raise exception using errcode = '23514', message = 'PROMOTION_YEAR_INVALID';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_promotion_year_integrity()
  from public, anon, authenticated;

drop trigger if exists promotion_batches_year_guard on public.promotion_batches;
create trigger promotion_batches_year_guard
before insert on public.promotion_batches
for each row execute function private.enforce_promotion_year_integrity();

create or replace function private.phase11_enrollment_on_date(
  p_student_id uuid,
  p_attendance_date date
)
returns public.student_enrollments
language sql
stable
security definer
set search_path = ''
as $$
  select e
  from public.student_enrollments e
  where e.student_id = p_student_id
    and e.started_on <= p_attendance_date
    and (e.ended_on is null or e.ended_on >= p_attendance_date)
  order by e.started_on desc, e.is_current desc, e.created_at desc, e.id desc
  limit 1;
$$;

create or replace function private.phase11_student_in_class_on_date(
  p_student_id uuid,
  p_class_id uuid,
  p_attendance_date date
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (private.phase11_enrollment_on_date(p_student_id, p_attendance_date)).class_id = p_class_id,
    false
  );
$$;

create or replace function private.phase11_attendance_snapshot(
  p_class_id uuid,
  p_attendance_date date
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select md5(jsonb_build_object(
    'attendance', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ar.id, 'student_id', ar.student_id, 'class_id', ar.class_id,
        'date', ar.attendance_date, 'period', ar.period_number,
        'status', ar.status, 'note', ar.note, 'version', ar.version,
        'updated_at', ar.updated_at
      ) order by ar.student_id, ar.period_number)
      from public.attendance_records ar
      where ar.class_id = p_class_id
        and ar.attendance_date = p_attendance_date
    ), '[]'::jsonb),
    'roster', coalesce((
      select jsonb_agg(jsonb_build_object(
        'student_id', s.id, 'student_active', s.is_active,
        'enrollment_id', selected_enrollment.id,
        'class_id', selected_enrollment.class_id,
        'academic_year_id', selected_enrollment.academic_year_id,
        'grade', selected_enrollment.grade,
        'started_on', selected_enrollment.started_on,
        'ended_on', selected_enrollment.ended_on,
        'is_current', selected_enrollment.is_current
      ) order by s.id)
      from public.students s
      cross join lateral private.phase11_enrollment_on_date(
        s.id, p_attendance_date
      ) selected_enrollment
      where selected_enrollment.class_id = p_class_id
        and (
          p_attendance_date < (now() at time zone 'Asia/Jakarta')::date
          or s.is_active
        )
    ), '[]'::jsonb)
  )::text);
$$;

revoke all on function private.phase11_enrollment_on_date(uuid, date)
  from public, anon, authenticated;
revoke all on function private.phase11_student_in_class_on_date(uuid, uuid, date)
  from public, anon, authenticated;
revoke all on function private.phase11_attendance_snapshot(uuid, date)
  from public, anon, authenticated;

create or replace function public.phase4_get_class_attendance(
  p_class_id uuid,
  p_attendance_date date,
  p_search text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_search text :=
    lower(regexp_replace(btrim(coalesce(p_search, '')), '\s+', ' ', 'g'));
  result jsonb;
begin
  if not private.can_access_operational() then
    raise exception using errcode = '42501', message = 'ATTENDANCE_FORBIDDEN';
  end if;
  if p_attendance_date > (now() at time zone 'Asia/Jakarta')::date then
    raise exception using errcode = '22023', message = 'FUTURE_DATE_NOT_ALLOWED';
  end if;
  if not exists (
    select 1
    from public.classes c
    join public.academic_years y on y.id = c.academic_year_id
    where c.id = p_class_id
      and p_attendance_date between y.start_date and y.end_date
  ) then
    raise exception using errcode = '23514', message = 'DATE_OUTSIDE_ACADEMIC_YEAR';
  end if;

  select jsonb_build_object(
    'class_id', p_class_id,
    'attendance_date', p_attendance_date,
    'items', coalesce(
      jsonb_agg(to_jsonb(roster) order by roster.full_name, roster.id),
      '[]'::jsonb
    )
  )
  into result
  from (
    select
      s.id, s.full_name, s.nis, s.nisn,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', ar.id, 'period_number', ar.period_number,
          'status', ar.status, 'note', ar.note, 'version', ar.version
        ) order by ar.period_number)
        from public.attendance_records ar
        where ar.student_id = s.id
          and ar.class_id = p_class_id
          and ar.attendance_date = p_attendance_date
      ), '[]'::jsonb) as attendance
    from public.students s
    cross join lateral private.phase11_enrollment_on_date(
      s.id, p_attendance_date
    ) selected_enrollment
    where selected_enrollment.class_id = p_class_id
      and (
        p_attendance_date < (now() at time zone 'Asia/Jakarta')::date
        or s.is_active
      )
      and (
        normalized_search = ''
        or s.normalized_name ilike '%' || normalized_search || '%'
        or coalesce(s.nis, '') ilike '%' || btrim(coalesce(p_search, '')) || '%'
        or coalesce(s.nisn, '') ilike '%' || btrim(coalesce(p_search, '')) || '%'
      )
  ) roster;

  return coalesce(result, jsonb_build_object(
    'class_id', p_class_id,
    'attendance_date', p_attendance_date,
    'items', '[]'::jsonb
  ));
end;
$$;

create or replace function public.phase4_preview_attendance(
  p_class_id uuid,
  p_attendance_date date,
  p_payload jsonb,
  p_request_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype := private.require_phase4_admin();
  target_class public.classes%rowtype;
  target_year public.academic_years%rowtype;
  token text := gen_random_uuid()::text;
  snapshot_hash text;
  diffs jsonb := '[]'::jsonb;
  item jsonb;
  existing public.attendance_records%rowtype;
  v_student_id uuid;
  v_period_number smallint;
  mode text;
  status_value text;
  note_value text;
  result text;
  new_count integer := 0;
  update_count integer := 0;
  delete_count integer := 0;
  unchanged_count integer := 0;
  invalid_count integer := 0;
begin
  if p_attendance_date > (now() at time zone 'Asia/Jakarta')::date then
    raise exception using errcode = '22023', message = 'FUTURE_DATE_NOT_ALLOWED';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'array' then
    raise exception using errcode = '22023', message = 'ATTENDANCE_PAYLOAD_INVALID';
  end if;
  if jsonb_array_length(p_payload) < 1 then
    raise exception using errcode = '22023', message = 'ATTENDANCE_NO_CHANGES';
  end if;
  if jsonb_array_length(p_payload) > 3000 then
    raise exception using errcode = '22023', message = 'ATTENDANCE_PAYLOAD_LIMIT';
  end if;
  if exists (
    select 1
    from generate_series(1, 10) expected(number)
    left join public.periods p
      on p.number = expected.number and p.is_active
    where p.number is null
  ) then
    raise exception using errcode = '23514',
      message = 'ATTENDANCE_PERIOD_CONFIGURATION_INVALID';
  end if;

  select * into target_class from public.classes where id = p_class_id;
  if target_class.id is null
    or (not target_class.is_active
      and p_attendance_date = (now() at time zone 'Asia/Jakarta')::date)
  then
    raise exception using errcode = '23514', message = 'CLASS_INACTIVE_OR_NOT_FOUND';
  end if;

  select * into target_year
  from public.academic_years where id = target_class.academic_year_id;
  if target_year.id is null
    or p_attendance_date not between target_year.start_date and target_year.end_date
  then
    raise exception using errcode = '23514', message = 'DATE_OUTSIDE_ACADEMIC_YEAR';
  end if;

  if exists (
    select 1 from (
      select (value->>'student_id') || ':' || (value->>'period_number') k, count(*)
      from jsonb_array_elements(p_payload)
      group by 1 having count(*) > 1
    ) duplicate_keys
  ) then
    raise exception using errcode = '22023', message = 'ATTENDANCE_DUPLICATE_OPERATION';
  end if;

  for item in select value from jsonb_array_elements(p_payload)
  loop
    existing := null;
    begin
      v_student_id := (item->>'student_id')::uuid;
      v_period_number := (item->>'period_number')::smallint;
    exception when others then
      invalid_count := invalid_count + 1;
      diffs := diffs || jsonb_build_array(jsonb_build_object(
        'result', 'INVALID', 'reason', 'IDENTIFIER_INVALID'
      ));
      continue;
    end;

    mode := coalesce(item->>'mode', 'upsert');
    status_value := item->>'status';
    note_value := nullif(btrim(coalesce(item->>'note', '')), '');

    if v_period_number not between 1 and 10
      or mode not in ('upsert', 'delete')
      or (mode = 'upsert'
        and status_value not in ('IZIN', 'SAKIT', 'TANPA_KETERANGAN'))
      or char_length(coalesce(note_value, '')) > 500
      or not private.phase11_student_in_class_on_date(
        v_student_id, p_class_id, p_attendance_date
      )
      or (
        p_attendance_date = (now() at time zone 'Asia/Jakarta')::date
        and not exists (
          select 1 from public.students s
          where s.id = v_student_id and s.is_active
        )
      )
    then
      invalid_count := invalid_count + 1;
      diffs := diffs || jsonb_build_array(jsonb_build_object(
        'student_id', v_student_id, 'period_number', v_period_number,
        'result', 'INVALID', 'reason', 'ATTENDANCE_ITEM_INVALID'
      ));
      continue;
    end if;

    select * into existing
    from public.attendance_records ar
    where ar.student_id = v_student_id
      and ar.attendance_date = p_attendance_date
      and ar.period_number = v_period_number;

    if existing.id is not null and existing.class_id <> p_class_id then
      invalid_count := invalid_count + 1;
      diffs := diffs || jsonb_build_array(jsonb_build_object(
        'student_id', v_student_id, 'period_number', v_period_number,
        'result', 'INVALID', 'reason', 'ATTENDANCE_CLASS_CONFLICT'
      ));
      continue;
    end if;

    if mode = 'delete' then
      if existing.id is null then
        result := 'UNCHANGED'; unchanged_count := unchanged_count + 1;
      else
        result := 'DELETE'; delete_count := delete_count + 1;
      end if;
    elsif existing.id is null then
      result := 'NEW'; new_count := new_count + 1;
    elsif existing.status::text = status_value
      and coalesce(existing.note, '') = coalesce(note_value, '')
    then
      result := 'UNCHANGED'; unchanged_count := unchanged_count + 1;
    else
      result := 'UPDATE'; update_count := update_count + 1;
    end if;

    diffs := diffs || jsonb_build_array(jsonb_build_object(
      'student_id', v_student_id,
      'period_number', v_period_number,
      'result', result,
      'before', case when existing.id is null then null else jsonb_build_object(
        'id', existing.id, 'class_id', existing.class_id,
        'status', existing.status, 'note', existing.note, 'version', existing.version
      ) end,
      'after', case when mode = 'delete' then null else jsonb_build_object(
        'status', status_value, 'note', note_value
      ) end
    ));
  end loop;

  snapshot_hash := private.phase11_attendance_snapshot(
    p_class_id, p_attendance_date
  );

  insert into public.attendance_preview_tokens (
    token_hash, actor_id, class_id, attendance_date,
    payload_hash, snapshot_hash, expires_at
  ) values (
    md5(token), actor.id, p_class_id, p_attendance_date,
    md5(p_payload::text), snapshot_hash, now() + interval '10 minutes'
  );

  return jsonb_build_object(
    'token', token, 'request_id', p_request_id,
    'expires_at', now() + interval '10 minutes',
    'diff', diffs,
    'summary', jsonb_build_object(
      'new', new_count, 'update', update_count, 'delete', delete_count,
      'unchanged', unchanged_count, 'invalid', invalid_count, 'stale', 0
    )
  );
end;
$$;

create or replace function public.phase4_apply_attendance(
  p_token text,
  p_class_id uuid,
  p_attendance_date date,
  p_payload jsonb,
  p_request_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype := private.require_phase4_admin();
  preview public.attendance_preview_tokens%rowtype;
  target_class public.classes%rowtype;
  target_year public.academic_years%rowtype;
  current_snapshot_hash text;
  item jsonb;
  existing public.attendance_records%rowtype;
  created_record public.attendance_records%rowtype;
  v_student_id uuid;
  v_period_number smallint;
  mode text;
  status_text text;
  status_value public.attendance_status;
  note_value text;
  batch_id uuid;
  new_count integer := 0;
  update_count integer := 0;
  delete_count integer := 0;
  unchanged_count integer := 0;
begin
  if p_payload is null
    or jsonb_typeof(p_payload) <> 'array'
    or jsonb_array_length(p_payload) < 1
    or jsonb_array_length(p_payload) > 3000
  then
    raise exception using errcode = '22023', message = 'ATTENDANCE_PAYLOAD_INVALID';
  end if;

  if exists (
    select 1
    from generate_series(1, 10) expected(number)
    left join public.periods p
      on p.number = expected.number and p.is_active
    where p.number is null
  ) then
    raise exception using errcode = '23514',
      message = 'ATTENDANCE_PERIOD_CONFIGURATION_INVALID';
  end if;

  select * into preview
  from public.attendance_preview_tokens
  where token_hash = md5(p_token)
  for update;

  if preview.id is null
    or preview.actor_id <> actor.id
    or preview.class_id <> p_class_id
    or preview.attendance_date <> p_attendance_date
  then
    raise exception using errcode = '42501', message = 'ATTENDANCE_TOKEN_INVALID';
  end if;
  if preview.used_at is not null then
    raise exception using errcode = '55000', message = 'ATTENDANCE_TOKEN_USED';
  end if;
  if preview.expires_at < now() then
    raise exception using errcode = '55000', message = 'ATTENDANCE_TOKEN_EXPIRED';
  end if;
  if preview.payload_hash <> md5(p_payload::text) then
    raise exception using errcode = '42501', message = 'ATTENDANCE_TOKEN_INVALID';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(p_class_id::text || ':' || p_attendance_date::text)
  );

  select * into target_class
  from public.classes where id = p_class_id for share;
  select * into target_year
  from public.academic_years where id = target_class.academic_year_id for share;

  if target_class.id is null
    or target_year.id is null
    or p_attendance_date not between target_year.start_date and target_year.end_date
    or (not target_class.is_active
      and p_attendance_date = (now() at time zone 'Asia/Jakarta')::date)
  then
    raise exception using errcode = '23514', message = 'ATTENDANCE_SCOPE_INVALID';
  end if;

  current_snapshot_hash := private.phase11_attendance_snapshot(
    p_class_id, p_attendance_date
  );
  if current_snapshot_hash <> preview.snapshot_hash then
    raise exception using errcode = '40001', message = 'STALE_PREVIEW';
  end if;

  for item in select value from jsonb_array_elements(p_payload)
  loop
    existing := null;
    begin
      v_student_id := (item->>'student_id')::uuid;
      v_period_number := (item->>'period_number')::smallint;
    exception when others then
      raise exception using errcode = '22023', message = 'ATTENDANCE_PAYLOAD_INVALID';
    end;

    mode := coalesce(item->>'mode', 'upsert');
    status_text := item->>'status';
    note_value := nullif(btrim(coalesce(item->>'note', '')), '');

    if v_period_number not between 1 and 10
      or mode not in ('upsert', 'delete')
      or (mode = 'upsert'
        and status_text not in ('IZIN', 'SAKIT', 'TANPA_KETERANGAN'))
      or char_length(coalesce(note_value, '')) > 500
      or not private.phase11_student_in_class_on_date(
        v_student_id, p_class_id, p_attendance_date
      )
      or (
        p_attendance_date = (now() at time zone 'Asia/Jakarta')::date
        and not exists (
          select 1 from public.students s
          where s.id = v_student_id and s.is_active
        )
      )
    then
      raise exception using errcode = '23514', message = 'ATTENDANCE_ROSTER_CHANGED';
    end if;

    select * into existing
    from public.attendance_records ar
    where ar.student_id = v_student_id
      and ar.attendance_date = p_attendance_date
      and ar.period_number = v_period_number
    for update;

    if existing.id is not null and existing.class_id <> p_class_id then
      raise exception using errcode = '23505', message = 'ATTENDANCE_CLASS_CONFLICT';
    end if;

    if mode = 'delete' then
      if existing.id is not null then
        insert into public.attendance_revisions (
          attendance_id, student_id, operation,
          before_data, after_data, actor_id, request_id
        ) values (
          existing.id, existing.student_id, 'DELETE',
          to_jsonb(existing), null, actor.id, p_request_id
        );
        delete from public.attendance_records where id = existing.id;
        delete_count := delete_count + 1;
      else
        unchanged_count := unchanged_count + 1;
      end if;
    else
      status_value := status_text::public.attendance_status;
      if existing.id is null then
        insert into public.attendance_records (
          student_id, class_id, attendance_date, period_number,
          status, note, created_by, updated_by
        ) values (
          v_student_id, p_class_id, p_attendance_date, v_period_number,
          status_value, note_value, actor.id, actor.id
        ) returning * into created_record;

        insert into public.attendance_revisions (
          attendance_id, student_id, operation,
          before_data, after_data, actor_id, request_id
        ) values (
          created_record.id, v_student_id, 'CREATE',
          null, to_jsonb(created_record), actor.id, p_request_id
        );
        new_count := new_count + 1;
      elsif existing.status <> status_value
        or coalesce(existing.note, '') <> coalesce(note_value, '')
      then
        update public.attendance_records
        set status = status_value,
            note = note_value,
            version = existing.version + 1,
            updated_by = actor.id
        where id = existing.id
        returning * into created_record;

        insert into public.attendance_revisions (
          attendance_id, student_id, operation,
          before_data, after_data, actor_id, request_id
        ) values (
          existing.id, v_student_id, 'UPDATE',
          to_jsonb(existing), to_jsonb(created_record), actor.id, p_request_id
        );
        update_count := update_count + 1;
      else
        unchanged_count := unchanged_count + 1;
      end if;
    end if;
  end loop;

  insert into public.attendance_batches (
    request_id, attendance_date, class_id, status, summary, created_by
  ) values (
    p_request_id, p_attendance_date, p_class_id, 'COMPLETED',
    jsonb_build_object(
      'new', new_count, 'update', update_count,
      'delete', delete_count, 'unchanged', unchanged_count
    ),
    actor.id
  ) returning id into batch_id;

  insert into public.audit_logs (
    scope, actor_id, actor_name_snapshot, action,
    entity_type, entity_id, metadata, request_id
  ) values (
    'OPERATIONAL', actor.id, actor.full_name, 'ATTENDANCE_BATCH_APPLY',
    'attendance_batch', batch_id::text,
    jsonb_build_object(
      'class_id', p_class_id, 'attendance_date', p_attendance_date,
      'new', new_count, 'update', update_count,
      'delete', delete_count, 'unchanged', unchanged_count
    ),
    p_request_id
  );

  update public.attendance_preview_tokens
  set used_at = now()
  where id = preview.id;

  return jsonb_build_object(
    'batch_id', batch_id,
    'new', new_count, 'update', update_count,
    'delete', delete_count, 'unchanged', unchanged_count,
    'invalid', 0, 'stale', 0
  );
end;
$$;

create or replace function public.phase11_get_student_class_on_date(
  p_student_id uuid,
  p_attendance_date date
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  selected_enrollment public.student_enrollments%rowtype;
begin
  if not private.can_access_operational() then
    raise exception using errcode = '42501', message = 'STUDENT_ATTENDANCE_FORBIDDEN';
  end if;
  if not exists (select 1 from public.students where id = p_student_id) then
    raise exception using errcode = 'P0002', message = 'STUDENT_NOT_FOUND';
  end if;
  selected_enrollment := private.phase11_enrollment_on_date(
    p_student_id, p_attendance_date
  );
  return selected_enrollment.class_id;
end;
$$;

revoke all on function public.phase11_get_student_class_on_date(uuid, date)
  from public, anon;
grant execute on function public.phase11_get_student_class_on_date(uuid, date)
  to authenticated;

create or replace function public.phase5_get_dashboard(p_selected_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  summary jsonb;
  daily jsonb;
  weekly jsonb;
  monthly jsonb;
  week_start date :=
    p_selected_date - (extract(isodow from p_selected_date)::integer - 1);
  month_start date := date_trunc('month', p_selected_date)::date;
  month_end date :=
    (date_trunc('month', p_selected_date) + interval '1 month - 1 day')::date;
begin
  if not private.can_access_operational() then
    raise exception using errcode = '42501', message = 'DASHBOARD_FORBIDDEN';
  end if;

  select jsonb_build_object(
    'total', count(distinct ar.student_id),
    'izin', count(distinct ar.student_id) filter (where ar.status = 'IZIN'),
    'sakit', count(distinct ar.student_id) filter (where ar.status = 'SAKIT'),
    'tanpa_keterangan',
      count(distinct ar.student_id)
        filter (where ar.status = 'TANPA_KETERANGAN')
  ) into summary
  from public.attendance_records ar
  where ar.attendance_date = p_selected_date;

  select coalesce(jsonb_agg(jsonb_build_object(
    'class_id', grouped.id,
    'class_label', grouped.grade::text || '-' || grouped.class_number,
    'izin', grouped.izin,
    'sakit', grouped.sakit,
    'tanpa_keterangan', grouped.tanpa_keterangan
  ) order by
    array_position(array['X','XI','XII'], grouped.grade::text),
    grouped.class_number
  ), '[]'::jsonb)
  into daily
  from (
    select c.id, c.grade, c.class_number,
      count(distinct ar.student_id) filter (where ar.status = 'IZIN') izin,
      count(distinct ar.student_id) filter (where ar.status = 'SAKIT') sakit,
      count(distinct ar.student_id)
        filter (where ar.status = 'TANPA_KETERANGAN') tanpa_keterangan
    from public.classes c
    join public.academic_years y
      on y.id = c.academic_year_id
      and p_selected_date between y.start_date and y.end_date
    left join public.attendance_records ar
      on ar.class_id = c.id and ar.attendance_date = p_selected_date
    where c.is_active or not y.is_active
    group by c.id, c.grade, c.class_number
  ) grouped;

  select coalesce(jsonb_agg(jsonb_build_object(
    'date', grouped.day,
    'label', (array['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'])
      [extract(isodow from grouped.day)::integer],
    'izin', grouped.izin, 'sakit', grouped.sakit,
    'tanpa_keterangan', grouped.tanpa_keterangan
  ) order by grouped.day), '[]'::jsonb)
  into weekly
  from (
    select days.day,
      count(distinct ar.student_id) filter (where ar.status = 'IZIN') izin,
      count(distinct ar.student_id) filter (where ar.status = 'SAKIT') sakit,
      count(distinct ar.student_id)
        filter (where ar.status = 'TANPA_KETERANGAN') tanpa_keterangan
    from generate_series(week_start, week_start + 5, interval '1 day') days(day)
    left join public.attendance_records ar
      on ar.attendance_date = days.day::date
    group by days.day
  ) grouped;

  select coalesce(jsonb_agg(jsonb_build_object(
    'date', grouped.day,
    'day', extract(day from grouped.day)::integer,
    'total', grouped.total
  ) order by grouped.day), '[]'::jsonb)
  into monthly
  from (
    select days.day, count(distinct ar.student_id) total
    from generate_series(month_start, month_end, interval '1 day') days(day)
    left join public.attendance_records ar
      on ar.attendance_date = days.day::date
    group by days.day
  ) grouped;

  return jsonb_build_object(
    'selected_date', p_selected_date,
    'summary', summary, 'daily', daily,
    'weekly', weekly, 'monthly', monthly
  );
end;
$$;

create or replace function public.phase10_preview_promotion(
  p_to_academic_year_id uuid
)
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
  select * into to_year
  from public.academic_years where id = p_to_academic_year_id;

  if from_year.id is null
    or to_year.id is null
    or from_year.id = to_year.id
    or to_year.is_active
    or to_year.start_date <= from_year.end_date
    or exists (
      select 1 from public.student_enrollments e
      where e.academic_year_id = to_year.id and e.is_current
    )
  then
    raise exception using errcode = '22023', message = 'PROMOTION_YEAR_INVALID';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'grade', required.grade, 'class_number', required.class_number
  ) order by required.grade, required.class_number), '[]'::jsonb)
  into missing
  from (
    select distinct
      case s.current_grade
        when 'X' then 'XI'::public.grade_level
        else 'XII'::public.grade_level
      end grade,
      c.class_number
    from public.students s
    join public.student_enrollments e
      on e.student_id = s.id and e.is_current
    join public.classes c on c.id = e.class_id
    where s.is_active
      and e.academic_year_id = from_year.id
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
  )
  into summary
  from public.students s
  join public.student_enrollments e
    on e.student_id = s.id and e.is_current
  where s.is_active and e.academic_year_id = from_year.id;

  return summary;
end;
$$;
