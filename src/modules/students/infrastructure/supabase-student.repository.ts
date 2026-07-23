import "server-only";

import { createServerSupabaseClient } from "@/infrastructure/supabase/server";

import type {
  EnrollmentHistory,
  StudentDetail,
  StudentListResult,
  StudentRecord,
  StudentRepository,
} from "../domain/students";

function mapStudent(value: Record<string, unknown>): StudentRecord {
  return {
    id: String(value.id),
    nis: value.nis === null ? null : String(value.nis),
    nisn: value.nisn === null ? null : String(value.nisn),
    fullName: String(value.full_name),
    gender: value.gender as "L" | "P",
    currentGrade: value.current_grade as StudentRecord["currentGrade"],
    currentClassId: value.current_class_id ? String(value.current_class_id) : null,
    classNumber: value.class_number === null ? null : Number(value.class_number),
    homeroomTeacher: value.homeroom_teacher ? String(value.homeroom_teacher) : null,
    academicYearId: value.academic_year_id ? String(value.academic_year_id) : null,
    yearEntered: value.year_entered === null ? null : Number(value.year_entered),
    graduationYear: value.graduation_year === null ? null : Number(value.graduation_year),
    isActive: Boolean(value.is_active),
  };
}

export function createSupabaseStudentRepository(): StudentRepository {
  return {
    async search(query) {
      const client = await createServerSupabaseClient();
      const { data, error } = await client.rpc("phase3_search_students", {
        p_page: query.page,
        p_page_size: query.pageSize,
        ...(query.search ? { p_search: query.search } : {}),
        ...(query.grade ? { p_grade: query.grade } : {}),
        ...(query.classId ? { p_class_id: query.classId } : {}),
        ...(query.active !== undefined ? { p_is_active: query.active } : {}),
        ...(query.yearEntered !== undefined ? { p_year_entered: query.yearEntered } : {}),
      });
      if (error || !data) throw error ?? new Error("STUDENT_SEARCH_FAILED");
      const value = data as Record<string, unknown>;
      return {
        items: ((value.items as Record<string, unknown>[]) ?? []).map(mapStudent),
        total: Number(value.total ?? 0),
        page: Number(value.page ?? query.page),
        pageSize: Number(value.page_size ?? query.pageSize),
      } satisfies StudentListResult;
    },
    async getDetail(id) {
      const client = await createServerSupabaseClient();
      const [studentResult, enrollmentResult] = await Promise.all([
        client
          .from("students")
          .select(
            "id, nis, nisn, full_name, gender, current_grade, current_class_id, year_entered, graduation_year, is_active, classes!students_current_class_id_fkey(class_number, homeroom_teacher, academic_year_id)",
          )
          .eq("id", id)
          .maybeSingle(),
        client
          .from("student_enrollments")
          .select(
            "id, grade, started_on, ended_on, is_current, classes!student_enrollments_class_id_fkey(class_number), academic_years!inner(name)",
          )
          .eq("student_id", id)
          .order("started_on", { ascending: false })
          .order("id", { ascending: false }),
      ]);
      if (studentResult.error) throw studentResult.error;
      if (enrollmentResult.error) throw enrollmentResult.error;
      if (!studentResult.data) return null;

      const row = studentResult.data as unknown as Record<string, unknown>;
      const currentClass = row.classes as Record<string, unknown> | null;
      const student = mapStudent({
        ...row,
        class_number: currentClass?.class_number ?? null,
        homeroom_teacher: currentClass?.homeroom_teacher ?? null,
        academic_year_id: currentClass?.academic_year_id ?? null,
      });
      const enrollments = (enrollmentResult.data ?? []).map((item) => {
        const enrollment = item as unknown as Record<string, unknown>;
        const assignedClass = enrollment.classes as Record<string, unknown> | null;
        const academicYear = enrollment.academic_years as Record<string, unknown>;
        return {
          id: String(enrollment.id),
          academicYearName: String(academicYear.name),
          grade: enrollment.grade as EnrollmentHistory["grade"],
          classNumber: assignedClass ? Number(assignedClass.class_number) : null,
          startedOn: String(enrollment.started_on),
          endedOn: enrollment.ended_on ? String(enrollment.ended_on) : null,
          isCurrent: Boolean(enrollment.is_current),
        } satisfies EnrollmentHistory;
      });
      return { ...student, enrollments } satisfies StudentDetail;
    },
    async create(input) {
      const client = await createServerSupabaseClient();
      const { data, error } = await client.rpc("phase3_create_student", {
        p_full_name: input.fullName,
        p_nis: input.nis ?? "",
        p_nisn: input.nisn ?? "",
        p_gender: input.gender,
        p_grade: input.grade,
        p_class_id: input.classId,
        p_year_entered: input.yearEntered,
        p_is_active: input.isActive,
      });
      if (error || !data) throw error ?? new Error("STUDENT_CREATE_FAILED");
      return String((data as Record<string, unknown>).id);
    },
    async updateIdentity(input) {
      const client = await createServerSupabaseClient();
      const { error } = await client.rpc("phase3_update_student_identity", {
        p_id: input.id,
        p_full_name: input.fullName,
        p_nis: input.nis ?? "",
        p_nisn: input.nisn ?? "",
        p_gender: input.gender,
        p_year_entered: input.yearEntered,
      });
      if (error) throw error;
    },
    async changeAcademic(input) {
      const client = await createServerSupabaseClient();
      const { error } = await client.rpc("phase3_change_student_academic", {
        p_id: input.id,
        p_grade: input.grade,
        p_class_id: input.classId,
        p_is_active: input.isActive,
      });
      if (error) throw error;
    },
  };
}
