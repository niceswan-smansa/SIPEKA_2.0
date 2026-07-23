import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const clientDirectory = resolve(".next/static");
const forbidden = [
  "SUPABASE_SERVICE_ROLE_KEY",
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  "@invalid.local",
  "deleted+",
].filter(Boolean);

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? collectFiles(join(directory, entry.name))
        : [join(directory, entry.name)],
    ),
  );
  return nested.flat();
}

for (const file of await collectFiles(clientDirectory)) {
  const contents = await readFile(file, "utf8");
  if (forbidden.some((value) => contents.includes(value))) {
    throw new Error(`Service-role marker ditemukan pada client bundle: ${file}`);
  }
}

console.log("Client bundle tidak mengandung service-role atau synthetic identity marker.");
