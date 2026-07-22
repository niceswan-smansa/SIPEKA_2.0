import "server-only";

import { createServerSupabaseClient } from "@/infrastructure/supabase/server";
import type { AppRole } from "@/shared/permissions";

import type { AccessContext } from "../domain/access";

export async function loadAccessContext(): Promise<AccessContext> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) return { authenticated: false, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, email, full_name, role, is_active, must_change_password")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile) return { authenticated: true, profile: null };

  return {
    authenticated: true,
    profile: {
      email: profile.email,
      fullName: profile.full_name,
      id: profile.id,
      isActive: profile.is_active,
      mustChangePassword: profile.must_change_password,
      role: profile.role as AppRole,
      username: profile.username,
    },
  };
}

export async function signOutCurrentSession() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
}
