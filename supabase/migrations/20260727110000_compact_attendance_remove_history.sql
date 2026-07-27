begin;

-- SIPEKA compact attendance + no application history.
-- Existing hourly attendance is migrated without deleting the current state.
-- This migration intentionally removes audit/revision/history storage.

create or replace function private.valid_attendance_period_statuses(value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(value) is distinct from 'object' then false
    else
      (
        select count(*)
        from jsonb_object_keys(value)
      ) between 1 and 10
      and not exists (
        select 1
        from jsonb_each_text(value) item
        where item.key !~ '^(10|[1-9])$'
          or item.value not in ('IZIN', 'SAKIT', 'TANPA_KETERANGAN')
      )
  end;
$$;

revoke all on function private.valid_attendance_period_statuses(jsonb)
from public, anon, authenticated;

create table public.attendance_days (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete restrict,
  class_id uuid not null references public.classes (id) on delete restrict,
  attendance_date date not null,
  period_statuses jsonb not null,
  note text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_days_student_date_key unique (student_id, attendance_date),
  constraint attendance_days_period_statuses_valid
    check (private.valid_attendance_period_statuses(period_statuses)),
  constraint attendance_days_note_length
    check (note is null or char_length(note) <= 500),
  constraint attendance_days_version_positive check (version > 0)
);

create index attendance_days_date_idx
  on public.attendance_days (attendance_date);
create index attendance_days_class_date_idx
  on public.attendance_days (class_id, attendance_date);
create index attendance_days_student_date_idx
  on public.attendance_days (student_id, attendance_date);

create trigger attendance_days_set_updated_at
before update on public.attendance_days
for each row execute function private.set_updated_at();

alter table public.attendance_days enable row level security;
revoke all on public.attendance_days from anon, authenticated;
grant all privileges on public.attendance_days to service_role;
grant select on public.attendance_days to authenticated;

create policy attendance_days_select_operational
on public.attendance_days
for select
to authenticated
using (private.can_access_operational());

do $$
begin
  if exists (
    select 1
    from public.attendance_records
    group by student_id, attendance_date
    having count(distinct class_id) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = 'ATTENDANCE_DAY_CLASS_CONFLICT';
  end if;
end;
$$;

insert into public.attendance_days (
  student_id,
  class_id,
  attendance_date,
  period_statuses,
  note,
  version,
  created_at,
  updated_at
)
select
  ar.student_id,
  min(ar.class_id::text)::uuid,
  ar.attendance_date,
  jsonb_object_agg(
    ar.period_number::text,
    to_jsonb(ar.status::text)
    order by ar.period_number
  ),
  nullif(
    left(
      string_agg(
        distinct btrim(ar.note),
        E'\n'
        order by btrim(ar.note)
      ) filter (where nullif(btrim(coalesce(ar.note, '')), '') is not null),
      500
    ),
    ''
  ),
  greatest(max(ar.version), 1),
  min(ar.created_at),
  max(ar.updated_at)
from public.attendance_records ar
group by ar.student_id, ar.attendance_date;

-- Tokens are bound to the old snapshot representation and must not survive the migration.
truncate table public.attendance_preview_tokens;

alter table public.attendance_records
  rename to attendance_records_legacy;

create view public.attendance_records
with (security_invoker = true)
as
select
  (
    substr(md5(day.id::text || ':' || period.key), 1, 8) || '-' ||
    substr(md5(day.id::text || ':' || period.key), 9, 4) || '-' ||
    substr(md5(day.id::text || ':' || period.key), 13, 4) || '-' ||
    substr(md5(day.id::text || ':' || period.key), 17, 4) || '-' ||
    substr(md5(day.id::text || ':' || period.key), 21, 12)
  )::uuid as id,
  day.student_id,
  day.class_id,
  day.attendance_date,
  period.key::smallint as period_number,
  period.value::public.attendance_status as status,
  day.note,
  null::uuid as created_by,
  null::uuid as updated_by,
  day.version,
  day.created_at,
  day.updated_at
from public.attendance_days day
cross join lateral jsonb_each_text(day.period_statuses) period;

revoke all on public.attendance_records from anon, authenticated;
grant select on public.attendance_records to authenticated;
grant all privileges on public.attendance_records to service_role;

create or replace function private.write_attendance_records_compat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_day public.attendance_days%rowtype;
  next_statuses jsonb;
begin
  if tg_op = 'INSERT' then
    if new.period_number not between 1 and 10
      or new.status::text not in ('IZIN', 'SAKIT', 'TANPA_KETERANGAN')
      or char_length(coalesce(new.note, '')) > 500
    then
      raise exception using errcode = '22023', message = 'ATTENDANCE_ITEM_INVALID';
    end if;

    select * into current_day
    from public.attendance_days
    where student_id = new.student_id
      and attendance_date = new.attendance_date
    for update;

    if current_day.id is not null and current_day.class_id <> new.class_id then
      raise exception using errcode = '23505', message = 'ATTENDANCE_CLASS_CONFLICT';
    end if;

    if current_day.id is null then
      insert into public.attendance_days (
        student_id, class_id, attendance_date, period_statuses, note,
        version, created_at, updated_at
      ) values (
        new.student_id,
        new.class_id,
        new.attendance_date,
        jsonb_build_object(new.period_number::text, new.status::text),
        new.note,
        greatest(coalesce(new.version, 1), 1),
        coalesce(new.created_at, now()),
        coalesce(new.updated_at, now())
      );
    else
      update public.attendance_days
      set period_statuses = jsonb_set(
            current_day.period_statuses,
            array[new.period_number::text],
            to_jsonb(new.status::text),
            true
          ),
          note = new.note,
          version = current_day.version + 1,
          updated_at = coalesce(new.updated_at, now())
      where id = current_day.id;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if (new.student_id, new.attendance_date, new.period_number)
      is distinct from (old.student_id, old.attendance_date, old.period_number)
    then
      raise exception using errcode = '22023', message = 'ATTENDANCE_KEY_IMMUTABLE';
    end if;

    select * into current_day
    from public.attendance_days
    where student_id = old.student_id
      and attendance_date = old.attendance_date
    for update;

    if current_day.id is null then
      raise exception using errcode = 'P0002', message = 'ATTENDANCE_NOT_FOUND';
    end if;
    if current_day.class_id <> new.class_id then
      raise exception using errcode = '23505', message = 'ATTENDANCE_CLASS_CONFLICT';
    end if;

    update public.attendance_days
    set period_statuses = jsonb_set(
          current_day.period_statuses,
          array[new.period_number::text],
          to_jsonb(new.status::text),
          true
        ),
        note = new.note,
        version = current_day.version + 1
    where id = current_day.id;
    return new;
  end if;

  select * into current_day
  from public.attendance_days
  where student_id = old.student_id
    and attendance_date = old.attendance_date
  for update;

  if current_day.id is null then
    return old;
  end if;

  next_statuses := current_day.period_statuses - old.period_number::text;
  if next_statuses = '{}'::jsonb then
    delete from public.attendance_days where id = current_day.id;
  else
    update public.attendance_days
    set period_statuses = next_statuses,
        version = current_day.version + 1
    where id = current_day.id;
  end if;
  return old;
end;
$$;

revoke all on function private.write_attendance_records_compat()
from public, anon, authenticated;

create trigger attendance_records_compat_write
instead of insert or update or delete on public.attendance_records
for each row execute function private.write_attendance_records_compat();

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
        'id', day.id,
        'student_id', day.student_id,
        'class_id', day.class_id,
        'date', day.attendance_date,
        'period_statuses', day.period_statuses,
        'note', day.note,
        'version', day.version,
        'updated_at', day.updated_at
      ) order by day.student_id)
      from public.attendance_days day
      where day.class_id = p_class_id
        and day.attendance_date = p_attendance_date
    ), '[]'::jsonb),
    'roster', coalesce((
      select jsonb_agg(jsonb_build_object(
        'student_id', s.id,
        'student_active', s.is_active,
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
      s.id,
      s.full_name,
      s.nis,
      s.nisn,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', ar.id,
          'period_number', ar.period_number,
          'status', ar.status,
          'note', ar.note,
          'version', ar.version
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
    select 1
    from (
      select (value->>'student_id') || ':' || (value->>'period_number') key, count(*)
      from jsonb_array_elements(p_payload)
      group by 1
      having count(*) > 1
    ) duplicate_keys
  ) then
    raise exception using errcode = '22023', message = 'ATTENDANCE_DUPLICATE_OPERATION';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_payload) as operation(value)
    where coalesce(operation.value->>'mode', 'upsert') = 'upsert'
    group by operation.value->>'student_id'
    having count(
      distinct coalesce(nullif(btrim(operation.value->>'note'), ''), '')
    ) > 1
  ) then
    raise exception using errcode = '22023', message = 'ATTENDANCE_NOTE_CONFLICT';
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
        'student_id', v_student_id,
        'period_number', v_period_number,
        'result', 'INVALID',
        'reason', 'ATTENDANCE_ITEM_INVALID'
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
        'student_id', v_student_id,
        'period_number', v_period_number,
        'result', 'INVALID',
        'reason', 'ATTENDANCE_CLASS_CONFLICT'
      ));
      continue;
    end if;

    if mode = 'delete' then
      if existing.id is null then
        result := 'UNCHANGED';
        unchanged_count := unchanged_count + 1;
      else
        result := 'DELETE';
        delete_count := delete_count + 1;
      end if;
    elsif existing.id is null then
      result := 'NEW';
      new_count := new_count + 1;
    elsif existing.status::text = status_value
      and coalesce(existing.note, '') = coalesce(note_value, '')
    then
      result := 'UNCHANGED';
      unchanged_count := unchanged_count + 1;
    else
      result := 'UPDATE';
      update_count := update_count + 1;
    end if;

    diffs := diffs || jsonb_build_array(jsonb_build_object(
      'student_id', v_student_id,
      'period_number', v_period_number,
      'result', result,
      'before', case when existing.id is null then null else jsonb_build_object(
        'id', existing.id,
        'class_id', existing.class_id,
        'status', existing.status,
        'note', existing.note,
        'version', existing.version
      ) end,
      'after', case when mode = 'delete' then null else jsonb_build_object(
        'status', status_value,
        'note', note_value
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
    'token', token,
    'request_id', p_request_id,
    'expires_at', now() + interval '10 minutes',
    'diff', diffs,
    'summary', jsonb_build_object(
      'new', new_count,
      'update', update_count,
      'delete', delete_count,
      'unchanged', unchanged_count,
      'invalid', invalid_count,
      'stale', 0
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
  current_day public.attendance_days%rowtype;
  v_student_id uuid;
  v_period_number smallint;
  mode text;
  status_text text;
  note_value text;
  original_statuses jsonb;
  next_statuses jsonb;
  original_note text;
  next_note text;
  original_status text;
  day_changed boolean;
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
    from (
      select (value->>'student_id') || ':' || (value->>'period_number') key, count(*)
      from jsonb_array_elements(p_payload)
      group by 1
      having count(*) > 1
    ) duplicate_keys
  ) then
    raise exception using errcode = '22023', message = 'ATTENDANCE_DUPLICATE_OPERATION';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_payload) as operation(value)
    where coalesce(operation.value->>'mode', 'upsert') = 'upsert'
    group by operation.value->>'student_id'
    having count(
      distinct coalesce(nullif(btrim(operation.value->>'note'), ''), '')
    ) > 1
  ) then
    raise exception using errcode = '22023', message = 'ATTENDANCE_NOTE_CONFLICT';
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

  -- Validate every operation again inside the authoritative transaction.
  for item in select value from jsonb_array_elements(p_payload)
  loop
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
  end loop;

  for v_student_id in
    select distinct (value->>'student_id')::uuid
    from jsonb_array_elements(p_payload)
    order by 1
  loop
    current_day := null;
    select * into current_day
    from public.attendance_days day
    where day.student_id = v_student_id
      and day.attendance_date = p_attendance_date
    for update;

    if current_day.id is not null and current_day.class_id <> p_class_id then
      raise exception using errcode = '23505', message = 'ATTENDANCE_CLASS_CONFLICT';
    end if;

    original_statuses := coalesce(current_day.period_statuses, '{}'::jsonb);
    next_statuses := original_statuses;
    original_note := current_day.note;
    next_note := original_note;
    day_changed := false;

    for item in
      select value
      from jsonb_array_elements(p_payload)
      where (value->>'student_id')::uuid = v_student_id
      order by (value->>'period_number')::smallint
    loop
      v_period_number := (item->>'period_number')::smallint;
      mode := coalesce(item->>'mode', 'upsert');
      status_text := item->>'status';
      note_value := nullif(btrim(coalesce(item->>'note', '')), '');
      original_status := original_statuses->>v_period_number::text;

      if mode = 'delete' then
        if original_status is null then
          unchanged_count := unchanged_count + 1;
        else
          next_statuses := next_statuses - v_period_number::text;
          delete_count := delete_count + 1;
          day_changed := true;
        end if;
      else
        if original_status is null then
          new_count := new_count + 1;
          day_changed := true;
        elsif original_status <> status_text
          or coalesce(original_note, '') <> coalesce(note_value, '')
        then
          update_count := update_count + 1;
          day_changed := true;
        else
          unchanged_count := unchanged_count + 1;
        end if;

        next_statuses := jsonb_set(
          next_statuses,
          array[v_period_number::text],
          to_jsonb(status_text),
          true
        );
        next_note := note_value;
      end if;
    end loop;

    if not day_changed then
      continue;
    end if;

    if next_statuses = '{}'::jsonb then
      if current_day.id is not null then
        delete from public.attendance_days where id = current_day.id;
      end if;
    elsif current_day.id is null then
      insert into public.attendance_days (
        student_id,
        class_id,
        attendance_date,
        period_statuses,
        note
      ) values (
        v_student_id,
        p_class_id,
        p_attendance_date,
        next_statuses,
        next_note
      );
    else
      update public.attendance_days
      set period_statuses = next_statuses,
          note = next_note,
          version = current_day.version + 1
      where id = current_day.id;
    end if;
  end loop;

  delete from public.attendance_preview_tokens
  where id = preview.id;

  return jsonb_build_object(
    'batch_id', p_request_id,
    'new', new_count,
    'update', update_count,
    'delete', delete_count,
    'unchanged', unchanged_count,
    'invalid', 0,
    'stale', 0
  );
end;
$$;

revoke all on function public.phase4_get_class_attendance(uuid, date, text)
from public, anon;
grant execute on function public.phase4_get_class_attendance(uuid, date, text)
to authenticated;

revoke all on function public.phase4_preview_attendance(uuid, date, jsonb, uuid)
from public, anon, authenticated;
grant execute on function public.phase4_preview_attendance(uuid, date, jsonb, uuid)
to authenticated;

revoke all on function public.phase4_apply_attendance(text, uuid, date, jsonb, uuid)
from public, anon, authenticated;
grant execute on function public.phase4_apply_attendance(text, uuid, date, jsonb, uuid)
to authenticated;


create or replace function private.cleanup_attendance_preview_tokens()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.attendance_preview_tokens
  where id in (
    select id
    from public.attendance_preview_tokens
    where expires_at < clock_timestamp()
    order by expires_at
    limit 500
  );
  return new;
end;
$$;

revoke all on function private.cleanup_attendance_preview_tokens()
from public, anon, authenticated;

create or replace function public.phase6_get_student_attendance(
  p_student_id uuid,
  p_selected_date date,
  p_month date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  month_start date := date_trunc('month', p_month)::date;
  month_end date :=
    (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
  result jsonb;
begin
  if not private.can_access_operational() then
    raise exception using errcode = '42501', message = 'STUDENT_ATTENDANCE_FORBIDDEN';
  end if;
  if not exists (select 1 from public.students where id = p_student_id) then
    raise exception using errcode = 'P0002', message = 'STUDENT_NOT_FOUND';
  end if;

  select jsonb_build_object(
    'periods', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ar.id,
        'period_number', ar.period_number,
        'status', ar.status,
        'note', ar.note,
        'class_id', ar.class_id,
        'created_at', ar.created_at,
        'updated_at', ar.updated_at
      ) order by ar.period_number)
      from public.attendance_records ar
      where ar.student_id = p_student_id
        and ar.attendance_date = p_selected_date
    ), '[]'::jsonb),
    'calendar', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', grouped.attendance_date,
        'statuses', grouped.statuses
      ) order by grouped.attendance_date)
      from (
        select
          ar.attendance_date,
          array_agg(distinct ar.status::text order by ar.status::text) statuses
        from public.attendance_records ar
        where ar.student_id = p_student_id
          and ar.attendance_date between month_start and month_end
        group by ar.attendance_date
      ) grouped
    ), '[]'::jsonb),
    'stats', jsonb_build_object(
      'days_izin', (
        select count(distinct ar.attendance_date)
        from public.attendance_records ar
        where ar.student_id = p_student_id
          and ar.attendance_date between month_start and month_end
          and ar.status = 'IZIN'
      ),
      'days_sakit', (
        select count(distinct ar.attendance_date)
        from public.attendance_records ar
        where ar.student_id = p_student_id
          and ar.attendance_date between month_start and month_end
          and ar.status = 'SAKIT'
      ),
      'days_tanpa_keterangan', (
        select count(distinct ar.attendance_date)
        from public.attendance_records ar
        where ar.student_id = p_student_id
          and ar.attendance_date between month_start and month_end
          and ar.status = 'TANPA_KETERANGAN'
      ),
      'days_total', (
        select count(distinct ar.attendance_date)
        from public.attendance_records ar
        where ar.student_id = p_student_id
          and ar.attendance_date between month_start and month_end
      ),
      'hours_izin', (
        select count(*)
        from public.attendance_records ar
        where ar.student_id = p_student_id
          and ar.attendance_date between month_start and month_end
          and ar.status = 'IZIN'
      ),
      'hours_sakit', (
        select count(*)
        from public.attendance_records ar
        where ar.student_id = p_student_id
          and ar.attendance_date between month_start and month_end
          and ar.status = 'SAKIT'
      ),
      'hours_tanpa_keterangan', (
        select count(*)
        from public.attendance_records ar
        where ar.student_id = p_student_id
          and ar.attendance_date between month_start and month_end
          and ar.status = 'TANPA_KETERANGAN'
      ),
      'hours_total', (
        select count(*)
        from public.attendance_records ar
        where ar.student_id = p_student_id
          and ar.attendance_date between month_start and month_end
      )
    ),
    'trend', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', grouped.day::date,
        'day', extract(day from grouped.day)::integer,
        'izin', grouped.izin,
        'sakit', grouped.sakit,
        'tanpa_keterangan', grouped.tanpa_keterangan
      ) order by grouped.day)
      from (
        select
          days.day,
          count(ar.id) filter (where ar.status = 'IZIN') izin,
          count(ar.id) filter (where ar.status = 'SAKIT') sakit,
          count(ar.id) filter (where ar.status = 'TANPA_KETERANGAN') tanpa_keterangan
        from generate_series(month_start, month_end, interval '1 day') days(day)
        left join public.attendance_records ar
          on ar.student_id = p_student_id
          and ar.attendance_date = days.day::date
        group by days.day
      ) grouped
    ), '[]'::jsonb)
  )
  into result;

  return result;
