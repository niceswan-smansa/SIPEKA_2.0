import ExcelJS from "exceljs";
import { NextResponse, type NextRequest } from "next/server";

import { authorizeRequest } from "@/modules/authorization";
import {
  createStudentAttendanceService,
  createSupabaseStudentAttendanceRepository,
  reportRangeSchema,
} from "@/modules/student-attendance";
import { createStudentService, createSupabaseStudentRepository } from "@/modules/students";
import { z } from "zod";

const formulaSafe = (value: string | null) =>
  value && /^[=+\-@]/.test(value) ? `'${value}` : (value ?? "");

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { context, decision } = await authorizeRequest("ADMIN_MUTATION");
  if (!context.authenticated)
    return NextResponse.json({ error: "Autentikasi diperlukan." }, { status: 401 });
  if (decision.type !== "ALLOW")
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  const idResult = z.uuid().safeParse((await params).id);
  const rangeResult = reportRangeSchema.safeParse({
    startDate: request.nextUrl.searchParams.get("from"),
    endDate: request.nextUrl.searchParams.get("to"),
  });
  if (!idResult.success || !rangeResult.success)
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  const id = idResult.data;
  const range = rangeResult.data;
  const student = await createStudentService(createSupabaseStudentRepository()).getDetail(id);
  if (!student) return NextResponse.json({ error: "Tidak ditemukan." }, { status: 404 });
  let rows;
  try {
    rows = await createStudentAttendanceService(
      createSupabaseStudentAttendanceRepository(),
    ).getReport(id, range.startDate, range.endDate);
  } catch {
    return NextResponse.json({ error: "Laporan belum dapat dibuat." }, { status: 500 });
  }
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
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
