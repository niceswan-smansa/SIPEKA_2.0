import {
  createAcademicYearService,
  createSupabaseAcademicYearRepository,
} from "@/modules/academic-years";
import { requirePageAccess } from "@/modules/authorization";
import {
  createStudentLifecycleService,
  createSupabaseStudentLifecycleRepository,
  promoteStudentsAction,
  rollbackPromotionAction,
} from "@/modules/student-lifecycle";
import { Alert, Button, Card, PageHeader, Select } from "@/shared/ui";

export default async function PromotionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePageAccess("ADMIN_MUTATION");
  const params = await searchParams;
  const years = await createAcademicYearService(createSupabaseAcademicYearRepository()).list();
  const batches = await createStudentLifecycleService(
    createSupabaseStudentLifecycleRepository(),
  ).listPromotionBatches();
  return (
    <>
      <PageHeader
        title="Naik / Turun Grade"
        description="Promotion X→XI, XI→XII, XII→Alumni; rollback selalu memakai snapshot batch."
      />
      {params.success ? (
        <Alert tone="success">{params.success} siswa berhasil dipromosikan.</Alert>
      ) : null}
      {params.rollback ? (
        <Alert tone="success">{params.rollback} siswa berhasil dipulihkan.</Alert>
      ) : null}
      {params.error ? (
        <Alert tone="error">Operasi ditolak karena target atau snapshot tidak aman.</Alert>
      ) : null}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="font-bold">Aktifkan tahun melalui promotion</h2>
          <form action={promoteStudentsAction} className="mt-4 grid gap-3">
            <Select name="academicYearId" required>
              <option value="">Pilih tahun tujuan nonaktif</option>
              {years
                .filter((year) => !year.isActive)
                .map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                  </option>
                ))}
            </Select>
            <Button type="submit">Preview dan jalankan promotion</Button>
          </form>
        </Card>
        <Card>
          <h2 className="font-bold">Riwayat batch</h2>
          <div className="mt-3 grid gap-3">
            {batches.length ? (
              batches.map((batch) => (
                <section className="rounded border p-3" key={batch.id}>
                  <p>
                    {batch.fromYear} → {batch.toYear}
                  </p>
                  <p className="text-sm text-slate-600">{batch.status}</p>
                  {batch.status === "COMPLETED" ? (
                    <form action={rollbackPromotionAction} className="mt-2">
                      <input type="hidden" name="batchId" value={batch.id} />
                      <Button type="submit">Rollback snapshot batch</Button>
                    </form>
                  ) : null}
                </section>
              ))
            ) : (
              <p>Belum ada batch promotion.</p>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
