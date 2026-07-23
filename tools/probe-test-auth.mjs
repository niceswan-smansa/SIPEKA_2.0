import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

import { loadLocalSupabaseEnvironment } from "./lib/supabase-admin.mjs";

const credentials = JSON.parse(await readFile(resolve(".local", "test-credentials.json"), "utf8"));
const local = loadLocalSupabaseEnvironment();
const client = createClient(local.API_URL, local.PUBLISHABLE_KEY ?? local.ANON_KEY, {
  auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  realtime: { transport: WebSocket },
});
console.log(`Supabase local origin: ${new URL(local.API_URL).origin}`);
for (const key of ["admin", "mustChange"]) {
  const fixture = credentials.users[key];
  const result = await client.auth.signInWithPassword({
    email: fixture.email,
    password: credentials.password,
  });
  console.log(`${key} Auth success: ${String(!result.error)}`);
  console.log(`${key} Auth error code: ${result.error?.code ?? "none"}`);
  console.log(`${key} User ID cocok: ${String(result.data.user?.id === fixture.id)}`);
  if (result.error || result.data.user?.id !== fixture.id) process.exitCode = 1;
  await client.auth.signOut();
}
