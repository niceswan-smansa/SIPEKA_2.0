create function public.phase3_search_students(
  p_search text default null,
  p_grade public.grade_level default null,
  p_class_id uuid default null,
  p_is_active boolean default null,
  p_year_entered integer default null,
  p_page integer default 1,
  p_page_size integer default 20
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
  if p_page < 1 or p_page_size < 1 or p_page_size > 50 then
    raise exception using errcode = '22023', message = 'PAGINATION_INVALID';
  end if;

  with filtered as (
    select
      s.id, s.nis, s.nisn, s.full_name, s.gender, s.current_grade,
      s.current_class_id, s.year_entered, s.graduation_year, s.is_active,
      c.class_number, c.homeroom_teacher, c.academic_year_id
    from public.students s
    left join public.classes c on c.id = s.current_class_id
    where (normalized_search = '' or s.normalized_name ilike '%' || normalized_search || '%'
      or s.nis ilike '%' || btrim(coalesce(p_search, '')) || '%'
      or s.nisn ilike '%' || btrim(coalesce(p_search, '')) || '%')
      and (p_grade is null or s.current_grade = p_grade)
      and (p_class_id is null or s.current_class_id = p_class_id)
      and (p_is_active is null or s.is_active = p_is_active)
      and (p_year_entered is null or s.year_entered = p_year_entered)
  ), paged as (
    select * from filtered
    order by full_name asc, id asc
    offset (p_page - 1) * p_page_size
    limit p_page_size
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(to_jsonb(paged) order by full_name, id) from paged), '[]'::jsonb),
    'total', (select count(*) from filtered),
    'page', p_page,
    'page_size', p_page_size
  ) into result;

  return result;
end;
$$;

revoke all on function public.phase3_search_students(text, public.grade_level, uuid, boolean, integer, integer, integer)
  from public, anon;
grant execute on function public.phase3_search_students(text, public.grade_level, uuid, boolean, integer, integer, integer)
  to authenticated;
