import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import {
  PATCH_MARKER,
  PATCH_SOURCE,
  applyBackport,
  collectBraceExpansionPackages,
} from "./patch-brace-expansion-legacy.mjs";

const root = process.cwd();
const rootManifest = JSON.parse(fs.readFileSync("package.json", "utf8"));
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));

function fail(message, details = undefined) {
  if (details !== undefined) console.error(JSON.stringify(details, null, 2));
  throw new Error(message);
}

if (rootManifest.dependencies?.["brace-expansion-safe"] !== "npm:brace-expansion@5.0.8") {
  fail("package.json tidak mengunci brace-expansion-safe ke 5.0.8.");
}

if (rootManifest.overrides?.["brace-expansion@^5.0.0"] !== "5.0.8") {
  fail("Override brace-expansion 5.x tidak terkunci ke 5.0.8.");
}

const expectedScripts = {
  "patch:brace-expansion": "node tools/patch-brace-expansion-legacy.mjs",
  postinstall: "npm run patch:brace-expansion",
  prebuild: "npm run patch:brace-expansion",
};
for (const [name, expected] of Object.entries(expectedScripts)) {
  if (rootManifest.scripts?.[name] !== expected) {
    fail(`Script ${name} berubah.`, {
      expected,
      actual: rootManifest.scripts?.[name],
    });
  }
}

if (lock.packages?.[""]?.dependencies?.["brace-expansion-safe"] !== "npm:brace-expansion@5.0.8") {
  fail("Root package-lock tidak mengunci brace-expansion-safe ke 5.0.8.");
}

const requireFromRoot = createRequire(path.join(root, "package.json"));
const safeManifestPath = requireFromRoot.resolve("brace-expansion-safe/package.json");
const safeManifest = JSON.parse(fs.readFileSync(safeManifestPath, "utf8"));
if (safeManifest.name !== "brace-expansion" || safeManifest.version !== "5.0.8") {
  fail("Alias brace-expansion-safe tidak me-resolve upstream 5.0.8.", {
    safeManifestPath: path.relative(root, safeManifestPath),
    name: safeManifest.name,
    version: safeManifest.version,
  });
}

const checkResult = applyBackport({ root, checkOnly: true });

const { packages, danglingSymlinks } = collectBraceExpansionPackages(root);
if (danglingSymlinks.length) {
  fail("Dependency tree memiliki dangling symlink.", danglingSymlinks);
}

const inspected = [];
for (const item of packages) {
  if (item.version === "5.0.8") {
    inspected.push({
      path: item.relativePath,
      version: item.version,
      status: "upstream-patched",
    });
    continue;
  }

  if (item.major !== 1 && item.major !== 2) {
    fail("Versi brace-expansion di luar policy ditemukan.", {
      path: item.relativePath,
      version: item.version,
    });
  }

  const source = fs.readFileSync(item.mainFile, "utf8");
  if (source !== PATCH_SOURCE || !source.includes(PATCH_MARKER)) {
    fail("Source backport legacy berubah atau belum diterapkan.", {
      path: item.relativePath,
      version: item.version,
    });
  }

  const requireLegacy = createRequire(item.manifestPath);
  const safeFromLegacy = requireLegacy.resolve("brace-expansion-safe/package.json");
  const resolvedSafeManifest = JSON.parse(fs.readFileSync(safeFromLegacy, "utf8"));
  if (resolvedSafeManifest.name !== "brace-expansion" || resolvedSafeManifest.version !== "5.0.8") {
    fail("Legacy package tidak me-resolve implementasi aman 5.0.8.", {
      legacy: item.relativePath,
      safeFromLegacy: path.relative(root, safeFromLegacy),
      name: resolvedSafeManifest.name,
      version: resolvedSafeManifest.version,
    });
  }

  const legacyExpand = requireLegacy(item.directory);
  if (typeof legacyExpand !== "function") {
    fail("Backport tidak mempertahankan callable CommonJS API.", {
      path: item.relativePath,
    });
  }

  const result = legacyExpand("file-{a,b}.txt");
  if (JSON.stringify(result) !== JSON.stringify(["file-a.txt", "file-b.txt"])) {
    fail("Hasil kompatibilitas backport tidak sesuai.", {
      path: item.relativePath,
      result,
    });
  }

  const bounded = legacyExpand("{a,b}".repeat(100), {
    max: 1000,
    maxLength: 10_000,
  });
  const totalLength = bounded.reduce((sum, value) => sum + String(value).length, 0);
  if (totalLength > 10_000) {
    fail("Batas maxLength upstream 5.0.8 tidak diterapkan.", {
      path: item.relativePath,
      totalLength,
    });
  }

  inspected.push({
    path: item.relativePath,
    version: item.version,
    status: "legacy-package-with-verified-runtime-backport",
  });
}

console.log(
  JSON.stringify(
    {
      policy: "brace-expansion-runtime",
      advisory: "GHSA-mh99-v99m-4gvg",
      remediation:
        "legacy package identity retained; runtime delegated to brace-expansion-safe@5.0.8",
      checkResult,
      inspected,
      status: "ok",
    },
    null,
    2,
  ),
);
