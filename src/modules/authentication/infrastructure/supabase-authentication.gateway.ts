import "server-only";

import { createAdminSupabaseClient } from "@/infrastructure/supabase/admin";
import { createServerSupabaseClient } from "@/infrastructure/supabase/server";
import type { AccountProfile, AppRole } from "@/shared/permissions";

import type { AuthenticationGateway } from "../domain/authentication";

type ProfileRow = {
  id: string;
  username: string;
  full_name: string;
  role: AppRole;
  is_active: boolean;
  must_change_password: boolean;
};

function toProfile(row: ProfileRow): AccountProfile {
  return {
    fullName: row.full_name,
    id: row.id,
    isActive: row.is_active,
    mustChangePassword: row.must_change_password,
    role: row.role,
    username: row.username,
  };
}

export async function createSupabaseAuthenticationGateway(): Promise<AuthenticationGateway> {
  const serverClient = await createServerSupabaseClient();

  return {
    async completePasswordChange(profile) {
      void profile;
      const { error } = await serverClient.rpc("complete_password_change");
      return !error;
    },
    async getProfile(userId) {
      const { data, error } = await serverClient
        .from("profiles")
        .select("id, username, full_name, role, is_active, must_change_password")
        .eq("id", userId)
        .maybeSingle();

      return error || !data ? null : toProfile(data);
    },
    async resolveAuthIdentity(username) {
      const adminClient = createAdminSupabaseClient();
      const { data, error } = await adminClient
        .from("profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();
      if (error || !data) return null;
      const auth = await adminClient.auth.admin.getUserById(data.id);
      return auth.error ? null : (auth.data.user?.email ?? null);
    },
    async recordLogin(userId) {
      const adminClient = createAdminSupabaseClient();
      await adminClient
        .from("profiles")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", userId);
    },
    async signInWithPassword(authIdentity, password) {
      const { data, error } = await serverClient.auth.signInWithPassword({
        email: authIdentity,
        password,
      });
      return error ? null : data.user.id;
    },
    async signOut() {
      await serverClient.auth.signOut();
    },
    async updatePassword(password) {
      const { error } = await serverClient.auth.updateUser({ password });
      return !error;
    },
  };
}
