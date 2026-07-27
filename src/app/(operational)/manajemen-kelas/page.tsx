import Link from "next/link";

import {
  activateAcademicYearAction,
  createAcademicYearAction,
  createAcademicYearService,
  createSupabaseAcademicYearRepository,
  updateAcademicYearAction,
} from "@/modules/academic-years";
import { requirePageAccess } from "@/modules/authorization";
import {
  ClassStatusControl,
  classDisplayName,
  createClassService,
  createSupabaseClassRepository,
  updateClassAction,
  type OperationalGrade,
} from "@/modules/classes";
import { todayJakarta } from "@/shared/domain/dates";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  FormField,
  Input,
  PageHeader,
  Select,
  UnsavedForm,
} from "@/shared/ui";

type Props = {
  searchParams: Promise<{ year?: string; grade?: string; error?: string; success?: string }>;
};

const errors: Record<string, string> = {
  ACADEMIC_YEAR_DUPLICATE: "Nama tahun ajaran sudah digunakan.",
  ACADEMIC_YEAR_INVALID: "Rentang tanggal tahun ajaran tidak valid.",
  ACADEMIC_YEAR_SWITCH_REQUIRES_PROMOTION:
    "Tahun ajaran belum dapat diganti karena masih ada siswa aktif. Pergantian penuh dilakukan melalui workflow naik grade.",
  ACADEMIC_YEAR_OVERLAP: "Rentang tahun ajaran bertumpang tindih dengan tahun lain.",
  ACADEMIC_YEAR_RANGE_CONFLICT:
    "Rentang tidak dapat dipersempit karena sudah ada enrollment atau presensi di luar tanggal baru.",
  ACADEMIC_YEAR_CONFIRM_REQUIRED:
    "Konfirmasi perubahan rentang wajib dicentang karena tahun ajaran sudah dimulai.",
  ACADEMIC_YEAR_CORRECTION_TEXT_REQUIRED:
    "Tahun ajaran yang sudah selesai hanya dapat dikoreksi setelah nama tahun diketik dengan tepat.",
  ACADEMIC_YEAR_NOT_FOUND: "Tahun ajaran tidak ditemukan.",
  CLASS_HAS_ACTIVE_STUDENTS: "Kelas dengan siswa aktif tidak dapat dinonaktifkan.",
  CLASS_UPDATE_FAILED: "Metadata kelas tidak dapat diperbarui.",
};

