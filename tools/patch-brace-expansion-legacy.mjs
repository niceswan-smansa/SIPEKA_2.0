import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const PATCH_MARKER = "SIPEKA_BACKPORT_GHSA_mh99_v99m_4gvg_TO_BRACE_EXPANSION_5_0_8";

export const PATCH_SOURCE = `'use strict'

// ${PATCH_MARKER}
// Legacy brace-expansion 1.x/2.x packages retain their original package
// identity for semver compatibility, but delegate all expansion work to the
// separately installed, upstream-patched brace-expansion-safe@5.0.8.
const safeModule = require('brace-expansion-safe')
const safeExpand =
  typeof safeModule === 'function' ? safeModule : safeModule.expand

if (typeof safeExpand !== 'function') {
  throw new TypeError(
    'SIPEKA brace-expansion security backport could not resolve expand()',
  )
}

function legacyExpand(pattern, options) {
  return safeExpand(pattern, options)
}

legacyExpand.expand = safeExpand
legacyExpand.EXPANSION_MAX = safeModule.EXPANSION_MAX
legacyExpand.EXPANSION_MAX_LENGTH = safeModule.EXPANSION_MAX_LENGTH

module.exports = legacyExpand
`;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function majorOf(version) {
  const match = /^(\d+)\./.exec(version ?? "");
  return match ? Number(match[1]) : null;
}

export function collectBraceExpansionPackages(
  root = process.cwd(),
  nodeModules = path.join(root, "node_modules"),
) {
  const packages = [];
  const danglingSymlinks = [];
  const pending = [nodeModules];
  const visited = new Set();

  while (pending.length) {
    const directory = pending.pop();
    if (!fs.existsSync(directory)) continue;

    let realDirectory;
    try {
      realDirectory = fs.realpathSync(directory);
    } catch (error) {
      danglingSymlinks.push({
        path: path.relative(root, directory),
        error: String(error),
      });
      continue;
    }

    if (visited.has(realDirectory)) continue;
    visited.add(realDirectory);

    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === ".bin") continue;
      const current = path.join(directory, entry.name);

      let directoryLike = entry.isDirectory();
      if (entry.isSymbolicLink()) {
        try {
          directoryLike = fs.statSync(current).isDirectory();
        } catch (error) {
          danglingSymlinks.push({
            path: path.relative(root, current),
            target: fs.readlinkSync(current),
            error: String(error),
          });
          continue;
        }
      }
      if (!directoryLike) continue;

      if (entry.name.startsWith("@")) {
        pending.push(current);
        continue;
      }

      const manifestPath = path.join(current, "package.json");
      if (fs.existsSync(manifestPath)) {
        const manifest = readJson(manifestPath);
        if (manifest.name === "brace-expansion") {
          const mainFile = path.join(current, manifest.main || "index.js");
          packages.push({
            directory: current,
            manifestPath,
            mainFile,
            name: manifest.name,
            version: manifest.version,
            major: majorOf(manifest.version),
            relativePath: path.relative(root, current),
          });
        }

        const nested = path.join(current, "node_modules");
        if (fs.existsSync(nested)) pending.push(nested);
      }
    }
  }

  return { packages, danglingSymlinks };
}

export function applyBackport({
  root = process.cwd(),
  checkOnly = false,
  requireLegacy = true,
} = {}) {
  const nodeModules = path.join(root, "node_modules");
  if (!fs.existsSync(nodeModules)) {
    throw new Error(`node_modules tidak ditemukan: ${nodeModules}`);
  }

  const safeManifestPath = path.join(nodeModules, "brace-expansion-safe", "package.json");
  if (!fs.existsSync(safeManifestPath)) {
    throw new Error("Direct dependency brace-expansion-safe belum terpasang di root node_modules.");
  }

  const safeManifest = readJson(safeManifestPath);
  if (safeManifest.name !== "brace-expansion" || safeManifest.version !== "5.0.8") {
    throw new Error(
      `brace-expansion-safe harus menunjuk ke brace-expansion@5.0.8, ditemukan ${safeManifest.name}@${safeManifest.version}.`,
    );
  }

  const { packages, danglingSymlinks } = collectBraceExpansionPackages(root);
  if (danglingSymlinks.length) {
    throw new Error(
      `Dependency tree memiliki dangling symlink:\n${JSON.stringify(danglingSymlinks, null, 2)}`,
    );
  }

  const patched = [];
  const alreadyPatched = [];
  const safe = [];
  const unsupported = [];

  for (const item of packages) {
    if (item.version === "5.0.8") {
      safe.push(item);
      continue;
    }

    if (item.major !== 1 && item.major !== 2) {
      unsupported.push(item);
      continue;
    }

    if (!fs.existsSync(item.mainFile)) {
      throw new Error(`Main file brace-expansion tidak ditemukan: ${item.relativePath}`);
    }

    const currentSource = fs.readFileSync(item.mainFile, "utf8");
    if (currentSource === PATCH_SOURCE) {
      alreadyPatched.push(item);
      continue;
    }

    if (checkOnly) {
      throw new Error(`Backport belum diterapkan: ${item.relativePath}@${item.version}`);
    }

    const mode = fs.statSync(item.mainFile).mode;
    const temporary = `${item.mainFile}.sipeka-tmp-${process.pid}`;
    fs.writeFileSync(temporary, PATCH_SOURCE, { mode });
    fs.renameSync(temporary, item.mainFile);
    patched.push(item);
  }

  if (unsupported.length) {
    throw new Error(
      `Versi brace-expansion di luar policy ditemukan:\n${JSON.stringify(
        unsupported.map(({ relativePath, version }) => ({
          relativePath,
          version,
        })),
        null,
        2,
      )}`,
    );
  }

  const legacyCount = patched.length + alreadyPatched.length;
  if (requireLegacy && legacyCount === 0) {
    throw new Error(
      "Tidak ada brace-expansion legacy 1.x/2.x yang ditemukan; dependency policy harus ditinjau ulang.",
    );
  }

  return {
    safeVersion: safeManifest.version,
    patched: patched.map(({ relativePath, version }) => ({
      relativePath,
      version,
    })),
    alreadyPatched: alreadyPatched.map(({ relativePath, version }) => ({
      relativePath,
      version,
    })),
    safe: safe.map(({ relativePath, version }) => ({
      relativePath,
      version,
    })),
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;

if (invokedPath === import.meta.url) {
  const result = applyBackport();
  console.log(
    JSON.stringify(
      {
        policy: "brace-expansion-legacy-runtime-backport",
        advisory: "GHSA-mh99-v99m-4gvg",
        upstreamPatchedVersion: "5.0.8",
        ...result,
        status: "ok",
      },
      null,
      2,
    ),
  );
}
