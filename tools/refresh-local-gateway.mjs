import { spawnSync } from "node:child_process";

const runtime = ["docker", "podman"].find(
  (command) => spawnSync(command, ["version"], { stdio: "ignore" }).status === 0,
);
if (!runtime) throw new Error("Runtime container Docker/Podman tidak tersedia.");

const containers = spawnSync(runtime, ["ps", "--format", "{{.Names}}"], { encoding: "utf8" });
const preferred = process.env.SUPABASE_GATEWAY_CONTAINER;
const gateway =
  preferred ??
  containers.stdout
    .split("\n")
    .find((name) => name.startsWith("supabase_kong_") || name.startsWith("supabase_edge_runtime_"));
if (!gateway || spawnSync(runtime, ["restart", gateway], { stdio: "ignore" }).status !== 0)
  throw new Error("Gateway Supabase lokal tidak dapat direstart.");

const deadline = Date.now() + 30_000;
let healthy = false;
while (Date.now() < deadline) {
  try {
    const response = await fetch("http://127.0.0.1:54321/auth/v1/health");
    if (response.ok) {
      healthy = true;
      break;
    }
  } catch {
    // Poll until the bounded deadline.
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}
if (!healthy) throw new Error("Gateway Supabase lokal tidak sehat setelah restart.");
