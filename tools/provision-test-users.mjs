import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { loadAdminConfiguration, upsertAuthUser } from "./lib/supabase-admin.mjs";

const password = process.env.SIPEKA_TEST_PASSWORD ?? `Aa1!${randomBytes(18).toString("base64url")}`;
const nextPassword = `Bb2!${randomBytes(18).toString("base64url")}`;

if (password.length < 12) throw new Error("SIPEKA_TEST_PASSWORD minimal 12 karakter.");

const definitions = [
  {
    email: "phase1.super@sipeka.test",
    fullName: "Super Admin Phase 1 Sintetis",
    isActive: true,
    key: "superAdmin",
    mustChangePassword: false,
    role: "SUPER_ADMIN",
    username: "phase1.super",
  },
  {
    email: "phase1.admin@sipeka.test",
    fullName: "Admin Phase 1 Sintetis",
    isActive: true,
    key: "admin",
    mustChangePassword: false,
    role: "ADMIN",
    username: "phase1.admin",
  },
  {
    email: "phase1.user@sipeka.test",
    fullName: "User Phase 1 Sintetis",
    isActive: true,
    key: "user",
    mustChangePassword: false,
    role: "USER",
    username: "phase1.user",
  },
  {
    email: "phase1.inactive@sipeka.test",
    fullName: "Akun Nonaktif Phase 1 Sintetis",
    isActive: false,
    key: "inactive",
    mustChangePassword: false,
    role: "USER",
    username: "phase1.inactive",
  },
  {
    email: "phase1.change@sipeka.test",
    fullName: "Akun Ganti Password Phase 1 Sintetis",
    isActive: true,
    key: "mustChange",
    mustChangePassword: true,
    role: "ADMIN",
    username: "phase1.change",
  },
];

const { client, url } = loadAdminConfiguration();
const credentials = { nextPassword, password, url, users: {} };

for (const definition of definitions) {
  const user = await upsertAuthUser(client, { email: definition.email, password });
  const { error } = await client.from("profiles").upsert(
    {
      email: definition.email,
      full_name: definition.fullName,
      id: user.id,
      is_active: definition.isActive,
      must_change_password: definition.mustChangePassword,
      role: definition.role,
      username: definition.username,
    },
    { onConflict: "id" },
  );
  if (error) throw error;

  credentials.users[definition.key] = {
    email: definition.email,
    username: definition.username,
  };
}

const outputDirectory = resolve(".local");
const outputPath = resolve(outputDirectory, "test-credentials.json");
await mkdir(outputDirectory, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(credentials)}\n`, { mode: 0o600 });
console.log(
  `Provisioned ${definitions.length} disposable local accounts; credentials saved to ignored local output.`,
);
