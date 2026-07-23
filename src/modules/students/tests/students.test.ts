import { describe, expect, it } from "vitest";

import {
  normalizeStudentIdentifier,
  normalizeStudentName,
  studentCreateSchema,
} from "../domain/students";

describe("student domain", () => {
  it("normalizes names and identifiers", () => {
    expect(normalizeStudentName("  Nabila   Putri ")).toBe("nabila putri");
    expect(normalizeStudentIdentifier(" 00123 ")).toBe("00123");
  });

  it("rejects alumni and invalid student forms", () => {
    expect(
      studentCreateSchema.safeParse({
        fullName: "Nabila Sintetis",
        nis: "SYN-001",
        nisn: "SYN-N-001",
        gender: "P",
        grade: "ALUMNI",
        classId: "20000000-0000-4000-8000-000000000001",
        yearEntered: 2026,
        isActive: true,
      }).success,
    ).toBe(false);
    expect(
      studentCreateSchema.safeParse({
        fullName: "Siswa Sintetis",
        nis: "SYN-002",
        nisn: "SYN-N-002",
        gender: "L",
        grade: "XI",
        classId: "20000000-0000-4000-8000-000000000001",
        yearEntered: 2026,
        isActive: true,
      }).success,
    ).toBe(true);
  });
});