end;
$$;

create or replace function public.phase6_get_student_report(
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
  if p_start_date > p_end_date then
    raise exception using errcode = '22023', message = 'REPORT_DATE_RANGE_INVALID';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'date', ar.attendance_date,
      'period_number', ar.period_number,
      'status', ar.status,
      'note', ar.note,
      'created_at', ar.created_at,
      'updated_at', ar.updated_at
    ) order by ar.attendance_date, ar.period_number)
    from public.attendance_records ar
    where ar.student_id = p_student_id
      and ar.attendance_date between p_start_date and p_end_date
  ), '[]'::jsonb);
end;
$$;

create or replace function public.phase10_get_student_report(
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
      'date', ar.attendance_date,
      'period_number', ar.period_number,
      'status', ar.status,
      'note', ar.note,
      'created_at', ar.created_at,
      'updated_at', ar.updated_at
    ) order by ar.attendance_date, ar.period_number)
    from public.attendance_records ar
    where ar.student_id = p_student_id
      and ar.attendance_date between p_start_date and p_end_date
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.phase6_get_student_attendance(uuid, date, date)
from public, anon;
grant execute on function public.phase6_get_student_attendance(uuid, date, date)
to authenticated;

revoke all on function public.phase6_get_student_report(uuid, date, date)
from public, anon;
grant execute on function public.phase6_get_student_report(uuid, date, date)
to authenticated;

