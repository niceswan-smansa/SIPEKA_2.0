import "server-only";

import { createServerSupabaseClient } from "@/infrastructure/supabase/server";

import type { CategoryPoint, DashboardData, DashboardRepository } from "../domain/dashboard";

const category = (value: Record<string, unknown>, labelKey: string): CategoryPoint => ({
  label: String(value[labelKey]),
  izin: Number(value.izin ?? 0),
  sakit: Number(value.sakit ?? 0),
  tanpaKeterangan: Number(value.tanpa_keterangan ?? 0),
});

export function createSupabaseDashboardRepository(): DashboardRepository {
  return {
    async get(selectedDate) {
      const client = await createServerSupabaseClient();
      const { data, error } = await client.rpc("phase5_get_dashboard", {
        p_selected_date: selectedDate,
      });
      if (error || !data) throw error ?? new Error("DASHBOARD_READ_FAILED");
      const value = data as unknown as Record<string, unknown>;
      const summary = value.summary as Record<string, unknown>;
      return {
        selectedDate: String(value.selected_date),
        summary: {
          total: Number(summary.total ?? 0),
          izin: Number(summary.izin ?? 0),
          sakit: Number(summary.sakit ?? 0),
          tanpaKeterangan: Number(summary.tanpa_keterangan ?? 0),
        },
        daily: ((value.daily as Record<string, unknown>[]) ?? []).map((item) =>
          category(item, "class_label"),
        ),
        weekly: ((value.weekly as Record<string, unknown>[]) ?? []).map((item) =>
          category(item, "label"),
        ),
        monthly: ((value.monthly as Record<string, unknown>[]) ?? []).map((item) => ({
          label: String(item.day),
          total: Number(item.total ?? 0),
        })),
      } satisfies DashboardData;
    },
  };
}
