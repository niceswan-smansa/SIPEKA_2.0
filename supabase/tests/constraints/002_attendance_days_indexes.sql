begin;

select no_plan();

select ok(
  to_regclass('public.attendance_days_student_date_idx') is null,
  'redundant non-unique student/date index is removed'
);

select ok(
  exists (
    select 1
    from pg_constraint constraint_row
    join pg_class table_row
      on table_row.oid = constraint_row.conrelid
    join pg_namespace schema_row
      on schema_row.oid = table_row.relnamespace
    join pg_class index_row
      on index_row.oid = constraint_row.conindid
    where schema_row.nspname = 'public'
      and table_row.relname = 'attendance_days'
      and constraint_row.conname = 'attendance_days_student_date_key'
      and constraint_row.contype = 'u'
      and index_row.relname = 'attendance_days_student_date_key'
  ),
  'unique student/date constraint and backing index remain'
);

select is(
  (
    select count(*)
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'attendance_days'
      and indexdef like '%USING btree (student_id, attendance_date)'
  ),
  1::bigint,
  'only one btree index remains for student_id and attendance_date'
);

select ok(
  to_regclass('public.attendance_days_date_idx') is not null,
  'date-only dashboard index remains'
);

select ok(
  to_regclass('public.attendance_days_class_date_idx') is not null,
  'class/date snapshot and dashboard index remains'
);

select * from finish();

rollback;
