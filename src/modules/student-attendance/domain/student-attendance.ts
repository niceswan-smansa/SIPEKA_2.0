import { z } from "zod";

import type { AttendanceStatus } from "@/modules/attendance";

export type StudentPeriodAttendance = {
  id: string;
  periodNumber: number;
  status: AttendanceStatus;
  note: string | null;
  classId: string;
  createdAt: string;
  updatedAt: string;
  createdByName: string;
  updatedByName: string;
};
export type StudentAttendanceData = {
  periods: StudentPeriodAttendance[];
  calendar: Array<{ date: string; statuses: AttendanceStatus[] }>;
  stats: Record<string, number>;
  trend: Array<{ date: string; day: number; izin: number; sakit: number; tanpaKeterangan: number }>;
  revisions: Array<Record<string, unknown>>;
};
export type StudentReportRow = {
  date: string;
  periodNumber: number;
  status: AttendanceStatus;
  note: string | null;
  recordedBy: string;
  createdAt: string;
  updatedAt: string;
};

export const reportRangeSchema = z
  .object({ startDate: z.iso.date(), endDate: z.iso.date() })
  .refine((value) => value.startDate <= value.endDate, { message: "REPORT_DATE_RANGE_INVALID" });

export function monthStart(value: string) {
  const match = /^(\d{4})-(\d{2})/.exec(value);
  if (!match) throw new Error("INVALID_MONTH");
  return `${match[1]!}-${match[2]!}-01`;
}

export function moveMonth(value: string, delta: number) {
  const start = monthStart(value);
  const [year, month] = start.split("-").map(Number) as [number, number, number];
  const target = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export interface StudentAttendanceRepository {
  get(studentId: string, selectedDate: string, month: string): Promise<StudentAttendanceData>;
  getReport(studentId: string, startDate: string, endDate: string): Promise<StudentReportRow[]>;
  recordExport(
    studentId: string,
    startDate: string,
    endDate: string,
    rowCount: number,
  ): Promise<void>;
}
