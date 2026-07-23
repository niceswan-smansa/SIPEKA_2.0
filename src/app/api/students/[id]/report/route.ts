import ExcelJS from "exceljs";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { authorizeRequest } from "@/modules/authorization";
import {
  createStudentAttendanceService,
  createSupabaseStudentAttendanceRepository,
  reportRangeSchema,
} from "@/modules/student-attendance";
import { createStudentService, createSupabaseStudentRepository } from "@/modules/students";

const formulaSafe = (value: string | null) =>
  value && /^[=+\-@]/.test(value) ? `'${value}` : (value ?? "");

const privateNoStore = { "Cache-Control": "private, no-store, max-age=0" };

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: privateNoStore });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { context, decision } = await authorizeRequest("ADMIN_MUTATION");

  if (!context.authenticated) return jsonError("Autentikasi diperlukan.", 401);
  if (decision.type !== "ALLOW") return jsonError("Akses ditolak.", 403);

  const idResult = z.uuid().safeParse((await params).id);
  const rangeResult = reportRangeSchema.safeParse({
    startDate: request.nextUrl.searchParams.get("from"),
    endDate: request.nextUrl.searchParams.get("to"),
  });

  if (!idResult.success || !rangeResult.success) {
    return jsonError("Permintaan tidak valid.", 400);
  }

  const id = idResult.data;
  const range = rangeResult.data;

  let student;
  try {
    student = await createStudentService(createSupabaseStudentRepository()).getDetail(id);
  } catch {
    return jsonError("Laporan belum dapat dibuat.", 500);
  }

  if (!student) return jsonError("Tidak ditemukan.", 404);

  try {
    const attendanceService = createStudentAttendanceService(
      createSupabaseStudentAttendanceRepository(),
    );
    const rows = await attendanceService.getReport(id, range.startDate, range.endDate);

    await attendanceService.recordExport(id, range.startDate, range.endDate, rows.length);

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

    for (const row of rows) {
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
    }

    sheet.getRow(1).font = { bold: true };
    sheet.columns.forEach((column) => {
      column.width = 18;
    });

    const output = await workbook.xlsx.writeBuffer();

    return new NextResponse(output, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="laporan-presensi-${id}.xlsx"`,
        ...privateNoStore,
      },
    });
  } catch {
    return jsonError("Laporan belum dapat dibuat.", 500);
  }
}
