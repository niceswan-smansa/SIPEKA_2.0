import Link from "next/link";
import { notFound } from "next/navigation";

import { requirePageAccess } from "@/modules/authorization";
import { classDisplayName } from "@/modules/classes";
import { todayJakarta } from "@/modules/attendance";
import {
  createStudentAttendanceService,
  createSupabaseStudentAttendanceRepository,
  monthStart,
  StudentAttendanceCalendar,
  StudentAttendanceEditor,
  StudentAttendanceTrend,
} from "@/modules/student-attendance";
import { createStudentService, createSupabaseStudentRepository } from "@/modules/students";
import { Badge, Card, PageHeader, Table } from "@/shared/ui";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string; month?: string }>;
};
const validDate = (value: string | undefined) => /^\d{4}-\d{2}-\d{2}$/.test(value ?? "");

export default async function StudentDetailPage({ params, searchParams }: Props) {
  const profile = await requirePageAccess("OPERATIONAL");
  const { id } = await params;
  const query = await searchParams;
  const selectedDate = validDate(query.date) ? query.date! : todayJakarta();
  const month = /^\d{4}-\d{2}-01$/.test(query.month ?? "")
    ? query.month!
    : monthStart(selectedDate);
  const [student, attendance] = await Promise.all([
    createStudentService(createSupabaseStudentRepository()).getDetail(id),
    createStudentAttendanceService(createSupabaseStudentAttendanceRepository()).get(
      id,
      selectedDate,
      month,
    ),
  ]);
  if (!student) notFound();
  const className =
    student.classNumber && student.currentGrade !== "ALUMNI"
      ? classDisplayName(student.currentGrade, student.classNumber)
      : "Tidak ada";
  const selectedClassId = attendance.periods[0]?.classId ?? student.currentClassId;
  const editable =
    profile.role === "ADMIN" &&
    selectedDate <= todayJakarta() &&
    selectedClassId === student.currentClassId &&
    selectedClassId !== null;
  const range = {
    from: month,
    to: `${month.slice(0, 7)}-${new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate()}`,
  };
  return (
    <>
      <PageHeader
        title={student.fullName}
        description="Detail identitas, presensi, dan histori perubahan."
        action={
          <div className="flex gap-3">
            <Link
              className="font-semibold text-[var(--brand)]"
              href={`/siswa/${student.id}/laporan?from=${range.from}&to=${range.to}`}
            >
              Laporan
            </Link>
            {profile.role === "ADMIN" ? (
              <>
                <Link
                  className="font-semibold text-[var(--brand)]"
                  href={`/api/students/${student.id}/report?from=${range.from}&to=${range.to}`}
                >
                  Export Excel
                </Link>
                <Link
                  className="font-semibold text-[var(--brand)]"
                  href={`/manajemen-siswa?student=${student.id}`}
                >
                  Edit siswa
                </Link>
              </>
            ) : null}
          </div>
        }
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-lg font-bold">Identitas</h2>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <Detail label="NIS" value={student.nis ?? "—"} />
            <Detail label="NISN" value={student.nisn ?? "—"} />
            <Detail
              label="Jenis kelamin"
              value={student.gender === "L" ? "Laki-laki" : "Perempuan"}
            />
            <Detail label="Grade" value={student.currentGrade} />
            <Detail label="Kelas" value={className} />
            <Detail label="Wali kelas" value={student.homeroomTeacher ?? "Belum diisi"} />
            <Detail label="Tahun masuk" value={student.yearEntered?.toString() ?? "—"} />
            <Detail label="Tahun lulus" value={student.graduationYear?.toString() ?? "—"} />
            <div>
              <dt className="text-xs uppercase text-slate-500">Status</dt>
              <dd className="mt-1">
                <Badge tone={student.isActive ? "success" : "danger"}>
                  {student.isActive ? "Aktif" : "Nonaktif"}
                </Badge>
              </dd>
            </div>
          </dl>
        </Card>
        <Card>
          <StudentAttendanceCalendar
            selectedDate={selectedDate}
            month={month}
            calendar={attendance.calendar}
          />
        </Card>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-lg font-bold">Rincian {selectedDate}</h2>
          <Table>
            <thead>
              <tr>
                <th>Jam</th>
                <th>Status</th>
                <th>Catatan</th>
                <th>Pencatat</th>
                <th>Diubah</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 10 }, (_, index) => {
                const period = attendance.periods.find((item) => item.periodNumber === index + 1);
                return (
                  <tr key={index + 1}>
                    <td>{index + 1}</td>
                    <td>
                      {period?.status
                        ? { IZIN: "Izin", SAKIT: "Sakit", TANPA_KETERANGAN: "Tanpa Keterangan" }[
                            period.status
                          ]
                        : "Hadir"}
                    </td>
                    <td>{period?.note ?? "—"}</td>
                    <td>{period?.updatedByName ?? "—"}</td>
                    <td>{period?.updatedAt ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-bold">Statistik bulan</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="Hari Izin" value={attendance.stats.days_izin} />
            <Stat label="Hari Sakit" value={attendance.stats.days_sakit} />
            <Stat label="Hari Tanpa Keterangan" value={attendance.stats.days_tanpa_keterangan} />
            <Stat label="Total hari tidak hadir" value={attendance.stats.days_total} />
            <Stat label="Jam Izin" value={attendance.stats.hours_izin} />
            <Stat label="Jam Sakit" value={attendance.stats.hours_sakit} />
            <Stat label="Jam Tanpa Keterangan" value={attendance.stats.hours_tanpa_keterangan} />
            <Stat label="Total jam terdampak" value={attendance.stats.hours_total} />
          </div>
        </Card>
      </div>
      <Card className="mt-5">
        <StudentAttendanceTrend data={attendance.trend} />
      </Card>
      {editable ? (
        <Card className="mt-5">
          <h2 className="mb-4 text-lg font-bold">Koreksi beberapa jam</h2>
          <StudentAttendanceEditor
            studentId={student.id}
            classId={selectedClassId}
            attendanceDate={selectedDate}
            periods={attendance.periods}
          />
        </Card>
      ) : profile.role === "ADMIN" ? (
        <Card className="mt-5">
          <p className="text-sm text-slate-600">
            Koreksi hanya tersedia ketika tanggal memakai kelas aktif siswa saat ini.
          </p>
        </Card>
      ) : null}
      <Card className="mt-5">
        <h2 className="mb-4 text-lg font-bold">Histori perubahan</h2>
        {attendance.revisions.length ? (
          <Table>
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Tindakan</th>
                <th>Admin</th>
                <th>Sebelum</th>
                <th>Sesudah</th>
              </tr>
            </thead>
            <tbody>
              {attendance.revisions.map((item) => (
                <tr key={String(item.id)}>
                  <td>{String(item.created_at)}</td>
                  <td>{String(item.operation)}</td>
                  <td>{String(item.actor_name)}</td>
                  <td>
                    <code>{JSON.stringify(item.before ?? {})}</code>
                  </td>
                  <td>
                    <code>{JSON.stringify(item.after ?? {})}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="text-sm text-slate-600">Belum ada perubahan presensi.</p>
        )}
      </Card>
      <Card className="mt-5">
        <h2 className="mb-4 text-lg font-bold">Histori enrollment</h2>
        <Table>
          <thead>
            <tr>
              <th>Tahun</th>
              <th>Kelas</th>
              <th>Periode</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {student.enrollments.map((item) => (
              <tr key={item.id}>
                <td>{item.academicYearName}</td>
                <td>
                  {item.classNumber && item.grade !== "ALUMNI"
                    ? classDisplayName(item.grade, item.classNumber)
                    : item.grade}
                </td>
                <td>
                  {item.startedOn} – {item.endedOn ?? "sekarang"}
                </td>
                <td>{item.isCurrent ? "Current" : "Selesai"}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}
function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-slate-600">{label}</p>
      <p className="mt-1 text-xl font-bold">{value ?? 0}</p>
    </div>
  );
}
