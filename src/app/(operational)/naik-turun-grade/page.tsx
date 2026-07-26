import Link from "next/link";

import {
  createAcademicYearService,
  createPromotionAcademicYearAction,
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
import {
  Alert,
  Button,
  Card,
  FormField,
  Input,
  PageHeader,
  Select,
  UnsavedForm,
} from "@/shared/ui";

const errors: Record<string, string> = {
  ACADEMIC_YEAR_DUPLICATE: "Nama tahun ajaran tujuan sudah digunakan.",
  ACADEMIC_YEAR_INVALID: "Rentang tahun ajaran tujuan tidak valid.",
  ACADEMIC_YEAR_OVERLAP: "Rentang tahun tujuan bertumpang tindih dengan tahun lain.",
  ACADEMIC_YEAR_ACTIVE_REQUIRED: "Belum ada tahun ajaran aktif.",
  PREVIEW_FAILED: "Preview promotion tidak dapat dibuat.",
  PROMOTION_FAILED: "Promotion ditolak karena target atau snapshot tidak aman.",
};

export default async function PromotionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePageAccess("ADMIN_MUTATION");

  const params = await searchParams;
  const service = createStudentLifecycleService(createSupabaseStudentLifecycleRepository());
  const years = await createAcademicYearService(createSupabaseAcademicYearRepository()).list();
  const activeYear = years.find((year) => year.isActive);
  const batches = await service.listPromotionBatches();
  const preview = params.preview ? await service.previewPromotion(params.preview) : null;
  const availableTargets = years.filter(
    (year) => !year.isActive && (!activeYear || year.startDate > activeYear.endDate),
  );

  return (
    <>
      <PageHeader
        title="Naik / Turun Grade"
        description="Wizard tahunan: siapkan tahun tujuan, preview X→XI→XII→Alumni, lalu aktifkan melalui promotion."
      />

      {params.created ? (
        <Alert tone="success">
          Tahun tujuan dan 30 kelas berhasil dibuat. Periksa preview sebelum menjalankan promotion.
        </Alert>
      ) : null}
      {params.success ? (
        <Alert tone="success">{params.success} siswa berhasil dipromosikan.</Alert>
      ) : null}
      {params.rollback ? (
        <Alert tone="success">{params.rollback} siswa berhasil dipulihkan.</Alert>
      ) : null}
      {params.error ? (
        <Alert tone="error">{errors[params.error] ?? "Operasi tidak dapat diselesaikan."}</Alert>
      ) : null}

      {!activeYear ? (
        <Card className="mt-5">
          <Alert>
            Belum ada tahun ajaran aktif. Selesaikan{" "}
            <Link className="font-semibold underline" href="/pengaturan-awal">
              Pengaturan Awal
            </Link>{" "}
            terlebih dahulu.
          </Alert>
        </Card>
      ) : (
        <div className="mt-5 grid gap-5">
          <Card>
            <p className="text-sm font-semibold text-[var(--brand)]">Langkah 1</p>
            <h2 className="mt-1 text-lg font-bold">Siapkan tahun ajaran tujuan</h2>
            <p className="mt-1 text-sm text-slate-600">
              Tahun aktif saat ini: <strong>{activeYear.name}</strong>. Tahun tujuan tetap tidak
              aktif sampai promotion benar-benar diterapkan.
            </p>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <form action={previewPromotionAction} className="grid content-start gap-3">
                <h3 className="font-semibold">Pilih tahun yang sudah dibuat</h3>
                <Select name="academicYearId" required>
                  <option value="">Pilih tahun tujuan nonaktif</option>
                  {availableTargets.map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.name}
                    </option>
                  ))}
                </Select>
                <Button type="submit" disabled={availableTargets.length === 0}>
                  Preview promotion
                </Button>
              </form>

              <UnsavedForm
                action={createPromotionAcademicYearAction}
                className="grid content-start gap-3 rounded-xl border border-slate-200 p-4"
              >
                <h3 className="font-semibold">Atau buat tahun tujuan sekarang</h3>
                <FormField id="promotion-year-name" label="Nama tahun tujuan">
                  <Input id="promotion-year-name" name="name" placeholder="2027/2028" required />
                </FormField>
                <FormField id="promotion-year-start" label="Tanggal mulai tahun tujuan">
                  <Input id="promotion-year-start" name="startDate" type="date" required />
                </FormField>
                <FormField id="promotion-year-end" label="Tanggal selesai tahun tujuan">
                  <Input id="promotion-year-end" name="endDate" type="date" required />
                </FormField>
                <Button type="submit">Buat tahun tujuan dan preview</Button>
              </UnsavedForm>
            </div>
          </Card>

          <Card>
            <p className="text-sm font-semibold text-[var(--brand)]">Langkah 2–4</p>
            <h2 className="mt-1 text-lg font-bold">Preview, validasi, dan terapkan</h2>

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
            ) : (
              <p className="mt-4 text-sm text-slate-600">
                Pilih atau buat tahun tujuan untuk menampilkan preview perpindahan.
              </p>
            )}
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
      )}
    </>
  );
}
