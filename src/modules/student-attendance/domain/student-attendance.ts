import { z } from "zod";

import type { AttendanceStatus } from "@/modules/attendance";
import {
  isReportRangeWithinDays,
  monthStart as sharedMonthStart,
  moveMonth as sharedMoveMonth,
} from "@/shared/domain/dates";

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
  .refine((value) => isReportRangeWithinDays(value.startDate, value.endDate), {
    message: "REPORT_DATE_RANGE_INVALID",
  });

export function monthStart(value: string) {
  return sharedMonthStart(value.length === 7 ? `${value}-01` : value);
}

export function moveMonth(value: string, delta: number) {
  return sharedMoveMonth(value, delta);
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
