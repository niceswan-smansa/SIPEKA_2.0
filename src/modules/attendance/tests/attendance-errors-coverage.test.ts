import { describe, expect, it } from "vitest";

import { attendanceFailureMessage } from "../domain/attendance-errors";

describe("attendance failure messages", () => {
  it("maps every failure family to an actionable message", () => {
    expect(attendanceFailureMessage("ATTENDANCE_NO_CHANGES", "ref-1")).toEqual({
      tone: "info",
      text: "Tidak ada perubahan presensi yang perlu disimpan.",
    });

    for (const code of ["STALE_PREVIEW", "ATTENDANCE_ROSTER_CHANGED"]) {
      expect(attendanceFailureMessage(code, "ref-2")).toMatchObject({
        tone: "info",
        text: expect.stringContaining("Muat ulang"),
      });
    }

    expect(attendanceFailureMessage("ATTENDANCE_TOKEN_USED", "ref-3").text).toContain(
      "sudah digunakan",
    );
    expect(attendanceFailureMessage("ATTENDANCE_TOKEN_EXPIRED", "ref-4").text).toContain(
      "kedaluwarsa",
    );
    expect(
      attendanceFailureMessage("ATTENDANCE_PERIOD_CONFIGURATION_INVALID", "ref-5").text,
    ).toContain("Jam 1–10");
    expect(attendanceFailureMessage("ATTENDANCE_CLASS_CONFLICT", "ref-6").text).toContain(
      "kelas lain",
    );

    for (const code of [
      "DATE_OUTSIDE_ACADEMIC_YEAR",
      "CLASS_INACTIVE_OR_NOT_FOUND",
      "ATTENDANCE_SCOPE_INVALID",
    ]) {
      expect(attendanceFailureMessage(code, "ref-7").text).toContain("tahun ajaran");
    }

    expect(attendanceFailureMessage("FUTURE_DATE_NOT_ALLOWED", "ref-8").text).toContain(
      "masa depan",
    );
    expect(attendanceFailureMessage("UNKNOWN", "ref-9")).toMatchObject({
      tone: "error",
      text: expect.stringContaining("ref-9"),
    });
  });
});
