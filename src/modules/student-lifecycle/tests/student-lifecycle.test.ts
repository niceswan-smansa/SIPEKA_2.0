import { describe, expect, it } from "vitest";

import { csvTemplate, previewStudentCsv } from "../domain/student-lifecycle";

describe("student lifecycle CSV", () => {
  it("parses the canonical template", () => {
    expect(previewStudentCsv(csvTemplate())).toHaveLength(2);
  });
  it("rejects formula injection and duplicate identifiers", () => {
    const rows = previewStudentCsv("NIS,NISN,NAMA,JENIS_KELAMIN\n=1,2,Satu,L\n=1,3,Dua,P\n");
    expect(rows.every((row) => row.errors.length > 0)).toBe(true);
  });
  it("rejects malformed quotes", () => {
    expect(() => previewStudentCsv('NIS,NISN,NAMA,JENIS_KELAMIN\n1,2,"Nama,L\n')).toThrow(
      "CSV_QUOTE_INVALID",
    );
  });
});
