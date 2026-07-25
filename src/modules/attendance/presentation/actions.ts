"use server";

import { requirePageAccess } from "@/modules/authorization";

import { createAttendanceService } from "../application/attendance-service";
import {
  attendanceBatchSchema,
  type AttendanceApplyResult,
  type AttendancePreview,
} from "../domain/attendance";
import { createSupabaseAttendanceRepository } from "../infrastructure/supabase-attendance.repository";

const service = () => createAttendanceService(createSupabaseAttendanceRepository());

export type AttendanceActionResult<T> =
  { ok: true; data: T } | { ok: false; code: string; referenceId: string };

const knownCodes = [
  "ATTENDANCE_NO_CHANGES",
  "ATTENDANCE_PAYLOAD_INVALID",
  "ATTENDANCE_PAYLOAD_LIMIT",
  "ATTENDANCE_PERIOD_CONFIGURATION_INVALID",
  "ATTENDANCE_DUPLICATE_OPERATION",
  "ATTENDANCE_CLASS_CONFLICT",
  "ATTENDANCE_ROSTER_CHANGED",
  "ATTENDANCE_SCOPE_INVALID",
  "ATTENDANCE_TOKEN_INVALID",
  "ATTENDANCE_TOKEN_USED",
  "ATTENDANCE_TOKEN_EXPIRED",
  "CLASS_INACTIVE_OR_NOT_FOUND",
  "DATE_OUTSIDE_ACADEMIC_YEAR",
  "FUTURE_DATE_NOT_ALLOWED",
  "STALE_PREVIEW",
] as const;

function rawError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return String(error);
}

function failure(error: unknown): AttendanceActionResult<never> {
  const raw = rawError(error);
  const code = knownCodes.find((value) => raw.includes(value)) ?? "ATTENDANCE_FAILED";
  const referenceId = crypto.randomUUID().split("-")[0]!.toUpperCase();

  console.error(
    JSON.stringify({
      event: "attendance_action_failed",
      code,
      referenceId,
      providerMessage: raw.slice(0, 500),
    }),
  );

  return { ok: false, code, referenceId };
}

export async function previewAttendanceAction(
  input: unknown,
): Promise<AttendanceActionResult<AttendancePreview>> {
  await requirePageAccess("ADMIN_MUTATION");
  try {
    const parsed = attendanceBatchSchema.parse(input);
    return { ok: true, data: await service().preview(parsed) };
  } catch (error) {
    return failure(error);
  }
}

export async function applyAttendanceAction(
  input: unknown,
  token: string,
): Promise<AttendanceActionResult<AttendanceApplyResult>> {
  await requirePageAccess("ADMIN_MUTATION");
  try {
    const parsed = attendanceBatchSchema.parse(input);
    return { ok: true, data: await service().apply({ ...parsed, token }) };
  } catch (error) {
    return failure(error);
  }
}
