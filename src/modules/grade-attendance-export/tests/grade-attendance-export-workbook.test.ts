import ExcelJS from "exceljs";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildGradeAttendanceWorkbook,
  createGradeAttendanceExportService,
} from "../application/grade-attendance-export-service";
import type {
  GradeAttendanceExportData,
  GradeAttendanceExportRepository,
} from "../domain/grade-attendance-export";

const exportData: GradeAttendanceExportData = {
  academicYear: {
    id: "academic-year-1",
    name: "2026/2027",
    startDate: "2026-07-01",
    endDate: "2027-06-30",
  },
  grade: "X",
  startDate: "2026-07-01",
  endDate: "2026-07-03",
  classes: [
    {
      id: "class-1",
      classNumber: 1,
      homeroomTeacher: "=Wali Kelas",
      students: [
        {
          id: "student-1",
          nis: "=001",
          nisn: "+002",
          fullName: "@Siswa Pertama",
          gender: "L",
          attendance: [
            { date: "2026-07-01", status: "SAKIT" },
            { date: "2026-07-01", status: "IZIN" },
            { date: "2026-07-02", status: "TANPA_KETERANGAN" },
          ],
        },
        {
          id: "student-2",
          nis: null,
          nisn: null,
          fullName: "Siswa Kedua",
          gender: "P",
          attendance: [],
        },
      ],
    },
    {
      id: "class-2",
      classNumber: 2,
      homeroomTeacher: null,
      students: [],
    },
  ],
};

describe("grade attendance workbook service", () => {
  it("preserves repository operations without wrapping their identity", () => {
    const get = vi.fn();
    const repository = {
      get,
    } as unknown as GradeAttendanceExportRepository;

    const service = createGradeAttendanceExportService(repository);

    expect(service.get).toBe(get);
  });

  it("builds a safe and readable workbook with accurate metrics", async () => {
    const result = await buildGradeAttendanceWorkbook(exportData, "=Administrator");

    expect(result.metrics).toEqual({
      classCount: 2,
      studentCount: 2,
      impactedStudentCount: 1,
    });
    expect(result.output.byteLength).toBeGreaterThan(1_000);

    const decoded = new ExcelJS.Workbook();
    await decoded.xlsx.load(result.output);

    expect(decoded.worksheets.map((sheet) => sheet.name)).toEqual(["Ringkasan", "X-1", "X-2"]);

    const summary = decoded.getWorksheet("Ringkasan");
    expect(summary).toBeDefined();
    expect(summary!.getCell("A1").value).toBe("Laporan Presensi Grade X");
    expect(summary!.getCell("B5").value).toBe("'=Administrator");
    expect(summary!.getCell("B9").value).toBe("X-1");
    expect(summary!.getCell("C9").value).toBe("'=Wali Kelas");
    expect(summary!.getCell("D9").value).toBe(2);
    expect(summary!.getCell("E9").value).toBe(1);
    expect(summary!.getCell("F9").value).toBe(1);
    expect(summary!.getCell("G9").value).toBe(1);
    expect(summary!.getCell("H9").value).toBe(1);
    expect(summary!.getCell("I9").value).toBe(2);

    const daily = decoded.getWorksheet("X-1");
    expect(daily).toBeDefined();
    expect(daily!.getCell("B7").value).toBe("'=001");
    expect(daily!.getCell("C7").value).toBe("'+002");
    expect(daily!.getCell("D7").value).toBe("'@Siswa Pertama");
    expect(daily!.getCell("F7").value).toBe("S/I");
    expect(daily!.getCell("G7").value).toBe("A");
    expect(daily!.getCell("H7").value).toBe(".");
    expect(daily!.getCell("I7").value).toBe(1);
    expect(daily!.getCell("J7").value).toBe(1);
    expect(daily!.getCell("K7").value).toBe(1);
    expect(daily!.getCell("L7").value).toBe(2);
    expect(daily!.getCell("E12").value).toBe("2026-07-01");
    expect(daily!.getCell("F12").value).toBe("2026-07-01");
    expect(daily!.getCell("G12").value).toBe("2026-07-02");
    expect(daily!.getCell("E13").value).toBe("—");
    expect(daily!.getCell("F13").value).toBe("—");
    expect(daily!.getCell("G13").value).toBe("—");

    const emptyClass = decoded.getWorksheet("X-2");
    expect(emptyClass).toBeDefined();
    expect(String(emptyClass!.getCell("A3").value)).toContain("Wali Kelas: Belum diisi");
  });
});
