"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePageAccess } from "@/modules/authorization";
import { todayJakarta } from "@/shared/domain/dates";

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
      "ACADEMIC_YEAR_OVERLAP",
      "ACADEMIC_YEAR_RANGE_CONFLICT",
      "ACADEMIC_YEAR_CONFIRM_REQUIRED",
      "ACADEMIC_YEAR_CORRECTION_TEXT_REQUIRED",
      "ACADEMIC_YEAR_ALREADY_CONFIGURED",
      "ACADEMIC_YEAR_ACTIVE_REQUIRED",
      "ACADEMIC_YEAR_NOT_FOUND",
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

export async function createInitialAcademicYearAction(formData: FormData) {
  await requirePageAccess("ADMIN_MUTATION");
  const yearService = service();
  const existing = await yearService.list();

  if (existing.length > 0) {
    redirect("/dashboard");
  }

  try {
    await yearService.create({
      name: text(formData.get("name")),
      startDate: text(formData.get("startDate")),
      endDate: text(formData.get("endDate")),
      isActive: true,
    });
  } catch (error) {
    redirect(`/pengaturan-awal?error=${failureCode(error)}`);
  }

  revalidatePath("/");
  redirect("/dashboard?setup=complete");
}

export async function createPromotionAcademicYearAction(formData: FormData) {
  await requirePageAccess("ADMIN_MUTATION");
  const yearService = service();

  try {
    const years = await yearService.list();
    if (!years.some((year) => year.isActive)) {
      throw new Error("ACADEMIC_YEAR_ACTIVE_REQUIRED");
    }

    const created = await yearService.create({
      name: text(formData.get("name")),
      startDate: text(formData.get("startDate")),
      endDate: text(formData.get("endDate")),
      isActive: false,
    });

    revalidatePath("/naik-turun-grade");
    redirect(`/naik-turun-grade?preview=${encodeURIComponent(created.id)}&created=year-created`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(`/naik-turun-grade?error=${failureCode(error)}`);
  }
}

export async function updateAcademicYearAction(formData: FormData) {
  await requirePageAccess("ADMIN_MUTATION");
  const id = text(formData.get("id"));

  try {
    const yearService = service();
    const current = (await yearService.list()).find((year) => year.id === id);
    if (!current) throw new Error("ACADEMIC_YEAR_NOT_FOUND");

    const next = {
      name: text(formData.get("name")),
      startDate: text(formData.get("startDate")),
      endDate: text(formData.get("endDate")),
    };
    const rangeChanged = next.startDate !== current.startDate || next.endDate !== current.endDate;

    if (
      rangeChanged &&
      current.startDate <= todayJakarta() &&
      formData.get("confirmRangeChange") !== "on"
    ) {
      throw new Error("ACADEMIC_YEAR_CONFIRM_REQUIRED");
    }

    if (
      rangeChanged &&
      current.endDate < todayJakarta() &&
      text(formData.get("confirmationText")) !== current.name
    ) {
      throw new Error("ACADEMIC_YEAR_CORRECTION_TEXT_REQUIRED");
    }

    await yearService.update(id, next);
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
