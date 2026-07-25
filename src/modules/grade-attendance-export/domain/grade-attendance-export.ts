import { z } from "zod";

import { isReportRangeWithinDays } from "@/shared/domain/dates";

export const GRADE_ATTENDANCE_EXPORT_GRADES = ["X", "XI", "XII"] as const;
export const GRADE_ATTENDANCE_EXPORT_STATUSES = ["SAKIT", "IZIN", "TANPA_KETERANGAN"] as const;

export type GradeAttendanceExportGrade = (typeof GRADE_ATTENDANCE_EXPORT_GRADES)[number];
export type GradeAttendanceExportStatus = (typeof GRADE_ATTENDANCE_EXPORT_STATUSES)[number];

export const gradeAttendanceExportRequestSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("monthly"),
    grade: z.enum(GRADE_ATTENDANCE_EXPORT_GRADES),
    month: z.string().regex(/^\d{4}-\d{2}$/),
  }),
  z.object({
    mode: z.literal("custom"),
    grade: z.enum(GRADE_ATTENDANCE_EXPORT_GRADES),
    from: z.iso.date(),
    to: z.iso.date(),
  }),
]);

export type GradeAttendanceExportRequest = z.infer<typeof gradeAttendanceExportRequestSchema>;

export type GradeAttendanceExportRecord = {
  date: string;
  status: GradeAttendanceExportStatus;
};

export type GradeAttendanceExportStudent = {
  id: string;
  nis: string | null;
  nisn: string | null;
  fullName: string;
  gender: "L" | "P";
  attendance: GradeAttendanceExportRecord[];
};

export type GradeAttendanceExportClass = {
  id: string;
  classNumber: number;
  homeroomTeacher: string | null;
  students: GradeAttendanceExportStudent[];
};

export type GradeAttendanceExportData = {
  academicYear: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
  };
  grade: GradeAttendanceExportGrade;
  startDate: string;
  endDate: string;
  classes: GradeAttendanceExportClass[];
};

export type GradeAttendanceExportMetrics = {
  classCount: number;
  studentCount: number;
  impactedStudentCount: number;
};

export interface GradeAttendanceExportRepository {
  get(
    grade: GradeAttendanceExportGrade,
    startDate: string,
    endDate: string,
  ): Promise<GradeAttendanceExportData>;
  recordExport(input: {
    grade: GradeAttendanceExportGrade;
    startDate: string;
    endDate: string;
    metrics: GradeAttendanceExportMetrics;
  }): Promise<void>;
}

export type StudentAttendanceSummary = {
  byDate: Map<string, Set<GradeAttendanceExportStatus>>;
  sakitDates: string[];
  izinDates: string[];
  tanpaKeteranganDates: string[];
  jumlahSakit: number;
  jumlahIzin: number;
  jumlahTanpaKeterangan: number;
  totalHari: number;
};

function monthEnd(month: string) {
  const [year, monthNumber] = month.split("-").map(Number) as [number, number];
  const date = new Date(Date.UTC(year, monthNumber, 0));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate(),
  ).padStart(2, "0")}`;
}

export function resolveGradeAttendanceExportRange(
  request: GradeAttendanceExportRequest,
  activeYear: { startDate: string; endDate: string },
  today: string,
) {
  let startDate: string;
  let endDate: string;

  if (request.mode === "monthly") {
    const rawStart = `${request.month}-01`;
    const rawEnd = monthEnd(request.month);
    startDate = rawStart < activeYear.startDate ? activeYear.startDate : rawStart;
    endDate = [rawEnd, activeYear.endDate, today].sort()[0]!;
  } else {
    startDate = request.from;
    endDate = request.to;
  }

  if (
    startDate < activeYear.startDate ||
    endDate > activeYear.endDate ||
    endDate > today ||
    !isReportRangeWithinDays(startDate, endDate)
  ) {
    throw new Error("GRADE_ATTENDANCE_EXPORT_RANGE_INVALID");
  }

  return { startDate, endDate };
}

export function datesInRange(startDate: string, endDate: string) {
  if (!isReportRangeWithinDays(startDate, endDate)) {
    throw new Error("GRADE_ATTENDANCE_EXPORT_RANGE_INVALID");
  }

  const dates: string[] = [];
  const end = Date.parse(`${endDate}T00:00:00Z`);

  for (let cursor = Date.parse(`${startDate}T00:00:00Z`); cursor <= end; cursor += 86_400_000) {
    dates.push(new Date(cursor).toISOString().slice(0, 10));
  }

  return dates;
}

export function summarizeStudentAttendance(
  records: GradeAttendanceExportRecord[],
): StudentAttendanceSummary {
  const byDate = new Map<string, Set<GradeAttendanceExportStatus>>();

  for (const record of records) {
    const statuses = byDate.get(record.date) ?? new Set<GradeAttendanceExportStatus>();
    statuses.add(record.status);
    byDate.set(record.date, statuses);
  }

  const datesFor = (status: GradeAttendanceExportStatus) =>
    [...byDate.entries()]
      .filter(([, statuses]) => statuses.has(status))
      .map(([date]) => date)
      .sort();

  const sakitDates = datesFor("SAKIT");
  const izinDates = datesFor("IZIN");
  const tanpaKeteranganDates = datesFor("TANPA_KETERANGAN");

  return {
    byDate,
    sakitDates,
    izinDates,
    tanpaKeteranganDates,
    jumlahSakit: sakitDates.length,
    jumlahIzin: izinDates.length,
    jumlahTanpaKeterangan: tanpaKeteranganDates.length,
    totalHari: byDate.size,
  };
}

export function attendanceSymbol(statuses: Set<GradeAttendanceExportStatus> | undefined) {
  if (!statuses?.size) return ".";

  return GRADE_ATTENDANCE_EXPORT_STATUSES.filter((status) => statuses.has(status))
    .map((status) => {
      if (status === "SAKIT") return "S";
      if (status === "IZIN") return "I";
      return "A";
    })
    .join("/");
}
