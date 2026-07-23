import "server-only";

import { createServerSupabaseClient } from "@/infrastructure/supabase/server";

import type { ClassRecord, ClassRepository, OperationalGrade } from "../domain/classes";

export function createSupabaseClassRepository(): ClassRepository {
  return {
    async list(query = {}) {
      const client = await createServerSupabaseClient();
      let classRequest = client
        .from("classes")
        .select(
          "id, academic_year_id, grade, class_number, homeroom_teacher, notes, is_active, academic_years!inner(name, is_active)",
        )
        .order("academic_year_id", { ascending: false })
        .order("grade", { ascending: true })
        .order("class_number", { ascending: true });
      if (query.academicYearId)
        classRequest = classRequest.eq("academic_year_id", query.academicYearId);
      if (query.grade) classRequest = classRequest.eq("grade", query.grade);

      const [classesResult, enrollmentResult] = await Promise.all([
        classRequest,
        client
          .from("student_enrollments")
          .select("class_id, students!inner(is_active)")
          .eq("is_current", true)
          .eq("students.is_active", true),
      ]);
      if (classesResult.error) throw classesResult.error;
      if (enrollmentResult.error) throw enrollmentResult.error;

      const counts = new Map<string, number>();
      for (const row of enrollmentResult.data ?? []) {
        if (row.class_id) counts.set(row.class_id, (counts.get(row.class_id) ?? 0) + 1);
      }

      return (classesResult.data ?? []).map((row) => ({
        id: row.id,
        academicYearId: row.academic_year_id,
        academicYearName: row.academic_years.name,
        academicYearActive: row.academic_years.is_active,
        grade: row.grade as OperationalGrade,
        classNumber: row.class_number,
        homeroomTeacher: row.homeroom_teacher,
        notes: row.notes,
        isActive: row.is_active,
        activeStudentCount: counts.get(row.id) ?? 0,
      }));
    },
    async update(input) {
      const client = await createServerSupabaseClient();
      const { data, error } = await client.rpc("phase3_update_class", {
        p_id: input.id,
        p_homeroom_teacher: input.homeroomTeacher,
        p_notes: input.notes,
        p_is_active: input.isActive,
      });
      if (error || !data) throw error ?? new Error("CLASS_UPDATE_FAILED");
      const row = data as Record<string, unknown>;
      return {
        id: String(row.id),
        academicYearId: String(row.academic_year_id),
        academicYearName: "",
        academicYearActive: false,
        grade: row.grade as OperationalGrade,
        classNumber: Number(row.class_number),
        homeroomTeacher: row.homeroom_teacher ? String(row.homeroom_teacher) : null,
        notes: row.notes ? String(row.notes) : null,
        isActive: Boolean(row.is_active),
        activeStudentCount: 0,
      } satisfies ClassRecord;
    },
  };
}
