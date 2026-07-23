"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePageAccess } from "@/modules/authorization";

import { createStudentService } from "../application/student-service";
import { createSupabaseStudentRepository } from "../infrastructure/supabase-student.repository";

const text = (value: FormDataEntryValue | null) => (typeof value === "string" ? value : "");
const service = () => createStudentService(createSupabaseStudentRepository());
const errorCode = (error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error
        ? String(error.message)
        : "";
  return (
    [
      "DUPLICATE_NISN",
      "DUPLICATE_NIS",
      "GRADE_CLASS_MISMATCH",
      "CLASS_INACTIVE_OR_NOT_FOUND",
      "CLASS_NOT_IN_ACTIVE_YEAR",
      "STUDENT_ALUMNI_NOT_ALLOWED",
    ].find((code) => message.includes(code)) ?? "STUDENT_VALIDATION_ERROR"
  );
};
const baseInput = (formData: FormData) => ({
  fullName: text(formData.get("fullName")),
  nis: text(formData.get("nis")),
  nisn: text(formData.get("nisn")),
  gender: text(formData.get("gender")) as "L" | "P",
  yearEntered: Number(text(formData.get("yearEntered"))),
});

export async function createStudentAction(formData: FormData) {
  await requirePageAccess("ADMIN_MUTATION");
  let id: string;
  try {
    id = await service().create({
      ...baseInput(formData),
      grade: text(formData.get("grade")) as "X" | "XI" | "XII",
      classId: text(formData.get("classId")),
      isActive: formData.get("isActive") === "on",
    });
  } catch (error) {
    redirect(`/manajemen-siswa?error=${errorCode(error)}`);
  }
  revalidatePath("/manajemen-siswa");
  redirect(`/siswa/${id}?success=created`);
}

export async function updateStudentIdentityAction(formData: FormData) {
  await requirePageAccess("ADMIN_MUTATION");
  const id = text(formData.get("id"));
  try {
    await service().updateIdentity({ id, ...baseInput(formData) });
  } catch (error) {
    redirect(`/manajemen-siswa?student=${id}&error=${errorCode(error)}`);
  }
  revalidatePath("/manajemen-siswa");
  revalidatePath(`/siswa/${id}`);
  redirect(`/manajemen-siswa?student=${id}&success=student-updated`);
}

export async function changeStudentAcademicAction(formData: FormData) {
  await requirePageAccess("ADMIN_MUTATION");
  const id = text(formData.get("id"));
  try {
    await service().changeAcademic({
      id,
      grade: text(formData.get("grade")) as "X" | "XI" | "XII",
      classId: text(formData.get("classId")),
      isActive: formData.get("isActive") === "true",
    });
  } catch (error) {
    redirect(`/manajemen-siswa?student=${id}&error=${errorCode(error)}`);
  }
  revalidatePath("/manajemen-siswa");
  revalidatePath(`/siswa/${id}`);
  redirect(`/manajemen-siswa?student=${id}&success=academic-updated`);
}
