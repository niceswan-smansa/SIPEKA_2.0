import "server-only";

import { createServerSupabaseClient } from "@/infrastructure/supabase/server";
import { z } from "zod";

import type { CategoryPoint } from "../domain/dashboard";

const totalStudentSchema = z.object({
  student_id: z.uuid(),
  full_name: z.string(),
});

const statusStudentSchema = totalStudentSchema.extend({
  periods: z.array(z.coerce.number().int().min(1).max(10)),
});

const classDashboardSchema = z.object({
  class_id: z.uuid(),
  academic_year_id: z.uuid(),
  selected_date: z.iso.date(),
  total: z.array(totalStudentSchema),
  izin: z.array(statusStudentSchema),
  sakit: z.array(statusStudentSchema),
  tanpa_keterangan: z.array(statusStudentSchema),
  monthly: z.array(
    z.object({
      date: z.iso.date(),
      label: z.string(),
      izin: z.coerce.number().int().nonnegative(),
      sakit: z.coerce.number().int().nonnegative(),
      tanpa_keterangan: z.coerce.number().int().nonnegative(),
    }),
  ),
});

export type ClassDashboardStudent = {
  id: string;
  name: string;
  periods?: number[];
};

export type ClassDashboardData = {
  classId: string;
  academicYearId: string;
  selectedDate: string;
  total: ClassDashboardStudent[];
  izin: ClassDashboardStudent[];
  sakit: ClassDashboardStudent[];
  tanpaKeterangan: ClassDashboardStudent[];
  monthly: CategoryPoint[];
};

const mapTotal = (item: z.infer<typeof totalStudentSchema>): ClassDashboardStudent => ({
  id: item.student_id,
  name: item.full_name,
});

const mapStatus = (item: z.infer<typeof statusStudentSchema>): ClassDashboardStudent => ({
  id: item.student_id,
  name: item.full_name,
  periods: item.periods,
});

export async function getClassDashboard(
  classId: string,
  selectedDate: string,
): Promise<ClassDashboardData> {
  const client = await createServerSupabaseClient();
  const { data, error } = await client.rpc("phase13_get_class_dashboard", {
    p_class_id: classId,
    p_selected_date: selectedDate,
  });

  if (error || !data) throw error ?? new Error("CLASS_DASHBOARD_READ_FAILED");

  const parsed = classDashboardSchema.parse(data);
  return {
    classId: parsed.class_id,
    academicYearId: parsed.academic_year_id,
    selectedDate: parsed.selected_date,
    total: parsed.total.map(mapTotal),
    izin: parsed.izin.map(mapStatus),
    sakit: parsed.sakit.map(mapStatus),
    tanpaKeterangan: parsed.tanpa_keterangan.map(mapStatus),
    monthly: parsed.monthly.map((item) => ({
      label: item.label,
      izin: item.izin,
      sakit: item.sakit,
      tanpaKeterangan: item.tanpa_keterangan,
    })),
  };
}
