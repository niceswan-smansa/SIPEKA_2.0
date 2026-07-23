import "server-only";

import { createServerSupabaseClient } from "@/infrastructure/supabase/server";

import type { AcademicYear, AcademicYearRepository } from "../domain/academic-years";

function mapYear(row: {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}): AcademicYear {
  return {
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    isActive: row.is_active,
  };
}

function mapRpc(value: unknown): AcademicYear {
  return mapYear(value as Parameters<typeof mapYear>[0]);
}

export function createSupabaseAcademicYearRepository(): AcademicYearRepository {
  return {
    async list() {
      const client = await createServerSupabaseClient();
      const { data, error } = await client
        .from("academic_years")
        .select("id, name, start_date, end_date, is_active")
        .order("start_date", { ascending: false })
        .order("id", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(mapYear);
    },
    async create(input) {
      const client = await createServerSupabaseClient();
      const { data, error } = await client.rpc("phase3_create_academic_year", {
        p_name: input.name,
        p_start_date: input.startDate,
        p_end_date: input.endDate,
        p_is_active: input.isActive,
      });
      if (error || !data) throw error ?? new Error("ACADEMIC_YEAR_CREATE_FAILED");
      return mapRpc(data);
    },
    async update(id, input) {
      const client = await createServerSupabaseClient();
      const { data, error } = await client.rpc("phase3_update_academic_year", {
        p_id: id,
        p_name: input.name,
        p_start_date: input.startDate,
        p_end_date: input.endDate,
      });
      if (error || !data) throw error ?? new Error("ACADEMIC_YEAR_UPDATE_FAILED");
      return mapRpc(data);
    },
    async activate(id) {
      const client = await createServerSupabaseClient();
      const { error } = await client.rpc("phase3_activate_academic_year", { p_id: id });
      if (error) throw error;
    },
  };
}
