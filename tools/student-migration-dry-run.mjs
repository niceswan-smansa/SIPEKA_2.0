import { mkdir, readdir, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

import ExcelJS from "exceljs";

const sourceArg = process.argv.indexOf("--source");
const source = resolve(sourceArg >= 0 ? process.argv[sourceArg + 1] : "data_siswa");
const files = (await readdir(source)).filter((file) => file.toLowerCase().endsWith(".xlsx")).sort();
const aliases = new Map([
  ["NAMA", "name"],
  ["NAMA SISWA", "name"],
  ["NIS", "nis"],
  ["NISN", "nisn"],
  ["L/P", "gender"],
]);

const normalize = (value) =>
  String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
function cellText(cell) {
  try {
    return cell.text ?? "";
  } catch {
    const value = cell.value;
    if (value === null || value === undefined || typeof value === "object") return "";
    return String(value);
  }
}
function findHeader(worksheet) {
  const max = Math.min(30, worksheet.rowCount);
  for (let rowNumber = 1; rowNumber <= max; rowNumber += 1) {
    const columns = {};
    worksheet.getRow(rowNumber).eachCell((cell, column) => {
      const key = aliases.get(normalize(cellText(cell)));
      if (key) columns[key] = column;
    });
    if (columns.name && columns.nis && columns.nisn) return { rowNumber, columns };
  }
  return null;
}

const report = {
  generatedAt: new Date().toISOString(),
  workbookCount: files.length,
  workbooks: [],
};
for (const [workbookIndex, file] of files.entries()) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(resolve(source, file));
  const summary = {
    workbook: workbookIndex + 1,
    fileLabel: basename(file),
    sheetCount: workbook.worksheets.length,
    candidateSheets: 0,
    mappedSheets: 0,
    rows: 0,
    valid: 0,
    invalid: 0,
    missingName: 0,
    missingNis: 0,
    missingNisn: 0,
    invalidGender: 0,
    duplicateNis: 0,
    duplicateNisn: 0,
    ambiguities: [],
  };
  const seenNis = new Set();
  const seenNisn = new Set();
  for (const [sheetIndex, sheet] of workbook.worksheets.entries()) {
    const header = findHeader(sheet);
    if (!header) continue;
    summary.candidateSheets += 1;
    if (summary.candidateSheets > 10) summary.ambiguities.push(`sheet-index-${sheetIndex + 1}`);
    for (let rowNumber = header.rowNumber + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const name = cellText(row.getCell(header.columns.name)).trim();
      const nis = cellText(row.getCell(header.columns.nis)).trim();
      const nisn = cellText(row.getCell(header.columns.nisn)).trim();
      const gender = header.columns.gender
        ? normalize(cellText(row.getCell(header.columns.gender)))
        : "";
      if (!name && !nis && !nisn && !gender) continue;
      summary.rows += 1;
      if (!name) summary.missingName += 1;
      if (!nis) summary.missingNis += 1;
      if (!nisn) summary.missingNisn += 1;
      if (!["L", "P"].includes(gender)) summary.invalidGender += 1;
      if (nis && seenNis.has(nis)) summary.duplicateNis += 1;
      if (nisn && seenNisn.has(nisn)) summary.duplicateNisn += 1;
      if (nis) seenNis.add(nis);
      if (nisn) seenNisn.add(nisn);
      if (name && nis && nisn && ["L", "P"].includes(gender)) summary.valid += 1;
      else summary.invalid += 1;
    }
  }
  report.workbooks.push(summary);
}

await mkdir(resolve(".local"), { recursive: true });
await writeFile(resolve(".local/migration-dry-run.json"), `${JSON.stringify(report, null, 2)}\n`, {
  mode: 0o600,
});
console.log(`Workbook: ${report.workbookCount}`);
for (const item of report.workbooks) {
  console.log(
    `Workbook ${item.workbook}: sheet=${item.sheetCount}, kandidat=${item.candidateSheets}, row=${item.rows}, valid=${item.valid}, invalid=${item.invalid}, ambiguity=${item.ambiguities.length}`,
  );
}
console.log("Laporan redacted disimpan di .local/migration-dry-run.json.");
