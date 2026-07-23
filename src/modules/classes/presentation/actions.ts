"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePageAccess } from "@/modules/authorization";

import { createClassService } from "../application/class-service";
import { createSupabaseClassRepository } from "../infrastructure/supabase-class.repository";

const text = (value: FormDataEntryValue | null) => (typeof value === "string" ? value : "");

export async function updateClassAction(formData: FormData) {
  await requirePageAccess("ADMIN_MUTATION");
  const id = text(formData.get("id"));
  const year = text(formData.get("academicYearId"));
  try {
    await createClassService(createSupabaseClassRepository()).update({
      id,
      homeroomTeacher: text(formData.get("homeroomTeacher")),
      notes: text(formData.get("notes")),
      isActive: formData.get("isActive") === "true",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "";
    const code = message.includes("CLASS_HAS_ACTIVE_STUDENTS")
      ? "CLASS_HAS_ACTIVE_STUDENTS"
      : "CLASS_UPDATE_FAILED";
    redirect(`/manajemen-kelas?year=${year}&error=${code}`);
  }
  revalidatePath("/manajemen-kelas");
  redirect(`/manajemen-kelas?year=${year}&success=class-updated`);
}
