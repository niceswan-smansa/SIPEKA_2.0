import { spawn } from "node:child_process";

import { loadLocalSupabaseEnvironment } from "./lib/supabase-admin.mjs";

const local = loadLocalSupabaseEnvironment();
const child = spawn("next", ["dev"], {
  env: {
    ...process.env,
    // GoTrue's local compatibility path is most stable with the JWT anon key.
    // Hosted environments continue to use the configured publishable key.
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.ANON_KEY ?? local.PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_URL: local.API_URL,
    SUPABASE_SERVICE_ROLE_KEY: local.SECRET_KEY ?? local.SERVICE_ROLE_KEY,
  },
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code) => process.exit(code ?? 1));
