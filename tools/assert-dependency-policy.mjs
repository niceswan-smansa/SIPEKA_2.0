import fs from "node:fs";
import { spawnSync } from "node:child_process";

const BRACE_ADVISORY = "https://github.com/advisories/GHSA-mh99-v99m-4gvg";
const UUID_ADVISORY = "https://github.com/advisories/GHSA-w5hq-g745-h8pq";

const braceMetaNames = new Set([
  "@eslint/config-array",
  "@eslint/eslintrc",
  "archiver",
  "archiver-utils",
  "brace-expansion",
  "eslint",
  "eslint-config-next",
  "eslint-plugin-import",
  "eslint-plugin-jsx-a11y",
  "eslint-plugin-react",
  "exceljs",
  "glob",
  "minimatch",
  "readdir-glob",
  "rimraf",
  "zip-stream",
]);
const uuidMetaNames = new Set(["uuid", "exceljs"]);

function fail(message, details = undefined) {
  if (details !== undefined) console.error(JSON.stringify(details, null, 2));
  throw new Error(message);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    ...options,
  });
  if (result.error) throw result.error;
  return result;
}

function assertRuntimeBackport() {
  const result = run(process.execPath, ["tools/assert-brace-expansion-runtime.mjs"], {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    fail("Validasi runtime backport brace-expansion gagal.");
  }
}

function assertUuidExceptionShape() {
  const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
  const packages = lock.packages ?? {};
  const parents = Object.entries(packages)
    .filter(([, data]) => data?.dependencies?.uuid)
    .map(([location, data]) => ({
      location,
      range: data.dependencies.uuid,
    }));

  if (
    parents.length !== 1 ||
    parents[0].location !== "node_modules/exceljs" ||
    parents[0].range !== "^8.3.0"
  ) {
    fail("Exception uuid berubah atau tidak lagi eksklusif milik ExcelJS.", parents);
  }

  const uuidPackages = Object.entries(packages)
    .filter(([, data]) => data?.name === "uuid" || data?.version === "8.3.2")
    .filter(([location]) => location.endsWith("node_modules/uuid"))
    .map(([location, data]) => ({
      location,
      name: data.name,
      version: data.version,
    }));

  if (!uuidPackages.some((item) => item.version === "8.3.2")) {
    fail("uuid 8.3.2 milik ExcelJS tidak ditemukan seperti policy terdokumentasi.", uuidPackages);
  }

  const excelRoot = "node_modules/exceljs/lib";
  if (!fs.existsSync(excelRoot)) {
    fail(`Source ExcelJS tidak ditemukan: ${excelRoot}`);
  }

  const uuidSources = [];
  const pending = [excelRoot];
  while (pending.length) {
    const directory = pending.pop();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const current = `${directory}/${entry.name}`;
      if (entry.isDirectory()) {
        pending.push(current);
      } else if (entry.isFile() && entry.name.endsWith(".js")) {
        const source = fs.readFileSync(current, "utf8");
        if (source.includes("require('uuid')") || source.includes('require("uuid")')) {
          uuidSources.push({ file: current, source });
        }
      }
    }
  }

  if (uuidSources.length !== 1) {
    fail(
      "Jumlah source ExcelJS yang mengimpor uuid berubah; exception harus ditinjau ulang.",
      uuidSources.map(({ file }) => file),
    );
  }

  const calls = [...uuidSources[0].source.matchAll(/uuidv4\(([^)]*)\)/g)].map((match) =>
    match[1].trim(),
  );

  if (!calls.length || calls.some(Boolean)) {
    fail("ExcelJS tidak lagi hanya memanggil uuidv4() tanpa caller-provided buffer.", {
      file: uuidSources[0].file,
      calls,
    });
  }
}

function audit(scope, extraArgs) {
  const result = run("npm", ["audit", "--json", "--audit-level=low", ...extraArgs]);
  const output = result.stdout.trim();
  if (!output) {
    fail(`${scope}: npm audit tidak menghasilkan JSON.`, result.stderr);
  }

  try {
    return JSON.parse(output);
  } catch {
    fail(`${scope}: output npm audit bukan JSON valid.`, {
      stdout: output.slice(0, 4000),
      stderr: result.stderr,
    });
  }
}

function leafAdvisories(report, name, seen = new Set()) {
  if (seen.has(name)) return [];
  seen.add(name);

  const vulnerability = report.vulnerabilities?.[name];
  if (!vulnerability) return [];

  const leaves = [];
  for (const via of vulnerability.via ?? []) {
    if (typeof via === "string") {
      leaves.push(...leafAdvisories(report, via, new Set(seen)));
    } else if (via && typeof via === "object") {
      leaves.push({
        source: via.source,
        name: via.name,
        severity: via.severity,
        url: via.url,
        range: via.range,
        title: via.title,
      });
    }
  }
  return leaves;
}

function inspect(scope, report) {
  const vulnerabilities = report.vulnerabilities ?? {};
  const blocked = [];
  const controlledReports = [];

  for (const [name, vulnerability] of Object.entries(vulnerabilities)) {
    const leaves = leafAdvisories(report, name);
    const urls = new Set(leaves.map((leaf) => leaf.url).filter(Boolean));
    const hasBrace = urls.has(BRACE_ADVISORY);
    const hasUuid = urls.has(UUID_ADVISORY);
    const onlyKnownAdvisories =
      urls.size > 0 && [...urls].every((url) => url === BRACE_ADVISORY || url === UUID_ADVISORY);
    const nameAllowed =
      (!hasBrace || braceMetaNames.has(name)) &&
      (!hasUuid || uuidMetaNames.has(name) || name === "exceljs");
    const leafSeverityAllowed = leaves.every((leaf) => {
      if (leaf.url === BRACE_ADVISORY) return leaf.severity === "high";
      if (leaf.url === UUID_ADVISORY) return leaf.severity === "moderate";
      return false;
    });

    if (onlyKnownAdvisories && nameAllowed && leafSeverityAllowed) {
      controlledReports.push({
        name,
        reportedSeverity: vulnerability.severity,
        advisories: [...urls],
        reason: hasBrace
          ? "registry metadata still identifies legacy package versions, while every installed legacy main file is hash-equivalent to the verified SIPEKA runtime backport delegating to brace-expansion@5.0.8"
          : "documented ExcelJS -> uuid 8.3.2 moderate exception without caller-provided buffer",
      });
      continue;
    }

    blocked.push({
      name,
      severity: vulnerability.severity,
      via: vulnerability.via,
      resolvedLeafAdvisories: leaves,
      fixAvailable: vulnerability.fixAvailable,
    });
  }

  if (blocked.length) {
    fail(`${scope}: vulnerability di luar policy terkontrol ditemukan.`, blocked);
  }

  return {
    scope,
    rawMetadata: report.metadata?.vulnerabilities,
    controlledReports,
    status: "ok",
  };
}

assertRuntimeBackport();
assertUuidExceptionShape();
const all = inspect("all-dependencies", audit("all-dependencies", []));
const production = inspect(
  "production-dependencies",
  audit("production-dependencies", ["--omit=dev"]),
);

console.log(JSON.stringify({ all, production }, null, 2));
