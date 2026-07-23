import Link from "next/link";

import { classDisplayName } from "@/modules/classes";
import { Badge, Card, EmptyState, Table } from "@/shared/ui";

import type { StudentRecord } from "../domain/students";

export function StudentList({
  students,
  showManagement,
}: {
  students: StudentRecord[];
  showManagement: boolean;
}) {
  if (students.length === 0) return <EmptyState>Tidak ada siswa yang sesuai filter.</EmptyState>;
  return (
    <>
      <div className="hidden md:block">
        <Card>
          <Table>
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="p-3">Nama</th>
                <th className="p-3">NIS</th>
                <th className="p-3">NISN</th>
                <th className="p-3">Grade / kelas</th>
                <th className="p-3">Status</th>
                <th className="p-3">Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id} className="border-b border-slate-100">
                  <td className="p-3 font-semibold">{student.fullName}</td>
                  <td className="p-3">{student.nis ?? "—"}</td>
                  <td className="p-3">{student.nisn ?? "—"}</td>
                  <td className="p-3">
                    {student.classNumber
                      ? classDisplayName(
                          student.currentGrade as "X" | "XI" | "XII",
                          student.classNumber,
                        )
                      : student.currentGrade}
                  </td>
                  <td className="p-3">
                    <Badge tone={student.isActive ? "success" : "danger"}>
                      {student.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-3">
                      <Link
                        className="font-semibold text-[var(--brand)]"
                        href={`/siswa/${student.id}`}
                      >
                        Detail
                      </Link>
                      {showManagement ? (
                        <Link
                          className="font-semibold text-slate-700"
                          href={`/manajemen-siswa?student=${student.id}`}
                        >
                          Edit
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
      <div className="grid gap-3 md:hidden">
        {students.map((student) => (
          <Card key={student.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold">{student.fullName}</h2>
                <p className="mt-1 text-sm text-slate-600">
                  NIS {student.nis ?? "—"} · NISN {student.nisn ?? "—"}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {student.classNumber
                    ? classDisplayName(
                        student.currentGrade as "X" | "XI" | "XII",
                        student.classNumber,
                      )
                    : student.currentGrade}
                </p>
              </div>
              <Badge tone={student.isActive ? "success" : "danger"}>
                {student.isActive ? "Aktif" : "Nonaktif"}
              </Badge>
            </div>
            <div className="mt-4 flex gap-4 text-sm">
              <Link className="font-semibold text-[var(--brand)]" href={`/siswa/${student.id}`}>
                Detail
              </Link>
              {showManagement ? (
                <Link className="font-semibold" href={`/manajemen-siswa?student=${student.id}`}>
                  Edit
                </Link>
              ) : null}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
