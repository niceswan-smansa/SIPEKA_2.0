import Link from "next/link";

import { requirePageAccess } from "@/modules/authorization";
import {
  classDisplayName,
  createClassService,
  createSupabaseClassRepository,
} from "@/modules/classes";
import {
  createStudentSearchRepository,
  createStudentSearchService,
  StudentFilters,
} from "@/modules/student-search";
import {
  changeStudentAcademicAction,
  createStudentAction,
  createStudentService,
  createSupabaseStudentRepository,
  StudentList,
  StudentStatusControl,
  updateStudentIdentityAction,
  type StudentRecord,
} from "@/modules/students";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  FormField,
  Input,
  PageHeader,
  Pagination,
  Select,
  UnsavedForm,
} from "@/shared/ui";

type Props = {
  searchParams: Promise<Record<string, string | undefined>>;
};

const errors: Record<string, string> = {
  DUPLICATE_NIS: "NIS sudah digunakan siswa lain.",
  DUPLICATE_NISN: "NISN sudah digunakan siswa lain.",
  GRADE_CLASS_MISMATCH: "Grade siswa tidak sesuai dengan kelas.",
  CLASS_INACTIVE_OR_NOT_FOUND: "Kelas tidak aktif atau tidak ditemukan.",
  CLASS_NOT_IN_ACTIVE_YEAR: "Kelas tidak berada pada tahun ajaran aktif.",
  STUDENT_VALIDATION_ERROR: "Data siswa belum valid. Periksa kembali semua field.",
};

