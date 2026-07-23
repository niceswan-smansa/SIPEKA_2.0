"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePageAccess } from "@/modules/authorization";

import { createStudentLifecycleService } from "../application/student-lifecycle-service";
import { createSupabaseStudentLifecycleRepository } from "../infrastructure/supabase-student-lifecycle.repository";

const text = (value: FormDataEntryValue | null) => (typeof value === "string" ? value : "");
const service = () => createStudentLifecycleService(createSupabaseStudentLifecycleRepository());

function rethrowRedirect(error: unknown) {
  if (error && typeof error === "object" && "digest" in error) throw error;
}

export async function importStudentsAction(formData: FormData) {
  await requirePageAccess("ADMIN_MUTATION");
  try {
    const rows = JSON.parse(text(formData.get("rows"))) as unknown;
    const created = await service().importStudents({
      classId: text(formData.get("classId")),
      fileName: text(formData.get("fileName")),
      yearEntered: text(formData.get("yearEntered")),
      rows,
    });
    redirect(`/import-siswa?success=${created}`);
  } catch (error) {
    rethrowRedirect(error);
    redirect("/import-siswa?error=IMPORT_FAILED");
  }
}

export async function promoteStudentsAction(formData: FormData) {
  await requirePageAccess("ADMIN_MUTATION");
  try {
    const count = await service().promote(text(formData.get("academicYearId")));
    revalidatePath("/");
    redirect(`/naik-turun-grade?success=${count}`);
  } catch (error) {
    rethrowRedirect(error);
    redirect("/naik-turun-grade?error=PROMOTION_FAILED");
  }
}

export async function previewPromotionAction(formData: FormData) {
  await requirePageAccess("ADMIN_MUTATION");
  const academicYearId = text(formData.get("academicYearId"));
  try {
    await service().previewPromotion(academicYearId);
    redirect(`/naik-turun-grade?preview=${encodeURIComponent(academicYearId)}`);
  } catch (error) {
    rethrowRedirect(error);
    redirect("/naik-turun-grade?error=PREVIEW_FAILED");
  }
}

export async function rollbackPromotionAction(formData: FormData) {
  await requirePageAccess("ADMIN_MUTATION");
  try {
    const count = await service().rollback(text(formData.get("batchId")));
    revalidatePath("/");
    redirect(`/naik-turun-grade?rollback=${count}`);
  } catch (error) {
    rethrowRedirect(error);
    redirect("/naik-turun-grade?error=ROLLBACK_FAILED");
  }
}

export async function archiveAlumniAction(formData: FormData) {
  await requirePageAccess("ADMIN_MUTATION");
  try {
    await service().archive(text(formData.get("studentId")));
    revalidatePath("/alumni");
    redirect("/alumni?success=archived");
  } catch (error) {
    rethrowRedirect(error);
    redirect("/alumni?error=archive");
  }
}

export async function tombstoneAlumniAction(formData: FormData) {
  await requirePageAccess("ADMIN_MUTATION");
  try {
    await service().tombstone(text(formData.get("studentId")));
    revalidatePath("/alumni");
    redirect("/alumni?success=tombstoned");
  } catch (error) {
    rethrowRedirect(error);
    redirect("/alumni?error=tombstone");
  }
}
