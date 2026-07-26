import { redirect } from "next/navigation";

import {
  createAcademicYearService,
  createInitialAcademicYearAction,
  createSupabaseAcademicYearRepository,
} from "@/modules/academic-years";
import { requirePageAccess } from "@/modules/authorization";
import { Alert, Button, Card, FormField, Input, PageHeader, UnsavedForm } from "@/shared/ui";

const errors: Record<string, string> = {
  ACADEMIC_YEAR_DUPLICATE: "Nama tahun ajaran sudah digunakan.",
  ACADEMIC_YEAR_INVALID: "Rentang tanggal tahun ajaran tidak valid.",
  ACADEMIC_YEAR_OVERLAP: "Rentang tahun ajaran bertumpang tindih.",
};

export default async function InitialSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePageAccess("ADMIN_MUTATION");
  const years = await createAcademicYearService(createSupabaseAcademicYearRepository()).list();

  if (years.length > 0) {
    redirect("/dashboard");
  }

  const params = await searchParams;

  return (
    <>
      <PageHeader
        title="Pengaturan Awal"
        description="Buat tahun ajaran pertama. SIPEKA akan langsung mengaktifkannya dan menyiapkan 30 kelas."
      />

      {params.error ? (
        <Alert tone="error">
          {errors[params.error] ?? "Pengaturan awal tidak dapat disimpan."}
        </Alert>
      ) : null}

      <Card className="mx-auto max-w-2xl">
        <h2 className="text-lg font-bold">Tahun ajaran pertama</h2>
        <p className="mt-1 text-sm text-slate-600">
          Langkah ini hanya dilakukan sekali pada instalasi baru. Tidak ada proses naik grade untuk
          tahun pertama.
        </p>

        <UnsavedForm action={createInitialAcademicYearAction} className="mt-5 grid gap-4">
          <FormField id="initial-year-name" label="Nama tahun ajaran">
            <Input id="initial-year-name" name="name" placeholder="2026/2027" required />
          </FormField>
          <FormField id="initial-year-start" label="Tanggal mulai">
            <Input id="initial-year-start" name="startDate" type="date" required />
          </FormField>
          <FormField id="initial-year-end" label="Tanggal selesai">
            <Input id="initial-year-end" name="endDate" type="date" required />
          </FormField>
          <Alert>
            Setelah disimpan, kelas X-1 sampai XII-10 dibuat otomatis. Siswa dapat dimasukkan
            melalui import bulk atau tambah manual.
          </Alert>
          <Button type="submit">Buat tahun pertama dan 30 kelas</Button>
        </UnsavedForm>
      </Card>
    </>
  );
}
