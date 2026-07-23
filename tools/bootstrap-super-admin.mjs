import { randomUUID } from "node:crypto";

import { loadAdminConfiguration } from "./lib/supabase-admin.mjs";

const username = process.env.BOOTSTRAP_SUPER_ADMIN_USERNAME?.trim().toLowerCase();
const fullName = process.env.BOOTSTRAP_SUPER_ADMIN_FULL_NAME?.trim();
const password = process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD;
const allowRemote = process.env.ALLOW_REMOTE_SUPER_ADMIN_BOOTSTRAP === "true";

if (!username || !fullName || !password || password.length < 12) {
  throw new Error("Environment bootstrap Super Admin tidak lengkap atau password terlalu pendek.");
}

if (!/^[a-z0-9._-]+$/.test(username)) throw new Error("Username Super Admin tidak valid.");

const { client } = loadAdminConfiguration({ allowRemote });
const { data: profile, error: lookupError } = await client
  .from("profiles")
  .select("id")
  .eq("username", username)
  .maybeSingle();
if (lookupError) throw lookupError;
const authResult = profile
  ? await client.auth.admin.updateUserById(profile.id, { email_confirm: true, password })
  : await client.auth.admin.createUser({
      email: `bootstrap-${randomUUID()}@invalid.local`,
      email_confirm: true,
      password,
    });
if (authResult.error || !authResult.data.user)
  throw authResult.error ?? new Error("Auth Super Admin tidak tersedia.");
const user = authResult.data.user;
const { error } = await client.from("profiles").upsert(
  {
    email: null,
    full_name: fullName,
    id: user.id,
    is_active: true,
    must_change_password: true,
    role: "SUPER_ADMIN",
    username,
  },
  { onConflict: "id" },
);

if (error) throw error;
console.log("Super Admin bootstrap berhasil dibuat atau diperbarui; password tidak ditampilkan.");
