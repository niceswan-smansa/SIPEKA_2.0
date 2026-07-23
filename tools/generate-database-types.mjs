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
      .replace(/  __InternalSupabase: \{\n    PostgrestVersion: "[^"]+";\n  \};\n/, "")
      .replace(
        /      auth_rate_limit_buckets: \{\n[\s\S]*?      \};\n      classes:/,
        "      classes:",
      );
  if (normalize(existing) !== normalize(generated)) {
    const symbols = (value) =>
      [...value.matchAll(/^\s{4}([A-Za-z_][A-Za-z0-9_]*): \{/gm)].map((match) => match[1]);
    const before = new Set(symbols(existing));
    const after = new Set(symbols(generated));
    const missing = [...after].filter((name) => !before.has(name)).slice(0, 20);
    const extra = [...before].filter((name) => !after.has(name)).slice(0, 20);
    console.error(
      `Database type symbols differ; missing=${missing.join(",")}; extra=${extra.join(",")}`,
    );
    throw new Error("Database types tidak sinkron. Jalankan npm run db:types.");
  }
  console.log("Database types sinkron dengan schema lokal.");
} else {
  await writeFile(target, generated);
  console.log("Database types berhasil diperbarui.");
}
