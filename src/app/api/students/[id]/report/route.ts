import ExcelJS from "exceljs";
import { NextResponse, type NextRequest } from "next/server";

import { requirePageAccess } from "@/modules/authorization";
import {
  createStudentAttendanceService,
  createSupabaseStudentAttendanceRepository,
  reportRangeSchema,
} from "@/modules/student-attendance";
import { createStudentService, createSupabaseStudentRepository } from "@/modules/students";

const formulaSafe = (value: string | null) =>
  value && /^[=+\-@]/.test(value) ? `'${value}` : (value ?? "");

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requirePageAccess("ADMIN_MUTATION");
  const { id } = await params;
  const range = reportRangeSchema.parse({
    startDate: request.nextUrl.searchParams.get("from"),
    endDate: request.nextUrl.searchParams.get("to"),
  });
  const [student, rows] = await Promise.all([
    createStudentService(createSupabaseStudentRepository()).getDetail(id),
    createStudentAttendanceService(createSupabaseStudentAttendanceRepository()).getReport(
      id,
      range.startDate,
      range.endDate,
    ),
  ]);
  if (!student) return NextResponse.json({ error: "Tidak ditemukan." }, { status: 404 });
  await createStudentAttendanceService(createSupabaseStudentAttendanceRepository()).recordExport(
    id,
    range.startDate,
    range.endDate,
    rows.length,
  );
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Presensi");
  sheet.addRow([
    "Tanggal",
    "Jam",
    "NIS",
    "NISN",
    "Nama",
    "Status",
    "Catatan",
    "Pencatat",
    "Dibuat",
    "Diubah",
  ]);
  for (const row of rows)
    sheet.addRow([
      row.date,
      row.periodNumber,
      formulaSafe(student.nis),
      formulaSafe(student.nisn),
      formulaSafe(student.fullName),
      row.status,
      formulaSafe(row.note),
      formulaSafe(row.recordedBy),
      row.createdAt,
      row.updatedAt,
    ]);
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((column) => {
    column.width = 18;
  });
  const output = await workbook.xlsx.writeBuffer();
  return new NextResponse(output, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="laporan-presensi-${id}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
