import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { loadAdminConfiguration } from "./lib/supabase-admin.mjs";

const password = process.env.SIPEKA_TEST_PASSWORD ?? `Aa1!${randomBytes(18).toString("base64url")}`;
const nextPassword = `Bb2!${randomBytes(18).toString("base64url")}`;

if (password.length < 12) throw new Error("SIPEKA_TEST_PASSWORD minimal 12 karakter.");

const definitions = [
  {
    fullName: "Super Admin Phase 1 Sintetis",
    isActive: true,
    key: "superAdmin",
    mustChangePassword: false,
    role: "SUPER_ADMIN",
    username: "phase1.super",
  },
  {
    fullName: "Admin Phase 1 Sintetis",
    isActive: true,
    key: "admin",
    mustChangePassword: false,
    role: "ADMIN",
    username: "phase1.admin",
  },
  {
    fullName: "User Phase 1 Sintetis",
    isActive: true,
    key: "user",
    mustChangePassword: false,
    role: "USER",
    username: "phase1.user",
  },
  {
    fullName: "Akun Nonaktif Phase 1 Sintetis",
    isActive: false,
    key: "inactive",
    mustChangePassword: false,
    role: "USER",
    username: "phase1.inactive",
  },
  {
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
  const { data: existingProfile, error: profileLookupError } = await client
    .from("profiles")
    .select("id")
    .eq("username", definition.username)
    .maybeSingle();
  if (profileLookupError) throw profileLookupError;
  let user;
  if (existingProfile) {
    const { data, error } = await client.auth.admin.updateUserById(existingProfile.id, {
      email_confirm: true,
      password,
    });
    if (error) throw error;
    if (!data.user || data.user.id !== existingProfile.id) {
      throw new Error("Auth fixture update tidak menghasilkan user canonical.");
    }
    user = data.user;
  } else {
    const { data, error } = await client.auth.admin.createUser({
      email: `fixture-${randomUUID()}@invalid.local`,
      email_confirm: true,
      password,
    });
    if (error) throw error;
    if (!data.user) throw new Error("Auth fixture create tidak menghasilkan user.");
    user = data.user;
  }
  const { error } = await client.from("profiles").upsert(
    {
      email: null,
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
    id: user.id,
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
