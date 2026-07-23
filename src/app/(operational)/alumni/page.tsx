import Link from "next/link";

import { requirePageAccess } from "@/modules/authorization";
import {
  createStudentSearchRepository,
  createStudentSearchService,
} from "@/modules/student-search";
import { AlumniActions } from "@/modules/student-lifecycle";
import { Card, EmptyState, PageHeader, Pagination } from "@/shared/ui";

const successMessages: Record<string, string> = {
  archived: "Alumni berhasil diarsipkan.",
  tombstoned: "Identitas alumni berhasil ditombstone. Histori tetap dipertahankan.",
};

const errorMessages: Record<string, string> = {
  archive: "Alumni belum dapat diarsipkan.",
  tombstone: "Identitas alumni belum dapat ditombstone.",
};

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
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const makeHref = (nextPage: number) => `/alumni?page=${nextPage}`;

  return (
    <>
      <PageHeader
        title="Alumni"
        description="Arsip mempertahankan presensi, enrollment, dan audit."
      />

      {params.success ? (
        <p
          role="status"
          className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {successMessages[params.success] ?? "Operasi alumni berhasil."}
        </p>
      ) : null}

      {params.error ? (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMessages[params.error] ?? "Operasi alumni tidak dapat diselesaikan."}
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

      <div className="mt-5">
        <Pagination
          page={result.page}
          totalPages={totalPages}
          {...(result.page > 1 ? { previousHref: makeHref(result.page - 1) } : {})}
          {...(result.page < totalPages ? { nextHref: makeHref(result.page + 1) } : {})}
        />
      </div>
    </>
  );
}
