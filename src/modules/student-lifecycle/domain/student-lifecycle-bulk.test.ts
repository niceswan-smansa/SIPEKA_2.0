import { describe, expect, it } from "vitest";

import { bulkImportPayloadSchema } from "./student-lifecycle";

const batch = {
  academicYearId: "10000000-0000-4000-8000-000000000001",
  classId: "20000000-0000-4000-8000-000000000001",
  fileName: "x-1.csv",
  rows: [{ nis: "10001", nisn: "0091234567", name: "Nabila", gender: "P" as const }],
};

describe("bulkImportPayloadSchema", () => {
  it("accepts one valid class batch", () => {
    expect(bulkImportPayloadSchema.parse([batch])).toHaveLength(1);
  });

  it("rejects duplicate class scope", () => {
    expect(() =>
      bulkImportPayloadSchema.parse([
        batch,
        {
          ...batch,
          fileName: "x-1-lain.csv",
          rows: [{ nis: "10002", nisn: "0091234568", name: "Ahmad", gender: "L" }],
        },
      ]),
    ).toThrow(/Satu kelas hanya boleh/);
  });
});
