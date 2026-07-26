import {
  createAcademicYearService,
  createSupabaseAcademicYearRepository,
} from "@/modules/academic-years";
import { requirePageAccess } from "@/modules/authorization";
import {
  classDisplayName,
  createClassService,
  createSupabaseClassRepository,
} from "@/modules/classes";
import { StudentImportPreview } from "@/modules/student-lifecycle";
import { Alert, PageHeader } from "@/shared/ui";

export default async function ImportStudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePageAccess("ADMIN_MUTATION");
  const params = await searchParams;
  const years = await createAcademicYearService(createSupabaseAcademicYearRepository()).list();
  const academicYears = years
    .filter((year) => year.isActive)
    .map((year) => ({ id: year.id, name: year.name }));
  const classes = (await createClassService(createSupabaseClassRepository()).list())
    .filter((item) => item.isActive && item.academicYearActive)
    .map((item) => ({
      id: item.id,
      academicYearId: item.academicYearId,
      label: classDisplayName(item.grade, item.classNumber),
    }));

  return (
    <>
      <PageHeader
        title="Import Siswa"
        description="Pilih tahun ajaran aktif dan beberapa kelas, preview seluruh CSV, lalu simpan secara transaksional all-or-none."
      />
      {params.success ? (
        <Alert tone="success">{params.success} siswa berhasil diimport.</Alert>
      ) : null}
      {params.error ? (
        <Alert tone="error">
          Bulk import dibatalkan; tidak ada siswa dari file mana pun yang disimpan.
        </Alert>
      ) : null}
      <div className="mt-5">
        <StudentImportPreview academicYears={academicYears} classes={classes} />
      </div>
    </>
  );
}