export default async function StudentManagementPage({ searchParams }: Props) {
  await requirePageAccess("ADMIN_MUTATION");
  const params = await searchParams;
  const classService = createClassService(createSupabaseClassRepository());
  const allClasses = await classService.list();
  const activeYearId = allClasses.find((item) => item.academicYearActive)?.academicYearId;
  const availableClasses = allClasses.filter(
    (item) =>
      item.isActive &&
      item.academicYearActive &&
      (!activeYearId || item.academicYearId === activeYearId),
  );
  const search = await createStudentSearchService(createStudentSearchRepository()).search({
    ...params,
    status: params.status ?? "active",
  });
  const selectedStudent = params.student
    ? await createStudentService(createSupabaseStudentRepository()).getDetail(params.student)
    : null;
  const totalPages = Math.max(1, Math.ceil(search.result.total / search.result.pageSize));
  const pageHref = (page: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params))
      if (value && key !== "page") query.set(key, value);
    query.set("page", String(page));
    return `/manajemen-siswa?${query.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Manajemen Siswa"
        description="Tambah, edit, pindah kelas, serta aktifkan atau nonaktifkan siswa."
        action={
          <Link className="font-semibold text-[var(--brand)]" href="/siswa">
            Buka pencarian read-only
          </Link>
        }
      />
      {params.error ? (
        <Alert tone="error">
          {errors[params.error] ?? "Operasi siswa tidak dapat diselesaikan."}
        </Alert>
      ) : null}
      {params.success ? (
        <Alert tone="success">Perubahan siswa berhasil disimpan dan diaudit.</Alert>
      ) : null}

      <div className="mt-5 grid gap-5 xl:grid-cols-[390px_1fr]">
        <div className="grid content-start gap-5">
          <Card>
            <h2 className="mb-4 text-lg font-bold">Tambah siswa</h2>
            <UnsavedForm action={createStudentAction} className="grid gap-4">
              <StudentIdentityFields prefix="create" />
              <AcademicFields classes={availableClasses} prefix="create" />
              <label className="flex items-center gap-2 text-sm">
                <Checkbox name="isActive" defaultChecked /> Siswa aktif
              </label>
              <Button type="submit">Tambah siswa</Button>
            </UnsavedForm>
          </Card>

          {selectedStudent ? (
            <Card>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">Edit {selectedStudent.fullName}</h2>
                  <Link
                    className="text-sm font-semibold text-[var(--brand)]"
                    href={`/siswa/${selectedStudent.id}`}
                  >
                    Lihat detail
                  </Link>
                </div>
              </div>
              <UnsavedForm action={updateStudentIdentityAction} className="grid gap-4">
                <input type="hidden" name="id" value={selectedStudent.id} />
                <StudentIdentityFields prefix="edit" student={selectedStudent} />
                <Button type="submit">Simpan identitas</Button>
              </UnsavedForm>
              <hr className="my-5 border-slate-200" />
              <UnsavedForm action={changeStudentAcademicAction} className="grid gap-4">
                <input type="hidden" name="id" value={selectedStudent.id} />
                <input type="hidden" name="isActive" value={String(selectedStudent.isActive)} />
                <AcademicFields
                  classes={availableClasses}
                  prefix="edit"
                  student={selectedStudent}
                />
                <Button type="submit">Simpan grade / kelas</Button>
              </UnsavedForm>
              {selectedStudent.currentClassId && selectedStudent.currentGrade !== "ALUMNI" ? (
                <div className="mt-4">
                  <StudentStatusControl
                    id={selectedStudent.id}
                    name={selectedStudent.fullName}
                    grade={selectedStudent.currentGrade}
                    classId={selectedStudent.currentClassId}
                    isActive={selectedStudent.isActive}
                    action={changeStudentAcademicAction}
                  />
                </div>
              ) : null}
            </Card>
          ) : null}
        </div>

        <section className="min-w-0">
          <Card className="mb-5">
            <StudentFilters classes={availableClasses} />
          </Card>
          <StudentList students={search.result.items} showManagement />
          <div className="mt-5">
            <Pagination
              page={search.result.page}
              totalPages={totalPages}
              {...(search.result.page > 1
                ? { previousHref: pageHref(search.result.page - 1) }
                : {})}
              {...(search.result.page < totalPages
                ? { nextHref: pageHref(search.result.page + 1) }
                : {})}
            />
          </div>
        </section>
      </div>
    </>
  );
}

function StudentIdentityFields({
  prefix,
  student,
}: {
  prefix: string;
  student?: {
    fullName: string;
    nis: string;
    nisn: string;
    gender: "L" | "P";
    yearEntered: number | null;
  };
}) {
  return (
    <>
      <FormField id={`${prefix}-full-name`} label="Nama lengkap">
        <Input
          id={`${prefix}-full-name`}
          name="fullName"
          defaultValue={student?.fullName}
          required
        />
      </FormField>
      <FormField id={`${prefix}-nis`} label="NIS">
        <Input id={`${prefix}-nis`} name="nis" defaultValue={student?.nis} required />
      </FormField>
      <FormField id={`${prefix}-nisn`} label="NISN">
        <Input id={`${prefix}-nisn`} name="nisn" defaultValue={student?.nisn} required />
      </FormField>
      <FormField id={`${prefix}-gender`} label="Jenis kelamin">
        <Select id={`${prefix}-gender`} name="gender" defaultValue={student?.gender ?? "L"}>
          <option value="L">Laki-laki</option>
          <option value="P">Perempuan</option>
        </Select>
      </FormField>
      <FormField id={`${prefix}-year-entered`} label="Tahun masuk">
        <Input
          id={`${prefix}-year-entered`}
          name="yearEntered"
          type="number"
          min={1900}
          max={2200}
          defaultValue={student?.yearEntered ?? new Date().getFullYear()}
          required
        />
      </FormField>
    </>
  );
}

function AcademicFields({
  classes,
  prefix,
  student,
}: {
  classes: Awaited<ReturnType<ReturnType<typeof createClassService>["list"]>>;
  prefix: string;
  student?: Pick<StudentRecord, "currentGrade" | "currentClassId">;
}) {
  return (
    <>
      <FormField id={`${prefix}-grade`} label="Grade">
        <Select id={`${prefix}-grade`} name="grade" defaultValue={student?.currentGrade ?? "X"}>
          <option value="X">X</option>
          <option value="XI">XI</option>
          <option value="XII">XII</option>
        </Select>
      </FormField>
      <FormField id={`${prefix}-class`} label="Kelas aktif">
        <Select
          id={`${prefix}-class`}
          name="classId"
          defaultValue={student?.currentClassId ?? ""}
          required
        >
          <option value="" disabled>
            Pilih kelas
          </option>
          {classes.map((item) => (
            <option key={item.id} value={item.id}>
              {classDisplayName(item.grade, item.classNumber)}
            </option>
          ))}
        </Select>
      </FormField>
    </>
  );
}
