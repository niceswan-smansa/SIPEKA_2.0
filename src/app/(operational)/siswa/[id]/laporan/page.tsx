import { notFound } from "next/navigation";

import { requirePageAccess } from "@/modules/authorization";
import {
  PrintButton,
  createStudentAttendanceService,
  createSupabaseStudentAttendanceRepository,
  reportRangeSchema,
} from "@/modules/student-attendance";
import { createStudentService, createSupabaseStudentRepository } from "@/modules/students";
import { Card, PageHeader, Table } from "@/shared/ui";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
};
export default async function StudentReportPage({ params, searchParams }: Props) {
  await requirePageAccess("OPERATIONAL");
  const { id } = await params;
  const query = await searchParams;
  const range = reportRangeSchema.parse({ startDate: query.from, endDate: query.to });
  const [student, rows] = await Promise.all([
    createStudentService(createSupabaseStudentRepository()).getDetail(id),
    createStudentAttendanceService(createSupabaseStudentAttendanceRepository()).getReport(
      id,
      range.startDate,
      range.endDate,
    ),
  ]);
  if (!student) notFound();
  const totals = {
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
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt>NIS</dt>
            <dd>{student.nis}</dd>
          </div>
          <div>
            <dt>NISN</dt>
            <dd>{student.nisn}</dd>
          </div>
          <div>
            <dt>Hari terdampak</dt>
            <dd>{totals.days}</dd>
          </div>
          <div>
            <dt>Jam terdampak</dt>
            <dd>{totals.hours}</dd>
          </div>
          <div>
            <dt>Izin</dt>
            <dd>{totals.izin}</dd>
          </div>
          <div>
            <dt>Sakit</dt>
            <dd>{totals.sakit}</dd>
          </div>
          <div>
            <dt>Tanpa Keterangan</dt>
            <dd>{totals.tanpa}</dd>
          </div>
        </dl>
      </Card>
      <Card className="mt-5">
        <Table>
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Jam</th>
              <th>Status</th>
              <th>Catatan</th>
              <th>Pencatat</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.date}-${row.periodNumber}`}>
                <td>{row.date}</td>
                <td>{row.periodNumber}</td>
                <td>{row.status}</td>
                <td>{row.note ?? "—"}</td>
                <td>{row.recordedBy}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </main>
  );
}
