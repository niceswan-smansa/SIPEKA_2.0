insert into public.periods (number, label, is_active)
select period_number, 'Jam ' || period_number, true
from generate_series(1, 10) as period_number
on conflict (number) do update
set label = excluded.label, is_active = excluded.is_active;

insert into public.academic_years (id, name, start_date, end_date, is_active)
values (
  '10000000-0000-4000-8000-000000000001',
  '2026/2027',
  date '2026-07-01',
  date '2027-06-30',
  true
)
on conflict (id) do update
set
  name = excluded.name,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  is_active = excluded.is_active;

with grade_slots (grade, grade_offset) as (
  values
    ('X'::public.grade_level, 0),
    ('XI'::public.grade_level, 100),
    ('XII'::public.grade_level, 200)
)
insert into public.classes (
  id,
  academic_year_id,
  grade,
  class_number,
  is_active
)
select
  (
    '20000000-0000-4000-8000-' ||
    lpad((grade_offset + class_number)::text, 12, '0')
  )::uuid,
  '10000000-0000-4000-8000-000000000001'::uuid,
  grade,
  class_number,
  true
from grade_slots
cross join generate_series(1, 10) as class_number
on conflict (academic_year_id, grade, class_number) do update
set is_active = excluded.is_active;

-- Akun test dibuat terpisah oleh tools/provision-test-users.mjs menggunakan
-- credential disposable dari environment lokal. Tidak ada password di seed SQL.
