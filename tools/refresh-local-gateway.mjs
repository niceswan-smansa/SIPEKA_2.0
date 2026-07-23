import { spawnSync } from "node:child_process";

const result = spawnSync("docker", ["restart", "supabase_kong_sipeka-2-0"], { stdio: "ignore" });

if (result.error || result.status !== 0) {
  throw new Error("Gateway Supabase lokal tidak dapat direstart.");
}
