create function public.phase6_get_student_attendance(
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
  month_end date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
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
        'id', ar.id, 'period_number', ar.period_number, 'status', ar.status, 'note', ar.note,
        'class_id', ar.class_id, 'created_at', ar.created_at, 'updated_at', ar.updated_at,
        'created_by_name', coalesce(created.full_name, 'Akun dihapus'),
        'updated_by_name', coalesce(updated.full_name, 'Akun dihapus')
      ) order by ar.period_number)
      from public.attendance_records ar
      left join public.profiles created on created.id = ar.created_by
      left join public.profiles updated on updated.id = ar.updated_by
      where ar.student_id = p_student_id and ar.attendance_date = p_selected_date
    ), '[]'::jsonb),
    'calendar', coalesce((
      select jsonb_agg(jsonb_build_object('date', grouped.attendance_date, 'statuses', grouped.statuses) order by grouped.attendance_date)
      from (
        select ar.attendance_date, array_agg(distinct ar.status::text order by ar.status::text) as statuses
        from public.attendance_records ar
        where ar.student_id = p_student_id and ar.attendance_date between month_start and month_end
        group by ar.attendance_date
      ) grouped
    ), '[]'::jsonb),
    'stats', jsonb_build_object(
      'days_izin', (select count(distinct ar.attendance_date) from public.attendance_records ar where ar.student_id = p_student_id and ar.attendance_date between month_start and month_end and ar.status = 'IZIN'),
      'days_sakit', (select count(distinct ar.attendance_date) from public.attendance_records ar where ar.student_id = p_student_id and ar.attendance_date between month_start and month_end and ar.status = 'SAKIT'),
      'days_tanpa_keterangan', (select count(distinct ar.attendance_date) from public.attendance_records ar where ar.student_id = p_student_id and ar.attendance_date between month_start and month_end and ar.status = 'TANPA_KETERANGAN'),
      'days_total', (select count(distinct ar.attendance_date) from public.attendance_records ar where ar.student_id = p_student_id and ar.attendance_date between month_start and month_end),
      'hours_izin', (select count(*) from public.attendance_records ar where ar.student_id = p_student_id and ar.attendance_date between month_start and month_end and ar.status = 'IZIN'),
      'hours_sakit', (select count(*) from public.attendance_records ar where ar.student_id = p_student_id and ar.attendance_date between month_start and month_end and ar.status = 'SAKIT'),
      'hours_tanpa_keterangan', (select count(*) from public.attendance_records ar where ar.student_id = p_student_id and ar.attendance_date between month_start and month_end and ar.status = 'TANPA_KETERANGAN'),
      'hours_total', (select count(*) from public.attendance_records ar where ar.student_id = p_student_id and ar.attendance_date between month_start and month_end)
    ),
    'trend', coalesce((
      select jsonb_agg(jsonb_build_object('date', grouped.day::date, 'day', extract(day from grouped.day)::integer, 'izin', grouped.izin, 'sakit', grouped.sakit, 'tanpa_keterangan', grouped.tanpa_keterangan) order by grouped.day)
      from (
        select days.day,
          count(ar.id) filter (where ar.status = 'IZIN') as izin,
          count(ar.id) filter (where ar.status = 'SAKIT') as sakit,
          count(ar.id) filter (where ar.status = 'TANPA_KETERANGAN') as tanpa_keterangan
        from generate_series(month_start, month_end, interval '1 day') days(day)
        left join public.attendance_records ar on ar.student_id = p_student_id and ar.attendance_date = days.day::date
        group by days.day
      ) grouped
    ), '[]'::jsonb),
    'revisions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', revision.id, 'operation', revision.operation, 'before', revision.before_data,
        'after', revision.after_data, 'actor_name', coalesce(actor.full_name, 'Akun dihapus'),
        'created_at', revision.created_at, 'batch_id', batch.id
      ) order by revision.created_at desc, revision.id desc)
      from (
        select * from public.attendance_revisions where student_id = p_student_id order by created_at desc, id desc limit 100
      ) revision
      left join public.profiles actor on actor.id = revision.actor_id
      left join public.attendance_batches batch on batch.request_id = revision.request_id
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

create function public.phase6_get_student_report(
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

create function public.phase6_record_student_export(
  p_student_id uuid,
  p_start_date date,
  p_end_date date,
  p_row_count integer,
  p_request_id uuid default gen_random_uuid()
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles%rowtype := private.require_phase4_admin();
begin
  insert into public.audit_logs (scope, actor_id, actor_name_snapshot, action, entity_type, entity_id, metadata, request_id)
  values ('OPERATIONAL', actor.id, actor.full_name, 'STUDENT_REPORT_EXPORT', 'student', p_student_id::text,
    jsonb_build_object('start_date', p_start_date, 'end_date', p_end_date, 'row_count', greatest(p_row_count, 0), 'format', 'xlsx'), p_request_id);
end;
$$;

revoke all on function public.phase6_get_student_attendance(uuid, date, date) from public, anon;
grant execute on function public.phase6_get_student_attendance(uuid, date, date) to authenticated;
revoke all on function public.phase6_get_student_report(uuid, date, date) from public, anon;
grant execute on function public.phase6_get_student_report(uuid, date, date) to authenticated;
revoke all on function public.phase6_record_student_export(uuid, date, date, integer, uuid) from public, anon, authenticated;
grant execute on function public.phase6_record_student_export(uuid, date, date, integer, uuid) to authenticated;
