import "server-only";

import { createServerSupabaseClient } from "@/infrastructure/supabase/server";

import type {
  StudentAttendanceData,
  StudentAttendanceRepository,
  StudentPeriodAttendance,
  StudentReportRow,
} from "../domain/student-attendance";

export function createSupabaseStudentAttendanceRepository(): StudentAttendanceRepository {
  return {
    async get(studentId, selectedDate, month) {
      const client = await createServerSupabaseClient();
      const { data, error } = await client.rpc("phase6_get_student_attendance", {
        p_student_id: studentId,
        p_selected_date: selectedDate,
        p_month: month,
      });
      if (error || !data) throw error ?? new Error("STUDENT_ATTENDANCE_READ_FAILED");
      const value = data as unknown as Record<string, unknown>;
      return {
        periods: ((value.periods as Record<string, unknown>[]) ?? []).map((item) => ({
          id: String(item.id),
          periodNumber: Number(item.period_number),
          status: item.status as StudentPeriodAttendance["status"],
          note: item.note ? String(item.note) : null,
          classId: String(item.class_id),
          createdAt: String(item.created_at),
          updatedAt: String(item.updated_at),
          createdByName: String(item.created_by_name),
          updatedByName: String(item.updated_by_name),
        })),
        calendar: ((value.calendar as Record<string, unknown>[]) ?? []).map((item) => ({
          date: String(item.date),
          statuses: ((item.statuses as string[]) ?? []) as StudentPeriodAttendance["status"][],
        })),
        stats: Object.fromEntries(
          Object.entries((value.stats as Record<string, unknown>) ?? {}).map(([key, count]) => [
            key,
            Number(count),
          ]),
        ),
        trend: ((value.trend as Record<string, unknown>[]) ?? []).map((item) => ({
          date: String(item.date),
          day: Number(item.day),
          izin: Number(item.izin),
          sakit: Number(item.sakit),
          tanpaKeterangan: Number(item.tanpa_keterangan),
        })),
        revisions: (value.revisions as Array<Record<string, unknown>>) ?? [],
      } satisfies StudentAttendanceData;
    },
    async getReport(studentId, startDate, endDate) {
      const client = await createServerSupabaseClient();
      const { data, error } = await client.rpc("phase10_get_student_report", {
        p_student_id: studentId,
        p_start_date: startDate,
        p_end_date: endDate,
      });
      if (error || !data) throw error ?? new Error("STUDENT_REPORT_READ_FAILED");
      return ((data as unknown as Record<string, unknown>[]) ?? []).map((item) => ({
        date: String(item.date),
        periodNumber: Number(item.period_number),
        status: item.status as StudentReportRow["status"],
        note: item.note ? String(item.note) : null,
        recordedBy: String(item.recorded_by),
        createdAt: String(item.created_at),
        updatedAt: String(item.updated_at),
      }));
    },
    async recordExport(studentId, startDate, endDate, rowCount) {
      const client = await createServerSupabaseClient();
      const { error } = await client.rpc("phase6_record_student_export", {
        p_student_id: studentId,
        p_start_date: startDate,
        p_end_date: endDate,
        p_row_count: rowCount,
      });
      if (error) throw error;
    },
  };
}
