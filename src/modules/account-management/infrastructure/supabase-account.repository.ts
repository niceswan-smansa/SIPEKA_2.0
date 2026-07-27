import "server-only";

import { createAdminSupabaseClient } from "@/infrastructure/supabase/admin";
import type { Database } from "@/infrastructure/supabase/database.types";

import type { AccountListResult, AccountRecord, AccountRepository } from "../domain/accounts";

type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  | "id"
  | "username"
  | "full_name"
  | "role"
  | "is_active"
  | "must_change_password"
  | "last_login_at"
  | "created_at"
  | "updated_at"
>;

function mapProfile(row: ProfileRow): AccountRecord {
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    role: row.role,
    isActive: row.is_active,
    mustChangePassword: row.must_change_password,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRpcProfile(value: unknown): AccountRecord {
  const row = value as Record<string, unknown>;
  return {
    id: String(row.id),
    username: String(row.username),
    fullName: String(row.full_name),
    role: row.role as AccountRecord["role"],
    isActive: Boolean(row.is_active),
    mustChangePassword: Boolean(row.must_change_password),
    lastLoginAt: row.last_login_at === null ? null : String(row.last_login_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function createSupabaseAccountRepository(): AccountRepository {
  const client = createAdminSupabaseClient();

  return {
    async listAccounts(query) {
      const pageSize = 20;
      const page = Math.max(1, query.page);
      let request = client
        .from("profiles")
        .select(
          "id, username, full_name, role, is_active, must_change_password, last_login_at, created_at, updated_at",
          { count: "exact" },
        )
        .in("role", ["ADMIN", "USER"])
        .order("full_name", { ascending: true })
        .order("id", { ascending: true });

      if (query.role) request = request.eq("role", query.role);
      if (query.active !== undefined) request = request.eq("is_active", query.active);
      if (query.search) {
        const safe = query.search.replace(/[(),%*_]/g, " ").trim();
        if (safe) request = request.or(`full_name.ilike.%${safe}%,username.ilike.%${safe}%`);
      }

      const { data, count, error } = await request.range(
        (page - 1) * pageSize,
        page * pageSize - 1,
      );
      if (error) throw error;

      return {
        items: (data ?? []).map(mapProfile),
        page,
        pageSize,
        total: count ?? 0,
      } satisfies AccountListResult;
    },

    async getAccount(id) {
      const { data, error } = await client
        .from("profiles")
        .select(
          "id, username, full_name, role, is_active, must_change_password, last_login_at, created_at, updated_at",
        )
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data ? mapProfile(data) : null;
    },

    async createAuthUser(input) {
      const { data, error } = await client.auth.admin.createUser({
        email: `sipeka-${crypto.randomUUID()}@invalid.local`,
        password: input.password,
        email_confirm: true,
        user_metadata: {},
      });
      if (error || !data.user) throw error ?? new Error("AUTH_CREATE_FAILED");
      return { id: data.user.id };
    },

    async deleteAuthUser(id) {
      const { error } = await client.auth.admin.deleteUser(id);
      if (error) throw error;
    },

    async updateAuthUser(id, input) {
      const { error } = await client.auth.admin.updateUserById(id, {
        ...(input.password ? { password: input.password } : {}),
      });
      if (error) throw error;
    },

    async replaceAuthIdentity(id, identity) {
      const { error } = await client.auth.admin.updateUserById(id, {
        email: identity,
        email_confirm: true,
      });
      if (error) throw error;
    },

    async insertProfile(input) {
      const { data, error } = await client.rpc("admin_create_account_profile", {
        p_actor_id: input.createdBy,
        p_target_id: input.id,
        p_full_name: input.fullName,
        p_username: input.username,
        p_email: "",
        p_role: input.role,
        p_is_active: input.isActive,
        p_must_change_password: input.mustChangePassword,
        p_request_id: input.requestId,
      });
      if (error || !data) throw error ?? new Error("ACCOUNT_CREATE_RPC_FAILED");
      return mapRpcProfile(data);
    },

    async updateProfile(input) {
      const { data, error } = await client.rpc("admin_update_account_profile", {
        p_actor_id: input.actorId,
        p_target_id: input.targetId,
        p_full_name: input.fullName,
        p_username: input.username,
        p_email: "",
        p_role: input.role,
        p_is_active: input.isActive,
        p_action: input.action,
        p_request_id: input.requestId,
      });
      if (error || !data) throw error ?? new Error("ACCOUNT_PROFILE_RPC_FAILED");
      return mapRpcProfile(data);
    },

    async markPasswordReset(input) {
      const { data, error } = await client.rpc("admin_mark_account_password_reset", {
        p_actor_id: input.actorId,
        p_target_id: input.targetId,
        p_request_id: input.requestId,
      });
      if (error || !data) throw error ?? new Error("ACCOUNT_PASSWORD_RPC_FAILED");
      return mapRpcProfile(data);
    },

    async tombstoneProfile(input) {
      const { data, error } = await client.rpc("admin_tombstone_account", {
        p_actor_id: input.actorId,
        p_target_id: input.targetId,
        p_tombstone_username: input.tombstoneUsername,
        p_request_id: input.requestId,
      });
      if (error || !data) throw error ?? new Error("ACCOUNT_TOMBSTONE_RPC_FAILED");
      return mapRpcProfile(data);
    },

    async revokeSessions() {
      return { status: "unsupported", code: "SESSION_REVOCATION_UNSUPPORTED" } as const;
    },
  };
}
