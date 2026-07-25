import {
  createAcademicYearService,
  createSupabaseAcademicYearRepository,
} from "@/modules/academic-years";
import { requirePageAccess } from "@/modules/authorization";
import { GradeAttendanceExportForm } from "@/modules/grade-attendance-export";
import { todayJakarta } from "@/shared/domain/dates";
import { Alert, Card, PageHeader } from "@/shared/ui";

export default async function ReportsPage() {
  await requirePageAccess("ADMIN_MUTATION");

  const years = await createAcademicYearService(createSupabaseAcademicYearRepository()).list();
  const activeYear = years.find((year) => year.isActive);
  const today = todayJakarta();

  return (
    <>
      <PageHeader
        title="Export Laporan Presensi"
        description="Buat satu workbook per grade dengan tab Ringkasan dan tab setiap kelas."
      />

      {!activeYear ? (
        <Alert tone="error">
          Tahun ajaran aktif belum tersedia. Aktifkan tahun ajaran sebelum membuat laporan.
        </Alert>
      ) : today < activeYear.startDate ? (
        <Alert tone="info">
          Tahun ajaran aktif belum dimulai, sehingga belum ada periode presensi yang dapat diekspor.
        </Alert>
      ) : (
        <Card>
          <GradeAttendanceExportForm
            activeYear={{
              name: activeYear.name,
              startDate: activeYear.startDate,
              endDate: activeYear.endDate,
            }}
            today={today}
          />
        </Card>
      )}
    </>
  );
}
