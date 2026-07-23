import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import ExcelJS from "exceljs";

import { loadAdminConfiguration } from "./lib/supabase-admin.mjs";

const source = resolve("data_siswa");
const mappings = [
  {
    file: "ABSEN kls X-26-27 NEW.xlsx",
    grade: "X",
    sheets: ["X-1", "X-2", "X-3", "X-4", "X-5", "X-6", "X-7", "X-8", "X-9", "X-10"],
    layout: "separate",
  },
  {
    file: "Absen kls XI-26-27  NEW.xlsx",
    grade: "XI",
    sheets: ["XI-A1 ", "XI-A2", "XI-A3", "XI-A4", "XI-A5", "XI-B", "XI-C", "XI-D", "XI-E", "XI-F"],
    layout: "combined",
  },
  {
    file: "Absen kls XII-26-27 OK.xlsx",
    grade: "XII",
    sheets: [
      "XII-A-1",
      "XII-A-2",
      "XII-A-3",
      "XII-A-4",
      "XII-A-5",
      "XII-A-6",
      "XII-A-7",
      "XII-B-1",
      "XII-B-2",
      "XII-B-3",
    ],
    layout: "separate",
  },
];
const reviewedNullNis = new Set(["XI|XI-E|31", "XI|XI-F|28", "XI|XI-F|38"]);
const reviewedNullNisn = new Set(["X|X-1|37", "X|X-5|13"]);

function text(cell) {
  try {
    return cell.text?.trim() ?? "";
  } catch {
    return "";
  }
}
function digits(value) {
  const normalized = value.trim().replace(/^'/, "").replace(/\.0+$/, "");
  return /^\d+$/.test(normalized) ? normalized : null;
}

const rows = [];
for (const mapping of mappings) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(resolve(source, mapping.file));
  for (const [sheetIndex, sheetName] of mapping.sheets.entries()) {
    const sheet = workbook.getWorksheet(sheetName);
    if (!sheet) throw new Error(`Mapping sheet tidak tersedia: ${mapping.grade}-${sheetIndex + 1}`);
    for (let rowNumber = 10; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const nameColumn = mapping.layout === "combined" ? 3 : 4;
      const genderColumn = mapping.layout === "combined" ? 4 : 5;
      const name = text(row.getCell(nameColumn)).replace(/\s+/g, " ");
      const gender = text(row.getCell(genderColumn)).toUpperCase();
      if (!name || !["L", "P"].includes(gender)) continue;

      const sourceRef = `${mapping.grade}|${sheetName.trim()}|${rowNumber}`;
      let nis;
      let nisn;
      if (mapping.layout === "combined") {
        const [rawNisn = "", rawNis = ""] = text(row.getCell(2)).split("/");
        nis = digits(rawNis);
        nisn = digits(rawNisn);
      } else {
        nis = digits(text(row.getCell(2)));
        nisn = digits(text(row.getCell(3)));
      }
      if (reviewedNullNis.has(sourceRef)) nis = null;
      if (reviewedNullNisn.has(sourceRef)) nisn = null;
      if (nis === null && !reviewedNullNis.has(sourceRef)) {
        throw new Error(
          `NIS tidak valid pada lokasi redacted ${mapping.grade}-${sheetIndex + 1}:${rowNumber}`,
        );
      }
      if ((nisn === null || nisn.length !== 10) && !reviewedNullNisn.has(sourceRef)) {
        throw new Error(
          `NISN tidak valid pada lokasi redacted ${mapping.grade}-${sheetIndex + 1}:${rowNumber}`,
        );
      }
      rows.push({
        class_number: sheetIndex + 1,
        gender,
        grade: mapping.grade,
        name,
        nis,
        nisn,
      });
    }
  }
}

const counts = Object.fromEntries(
  ["X", "XI", "XII"].map((grade) => [grade, rows.filter((r) => r.grade === grade).length]),
);
const duplicate = (key) => {
  const values = rows.map((row) => row[key]).filter(Boolean);
  return values.length !== new Set(values).size;
};
if (
  rows.length !== 1067 ||
  counts.X !== 359 ||
  counts.XI !== 358 ||
  counts.XII !== 350 ||
  rows.filter((row) => row.nis === null).length !== 3 ||
  rows.filter((row) => row.nisn === null).length !== 2 ||
  duplicate("nis") ||
  duplicate("nisn")
) {
  throw new Error("Reconciliation workbook tidak sesuai keputusan produk.");
}

const batchKey = createHash("sha256")
  .update(
    JSON.stringify(
      rows.map(({ grade, class_number, nis, nisn }) => [grade, class_number, nis, nisn]),
    ),
  )
  .digest("hex");
if (process.argv.includes("--apply")) {
  const { client } = loadAdminConfiguration();
  const { data, error } = await client.rpc("phase9_import_existing_students", {
    p_batch_key: batchKey,
    p_rows: rows,
  });
  if (error) throw error;
  const count = (column, value) => {
    let query = client.from("students").select("id", { count: "exact", head: true });
    if (value === null) query = query.is(column, null);
    else if (value !== undefined) query = query.eq(column, value);
    return query;
  };
  const [all, gradeX, gradeXI, gradeXII, nisNull, nisnNull, missingClass, classes] =
    await Promise.all([
      count(),
      count("current_grade", "X"),
      count("current_grade", "XI"),
      count("current_grade", "XII"),
      count("nis", null),
      count("nisn", null),
      count("current_class_id", null),
      client.from("classes").select("id", { count: "exact", head: true }).eq("is_active", true),
    ]);
  for (const result of [all, gradeX, gradeXI, gradeXII, nisNull, nisnNull, missingClass, classes])
    if (result.error) throw result.error;
  const actual = {
    classes: classes.count ?? 0,
    gradeX: gradeX.count ?? 0,
    gradeXI: gradeXI.count ?? 0,
    gradeXII: gradeXII.count ?? 0,
    nisNull: nisNull.count ?? 0,
    nisnNull: nisnNull.count ?? 0,
    pending: 0,
    total: all.count ?? 0,
  };
  if (
    actual.classes !== 30 ||
    actual.total !== 1067 ||
    actual.gradeX !== 359 ||
    actual.gradeXI !== 358 ||
    actual.gradeXII !== 350 ||
    actual.nisNull !== 3 ||
    actual.nisnNull !== 2 ||
    (missingClass.count ?? 0) !== 0
  ) {
    throw new Error("Reconciliation database gagal.");
  }
  await mkdir(resolve(".local"), { recursive: true });
  await writeFile(
    resolve(".local/real-local-reconciliation.json"),
    `${JSON.stringify({ ...actual, alreadyApplied: Boolean(data?.already_applied) }, null, 2)}\n`,
    { mode: 0o600 },
  );
}

console.log(
  `Reconciliation: classes=30 total=${rows.length} X=${counts.X} XI=${counts.XI} XII=${counts.XII} nis-null=3 nisn-null=2 pending=0`,
);
