import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

import { loadAdminConfiguration, loadLocalSupabaseEnvironment } from "./lib/supabase-admin.mjs";

const credentials = JSON.parse(await readFile(resolve(".local/test-credentials.json"), "utf8"));
if (JSON.stringify(credentials).includes("@")) {
  throw new Error("Fixture browser memuat Auth identity.");
}

const local = loadLocalSupabaseEnvironment();
const publicClient = createClient(local.API_URL, local.PUBLISHABLE_KEY ?? local.ANON_KEY, {
  realtime: { transport: WebSocket },
});
const signup = await publicClient.auth.signUp({
  email: `blocked-${randomUUID()}@invalid.local`,
  password: "BlockedSignup!123",
});
if (!signup.error) throw new Error("Public signup harus ditolak.");

const { client: admin } = loadAdminConfiguration();
const ids = Object.values(credentials.users).map((fixture) => fixture.id);
const { data: profiles, error } = await admin.from("profiles").select("id, email").in("id", ids);
if (
  error ||
  profiles?.length !== ids.length ||
  profiles.some((profile) => profile.email !== null)
) {
  throw new Error("Profile fixture harus tersedia dengan email NULL.");
}

for (const route of ["forgot-password", "recover", "magic-link", "otp"]) {
  if (existsSync(resolve("src/app", route)) || existsSync(resolve("src/app/(auth)", route))) {
    throw new Error(`Route recovery publik tidak boleh tersedia: ${route}`);
  }
}

console.log("Username-only Auth policy verified; no identity or credential was printed.");
