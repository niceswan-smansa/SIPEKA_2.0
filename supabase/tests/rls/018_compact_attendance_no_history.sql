begin;

select no_plan();

select ok(
  to_regclass('public.attendance_days') is not null,
  'attendance_days menjadi storage presensi utama'
);

select ok(
  exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'attendance_records'
      and c.relkind = 'v'
  ),
  'attendance_records tersedia hanya sebagai compatibility view'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'attendance_days'
      and column_name = 'period_statuses'
      and data_type = 'jsonb'
  ),
  'status Jam 1-10 disimpan dalam satu JSON harian'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'attendance_days'
      and column_name in ('created_by', 'updated_by')
  ),
  'attendance_days tidak menyimpan identitas pelaku'
);

select has_function(
  'public',
  'phase4_preview_attendance',
  array['uuid', 'date', 'jsonb', 'uuid'],
  'preview attendance tetap tersedia'
);

select has_function(
  'public',
  'phase4_apply_attendance',
  array['text', 'uuid', 'date', 'jsonb', 'uuid'],
  'apply attendance tetap tersedia'
);

select * from finish();

rollback;
