import { describe, expect, it } from "vitest";

import {
  attendanceSymbol,
  datesInRange,
  resolveGradeAttendanceExportRange,
  summarizeStudentAttendance,
} from "../domain/grade-attendance-export";

describe("grade attendance export", () => {
  it("caps the current monthly period at today", () => {
    expect(
      resolveGradeAttendanceExportRange(
        { mode: "monthly", grade: "X", month: "2026-07" },
        { startDate: "2026-07-01", endDate: "2027-06-30" },
        "2026-07-25",
      ),
    ).toEqual({ startDate: "2026-07-01", endDate: "2026-07-25" });
  });

  it("rejects custom dates outside the active academic year", () => {
    expect(() =>
      resolveGradeAttendanceExportRange(
        {
          mode: "custom",
          grade: "XI",
          from: "2026-06-30",
          to: "2026-07-02",
        },
        { startDate: "2026-07-01", endDate: "2027-06-30" },
        "2026-07-25",
      ),
    ).toThrow("GRADE_ATTENDANCE_EXPORT_RANGE_INVALID");
  });

  it("builds an inclusive list of dates", () => {
    expect(datesInRange("2026-07-01", "2026-07-03")).toEqual([
      "2026-07-01",
      "2026-07-02",
      "2026-07-03",
    ]);
  });

  it("summarizes unique days while preserving mixed statuses", () => {
    const summary = summarizeStudentAttendance([
      { date: "2026-07-02", status: "SAKIT" },
      { date: "2026-07-02", status: "SAKIT" },
      { date: "2026-07-02", status: "IZIN" },
      { date: "2026-07-03", status: "TANPA_KETERANGAN" },
    ]);

    expect(attendanceSymbol(summary.byDate.get("2026-07-02"))).toBe("S/I");
    expect(summary.sakitDates).toEqual(["2026-07-02"]);
    expect(summary.izinDates).toEqual(["2026-07-02"]);
    expect(summary.tanpaKeteranganDates).toEqual(["2026-07-03"]);
    expect(summary.jumlahSakit).toBe(1);
    expect(summary.jumlahIzin).toBe(1);
    expect(summary.jumlahTanpaKeterangan).toBe(1);
    expect(summary.totalHari).toBe(2);
  });
});
