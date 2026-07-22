import { spawnSync } from "node:child_process";

import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

function parseEnvironment(output) {
  return Object.fromEntries(
    output
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        const key = line.slice(0, separator);
        const value = line.slice(separator + 1).replace(/^"|"$/g, "");
        return [key, value];
      }),
  );
}

export function loadLocalSupabaseEnvironment() {
  const args = ["status", "-o", "env"];
  if (process.env.SUPABASE_WORKDIR) args.push("--workdir", process.env.SUPABASE_WORKDIR);

  const result = spawnSync("supabase", args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error("Supabase lokal tidak dapat dibaca.");
  return parseEnvironment(result.stdout);
}

export function loadAdminConfiguration({ allowRemote = false } = {}) {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    const local = loadLocalSupabaseEnvironment();
    url = local.API_URL;
    serviceRoleKey = local.SERVICE_ROLE_KEY ?? local.SECRET_KEY;
  }

  if (!url || !serviceRoleKey) throw new Error("Konfigurasi admin Supabase tidak lengkap.");

  const hostname = new URL(url).hostname;
  if (!allowRemote && hostname !== "127.0.0.1" && hostname !== "localhost") {
    throw new Error("Provisioning test hanya boleh dijalankan pada Supabase lokal.");
  }

  return {
    client: createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
      realtime: { transport: WebSocket },
    }),
    url,
  };
}

export async function findUserByEmail(client, email) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;

    const user = data.users.find((candidate) => candidate.email === email);
    if (user) return user;
    if (data.users.length < 100) return null;
  }

  throw new Error("Jumlah akun lokal melebihi batas provisioning aman.");
}

export async function upsertAuthUser(client, { email, password }) {
  const existing = await findUserByEmail(client, email);
  if (existing) {
    const { data, error } = await client.auth.admin.updateUserById(existing.id, {
      email_confirm: true,
      password,
    });
    if (error) throw error;
    return data.user;
  }

  const { data, error } = await client.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
  });
  if (error) throw error;
  return data.user;
}
