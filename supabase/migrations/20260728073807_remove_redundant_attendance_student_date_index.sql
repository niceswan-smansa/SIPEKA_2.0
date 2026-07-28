begin;

-- The UNIQUE constraint attendance_days_student_date_key already owns an
-- equivalent btree index on (student_id, attendance_date). Keep the unique
-- constraint/index and remove only the redundant non-unique copy.
drop index if exists public.attendance_days_student_date_idx;

commit;
