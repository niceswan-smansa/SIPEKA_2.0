import Link from "next/link";

import { requirePageAccess } from "@/modules/authorization";
import {
  createStudentSearchRepository,
  createStudentSearchService,
} from "@/modules/student-search";
import { AlumniActions } from "@/modules/student-lifecycle";
import { Card, EmptyState, PageHeader } from "@/shared/ui";

export default async function AlumniPage() {
  await requirePageAccess("ADMIN_MUTATION");
  const { result } = await createStudentSearchService(createStudentSearchRepository()).search({
    grade: "ALUMNI",
    status: "all",
    pageSize: "50",
  });
  return (
    <>
      <PageHeader
        title="Alumni"
        description="Arsip mempertahankan presensi, enrollment, dan audit."
      />
      <div className="mt-5 grid gap-3">
        {!result.items.length ? (
          <EmptyState>Belum ada alumni. Alumni muncul setelah promotion kelas XII.</EmptyState>
        ) : null}
        {result.items.map((student) => (
          <Card key={student.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Link className="font-bold text-[var(--brand)]" href={`/siswa/${student.id}`}>
                  {student.fullName}
                </Link>
                <p className="text-sm text-slate-600">
                  Lulus {student.graduationYear ?? "—"} ·{" "}
                  {student.isActive ? "Aktif" : "Diarsipkan"}
                </p>
              </div>
              <div className="flex gap-2">
                <AlumniActions studentId={student.id} archived={!student.isActive} />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
