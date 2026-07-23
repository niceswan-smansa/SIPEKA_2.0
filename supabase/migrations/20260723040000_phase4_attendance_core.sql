create table public.attendance_preview_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  actor_id uuid not null references public.profiles (id) on delete restrict,
  class_id uuid not null references public.classes (id) on delete restrict,
  attendance_date date not null,
  payload_hash text not null,
  snapshot_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.attendance_preview_tokens enable row level security;
revoke all on public.attendance_preview_tokens from anon, authenticated;

create index attendance_preview_tokens_actor_idx
  on public.attendance_preview_tokens (actor_id, expires_at);

create function private.require_phase4_admin()
returns public.profiles
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
begin
  select * into actor
  from public.profiles
  where id = auth.uid()
    and is_active
    and not must_change_password
    and role = 'ADMIN';
  if actor.id is null then
    raise exception using errcode = '42501', message = 'ATTENDANCE_FORBIDDEN';
  end if;
  return actor;
end;
$$;

revoke all on function private.require_phase4_admin() from public, anon, authenticated;

create function public.phase4_get_class_attendance(
  p_class_id uuid,
  p_attendance_date date,
  p_search text default null
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
  if p_attendance_date > (now() at time zone 'Asia/Jakarta')::date then
    raise exception using errcode = '22023', message = 'FUTURE_DATE_NOT_ALLOWED';
  end if;

  select jsonb_build_object(
    'class_id', p_class_id,
    'attendance_date', p_attendance_date,
    'items', coalesce(jsonb_agg(to_jsonb(roster) order by roster.full_name, roster.id), '[]'::jsonb)
  ) into result
  from (
    select
      s.id,
      s.full_name,
      s.nis,
      s.nisn,
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', ar.id,
            'period_number', ar.period_number,
            'status', ar.status,
            'note', ar.note,
            'version', ar.version
          ) order by ar.period_number
        )
        from public.attendance_records ar
        where ar.student_id = s.id
          and ar.class_id = p_class_id
          and ar.attendance_date = p_attendance_date
      ), '[]'::jsonb) as attendance
    from public.students s
    join public.student_enrollments e on e.student_id = s.id and e.is_current
    join public.classes c on c.id = e.class_id
    join public.academic_years y on y.id = e.academic_year_id and y.is_active
    where e.class_id = p_class_id
      and s.is_active
      and c.is_active
      and (
        normalized_search = ''
        or s.normalized_name ilike '%' || normalized_search || '%'
        or s.nis ilike '%' || btrim(coalesce(p_search, '')) || '%'
        or s.nisn ilike '%' || btrim(coalesce(p_search, '')) || '%'
      )
  ) roster;

  return coalesce(result, jsonb_build_object(
    'class_id', p_class_id, 'attendance_date', p_attendance_date, 'items', '[]'::jsonb
  ));
end;
$$;

