import Link from "next/link";
import { notFound } from "next/navigation";

import { requirePageAccess } from "@/modules/authorization";
import { classDisplayName } from "@/modules/classes";
import { createStudentService, createSupabaseStudentRepository } from "@/modules/students";
import { Badge, Card, PageHeader, Table } from "@/shared/ui";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ success?: string }> };

export default async function StudentDetailPage({ params }: Props) {
  const profile = await requirePageAccess("OPERATIONAL");
  const { id } = await params;
  const student = await createStudentService(createSupabaseStudentRepository()).getDetail(id);
  if (!student) notFound();
  const className =
    student.classNumber && student.currentGrade !== "ALUMNI"
      ? classDisplayName(student.currentGrade, student.classNumber)
      : "Tidak ada";

  return (
    <>
      <PageHeader
        title={student.fullName}
        description="Detail identitas dan histori enrollment dasar."
        action={
          profile.role === "ADMIN" ? (
            <Link
              className="font-semibold text-[var(--brand)]"
              href={`/manajemen-siswa?student=${student.id}`}
            >
              Edit siswa
            </Link>
          ) : undefined
        }
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-lg font-bold">Identitas</h2>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <Detail label="NIS" value={student.nis} />
            <Detail label="NISN" value={student.nisn} />
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
          <h2 className="mb-4 text-lg font-bold">Histori enrollment</h2>
          <Table>
            <thead>
              <tr className="border-b text-xs uppercase text-slate-500">
                <th className="p-2">Tahun</th>
                <th className="p-2">Kelas</th>
                <th className="p-2">Periode</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {student.enrollments.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="p-2">{item.academicYearName}</td>
                  <td className="p-2">
                    {item.classNumber && item.grade !== "ALUMNI"
                      ? classDisplayName(item.grade, item.classNumber)
                      : item.grade}
                  </td>
                  <td className="p-2">
                    {item.startedOn} – {item.endedOn ?? "sekarang"}
                  </td>
                  <td className="p-2">{item.isCurrent ? "Current" : "Selesai"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
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
