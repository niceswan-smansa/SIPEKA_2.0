import { loadAdminConfiguration, upsertAuthUser } from "./lib/supabase-admin.mjs";

const email = process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
const username = process.env.BOOTSTRAP_SUPER_ADMIN_USERNAME?.trim().toLowerCase();
const fullName = process.env.BOOTSTRAP_SUPER_ADMIN_FULL_NAME?.trim();
const password = process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD;
const allowRemote = process.env.ALLOW_REMOTE_SUPER_ADMIN_BOOTSTRAP === "true";

if (!email || !username || !fullName || !password || password.length < 12) {
  throw new Error("Environment bootstrap Super Admin tidak lengkap atau password terlalu pendek.");
}

if (!/^[a-z0-9._-]+$/.test(username)) throw new Error("Username Super Admin tidak valid.");

const { client } = loadAdminConfiguration({ allowRemote });
const user = await upsertAuthUser(client, { email, password });
const { error } = await client.from("profiles").upsert(
  {
    email,
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