create function public.phase4_preview_attendance(
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
  if p_payload is null or jsonb_typeof(p_payload) <> 'array' then
    raise exception using errcode = '22023', message = 'ATTENDANCE_PAYLOAD_INVALID';
  end if;
  if p_attendance_date > (now() at time zone 'Asia/Jakarta')::date then
    raise exception using errcode = '22023', message = 'FUTURE_DATE_NOT_ALLOWED';
  end if;

  select * into target_class from public.classes where id = p_class_id;
  if target_class.id is null or not target_class.is_active then
    raise exception using errcode = '23514', message = 'CLASS_INACTIVE_OR_NOT_FOUND';
  end if;
  select * into target_year from public.academic_years
  where id = target_class.academic_year_id and is_active;
  if target_year.id is null or p_attendance_date not between target_year.start_date and target_year.end_date then
    raise exception using errcode = '23514', message = 'DATE_OUTSIDE_ACTIVE_YEAR';
  end if;

  if exists (
    select 1 from (
      select (value->>'student_id') || ':' || (value->>'period_number') as key, count(*)
      from jsonb_array_elements(p_payload) group by 1 having count(*) > 1
    ) duplicate_keys
  ) then
    raise exception using errcode = '22023', message = 'ATTENDANCE_DUPLICATE_OPERATION';
  end if;

  for item in select value from jsonb_array_elements(p_payload) loop
    begin
      v_student_id := (item->>'student_id')::uuid;
      v_period_number := (item->>'period_number')::smallint;
    exception when others then
      invalid_count := invalid_count + 1;
      diffs := diffs || jsonb_build_array(jsonb_build_object('result', 'INVALID', 'item', item));
      continue;
    end;
    mode := coalesce(item->>'mode', 'upsert');
    status_value := item->>'status';
    note_value := nullif(btrim(coalesce(item->>'note', '')), '');

    if v_period_number not between 1 and 10 or mode not in ('upsert', 'delete')
      or (mode = 'upsert' and status_value not in ('IZIN', 'SAKIT', 'TANPA_KETERANGAN'))
      or not exists (
        select 1 from public.students s
        join public.student_enrollments e on e.student_id = s.id and e.is_current
        where s.id = v_student_id and s.is_active and e.class_id = p_class_id
      ) then
      invalid_count := invalid_count + 1;
      diffs := diffs || jsonb_build_array(jsonb_build_object('result', 'INVALID', 'item', item));
      continue;
    end if;

    select * into existing from public.attendance_records ar
    where ar.student_id = v_student_id and ar.class_id = p_class_id
      and ar.attendance_date = p_attendance_date and ar.period_number = v_period_number;

    if mode = 'delete' then
      if existing.id is null then
        result := 'UNCHANGED'; unchanged_count := unchanged_count + 1;
      else
        result := 'DELETE'; delete_count := delete_count + 1;
      end if;
    elsif existing.id is null then
      result := 'NEW'; new_count := new_count + 1;
    elsif existing.status::text = status_value and coalesce(existing.note, '') = coalesce(note_value, '') then
      result := 'UNCHANGED'; unchanged_count := unchanged_count + 1;
    else
      result := 'UPDATE'; update_count := update_count + 1;
    end if;

    diffs := diffs || jsonb_build_array(jsonb_build_object(
      'student_id', v_student_id, 'period_number', v_period_number, 'result', result,
      'before', case when existing.id is null then null else jsonb_build_object(
        'id', existing.id, 'status', existing.status, 'note', existing.note, 'version', existing.version
      ) end,
      'after', case when mode = 'delete' then null else jsonb_build_object(
        'status', status_value, 'note', note_value
      ) end
    ));
  end loop;

  select md5(coalesce(jsonb_agg(to_jsonb(ar) order by ar.student_id, ar.period_number)::text, '[]'))
  into snapshot_hash
  from public.attendance_records ar
  where ar.class_id = p_class_id and ar.attendance_date = p_attendance_date;

  insert into public.attendance_preview_tokens (
    token_hash, actor_id, class_id, attendance_date, payload_hash, snapshot_hash, expires_at
  ) values (
    md5(token), actor.id, p_class_id, p_attendance_date, md5(p_payload::text), snapshot_hash,
    now() + interval '10 minutes'
  );

  return jsonb_build_object(
    'token', token,
    'request_id', p_request_id,
    'expires_at', now() + interval '10 minutes',
    'diff', diffs,
    'summary', jsonb_build_object(
      'new', new_count, 'update', update_count, 'delete', delete_count,
      'unchanged', unchanged_count, 'invalid', invalid_count, 'stale', 0
    )
  );
end;
$$;

create function public.phase4_apply_attendance(
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
  current_snapshot_hash text;
  item jsonb;
  existing public.attendance_records%rowtype;
  created_record public.attendance_records%rowtype;
  v_student_id uuid;
  v_period_number smallint;
  mode text;
  status_value public.attendance_status;
  note_value text;
  batch_id uuid;
  new_count integer := 0;
  update_count integer := 0;
  delete_count integer := 0;
  unchanged_count integer := 0;
begin
  select * into preview from public.attendance_preview_tokens
  where token_hash = md5(p_token) for update;
  if preview.id is null or preview.actor_id <> actor.id or preview.class_id <> p_class_id
    or preview.attendance_date <> p_attendance_date then
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
  perform pg_advisory_xact_lock(hashtext(p_class_id::text || ':' || p_attendance_date::text));

  select md5(coalesce(jsonb_agg(to_jsonb(ar) order by ar.student_id, ar.period_number)::text, '[]'))
  into current_snapshot_hash
  from public.attendance_records ar
  where ar.class_id = p_class_id and ar.attendance_date = p_attendance_date;
  if current_snapshot_hash <> preview.snapshot_hash then
    raise exception using errcode = '40001', message = 'STALE_PREVIEW';
  end if;

  for item in select value from jsonb_array_elements(p_payload) loop
    v_student_id := (item->>'student_id')::uuid;
    v_period_number := (item->>'period_number')::smallint;
    mode := coalesce(item->>'mode', 'upsert');
    note_value := nullif(btrim(coalesce(item->>'note', '')), '');
    select * into existing from public.attendance_records ar
    where ar.student_id = v_student_id and ar.class_id = p_class_id
      and ar.attendance_date = p_attendance_date and ar.period_number = v_period_number for update;

    if mode = 'delete' then
      if existing.id is not null then
        insert into public.attendance_revisions (
          attendance_id, student_id, operation, before_data, after_data, actor_id, request_id
        ) values (
          existing.id, existing.student_id, 'DELETE', to_jsonb(existing), null, actor.id, p_request_id
        );
        delete from public.attendance_records where id = existing.id;
        delete_count := delete_count + 1;
      else
        unchanged_count := unchanged_count + 1;
      end if;
    else
      status_value := (item->>'status')::public.attendance_status;
      if existing.id is null then
        insert into public.attendance_records (
          student_id, class_id, attendance_date, period_number, status, note, created_by, updated_by
        ) values (
          v_student_id, p_class_id, p_attendance_date, v_period_number, status_value, note_value, actor.id, actor.id
        ) returning * into created_record;
        insert into public.attendance_revisions (
          attendance_id, student_id, operation, before_data, after_data, actor_id, request_id
        ) values (created_record.id, v_student_id, 'CREATE', null, to_jsonb(created_record), actor.id, p_request_id);
        new_count := new_count + 1;
      elsif existing.status <> status_value or coalesce(existing.note, '') <> coalesce(note_value, '') then
        update public.attendance_records
        set status = status_value, note = note_value, version = existing.version + 1, updated_by = actor.id
        where id = existing.id
        returning * into created_record;
        insert into public.attendance_revisions (
          attendance_id, student_id, operation, before_data, after_data, actor_id, request_id
        ) values (existing.id, v_student_id, 'UPDATE', to_jsonb(existing), to_jsonb(created_record), actor.id, p_request_id);
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
    jsonb_build_object('new', new_count, 'update', update_count, 'delete', delete_count, 'unchanged', unchanged_count), actor.id
  ) returning id into batch_id;

  insert into public.audit_logs (
    scope, actor_id, actor_name_snapshot, action, entity_type, entity_id, metadata, request_id
  ) values (
    'OPERATIONAL', actor.id, actor.full_name, 'ATTENDANCE_BATCH_APPLY', 'attendance_batch', batch_id::text,
    jsonb_build_object(
      'class_id', p_class_id, 'attendance_date', p_attendance_date,
      'new', new_count, 'update', update_count, 'delete', delete_count, 'unchanged', unchanged_count
    ), p_request_id
  );

  update public.attendance_preview_tokens set used_at = now() where id = preview.id;
  return jsonb_build_object(
    'batch_id', batch_id, 'new', new_count, 'update', update_count,
    'delete', delete_count, 'unchanged', unchanged_count
  );
end;
$$;

revoke all on function public.phase4_get_class_attendance(uuid, date, text) from public, anon;
grant execute on function public.phase4_get_class_attendance(uuid, date, text) to authenticated;
revoke all on function public.phase4_preview_attendance(uuid, date, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.phase4_preview_attendance(uuid, date, jsonb, uuid) to authenticated;
revoke all on function public.phase4_apply_attendance(text, uuid, date, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.phase4_apply_attendance(text, uuid, date, jsonb, uuid) to authenticated;
