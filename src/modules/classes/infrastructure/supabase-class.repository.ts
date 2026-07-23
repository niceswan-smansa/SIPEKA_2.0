import "server-only";

import { createServerSupabaseClient } from "@/infrastructure/supabase/server";
import { z } from "zod";

import type { ClassRecord, ClassRepository, OperationalGrade } from "../domain/classes";

const classRowsSchema = z.array(
  z.object({
    id: z.uuid(),
    academic_year_id: z.uuid(),
    academic_year_name: z.string(),
    academic_year_active: z.boolean(),
    grade: z.enum(["X", "XI", "XII"]),
    class_number: z.number().int().min(1).max(10),
    homeroom_teacher: z.string().nullable(),
    notes: z.string().nullable(),
    is_active: z.boolean(),
    active_student_count: z.coerce.number().int().nonnegative(),
  }),
);

export function createSupabaseClassRepository(): ClassRepository {
  return {
    async list(query = {}) {
      const client = await createServerSupabaseClient();
      const { data, error } = await client.rpc("phase10_list_classes", {
        ...(query.academicYearId ? { p_academic_year_id: query.academicYearId } : {}),
        ...(query.grade ? { p_grade: query.grade } : {}),
      });
      if (error) throw error;
      return classRowsSchema.parse(data ?? []).map((row) => ({
        id: row.id,
        academicYearId: row.academic_year_id,
        academicYearName: row.academic_year_name,
        academicYearActive: row.academic_year_active,
        grade: row.grade,
        classNumber: row.class_number,
        homeroomTeacher: row.homeroom_teacher,
        notes: row.notes,
        isActive: row.is_active,
        activeStudentCount: row.active_student_count,
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
