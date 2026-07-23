create function public.phase5_get_dashboard(p_selected_date date)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  summary jsonb;
  daily jsonb;
  weekly jsonb;
  monthly jsonb;
  week_start date := p_selected_date - (extract(isodow from p_selected_date)::integer - 1);
  month_start date := date_trunc('month', p_selected_date)::date;
  month_end date := (date_trunc('month', p_selected_date) + interval '1 month - 1 day')::date;
begin
  if not private.can_access_operational() then
    raise exception using errcode = '42501', message = 'DASHBOARD_FORBIDDEN';
  end if;

  select jsonb_build_object(
    'total', count(distinct ar.student_id),
    'izin', count(distinct ar.student_id) filter (where ar.status = 'IZIN'),
    'sakit', count(distinct ar.student_id) filter (where ar.status = 'SAKIT'),
    'tanpa_keterangan', count(distinct ar.student_id) filter (where ar.status = 'TANPA_KETERANGAN')
  ) into summary
  from public.attendance_records ar
  where ar.attendance_date = p_selected_date;

  select coalesce(jsonb_agg(jsonb_build_object(
    'class_id', grouped.id,
    'class_label', grouped.grade::text || '-' || grouped.class_number,
    'izin', grouped.izin,
    'sakit', grouped.sakit,
    'tanpa_keterangan', grouped.tanpa_keterangan
  ) order by array_position(array['X','XI','XII'], grouped.grade::text), grouped.class_number), '[]'::jsonb)
  into daily
  from (
    select c.id, c.grade, c.class_number,
      count(distinct ar.student_id) filter (where ar.status = 'IZIN') as izin,
      count(distinct ar.student_id) filter (where ar.status = 'SAKIT') as sakit,
      count(distinct ar.student_id) filter (where ar.status = 'TANPA_KETERANGAN') as tanpa_keterangan
    from public.classes c
    join public.academic_years y on y.id = c.academic_year_id and y.is_active
    left join public.attendance_records ar on ar.class_id = c.id and ar.attendance_date = p_selected_date
    where c.is_active
    group by c.id, c.grade, c.class_number
  ) grouped;

  select coalesce(jsonb_agg(jsonb_build_object(
    'date', grouped.day,
    'label', (array['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'])[extract(isodow from grouped.day)::integer],
    'izin', grouped.izin,
    'sakit', grouped.sakit,
    'tanpa_keterangan', grouped.tanpa_keterangan
  ) order by grouped.day), '[]'::jsonb)
  into weekly
  from (
    select days.day,
      count(distinct ar.student_id) filter (where ar.status = 'IZIN') as izin,
      count(distinct ar.student_id) filter (where ar.status = 'SAKIT') as sakit,
      count(distinct ar.student_id) filter (where ar.status = 'TANPA_KETERANGAN') as tanpa_keterangan
    from generate_series(week_start, week_start + 5, interval '1 day') days(day)
    left join public.attendance_records ar on ar.attendance_date = days.day::date
    group by days.day
  ) grouped;

  select coalesce(jsonb_agg(jsonb_build_object(
    'date', grouped.day,
    'day', extract(day from grouped.day)::integer,
    'total', grouped.total
  ) order by grouped.day), '[]'::jsonb)
  into monthly
  from (
    select days.day,
      count(distinct ar.student_id) as total
    from generate_series(month_start, month_end, interval '1 day') days(day)
    left join public.attendance_records ar on ar.attendance_date = days.day::date
    group by days.day
  ) grouped;

  return jsonb_build_object(
    'selected_date', p_selected_date,
    'summary', summary,
    'daily', daily,
    'weekly', weekly,
    'monthly', monthly
  );
end;
$$;

revoke all on function public.phase5_get_dashboard(date) from public, anon;
grant execute on function public.phase5_get_dashboard(date) to authenticated;
