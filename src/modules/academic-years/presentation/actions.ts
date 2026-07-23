"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePageAccess } from "@/modules/authorization";

import { createAcademicYearService } from "../application/academic-year-service";
import { createSupabaseAcademicYearRepository } from "../infrastructure/supabase-academic-year.repository";

const text = (value: FormDataEntryValue | null) => (typeof value === "string" ? value : "");
const service = () => createAcademicYearService(createSupabaseAcademicYearRepository());
const failureCode = (error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error
        ? String(error.message)
        : "";
  return (
    [
      "ACADEMIC_YEAR_DUPLICATE",
      "ACADEMIC_YEAR_INVALID",
      "ACADEMIC_YEAR_SWITCH_REQUIRES_PROMOTION",
    ].find((code) => message.includes(code)) ?? "ACADEMIC_YEAR_FAILED"
  );
};

export async function createAcademicYearAction(formData: FormData) {
  await requirePageAccess("ADMIN_MUTATION");
  try {
    await service().create({
      name: text(formData.get("name")),
      startDate: text(formData.get("startDate")),
      endDate: text(formData.get("endDate")),
      isActive: formData.get("isActive") === "on",
    });
  } catch (error) {
    redirect(`/manajemen-kelas?error=${failureCode(error)}`);
  }
  revalidatePath("/manajemen-kelas");
  redirect("/manajemen-kelas?success=year-created");
}

export async function updateAcademicYearAction(formData: FormData) {
  await requirePageAccess("ADMIN_MUTATION");
  const id = text(formData.get("id"));
  try {
    await service().update(id, {
      name: text(formData.get("name")),
      startDate: text(formData.get("startDate")),
      endDate: text(formData.get("endDate")),
    });
  } catch (error) {
    redirect(`/manajemen-kelas?year=${id}&error=${failureCode(error)}`);
  }
  revalidatePath("/manajemen-kelas");
  redirect(`/manajemen-kelas?year=${id}&success=year-updated`);
}

export async function activateAcademicYearAction(formData: FormData) {
  await requirePageAccess("ADMIN_MUTATION");
  const id = text(formData.get("id"));
  try {
    await service().activate(id);
  } catch (error) {
    redirect(`/manajemen-kelas?year=${id}&error=${failureCode(error)}`);
  }
  revalidatePath("/manajemen-kelas");
  redirect(`/manajemen-kelas?year=${id}&success=year-activated`);
}
