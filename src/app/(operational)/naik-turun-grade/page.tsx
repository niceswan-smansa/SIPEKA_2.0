import {
  createAcademicYearService,
  createSupabaseAcademicYearRepository,
} from "@/modules/academic-years";
import { requirePageAccess } from "@/modules/authorization";
import {
  createStudentLifecycleService,
  createSupabaseStudentLifecycleRepository,
  previewPromotionAction,
  PromotionApplyControl,
  PromotionRollbackControl,
} from "@/modules/student-lifecycle";
import { Alert, Button, Card, PageHeader, Select } from "@/shared/ui";

export default async function PromotionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePageAccess("ADMIN_MUTATION");

  const params = await searchParams;
  const service = createStudentLifecycleService(createSupabaseStudentLifecycleRepository());
  const years = await createAcademicYearService(createSupabaseAcademicYearRepository()).list();
  const batches = await service.listPromotionBatches();
  const preview = params.preview ? await service.previewPromotion(params.preview) : null;

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

          <form action={previewPromotionAction} className="mt-4 grid gap-3">
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
            <Button type="submit">Preview promotion</Button>
          </form>

          {preview ? (
            <div className="mt-4 rounded-lg border p-4">
              <p className="font-semibold">
                {preview.from_year_name} → {preview.to_year_name}
              </p>
              <ul className="mt-2 text-sm">
                <li>Total: {preview.total}</li>
                <li>X → XI: {preview.x_to_xi}</li>
                <li>XI → XII: {preview.xi_to_xii}</li>
                <li>XII → Alumni: {preview.xii_to_alumni}</li>
              </ul>

              {preview.missing_destination_classes.length ? (
                <Alert tone="error">
                  Kelas tujuan belum lengkap. Promotion belum dapat dijalankan.
                </Alert>
              ) : (
                <div className="mt-3">
                  <PromotionApplyControl
                    summary={{
                      toYearId: preview.to_year_id,
                      fromYearName: preview.from_year_name,
                      toYearName: preview.to_year_name,
                      total: preview.total,
                      xToXi: preview.x_to_xi,
                      xiToXii: preview.xi_to_xii,
                      xiiToAlumni: preview.xii_to_alumni,
                    }}
                  />
                </div>
              )}
            </div>
          ) : null}
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
                    <div className="mt-2">
                      <PromotionRollbackControl
                        batchId={batch.id}
                        fromYear={batch.fromYear}
                        toYear={batch.toYear}
                      />
                    </div>
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
