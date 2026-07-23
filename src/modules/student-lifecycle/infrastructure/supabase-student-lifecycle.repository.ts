import "server-only";

import { createServerSupabaseClient } from "@/infrastructure/supabase/server";

import type { StudentLifecycleRepository } from "../application/student-lifecycle-service";
import { promotionPreviewSchema } from "../domain/student-lifecycle";

export function createSupabaseStudentLifecycleRepository(): StudentLifecycleRepository {
  return {
    async importStudents(input) {
      const client = await createServerSupabaseClient();
      const { data, error } = await client.rpc("phase7_import_students", {
        p_class_id: input.classId,
        p_file_name: input.fileName,
        p_year_entered: input.yearEntered,
        p_rows: input.rows,
      });
      if (error || !data) throw error ?? new Error("IMPORT_FAILED");
      return Number((data as Record<string, unknown>).created);
    },
    async promote(toAcademicYearId) {
      const client = await createServerSupabaseClient();
      const { data, error } = await client.rpc("phase7_promote_academic_year", {
        p_to_academic_year_id: toAcademicYearId,
      });
      if (error || !data) throw error ?? new Error("PROMOTION_FAILED");
      return Number((data as Record<string, unknown>).promoted);
    },
    async previewPromotion(toAcademicYearId) {
      const client = await createServerSupabaseClient();
      const { data, error } = await client.rpc("phase10_preview_promotion", {
        p_to_academic_year_id: toAcademicYearId,
      });
      if (error || !data) throw error ?? new Error("PROMOTION_PREVIEW_FAILED");
      return promotionPreviewSchema.parse(data);
    },
    async rollback(batchId) {
      const client = await createServerSupabaseClient();
      const { data, error } = await client.rpc("phase7_rollback_promotion", {
        p_batch_id: batchId,
      });
      if (error || !data) throw error ?? new Error("ROLLBACK_FAILED");
      return Number((data as Record<string, unknown>).restored);
    },
    async archive(studentId) {
      const client = await createServerSupabaseClient();
      const { error } = await client.rpc("phase7_archive_alumni", { p_student_id: studentId });
      if (error) throw error;
    },
    async tombstone(studentId) {
      const client = await createServerSupabaseClient();
      const { error } = await client.rpc("phase7_tombstone_alumni", { p_student_id: studentId });
      if (error) throw error;
    },
    async listPromotionBatches() {
      const client = await createServerSupabaseClient();
      const { data, error } = await client
        .from("promotion_batches")
        .select(
          "id, status, created_at, from:academic_years!promotion_batches_from_academic_year_id_fkey(name), to:academic_years!promotion_batches_to_academic_year_id_fkey(name)",
        )
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        fromYear: (row.from as unknown as { name: string }).name,
        toYear: (row.to as unknown as { name: string }).name,
        status: row.status,
        createdAt: row.created_at,
      }));
    },
  };
}
