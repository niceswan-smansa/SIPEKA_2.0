import { z } from "zod";

export type ImportRow = { nis: string; nisn: string; name: string; gender: "L" | "P" };
export type ImportPreviewRow = ImportRow & { row: number; errors: string[] };

const formulaPrefix = /^[=+\-@]/;
const rowSchema = z.object({
  nis: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .refine((value) => !formulaPrefix.test(value)),
  nisn: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .refine((value) => !formulaPrefix.test(value)),
  name: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .refine((value) => !formulaPrefix.test(value)),
  gender: z.enum(["L", "P"]),
});

function parseCsvRecords(source: string) {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      record.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      record.push(field);
      if (record.some((value) => value.trim())) records.push(record);
      record = [];
      field = "";
    } else field += char;
  }
  if (quoted) throw new Error("CSV_QUOTE_INVALID");
  record.push(field);
  if (record.some((value) => value.trim())) records.push(record);
  return records;
}

export function previewStudentCsv(source: string): ImportPreviewRow[] {
  const records = parseCsvRecords(source.replace(/^\uFEFF/, ""));
  const header = records.shift()?.map((value) => value.trim().toUpperCase());
  if (header?.join(",") !== "NIS,NISN,NAMA,JENIS_KELAMIN") throw new Error("CSV_HEADER_INVALID");
  if (records.length < 1 || records.length > 500) throw new Error("CSV_ROW_LIMIT");

  const rows = records.map((values, index) => {
    const parsed = rowSchema.safeParse({
      nis: values[0],
      nisn: values[1],
      name: values[2]?.replace(/\s+/g, " "),
      gender: values[3]?.trim().toUpperCase(),
    });
    const value = parsed.success
      ? parsed.data
      : {
          nis: values[0]?.trim() ?? "",
          nisn: values[1]?.trim() ?? "",
          name: values[2]?.trim() ?? "",
          gender: (values[3]?.trim().toUpperCase() ?? "") as "L" | "P",
        };
    return {
      ...value,
      row: index + 2,
      errors: parsed.success ? [] : ["Data wajib valid dan tidak boleh berupa formula."],
    };
  });
  for (const key of ["nis", "nisn"] as const) {
    const counts = new Map<string, number>();
    for (const row of rows) counts.set(row[key], (counts.get(row[key]) ?? 0) + 1);
    for (const row of rows)
      if ((counts.get(row[key]) ?? 0) > 1) row.errors.push(`${key.toUpperCase()} duplikat.`);
  }
  return rows;
}

export const importPayloadSchema = z.object({
  classId: z.uuid(),
  fileName: z.string().trim().min(1).max(160),
  yearEntered: z.coerce.number().int().min(2000).max(2200),
  rows: z.array(rowSchema).min(1).max(500),
});

export function csvTemplate() {
  return "NIS,NISN,NAMA,JENIS_KELAMIN\n10001,0091234567,Nabila Putri,P\n10002,0091234568,Ahmad Fauzan,L\n";
}
