import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { format } from "prettier";

const args = ["gen", "types", "typescript", "--local"];
if (process.env.SUPABASE_WORKDIR) args.push("--workdir", process.env.SUPABASE_WORKDIR);

const result = spawnSync("npm", ["exec", "--", "supabase", ...args], {
  encoding: "utf8",
});
if (result.status !== 0) {
  process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

const target = resolve("src/infrastructure/supabase/database.types.ts");
const generated = await format(result.stdout, {
  parser: "typescript",
  printWidth: 100,
  semi: true,
  singleQuote: false,
  trailingComma: "all",
});

if (process.argv.includes("--check")) {
  const existing = await readFile(target, "utf8");
  const normalize = (value) =>
    value
      .replace(
        /  __InternalSupabase: \{\n    PostgrestVersion: "[^"]+";\n  \};\n/,
        "",
      )
      .replace(
        /      auth_rate_limit_buckets: \{\n[\s\S]*?      \};\n      classes:/,
        "      classes:",
      );
  if (normalize(existing) !== normalize(generated))
    throw new Error("Database types tidak sinkron. Jalankan npm run db:types.");
  console.log("Database types sinkron dengan schema lokal.");
} else {
  await writeFile(target, generated);
  console.log("Database types berhasil diperbarui.");
}
