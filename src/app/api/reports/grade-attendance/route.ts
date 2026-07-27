import { NextResponse, type NextRequest } from "next/server";

import {
  createAcademicYearService,
  createSupabaseAcademicYearRepository,
} from "@/modules/academic-years";
import { authorizeRequest } from "@/modules/authorization";
import {
  buildGradeAttendanceWorkbook,
  createGradeAttendanceExportService,
  createSupabaseGradeAttendanceExportRepository,
  gradeAttendanceExportRequestSchema,
  resolveGradeAttendanceExportRange,
} from "@/modules/grade-attendance-export";
import { todayJakarta } from "@/shared/domain/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const privateNoStore = { "Cache-Control": "private, no-store, max-age=0" };

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: privateNoStore });
}

export async function GET(request: NextRequest) {
  const { context, decision } = await authorizeRequest("ADMIN_MUTATION");

  if (!context.authenticated) return jsonError("Autentikasi diperlukan.", 401);
  if (decision.type !== "ALLOW") return jsonError("Akses ditolak.", 403);

  const parsed = gradeAttendanceExportRequestSchema.safeParse({
    mode: request.nextUrl.searchParams.get("mode"),
    grade: request.nextUrl.searchParams.get("grade"),
    month: request.nextUrl.searchParams.get("month"),
    from: request.nextUrl.searchParams.get("from"),
    to: request.nextUrl.searchParams.get("to"),
  });

  if (!parsed.success) return jsonError("Filter laporan tidak valid.", 400);

  const years = await createAcademicYearService(createSupabaseAcademicYearRepository()).list();
  const activeYear = years.find((year) => year.isActive);
  if (!activeYear) return jsonError("Tahun ajaran aktif belum tersedia.", 409);

  let range: { startDate: string; endDate: string };
  try {
    range = resolveGradeAttendanceExportRange(parsed.data, activeYear, todayJakarta());
  } catch {
    return jsonError(
      "Rentang laporan harus berada dalam tahun ajaran aktif dan tidak melewati hari ini.",
      400,
    );
  }

  try {
    const service = createGradeAttendanceExportService(
      createSupabaseGradeAttendanceExportRepository(),
    );
    const data = await service.get(parsed.data.grade, range.startDate, range.endDate);
    const workbook = await buildGradeAttendanceWorkbook(data, context.profile?.fullName ?? "Admin");

    const periodToken =
      parsed.data.mode === "monthly"
        ? parsed.data.month
        : `${range.startDate}_sampai_${range.endDate}`;
    const filename = `laporan-presensi_grade-${parsed.data.grade}_${periodToken}.xlsx`;

    return new NextResponse(workbook.output, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        ...privateNoStore,
      },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const status = code.includes("RANGE") || code.includes("GRADE_INVALID") ? 400 : 500;
    return jsonError("Laporan massal belum dapat dibuat.", status);
  }
}
