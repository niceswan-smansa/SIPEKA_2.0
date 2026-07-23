import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

import { loadLocalSupabaseEnvironment, loadAdminConfiguration } from "./lib/supabase-admin.mjs";

const credentials = JSON.parse(await readFile(resolve(".local", "test-credentials.json"), "utf8"));
const local = loadLocalSupabaseEnvironment();
const { client: admin } = loadAdminConfiguration();
const { data: profile, error: profileError } = await admin
  .from("profiles")
  .select("id")
  .eq("username", credentials.users.admin.username)
  .single();
if (profileError || !profile) throw new Error("Fixture profile tidak tersedia.");
const { data: authUser, error: authLookupError } = await admin.auth.admin.getUserById(profile.id);
if (authLookupError || !authUser.user?.email) throw new Error("Fixture Auth user tidak tersedia.");

const publicClient = createClient(local.API_URL, local.ANON_KEY ?? local.PUBLISHABLE_KEY, {
  auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
});
const { data, error } = await publicClient.auth.signInWithPassword({
  email: authUser.user.email,
  password: credentials.password,
});
if (error) {
  console.log(`Local auth probe: failure (${error.code ?? "unknown"})`);
  process.exitCode = 1;
} else {
  console.log(`Local auth probe: success; user id match=${data.user?.id === profile.id}`);
  await publicClient.auth.signOut();
}
