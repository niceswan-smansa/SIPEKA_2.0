import "server-only";

import ExcelJS from "exceljs";

import { SITE_DESCRIPTION, SITE_NAME } from "@/shared/constants";

import {
  attendanceSymbol,
  datesInRange,
  summarizeStudentAttendance,
  type GradeAttendanceExportData,
  type GradeAttendanceExportMetrics,
  type GradeAttendanceExportRepository,
} from "../domain/grade-attendance-export";

const formulaSafe = (value: string | null) =>
  value && /^[=+\-@]/.test(value) ? `'${value}` : (value ?? "");

const thinBorder = {
  top: { style: "thin" as const, color: { argb: "FFD1D5DB" } },
  left: { style: "thin" as const, color: { argb: "FFD1D5DB" } },
  bottom: { style: "thin" as const, color: { argb: "FFD1D5DB" } },
  right: { style: "thin" as const, color: { argb: "FFD1D5DB" } },
};

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F766E" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = thinBorder;
  });
  row.height = 32;
}

function formatGeneratedAt(value: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(value);
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function className(grade: string, classNumber: number) {
  return `${grade}-${classNumber}`;
}

function summariesFor(data: GradeAttendanceExportData) {
  return new Map(
    data.classes.flatMap((classItem) =>
      classItem.students.map(
        (student) => [student.id, summarizeStudentAttendance(student.attendance)] as const,
      ),
    ),
  );
}

export function createGradeAttendanceExportService(repository: GradeAttendanceExportRepository) {
  return {
    get: repository.get,
  };
}

export async function buildGradeAttendanceWorkbook(
  data: GradeAttendanceExportData,
  generatedBy: string,
) {
  const workbook = new ExcelJS.Workbook();
  const generatedAt = new Date();
  const dates = datesInRange(data.startDate, data.endDate);
  const summaries = summariesFor(data);

  workbook.creator = SITE_NAME;
  workbook.created = generatedAt;
  workbook.modified = generatedAt;

  const summarySheet = workbook.addWorksheet("Ringkasan", {
    properties: { tabColor: { argb: "FF0F766E" } },
  });

  summarySheet.mergeCells("A1:I1");
  summarySheet.getCell("A1").value = `Laporan Presensi Grade ${data.grade}`;
  summarySheet.getCell("A1").font = { bold: true, size: 16 };
  summarySheet.getCell("A1").alignment = { horizontal: "center" };

  summarySheet.mergeCells("A2:I2");
  summarySheet.getCell("A2").value = `${SITE_NAME} — ${SITE_DESCRIPTION}`;
  summarySheet.getCell("A2").alignment = { horizontal: "center" };

  summarySheet.addRow(["Tahun Ajaran Aktif", data.academicYear.name]);
  summarySheet.addRow(["Periode", `${data.startDate} sampai ${data.endDate}`]);
  summarySheet.addRow(["Dibuat Oleh", formulaSafe(generatedBy)]);
  summarySheet.addRow(["Dibuat Pada", formatGeneratedAt(generatedAt)]);
  summarySheet.addRow([]);

  const summaryHeader = summarySheet.addRow([
    "No",
    "Kelas",
    "Wali Kelas",
    "Jumlah Siswa",
    "Siswa Terdampak",
    "Jumlah S",
    "Jumlah A",
    "Jumlah I",
    "Total Hari Terdampak",
  ]);
  styleHeader(summaryHeader);

  data.classes.forEach((classItem, index) => {
    const studentSummaries = classItem.students.map((student) => summaries.get(student.id)!);
    const row = summarySheet.addRow([
      index + 1,
      className(data.grade, classItem.classNumber),
      formulaSafe(classItem.homeroomTeacher),
      classItem.students.length,
      studentSummaries.filter((summary) => summary.totalHari > 0).length,
      studentSummaries.reduce((total, summary) => total + summary.jumlahSakit, 0),
      studentSummaries.reduce((total, summary) => total + summary.jumlahTanpaKeterangan, 0),
      studentSummaries.reduce((total, summary) => total + summary.jumlahIzin, 0),
      studentSummaries.reduce((total, summary) => total + summary.totalHari, 0),
    ]);

    row.eachCell((cell) => {
      cell.border = thinBorder;
      cell.alignment = { vertical: "middle", wrapText: true };
    });
  });

  summarySheet.columns = [
    { width: 6 },
    { width: 12 },
    { width: 28 },
    { width: 14 },
    { width: 18 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 22 },
  ];
  summarySheet.views = [{ state: "frozen", ySplit: summaryHeader.number }];
  summarySheet.autoFilter = {
    from: { row: summaryHeader.number, column: 1 },
    to: { row: summaryHeader.number, column: 9 },
  };

  for (const classItem of data.classes) {
    const tabName = className(data.grade, classItem.classNumber);
    const sheet = workbook.addWorksheet(tabName);
    const dailyLastColumn = 5 + dates.length + 4;

    sheet.mergeCells(1, 1, 1, dailyLastColumn);
    sheet.getCell(1, 1).value = `A. Rekap Presensi Harian — ${tabName}`;
    sheet.getCell(1, 1).font = { bold: true, size: 15 };
    sheet.getCell(1, 1).alignment = { horizontal: "center" };

    sheet.mergeCells(2, 1, 2, dailyLastColumn);
    sheet.getCell(2, 1).value =
      `${SITE_NAME} | Tahun Ajaran ${data.academicYear.name} | ${data.startDate} sampai ${data.endDate}`;
    sheet.getCell(2, 1).alignment = { horizontal: "center" };

    sheet.mergeCells(3, 1, 3, dailyLastColumn);
    sheet.getCell(3, 1).value =
      `Wali Kelas: ${formulaSafe(classItem.homeroomTeacher) || "Belum diisi"}`;
    sheet.getCell(3, 1).alignment = { horizontal: "center" };

    sheet.mergeCells(4, 1, 4, dailyLastColumn);
    sheet.getCell(4, 1).value = "Keterangan: . = Hadir, S = Sakit, I = Izin, A = Tanpa Keterangan";
    sheet.getCell(4, 1).alignment = { horizontal: "center" };

    sheet.addRow([]);

    const dailyHeader = sheet.addRow([
      "No",
      "NIS",
      "NISN",
      "Nama Siswa",
      "L/P",
      ...dates.map(shortDate),
      "Jumlah S",
      "Jumlah A",
      "Jumlah I",
      "Total Hari",
    ]);
    styleHeader(dailyHeader);

    for (const [index, student] of classItem.students.entries()) {
      const summary = summaries.get(student.id)!;
      const row = sheet.addRow([
        index + 1,
        formulaSafe(student.nis),
        formulaSafe(student.nisn),
        formulaSafe(student.fullName),
        student.gender,
        ...dates.map((date) => attendanceSymbol(summary.byDate.get(date))),
        summary.jumlahSakit,
        summary.jumlahTanpaKeterangan,
        summary.jumlahIzin,
        summary.totalHari,
      ]);

      row.eachCell((cell, columnNumber) => {
        cell.border = thinBorder;
        cell.alignment = {
          horizontal: columnNumber === 4 ? "left" : "center",
          vertical: "middle",
          wrapText: true,
        };
      });
    }

    for (let column = 1; column <= dailyLastColumn; column += 1) {
      if (column === 1) sheet.getColumn(column).width = 5;
      else if (column === 2) sheet.getColumn(column).width = 14;
      else if (column === 3) sheet.getColumn(column).width = 16;
      else if (column === 4) sheet.getColumn(column).width = 30;
      else if (column === 5) sheet.getColumn(column).width = 6;
      else if (column <= 5 + dates.length) sheet.getColumn(column).width = 6;
      else sheet.getColumn(column).width = 11;
    }

    for (let column = 6; column <= 5 + dates.length; column += 1) {
      sheet.getCell(dailyHeader.number, column).alignment = {
        horizontal: "center",
        vertical: "middle",
        textRotation: 90,
      };
    }
    dailyHeader.height = 70;

    sheet.views = [
      {
        state: "frozen",
        xSplit: 5,
        ySplit: dailyHeader.number,
      },
    ];
    sheet.autoFilter = {
      from: { row: dailyHeader.number, column: 1 },
      to: { row: dailyHeader.number, column: dailyLastColumn },
    };

    sheet.addRow([]);
    const summarizeTitle = sheet.addRow(["B. Summarize per Siswa"]);
    sheet.mergeCells(summarizeTitle.number, 1, summarizeTitle.number, 11);
    summarizeTitle.getCell(1).font = { bold: true, size: 14 };

    const summarizeHeader = sheet.addRow([
      "No",
      "NIS",
      "NISN",
      "Nama Siswa",
      "S",
      "I",
      "A",
      "Jumlah S",
      "Jumlah A",
      "Jumlah I",
      "Total Hari",
    ]);
    styleHeader(summarizeHeader);

    for (const [index, student] of classItem.students.entries()) {
      const summary = summaries.get(student.id)!;
      const row = sheet.addRow([
        index + 1,
        formulaSafe(student.nis),
        formulaSafe(student.nisn),
        formulaSafe(student.fullName),
        summary.sakitDates.join("\n") || "—",
        summary.izinDates.join("\n") || "—",
        summary.tanpaKeteranganDates.join("\n") || "—",
        summary.jumlahSakit,
        summary.jumlahTanpaKeterangan,
        summary.jumlahIzin,
        summary.totalHari,
      ]);

      const maximumLines = Math.max(
        summary.sakitDates.length,
        summary.izinDates.length,
        summary.tanpaKeteranganDates.length,
        1,
      );
      row.height = Math.min(300, Math.max(20, maximumLines * 15));

      row.eachCell((cell, columnNumber) => {
        cell.border = thinBorder;
        cell.alignment = {
          horizontal:
            columnNumber === 4 || (columnNumber >= 5 && columnNumber <= 7) ? "left" : "center",
          vertical: "top",
          wrapText: true,
        };
      });
    }

    const summarizeWidths = [5, 14, 16, 30, 17, 17, 17, 11, 11, 11, 12];
    summarizeWidths.forEach((width, index) => {
      if ((sheet.getColumn(index + 1).width ?? 0) < width) {
        sheet.getColumn(index + 1).width = width;
      }
    });
  }

  const classCount = data.classes.length;
  const studentCount = data.classes.reduce(
    (total, classItem) => total + classItem.students.length,
    0,
  );
  const impactedStudentCount = data.classes.reduce(
    (total, classItem) =>
      total +
      classItem.students.filter((student) => summaries.get(student.id)!.totalHari > 0).length,
    0,
  );

  const metrics: GradeAttendanceExportMetrics = {
    classCount,
    studentCount,
    impactedStudentCount,
  };

  return {
    output: await workbook.xlsx.writeBuffer(),
    metrics,
  };
}
