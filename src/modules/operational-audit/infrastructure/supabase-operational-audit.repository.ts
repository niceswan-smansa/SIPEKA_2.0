import "server-only";

import { createServerSupabaseClient } from "@/infrastructure/supabase/server";

import type { OperationalAuditRepository } from "../domain/operational-audit";

export function createSupabaseOperationalAuditRepository(): OperationalAuditRepository {
  return {
    async list(filter) {
      const client = await createServerSupabaseClient();
      let query = client
        .from("audit_logs")
        .select(
          "id, created_at, actor_name_snapshot, action, entity_type, entity_id, before_data, after_data, metadata",
          { count: "exact" },
        )
        .eq("scope", "OPERATIONAL")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range((filter.page - 1) * filter.pageSize, filter.page * filter.pageSize - 1);
      if (filter.action) query = query.ilike("action", `%${filter.action}%`);
      if (filter.search) {
        const escaped = filter.search.replace(/[%_]/g, "\\$&");
        query = query.or(
          `actor_name_snapshot.ilike.%${escaped}%,entity_type.ilike.%${escaped}%,entity_id.ilike.%${escaped}%`,
        );
      }
      const { data, count, error } = await query;
      if (error) throw error;
      return {
        total: count ?? 0,
        items: (data ?? []).map((row) => ({
          id: row.id,
          createdAt: row.created_at,
          actor: row.actor_name_snapshot,
          action: row.action,
          entityType: row.entity_type,
          entityId: row.entity_id,
          beforeData: row.before_data,
          afterData: row.after_data,
          metadata: row.metadata,
        })),
      };
    },
  };
}
