import { z } from "zod";

export const ATTENDANCE_STATUSES = ["IZIN", "SAKIT", "TANPA_KETERANGAN"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const attendanceOperationSchema = z.object({
  studentId: z.uuid(),
  periodNumber: z.number().int().min(1).max(10),
  mode: z.enum(["upsert", "delete"]).default("upsert"),
  status: z.enum(ATTENDANCE_STATUSES).optional(),
  note: z.string().trim().max(500).optional(),
});

export const attendanceBatchSchema = z.object({
  classId: z.uuid(),
  attendanceDate: z.iso.date(),
  operations: z.array(attendanceOperationSchema).max(3000),
});

export type AttendanceOperation = z.infer<typeof attendanceOperationSchema>;
export type AttendanceBatchInput = z.infer<typeof attendanceBatchSchema>;

export type ExistingAttendance = {
  id: string;
  periodNumber: number;
  status: AttendanceStatus;
  note: string | null;
  version: number;
};

export type AttendanceStudent = {
  id: string;
  fullName: string;
  nis: string;
  nisn: string;
  attendance: ExistingAttendance[];
};

export type ClassAttendance = {
  classId: string;
  attendanceDate: string;
  items: AttendanceStudent[];
};

export type AttendanceSummary = {
  new: number;
  update: number;
  delete: number;
  unchanged: number;
  invalid: number;
  stale: number;
};

export type AttendancePreview = {
  token: string;
  requestId: string;
  expiresAt: string;
  diff: Array<Record<string, unknown>>;
  summary: AttendanceSummary;
};

export type AttendanceApplyResult = AttendanceSummary & { batchId: string };

export interface AttendanceRepository {
  getClassAttendance(
    classId: string,
    attendanceDate: string,
    search?: string,
  ): Promise<ClassAttendance>;
  preview(input: AttendanceBatchInput): Promise<AttendancePreview>;
  apply(input: AttendanceBatchInput & { token: string }): Promise<AttendanceApplyResult>;
}

export function todayJakarta() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}

export function buildOperations(
  studentId: string,
  draft: Record<number, { status: AttendanceStatus; note: string } | null>,
  existing: ExistingAttendance[],
) {
  const operations: AttendanceOperation[] = [];
  for (let period = 1; period <= 10; period += 1) {
    if (!(period in draft)) continue;
    const value = draft[period];
    const current = existing.find((item) => item.periodNumber === period);
    if (!value) {
      if (current) operations.push({ studentId, periodNumber: period, mode: "delete" });
      continue;
    }
    if (!current || current.status !== value.status || (current.note ?? "") !== value.note) {
      operations.push({
        studentId,
        periodNumber: period,
        mode: "upsert",
        status: value.status,
        note: value.note || undefined,
      });
    }
  }
  return operations;
}
