import "server-only";

import { createServerSupabaseClient } from "@/infrastructure/supabase/server";

import type {
  AttendancePreview,
  AttendanceRepository,
  AttendanceStatus,
  ClassAttendance,
} from "../domain/attendance";

function mapAttendance(value: Record<string, unknown>) {
  return {
    id: String(value.id),
    periodNumber: Number(value.period_number),
    status: value.status as AttendanceStatus,
    note: value.note ? String(value.note) : null,
    version: Number(value.version),
  };
}

export function createSupabaseAttendanceRepository(): AttendanceRepository {
  return {
    async getClassAttendance(classId, attendanceDate, search) {
      const client = await createServerSupabaseClient();
      const { data, error } = await client.rpc("phase4_get_class_attendance", {
        p_class_id: classId,
        p_attendance_date: attendanceDate,
        ...(search ? { p_search: search } : {}),
      });
      if (error || !data) throw error ?? new Error("ATTENDANCE_READ_FAILED");
      const value = data as unknown as Record<string, unknown>;
      return {
        classId: String(value.class_id),
        attendanceDate: String(value.attendance_date),
        items: ((value.items as Record<string, unknown>[]) ?? []).map((item) => ({
          id: String(item.id),
          fullName: String(item.full_name),
          nis: item.nis === null ? null : String(item.nis),
          nisn: item.nisn === null ? null : String(item.nisn),
          attendance: ((item.attendance as Record<string, unknown>[]) ?? []).map(mapAttendance),
        })),
      } satisfies ClassAttendance;
    },
    async preview(input) {
      const client = await createServerSupabaseClient();
      const { data, error } = await client.rpc("phase4_preview_attendance", {
        p_class_id: input.classId,
        p_attendance_date: input.attendanceDate,
        p_payload: input.operations.map((operation) => ({
          student_id: operation.studentId,
          period_number: operation.periodNumber,
          mode: operation.mode,
          ...(operation.status ? { status: operation.status } : {}),
          ...(operation.note !== undefined ? { note: operation.note } : {}),
        })),
      });
      if (error || !data) throw error ?? new Error("ATTENDANCE_PREVIEW_FAILED");
      const value = data as unknown as Record<string, unknown>;
      return {
        token: String(value.token),
        requestId: String(value.request_id),
        expiresAt: String(value.expires_at),
        diff: (value.diff as Array<Record<string, unknown>>) ?? [],
        summary: value.summary as AttendancePreview["summary"],
      };
    },
    async apply(input) {
      const client = await createServerSupabaseClient();
      const { data, error } = await client.rpc("phase4_apply_attendance", {
        p_token: input.token,
        p_class_id: input.classId,
        p_attendance_date: input.attendanceDate,
        p_payload: input.operations.map((operation) => ({
          student_id: operation.studentId,
          period_number: operation.periodNumber,
          mode: operation.mode,
          ...(operation.status ? { status: operation.status } : {}),
          ...(operation.note !== undefined ? { note: operation.note } : {}),
        })),
      });
      if (error || !data) throw error ?? new Error("ATTENDANCE_APPLY_FAILED");
      const value = data as unknown as Record<string, unknown>;
      return {
        batchId: String(value.batch_id),
        new: Number(value.new ?? 0),
        update: Number(value.update ?? 0),
        delete: Number(value.delete ?? 0),
        unchanged: Number(value.unchanged ?? 0),
        invalid: 0,
        stale: 0,
      };
    },
  };
}
