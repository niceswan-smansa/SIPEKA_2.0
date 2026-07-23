import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { loadLocalSupabaseEnvironment } from "./lib/supabase-admin.mjs";

const runtime = ["docker", "podman"].find(
  (command) => spawnSync(command, ["version"], { stdio: "ignore" }).status === 0,
);
if (!runtime) throw new Error("Runtime container Docker/Podman tidak tersedia.");

const configuredWorkdir = process.env.SUPABASE_WORKDIR
  ? resolve(process.env.SUPABASE_WORKDIR)
  : null;
const configCandidates = [
  ...(configuredWorkdir
    ? [
        resolve(configuredWorkdir, "config.toml"),
        resolve(configuredWorkdir, "supabase/config.toml"),
      ]
    : []),
  resolve("supabase/config.toml"),
];
const configPath = configCandidates.find((candidate) => existsSync(candidate));
if (!configPath) throw new Error("config.toml Supabase lokal tidak ditemukan.");

const config = readFileSync(configPath, "utf8");
const projectId = /^project_id\s*=\s*"([^"]+)"$/m.exec(config)?.[1];
if (!projectId) throw new Error("project_id Supabase lokal tidak ditemukan.");

const containers = spawnSync(runtime, ["ps", "--format", "{{.Names}}"], {
  encoding: "utf8",
});
if (containers.error) throw containers.error;
if (containers.status !== 0) throw new Error("Daftar container lokal tidak dapat dibaca.");

const running = new Set(
  containers.stdout
    .split("\n")
    .map((name) => name.trim())
    .filter(Boolean),
);
const configured = process.env.SUPABASE_GATEWAY_CONTAINER?.trim();
const expected = `supabase_kong_${projectId}`;
const gateway = configured || expected;

if (!running.has(gateway)) {
  throw new Error(
    configured
      ? "Container gateway yang dikonfigurasi tidak sedang berjalan."
      : `Gateway Supabase lokal ${expected} tidak ditemukan.`,
  );
}

if (spawnSync(runtime, ["restart", gateway], { stdio: "ignore" }).status !== 0) {
  throw new Error("Gateway Supabase lokal tidak dapat direstart.");
}

const { API_URL } = loadLocalSupabaseEnvironment();
if (!API_URL) throw new Error("API_URL Supabase lokal tidak tersedia.");
const healthUrl = new URL("/auth/v1/health", API_URL);

const deadline = Date.now() + 30_000;
let healthy = false;

while (Date.now() < deadline) {
  try {
    const response = await fetch(healthUrl);
    if (response.ok) {
      healthy = true;
      break;
    }
  } catch {
    // Poll hingga deadline terlampaui.
  }
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
}

if (!healthy) throw new Error("Gateway Supabase lokal tidak sehat setelah restart.");