revoke all on function public.phase10_get_student_report(uuid, date, date)
from public, anon;
grant execute on function public.phase10_get_student_report(uuid, date, date)
to authenticated;

-- Rebind every remaining read model and business RPC to the compact compatibility view,
-- while removing all audit inserts from current business functions.
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


create or replace function public.admin_create_account_profile(
  p_actor_id uuid,
  p_target_id uuid,
  p_full_name text,
  p_username text,
  p_email text,
  p_role public.app_role,
  p_is_active boolean,
  p_must_change_password boolean,
  p_request_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  created public.profiles%rowtype;
begin
  select * into actor
  from public.profiles
  where id = p_actor_id and is_active and role = 'SUPER_ADMIN';
  if actor.id is null then
    raise exception using errcode = '42501', message = 'Actor Super Admin tidak valid.';
  end if;
  if p_target_id = p_actor_id or p_role = 'SUPER_ADMIN' then
    raise exception using errcode = '42501', message = 'Target akun dilindungi.';
  end if;

  insert into public.profiles (
    id, username, email, full_name, role, is_active, must_change_password, created_by
  ) values (
    p_target_id, lower(btrim(p_username)), lower(btrim(p_email)), btrim(p_full_name),
    p_role, p_is_active, p_must_change_password, p_actor_id
  ) returning * into created;


  return jsonb_build_object(
    'id', created.id, 'username', created.username, 'email', created.email,
    'full_name', created.full_name, 'role', created.role,
    'is_active', created.is_active, 'must_change_password', created.must_change_password,
    'last_login_at', created.last_login_at, 'created_at', created.created_at,
    'updated_at', created.updated_at
  );
end;
$$;


create or replace function public.admin_mark_account_password_reset(
  p_actor_id uuid,
  p_target_id uuid,
  p_request_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  target public.profiles%rowtype;
  updated public.profiles%rowtype;
begin
  select * into actor from public.profiles
  where id = p_actor_id and is_active and role = 'SUPER_ADMIN';
  if actor.id is null then
    raise exception using errcode = '42501', message = 'Actor Super Admin tidak valid.';
  end if;
  select * into target from public.profiles where id = p_target_id for update;
  if target.id is null then
    raise exception using errcode = 'P0002', message = 'Target akun tidak ditemukan.';
  end if;
  if target.id = actor.id or target.role = 'SUPER_ADMIN' then
    raise exception using errcode = '42501', message = 'Target akun dilindungi.';
  end if;

  update public.profiles
  set must_change_password = true
  where id = target.id
  returning * into updated;


  return jsonb_build_object(
    'id', updated.id, 'username', updated.username, 'email', updated.email,
    'full_name', updated.full_name, 'role', updated.role,
    'is_active', updated.is_active, 'must_change_password', updated.must_change_password,
    'last_login_at', updated.last_login_at, 'created_at', updated.created_at,
    'updated_at', updated.updated_at
  );
end;
$$;


create or replace function public.admin_tombstone_account(
  p_actor_id uuid,
  p_target_id uuid,
  p_tombstone_username text,
  p_request_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  target public.profiles%rowtype;
  updated public.profiles%rowtype;
begin
  select * into actor from public.profiles
  where id = p_actor_id and is_active and role = 'SUPER_ADMIN';
  if actor.id is null then
    raise exception using errcode = '42501', message = 'Actor Super Admin tidak valid.';
  end if;
  select * into target from public.profiles where id = p_target_id for update;
  if target.id is null then
    raise exception using errcode = 'P0002', message = 'Target akun tidak ditemukan.';
  end if;
  if target.id = actor.id or target.role = 'SUPER_ADMIN' then
    raise exception using errcode = '42501', message = 'Target akun dilindungi.';
  end if;
  if p_tombstone_username !~ '^deleted_[a-f0-9]{32}$' then
    raise exception using errcode = '22023', message = 'Tombstone akun tidak valid.';
  end if;

  update public.profiles
  set username = p_tombstone_username,
      email = null,
      is_active = false,
      must_change_password = true
  where id = target.id
  returning * into updated;


  return jsonb_build_object(
    'id', updated.id, 'username', updated.username, 'email', updated.email,
    'full_name', updated.full_name, 'role', updated.role,
    'is_active', updated.is_active, 'must_change_password', updated.must_change_password,
    'last_login_at', updated.last_login_at, 'created_at', updated.created_at,
    'updated_at', updated.updated_at
  );
end;
$$;


create or replace function public.admin_update_account_profile(
  p_actor_id uuid,
  p_target_id uuid,
  p_full_name text,
  p_username text,
  p_email text,
  p_role public.app_role,
  p_is_active boolean,
  p_action text,
  p_request_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
  target public.profiles%rowtype;
  updated public.profiles%rowtype;
  before_data jsonb;
begin
  select * into actor
  from public.profiles
  where id = p_actor_id and is_active and role = 'SUPER_ADMIN';

  if actor.id is null then
    raise exception using errcode = '42501', message = 'Actor Super Admin tidak valid.';
  end if;

  select * into target
  from public.profiles
  where id = p_target_id
  for update;

  if target.id is null then
    raise exception using errcode = 'P0002', message = 'Target akun tidak ditemukan.';
  end if;
  if target.id = actor.id or target.role = 'SUPER_ADMIN' then
    raise exception using errcode = '42501', message = 'Target akun dilindungi.';
  end if;
  if p_role = 'SUPER_ADMIN' then
    raise exception using errcode = '42501', message = 'Role Super Admin tidak dapat dibuat atau dipilih.';
  end if;
  if p_action not in ('UPDATE', 'ROLE_CHANGE', 'ACTIVATE', 'DEACTIVATE') then
    raise exception using errcode = '22023', message = 'Action account tidak valid.';
  end if;

  before_data := jsonb_build_object(
    'id', target.id,
    'username', target.username,
    'email', target.email,
    'full_name', target.full_name,
    'role', target.role,
    'is_active', target.is_active,
    'must_change_password', target.must_change_password
  );

  update public.profiles
  set full_name = btrim(p_full_name),
      username = lower(btrim(p_username)),
      email = case when p_email is null or btrim(p_email) = '' then null else lower(btrim(p_email)) end,
      role = p_role,
      is_active = p_is_active
  where id = p_target_id
  returning * into updated;


  return jsonb_build_object(
    'id', updated.id,
    'username', updated.username,
    'email', updated.email,
    'full_name', updated.full_name,
    'role', updated.role,
    'is_active', updated.is_active,
    'must_change_password', updated.must_change_password,
    'last_login_at', updated.last_login_at,
    'created_at', updated.created_at,
    'updated_at', updated.updated_at
  );
end;
$$;


create or replace function public.complete_password_change()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_name text;
begin
  update public.profiles as p
  set must_change_password = false
  where p.id = actor_id and p.is_active
  returning p.full_name into actor_name;

  if actor_name is null then
    raise exception using errcode = '42501', message = 'Akun aktif tidak ditemukan.';
  end if;

end;
$$;


create or replace function public.phase12_get_grade_attendance_export(
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


  return jsonb_build_object(
    'batch_count', batch_count,
    'row_count', total_rows,
    'created', total_created,
    'results', results
  );
end;
$$;


create or replace function public.phase3_activate_academic_year(
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


  return jsonb_build_object('id', target.id, 'is_active', true);
end;
$$;


create or replace function public.phase3_change_student_academic(
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


  return jsonb_build_object(
    'id', updated.id, 'current_grade', updated.current_grade,
    'current_class_id', updated.current_class_id, 'is_active', updated.is_active
  );
end;
$$;


create or replace function public.phase3_create_academic_year(
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


  return jsonb_build_object(
    'id', created.id, 'name', created.name, 'start_date', created.start_date,
    'end_date', created.end_date, 'is_active', created.is_active
  );
end;
$$;


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
  return to_jsonb(created);
end;
$$;


create or replace function public.phase3_update_academic_year(
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


  return jsonb_build_object(
    'id', updated.id, 'name', updated.name, 'start_date', updated.start_date,
    'end_date', updated.end_date, 'is_active', updated.is_active
  );
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


  return jsonb_build_object(
    'id', updated.id, 'academic_year_id', updated.academic_year_id,
    'grade', updated.grade, 'class_number', updated.class_number,
    'homeroom_teacher', updated.homeroom_teacher, 'notes', updated.notes,
    'is_active', updated.is_active
  );
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

  return to_jsonb(updated);
end;
$$;


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


create or replace function public.phase7_archive_alumni(
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
  return jsonb_build_object('id', target.id, 'archived', true);
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
  return jsonb_build_object('batch_id', batch.id, 'created', created_count);
end;
$$;


create or replace function public.phase7_promote_academic_year(
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
  return jsonb_build_object('batch_id', batch.id, 'promoted', promoted_count);
end;
$$;


create or replace function public.phase7_rollback_promotion(
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
  return jsonb_build_object('batch_id', batch.id, 'restored', restored_count);
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
  return jsonb_build_object('id', target.id, 'tombstoned', true);
end;
$$;


create or replace function public.phase9_import_existing_students(
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
  return jsonb_build_object('imported', imported, 'already_applied', false);
end;
$$;


drop trigger if exists academic_years_audit_change on public.academic_years;
drop trigger if exists classes_audit_change on public.classes;
drop trigger if exists students_audit_change on public.students;
drop trigger if exists student_enrollments_audit_change on public.student_enrollments;
drop trigger if exists audit_logs_append_only on public.audit_logs;
drop trigger if exists audit_logs_redact_student_before_insert on public.audit_logs;

drop function if exists private.audit_operational_change();
drop function if exists private.prevent_audit_mutation();
drop function if exists private.redact_student_audit_insert();
drop function if exists private.redact_student_audit_snapshot(jsonb);
drop function if exists public.phase12_clear_operational_audit(uuid, text, uuid);
drop function if exists public.phase12_record_grade_attendance_export(public.grade_level, date, date, integer, integer, integer, uuid);
drop function if exists public.phase6_record_student_export(uuid, date, date, integer, uuid);


-- Preserve the one-time existing-student import workflow without audit_logs.
-- Idempotency markers live in import_batches, which is retained workflow state.
create or replace function public.phase9_import_existing_students(
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
  marker_class_id uuid;
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

  perform pg_advisory_xact_lock(
    hashtextextended('phase9_import_existing_students:' || btrim(p_batch_key), 0)
  );

  if exists (
    select 1
    from public.import_batches b
    where b.status = 'COMPLETED'
      and b.summary->>'kind' = 'EXISTING_STUDENT_MIGRATION'
      and b.summary->>'batch_key' = btrim(p_batch_key)
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
    select 1
    from jsonb_array_elements(p_rows) r
    where nullif(btrim(r->>'nis'), '') is not null
    group by nullif(btrim(r->>'nis'), '')
    having count(*) > 1
  ) then
    raise exception using errcode = '23505', message = 'MIGRATION_DUPLICATE_NIS';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_rows) r
    where nullif(btrim(r->>'nisn'), '') is not null
    group by nullif(btrim(r->>'nisn'), '')
    having count(*) > 1
  ) then
    raise exception using errcode = '23505', message = 'MIGRATION_DUPLICATE_NISN';
  end if;

  for row_data in select value from jsonb_array_elements(p_rows)
  loop
    normalized_name := regexp_replace(
      btrim(coalesce(row_data->>'name', '')),
      '\s+',
      ' ',
      'g'
    );
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

    marker_class_id := coalesce(marker_class_id, target_class.id);

    insert into public.students (
      nis,
      nisn,
      full_name,
      normalized_name,
      gender,
      current_grade,
      current_class_id,
      year_entered,
      is_active
    ) values (
      normalized_nis,
      normalized_nisn,
      normalized_name,
      lower(normalized_name),
      (row_data->>'gender')::public.gender,
      target_class.grade,
      target_class.id,
      2026,
      true
    ) returning id into student_id;

    insert into public.student_enrollments (
      student_id,
      academic_year_id,
      class_id,
      grade,
      started_on,
      is_current
    ) values (
      student_id,
      target_year.id,
      target_class.id,
      target_class.grade,
      target_year.start_date,
      true
    );

    imported := imported + 1;
  end loop;

  insert into public.import_batches (
    class_id,
    file_name,
    row_count,
    summary,
    status,
    created_by
  ) values (
    marker_class_id,
    'existing-students-' || left(btrim(p_batch_key), 120) || '.json',
    imported,
    jsonb_build_object(
      'kind', 'EXISTING_STUDENT_MIGRATION',
      'batch_key', btrim(p_batch_key),
      'row_count', imported
    ),
    'COMPLETED',
    null
  );

  return jsonb_build_object('imported', imported, 'already_applied', false);
end;
$$;

-- Convert prior audit-based idempotency markers before audit_logs is removed.
do $$
declare
  marker_class_id uuid;
begin
  select c.id
  into marker_class_id
  from public.classes c
  join public.academic_years y on y.id = c.academic_year_id
  where y.name = '2026/2027'
    and y.is_active
    and c.is_active
  order by c.grade, c.class_number, c.id
  limit 1;

  if marker_class_id is not null then
    insert into public.import_batches (
      class_id,
      file_name,
      row_count,
      summary,
      status,
      created_by
    )
    select
      marker_class_id,
      'existing-students-' || left(source.batch_key, 120) || '.json',
      source.row_count,
      jsonb_build_object(
        'kind', 'EXISTING_STUDENT_MIGRATION',
        'batch_key', source.batch_key,
        'row_count', source.row_count,
        'migrated_from_audit_marker', true
      ),
      'COMPLETED',
      null
    from (
      select distinct on (a.metadata->>'batch_key')
        a.metadata->>'batch_key' as batch_key,
        case
          when coalesce(a.metadata->>'row_count', '') ~ '^[0-9]+$'
            then (a.metadata->>'row_count')::integer
          else 0
        end as row_count
      from public.audit_logs a
      where a.action = 'STUDENT_MIGRATION'
        and nullif(btrim(a.metadata->>'batch_key'), '') is not null
      order by a.metadata->>'batch_key', a.created_at desc, a.id desc
    ) source
    where not exists (
      select 1
      from public.import_batches existing
      where existing.summary->>'kind' = 'EXISTING_STUDENT_MIGRATION'
        and existing.summary->>'batch_key' = source.batch_key
    );
  end if;
end;
$$;

create unique index if not exists
  import_batches_existing_student_migration_batch_key_idx
on public.import_batches ((summary->>'batch_key'))
where summary->>'kind' = 'EXISTING_STUDENT_MIGRATION';

do $$
declare
  remaining text;
begin
  select string_agg(n.nspname || '.' || p.proname, ', ' order by n.nspname, p.proname)
  into remaining
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private')
    and p.prosrc ilike '%audit_logs%';

  if remaining is not null then
    raise exception using
      errcode = '2BP01',
      message = 'AUDIT_FUNCTION_DEPENDENCY_REMAINS: ' || remaining;
  end if;
end;
$$;

drop table public.audit_logs;

do $$
declare
  remaining text;
begin
  select string_agg(n.nspname || '.' || p.proname, ', ' order by n.nspname, p.proname)
  into remaining
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private')
    and (
      p.prosrc ilike '%attendance_revisions%'
      or p.prosrc ilike '%attendance_batches%'
    );

  if remaining is not null then
    raise exception using
      errcode = '2BP01',
      message = 'ATTENDANCE_HISTORY_FUNCTION_DEPENDENCY_REMAINS: ' || remaining;
  end if;
end;
$$;

drop table public.attendance_revisions;
drop table public.attendance_batches;
drop table public.attendance_records_legacy;

drop type if exists public.audit_scope;
drop type if exists public.revision_operation;

commit;
