import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

import { loadLocalSupabaseEnvironment } from "./lib/supabase-admin.mjs";

const marker = ".local/e2e-disposable";
if (
  process.env.SIPEKA_E2E_DISPOSABLE !== "true" ||
  !existsSync(marker) ||
  readFileSync(marker, "utf8").trim() !== "disposable"
) {
  throw new Error(
    "Simulasi sekolah destructive memerlukan SIPEKA_E2E_DISPOSABLE=true dan marker .local/e2e-disposable.",
  );
}

const { API_URL } = loadLocalSupabaseEnvironment();
const origin = new URL(API_URL);
if (!["127.0.0.1", "localhost"].includes(origin.hostname)) {
  throw new Error("Simulasi sekolah hanya boleh memakai Supabase lokal.");
}

const baseEnvironment = {
  ...process.env,
  SUPABASE_TELEMETRY_DISABLED: "1",
  DO_NOT_TRACK: "1",
};

for (const [command, args] of [
  ["npm", ["run", "db:reset"]],
  ["node", ["tools/refresh-local-gateway.mjs"]],
  ["npm", ["run", "seed:test-users"]],
  ["npm", ["run", "probe:test-auth"]],
  ["npm", ["run", "test:auth-policy"]],
  ["node", ["tools/run-local-next-production.mjs", "build"]],
]) {
  execFileSync(command, args, {
    stdio: "inherit",
    env: baseEnvironment,
  });
}

execFileSync(
  "npx",
  [
    "playwright",
    "test",
    "e2e/realistic-three-year-school-cycle.spec.ts",
    "--project=chromium",
    "--retries=0",
  ],
  {
    stdio: "inherit",
    env: {
      ...baseEnvironment,
      SIPEKA_REALISTIC_SCHOOL_SIMULATION: "true",
      PLAYWRIGHT_BASE_URL: "https://localhost:3443",
      PLAYWRIGHT_WEBSERVER_COMMAND: "node tools/run-local-next-production.mjs start",
      PLAYWRIGHT_WEBSERVER_URL: "https://localhost:3443",
    },
  },
);