export default async function ClassManagementPage({ searchParams }: Props) {
  await requirePageAccess("ADMIN_MUTATION");
  const params = await searchParams;
  const today = todayJakarta();
  const yearService = createAcademicYearService(createSupabaseAcademicYearRepository());
  const years = await yearService.list();
  const selectedYear =
    years.find((item) => item.id === params.year) ??
    years.find((item) => item.isActive) ??
    years[0];
  const grade = ["X", "XI", "XII"].includes(params.grade ?? "")
    ? (params.grade as OperationalGrade)
    : undefined;
  const classes = selectedYear
    ? await createClassService(createSupabaseClassRepository()).list({
        academicYearId: selectedYear.id,
        ...(grade ? { grade } : {}),
      })
    : [];

  return (
    <>
      <PageHeader
        title="Pengaturan Tahun Ajaran & Kelas"
        description="Area setup tahunan untuk rentang kalender, 30 slot tetap, wali kelas, dan status kelas."
      />
      {params.error ? (
        <Alert tone="error">{errors[params.error] ?? "Operasi tidak dapat diselesaikan."}</Alert>
      ) : null}
      {params.success ? <Alert tone="success">Perubahan berhasil disimpan.</Alert> : null}

      <div className="mt-5 grid gap-5 xl:grid-cols-[380px_1fr]">
        <div className="grid content-start gap-5">
          <Card>
            <h2 className="mb-2 text-lg font-bold">Tambah tahun ajaran</h2>
            <p className="mb-4 text-sm text-slate-600">
              Untuk tahun berikutnya, cara paling mudah adalah membuatnya langsung dari wizard
              Naik/Turun Grade. Form ini tetap tersedia untuk setup dan koreksi khusus.
            </p>
            <UnsavedForm action={createAcademicYearAction} className="grid gap-4">
              <FormField id="year-name" label="Nama">
                <Input id="year-name" name="name" placeholder="2027/2028" required />
              </FormField>
              <FormField id="year-start" label="Tanggal mulai">
                <Input id="year-start" name="startDate" type="date" required />
              </FormField>
              <FormField id="year-end" label="Tanggal selesai">
                <Input id="year-end" name="endDate" type="date" required />
              </FormField>
              <label className="flex items-start gap-2 text-sm">
                <input name="isActive" type="checkbox" className="mt-1" />
                <span>
                  Jadikan aktif. Gunakan hanya untuk tahun pertama tanpa siswa aktif; pergantian
                  tahunan normal dilakukan melalui promotion.
                </span>
              </label>
              <Button type="submit">Buat tahun dan 30 kelas</Button>
            </UnsavedForm>
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-bold">Daftar tahun ajaran</h2>
            <div className="grid gap-3">
              {years.map((year) => {
                const started = year.startDate <= today;
                const ended = year.endDate < today;

                return (
                  <div key={year.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <Link
                        className="font-bold text-[var(--brand)]"
                        href={`/manajemen-kelas?year=${year.id}`}
                      >
                        {year.name}
                      </Link>
                      <Badge tone={year.isActive ? "success" : ended ? "neutral" : "warning"}>
                        {year.isActive ? "Aktif" : ended ? "Selesai" : "Tidak aktif"}
                      </Badge>
                    </div>
                    <UnsavedForm action={updateAcademicYearAction} className="grid gap-2">
                      <input type="hidden" name="id" value={year.id} />
                      <Input
                        name="name"
                        defaultValue={year.name}
                        aria-label={`Nama ${year.name}`}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          name="startDate"
                          type="date"
                          defaultValue={year.startDate}
                          aria-label={`Mulai ${year.name}`}
                        />
                        <Input
                          name="endDate"
                          type="date"
                          defaultValue={year.endDate}
                          aria-label={`Selesai ${year.name}`}
                        />
                      </div>

                      {started ? (
                        <label className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-950">
                          <input name="confirmRangeChange" type="checkbox" className="mt-0.5" />
                          <span>
                            Saya memahami perubahan rentang hanya dipakai untuk koreksi kalender dan
                            dapat memengaruhi laporan. Database tetap akan menolak overlap atau data
                            yang keluar dari rentang.
                          </span>
                        </label>
                      ) : null}

                      {ended ? (
                        <FormField
                          id={`confirmation-${year.id}`}
                          label={`Ketik "${year.name}" bila mengubah tanggal tahun yang sudah selesai`}
                        >
                          <Input
                            id={`confirmation-${year.id}`}
                            name="confirmationText"
                            autoComplete="off"
                          />
                        </FormField>
                      ) : null}

                      <Button type="submit" className="bg-slate-700 hover:bg-slate-800">
                        Simpan metadata
                      </Button>
                    </UnsavedForm>
                    {!year.isActive ? (
                      <form action={activateAcademicYearAction} className="mt-2">
                        <input type="hidden" name="id" value={year.id} />
                        <Button
                          type="submit"
                          className="w-full bg-emerald-700 hover:bg-emerald-800"
                        >
                          Aktifkan
                        </Button>
                      </form>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <section>
          <Card className="mb-5">
            <form className="flex flex-wrap items-end gap-3" method="get">
              <FormField id="class-year" label="Tahun ajaran">
                <Select id="class-year" name="year" defaultValue={selectedYear?.id ?? ""}>
                  {years.map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField id="class-grade" label="Grade">
                <Select id="class-grade" name="grade" defaultValue={grade ?? ""}>
                  <option value="">Semua grade</option>
                  <option value="X">X</option>
                  <option value="XI">XI</option>
                  <option value="XII">XII</option>
                </Select>
              </FormField>
              <Button type="submit">Terapkan</Button>
            </form>
          </Card>

          {classes.length === 0 ? (
            <EmptyState>Belum ada slot kelas untuk tahun ajaran ini.</EmptyState>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {classes.map((item) => {
                const label = classDisplayName(item.grade, item.classNumber);
                return (
                  <Card key={item.id}>
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-black">{label}</h2>
                        <p className="text-sm text-slate-500">
                          {item.activeStudentCount} siswa aktif
                        </p>
                      </div>
                      <Badge tone={item.isActive ? "success" : "danger"}>
                        {item.isActive ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </div>
                    <UnsavedForm action={updateClassAction} className="grid gap-3">
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="academicYearId" value={item.academicYearId} />
                      <input type="hidden" name="isActive" value={String(item.isActive)} />
                      <FormField id={`teacher-${item.id}`} label="Wali kelas">
                        <Input
                          id={`teacher-${item.id}`}
                          name="homeroomTeacher"
                          defaultValue={item.homeroomTeacher ?? ""}
                        />
                      </FormField>
                      <FormField id={`notes-${item.id}`} label="Catatan internal">
                        <Input
                          id={`notes-${item.id}`}
                          name="notes"
                          defaultValue={item.notes ?? ""}
                        />
                      </FormField>
                      <Button type="submit">Simpan metadata</Button>
                    </UnsavedForm>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <ClassStatusControl
                        id={item.id}
                        label={label}
                        academicYearId={item.academicYearId}
                        homeroomTeacher={item.homeroomTeacher ?? ""}
                        notes={item.notes ?? ""}
                        isActive={item.isActive}
                        action={updateClassAction}
                      />
                      <Link
                        className="inline-flex min-h-10 items-center rounded-lg border px-3 text-sm font-semibold"
                        href={`/manajemen-siswa?classId=${item.id}`}
                      >
                        Lihat anggota
                      </Link>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
