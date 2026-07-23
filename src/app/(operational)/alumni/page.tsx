import Link from "next/link";

import { requirePageAccess } from "@/modules/authorization";
import {
  createStudentSearchRepository,
  createStudentSearchService,
} from "@/modules/student-search";
import { AlumniActions } from "@/modules/student-lifecycle";
import { Card, EmptyState, PageHeader } from "@/shared/ui";

export default async function AlumniPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; success?: string; error?: string }>;
}) {
  await requirePageAccess("ADMIN_MUTATION");
  const params = await searchParams;
  const { result } = await createStudentSearchService(createStudentSearchRepository()).search({
    grade: "ALUMNI",
    status: "all",
    pageSize: "50",
    page: params.page ?? "1",
  });
  return (
    <>
      <PageHeader
        title="Alumni"
        description="Arsip mempertahankan presensi, enrollment, dan audit."
      />
      {params.success ? (
        <p role="status" className="mb-4 rounded bg-emerald-50 p-3 text-sm text-emerald-800">
          Operasi alumni berhasil.
        </p>
      ) : null}
      {params.error ? (
        <p role="alert" className="mb-4 rounded bg-red-50 p-3 text-sm text-red-800">
          Operasi alumni tidak dapat diselesaikan.
        </p>
      ) : null}
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
      {result.total > result.pageSize ? (
        <nav className="mt-5 flex gap-3" aria-label="Pagination alumni">
          {result.page > 1 ? (
            <Link href={`/alumni?page=${result.page - 1}`}>Sebelumnya</Link>
          ) : null}
          {result.page * result.pageSize < result.total ? (
            <Link href={`/alumni?page=${result.page + 1}`}>Berikutnya</Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
