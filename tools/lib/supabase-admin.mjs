import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

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

  const localCli = resolve(
    "node_modules",
    ".bin",
    process.platform === "win32" ? "supabase.cmd" : "supabase",
  );
  const result = spawnSync(existsSync(localCli) ? localCli : "supabase", args, {
    encoding: "utf8",
  });
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

async function retryAuth(operation) {
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const retryable =
        error?.name === "AuthRetryableFetchError" ||
        (typeof error?.status === "number" && error.status >= 500);
      if (!retryable || attempt === 8) throw error;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 125));
    }
  }
}

export async function findUserByEmail(client, email) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await retryAuth(() =>
      client.auth.admin.listUsers({ page, perPage: 100 }),
    );
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
    const { data, error } = await retryAuth(() =>
      client.auth.admin.updateUserById(existing.id, {
        email_confirm: true,
        password,
      }),
    );
    if (error) throw error;
    if (!data.user || data.user.id !== existing.id || data.user.email !== email) {
      throw new Error("Auth fixture update tidak menghasilkan identity canonical.");
    }
    return data.user;
  }

  const { data, error } = await retryAuth(() =>
    client.auth.admin.createUser({
      email,
      email_confirm: true,
      password,
    }),
  );
  if (error) throw error;
  if (!data.user || data.user.email !== email) {
    throw new Error("Auth fixture create tidak menghasilkan identity canonical.");
  }
  return data.user;
}
