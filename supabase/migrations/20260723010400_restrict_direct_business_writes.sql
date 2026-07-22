-- Business writes stay closed until their owning phase supplies an authorized,
-- transactional server service or RPC with validation, revision, and audit.
drop policy if exists academic_years_insert_admin on public.academic_years;
drop policy if exists academic_years_update_admin on public.academic_years;
drop policy if exists classes_insert_admin on public.classes;
drop policy if exists classes_update_admin on public.classes;
drop policy if exists students_insert_admin on public.students;
drop policy if exists students_update_admin on public.students;
drop policy if exists student_enrollments_insert_admin on public.student_enrollments;
drop policy if exists student_enrollments_update_admin on public.student_enrollments;

revoke insert, update, delete on table
  public.academic_years,
  public.classes,
  public.students,
  public.student_enrollments,
  public.attendance_records,
  public.attendance_revisions,
  public.import_batches,
  public.attendance_batches,
  public.promotion_batches,
  public.promotion_batch_items,
  public.audit_logs
from authenticated;
