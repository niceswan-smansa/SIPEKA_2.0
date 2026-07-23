import { z } from "zod";

export type ImportRow = {
  nis: string | null;
  nisn: string | null;
  name: string;
  gender: "L" | "P";
};
export type ImportPreviewRow = ImportRow & { row: number; errors: string[] };

const formulaPrefix = /^[=+\-@]/;
const rowSchema = z.object({
  nis: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z
      .string()
      .trim()
      .regex(/^\d{1,40}$/)
      .nullable(),
  ),
  nisn: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z
      .string()
      .trim()
      .regex(/^\d{10}$/)
      .nullable(),
  ),
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
    if (values.length !== 4)
      return {
        nis: values[0]?.trim() || null,
        nisn: values[1]?.trim() || null,
        name: values[2]?.trim() ?? "",
        gender: (values[3]?.trim().toUpperCase() ?? "") as "L" | "P",
        row: index + 2,
        errors: ["Setiap baris harus memiliki tepat empat kolom."],
      };
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
    for (const row of rows)
      if (row[key] !== null) counts.set(row[key], (counts.get(row[key]) ?? 0) + 1);
    for (const row of rows)
      if (row[key] !== null && (counts.get(row[key]) ?? 0) > 1)
        row.errors.push(`${key.toUpperCase()} duplikat.`);
  }
  return rows;
}

export const importPayloadSchema = z.object({
  classId: z.uuid(),
  fileName: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .regex(/^[^/\\\0]+\.csv$/i),
  yearEntered: z.coerce.number().int().min(2000).max(2200),
  rows: z.array(rowSchema).min(1).max(500),
});

export const lifecycleIdSchema = z.uuid();

export const promotionPreviewSchema = z.object({
  from_year_id: z.uuid(),
  from_year_name: z.string(),
  to_year_id: z.uuid(),
  to_year_name: z.string(),
  total: z.coerce.number().int().nonnegative(),
  x_to_xi: z.coerce.number().int().nonnegative(),
  xi_to_xii: z.coerce.number().int().nonnegative(),
  xii_to_alumni: z.coerce.number().int().nonnegative(),
  missing_destination_classes: z.array(
    z.object({ grade: z.enum(["XI", "XII"]), class_number: z.number().int().min(1).max(10) }),
  ),
  safe_to_apply: z.boolean(),
});
export type PromotionPreview = z.infer<typeof promotionPreviewSchema>;

export function csvTemplate() {
  return "NIS,NISN,NAMA,JENIS_KELAMIN\n10001,0091234567,Nabila Putri,P\n10002,0091234568,Ahmad Fauzan,L\n";
}
