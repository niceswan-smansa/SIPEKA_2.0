import { describe, expect, it } from "vitest";

import { buildOperations, attendanceBatchSchema } from "../domain/attendance";

describe("attendance domain", () => {
  it("keeps untouched hours and emits explicit deletes only", () => {
    const operations = buildOperations(
      "00000000-0000-4000-8000-000000000001",
      { 1: { status: "IZIN", note: "rapat" }, 2: null },
      [
        { id: "record-1", periodNumber: 1, status: "SAKIT", note: null, version: 1 },
        { id: "record-2", periodNumber: 2, status: "IZIN", note: null, version: 1 },
        { id: "record-3", periodNumber: 3, status: "SAKIT", note: null, version: 1 },
      ],
    );
    expect(operations).toEqual([
      expect.objectContaining({ periodNumber: 1, mode: "upsert", status: "IZIN" }),
      expect.objectContaining({ periodNumber: 2, mode: "delete" }),
    ]);
    expect(operations).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ periodNumber: 3 })]),
    );
  });

  it("limits periods and accepts only official statuses", () => {
    expect(
      attendanceBatchSchema.safeParse({
        classId: "00000000-0000-4000-8000-000000000001",
        attendanceDate: "2026-07-23",
        operations: [
          { studentId: "00000000-0000-4000-8000-000000000002", periodNumber: 11, status: "IZIN" },
        ],
      }).success,
    ).toBe(false);
  });
});
