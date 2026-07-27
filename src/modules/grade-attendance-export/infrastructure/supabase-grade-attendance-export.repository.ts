import "server-only";

import { z } from "zod";

import { createServerSupabaseClient } from "@/infrastructure/supabase/server";

import type {
  GradeAttendanceExportData,
  GradeAttendanceExportRepository,
} from "../domain/grade-attendance-export";

const exportDataSchema = z.object({
  academic_year: z.object({
    id: z.uuid(),
    name: z.string(),
    start_date: z.iso.date(),
    end_date: z.iso.date(),
  }),
  grade: z.enum(["X", "XI", "XII"]),
  start_date: z.iso.date(),
  end_date: z.iso.date(),
  classes: z.array(
    z.object({
      id: z.uuid(),
      class_number: z.coerce.number().int().min(1).max(10),
      homeroom_teacher: z.string().nullable(),
      students: z.array(
        z.object({
          id: z.uuid(),
          nis: z.string().nullable(),
          nisn: z.string().nullable(),
          full_name: z.string(),
          gender: z.enum(["L", "P"]),
          attendance: z.array(
            z.object({
              date: z.iso.date(),
              status: z.enum(["SAKIT", "IZIN", "TANPA_KETERANGAN"]),
            }),
          ),
        }),
      ),
    }),
  ),
});

export function createSupabaseGradeAttendanceExportRepository(): GradeAttendanceExportRepository {
  return {
    async get(grade, startDate, endDate) {
      const client = await createServerSupabaseClient();
      const { data, error } = await client.rpc("phase12_get_grade_attendance_export", {
        p_grade: grade,
        p_start_date: startDate,
        p_end_date: endDate,
      });

      if (error || !data) {
        throw error ?? new Error("GRADE_ATTENDANCE_EXPORT_READ_FAILED");
      }

      const value = exportDataSchema.parse(data);

      return {
        academicYear: {
          id: value.academic_year.id,
          name: value.academic_year.name,
          startDate: value.academic_year.start_date,
          endDate: value.academic_year.end_date,
        },
        grade: value.grade,
        startDate: value.start_date,
        endDate: value.end_date,
        classes: value.classes.map((classItem) => ({
          id: classItem.id,
          classNumber: classItem.class_number,
          homeroomTeacher: classItem.homeroom_teacher,
          students: classItem.students.map((student) => ({
            id: student.id,
            nis: student.nis,
            nisn: student.nisn,
            fullName: student.full_name,
            gender: student.gender,
            attendance: student.attendance,
          })),
        })),
      } satisfies GradeAttendanceExportData;
    },
  };
}
