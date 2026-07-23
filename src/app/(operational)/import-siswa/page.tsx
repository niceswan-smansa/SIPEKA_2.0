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
  const classes = (await createClassService(createSupabaseClassRepository()).list())
    .filter((item) => item.isActive && item.academicYearActive)
    .map((item) => ({ id: item.id, label: classDisplayName(item.grade, item.classNumber) }));
  return (
    <>
      <PageHeader
        title="Import Siswa"
        description="Validasi seluruh baris CSV sebelum menyimpan secara all-or-none."
      />
      {params.success ? (
        <Alert tone="success">{params.success} siswa berhasil diimport.</Alert>
      ) : null}
      {params.error ? (
        <Alert tone="error">Import dibatalkan; tidak ada siswa yang disimpan.</Alert>
      ) : null}
      <div className="mt-5">
        <StudentImportPreview classes={classes} />
      </div>
    </>
  );
}
