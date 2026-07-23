import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { loadLocalSupabaseEnvironment } from "./lib/supabase-admin.mjs";

const marker = ".local/e2e-disposable";
if (
  process.env.SIPEKA_E2E_DISPOSABLE !== "true" ||
  readFileSync(marker, "utf8").trim() !== "disposable"
) {
  throw new Error("E2E destructive memerlukan flag dan marker database disposable.");
}
const { API_URL } = loadLocalSupabaseEnvironment();
const origin = new URL(API_URL);
if (!["127.0.0.1", "localhost"].includes(origin.hostname)) {
  throw new Error("E2E destructive hanya boleh memakai Supabase lokal.");
}
for (const [command, args] of [
  ["npm", ["run", "db:reset"]],
  ["node", ["tools/refresh-local-gateway.mjs"]],
  ["npm", ["run", "seed:test-users"]],
  ["npx", ["playwright", "test"]],
])
  execFileSync(command, args, { stdio: "inherit" });
