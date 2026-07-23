"use server";

import { requirePageAccess } from "@/modules/authorization";

import { createAttendanceService } from "../application/attendance-service";
import { attendanceBatchSchema } from "../domain/attendance";
import { createSupabaseAttendanceRepository } from "../infrastructure/supabase-attendance.repository";

const service = () => createAttendanceService(createSupabaseAttendanceRepository());

export async function previewAttendanceAction(input: unknown) {
  await requirePageAccess("ADMIN_MUTATION");
  const parsed = attendanceBatchSchema.parse(input);
  return service().preview(parsed);
}

export async function applyAttendanceAction(input: unknown, token: string) {
  await requirePageAccess("ADMIN_MUTATION");
  const parsed = attendanceBatchSchema.parse(input);
  return service().apply({ ...parsed, token });
}
