import { notFound } from "next/navigation";
import { z } from "zod";

import { todayJakarta } from "@/modules/attendance";
import { requirePageAccess } from "@/modules/authorization";
import { classDisplayName } from "@/modules/classes";
import {
  createStudentAttendanceService,
  createSupabaseStudentAttendanceRepository,
  PrintButton,
  reportRangeSchema,
  type StudentReportRow,
} from "@/modules/student-attendance";
import { createStudentService, createSupabaseStudentRepository } from "@/modules/students";
import { Card, PageHeader, Table } from "@/shared/ui";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
};

const GRADES = ["X", "XI", "XII"] as const;

export default async function StudentReportPage({ params, searchParams }: Props) {
  await requirePageAccess("OPERATIONAL");

  const idResult = z.uuid().safeParse((await params).id);
  if (!idResult.success) notFound();

  const query = await searchParams;
  const rangeResult = reportRangeSchema.safeParse({
    startDate: query.from,
    endDate: query.to,
  });
  if (!rangeResult.success) notFound();

  const id = idResult.data;
  const range = rangeResult.data;
  const student = await createStudentService(createSupabaseStudentRepository()).getDetail(id);
  if (!student) notFound();

  const attendanceService = createStudentAttendanceService(
    createSupabaseStudentAttendanceRepository(),
  );
  const rows = await attendanceService.getReport(id, range.startDate, range.endDate);

  const schoolSummary = await Promise.all(
    GRADES.map(async (grade) => {
      const enrollments = student.enrollments
        .filter((item) => item.grade === grade)
        .toSorted((left, right) => left.startedOn.localeCompare(right.startedOn));

      if (!enrollments.length) {
        return {
          grade,
          academicYears: [] as string[],
          classes: [] as string[],
          daysTotal: null,
          daysSakit: null,
          daysIzin: null,
          daysTanpaKeterangan: null,
        };
      }

      const reports = await Promise.all(
        enrollments.map((enrollment) =>
          attendanceService.getReport(
            student.id,
            enrollment.startedOn,
            enrollment.endedOn ?? todayJakarta(),
          ),
        ),
      );

      const uniqueRows = new Map<string, StudentReportRow>();
      for (const row of reports.flat()) {
        uniqueRows.set(`${row.date}:${row.periodNumber}`, row);
      }
      const gradeRows = [...uniqueRows.values()];
      const distinctDays = (status?: StudentReportRow["status"]) =>
        new Set(
          gradeRows.filter((row) => (status ? row.status === status : true)).map((row) => row.date),
        ).size;

      return {
        grade,
        academicYears: [...new Set(enrollments.map((item) => item.academicYearName))],
        classes: [
          ...new Set(
            enrollments.flatMap((item) =>
              item.classNumber ? [classDisplayName(grade, item.classNumber)] : [],
            ),
          ),
        ],
        daysTotal: distinctDays(),
        daysSakit: distinctDays("SAKIT"),
        daysIzin: distinctDays("IZIN"),
        daysTanpaKeterangan: distinctDays("TANPA_KETERANGAN"),
      };
    }),
  );

  const rangeTotals = {
    days: new Set(rows.map((row) => row.date)).size,
    hours: rows.length,
    izin: rows.filter((row) => row.status === "IZIN").length,
    sakit: rows.filter((row) => row.status === "SAKIT").length,
    tanpa: rows.filter((row) => row.status === "TANPA_KETERANGAN").length,
  };

  return (
    <main className="mx-auto max-w-5xl p-6 print:p-0">
      <PageHeader
        title={`Laporan ${student.fullName}`}
        description={`${range.startDate} sampai ${range.endDate}`}
        action={<PrintButton />}
      />

      <Card>
        <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <ReportStat label="NIS" value={student.nis ?? "—"} />
          <ReportStat label="NISN" value={student.nisn ?? "—"} />
          <ReportStat label="Hari tidak hadir dalam rentang" value={rangeTotals.days} />
          <ReportStat label="Jam terdampak dalam rentang" value={rangeTotals.hours} />
          <ReportStat label="Jam Izin" value={rangeTotals.izin} />
          <ReportStat label="Jam Sakit" value={rangeTotals.sakit} />
          <ReportStat label="Jam Tanpa Keterangan" value={rangeTotals.tanpa} />
        </dl>
      </Card>

      <Card className="mt-5">
        <h2 className="mb-2 text-lg font-bold">Ringkasan selama bersekolah</h2>
        <p className="mb-4 text-sm text-slate-600">
          Jumlah hari dihitung dari tanggal unik yang memiliki status ketidakhadiran. Grade yang
          belum dijalani tetap ditampilkan kosong.
        </p>
        <Table>
          <thead>
            <tr>
              <th>Grade</th>
              <th>Tahun ajaran</th>
              <th>Kelas</th>
              <th>Total hari tidak hadir</th>
              <th>Sakit</th>
              <th>Izin</th>
              <th>Tanpa Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {schoolSummary.map((summary) => (
              <tr key={summary.grade}>
                <td className="font-semibold">{summary.grade}</td>
                <td>{summary.academicYears.length ? summary.academicYears.join(", ") : "—"}</td>
                <td>{summary.classes.length ? summary.classes.join(" → ") : "—"}</td>
                <td>{summary.daysTotal ?? "—"}</td>
                <td>{summary.daysSakit ?? "—"}</td>
                <td>{summary.daysIzin ?? "—"}</td>
                <td>{summary.daysTanpaKeterangan ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card className="mt-5">
        <h2 className="mb-4 text-lg font-bold">Rincian presensi dalam rentang</h2>
        <Table>
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Jam</th>
              <th>Status</th>
              <th>Catatan harian</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.date}-${row.periodNumber}`}>
                <td>{row.date}</td>
                <td>{row.periodNumber}</td>
                <td>{statusLabel(row.status)}</td>
                <td>{row.note ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </main>
  );
}

function ReportStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <dt className="text-xs uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}

function statusLabel(status: StudentReportRow["status"]) {
  return {
    IZIN: "Izin",
    SAKIT: "Sakit",
    TANPA_KETERANGAN: "Tanpa Keterangan",
  }[status];
}
