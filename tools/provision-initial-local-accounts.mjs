import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { loadAdminConfiguration, retryAuth } from "./lib/supabase-admin.mjs";

const definitions = [
  ["kuddus", "Moh Kuddus, S.Ag, M.Th.I", "ADMIN"],
  ["intan.admin", "Intan Wijaya Kusumawati, S.Pd", "ADMIN"],
  ["intan.superadmin", "Intan Wijaya Kusumawati, S.Pd", "SUPER_ADMIN"],
  ["suci", "Suci Rahayu, S.Sos.I", "ADMIN"],
  ["nabila", "Nabila Diana, S.Pd", "ADMIN"],
];
const { client } = loadAdminConfiguration();
const credentials = [];

for (const [username, fullName, role] of definitions) {
  const password = `Aa1!${randomBytes(18).toString("base64url")}`;
  const { data: profile, error: lookupError } = await client
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (lookupError) throw lookupError;
  const auth = profile
    ? await retryAuth(() =>
        client.auth.admin.updateUserById(profile.id, { password, email_confirm: true }),
      )
    : await retryAuth(() =>
        client.auth.admin.createUser({
          email: `initial-${randomUUID()}@invalid.local`,
          password,
          email_confirm: true,
        }),
      );
  if (auth.error || !auth.data.user) throw auth.error ?? new Error("Auth account gagal dibuat.");
  const { error } = await client.from("profiles").upsert(
    {
      id: auth.data.user.id,
      username,
      full_name: fullName,
      role,
      email: null,
      is_active: true,
      must_change_password: true,
    },
    { onConflict: "id" },
  );
  if (error) throw error;
  credentials.push({ username, password });
}

await mkdir(resolve(".local"), { recursive: true });
await writeFile(
  resolve(".local/initial-account-credentials.json"),
  `${JSON.stringify({ accounts: credentials })}\n`,
  { mode: 0o600 },
);
console.log("Provisioned 5 initial local accounts; credentials saved to ignored local output.");
